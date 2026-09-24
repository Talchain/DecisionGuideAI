/**
 * A request CEE DECLINED WITHOUT WRITING must settle as a refusal, not as an
 * unknown — proven through the REAL wire chain.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — served UI `a4434670`, 24 Sep 2026, CDP starter
 * ─────────────────────────────────────────────────────────────────────────────
 * Two option-target edits came back **422 `INGRESS_CONTRACT_VIOLATION`,
 * `details.reason: 'system_event_refused_no_write'`, `retryable: false`**. The
 * producer's own line for that reason is a no-write guarantee (CEE
 * `3f412be11ae68c06ad4955a56f0cf4e9821e5946`: `route-v2.ts:3516-3530` emits it
 * only for `commitSkippedReason === 'refused_no_write'`, defined at
 * `system-events/dispatch.ts:97` as *"a gate declined and NOTHING was
 * written"*). The UI read only `details.conflict_category`, found none, and
 * settled the send as `unverified` — so even a surface that listened could
 * only say "could not confirm" about a refusal the server had stated.
 *
 * WHAT IS REAL HERE: `useConversation` → `callV5Turn` → `parseV5Response` →
 * `routeV5Response` → the V5 typed-error branch that builds
 * `SystemEventSendError` → `settleSystemEventSend`. Only global `fetch` is
 * stubbed, answering with the envelope CEE's own builder produces
 * (`buildCommitFailureBoundaryError`, `route-v2.ts:2310` at the served SHA —
 * the witness's body plus the `request_id`, `details.retryable` and
 * `details.stage` that builder always writes).
 *
 * CONTRASTS, in the same file: the retryable 500 a writer that could NOT
 * confirm its commit returns (`system_event_commit_failed`) must stay
 * `unverified`; a stale-base 409 must stay a `conflict` refusal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation, SystemEventSendError } from '../useConversation'
import {
  settleSystemEventSend,
  type SystemEventSendSettlement,
  type SystemEventSendSettlementDetail,
} from '../settleSystemEventSend'
import { useCanvasStore } from '../../store'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

/** CEE's `buildCommitFailureBoundaryError` shape, at the served SHA. */
function commitFailureEnvelope(opts: {
  error: string
  reason: string
  retryable: boolean
}): Record<string, unknown> {
  return {
    error: opts.error,
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details: {
      retryable: opts.retryable,
      reason: opts.reason,
      event_kind: 'option_intervention_edit',
      stage: 'frame',
    },
    request_id: 'req_option_target_1',
    retryable: opts.retryable,
  }
}

/** The stale-base 409 — `route-v2.ts` sends the category in `details.conflict_category`. */
const STALE_BASE_409 = {
  error: 'GRAPH_DIVERGED',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    conflict_category: 'stale_base_graph_hash',
    recovery_action: 'refresh_and_reconfirm',
    event_kind: 'option_intervention_edit',
  },
  request_id: 'req_option_target_2',
  retryable: false,
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

const OPTION_TARGET_EVENT = {
  type: 'option_intervention_edit' as const,
  payload: {
    option_id: 'opt_segment',
    factor_id: 'fac_gdpr',
    value: 0.7,
    base_graph_hash: '77d05bb3aaaaaaaa',
  },
}

/** Send through the REAL dispatcher and settle it through the REAL resolver. */
async function sendAndSettle(): Promise<{
  error: unknown
  settlement: SystemEventSendSettlement
  detail: SystemEventSendSettlementDetail
}> {
  const { result } = renderHook(() => useConversation())
  let error: unknown = null
  let settled: { settlement: SystemEventSendSettlement; detail: SystemEventSendSettlementDetail } | null = null
  await act(async () => {
    const send = result.current.sendSystemEvent(OPTION_TARGET_EVENT as never, { deferIfBusy: false } as never)
    await new Promise<void>((resolve) => {
      settleSystemEventSend(send, (settlement, detail) => {
        settled = { settlement, detail }
        resolve()
      })
    })
    await send.catch((e: unknown) => {
      error = e
    })
  })
  expect(settled, 'the send never settled').not.toBeNull()
  return { error, ...(settled as unknown as { settlement: SystemEventSendSettlement; detail: SystemEventSendSettlementDetail }) }
}

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
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

