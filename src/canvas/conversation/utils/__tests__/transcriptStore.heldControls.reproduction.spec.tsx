/** R2 acceptance: real hook restore, transcript save/restore, current server authority and rendered control identities. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../../useConversation'
import { useCanvasStore } from '../../../store'
import * as scenarios from '../../../store/scenarios'
import { TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../../utils/transcriptStore'
import { useServerConversationTurnsStore } from '../../../stores/serverConversationTurnsStore'
import {
  readServerConversationTurns,
} from '../../serverConversationTurns'

// Restore rows drive mount/hydration; R3 also sends and retries through the real persistence path.
// The mocks below exist solely to stop the hook reaching a network path at mount;
// the two spies are declared here rather than inherited from the sibling spec the
// preamble was adapted from (which is how `mockCallTurn` arrived undeclared).
const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../../turnService', () => ({
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

vi.mock('../../../../v5/v5Adapter', () => ({
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
vi.mock('../../../../v5/stopTurn', () => ({
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

vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  const flags = await import('../../../../flags')
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
vi.mock('../../../../lib/posthog', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

// Mock Supabase getUserId: vi.fn() so tests can reconfigure per-scenario.
// Default: null (no auth session in test environment).
const mockGetUserId = vi.fn<[], Promise<string | null>>()
const mockSupabaseRpc = vi.fn()

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
vi.mock('../../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
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

vi.mock('../../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...args as [string]),
}))

// Pin both flags ON:
//   - isOrchestratorStreamingEnabled: the buildRequest payload block asserts
//     against mockStreamTurn (streaming path). Without this, the flag


import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { afterEach } from 'vitest'
import { saveTranscript } from '../transcriptStore'
import { ChatThread, THREAD_TESTID_DOCKED, THREAD_TESTID_FLOATING } from '../../zones/ChatThread'
import { ConversationPanel } from '../../ConversationPanel'
import { buildSuggestedActionChips } from '../../../../v5/blocks/suggestedActionChips'
import type { ConversationMessage } from '../../types'
import { buildRestoredThread, readServerHeldProposalOffers, reconcileRestoredHeldControls } from '../../serverConversationTurns'
import { hydrateCanvasFromServer, type HydrationOutcome } from '../../../hydrate/serverGraphHydration'
import { runAbsentGraphRetrySchedule, ABSENT_GRAPH_RETRY_DELAYS_MS } from '../../../hydrate/absentGraphRetry'
import { useServerGraphHydration } from '../../../hooks/useServerGraphHydration'
import type { ThreadEntry } from '../../../journey/threadTypes'
import * as threadService from '../../../../services/threadService'
import { useResultsStore } from '../../../stores/resultsStore'
import { openExampleDecision, __resetExampleDecisionForTests } from '../../../example/exampleDecision'
import { __resetPersistenceSessionForTests } from '../../../../lib/persistenceSession'

// Observe the real panel's attribution at its persistence boundary; no chip handler or renderer is mocked.
const mockChipTaken = vi.fn()
vi.mock('../../hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: mockChipTaken }),
}))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
// Inject only the clock. The production boot hook and bounded schedule both run unchanged.
const mockRetryWait = vi.fn()
vi.mock('../../../hydrate/absentGraphRetry', async (original) => ({
  ...await original<typeof import('../../../hydrate/absentGraphRetry')>(),
  waitForRetry: (...args: unknown[]) => mockRetryWait(...args),
}))

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
const OTHER = '11111111-2222-4333-8444-555555555555'
const TID = 'held-turn'
const PID = 'prop_0123456789abcdef0123456789abcdef'
const APPROVE = `agent-approve-proposal:${PID}`
const AMEND = 'agent-amend-proposal'
function actionsFor(proposalId = PID) {
  return [
    { id: `agent-approve-proposal:${proposalId}`, label: 'Record this link', message: 'Yes, record that.', detail: 'The exact offered card.' },
    { id: AMEND, label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
  ]
}
const actions = actionsFor()
const held: ConversationMessage = {
  id: 'held-answer', role: 'assistant', content: 'Approve this change?', heldTurnId: TID,
  timestamp: new Date('2026-10-05T09:00:00.000Z'), actionChips: buildSuggestedActionChips([], actions),
}
const rawOffers = [{ turn_id: TID, proposal_id: PID, suggested_actions: actions }]
const wireTurns = [{ turn_id: TID, created_at: held.timestamp.toISOString(), user_message: null, assistant_message: held.content }]
const turns = readServerConversationTurns(wireTurns)!
const fetchSpy = vi.fn()
function graphBody(raw: unknown, scenarioId = SID, include = true, history = wireTurns) {
  return { schema: 'scenario_graph.v1', scenario_id: scenarioId, graph_present: true,
    graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] },
    ...(include ? { conversation_turns: history, held_proposal_offers: raw } : {}),
  }
}
function replyResponse(body: unknown) { return new Response(JSON.stringify(body), { status: 200 }) }
function earlierPageLoad(poisonChips = false, scenarioId = SID) {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[scenarioId].pageLoadId = 'previous-page-load'
  // A real-looking legacy save is never action authority.
  if (poisonChips) file[scenarioId].messages.find((m: { id: string }) => m.id === held.id).actionChips = held.actionChips
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}
async function serverRead(raw: unknown, scenarioId = SID, history = wireTurns) {
  fetchSpy.mockImplementation(async (_url: unknown, request: RequestInit) =>
    replyResponse(graphBody(raw, scenarioId, JSON.parse(String(request.body)).include_conversation_turns === true, history)))
  await act(async () => {
    expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(scenarioId, { includeConversationTurns: true }))
  })
}
function show(messages: ConversationMessage[]) {
  return render(<ChatThread messages={messages} isThinking={false} longRunningHint={null} nodeCount={1}
    patchBlockStates={new Map()} patchRejections={new Map()} onChipClick={vi.fn().mockResolvedValue(undefined)}
    onPatchAccept={vi.fn()} onPatchDismiss={vi.fn()} onFeedback={vi.fn()} onRetry={vi.fn()} />)
}
function expectControls(present: boolean) {
  for (const id of [APPROVE, AMEND]) {
    expect.soft(screen.queryAllByTestId(`suggested-chip-${id}`).length, `control ${id}`).toBe(present ? 1 : 0)
  }
  if (present) {
    const group = screen.getByTestId('response-chip-group')
    expect(within(group).getByText(held.content)).toBeTruthy()
    expect(group.textContent).not.toContain('Session resumed')
  }
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); __resetTranscriptTombstonesForTests()
  __resetExampleDecisionForTests(); __resetPersistenceSessionForTests()
  vi.stubGlobal('fetch', fetchSpy)
  Element.prototype.scrollIntoView = vi.fn()
  mockRetryWait.mockResolvedValue(undefined)
  useServerConversationTurnsStore.setState({ offer: null })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SID, _hydratedThread: null,
    serverGraphIdentity: null, lastAuthoritativeGraph: null, scenarioPersistedToDb: false })
  scenarios.setCurrentScenarioId(SID)
  mockGetUserId.mockResolvedValue(null); mockLoadScenario.mockResolvedValue(null)
  mockIsV5Eligible.mockReturnValue({ eligible: false })
  saveTranscript(SID, [held]); earlierPageLoad()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('R2 server-authorised held controls through the real mount restore, hydration and ChatThread', () => {
  it('live control: both original controls render by identity', () => { show([held]); expectControls(true) })
  it('(a) executable → both render on first restore with divider, save/restore and next load; chips never persisted', async () => {
    const first = renderHook(() => useConversation())
    expect(first.result.current.messages.find(m => m.id === held.id)?.actionChips).toBeUndefined()
    expect(first.result.current.messages[first.result.current.messages.length - 1]?.sessionDivider).toContain('Session resumed')
    await serverRead(rawOffers)
    expect(first.result.current.messages.find(m => m.id === held.id)?.actionChips?.map(c => c.id)).toEqual([APPROVE, AMEND])
    show(first.result.current.messages); expectControls(true)
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID].messages.find((m: { id: string }) => m.id === held.id)
    expect(saved.actionChips).toBeUndefined(); expect(saved.consentOffered).toBe(true)
    expect(saved.clientTurnId).toBeUndefined(); expect(saved.heldTurnId).toBe(TID); expect(saved.heldProposalId).toBe(PID)
    first.unmount(); cleanup(); earlierPageLoad()
    const second = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(second.result.current.messages); expectControls(true)
    expect(second.result.current.messages.filter(m => m.sessionDivider)).toHaveLength(1)
    expect(JSON.stringify(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID])).not.toContain('actionChips')
    second.unmount(); cleanup(); earlierPageLoad()
    const third = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(third.result.current.messages); expectControls(true)
    expect(JSON.stringify(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID])).not.toContain('actionChips')
    third.unmount()
  })
  it.each<[string, unknown]>([['not executable', undefined], ['absent', undefined], ['empty', []], ['malformed', [{ ...rawOffers[0], suggested_actions: [actions[0]] }]]])(
    '(b) %s server field → no approve or amend, with the SAME saved transcript', async (_label, raw) => {
      earlierPageLoad(true)
      const hook = renderHook(() => useConversation())
      await serverRead(raw)
      show(hook.result.current.messages); expectControls(false); hook.unmount()
    },
  )
  it.each<[string, string, string]>([
    ['different turn', 'another-turn', PID],
    ['different proposal', TID, 'prop_' + 'f'.repeat(32)],
    ['different pair', 'another-turn', 'prop_' + 'f'.repeat(32)],
  ])('P2-a SCHEMA-VALID %s cannot arm this held card', async (_label, turnId, proposalId) => {
    const offer = [{ turn_id: turnId, proposal_id: proposalId, suggested_actions: actionsFor(proposalId) }]
    expect(readServerHeldProposalOffers(offer)).toHaveLength(1) // Discriminate association, not schema rejection.
    const hook = renderHook(() => useConversation())
    await serverRead(offer)
    expect(hook.result.current.messages.find(m => m.id === held.id)?.actionChips).toBeUndefined()
    show(hook.result.current.messages); expectControls(false); hook.unmount()
  })
})

describe('P1 CLASS: owning reply across every divider and later real-reply supersession', () => {
  it.each(['leading', 'truncation', 'trailing'])('%s divider cannot take the held reply controls', async kind => {
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    if (kind === 'truncation') file[SID].dropped = 3
    else file[SID].messages[kind === 'leading' ? 'unshift' : 'push']({
      id: 'saved-divider', role: 'assistant', content: '', ts: held.timestamp.toISOString(), sessionDivider: 'Earlier session', synthetic: true,
    })
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(hook.result.current.messages); expectControls(true)
    expect(hook.result.current.messages[hook.result.current.messages.length - 1]?.sessionDivider).toContain('Session resumed')
  })
  it('the capped server-history divider cannot take the latest held reply controls', async () => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const history = Array.from({ length: 49 }, (_, i) => ({ ...wireTurns[0], turn_id: `earlier-${i}`,
      created_at: new Date(held.timestamp.getTime() - (49 - i) * 60_000).toISOString(), assistant_message: 'An earlier reply' }))
    history.push(wireTurns[0])
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers, SID, history)
    show(hook.result.current.messages); expectControls(true)
    expect(hook.result.current.messages[0].sessionDivider).toContain('only the latest 50 exchanges')
  })
  it.each([false, true])('a later real reply (own chips=%s) supersedes the old held card', async withChips => {
    const later: ConversationMessage = { id: 'later', role: 'assistant', content: 'A later real reply', timestamp: new Date(),
      ...(withChips ? { actionChips: [{ id: 'new-action', label: 'New suggestion', message: 'Explain more', intent: 'primary' as const }] } : {}) }
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    const view = show(hook.result.current.messages); expectControls(true)
    view.unmount()
    show([...hook.result.current.messages, later])
    expectControls(false)
    expect(screen.queryByTestId('suggested-chip-new-action') !== null).toBe(withChips)
  })
  it.each([THREAD_TESTID_DOCKED, THREAD_TESTID_FLOATING])('click attribution in %s stays on the held reply', async threadTestId => {
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    const sendChip = vi.fn().mockResolvedValue(undefined)
    render(<ConversationPanel conversation={{ ...hook.result.current, sendChip }} onCollapse={vi.fn()} onAttach={vi.fn()}
      hideComposer threadTestId={threadTestId} />)
    const thread = within(screen.getByTestId(threadTestId))
    for (const id of [APPROVE, AMEND]) {
      await act(async () => { fireEvent.click(thread.getByTestId(`suggested-chip-${id}`)) })
      expect(mockChipTaken).toHaveBeenLastCalledWith(held.id, id)
      expect(sendChip.mock.calls[sendChip.mock.calls.length - 1]?.[0].id).toBe(id)
    }
  })
  it.each([APPROVE, AMEND])('a failed %s dispatch is never recorded as taken', async id => {
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    const sendChip = vi.fn().mockRejectedValue(new Error('dispatch failed'))
    render(<ConversationPanel conversation={{ ...hook.result.current, sendChip }} onCollapse={vi.fn()} onAttach={vi.fn()} hideComposer />)
    await act(async () => { fireEvent.click(screen.getByTestId(`suggested-chip-${id}`)) })
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(mockChipTaken).not.toHaveBeenCalled()
    expect(screen.getByText("That didn't work. Try typing your request instead.")).toBeTruthy()
  })
  it('a later reply arriving during dispatch cannot steal click attribution', async () => {
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    let finish!: () => void
    const sendChip = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const conversation = { ...hook.result.current, sendChip }
    const view = render(<ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} hideComposer />)
    fireEvent.click(screen.getByTestId(`suggested-chip-${APPROVE}`))
    const later = { ...held, id: 'later-reply', content: 'A later real reply', actionChips: undefined }
    view.rerender(<ConversationPanel conversation={{ ...conversation, messages: [...conversation.messages, later] }}
      onCollapse={vi.fn()} onAttach={vi.fn()} hideComposer />)
    expectControls(false)
    await act(async () => { finish() })
    expect(mockChipTaken).toHaveBeenCalledWith(held.id, APPROVE)
  })

})

describe('P2-a CLASS: a saved exact pair or freshly built server history; no prefix/proposal shortcuts', () => {
  it.each<[string, ConversationMessage]>([
    ['old server id without saved proposal', { ...held, id: `restored-assistant-${TID}`, actionChips: undefined }],
    ['proposal without turn identity', { ...held, heldTurnId: undefined, heldProposalId: PID }],
    ['turn identity without proposal', { ...held, actionChips: undefined }],
  ])('%s restores inert despite a valid matching server offer', async (_label, message) => {
    saveTranscript(SID, [message]); earlierPageLoad()
    expect(readServerHeldProposalOffers(rawOffers)).toHaveLength(1)
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    expect(hook.result.current.messages.find(m => m.id === message.id)?.actionChips).toBeUndefined()
    show(hook.result.current.messages); expectControls(false)
  })
  it('freshly built server history arms once, then survives a local save/reload with both identities', async () => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(hook.result.current.messages); expectControls(true)
    const reply = hook.result.current.messages.find(m => m.id === `restored-assistant-${TID}`)!
    expect([reply.heldTurnId, reply.heldProposalId]).toEqual([TID, PID])
    hook.unmount(); cleanup(); earlierPageLoad()
    const reload = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(reload.result.current.messages); expectControls(true)
  })
  it('duplicate valid offers arm only one associated reply; user messages and unrelated live chips stay unchanged', () => {
    const reply = { ...held, heldProposalId: PID }
    const user = { ...reply, id: 'user', role: 'user' as const }
    const live = { ...held, id: 'live', heldTurnId: 'live-turn' }
    const messages = reconcileRestoredHeldControls([{ ...reply, content: 'Earlier offered text' }, { ...reply, id: 'copy' }], [...rawOffers, ...rawOffers])
    expect(messages[0].actionChips).toBeUndefined()
    expect(messages[1].actionChips?.map(c => c.id)).toEqual([APPROVE, AMEND])
    show(messages); expectControls(true)
    expect(within(screen.getByTestId('response-chip-group')).getByTestId('message-assistant')).toHaveTextContent(held.content)
    expect(screen.getByTestId('response-chip-group')).not.toHaveTextContent('Earlier offered text')
    const untouched = reconcileRestoredHeldControls([user, live], rawOffers)
    expect(untouched[0]).toBe(user); expect(untouched[1]).toBe(live)
  })
  it.each<[string, unknown]>([
    ['null', null], ['non-array', {}], ['empty turn id', [{ ...rawOffers[0], turn_id: '' }]],
    ['bad proposal id', [{ ...rawOffers[0], proposal_id: 'bad' }]],
    ['wrong action identity', [{ ...rawOffers[0], suggested_actions: [{ ...actions[0], id: 'wrong' }, actions[1]] }]],
  ])('unreadable authority %s removes prior restored chips', (_label, raw) => {
    expect(readServerHeldProposalOffers(raw)).toHaveLength(0)
    expect(reconcileRestoredHeldControls([{ ...held, heldProposalId: PID }], raw)[0].actionChips).toBeUndefined()
  })
})

// P2-b CLASS: every schedule position and exit, through the real boot caller/adapter/handoff.
describe('P2-b cold-read opt-in survives the whole retry schedule', () => {
  it.each(ABSENT_GRAPH_RETRY_DELAYS_MS.map((at, index) => [at, index] as const))(
    'absent → automatic retry success at %d ms hands off identity-bound offers', async (_at, successIndex) => {
      let reads = 0
      fetchSpy.mockImplementation(async (_url: unknown, request: RequestInit) => {
        const body = JSON.parse(String(request.body)); reads++
        return replyResponse(reads <= successIndex + 1
          ? { schema: 'scenario_graph.v1', scenario_id: SID, graph_present: false }
          : graphBody(rawOffers, SID, body.include_conversation_turns === true))
      })
      let boot!: { unmount: () => void }
      await act(async () => { boot = renderHook(() => useServerGraphHydration()) })
      expect(reads).toBe(successIndex + 2)
      expect(mockRetryWait.mock.calls.map(call => call[0])).toEqual(
        ABSENT_GRAPH_RETRY_DELAYS_MS.slice(0, successIndex + 1).map((at, i) => at - (ABSENT_GRAPH_RETRY_DELAYS_MS[i - 1] ?? 0)),
      )
      const offer = useServerConversationTurnsStore.getState().offer!
      expect(offer).not.toBeNull()
      expect(offer.scenarioId).toBe(SID); expect(offer.heldProposalOffers).toEqual(rawOffers)
      expect(offer.turns).toEqual(turns)
      const restored = buildRestoredThread(offer.turns, offer.run, offer.heldProposalOffers).find(m => m.id === `restored-assistant-${TID}`)!
      expect([restored.heldTurnId, restored.heldProposalId]).toEqual([TID, PID])
      const hook = renderHook(() => useConversation())
      show(hook.result.current.messages); expectControls(true)
      expect(useServerConversationTurnsStore.getState().offer).toBeNull()
      boot.unmount()
    },
  )
  it.each<HydrationOutcome>(['merged', 'unchanged', 'absent', 'notReadable', 'signInRequired', 'refused', 'unusable', 'unavailable', 'mergeRefused', 'skipped'])(
    'opt-in and identity remain on every re-ask until %s exits', async outcome => {
      const controller = new AbortController()
      const hydrate = vi.fn().mockResolvedValue(outcome)
      const result = await runAbsentGraphRetrySchedule({ scenarioId: SID, userId: 'user', accessToken: 'token',
        includeConversationTurns: true, signal: controller.signal, hydrate, wait: async () => {} })
      const exhausted = outcome === 'absent'
      expect(hydrate).toHaveBeenCalledTimes(exhausted ? ABSENT_GRAPH_RETRY_DELAYS_MS.length : 1)
      for (const call of hydrate.mock.calls) expect(call).toEqual([SID, {
        userId: 'user', accessToken: 'token', signal: controller.signal, includeConversationTurns: true,
      }])
      expect(result).toBe(exhausted ? 'exhausted' : ['merged', 'unchanged'].includes(outcome) ? 'hydrated' : 'terminal')
    },
  )
  it.each(['before wait', 'during wait', 'during read'])('abort %s cannot hand off stale authority', async when => {
    const controller = new AbortController()
    const hydrate = vi.fn(async () => { if (when === 'during read') controller.abort(); return 'absent' as const })
    if (when === 'before wait') controller.abort()
    expect(await runAbsentGraphRetrySchedule({ scenarioId: SID, userId: null, accessToken: null, includeConversationTurns: true,
      signal: controller.signal, hydrate, wait: async () => { if (when === 'during wait') controller.abort() } })).toBe('aborted')
    expect(hydrate).toHaveBeenCalledTimes(when === 'during read' ? 1 : 0)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
  it('a caller without the cold-read opt-in keeps its original request shape', async () => {
    const hydrate = vi.fn().mockResolvedValue('merged')
    await runAbsentGraphRetrySchedule({ scenarioId: SID, userId: null, accessToken: null,
      signal: new AbortController().signal, hydrate, wait: async () => {} })
    expect(hydrate.mock.calls[0][1]).not.toHaveProperty('includeConversationTurns')
  })
})

// P2-c: a real hydration handoff can already be waiting for B when A's panel switches.
async function switchSetup(aNonEmpty: boolean, bLocal: boolean, preOffer: boolean) {
  if (!bLocal) localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
  useCanvasStore.setState({ currentScenarioId: SID })
  if (preOffer) await serverRead(rawOffers)
  if (aNonEmpty) { saveTranscript(OTHER, [{ ...held, id: 'a-reply', content: 'A owns these words', actionChips: undefined }]); earlierPageLoad(false, OTHER) }
  useCanvasStore.setState({ currentScenarioId: OTHER })
  scenarios.setCurrentScenarioId(OTHER)
  const hook = renderHook(() => useConversation())
  expect(hook.result.current.messages.some(m => m.content === 'A owns these words')).toBe(aNonEmpty)
  if (preOffer) expect(useServerConversationTurnsStore.getState().offer?.scenarioId).toBe(SID)
  return hook
}
describe('P2-c CLASS: restoration owns B before its offer is consumed', () => {
  it.each([true, false].flatMap(a => [true, false].flatMap(b => [true, false].map(early => [a, b, early] as const))))(
    'A non-empty=%s; B local=%s; offer waiting before switch=%s → B controls after settling', async (a, b, early) => {
      const hook = await switchSetup(a, b, early)
      await act(async () => { useCanvasStore.setState({ currentScenarioId: SID }); scenarios.setCurrentScenarioId(SID) })
      if (!early) await serverRead(rawOffers)
      const owningReply = hook.result.current.messages.find(m => m.id === (b ? held.id : `restored-assistant-${TID}`))
      expect(owningReply?.actionChips?.map(c => c.id)).toEqual([APPROVE, AMEND])
      show(hook.result.current.messages); expectControls(true)
      expect(hook.result.current.messages.some(m => m.content === 'A owns these words')).toBe(false)
      expect(useServerConversationTurnsStore.getState().offer).toBeNull()
      expect(JSON.stringify(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID])).not.toContain('A owns these words')
    },
  )
  it.each([true, false])('initial null → B ownership transfer (local transcript=%s) settles before consumption', async local => {
    if (!local) localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    await serverRead(rawOffers)
    useCanvasStore.setState({ currentScenarioId: null })
    const hook = renderHook(() => useConversation())
    expect(hook.result.current.messages).toHaveLength(0)
    await act(async () => { useCanvasStore.setState({ currentScenarioId: SID }) })
    show(hook.result.current.messages); expectControls(true)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
  it('initial lazy id assignment preserves an in-flight live turn before declining an unrelated held offer', async () => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    await serverRead(rawOffers)
    useCanvasStore.setState({ currentScenarioId: null })
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue(SID)
    mockCallV5Turn.mockReturnValue(new Promise(() => {}))
    const hook = renderHook(() => useConversation())
    await act(async () => { void hook.result.current.sendMessage('Keep this live turn') })
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
    expect(hook.result.current.messages.some(m => m.role === 'user' && m.content === 'Keep this live turn')).toBe(true)
    expect(hook.result.current.messages.some(m => m.content === held.content)).toBe(false)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
    hook.unmount(); uuid.mockRestore()
  })
  it.each([true, false])('an in-flight B read settles during the switch with A non-empty=%s', async a => {
    const hook = await switchSetup(a, true, false)
    let resolveRead!: (response: Response) => void
    fetchSpy.mockImplementation(() => new Promise<Response>(resolve => { resolveRead = resolve }))
    const read = hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: SID })
      resolveRead(replyResponse(graphBody(rawOffers)))
      expect(['merged', 'unchanged']).toContain(await read)
    })
    show(hook.result.current.messages); expectControls(true)
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
  it('a failed thread restore clears A before adopting B server history', async () => {
    const hook = await switchSetup(true, false, true)
    localStorage.setItem('feature.threadHydrate', '1')
    await act(async () => { useCanvasStore.setState({ _hydratedThread: [null], currentScenarioId: SID }) })
    show(hook.result.current.messages); expectControls(true)
    expect(hook.result.current.messages.some(m => m.content === 'A owns these words')).toBe(false)
    expect(useCanvasStore.getState()._hydratedThread).toBeNull()
  })
  it('thread-hydrate branch restores B first; no saved proposal association means history remains inert', async () => {
    const hook = await switchSetup(true, true, true)
    localStorage.setItem('feature.threadHydrate', '1')
    const entry: ThreadEntry = { entry_id: 'b-thread', entry_schema_version: 1, seq: 1,
      role: 'assistant', origin: 'conversation', entry_status: 'complete', redaction_state: 'full',
      turn_id: TID, assistant_text: 'B persisted thread', timestamp: held.timestamp.toISOString() }
    await act(async () => { useCanvasStore.setState({ _hydratedThread: [entry], currentScenarioId: SID }) })
    show(hook.result.current.messages); expectControls(false)
    expect(screen.getByText('B persisted thread')).toBeTruthy()
    expect(hook.result.current.messages[hook.result.current.messages.length - 1]?.sessionDivider).toContain('Session resumed')
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
  it('unreadable local restore falls back to identity-bound server history after the switch', async () => {
    const hook = await switchSetup(false, false, true)
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, '{unreadable')
    await act(async () => { useCanvasStore.setState({ currentScenarioId: SID }) })
    show(hook.result.current.messages); expectControls(true)
  })
})


// R3 P1 CLASS: the response's scenario identity binds all executable authority,
// on first boot, EACH retry position, and the existing example re-read caller.
const responseIdentities = [
  ['foreign', OTHER], ['missing', undefined], ['null', null], ['matching', SID],
] as const
const p1Reads = [
  ['boot', -1], ...ABSENT_GRAPH_RETRY_DELAYS_MS.map((at, i) => [`retry ${at} ms`, i] as const),
] as const
function bodyWithIdentity(identity: string | null | undefined) {
  const body: Record<string, unknown> = graphBody(rawOffers)
  if (identity === undefined) delete body.scenario_id
  else body.scenario_id = identity
  return body
}
describe('R3 P1 CLASS: response-scenario authority through hydration → restore → ChatThread', () => {
  it.each(responseIdentities.flatMap(([kind, identity]) => p1Reads.map(([path, successIndex]) =>
    [kind, identity, path, successIndex] as const)))(
    'R3 P1 %s response identity (%s) on %s at retry index %s', async (kind, identity, _path, successIndex) => {
      localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
      let reads = 0
      fetchSpy.mockImplementation(async () => {
        reads++
        return replyResponse(reads <= successIndex + 1
          ? { schema: 'scenario_graph.v1', scenario_id: SID, graph_present: false }
          : bodyWithIdentity(identity))
      })
      let boot!: { unmount: () => void }
      await act(async () => { boot = renderHook(() => useServerGraphHydration()) })
      expect(reads).toBe(successIndex + 2)
      const offer = useServerConversationTurnsStore.getState().offer!
      expect(offer.scenarioId).toBe(SID)
      expect(offer.turns).toEqual(turns)
      expect(offer.heldProposalOffers).toEqual(kind === 'matching' ? rawOffers : [])
      const hook = renderHook(() => useConversation())
      show(hook.result.current.messages); expectControls(kind === 'matching')
      expect(screen.getByText(held.content)).toBeTruthy() // history is still restored
      hook.unmount(); boot.unmount()
    },
  )
  it.each(responseIdentities)('R3 P1 %s response identity on the real example re-read', async (kind, identity) => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue(SID)
    fetchSpy.mockResolvedValue(replyResponse({ schema: 'scenario_graph_registration.v1', registered: true }))
    let opened!: Awaited<ReturnType<typeof openExampleDecision>>
    await act(async () => { opened = await openExampleDecision({ readBackTimeoutMs: 1 }) })
    expect(opened.status).toBe('not_read_back')
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
    fetchSpy.mockImplementation(async () => replyResponse(bodyWithIdentity(identity)))
    await act(async () => { await openExampleDecision({ readBackTimeoutMs: 1 }) })
    const offer = useServerConversationTurnsStore.getState().offer!
    expect(offer.turns).toEqual(turns)
    expect(offer.heldProposalOffers).toEqual(kind === 'matching' ? rawOffers : [])
    const hook = renderHook(() => useConversation())
    show(hook.result.current.messages); expectControls(kind === 'matching')
    expect(screen.getByText(held.content)).toBeTruthy()
    uuid.mockRestore()
  })
  it.each(responseIdentities)('R3 P1 %s response identity revokes an already re-armed local card', async (kind, identity) => {
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    const view = show(hook.result.current.messages); expectControls(true); view.unmount()
    fetchSpy.mockImplementation(async () => replyResponse(bodyWithIdentity(identity)))
    await act(async () => { await hydrateCanvasFromServer(SID, { includeConversationTurns: true }) })
    show(hook.result.current.messages); expectControls(kind === 'matching')
  })
})

// R3 P2-a CLASS: held correlation is historical card metadata, never a durable reply id.
describe('R3 P2-a CLASS: separate heldTurnId from normalised reply identity', () => {
  it('R3 P2-a reply → retry sharing one correlation both reach insertConversationTurn with staging args', async () => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    // No persistence or message producer mock: only the external turn response and RPC are stubbed.
    const { useThreadPersistence: useRealThreadPersistence } = await vi.importActual<typeof import('../../hooks/useThreadPersistence')>('../../hooks/useThreadPersistence')
    const insert = vi.spyOn(threadService, 'insertConversationTurn')
    mockSupabaseRpc.mockResolvedValue({ data: 'persisted-reply', error: null })
    mockIsV5Eligible.mockReturnValue({ eligible: true })
    useCanvasStore.setState({ scenarioPersistedToDb: true,
      nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }] })
    useResultsStore.setState(state => ({ results: { ...state.results, lastSnapshotId: null } }))
    const response = (assistant_text: string) => ({ kind: 'response' as const, response: {
      response_version: 2, assistant_text, blocks: [], suggested_actions: actions, insights: [], stage_indicator: 'frame',
    } })
    mockCallV5Turn.mockResolvedValueOnce(response('First held reply')).mockResolvedValueOnce(response('Retried held reply'))
    const hook = renderHook(() => {
      const conversation = useConversation()
      useRealThreadPersistence(SID, conversation.messages)
      return conversation
    })
    await act(async () => { await hook.result.current.sendMessage('Consider this link') })
    await act(async () => { await hook.result.current.retryLast() })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(2)
    const correlations = mockCallV5Turn.mock.calls.map(call => call[0].turn_id)
    expect(typeof correlations[0]).toBe('string'); expect(correlations[0]).toBe(correlations[1])
    const replies = hook.result.current.messages.filter(m => m.role === 'assistant' && !m.synthetic)
    expect(replies.map(m => m.content)).toEqual(['First held reply', 'Retried held reply'])
    expect(replies[0].id).not.toBe(replies[1].id)
    const args = insert.mock.calls.map(call => call[0]).filter(arg => arg.role === 'assistant')
    expect(args).toEqual(['First held reply', 'Retried held reply'].map(content => ({
      scenarioId: SID, role: 'assistant', content, structuredBlocks: undefined, clientTurnId: undefined,
      snapshotId: undefined, analysisSnapshotId: undefined,
    })))
    const rpcArgs = mockSupabaseRpc.mock.calls.filter(call => call[0] === 'insert_conversation_turn' && call[1].p_role === 'assistant')
    expect(rpcArgs.map(call => call[1])).toEqual(['First held reply', 'Retried held reply'].map(p_content => ({
      p_scenario_id: SID, p_role: 'assistant', p_content, p_structured_blocks: null,
      p_client_turn_id: null, p_snapshot_id: null, p_analysis_snapshot_id: null,
    })))
    for (const reply of replies) {
      expect(reply.clientTurnId).toBeUndefined()
      expect([reply.heldTurnId, reply.heldProposalId]).toEqual([correlations[0], PID])
    }
    hook.unmount()
  })
  it('R3 P2-a heldTurnId re-arms after local save → restore → next load without serialising chips', async () => {
    const first = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(first.result.current.messages); expectControls(true)
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID].messages.find((m: { id: string }) => m.id === held.id)
    expect(saved.heldTurnId).toBe(TID); expect(saved.heldProposalId).toBe(PID)
    expect(saved.clientTurnId).toBeUndefined(); expect(saved.actionChips).toBeUndefined()
    first.unmount(); cleanup(); earlierPageLoad()
    const reload = renderHook(() => useConversation())
    expect(reload.result.current.messages.find(m => m.id === held.id)?.heldTurnId).toBe(TID)
    await serverRead(rawOffers)
    show(reload.result.current.messages); expectControls(true)
  })
  it('R3 P2-a round-2 clientTurnId + heldProposalId save restores INERT; only fresh server history re-arms', async () => {
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    const old = file[SID].messages.find((m: { id: string }) => m.id === held.id)
    old.clientTurnId = TID; old.heldProposalId = PID; delete old.heldTurnId
    old.actionChips = held.actionChips // poisoned legacy chips are never authority
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(hook.result.current.messages); expectControls(false)
    const reply = hook.result.current.messages.find(m => m.id === held.id)!
    // Staging parity: a stored clientTurnId is kept as-is but is never the held association.
    expect(reply.heldTurnId).toBeUndefined(); expect(reply.clientTurnId).toBe(TID)
    hook.unmount(); cleanup(); earlierPageLoad()
    const reload = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(reload.result.current.messages); expectControls(false)
    reload.unmount(); cleanup(); localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const fresh = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(fresh.result.current.messages); expectControls(true)
  })
  it.each([undefined, null, '', 42, {}])('R3 P2-a malformed heldTurnId=%s cannot re-arm a saved proposal', async value => {
    const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
    file[SID].messages.find((m: { id: string }) => m.id === held.id).heldTurnId = value
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
    const hook = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(hook.result.current.messages); expectControls(false)
  })
})

// R3 P2-b CLASS: latest local exact owner, unique fresh reply, multiple proposals, save/reload.
describe('R3 P2-b CLASS: duplicates cannot hide or misattribute an executable offer', () => {
  it.each([false, true])('R3 P2-b duplicate local pair → latest owner renders both controls (multiple proposals=%s), first restore and save/reload', async multiple => {
    const otherPid = 'prop_' + 'f'.repeat(32)
    const otherHeld = { ...held, id: 'other-proposal', heldProposalId: otherPid, actionChips: buildSuggestedActionChips([], actionsFor(otherPid)) }
    const latest = { ...held, id: 'latest-held-reply', content: held.content, heldProposalId: PID }
    saveTranscript(SID, [{ ...held, content: 'Earlier offered text', heldProposalId: PID }, ...(multiple ? [otherHeld] : []), latest])
    earlierPageLoad()
    const authority = [...rawOffers, ...rawOffers, ...(multiple ? [{ turn_id: TID, proposal_id: otherPid, suggested_actions: actionsFor(otherPid) }] : [])]
    for (let load = 0; load < 2; load++) {
      const hook = renderHook(() => useConversation())
      await serverRead(authority)
      const messages = hook.result.current.messages
      expect(messages.find(m => m.id === held.id)?.actionChips).toBeUndefined()
      expect(messages.find(m => m.id === latest.id)?.actionChips?.map(c => c.id)).toEqual([APPROVE, AMEND])
      if (multiple) expect(messages.find(m => m.id === otherHeld.id)?.actionChips?.map(c => c.id)).toEqual([`agent-approve-proposal:${otherPid}`, AMEND])
      show(messages); expectControls(true)
      expect(within(screen.getByTestId('response-chip-group')).getByTestId('message-assistant')).toHaveTextContent(held.content)
      expect(screen.getByTestId('response-chip-group')).not.toHaveTextContent('Earlier offered text')
      expect(screen.queryByTestId(`suggested-chip-agent-approve-proposal:${otherPid}`)).toBeNull()
      expect(JSON.stringify(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID])).not.toContain('actionChips')
      hook.unmount(); cleanup(); earlierPageLoad()
    }
  })
  it.each([false, true])('R3 P2-b fresh duplicate turn ids → inert (multiple proposals=%s), first restore and save/reload', async multiple => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const otherPid = 'prop_' + 'f'.repeat(32)
    const authority = [...rawOffers, ...(multiple ? [{ turn_id: TID, proposal_id: otherPid, suggested_actions: actionsFor(otherPid) }] : [])]
    const history = [{ ...wireTurns[0], assistant_message: 'Earlier offered text' }, { ...wireTurns[0], created_at: '2026-10-05T09:01:00.000Z' }]
    for (let load = 0; load < 2; load++) {
      const hook = renderHook(() => useConversation())
      await serverRead(authority, SID, history)
      expect(hook.result.current.messages.filter(m => m.role === 'assistant' && !m.sessionDivider)).toHaveLength(2)
      expect(hook.result.current.messages.every(m => m.actionChips === undefined)).toBe(true)
      show(hook.result.current.messages); expectControls(false)
      expect(screen.queryByTestId(`suggested-chip-agent-approve-proposal:${otherPid}`)).toBeNull()
      hook.unmount(); cleanup(); earlierPageLoad()
    }
  })
  it('R3 P2-b distinct fresh turns with multiple proposals each retain their own association through save/reload', async () => {
    localStorage.removeItem(TRANSCRIPT_STORAGE_KEY)
    const otherPid = 'prop_' + 'f'.repeat(32)
    const authority = [{ turn_id: 'earlier-turn', proposal_id: otherPid, suggested_actions: actionsFor(otherPid) }, ...rawOffers]
    const history = [{ ...wireTurns[0], turn_id: 'earlier-turn', assistant_message: 'Earlier offered text' }, { ...wireTurns[0], created_at: '2026-10-05T09:01:00.000Z' }]
    for (let load = 0; load < 2; load++) {
      const hook = renderHook(() => useConversation())
      await serverRead(authority, SID, history)
      const earlier = hook.result.current.messages.find(m => m.id === 'restored-assistant-earlier-turn')!
      expect([earlier.heldTurnId, earlier.heldProposalId]).toEqual(['earlier-turn', otherPid])
      expect(earlier.actionChips?.map(c => c.id)).toEqual([`agent-approve-proposal:${otherPid}`, AMEND])
      show(hook.result.current.messages); expectControls(true)
      expect(within(screen.getByTestId('response-chip-group')).getByTestId('message-assistant')).toHaveTextContent(held.content)
      expect(screen.getByTestId('response-chip-group')).not.toHaveTextContent('Earlier offered text')
      hook.unmount(); cleanup(); earlierPageLoad()
    }
  })
})

describe('R3 staging parity: an assistant reply\'s own clientTurnId survives the local transcript', () => {
  // Thread-hydrated replies carry clientTurnId (hydrateThread), and FeedbackRow reads it on assistant bubbles.
  // R2 must not narrow the stored shape; the held association rides heldTurnId alone.
  it('a thread-hydrated reply keeps clientTurnId through save → load, with no held association inferred', async () => {
    const { loadTranscript } = await import('../transcriptStore')
    localStorage.clear(); __resetTranscriptTombstonesForTests()
    const scenario = 'parity-scenario-0001'
    const hydrated: ConversationMessage = {
      id: 'hydrated-reply-1', role: 'assistant', content: 'A hydrated answer.', timestamp: new Date(), clientTurnId: 'turn-hydrated-1',
    }
    const user: ConversationMessage = { id: 'u-1', role: 'user', content: 'A question.', timestamp: new Date(), clientTurnId: 'turn-hydrated-1' }
    saveTranscript(scenario, [user, hydrated])
    const loaded = loadTranscript(scenario)
    const reply = loaded?.messages.find(m => m.id === 'hydrated-reply-1')
    expect(reply?.clientTurnId).toBe('turn-hydrated-1')
    expect(reply?.heldTurnId).toBeUndefined(); expect(reply?.heldProposalId).toBeUndefined()
    expect(loaded?.messages.find(m => m.id === 'u-1')?.clientTurnId).toBe('turn-hydrated-1')
  })
})
