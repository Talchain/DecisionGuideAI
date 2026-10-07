/** T1: real buffered transport adapter → parser/router → live mapper → transcript → local restore → server read.
 * Fixtures: CEE bdf5716 / UI ed8889ae. cold-shape contains keys/actions only, so this is a SHAPE pairing,
 * not an exact captured cold-read turn pair. Every association below comes from live-recorded's server echo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import liveJson from './fixtures/t1/live-recorded.json?raw'
import requestJson from './fixtures/t1/live-request.json?raw'
import coldJson from './fixtures/t1/cold-shape.json?raw'
import otherTurnJson from './fixtures/t1/other-turn.json?raw'
import { useConversation } from '../useConversation'
import type { ConversationMessage } from '../types'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useThreadPersistence } from '../hooks/useThreadPersistence'
import { FeedbackRow } from '../FeedbackRow'
import { useResultsStore } from '../../stores/resultsStore'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { isUUID } from '../../../services/turn-request-builder'
import { readRecordedServerTurnId } from '../serverTurnId'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests, loadTranscript, saveTranscript } from '../utils/transcriptStore'

// External auth/RPC only. Adapter, parser, router, message mapper, stores and persistence remain real.
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { rpc: (...args: unknown[]) => rpc(...args),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const LIVE = JSON.parse(liveJson)
const REQUEST = JSON.parse(requestJson)
const COLD = JSON.parse(coldJson)
const SCENARIO: string = REQUEST.request_body.scenario_id
const TURN: string = LIVE._agent.turn_id
const OTHER_TURN: string = JSON.parse(otherTurnJson)._agent.turn_id
const OTHER_SCENARIO = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const ENDPOINT = 'https://cee.test/proxy/v5/turn'
const ACTIONS = COLD.conversation_turns.at(-1).suggested_actions
const EXPECTED = buildSuggestedActionChips([], ACTIONS)
const LIVE_CHIPS = buildSuggestedActionChips([], LIVE.suggested_actions)
const AT = new Date(1791324423509).toISOString()
const fetchSpy = vi.fn()
const withChips = (messages: readonly ConversationMessage[]) => messages.filter(m => m.actionChips?.length)
const wireResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const cloneLive = () => JSON.parse(liveJson)

function coldBody(options: { turnId?: string; scenarioId?: string; actions?: boolean; held?: boolean } = {}) {
  const proposalId = `prop_${'a'.repeat(32)}`
  const heldActions = [
    { id: `agent-approve-proposal:${proposalId}`, label: 'Record this link', message: 'Yes, record that.' },
    { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
  ]
  return {
    schema: 'scenario_graph.v1', scenario_id: options.scenarioId ?? SCENARIO, graph_present: true,
    graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] },
    // X4 omitted the values of these keys. The live reply/request supply them; no invented join identity.
    conversation_turns: [{ turn_id: options.turnId ?? TURN, created_at: AT,
      user_message: REQUEST.request_body.message, assistant_message: LIVE.assistant_text,
      ...(options.actions === false ? {} : { suggested_actions: ACTIONS }) }],
    ...(options.held ? { held_proposal_offers: [{ turn_id: TURN, proposal_id: proposalId, suggested_actions: heldActions }] } : {}),
  }
}

async function coldRead(body = coldBody()) {
  fetchSpy.mockImplementation(async () => wireResponse(body))
  await act(async () => { expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(SCENARIO, { includeConversationTurns: true })) })
}

function previousPage() {
  const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  stored[SCENARIO].pageLoadId = 'previous-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored))
}

async function sendAndReload(body = cloneLive(), expectedTurn: string | null = TURN) {
  fetchSpy.mockImplementation(async () => wireResponse(body))
  const first = renderHook(() => useConversation())
  await act(async () => { await first.result.current.sendMessage(REQUEST.request_body.message) })
  const answers = first.result.current.messages.filter(m => m.role === 'assistant' && !m.synthetic)
  expect(answers).toHaveLength(1)
  const answer = answers[0]
  expect(answer.content).toBe(LIVE.assistant_text)
  expect(answer.id).not.toBe(`restored-assistant-${TURN}`)
  expect(answer.serverTurnId).toBe(expectedTurn ?? undefined)
  expect(answer.clientTurnId).toBeUndefined()
  expect(answer.actionChips).toEqual(LIVE_CHIPS)
  const user = first.result.current.messages.find(m => m.role === 'user')!
  // This send path keeps retry correlation in lastUserInputRef, not on the user bubble.
  expect(user.clientTurnId).toBeUndefined()
  expect(user.serverTurnId).toBeUndefined()
  // The real hook originates a new request id; only the captured response may supply the historical association.
  const post = fetchSpy.mock.calls.find(call => String(call[0]) === ENDPOINT && call[1]?.method === 'POST')!
  const outgoing = JSON.parse(post[1].body)
  expect(isUUID(outgoing.turn_id)).toBe(true)
  expect(outgoing.turn_id).not.toBe(TURN)
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SCENARIO].messages.find((m: { id: string }) => m.id === answer.id)
    expect(saved.serverTurnId).toBe(expectedTurn ?? undefined) // serializer mutant
    expect(saved.clientTurnId).toBeUndefined()
    expect(saved.actionChips).toBeUndefined()
    const savedUser = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SCENARIO].messages.find((m: { id: string }) => m.id === user.id)
    expect(savedUser).toMatchObject({ id: user.id, role: 'user', content: user.content })
    expect(savedUser.clientTurnId).toBeUndefined()
  })
  first.unmount()
  previousPage()
  expect(loadTranscript(SCENARIO)?.messages.find(m => m.id === answer.id)?.serverTurnId).toBe(expectedTurn ?? undefined) // deserializer mutant
  const reload = renderHook(() => useConversation())
  expect(reload.result.current.messages.find(m => m.id === answer.id)).toMatchObject({ content: answer.content })
  const restoredUser = reload.result.current.messages.find(m => m.id === user.id)
  expect(restoredUser).toMatchObject({ id: user.id, role: 'user', content: user.content })
  expect(restoredUser?.clientTurnId).toBeUndefined()
  expect(withChips(reload.result.current.messages)).toEqual([])
  return { ...reload, answer, user }
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); __resetTranscriptTombstonesForTests(); __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  vi.stubEnv('VITE_V5_ENDPOINT', ENDPOINT)
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockReset(); rpc.mockReset(); rpc.mockResolvedValue({ data: 'persisted-reply', error: null })
  useServerConversationTurnsStore.setState({ offer: null })
  scenarios.setCurrentScenarioId(SCENARIO)
  useCanvasStore.setState({ nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }],
    edges: [], currentScenarioId: SCENARIO, serverGraphIdentity: null, lastAuthoritativeGraph: null,
    scenarioPersistedToDb: true, _hydratedThread: null })
  useResultsStore.setState(state => ({ results: { ...state.results, lastSnapshotId: null } }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('T1 — recorded live answer survives same-browser reload', () => {
  it('keeps the exact local answer and restores all captured chips only after the fresh read', async () => {
    expect(REQUEST.cee_build).toBe(COLD.cee_build)
    expect(REQUEST.ui).toBe(COLD.ui)
    expect(SCENARIO).toBe(COLD.scenario)
    expect(TURN).toBe(REQUEST.request_body.turn_id)
    expect(COLD.conversation_turns.at(-1).keys).toContain('suggested_actions')
    const { result, answer, user } = await sendAndReload()
    const words = result.current.messages.map(m => [m.id, m.content, m.sessionDivider])
    await coldRead()
    expect(result.current.messages.map(m => [m.id, m.content, m.sessionDivider])).toEqual(words)
    expect(withChips(result.current.messages)).toHaveLength(1)
    expect(withChips(result.current.messages)[0]).toMatchObject({ id: answer.id, serverTurnId: TURN, actionChips: EXPECTED })
    expect(result.current.messages.find(m => m.id === answer.id)?.clientTurnId).toBeUndefined()
    expect(result.current.messages.find(m => m.id === user.id)).toMatchObject({ id: user.id, role: 'user', content: user.content })
    expect(result.current.messages.find(m => m.id === user.id)?.clientTurnId).toBeUndefined()
    expect(loadTranscript(SCENARIO)?.messages.every(m => m.actionChips === undefined)).toBe(true)
  })

  it.each([
    ['missing id', undefined, 'recorded'], ['malformed id', 'not-a-uuid', 'recorded'],
    ['numeric id', 42, 'recorded'], ['not recorded', TURN, 'not_recorded'],
    ['no durability', TURN, undefined], ['no turn id attestation', TURN, 'no_turn_id'],
  ])('%s leaves the saved answer inert', async (_name, turnId, durability) => {
    const body = cloneLive(); body._agent.turn_id = turnId; body._agent.durability = durability
    const { result } = await sendAndReload(body, null)
    await coldRead()
    expect(withChips(result.current.messages)).toEqual([])
  })

  it('identical words on another captured turn cannot authorise this answer', async () => {
    const { result, answer } = await sendAndReload()
    await coldRead(coldBody({ turnId: OTHER_TURN }))
    expect(result.current.messages.find(m => m.id === answer.id)?.content).toBe(LIVE.assistant_text)
    expect(withChips(result.current.messages)).toEqual([])
  })

  it('a later user turn blocks the earlier answer even with its exact identity', async () => {
    const { result, unmount } = await sendAndReload()
    const messages = [...result.current.messages, { id: 'later-user', role: 'user' as const, content: 'A later question', timestamp: new Date() }]
    unmount(); saveTranscript(SCENARIO, messages); previousPage()
    const later = renderHook(() => useConversation())
    await coldRead()
    expect(later.result.current.messages.some(m => m.id === 'later-user')).toBe(true)
    expect(withChips(later.result.current.messages)).toEqual([])
  })

  it('a foreign response scenario with the exact turn id cannot authorise chips', async () => {
    const { result } = await sendAndReload()
    await coldRead(coldBody({ scenarioId: OTHER_SCENARIO }))
    expect(withChips(result.current.messages)).toEqual([])
    await coldRead()
    expect(withChips(result.current.messages)[0]?.actionChips).toEqual(EXPECTED)
  })

  it('stale offers withheld by the read leave a recorded answer inert', async () => {
    const { result } = await sendAndReload()
    await coldRead(coldBody({ actions: false }))
    expect(withChips(result.current.messages)).toEqual([])
  })

  it('older local saves without the association retain their words and remain inert', async () => {
    const { answer, unmount } = await sendAndReload()
    unmount()
    const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    delete stored[SCENARIO].messages.find((m: { id: string }) => m.id === answer.id).serverTurnId
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored)); previousPage()
    const older = renderHook(() => useConversation())
    await coldRead()
    expect(older.result.current.messages.find(m => m.id === answer.id)?.content).toBe(LIVE.assistant_text)
    expect(withChips(older.result.current.messages)).toEqual([])
  })

  it('a committed replay retains its echoed identity through the same real path', async () => {
    const body = cloneLive(); delete body._agent.durability
    body._agent.replayed = true; body._agent.stopped_reason = 'replayed'
    const { result } = await sendAndReload(body)
    await coldRead()
    expect(withChips(result.current.messages)[0]?.actionChips).toEqual(EXPECTED)
  })

  it('fresh-browser history still restores its exact answer and chips', async () => {
    const { result } = renderHook(() => useConversation())
    await coldRead()
    expect(withChips(result.current.messages)).toHaveLength(1)
    expect(withChips(result.current.messages)[0]).toMatchObject({ id: `restored-assistant-${TURN}`, actionChips: EXPECTED })
  })

  it('held controls keep priority over the captured next steps on the same answer', async () => {
    const body = cloneLive(); const held = coldBody({ held: true }).held_proposal_offers!
    body.suggested_actions = held[0].suggested_actions
    fetchSpy.mockImplementation(async () => wireResponse(body))
    const first = renderHook(() => useConversation())
    await act(async () => { await first.result.current.sendMessage(REQUEST.request_body.message) })
    const answer = first.result.current.messages.find(m => m.role === 'assistant' && !m.synthetic)!
    expect(answer.serverTurnId).toBe(TURN)
    // Held authority uses the actual outgoing request correlation; serverTurnId must not replace it.
    const outgoing = JSON.parse(fetchSpy.mock.calls.find(call => call[1]?.method === 'POST')![1].body)
    expect(answer.heldTurnId).toBe(outgoing.turn_id)
    first.unmount(); previousPage()
    const reload = renderHook(() => useConversation())
    const cold = coldBody({ held: true })
    cold.held_proposal_offers![0].turn_id = outgoing.turn_id
    await coldRead(cold)
    expect(withChips(reload.result.current.messages)).toHaveLength(1)
    expect(withChips(reload.result.current.messages)[0]?.actionChips).toEqual(buildSuggestedActionChips([], held[0].suggested_actions))
  })

  it('feedback stays hidden; retry reuses the user correlation; distinct replies keep normalised dedupe unset', async () => {
    fetchSpy.mockImplementation(async () => wireResponse(cloneLive()))
    const hook = renderHook(() => {
      const conversation = useConversation()
      useThreadPersistence(SCENARIO, conversation.messages)
      return conversation
    })
    await act(async () => { await hook.result.current.sendMessage(REQUEST.request_body.message) })
    await act(async () => { await hook.result.current.retryLast() })
    const posts = fetchSpy.mock.calls.filter(call => String(call[0]) === ENDPOINT && call[1]?.method === 'POST')
    expect(posts).toHaveLength(2)
    const sent = posts.map(call => JSON.parse(call[1].body))
    expect(sent[0].turn_id).toBe(sent[1].turn_id)
    const answers = hook.result.current.messages.filter(m => m.role === 'assistant' && !m.synthetic)
    expect(answers).toHaveLength(2)
    expect(new Set(answers.map(m => m.id)).size).toBe(2)
    for (const answer of answers) {
      expect(answer.serverTurnId).toBe(TURN); expect(answer.clientTurnId).toBeUndefined()
      render(<FeedbackRow turnId={answer.clientTurnId} onFeedback={vi.fn()} />)
    }
    expect(screen.queryByRole('button')).toBeNull()
    await waitFor(() => {
      const inserts = rpc.mock.calls.filter(call => call[0] === 'insert_conversation_turn' && call[1].p_role === 'assistant')
      expect(inserts).toHaveLength(2)
      expect(inserts.map(call => call[1].p_client_turn_id)).toEqual([null, null])
    })
  })
})

describe('T1 — defensive identity admission at local and live boundaries', () => {
  it.each([undefined, null, [], {}, { _agent: [] }, { _agent: { turn_id: TURN, replayed: 'true' } },
    { _agent: { turn_id: TURN, durability: 'not_recorded', replayed: true, stopped_reason: 'replayed' } }])(
    'malformed or uncommitted sidecar %s has no association', sidecar => {
      expect(readRecordedServerTurnId({ __additive__: sidecar })).toBeUndefined()
    },
  )
  it('root metadata or request correlation cannot stand in for the additive server attestation', () => {
    expect(readRecordedServerTurnId(LIVE)).toBeUndefined()
    expect(readRecordedServerTurnId({ clientTurnId: TURN })).toBeUndefined()
  })
  it.each([undefined, null, '', 'not-a-uuid', 42, {}, []])('invalid stored id %s is rejected on save and read', value => {
    const assistant = { id: 'old-answer', role: 'assistant', content: LIVE.assistant_text, timestamp: new Date(), serverTurnId: value } as ConversationMessage
    saveTranscript(SCENARIO, [assistant])
    const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    expect(stored[SCENARIO].messages[0].serverTurnId).toBeUndefined()
    stored[SCENARIO].messages[0].serverTurnId = value
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored))
    expect(loadTranscript(SCENARIO)?.messages[0].serverTurnId).toBeUndefined()
  })
  it('user messages never acquire the assistant-only association on save or read', () => {
    saveTranscript(SCENARIO, [{ id: 'user', role: 'user', content: 'Question', timestamp: new Date(), serverTurnId: TURN, clientTurnId: OTHER_TURN }])
    const stored = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    expect(stored[SCENARIO].messages[0].serverTurnId).toBeUndefined()
    stored[SCENARIO].messages[0].serverTurnId = TURN
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(stored))
    expect(loadTranscript(SCENARIO)?.messages[0]).toMatchObject({ clientTurnId: OTHER_TURN })
    expect(loadTranscript(SCENARIO)?.messages[0].serverTurnId).toBeUndefined()
  })
})