describe('a declined option-target edit settles as a refusal, through the real wire chain', () => {
  it('⭐ 422 `system_event_refused_no_write` → refused / declined — RED at a4434670, which said `unverified`', async () => {
    const fetchStub = stubFetchWith(
      422,
      commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
    )

    const { error, settlement, detail } = await sendAndSettle()

    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(SystemEventSendError)
    // The producer's reason is CARRIED — the field the no-write is stated on.
    expect((error as SystemEventSendError).reason).toBe('system_event_refused_no_write')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('declined')
    expect(detail.reason).toBe('system_event_refused_no_write')
  })

  it('CONTRAST — the retryable 500 a writer returns when it could NOT confirm stays `unverified`', async () => {
    stubFetchWith(
      500,
      commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
    )

    const { settlement, detail } = await sendAndSettle()

    // Same envelope shape, opposite guarantee: a commit MAY have landed. Green
    // at a4434670 too — the new arm must not swallow this outcome.
    expect(settlement).toBe('unverified')
    expect(detail?.refusal).toBeUndefined()
  })

  it('CONTRAST — a stale-base 409 is still a refusal', async () => {
    stubFetchWith(409, STALE_BASE_409)

    const { settlement } = await sendAndSettle()

    // Green at a4434670 too: the category arm is unchanged.
    expect(settlement).toBe('refused')
  })

  it('the two refusals are named apart — a stale base is a CONFLICT, the 422 a DECLINE', async () => {
    stubFetchWith(409, STALE_BASE_409)
    const conflict = await sendAndSettle()
    expect(conflict.detail?.refusal).toBe('conflict')

    stubFetchWith(
      422,
      commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
    )
    const declined = await sendAndSettle()
    expect(declined.detail?.refusal).toBe('declined')
  })

  it('the retryable 500 carries its reason too, and it is NOT read as a no-write', async () => {
    stubFetchWith(
      500,
      commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
    )
    const { error, settlement } = await sendAndSettle()
    expect((error as SystemEventSendError).reason).toBe('system_event_commit_failed')
    expect(settlement).toBe('unverified')
  })
})

/**
 * MANUAL-EDIT-REWITNESS-0753Z N1, 24 Sep 2026 (served UI `25314672`, CEE
 * `e81aea1`): on the OpenAI lane `/agent/v1/turn` forwards a canvas edit and
 * re-sends the orchestrator's body with `_diagnostic_trace` and
 * `_provider_calls` added at the top level. The strict `BoundaryErrorSchema`
 * rejected that body, so both refusals above settled `unverified` there.
 */
const LANE_SIDECARS = {
  _diagnostic_trace: { exit_path: 'agent_lane_forwarded', forwarded_kind: 'system_event' },
  _provider_calls: [],
}

describe('N1 — the same refusals, as the OpenAI lane delivers them, still settle as refusals', () => {
  it('⭐ stale-base 409 + lane sidecars → refused / conflict, category carried — RED at 25314672 (`unverified`)', async () => {
    stubFetchWith(409, { ...STALE_BASE_409, ...LANE_SIDECARS })

    const { error, settlement, detail } = await sendAndSettle()

    expect(error).toBeInstanceOf(SystemEventSendError)
    expect((error as SystemEventSendError).conflictCategory).toBe('stale_base_graph_hash')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('conflict')
  })

  it('⭐ 422 `system_event_refused_no_write` + lane sidecars → refused / declined, reason carried — RED at 25314672', async () => {
    stubFetchWith(422, {
      ...commitFailureEnvelope({
        error: 'INGRESS_CONTRACT_VIOLATION',
        reason: 'system_event_refused_no_write',
        retryable: false,
      }),
      ...LANE_SIDECARS,
      _provider_calls_truncated: true,
    })

    const { error, settlement, detail } = await sendAndSettle()

    expect((error as SystemEventSendError).reason).toBe('system_event_refused_no_write')
    expect(settlement).toBe('refused')
    expect(detail.refusal).toBe('declined')
  })

  it('CONTRAST — the retryable 500 + lane sidecars carries its reason and stays `unverified` (the sidecars never manufacture a no-write)', async () => {
    stubFetchWith(500, {
      ...commitFailureEnvelope({
        error: 'INTERNAL_ERROR',
        reason: 'system_event_commit_failed',
        retryable: true,
      }),
      ...LANE_SIDECARS,
    })

    const { error, settlement } = await sendAndSettle()

    // RED at 25314672 on the reason only (it was a parse_error, so nothing was
    // carried); the settlement was `unverified` then and must stay so now.
    expect((error as SystemEventSendError).reason).toBe('system_event_commit_failed')
    expect(settlement).toBe('unverified')
  })

  it('⛔ CONTRAST — an undeclared NON-underscore root key is not a sidecar: the 409 stays unparsed and `unverified`', async () => {
    stubFetchWith(409, { ...STALE_BASE_409, ...LANE_SIDECARS, recovery: { action: 'reload' } })

    const { error, settlement } = await sendAndSettle()

    expect((error as SystemEventSendError).conflictCategory).toBeUndefined()
    expect(settlement).toBe('unverified')
  })
})
