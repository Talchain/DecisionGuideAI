/** X4: CONTRACT-DERIVED actions; mount mocks reused from useConversation.serverTurnsRestore.spec.tsx. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import {
  readServerConversationTurns,
} from '../serverConversationTurns'

// This spec never sends a turn — it drives mount-restore and `resetCanvas` only.
// The mocks below exist solely to stop the hook reaching a network path at mount;
// the two spies are declared here rather than inherited from the sibling spec the
// preamble was adapted from (which is how `mockCallTurn` arrived undeclared).
const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

// Mock V5 adapter so callV5Turn never resolves (mirrors mockCallTurn's hang pattern).
// Without this, VITE_ENABLE_V5_ORCHESTRATOR=true causes the V5 path to make
// a real fetch(/bff/orchestrate/v2/turn) which fails fast, sets isThinking=false
// in the finally block, and breaks timeout-progression tests.
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  // getV5Endpoint is called unconditionally in bindRequestToInteraction on
  // every V5 send path (useConversation.ts ~L2967); an incomplete mock
  // leaves it undefined and throws "getV5Endpoint is not a function" —
  // same pattern fixed in the sibling useConversation.reasoning.spec.ts
  // (5bc479cf).
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

// Stop-fence (Codex P0): the server-visible explicit Stop. Mocked here so the
// notice-copy assertions below drive off the OUTCOME rather than a live fetch —
// which is the whole point of the three-state answer.
type StopFenceResult = {
  kind: 'not_saved' | 'already_saved' | 'unconfirmed'
  reason?: string
}
const mockStopV5Turn = vi.fn(
  (..._args: unknown[]): Promise<StopFenceResult> => Promise.resolve({ kind: 'not_saved' }),
)
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: (...args: unknown[]) => mockStopV5Turn(...args),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

// Mock V5 eligibility so the V5-specific describe blocks below (which
// exercise the V5 sendTurn branch) don't silently depend on the developer's
// untracked .env.local setting VITE_ENABLE_V5_ORCHESTRATOR=true — on a clean
// checkout isV5Eligible() resolves to false, sendMessage never enters the V5
// branch, and mockCallV5Turn/mockLoadScenario are never invoked (same root
// cause diagnosed + fixed for useConversation.reasoning.spec.ts in 5bc479cf).
// Defaults to false (V4 path) so the many V4-oriented blocks above are
// unaffected; the V5-only blocks below flip it on for their scope.
const mockIsV5Eligible = vi.fn<[{ flag: string | undefined }], { eligible: boolean; reason?: string }>()

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: (...args: unknown[]) => mockIsV5Eligible(...(args as [{ flag: string | undefined }])),
    isV5CanonicalRunPath: () =>
      flags.isV5CanonicalAnalysisEnabled() &&
      mockIsV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible,
  }
})

// 1.16i: telemetry sink for the run-click swallow guard.
const mockTrackEvent = vi.fn()
vi.mock('../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

// Mock Supabase getUserId: vi.fn() so tests can reconfigure per-scenario.
// Default: null (no auth session in test environment).
const mockGetUserId = vi.fn<[], Promise<string | null>>()

// Login 3.4: token knob for the getSessionIdentity bridge — tests that
// exercise the Bearer path set .value; everything else runs token-less.
const mockAccessToken = { value: null as string | null }

// ROADMAP 2.122 — `sendMessage` on an EMPTY canvas is now dispatched to the
// STREAMED turn sibling first (`<endpoint>/stream`, CEE #751), with a
// transparent fallback to the buffered turn on any stream failure.
//
// This spec's subject is the BUFFERED chain, so the streamed sibling is stubbed
// unreachable — which is not an artificial construction: it is exactly the state
// of a deployment where the streamed route is absent or refusing, and the
// fallback it triggers is the behaviour under test elsewhere
// (`streamedDraftTurn.spec.ts`). With the sibling unreachable the buffered path
// runs exactly once, which is what this spec's request-count pins measure.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: (...args: unknown[]) => mockGetUserId(...args as []),
  // Login 3.4: useConversation resolves identity via getSessionIdentity
  // (userId + access token in one getSession call). Backed by the same
  // mock so each test's userId intent carries over.
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: mockAccessToken.value,
  }),
}))

// Mock scenarioService loadScenario: vi.fn() so tests can return graph data.
// Default: null (no DB in test environment).
const mockLoadScenario = vi.fn<[string], Promise<unknown>>()

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...args as [string]),
}))

import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { loadTranscript, saveTranscript } from '../utils/transcriptStore'
import type { ConversationMessage } from '../types'

const SCENARIO = '77777777-8888-4999-aaaa-bbbbbbbbbbbb'
const OTHER = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const AT = '2026-10-06T09:01:00.000Z'
const ACTIONS = [
  { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', message: 'Run a pre-mortem with me: imagine this decision went badly. What most plausibly went wrong?' },
  { id: 'agent-next-what-would-change', label: 'What would change this?', message: 'What would most likely change this result?' },
  { id: 'agent-next-strengthen', label: 'Strengthen the model', message: 'What would most strengthen this model?' },
]
const WIRE = [
  { turn_id: 't1', created_at: '2026-10-06T09:00:00Z', user_message: 'Earlier question', assistant_message: 'Earlier answer' },
  { turn_id: 't2', created_at: AT, user_message: 'Run', assistant_message: 'The analysis is ready.', suggested_actions: ACTIONS },
]
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
const live = buildSuggestedActionChips([], ACTIONS)

function offer(scenarioId = SCENARIO, wire: unknown = WIRE, heldProposalOffers?: unknown) {
  useServerConversationTurnsStore.getState().offerServerConversationTurns({
    scenarioId, turns: readServerConversationTurns(wire)!, run: RUN, heldProposalOffers,
  })
}

function saveEarlierThread(newerUser = false, turnId = 't2') {
  const messages: ConversationMessage[] = [
    { id: 'local-user', role: 'user', content: 'Run', timestamp: new Date(AT) },
    { id: 'local-answer', clientTurnId: turnId, role: 'assistant', content: 'The analysis is ready.', timestamp: new Date(AT), actionChips: live },
    ...(newerUser ? [{ id: 'newer-user', role: 'user' as const, content: 'A later question', timestamp: new Date('2026-10-06T09:02:00Z') }] : []),
  ]
  saveTranscript(SCENARIO, messages)
  const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  stored[SCENARIO].pageLoadId = 'a-previous-page-load'
  expect(stored[SCENARIO].messages.every((message: Record<string, unknown>) => !('actionChips' in message))).toBe(true)
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored))
}

const chips = (messages: readonly ConversationMessage[]) => messages.filter(message => message.actionChips?.length)
const flush = async () => { await act(async () => { await Promise.resolve() }) }

describe('X4 — fresh server actions reconcile into the scenario-owned thread', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    __resetTranscriptTombstonesForTests()
    useServerConversationTurnsStore.setState({ offer: null })
    scenarios.setCurrentScenarioId(SCENARIO)
    useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO, serverGraphIdentity: null, lastAuthoritativeGraph: null })
    mockIsV5Eligible.mockReturnValue({ eligible: false })
    mockGetUserId.mockResolvedValue(null)
    mockLoadScenario.mockResolvedValue(null)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('row 6: a fresh browser restores the last answer with all three exact chips', async () => {
    const { result } = renderHook(() => useConversation())
    await flush()
    expect(result.current.messages).toEqual([])
    await act(async () => { offer(); await Promise.resolve() })
    expect(chips(result.current.messages)).toHaveLength(1)
    expect(chips(result.current.messages)[0]).toMatchObject({ id: 'restored-assistant-t2', actionChips: live })
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })

  it('row 7: the same browser keeps local words and restores chips by the exact turn id', async () => {
    saveEarlierThread()
    const { result } = renderHook(() => useConversation())
    await flush()
    const before = result.current.messages
    expect(chips(before)).toEqual([])
    await act(async () => { offer(); await Promise.resolve() })
    expect(result.current.messages.map(message => [message.id, message.content])).toEqual(before.map(message => [message.id, message.content]))
    expect(chips(result.current.messages)).toHaveLength(1)
    expect(chips(result.current.messages)[0]).toMatchObject({ id: 'local-answer', clientTurnId: 't2', actionChips: live })
    expect(loadTranscript(SCENARIO)?.messages.every(message => message.actionChips === undefined)).toBe(true)
  })

  it('row 7 negative twin: identical answer text with another turn id remains inert', async () => {
    saveEarlierThread(false, 'another-turn')
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { offer(); await Promise.resolve() })
    expect(result.current.messages.some(message => message.id === 'local-answer')).toBe(true)
    expect(chips(result.current.messages)).toEqual([])
  })

  it('row 8: an offer for B cannot arm A; a subsequent A offer restores its chips', async () => {
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { offer(OTHER); await Promise.resolve() })
    expect(chips(result.current.messages)).toEqual([])
    expect(useServerConversationTurnsStore.getState().offer?.scenarioId).toBe(OTHER)
    await act(async () => { offer(SCENARIO); await Promise.resolve() })
    expect(chips(result.current.messages)[0]?.actionChips).toEqual(live)
  })

  it('row 8 producer seam: real adapter and hydration bind actions to the response scenario, with an A positive twin', async () => {
    const response = (scenarioId: string) => new Response(JSON.stringify({
      schema: 'scenario_graph.v1', scenario_id: scenarioId, graph_present: true,
      graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] }, conversation_turns: WIRE,
    }), { status: 200 })
    const fetchSpy = vi.fn().mockImplementation(async () => response(OTHER))
    vi.stubGlobal('fetch', fetchSpy)
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { await hydrateCanvasFromServer(SCENARIO, { includeConversationTurns: true }) })
    // Like held actions, next steps belong to the response envelope: a response for another scenario still offers
    // its text on the requested scenario (unchanged behaviour; the hook takes that offer) but carries no actions.
    // The positive twin below differs ONLY in the response's scenario id.
    expect(chips(result.current.messages)).toEqual([])
    fetchSpy.mockImplementation(async () => response(SCENARIO))
    await act(async () => { await hydrateCanvasFromServer(SCENARIO, { includeConversationTurns: true }) })
    expect(chips(result.current.messages)[0]?.actionChips).toEqual(live)
  })

  it('row 9: a newer user message keeps the restored answer inert', async () => {
    saveEarlierThread(true)
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { offer(); await Promise.resolve() })
    expect(result.current.messages.some(message => message.id === 'newer-user')).toBe(true)
    expect(chips(result.current.messages)).toEqual([])
  })

  it('row 9 positive twin: without a newer user message the same local answer gains all three chips', async () => {
    saveEarlierThread(false)
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { offer(); await Promise.resolve() })
    expect(chips(result.current.messages)[0]).toMatchObject({ id: 'local-answer', actionChips: live })
  })

  it('local held controls also take priority, with the next-step positive twin in row 7', async () => {
    const proposalId = `prop_${'a'.repeat(32)}`
    saveTranscript(SCENARIO, [{ id: 'local-held', clientTurnId: 't2', role: 'assistant', content: 'Approve this change?',
      timestamp: new Date(AT), heldProposalId: proposalId, heldTurnId: 't2' }])
    const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    stored[SCENARIO].pageLoadId = 'a-previous-page-load'
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored))
    const heldActions = [
      { id: `agent-approve-proposal:${proposalId}`, label: 'Record this link', message: 'Yes, record that.' },
      { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
    ]
    const { result } = renderHook(() => useConversation())
    await flush()
    await act(async () => { offer(SCENARIO, WIRE, [{ turn_id: 't2', proposal_id: proposalId, suggested_actions: heldActions }]); await Promise.resolve() })
    expect(chips(result.current.messages)[0]?.actionChips).toEqual(buildSuggestedActionChips([], heldActions))
  })

  it('a last turn without actions restores text only, with the actions positive twin in row 6', async () => {
    const { result } = renderHook(() => useConversation())
    await flush()
    const { suggested_actions: _actions, ...last } = WIRE[1]
    await act(async () => { offer(SCENARIO, [WIRE[0], last]); await Promise.resolve() })
    expect(result.current.messages.some(message => message.id === 'restored-assistant-t2')).toBe(true)
    expect(chips(result.current.messages)).toEqual([])
  })
})
