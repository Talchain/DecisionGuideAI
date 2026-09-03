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
 * `x-request-id` / `x-cee-request-id` / `x-correlation-id` header. ~~This client
 * sends none of those: `v5/turnAuthHeaders.ts` emits only `X-User-Id` and
 * `Authorization`.~~ CEE never reads `payload.turn_id` as a dedupe key at all, so
 * this UI's long-standing "reuse the prior client_turn_id for idempotent
 * replay" comments buy exactly nothing. Two sends = two committed rows.
 *
 * The copy therefore states the duplicate consequence and leaves the choice
 * with the user, rather than presenting a primary button that quietly asks
 * twice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE STRUCK CLAUSE ABOVE IS FALSE AT THESE TIPS, AND IT IS THE CLAUSE THE
 * WHOLE "NO RETRY" RULING RESTS ON. Derived 2026-09-03 at the bytes of UI
 * `86786efb` and CEE `f4c8f50` (both = the deployed staging builds), five hops,
 * each read rather than inferred:
 *
 *   1. `useConversation.ts` builds every V5 turn's headers as
 *      `{ ...buildTurnAuthHeaders(v5Identity), ...buildRequestIdHeaders(generateRequestId()) }`.
 *      `buildRequestIdHeaders` (`types/requestId.ts`) emits `X-Request-Id`. The
 *      sentence above predates that call site; `turnAuthHeaders.ts` is no longer
 *      the whole header set.
 *   2. `generateRequestId()` is `crypto.randomUUID()`, and CEE's
 *      `SAFE_REQUEST_ID_PATTERN` is `^[A-Za-z0-9._-]{1,64}$` — a UUID passes.
 *   3. CEE's `/proxy/v5/turn` route forwards `x-request-id` to the internal
 *      call: it is in `ALLOWED_REQUEST_HEADERS` (`routes/proxy-v5-turn.ts`), and
 *      the same route's CORS `Access-Control-Allow-Headers` names it.
 *   4. `getOrGenerateRequestId` returns the client's value when it validates.
 *   5. `turn-executor.ts` commits with `turn_id: context.request_id`, and
 *      `append_turn_atomic` enforces `UNIQUE (scenario_id, turn_id)` with
 *      `ON CONFLICT DO NOTHING` (`orchestrator-v5/commit.ts` header).
 *
 * So the commit idempotency key IS client-controllable today. A re-send that
 * REUSES the original turn's `X-Request-Id` cannot double-commit — the second
 * insert is a no-op by the RPC's own conflict clause.
 *
 * WHAT THAT DOES AND DOES NOT LICENCE. It does NOT make today's retry safe:
 * the client mints a FRESH id on every send, so a re-send is still a second
 * ask and the copy below still says so. It DOES mean the "no retry is
 * possible" framing is wrong — the mechanism exists on both sides and the
 * missing piece is three lines in `useConversation.ts` (retain the id on the
 * message, thread it back through `retryLast`, reuse it in `v5Headers`). That
 * file is owned by another open PR at the time of writing, so `retrySafety`
 * below states the contract and is deliberately not wired here.
 * ═══════════════════════════════════════════════════════════════════════════
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
 * SIX things, in order: what we did (stopped waiting), what we do not know
 * (whether it completed), what is safe (their text), what will NOT help
 * (reloading), what they can DO, and what sending again would cost (a second
 * ask). No retry chip accompanies this — see the file header.
 *
 * ⚠ 2026-09-03 — the two middle clauses are the new ones, and they are the
 * difference between honest and useful. The prior copy told the user we could
 * not confirm anything and then instructed them to wait, which is a dead end:
 * the wait has no terminating event they can observe. Both replacements are
 * derived, not comforting noise.
 *
 *   · "reloading will not bring the reply back" — the transcript is local-first
 *     `localStorage` (`utils/transcriptStore.ts`) and this client has no read
 *     path to CEE's turn rows, so a reload replays a transcript that by
 *     construction lacks the reply. The file header already knew this; the copy
 *     never said it, and reloading is the first thing a user tries.
 *   · "the reply to that one is written with it in view" — if CEE committed the
 *     turn, its row is in `v5_conversation_turns`, and the next turn's context
 *     pack projects committed rows into `recent_turns` verbatim
 *     (`orchestrator-v5/context/context-pack-assembler.ts:projectConversation`,
 *     `user_message` / `assistant_message`). So carrying on is not a hopeful
 *     suggestion: it is the receipt channel that does not depend on this socket,
 *     and it is the one action that both resolves the ambiguity and cannot
 *     duplicate.
 */
