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

// This spec never sends a turn — it drives mount-restore and `resetCanvas` only.
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


import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { saveTranscript } from '../transcriptStore'
import { SuggestedChips } from '../../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../../v5/blocks/suggestedActionChips'
import type { ConversationMessage } from '../../types'

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
const TID = 'held-turn'
const PID = 'prop_0123456789abcdef0123456789abcdef'
const APPROVE = `agent-approve-proposal:${PID}`
const AMEND = 'agent-amend-proposal'
const actions = [
  { id: APPROVE, label: 'Record this link', message: 'Yes, record that.', detail: 'The exact offered card.' },
  { id: AMEND, label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
]
const held: ConversationMessage = {
  id: 'held-answer', role: 'assistant', content: 'Approve this change?', clientTurnId: TID,
  timestamp: new Date('2026-10-05T09:00:00.000Z'), actionChips: buildSuggestedActionChips([], actions),
}
const rawOffers = [{ turn_id: TID, proposal_id: PID, suggested_actions: actions }]
const turns = readServerConversationTurns([{ turn_id: TID, created_at: held.timestamp.toISOString(),
  user_message: null, assistant_message: held.content }])!
function earlierPageLoad(poisonChips = false) {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[SID].pageLoadId = 'previous-page-load'
  // Simulate an older/altered client save: even real-looking stored chips are never authority.
  if (poisonChips) file[SID].messages[0].actionChips = held.actionChips
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}
async function serverRead(raw: unknown) {
  await act(async () => {
    useServerConversationTurnsStore.getState().offerServerConversationTurns({
      scenarioId: SID, turns, run: { runNotCurrent: false, currentRunComputedAt: null },
      // The production handoff parses this sidecar. Kept raw here so the actual panel restore is exercised.
      heldProposalOffers: raw,
    } as Parameters<ReturnType<typeof useServerConversationTurnsStore.getState>['offerServerConversationTurns']>[0])
  })
}
function show(message: ConversationMessage) {
  render(<><p>{message.content}</p><SuggestedChips chips={message.actionChips ?? []} onChipClick={vi.fn()} /></>)
}
function expectControls(present: boolean) {
  for (const id of [APPROVE, AMEND]) {
    expect.soft(screen.queryByTestId(`suggested-chip-${id}`) !== null, `control ${id}`).toBe(present)
  }
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); __resetTranscriptTombstonesForTests()
  useServerConversationTurnsStore.setState({ offer: null })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SID, _hydratedThread: null })
  scenarios.setCurrentScenarioId(SID)
  mockGetUserId.mockResolvedValue(null); mockLoadScenario.mockResolvedValue(null)
  mockIsV5Eligible.mockReturnValue({ eligible: false })
  // SAME saved transcript for every current-authority verdict.
  saveTranscript(SID, [held]); earlierPageLoad()
})
afterEach(cleanup)
describe('R2 server-authorised held controls through the real mount restore and transcript store', () => {
  it('live control: both original controls render by identity', () => { show(held); expectControls(true) })
  it('(a) executable → both render on first restore, save/restore and next load; chips never persisted', async () => {
    const first = renderHook(() => useConversation())
    expect(first.result.current.messages.find(m => m.id === held.id)?.actionChips).toBeUndefined()
    await serverRead(rawOffers)
    const reply = first.result.current.messages.find(m => m.id === held.id)!
    show(reply); expectControls(true)
    expect(screen.getByText(held.content)).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID].messages.find((m: { id: string }) => m.id === held.id)
    expect(saved.actionChips).toBeUndefined(); expect(saved.consentOffered).toBe(true)
    first.unmount(); cleanup(); earlierPageLoad()
    const second = renderHook(() => useConversation())
    await serverRead(rawOffers)
    show(second.result.current.messages.find(m => m.id === held.id)!)
    expectControls(true)
    expect(JSON.stringify(JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID])).not.toContain('actionChips')
    second.unmount()
  })
  it.each([['not executable', undefined], ['absent', undefined], ['empty', []], ['malformed', [{ ...rawOffers[0], suggested_actions: [actions[0]] }]]])(
    '(b) %s server field → no approve or amend, with the SAME saved transcript', async (_label, raw) => {
      earlierPageLoad(true)
      const hook = renderHook(() => useConversation())
      await serverRead(raw)
      show(hook.result.current.messages.find(m => m.id === held.id)!)
      expectControls(false); hook.unmount()
    },
  )
  it('a carrier for a different turn/proposal cannot arm this held card', async () => {
    const hook = renderHook(() => useConversation())
    await serverRead([{ ...rawOffers[0], turn_id: 'another-turn', proposal_id: 'prop_' + 'f'.repeat(32) }])
    show(hook.result.current.messages.find(m => m.id === held.id)!); expectControls(false); hook.unmount()
  })
})
