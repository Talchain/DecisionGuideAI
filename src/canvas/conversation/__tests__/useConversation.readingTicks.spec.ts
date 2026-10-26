import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

// V4 transport must never be touched by these tests.
const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
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
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

// Eligibility ON so sendMessage enters the V5 exclusive branch regardless of
// the developer's env (same pattern as useConversation.hook.spec.ts).
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

/**
 * ⭐ D4, PER-ITEM APPROVAL ON THE WIRE: the reading card's ticked rows ride its own approve press as `approve_ids`
 * (CEE approves exactly those, with no AI call; its turn identity includes them). A retry of that press sends the SAME ids
 * under the same turn id, so CEE replays it, never TURN_ID_REUSED; the whole card's approve sends none.
 * Real path: sendChip → REAL buildV5Payload → REAL callV5Turn → stubbed fetch (body captured).
 */
function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(async (_url: unknown, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}
const sentBodies = (fetchStub: ReturnType<typeof stubFetchWith>) => fetchStub.mock.calls
  .map(([, init]) => (typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null))
  .filter((b): b is Record<string, unknown> => b !== null && b.kind === 'message')

const PROPOSAL = 'prop_0123456789abcdef0123456789abcdef'
const APPROVE_CHIP = {
  id: `agent-approve-proposal:${PROPOSAL}`, label: 'Yes, that’s what I meant', message: 'Yes, that’s what I meant.',
  proposalEdits: { proposal_id: PROPOSAL, revision: 'rev-1', digest: 'd'.repeat(32), graph_hash: '09ab381419299112', fields: [] },
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [], edges: [], results: { status: 'idle' } as never, currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('D4: the ticked rows on the wire', () => {
  it('the ticked press carries exactly its ids beside its own approve; its retry resends them under the same turn id; the whole-card press carries none', async () => {
    const fetchStub = stubFetchWith(503, { error: 'RECOVERY_FAULT_INJECTED', point: 'after_write' })
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendChip({ ...APPROVE_CHIP, label: 'Confirm ticked', message: 'Confirm ticked.', approveIds: ['sell_through', 'more_loaves'] } as never) })
    const [ticked] = sentBodies(fetchStub)
    expect(ticked).toMatchObject({ message: 'Confirm ticked.', chip: { id: APPROVE_CHIP.id }, proposal_edits: APPROVE_CHIP.proposalEdits, approve_ids: ['sell_through', 'more_loaves'] })
    await act(async () => { await result.current.retryLast() })
    const retried = sentBodies(fetchStub).at(-1)!
    expect(sentBodies(fetchStub)).toHaveLength(2)
    expect([retried.turn_id, retried.approve_ids, retried.message]).toEqual([ticked!.turn_id, ['sell_through', 'more_loaves'], 'Confirm ticked.'])
    // CONTROL: the whole card's approve, the same chip with no ids, sends no `approve_ids` key.
    await act(async () => { await result.current.sendChip(APPROVE_CHIP as never) })
    const whole = sentBodies(fetchStub).at(-1)!
    expect(whole).toMatchObject({ chip: { id: APPROVE_CHIP.id }, message: APPROVE_CHIP.message })
    expect(whole).not.toHaveProperty('approve_ids')
  })
})
