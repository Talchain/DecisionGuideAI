/**
 * Wait-expiry honesty — ROADMAP 2.665 (I-A / I-B).
 *
 * THE CLAIM THIS MODULE EXISTS TO STOP THE UI MAKING:
 * *"we stopped hearing, therefore it did not happen."*
 *
 * That inference is false against this system. CEE does not abandon a turn when
 * the browser stops listening — it runs it to completion and COMMITS it.
 * Live-witnessed 2026-08-07
 * (`PHASE0-EVIDENCE-2026-07-28/splitter-final-witness-2026-08-07.md`): the
 * client gave up at 60.0s and rendered "We stopped waiting, so your message has
 * not gone through. Nothing you typed was lost. Try again or rephrase your
 * message." — while the same turn returned **200, elapsed_ms 123139**, egress
 * clean, turn rows written. Every load-bearing word of that sentence was wrong,
 * and the "Try again" it offered would have asked a second time.
 *
 * WHAT THE CLIENT CAN ACTUALLY KNOW. Nothing, once the wait expires — and this
 * was derived, not assumed:
 *   · there is no status route to poll. CEE registers exactly three V5 proxy
 *     routes — POST `/proxy/v5/turn`, `/proxy/v5/turn/stream`,
 *     `/proxy/v5/turn/stop`. No GET, no turns-list.
 *   · there is no read path to reconcile against. `conversation_turns` /
 *     `v5_conversation_turns` are written on every turn and have ZERO readers
 *     anywhere in this client (see `utils/transcriptStore.ts`, which exists
 *     precisely because the transcript is local-first `localStorage`), and the
 *     RPC is RLS-gated against the guest sessions staging serves.
 *   · so a reload cannot help either: it replays the LOCAL transcript, which by
 *     construction lacks the reply the client never received.
 * UNKNOWN is therefore the honest terminal state, not a stepping stone to a
 * cheap verification. The copy says so plainly instead of guessing.
 *
 * WHY NO RETRY IS OFFERED WHILE UNKNOWN (I-B). A retry would duplicate. CEE's
 * commit idempotency key is `(scenario_id, turn_id)`, but the `turn_id` it
 * writes is CEE's OWN per-HTTP-request id — `turn-executor.ts` passes
 * `turn_id: requestId` / `turn_id: context.request_id`, and
 * `getOrGenerateRequestId` mints a fresh UUID whenever the request carries no
 * `x-request-id` / `x-cee-request-id` / `x-correlation-id` header. This client
 * sends none of those: `v5/turnAuthHeaders.ts` emits only `X-User-Id` and
 * `Authorization`. CEE never reads `payload.turn_id` as a dedupe key at all, so
 * this UI's long-standing "reuse the prior client_turn_id for idempotent
 * replay" comments buy exactly nothing. Two sends = two committed rows.
 *
 * The copy therefore states the duplicate consequence and leaves the choice
 * with the user, rather than presenting a primary button that quietly asks
 * twice.
 */

/**
 * Phrasings that ASSERT non-delivery.
 *
 * Hand-written corpus, deliberately NOT derived from the copy constants below —
 * a guard derived from the thing it checks can only prove the copies agree with
 * each other, never that the list is right (the estate's 12d lesson). These are
 * the claims we have actually shipped, plus their near neighbours, so a future
 * rewrite that reintroduces the sense in different words still trips it.
 */
export const NON_DELIVERY_CLAIM_PATTERNS: readonly RegExp[] = [
  /has not gone through/i,
  /hasn['’]t gone through/i,
  /did not go through/i,
  /didn['’]t go through/i,
  /has not been added to the conversation/i,
  /hasn['’]t been added to the conversation/i,
  /was not added to the conversation/i,
  /wasn['’]t added to the conversation/i,
  /not delivered/i,
  /never (?:reached|got to) the server/i,
  /did not reach the server/i,
  /didn['’]t reach the server/i,
  /no model was drafted/i,
  /nothing was (?:sent|saved|recorded)/i,
]

/** True when `copy` asserts that the turn did not reach or was not recorded. */
export function assertsNonDelivery(copy: string): boolean {
  return NON_DELIVERY_CLAIM_PATTERNS.some((p) => p.test(copy))
}

/**
 * Phrasings that state the outcome is UNKNOWN.
 *
 * The positive half of the contract: it is not enough for copy to avoid
 * claiming non-delivery — silence about the outcome reads as "it failed" on a
 * screen that just stopped. Wait-expiry copy must say, in words, that we cannot
 * tell.
 */
export const DELIVERY_UNKNOWN_PATTERNS: readonly RegExp[] = [
  /can(?:not|['’]t) confirm/i,
  /may still (?:be|have been)/i,
]

/** True when `copy` states, in words, that the outcome is unknown. */
export function assertsDeliveryUnknown(copy: string): boolean {
  return DELIVERY_UNKNOWN_PATTERNS.every((p) => p.test(copy))
}

/**
 * The transcript notice when the client's own wait expires.
 *
 * Four things, in order: what we did (stopped waiting), what we do not know
 * (whether it completed), what is safe (their text), and what sending again
 * would cost (a second ask). No retry chip accompanies this — see the file
 * header.
 */
export const WAIT_EXPIRY_UNKNOWN_COPY =
  'This is taking longer than expected, so we stopped waiting for a reply. ' +
  'Your message did reach the server and may still be being worked on — we cannot confirm from here whether it finished. ' +
  'Nothing you typed was lost. ' +
  'Sending it again would ask the same thing a second time, so give it a moment before you do.'

/**
 * The transcript notice when a response arrived but carried no CEE outcome —
 * the proxy's own timeout body (`PROXY_UPSTREAM_TIMEOUT`) or an edge timeout.
 *
 * Distinct from a network throw, which is the one case where non-delivery IS
 * verified: `TypedErrorTransportMeta.network === true` means the fetch never
 * produced a response at all. `network === false` means the request was
 * delivered and something downstream stopped waiting — exactly the state CEE
 * goes on to commit through.
 */
export const PROXY_TIMEOUT_UNKNOWN_COPY =
  'The server did not reply in time, so we stopped waiting. ' +
  'Your message did reach it and may still have been processed — we cannot confirm from here. ' +
  'Nothing you typed was lost. ' +
  'Sending it again would ask the same thing a second time.'
