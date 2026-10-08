import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import * as transcript from '../utils/transcriptStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { buildRestoredThread, readServerConversationTurns } from '../serverConversationTurns'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { __resetThinClientForTests, isThinClientSession } from '../../thinClient/thinClient'

// The serverTurnsRestore harness: real hook, transcript store and server-offer store.
// Network boundaries are stubbed; the real thin predicate reads a persisted sign-in
// before the parent publishes persistenceSessionActive (the cold-load ordering).
const mockGetUserId = vi.fn<[], Promise<string | null>>()
vi.mock('../../../lib/supabase', () => ({
  getUserId: () => mockGetUserId(),
  getSessionIdentity: async () => ({ userId: await mockGetUserId(), accessToken: null }),
}))
vi.mock('../turnService', () => ({
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: vi.fn(),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../v5/eligibility')>(),
  isV5Eligible: () => ({ eligible: false }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const SCENARIO = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const OTHER = '66666666-8888-9999-aaaa-bbbbbbbbbbbb'
const AUTH_KEY = 'sb-test-auth-token'
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
const TURNS = readServerConversationTurns([
  { turn_id: 'server-t1', created_at: '2026-10-08T09:00:00Z', user_message: 'SERVER-QUESTION', assistant_message: 'SERVER-TRUTH' },
])!

function signIn(userId: string) {
  mockGetUserId.mockResolvedValue(userId)
  localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: `test-${userId}`, user: { id: userId } }))
}

function leaveLocalWords(content = 'LOCAL-STALE', scenarioId = SCENARIO) {
  localStorage.setItem(transcript.TRANSCRIPT_STORAGE_KEY, JSON.stringify({
    [scenarioId]: {
      savedAt: new Date().toISOString(), pageLoadId: 'an-earlier-page', dropped: 0,
      messages: [{ id: 'local-t1', role: 'user', content, ts: new Date().toISOString() }],
    },
  }))
}

async function offer(scenarioId = SCENARIO) {
  await act(async () => {
    useServerConversationTurnsStore.getState().offerServerConversationTurns({ scenarioId, turns: TURNS, run: RUN })
    await Promise.resolve()
  })
}

function words(messages: ReturnType<typeof useConversation>['messages']) {
  return messages.map(message => [message.role, message.content, message.sessionDivider])
}

function expectServerWords(messages: ReturnType<typeof useConversation>['messages']) {
  expect(words(messages)).toEqual(words(buildRestoredThread(TURNS, RUN)))
  expect(JSON.stringify(messages)).not.toContain('LOCAL-STALE')
}

describe('thin sessions use CEE turns instead of a leftover browser transcript', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetPersistenceSessionForTests()
    __resetThinClientForTests()
    transcript.__resetTranscriptTombstonesForTests()
    mockGetUserId.mockResolvedValue(null)
    useServerConversationTurnsStore.setState({ offer: null })
    scenarios.setCurrentScenarioId(SCENARIO)
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO, _hydratedThread: null })
  })
  afterEach(() => {
    __resetPersistenceSessionForTests()
    __resetThinClientForTests()
  })

  it('T1: signed in with LOCAL-STALE restores only SERVER-TRUTH', async () => {
    signIn('user-A')
    leaveLocalWords()
    expect(isThinClientSession()).toBe(true)
    const { result } = renderHook(() => useConversation())
    await offer()
    expectServerWords(result.current.messages)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })

  it('T1b: changing thin messages never writes the transcript key', async () => {
    signIn('user-A')
    const save = vi.spyOn(transcript, 'saveTranscript')
    const { result } = renderHook(() => useConversation())
    await offer()
    expectServerWords(result.current.messages) // proves the save effect had messages to persist
    expect(save).not.toHaveBeenCalled()
    expect(localStorage.getItem(transcript.TRANSCRIPT_STORAGE_KEY)).toBeNull()
  })

  it('T2: a guest keeps the local words over the same server offer', async () => {
    leaveLocalWords()
    expect(isThinClientSession()).toBe(false)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    const before = words(result.current.messages)
    expect(result.current.messages.some(message => message.content === 'LOCAL-STALE')).toBe(true)
    await offer()
    expect(words(result.current.messages)).toEqual(before)
    expect(JSON.stringify(result.current.messages)).not.toContain('SERVER-TRUTH')
    expect(transcript.loadTranscript(SCENARIO)?.messages[0].content).toBe('LOCAL-STALE')
  })

  it("T3: thin B opening S never sees thin A's leftover words", async () => {
    signIn('user-A')
    leaveLocalWords('LOCAL-STALE: private words from user A')
    // Deliberately retain the stale slot across the identity change: this reader
    // must be safe even when a previous sign-out sweep missed it.
    localStorage.removeItem(AUTH_KEY)
    signIn('user-B')
    const { result } = renderHook(() => useConversation())
    await offer()
    expectServerWords(result.current.messages)
    expect(JSON.stringify(result.current.messages)).not.toContain('user A')
  })

  it('thin late scenario-ID adoption ignores local words and accepts a waiting offer', async () => {
    signIn('user-A')
    leaveLocalWords()
    useCanvasStore.setState({ currentScenarioId: null })
    const { result } = renderHook(() => useConversation())
    await offer()
    await act(async () => { useCanvasStore.setState({ currentScenarioId: SCENARIO }) })
    expectServerWords(result.current.messages)
  })

  it('thin scenario switching ignores local words and accepts a waiting offer', async () => {
    signIn('user-A')
    leaveLocalWords('LOCAL-STALE', OTHER)
    const { result } = renderHook(() => useConversation())
    await offer(OTHER)
    await act(async () => { useCanvasStore.setState({ currentScenarioId: OTHER }) })
    expectServerWords(result.current.messages)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
})