export const WAIT_EXPIRY_UNKNOWN_COPY =
  'This is taking longer than expected, so we stopped waiting for a reply. ' +
  'Your message did reach the server and may still be being worked on — we cannot confirm from here whether it finished. ' +
  'Nothing you typed was lost, and reloading will not bring the reply back. ' +
  'What you can do: ask your next question as normal — if this turn did land, the reply to that one is written with it in view. ' +
  'Sending this same message again would ask the same thing a second time.'

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
  'Nothing you typed was lost, and reloading will not bring the reply back. ' +
  'What you can do: ask your next question as normal — if this turn did land, the reply to that one is written with it in view. ' +
  'Sending this same message again would ask the same thing a second time.'

/**
 * Phrasings that offer the user a NEXT STEP.
 *
 * ⚠ THIS IS A SAMPLED FLOOR, NOT A TRACKING MIRROR. "Does this sentence give
 * the reader something to do?" is an open class over natural language and no
 * finite regex list decides it; a list derived from the copies it checks would
 * only prove the copies agree with each other (the estate's 12d lesson). What
 * this list can honestly do is REFUSE a known dead end, which is why the guard
 * that uses it is written as a two-sided pair: every shipped failure copy must
 * pass, AND a hand-written corpus of dead ends this product has actually
 * shipped must fail. Growing the list to match new copy is fine; growing it to
 * make a failing string pass is the defect.
 *
 * "Next step" means a step that changes the reader's situation. "Give it a
 * moment" is deliberately absent: waiting for an event you cannot observe is
 * the dead end this list exists to catch.
 */
export const NEXT_STEP_PATTERNS: readonly RegExp[] = [
  /what you can do/i,
  /ask your next question/i,
  /try again/i,
  /rephrase/i,
  /sign in/i,
  /check your connection/i,
]

/** True when `copy` offers the reader something to do about the failure. */
export function statesANextStep(copy: string): boolean {
  return NEXT_STEP_PATTERNS.some((p) => p.test(copy))
}

/**
 * Is re-sending an unconfirmed turn SAFE — i.e. can it not double-commit?
 *
 * Two independent grounds, and they are DIFFERENT QUESTIONS that happen to
 * share an answer, so they are named apart rather than collapsed:
 *
 *   `never_reached_server` — the fetch itself threw (`TypedErrorTransportMeta
 *     .network === true`). Nothing was delivered, so nothing can be duplicated.
 *     This is the one shape where non-delivery is VERIFIED.
 *   `request_id_reused` — the turn DID reach CEE and may have committed, but the
 *     re-send carries the ORIGINAL `X-Request-Id`. CEE takes its `turn_id` from
 *     that header (`getOrGenerateRequestId` → `turn-executor` →
 *     `append_turn_atomic`) and the RPC enforces
 *     `UNIQUE (scenario_id, turn_id) ON CONFLICT DO NOTHING`, so the second
 *     insert is a no-op. The five-hop derivation is in this file's header.
 *   `fresh_request_id` — the re-send would mint a new id, which is what the
 *     client does today. CEE has no other dedupe key (it never reads
 *     `payload.turn_id`), so this genuinely duplicates.
 *
 * ⚠ NOT WIRED. `useConversation.ts` currently mints a fresh id per send and does
 * not retain it on the message, so every real caller today is
 * `fresh_request_id`. This predicate exists so the correction to the file header
 * is checkable rather than prose, and so the wiring lane has the contract in one
 * place. Wiring it means retaining the id on the user message and threading it
 * back through `retryLast` — three call sites, all in a file this lane does not
 * own.
 */
export type RetrySafetyReason =
  | 'never_reached_server'
  | 'request_id_reused'
  | 'fresh_request_id'

export interface RetrySafety {
  readonly safe: boolean
  readonly reason: RetrySafetyReason
}

export function retrySafety(args: {
  /**
   * True only when the fetch threw and no request was delivered
   * (`TypedErrorTransportMeta.network === true`). A wait expiry or a proxy
   * timeout is FALSE here — the request reached CEE.
   */
  verifiedNonDelivery: boolean
  /**
   * The `X-Request-Id` the original send used, if the client retained it and
   * the re-send would reuse it. Null/absent means a fresh id would be minted.
   */
  reusedRequestId?: string | null
}): RetrySafety {
  if (args.verifiedNonDelivery) {
    return { safe: true, reason: 'never_reached_server' }
  }
  const id = args.reusedRequestId
  // Same shape CEE validates against (`SAFE_REQUEST_ID_PATTERN`): an id CEE
  // would reject is regenerated server-side, which is exactly the unsafe case.
  if (typeof id === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(id)) {
    return { safe: true, reason: 'request_id_reused' }
  }
  return { safe: false, reason: 'fresh_request_id' }
}
