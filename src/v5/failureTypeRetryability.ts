/**
 * Failure-type retryability classifier.
 *
 * ⚠ AUTHORITY ORDER (Codex F6 fix): the SERVER's `retryable` marker on the
 * error envelope is authoritative — `BoundaryError.retryable` is a typed,
 * REQUIRED boolean on every non-2xx `/orchestrate/v2/turn` body, and CEE
 * computes it per-failure (e.g. `mapDraftGraphPipelineReason`:
 * CEE_LLM_VALIDATION_FAILED → false, CEE_TIMEOUT → true — both surface as
 * `INTERNAL_ERROR` at the envelope level). The client-side table below is
 * the FALLBACK for the marker's ABSENCE only (synthetic typed_errors from a
 * 200-response error block, or parse_errors where no envelope exists). It
 * must never override what the server said — a client-forced retry on a
 * server-non-retryable failure is a retry that cannot work.
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
 * checkRetryableAgreement still surfaces a DEV warning when the table and
 * the server disagree, so drift stays visible in staging telemetry.
 */
import { FAILURE_USER_TEXT } from '@talchain/schemas/boundary'
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
 * Resolve the effective retry decision for a typed error: the server's
 * envelope marker when it exists, the client table otherwise. See the
 * authority-order note at the top of this file. Absence resolves through
 * the table, never to a hard-coded default, so an unknown-marker envelope
 * still degrades to today's behaviour.
 */
export function resolveRetryable(
  code: FailureTypeLiteral,
  serverRetryable: boolean | undefined,
): boolean {
  return typeof serverRetryable === 'boolean' ? serverRetryable : isRetryable(code)
}

/**
 * Sentences in FAILURE_USER_TEXT that instruct the user to retry. When the
 * retry affordance is withheld (server said non-retryable), copy telling the
 * user to "please retry" beside a missing Try-again chip instructs an action
 * the UI gives them no way to take — the same honesty rule
 * ceeRecovery.buildFailureRender enforces on the V4 path. Exact-suffix
 * matches only; unmatched copy passes through unchanged (fail open).
 */
const RETRY_INSTRUCTION_SUFFIXES = [
  ' Please retry.',
  ' Please try again.',
  ' Please retry shortly.',
] as const

/**
 * Base failure copy that AGREES with the retry decision. With the retry
 * affordance shown, this is exactly FAILURE_USER_TEXT[code]. With it
 * withheld, any trailing retry-instruction sentence is dropped so the copy
 * never tells the user to do something the UI won't offer.
 */
export function resolveFailureBaseCopy(
  code: FailureTypeLiteral,
  showRetry: boolean,
): string {
  const canonical = FAILURE_USER_TEXT[code]
  if (showRetry) return canonical
  for (const suffix of RETRY_INSTRUCTION_SUFFIXES) {
    if (canonical.endsWith(suffix)) {
      return canonical.slice(0, canonical.length - suffix.length)
    }
  }
  return canonical
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

/**
 * Guidance text for non-retryable errors. Retryable errors show a Try again
 * chip on the message bubble instead, so guidance is empty for them.
 *
 * Shared source of truth between TypedErrorRenderer (for rendering contexts
 * that use the full component) and useConversation's V5 typed_error branch
 * (which builds a plain-string message body for MessageBubble). Keeping
 * both paths on the same table prevents drift.
 */
export function resolveGuidance(code: FailureTypeLiteral): string {
  if (isRetryable(code)) return ''
  switch (code) {
    case 'INGRESS_CONTRACT_VIOLATION':
      return 'Please rephrase your message and try again.'
    case 'EGRESS_CONTRACT_VIOLATION':
      return 'The response could not be validated. Please try again or contact support.'
    case 'FEATURE_NOT_ENABLED':
      return 'This feature is not yet available in your session.'
    case 'TURN_BUDGET_EXCEEDED':
      return 'This session has reached its turn limit — start a new decision to continue.'
    case 'UPSTREAM_TIMEOUT':
    case 'UPSTREAM_UNAVAILABLE':
    case 'LLM_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return ''
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}
