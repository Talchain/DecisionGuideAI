/**
 * A typed refusal must stay a typed refusal when the producer adds its
 * underscore diagnostic sidecars to the error body.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — MANUAL-EDIT-REWITNESS-0753Z N1, 24 Sep 2026, served UI `25314672`
 * ─────────────────────────────────────────────────────────────────────────────
 * On the OpenAI lane every forwarded canvas edit comes back through CEE's
 * `/agent/v1/turn`, which re-sends the orchestrator's body verbatim PLUS two
 * top-level keys (`agent-v1-turn.ts:785-799` at CEE `e81aea1`, commented there
 * as *"Underscore sidecar: egress is `.strict()`"*): `_diagnostic_trace` and
 * `_provider_calls` (and `_provider_calls_truncated` when the ledger is cut).
 * `BoundaryErrorSchema` is `.strict()`, so the real 409 `GRAPH_DIVERGED` failed
 * with `unrecognized_keys` and became a `parse_error` — the conflict category
 * and the reason were thrown away, and a refusal the server stated read
 * "Could not confirm · the model may or may not have this value…".
 *
 * WHAT IS PINNED: the non-2xx branch splits the producer's underscore sidecars
 * off with the SAME splitter the 2xx path uses, before the strict parse, and
 * keeps them on the same non-enumerable `__additive__` sidecar.
 *
 * ⛔ AND WHAT IS NOT LOOSENED: the schema stays strict. An undeclared root key
 * WITHOUT the underscore is not a sidecar — it still fails the parse, with or
 * without the lane's keys beside it, and so does a body that is not a
 * BoundaryError underneath them.
 */
import { describe, it, expect } from 'vitest'

import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'

function makeResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** CEE `route-v2.ts` stale-base 409, as witnessed (rewitness row 5b). */
const STALE_BASE_409 = {
  error: 'GRAPH_DIVERGED',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    reason: 'graph_write_conflict',
    conflict_category: 'stale_base_graph_hash',
    recovery_action: 'refresh_and_reconfirm',
    expected_base_graph_hash: '00b6c7c26699cc11',
    event_kind: 'option_intervention_edit',
  },
  request_id: 'req_lane_409',
  retryable: false,
}

/** CEE `buildCommitFailureBoundaryError` 422 — a request declined without writing. */
const REFUSED_NO_WRITE_422 = {
  error: 'INGRESS_CONTRACT_VIOLATION',
  boundary: 'B1',
  direction: 'egress',
  validator: 'turn_commit',
  details: {
    retryable: false,
    reason: 'system_event_refused_no_write',
    event_kind: 'option_intervention_edit',
    stage: 'frame',
  },
  request_id: 'req_lane_422',
  retryable: false,
}

/** The keys `/agent/v1/turn` adds to a FORWARDED body, at CEE `e81aea1`. */
const LANE_SIDECARS = {
  _diagnostic_trace: { exit_path: 'agent_lane_forwarded', forwarded_kind: 'system_event' },
  _provider_calls: [],
}

describe('N1 — a refusal carrying the OpenAI lane\'s sidecars is still a typed refusal', () => {
  it('⭐ 409 GRAPH_DIVERGED + `_diagnostic_trace` + `_provider_calls` → boundary_error with its conflict category — RED at 25314672 (parse_error)', async () => {
    const result = await parseV5Response(makeResponse({ ...STALE_BASE_409, ...LANE_SIDECARS }, 409))

    expect(result.kind).toBe('boundary_error')
    if (result.kind !== 'boundary_error') throw new Error('unreachable')
    expect(result.error.error).toBe('GRAPH_DIVERGED')
    expect(result.error.request_id).toBe('req_lane_409')
    expect(result.error.details.conflict_category).toBe('stale_base_graph_hash')
    expect(result.error.details.recovery_action).toBe('refresh_and_reconfirm')
  })

  it('⭐ 422 `system_event_refused_no_write` + the sidecars (ledger truncated too) → boundary_error with its reason — RED at 25314672', async () => {
    const result = await parseV5Response(
      makeResponse({ ...REFUSED_NO_WRITE_422, ...LANE_SIDECARS, _provider_calls_truncated: true }, 422),
    )

    expect(result.kind).toBe('boundary_error')
    if (result.kind !== 'boundary_error') throw new Error('unreachable')
    expect(result.error.error).toBe('INGRESS_CONTRACT_VIOLATION')
    expect(result.error.details.reason).toBe('system_event_refused_no_write')
  })

  it('the sidecars are KEPT, off the typed surface — on the same non-enumerable `__additive__` sidecar as a 2xx body', async () => {
    const result = await parseV5Response(makeResponse({ ...STALE_BASE_409, ...LANE_SIDECARS }, 409))
    if (result.kind !== 'boundary_error') throw new Error(`expected boundary_error, got ${result.kind}`)

    // The typed envelope is exactly the declared shape.
    expect(Object.keys(result.error).sort()).toEqual(Object.keys(STALE_BASE_409).sort())
    const ext = (result.error as unknown as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY]
    expect(ext).toEqual(LANE_SIDECARS)
    expect(Object.isFrozen(ext)).toBe(true)
    expect(Object.keys(result.error)).not.toContain(ADDITIVE_EXTENSIONS_KEY)
  })

  it('CONTRAST — the same bodies WITHOUT the sidecars parse as before, and carry no sidecar', async () => {
    for (const [body, status] of [[STALE_BASE_409, 409], [REFUSED_NO_WRITE_422, 422]] as const) {
      const result = await parseV5Response(makeResponse(body, status))
      expect(result.kind).toBe('boundary_error')
      if (result.kind !== 'boundary_error') throw new Error('unreachable')
      expect(result.error).toEqual(body)
      expect((result.error as unknown as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY]).toBeUndefined()
    }
  })

  it('⛔ CONTRAST — an undeclared root key WITHOUT the underscore still fails the strict parse', async () => {
    const body = { ...STALE_BASE_409, conflict_category: 'stale_base_graph_hash' }
    const result = await parseV5Response(makeResponse(body, 409))

    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('non_ok_non_boundary')
    // The ORIGINAL body is what the diagnostics see — nothing split off it.
    expect(result.raw).toEqual(body)
  })

  it('⛔ CONTRAST — the lane\'s sidecars do not rescue an undeclared non-underscore key beside them', async () => {
    const body = { ...STALE_BASE_409, ...LANE_SIDECARS, recovery: { action: 'reload' } }
    const result = await parseV5Response(makeResponse(body, 409))

    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.raw).toEqual(body)
  })

  it('⛔ CONTRAST — the sidecars do not rescue a body that is not a BoundaryError underneath', async () => {
    const body: Record<string, unknown> = { ...STALE_BASE_409, ...LANE_SIDECARS }
    delete body.request_id
    const result = await parseV5Response(makeResponse(body, 409))

    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.raw).toEqual(body)
  })
})
