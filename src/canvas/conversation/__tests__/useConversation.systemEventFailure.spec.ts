/**
 * LIVE-CHAIN system-event send-failure propagation (F-lane: no more silent
 * drops). These tests drive an ACTUAL failed POST through the REAL V5 seam —
 * stubbed global `fetch` → REAL `callV5Turn` → REAL `parseV5Response` → REAL
 * `routeV5Response` → useConversation's V5 branch, unmocked — and assert that a
 * SYSTEM-mode turn (feedback / patch / graph-edit all funnel through
 * `sendSystemEvent`) now REJECTS instead of resolving void.
 *
 * Why this shape is load-bearing: the defect was invisible to callers because
 * `sendTurn` swallowed the system-mode typed error and returned void, so PR
 * #435's FeedbackRow optimistic-revert (and handlePatchAccept's affordance)
 * could never fire on a swallowed 4xx/5xx/network failure. A `sendSystemEvent`
 * that rejects is the seam that makes silence impossible. These specs FAIL on
 * the pre-fix code (sendSystemEvent resolves) — that is the RED that proves the
 * swallow; restoring the swallow re-REDs them (mutation check).
 *
 * The user-mode pin at the bottom locks the asymmetry: a user turn on the SAME
 * failing POST must NOT throw — it keeps its in-transcript synthetic bubble +
 * setLastSendFailure exactly as before.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation, SystemEventSendError } from '../useConversation'
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

// sendSystemEvent's own pre-check no-ops unless orchestrator V2 is enabled.
// Keep every other flag real (importOriginal) — the success path reads several
// (isPreAnalysisEnrichedEnabled, …) and must not trip an undefined-export throw.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})

// Eligibility ON so every turn enters the V5 exclusive branch regardless of
// the developer's env (same pattern as useConversation.v5ErrorRecovery.spec.ts).
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Wire fixtures + fetch stubs
// ---------------------------------------------------------------------------

/** A strict CEE BoundaryError body (the real 4xx/5xx wire shape). */
function boundaryErrorBody(retryable: boolean): Record<string, unknown> {
  return {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'system_event_pipeline',
    details: { retryable, stage: 'frame' },
    request_id: 'req_sys_1',
    retryable,
  }
}

/** A minimal valid OlumiResponse (200 success) — CEE acknowledged the event. */
function okResponseBody(assistantText: string): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: assistantText,
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
  }
}

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

/** Network reject: fetch itself throws (offline / DNS / CORS preflight). */
function stubFetchReject() {
  const fetchStub = vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

const FEEDBACK_EVENT = {
  type: 'feedback_submitted' as const,
  payload: { turn_id: 'turn-1', rating: 'up' as const },
}

/** Run a system event and capture its outcome without an unhandled rejection. */
async function runSystemEvent(): Promise<unknown | 'resolved'> {
  const { result } = renderHook(() => useConversation())
  let outcome: unknown | 'resolved' = 'resolved'
  await act(async () => {
    outcome = await result.current
      .sendSystemEvent(FEEDBACK_EVENT)
      .then(() => 'resolved', (e) => e)
  })
  return outcome
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
// Tests — the swallow, proven at the real seam
// ---------------------------------------------------------------------------

describe('sendSystemEvent — send failures propagate (no silent drop)', () => {
  it('rejects with SystemEventSendError when the POST is a network reject', async () => {
    const fetchStub = stubFetchReject()

    const outcome = await runSystemEvent()

    expect(fetchStub).toHaveBeenCalledTimes(1)
    // RED pre-fix: sendSystemEvent RESOLVES (outcome === 'resolved').
    expect(outcome).toBeInstanceOf(SystemEventSendError)
  })

  it('rejects with SystemEventSendError when the POST returns a 500', async () => {
    const fetchStub = stubFetchWith(500, boundaryErrorBody(false))

    const outcome = await runSystemEvent()

    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(outcome).toBeInstanceOf(SystemEventSendError)
  })

  it('does NOT reject on a 200 success — the event was acknowledged', async () => {
    // Over-throwing would revert a SUCCESSFUL feedback vote. A successful ack
    // must resolve so callers keep the optimistic state.
    stubFetchWith(200, okResponseBody('Thanks for the feedback.'))

    const outcome = await runSystemEvent()

    expect(outcome).toBe('resolved')
  })

  it('leaves NO synthetic error bubble in the transcript on system failure', async () => {
    // System turns have no transcript surface — the failure propagates to the
    // dispatcher, it does not inject an out-of-context chat message.
    stubFetchWith(500, boundaryErrorBody(true))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendSystemEvent(FEEDBACK_EVENT).catch(() => undefined)
    })

    expect(result.current.messages).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Regression pin — user-mode failure behaviour is UNCHANGED
// ---------------------------------------------------------------------------

describe('user-mode failure behaviour is pinned unchanged', () => {
  it('sendMessage on the SAME failing 500 does NOT throw and still surfaces in-transcript', async () => {
    stubFetchWith(500, boundaryErrorBody(true))

    const { result } = renderHook(() => useConversation())
    let threw = false
    await act(async () => {
      await result.current.sendMessage('draft my decision').catch(() => {
        threw = true
      })
    })

    // User-mode turns NEVER throw — they surface in the transcript.
    expect(threw).toBe(false)

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last).toBeDefined()
    expect(last.role).toBe('assistant')
    expect(last.synthetic).toBe(true)
    expect(last.content).toContain('Something went wrong on our side')
    // The user's text is preserved for restore-into-composer.
    expect(result.current.lastSendFailure?.inputText).toBe('draft my decision')
  })
})
