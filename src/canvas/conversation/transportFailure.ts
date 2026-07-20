/**
 * Transport-failure classification + copy (dress-rehearsal trust item #3,
 * 2026-07-20).
 *
 * The rehearsal's 4/4 draft failures were HTTP 504s from the Netlify proxy
 * (`{"code":"PROXY_UPSTREAM_TIMEOUT", ...}`) — no CEE body ever reached the
 * UI, and the served conversation history legitimately lacks those turns.
 * The old rendering routed them through the INTERNAL_ERROR taxonomy and
 * told the user "Something went wrong on our side. Please retry." — a
 * server-processing-fault claim that is FALSE for this class: the honest
 * statement is transport-level ("your message didn't go through; nothing
 * was lost").
 *
 * Class split:
 *   - CEE-class:      a BoundaryError envelope, OR a raw body carrying any
 *                     typed CEE signal (recovery data, retryable marker, an
 *                     `error` code field). The server received and failed
 *                     the turn — #391's recovery rendering owns the copy.
 *   - transport-class: a parse_error with NO CEE signal at all — proxy
 *                     timeout JSON, edge-timeout HTML, network throw. The
 *                     turn never produced a server outcome. Transport copy
 *                     owns it; we never invent a recovery suggestion here.
 *
 * Pure leaf: no imports beyond types, fail-closed duck-typing.
 */

import type { TypedErrorTransportMeta } from '../../v5/responseRouter'
import type { CeeRecovery } from './ceeRecovery'
import { isRecord } from './ceeRecovery'

/**
 * True when the raw non-2xx body looks like a CEE error envelope rather
 * than proxy/edge output. The discriminator is the typed `error` code field
 * every CEE envelope shape carries (BoundaryError, CeeTypedError,
 * CEEErrorResponseV1's nested `error` object). The rehearsal proxy body
 * carries `code`, not `error` — proxy output stays transport-class.
 */
export function looksLikeCeeEnvelope(rawBody: unknown): boolean {
  if (!isRecord(rawBody)) return false
  if (typeof rawBody.error === 'string') return true
  // Spec-v04 nested shape: { error: { code, ... } }
  if (isRecord(rawBody.error)) return true
  return false
}

/**
 * Classify a typed_error as transport-class. Fail closed towards the
 * CEE-class copy: only a parse_error-originated target (transportMeta
 * present, no BoundaryError) with zero CEE signal anywhere classifies as
 * transport.
 */
export function isTransportFailure(args: {
  hasBoundaryError: boolean
  transportMeta: TypedErrorTransportMeta | undefined
  recovery: CeeRecovery
  rawBody: unknown
}): boolean {
  const { hasBoundaryError, transportMeta, recovery, rawBody } = args
  if (hasBoundaryError) return false
  if (transportMeta === undefined) return false
  if (
    recovery.retryable !== undefined ||
    recovery.suggestion !== undefined ||
    recovery.hints !== undefined
  ) {
    return false
  }
  if (looksLikeCeeEnvelope(rawBody)) return false
  return true
}

/**
 * Honest copy for a transport-class failure. States what actually happened
 * (the message did not go through), what was NOT lost, and instructs a
 * retry only when the retry affordance is actually offered (same
 * copy-agrees-with-affordance rule as resolveFailureBaseCopy).
 */
export function buildTransportFailureCopy(
  meta: TypedErrorTransportMeta,
  showRetry: boolean,
): string {
  const what = meta.network
    ? "Your message didn't reach the server."
    : "The server didn't respond in time, so your message didn't go through."
  const consequence =
    "It hasn't been added to the conversation and is marked as not delivered above. Nothing you typed was lost."
  const action = showRetry ? "Try again when you're ready." : ''
  return [what, consequence, action].filter((s) => s.length > 0).join(' ')
}
