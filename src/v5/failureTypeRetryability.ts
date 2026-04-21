/**
 * Failure-type retryability classifier.
 *
 * BoundaryError in @talchain/schemas@0.7.0 carries a top-level `retryable:
 * boolean`, but the UI also classifies client-side to stay stable when the
 * server field is absent (e.g. when the router surfaces a synthetic
 * typed_error from a block-level error_code, or a parse_error). The
 * client-side table is the canonical UI-side source.
 *
 * Retryable codes — transient, worth offering a retry action:
 *   UPSTREAM_TIMEOUT       — CEE → PLoT/LLM call timed out
 *   UPSTREAM_UNAVAILABLE   — CEE reached a dependency that returned 5xx
 *   LLM_UNAVAILABLE        — classifier produced unparseable output
 *   INTERNAL_ERROR         — catch-all internal failure; worth one retry
 *
 * Non-retryable codes — the request itself is wrong or policy blocks it:
 *   INGRESS_CONTRACT_VIOLATION — payload shape invalid; retry would fail
 *   EGRESS_CONTRACT_VIOLATION  — CEE response failed its own egress validator
 *   FEATURE_NOT_ENABLED        — flag gated
 *   TURN_BUDGET_EXCEEDED       — session limit hit; new decision required
 *
 * Keep this table in lockstep with CEE's retryable determination at
 * olumi-assistants-service/src/orchestrator/route-v2.ts. If they diverge,
 * checkRetryableAgreement surfaces a DEV warning so ops can reconcile.
 */
import type { FailureTypeLiteral, BoundaryError } from '@talchain/schemas/boundary'

const RETRYABLE: ReadonlySet<FailureTypeLiteral> = new Set<FailureTypeLiteral>([
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'LLM_UNAVAILABLE',
  'INTERNAL_ERROR',
])

export function isRetryable(code: FailureTypeLiteral): boolean {
  return RETRYABLE.has(code)
}

/**
 * DEV-only check that server `retryable` agrees with the client table.
 * Fires a console.warn on disagreement so staging telemetry surfaces drift
 * between CEE and UI classifications. No-op in production builds.
 */
export function checkRetryableAgreement(err: BoundaryError): void {
  if (!import.meta.env.DEV) return
  const clientSays = isRetryable(err.error)
  if (err.retryable !== clientSays) {
    // eslint-disable-next-line no-console
    console.warn('[v5] retryable disagreement', {
      code: err.error,
      serverSays: err.retryable,
      clientSays,
      requestId: err.request_id,
    })
  }
}

/**
 * Extract a human-readable reason from BoundaryError.details.reason when
 * present. CEE layers a specific reason inside details for operators; the
 * UI surfaces it beneath the canonical FAILURE_USER_TEXT label to give
 * users context without losing the taxonomy. Returns empty string when
 * absent or not a string.
 */
export function extractReason(err: BoundaryError | undefined): string {
  if (!err) return ''
  const reason = (err.details as { reason?: unknown } | undefined)?.reason
  return typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : ''
}
