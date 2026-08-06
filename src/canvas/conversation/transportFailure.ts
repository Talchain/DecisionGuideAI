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
import { PROXY_TIMEOUT_UNKNOWN_COPY } from './deliveryUnknown'

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
 * ROADMAP 2.665 — is this failure one whose DELIVERY WE HAVE NOT VERIFIED?
 *
 * True for exactly one shape: transport-class with `network === false`, i.e. a
 * response arrived but carried no CEE outcome (proxy `PROXY_UPSTREAM_TIMEOUT`,
 * edge timeout). The request reached CEE, and CEE commits turns whether or not
 * anything downstream is still listening.
 *
 * False for a network throw (`network === true`) — nothing left the client, so
 * non-delivery is verified — and false for CEE-class failures, where the server
 * answered with its own typed verdict.
 *
 * Derived from `isTransportFailure` rather than re-testing its conditions, so
 * the two can never disagree about what "transport-class" means.
 */
export function isUnverifiedDelivery(args: {
  hasBoundaryError: boolean
  transportMeta: TypedErrorTransportMeta | undefined
  recovery: CeeRecovery
  rawBody: unknown
}): boolean {
  return isTransportFailure(args) && args.transportMeta?.network === false
}

/**
 * Honest copy for a transport-class failure.
 *
 * ⚠ ROADMAP 2.665 — THE TWO HALVES OF THIS CLASS ARE NOT THE SAME CLAIM, and
 * treating them as one shipped a falsehood on the half that matters.
 *
 *   · `meta.network === true` — the fetch threw: offline, DNS, CORS preflight.
 *     No request ever completed, so non-delivery is VERIFIED and the original
 *     copy is exactly right. Unchanged.
 *   · `meta.network === false` — a NON-2xx RESPONSE ARRIVED carrying no CEE
 *     signal, i.e. the proxy's own `PROXY_UPSTREAM_TIMEOUT` body or an edge
 *     timeout. The request reached CEE; something downstream stopped waiting
 *     for it. CEE goes on to complete and COMMIT that turn — live-witnessed
 *     2026-08-07 at 123.1s — so "your message didn't go through" and "it hasn't
 *     been added to the conversation" were both claims we had not verified and
 *     could not verify. That half now says the outcome is unknown.
 *
 * This half is not hypothetical and is not a spare-time tidy-up: reconciling
 * the client wait with CEE's 125s proxy deadline (2.665 (b)) means a long turn
 * that used to expire client-side now arrives HERE instead. Fixing the client
 * timeout alone would only have moved the same false sentence one branch over.
 *
 * A retry is never instructed on the unknown half, whatever `showRetry` says —
 * retrying duplicates (CEE keys its commit on its own per-request id, not on
 * `payload.turn_id`; see `deliveryUnknown.ts`).
 */
export function buildTransportFailureCopy(
  meta: TypedErrorTransportMeta,
  showRetry: boolean,
): string {
  if (!meta.network) return PROXY_TIMEOUT_UNKNOWN_COPY
  const what = "Your message didn't reach the server."
  const consequence =
    "It hasn't been added to the conversation and is marked as not delivered above. Nothing you typed was lost."
  const action = showRetry ? "Try again when you're ready." : ''
  return [what, consequence, action].filter((s) => s.length > 0).join(' ')
}
