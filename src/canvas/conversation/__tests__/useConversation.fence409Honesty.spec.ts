/**
 * Fence-409 transcript honesty — journey-walk 2026-08-03 gap #2 (LIVE V5 chain).
 *
 * THE WITNESSED LIE (journey-walk-2026-08-03.md §4/§8, quartet CEE 78cbb60 ·
 * UI 43fd19e1): every graph-commit value edit died with HTTP 409
 * `GRAPH_DIVERGED`, `details.conflict_category: 'turn_fence_unclaimed'`,
 * `retryable: false` — and the UI rendered *"Your decision has changed since
 * this result was computed. Re-run the analysis to refresh it."* On scenario 3
 * (virgin control) NOTHING had ever been computed; obeying the banner (Rerun)
 * produced byte-identical numbers and the next edit 409'd identically. The
 * banner was false and its remedy an infinite loop.
 *
 * THE MECHANISM AT THE BYTES: the copy is the canonical
 * `FAILURE_USER_TEXT.GRAPH_DIVERGED` staleness string (vendored
 * @talchain/schemas 0.31.0, boundary/error-codes.js:38), authored for the
 * analysed-graph-drifted case. CEE deliberately rides fence refusals on the
 * SAME wire code (olumi-assistants-service `turn-executor.ts` at fee17e3a:
 * "Rides the EXISTING 409-class envelope … rather than minting a wire code"),
 * carrying the distinguisher ONLY in `details.conflict_category`
 * (`turn_fence_${verdict}`, verdict ∈ stopped|superseded|unclaimed|unavailable)
 * — and the UI read that field NOWHERE (`rg -a conflict_category src/` → 0
 * hits at pristine 43fd19e1). So a write-fence refusal borrowed the staleness
 * banner. This spec drives the walk's wire shape through the REAL
 * callV5Turn → parseV5Response → routeV5Response → useConversation
 * typed_error branch (same harness discipline as
 * useConversation.transcriptHonesty504.spec.ts) and pins honest copy.
 *
 * RED-first at pristine 43fd19e1: the transcript renders the staleness banner
 * for this fixture, so every test in the first describe fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(msg: string, status: number, body: unknown) {
      super(msg)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

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

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Wire fixtures — the walk's witnessed 409 shape (journey-walk §4/§8; producer
// literal shape from CEE turn-executor.ts at fee17e3a: `conflict_category:
// `turn_fence_${verdict}``, `recovery_action` per verdict).
// ---------------------------------------------------------------------------

function fence409Body(verdict: 'stopped' | 'superseded' | 'unclaimed') {
  return {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      phase: 'commit',
      fence_verdict: verdict,
      conflict_category: `turn_fence_${verdict}`,
      recovery_action:
        verdict === 'stopped'
          ? 'start_new_draft'
          : verdict === 'superseded'
            ? 'refresh_and_reconfirm'
            : 'retry_later',
      // Walk §8 (scenario 3, virgin control): the compound parsed and executed;
      // only the write fence killed it. Details is a passthrough object, so the
      // extra key rides exactly as it did on the live wire.
      stages_completed: ['build_turn_context', 'orient', 'validate', 'execute', 'confirm', 'coach', 'compose'],
    },
    request_id: 'req_walk_409',
    retryable: false,
  }
}

/** A NON-fence GRAPH_DIVERGED (graph-CAS class): the canonical staleness copy
 * remains the honest rendering for this class and must be untouched. */
const CAS_409_BODY = {
  error: 'GRAPH_DIVERGED',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    phase: 'commit',
    recovery_action: 'refresh_and_reconfirm',
    conflict_category: 'analysis_affecting_conflict',
    expected_base_graph_hash: null,
  },
  request_id: 'req_cas_409',
  retryable: false,
}

const STALENESS_BANNER =
  'Your decision has changed since this result was computed. Re-run the analysis to refresh it.'

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

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fence 409 — the staleness banner must NOT render for a write-fence refusal', () => {
  it('turn_fence_unclaimed (the walk shape): no "decision has changed", no "re-run" instruction; says nothing was changed', async () => {
    stubFetchWith(409, fence409Body('unclaimed'))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Set Monthly Email Spend to £1,800')
    })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    // The witnessed untruth, in either fragment, must be gone.
    expect(last.content).not.toContain('Your decision has changed')
    expect(last.content).not.toContain('Re-run the analysis')
    // The honest core: the change was not saved and the model is unchanged.
    expect(last.content).toMatch(/couldn.t be saved|wasn.t saved/i)
    expect(last.content).toMatch(/nothing in your decision (was )?changed/i)
  })

  it('turn_fence_stopped: names the stop as the cause, states nothing changed', async () => {
    stubFetchWith(409, fence409Body('stopped'))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Set Churn Trend to 80%')
    })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.content).not.toContain(STALENESS_BANNER)
    expect(last.content).toMatch(/stopped/i)
    expect(last.content).toMatch(/nothing in your decision (was )?changed/i)
  })

  it('turn_fence_superseded: names the newer-change conflict, states nothing was overwritten', async () => {
    stubFetchWith(409, fence409Body('superseded'))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Set Available Growth Budget to 70%')
    })

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.content).not.toContain(STALENESS_BANNER)
    expect(last.content).toMatch(/newer change/i)
    expect(last.content).toMatch(/nothing was overwritten/i)
  })

  it('user message still marked failed (delivery honesty unchanged by the copy fix)', async () => {
    stubFetchWith(409, fence409Body('unclaimed'))
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Set Capital Expenditure to £300,000')
    })
    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.deliveryState).toBe('failed')
    expect(result.current.lastSendFailure?.kind).toBe('server')
  })
})

describe('non-fence GRAPH_DIVERGED — canonical copy preserved (guard against overreach)', () => {
  it('graph-CAS conflict_category keeps the canonical staleness copy (that class genuinely diverged)', async () => {
    stubFetchWith(409, CAS_409_BODY)
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Set Churn Trend to 80%')
    })
    const last = result.current.messages[result.current.messages.length - 1]
    // Positive control (trap 13): this spec CAN see the canonical copy when it
    // is the honest rendering — so the absences asserted above test something.
    expect(last.content).toContain('Your decision has changed')
  })
})
