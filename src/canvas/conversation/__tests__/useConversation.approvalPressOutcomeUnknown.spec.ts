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
 * ⭐ AN APPROVAL PRESS THAT GOT A SERVER FAILURE HAS AN UNKNOWN OUTCOME (VERIFIER REC-WRITE, 19 Oct; UI f236a11e ·
 * CEE 390a1dbe). The press was committed (graph 09ab3814 r3 → e75aaf98 r5), then the response failed with a 503
 * `{"error":"RECOVERY_FAULT_INJECTED","point":"after_write"}`. The card said "Something went wrong on our side. Please
 * retry.", a server-fault claim the evidence refutes: the change was saved. The truthful class is UNKNOWN ("cannot
 * confirm"). The re-press is idempotent on the served build (it returned 200 r5 → r5 and wrote nothing), so the retry
 * stays offered. Real path: stubbed fetch → REAL callV5Turn → parseV5Response → routeV5Response → useConversation.
 * Wire shape: the captured served body (`redteam/joined-proof/runs/20261019T114135Z/REC-WRITE/correction/turns/03.json`).
 */
import { assertsDeliveryUnknown, assertsNonDelivery, statesANextStep } from '../deliveryUnknown'

const SERVED_AFTER_WRITE_FAULT = { error: 'RECOVERY_FAULT_INJECTED', point: 'after_write' }

function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const APPROVE_CHIP = {
  id: 'agent-approve-proposal:prop_0123456789abcdef0123456789abcdef',
  label: 'Use these',
  message: 'Yes, use those.',
  proposalEdits: { proposal_id: 'prop_0123456789abcdef0123456789abcdef', revision: 'rev-1', digest: 'd'.repeat(32), graph_hash: '09ab381419299112', fields: [] },
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [], edges: [], results: { status: 'idle' } as never, currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('an approval press answered by a server failure: outcome unknown, never "something went wrong on our side"', () => {
  it('RED: the served after-write 503 on an approval press says the outcome cannot be confirmed, offers the safe re-press, and is not filed as a server failure', async () => {
    const fetchStub = stubFetchWith(503, SERVED_AFTER_WRITE_FAULT)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendChip(APPROVE_CHIP as never) })
    expect(fetchStub).toHaveBeenCalled()
    const last = result.current.messages[result.current.messages.length - 1]!
    expect(last.role).toBe('assistant')
    expect(last.content).not.toContain('Something went wrong on our side')
    expect(assertsDeliveryUnknown(last.content)).toBe(true)
    expect(assertsNonDelivery(last.content)).toBe(false)
    expect(statesANextStep(last.content)).toBe(true)
    expect(last.actionChips).toEqual([{ id: 'retry', label: 'Try again', intent: 'primary' }])
    expect(result.current.lastSendFailure?.kind).toBe('delivery_unknown')
  })

  it('CONTROL: the same 503 on a typed message (no press) keeps today\'s server-failure copy and kind', async () => {
    stubFetchWith(503, SERVED_AFTER_WRITE_FAULT)
    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('draft my decision') })
    const last = result.current.messages[result.current.messages.length - 1]!
    expect(last.content).toContain('Something went wrong on our side')
    expect(result.current.lastSendFailure?.kind).toBe('server')
  })
})
