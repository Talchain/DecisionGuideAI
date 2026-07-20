/**
 * LIVE-CHAIN V5 error-recovery tests (Codex F6 — recovery renders on the
 * LIVE path, server retryability authoritative).
 *
 * These tests drive an ACTUAL non-2xx CEE body through the LIVE V5 branch:
 * a stubbed global fetch returns the real wire shape, then the REAL
 * `callV5Turn` → REAL `parseV5Response` (real `BoundaryErrorSchema`) → REAL
 * `routeV5Response` → useConversation's V5 typed_error branch run
 * unmocked. The only seams stubbed are eligibility (flag on), auth/session,
 * telemetry, the DB service, and the network itself.
 *
 * Why this shape is load-bearing: #383 shipped its recovery rendering with
 * a renderer unit test fed a hand-built object — and was wired to the DEAD
 * V4 `handleEnvelope` path (the V5 branch `return`s before it). A grepped
 * symbol proves presence-in-repo, never presence-on-the-live-wire; only a
 * wire-in test proves the live chain. These specs FAIL on the pre-fix code.
 *
 * Wire provenance (verified at CEE staging cbb619a3, src/orchestrator/
 * route-v2.ts): every non-2xx `/orchestrate/v2/turn` body is a strict
 * BoundaryError; recovery rides NESTED at `details.recovery` ({ hints,
 * suggestion, example? }); `details.reason` carries MACHINE codes
 * (draft_graph_cee_timeout) that must never render to users. The flat
 * `recovery_suggestion` (0.19.0 `CeeTypedErrorSchema`, root export) rides
 * CEEErrorResponseV1-shaped envelopes, which are not BoundaryErrors.
 */

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

// ---------------------------------------------------------------------------
// Wire fixtures + fetch stub
// ---------------------------------------------------------------------------

const RECOVERY_SUGGESTION = 'Add more detail about your options, then draft again.'
const RECOVERY_HINTS = [
  'Name the decision you are weighing',
  'List at least two options you are choosing between',
]
const MACHINE_REASON = 'draft_graph_cee_llm_validation_failed'

/** The LIVE wire shape: strict BoundaryError, recovery NESTED in details. */
function liveBoundaryErrorBody(overrides: {
  retryable: boolean
  reason?: string
  recovery?: { hints: string[]; suggestion: string; example?: string }
}): Record<string, unknown> {
  return {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'draft_graph_pipeline',
    details: {
      retryable: overrides.retryable,
      ...(overrides.reason !== undefined ? { reason: overrides.reason } : {}),
      ...(overrides.recovery !== undefined ? { recovery: overrides.recovery } : {}),
      pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED',
      stage: 'frame',
    },
    request_id: 'req_live_1',
    retryable: overrides.retryable,
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

async function sendAndGetLastMessage() {
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current.sendMessage('draft my decision')
  })
  const messages = result.current.messages
  const last = messages[messages.length - 1]
  expect(last).toBeDefined()
  expect(last.role).toBe('assistant')
  return { last, result }
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

describe('V5 live-chain error recovery — non-2xx BoundaryError through the real adapter/parser/router', () => {
  it('envelope WITH nested recovery + server retryable:false → suggestion and hints render, machine reason does not, no retry affordance despite client-retryable INTERNAL_ERROR', async () => {
    const fetchStub = stubFetchWith(500, liveBoundaryErrorBody({
      retryable: false,
      reason: MACHINE_REASON,
      recovery: { hints: RECOVERY_HINTS, suggestion: RECOVERY_SUGGESTION },
    }))

    const { last, result } = await sendAndGetLastMessage()
    expect(fetchStub).toHaveBeenCalledTimes(1)

    // The user sees the specific recovery suggestion…
    expect(last.content).toContain(RECOVERY_SUGGESTION)
    // …and the hints, as bullets…
    expect(last.content).toContain(`• ${RECOVERY_HINTS[0]}`)
    expect(last.content).toContain(`• ${RECOVERY_HINTS[1]}`)
    // …and NEVER the raw machine reason code.
    expect(last.content).not.toContain(MACHINE_REASON)

    // Server said non-retryable — no retry affordance, even though the
    // client table classifies INTERNAL_ERROR as retryable.
    expect(last.actionChips ?? []).toHaveLength(0)
    // And the copy must not instruct a retry the UI does not offer.
    expect(last.content).not.toMatch(/please retry|try again/i)
    // Non-retryable failures do not arm the retry-input restore.
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('envelope WITHOUT recovery + server retryable:true → canonical copy with retry affordance, machine reason still never leaks', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: true,
      reason: 'draft_graph_cee_timeout',
    }))

    const { last } = await sendAndGetLastMessage()

    // Safe fallback: the canonical taxonomy copy.
    expect(last.content).toContain('Something went wrong on our side. Please retry.')
    // The machine reason code must not leak to the user.
    expect(last.content).not.toContain('draft_graph_cee_timeout')
    // Server says retryable — the affordance is offered.
    expect(last.actionChips).toEqual([
      { id: 'retry', label: 'Try again', intent: 'primary' },
    ])
  })

  it('server retryable:false WITHOUT recovery → no retry affordance and no retry instruction in the copy', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: false,
      reason: 'draft_graph_cee_graph_invalid',
    }))

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain('Something went wrong on our side.')
    expect(last.content).not.toMatch(/please retry/i)
    expect(last.actionChips ?? []).toHaveLength(0)
  })

  it('prose details.reason (no recovery) renders — the display gate rejects codes, not sentences', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: true,
      reason: 'The upstream model returned an empty response',
    }))

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain('The upstream model returned an empty response')
  })

  it('flat CeeTypedError-shaped non-2xx body (0.19.0 recovery_suggestion, not a BoundaryError) → suggestion renders and server retryable:false is honoured through the rawBody passthrough', async () => {
    stubFetchWith(500, {
      error: 'CEE_LLM_VALIDATION_FAILED',
      message: 'Draft failed validation.',
      retryable: false,
      request_id: 'req_flat_1',
      recovery_suggestion: RECOVERY_SUGGESTION,
      recovery: { hints: RECOVERY_HINTS, suggestion: RECOVERY_SUGGESTION },
    })

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain(RECOVERY_SUGGESTION)
    expect(last.content).toContain(`• ${RECOVERY_HINTS[0]}`)
    expect(last.actionChips ?? []).toHaveLength(0)
    expect(last.content).not.toMatch(/please retry|try again/i)
  })

  it('no envelope at all (200 with a severity-error block) → client table resolves retryability safely', async () => {
    stubFetchWith(200, {
      response_version: 2,
      assistant_text: '',
      blocks: [{ type: 'error', error_code: 'TURN_BUDGET_EXCEEDED', severity: 'error' }],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    })

    const { last } = await sendAndGetLastMessage()

    // Client-table fallback: TURN_BUDGET_EXCEEDED is non-retryable.
    expect(last.actionChips ?? []).toHaveLength(0)
    // Copy agrees with the withheld affordance and the guidance names the way forward.
    expect(last.content).toContain('That took longer than we allow for a single turn.')
    expect(last.content).not.toMatch(/please retry/i)
    expect(last.content).toContain('start a new decision')
  })
})
