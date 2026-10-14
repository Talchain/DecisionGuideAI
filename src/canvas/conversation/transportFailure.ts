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

/** A transport failure is uncertain unless the client proves dispatch never started. */
export function isUnverifiedDelivery(args: {
  hasBoundaryError: boolean
  transportMeta: TypedErrorTransportMeta | undefined
  recovery: CeeRecovery
  rawBody: unknown
}): boolean {
  return isTransportFailure(args) && args.transportMeta?.requestNotStarted !== true
}

/** Separate from the historical timeout constants; no reload promise or retry instruction. */
export const NETWORK_AFTER_SEND_UNKNOWN_COPY =
  'We cannot confirm whether your message reached the server. It may still have been processed. ' +
  'Nothing you typed was lost. Check your connection, then ask your next question as normal. ' +
  'Sending this same message again could ask the same thing a second time.'

/** Only positive pre-dispatch proof licenses non-delivery copy. */
export function buildTransportFailureCopy(
  meta: TypedErrorTransportMeta,
  showRetry: boolean,
): string {
  if (meta.requestNotStarted !== true) {
    return meta.network ? NETWORK_AFTER_SEND_UNKNOWN_COPY : PROXY_TIMEOUT_UNKNOWN_COPY
  }
  const what = "Your message didn't reach the server."
  const consequence =
    "It hasn't been added to the conversation and is marked as not delivered above. Nothing you typed was lost."
  const action = showRetry ? "Try again when you're ready." : ''
  return [what, consequence, action].filter((s) => s.length > 0).join(' ')
}

/**
 * Recovery Batch B (PL amendment, accepted by the DL, 12 Oct): a send that got NO response has two honest readings.
 *
 * (a) `not_sent`: positive proof the request was never dispatched. No transport reached its own dispatch boundary
 *     (`onRequestStarted`, called immediately before `fetch`), and the transport's result, when there is one, says so
 *     too (`requestNotStarted`). Offline before send, or a failure before the fetch started.
 * (b) `delivery_unknown`: anything else. A request that was dispatched and never answered (network error after
 *     dispatch, a timeout, an abort mid-flight) may have been received and applied, so it is never called "not sent".
 *
 * Fails toward (b): an absent proof is not a proof. Error names and elapsed time are never evidence.
 */
export type UnansweredSendOutcome = 'not_sent' | 'delivery_unknown'

export function classifyUnansweredSend(evidence: {
  /** Some transport in this send reached its dispatch boundary. */
  requestStarted: boolean
  /**
   * The transport result's own pre-dispatch proof, when a result exists (`TypedErrorTransportMeta.requestNotStarted`).
   * Omit when there is no result (a throw), where the dispatch boundary alone decides.
   */
  transportProvedNotStarted?: boolean
}): UnansweredSendOutcome {
  if (evidence.requestStarted) return 'delivery_unknown'
  if (evidence.transportProvedNotStarted === false) return 'delivery_unknown'
  return 'not_sent'
}

/** (a) Confirmed not sent. */
export const NOT_DELIVERED_COPY = "Your message wasn't sent. Check your connection and try again."

/** (b) Dispatched, no response or acknowledgement. */
export const DELIVERY_UNKNOWN_COPY =
  "We couldn't confirm your message arrived. Check the conversation before sending it again."
