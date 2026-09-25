/**
 * ⭐⭐ HOW A SYSTEM-EVENT SEND SETTLED — derived ONCE, for every carrier.
 *
 * ⛔⛔ THIS EXISTS BECAUSE THE RULE WAS WRITTEN ON ONE CARRIER AND SWEPT TO
 * NEITHER OF ITS SIBLINGS. `proposeOptionIntervention` worked out, at length and
 * correctly, that a send has FIVE outcomes and that two of them mean the turn
 * never happened. The reasoning was then left inline, so the two
 * `edge_strength_edit` `confirm_current` carriers — `proposeEdgeStrengthConfirmation`
 * and the inspector's `confirmCurrentStrength` — each shipped
 * `.catch(() => {})`: every settlement collapsed to silence, including the
 * server saying no.
 *
 * Copying the block into them would have made three spellings of one rule, which
 * is this estate's dominant defect. It is extracted instead, so the next carrier
 * gets the derivation by construction rather than by whoever writes it
 * remembering that this reasoning exists.
 *
 * ⚠ SCOPE, STATED: this decides what the CALLER MAY SAY ABOUT THE SEND. It is
 * NOT the applied channel and cannot be used as one. `'sent'` means a POST left
 * and the server has not answered yet — a row that rendered "saved" on it would
 * be an optimistic write wearing a receipt. Whether the MODEL changed arrives
 * separately, on the turn.
 */
import { SEND_BLOCKED, SEND_DEFERRED, SystemEventSendError } from './useConversation'
import type { SendTurnOutcome } from './useConversation'
import { isProvenNoWriteConflict, isProvenNoWriteReason } from '../../v5/provenNoWriteConflict'

/**
 * ⚠⚠ `refused` AND `unverified` WERE ONE THING — the original catch reported
 * `blocked` for every rejection — AND THAT WAS FALSE IN BOTH DIRECTIONS.
 * `blocked`'s copy says nothing reached the server, which is a lie about a 409
 * the server sent back deliberately; and answering "not sent" to a failure that
 * MAY have written is the more dangerous half, because the user re-sends a
 * value the model might already hold.
 */
export type SystemEventSendSettlement =
  /** The POST left and was not queued. Says NOTHING about what the server did. */
  | 'sent'
  /** Buffered behind an in-flight turn. The turn does not exist yet. */
  | 'queued'
  /** The busy lock refused it. Nothing reached the server; the draft is intact. */
  | 'blocked'
  /** The server answered, and its own line certifies that it wrote nothing. */
  | 'refused'
  /** It may or may not have landed. The uncertainty is retained, never resolved. */
  | 'unverified'

/**
 * ⭐ WHY a `refused` send was refused — the two producer guarantees are
 * different facts with OPPOSITE remedies, so a caller that names a cause must
 * be able to tell them apart:
 *
 * - `conflict` — a proven-no-write CONFLICT CATEGORY (`isProvenNoWriteConflict`):
 *   the model moved on under the send. A turn refreshes the base, after which
 *   the same edit can land.
 *   ⚠ Since CEE #1868 the set also holds `turn_fence_superseded` and
 *   `turn_fence_stopped`, which CEE states on the `factor_value_edit` arm only.
 *   A STOPPED turn is not "the model moved on". The factor-edit carrier reads
 *   only `blocked` here; its revert and notice come from `useConversation`,
 *   which shows the fence's own sentence (`fenceRefusalCopyForCategory`). A
 *   caller that names a cause for `conflict` on another carrier must not assume
 *   a moved model if CEE ever sends a fence verdict there.
 * - `declined` — a proven-no-write REASON (`isProvenNoWriteReason`): the
 *   producer declined the request itself (`retryable: false`). Nothing moved,
 *   and repeating the request cannot succeed — so a "the model moved on" line
 *   would be false about it, and a "set it again" remedy would terminate in the
 *   same refusal.
 */
export type SystemEventRefusalCause = 'conflict' | 'declined'

/**
 * What the envelope said, beside the settlement. Additive: a caller that reads
 * only the settlement is unchanged.
 */
export interface SystemEventSendSettlementDetail {
  /** Set on `refused` only. */
  readonly refusal?: SystemEventRefusalCause
  /**
   * The producer's `details.reason`, RAW — a machine token as often as prose.
   * Show it only through `isDisplaySafeReason`.
   */
  readonly reason?: string
}

/**
 * Settle one `sendSystemEvent` promise into exactly one of the five, once.
 *
 * ⭐ THE NO-WRITE QUESTION IS ASKED BY THE ONE AUTHORITY THAT OWNS IT.
 * `isProvenNoWriteConflict` is where this estate keeps "did the producer state
 * it wrote nothing?", derived per category from the producer's own line.
 * Re-deriving it here — from the status code, from `retryable: false`, or from
 * what a category name suggests — is the twins defect that module was written
 * to end.
 *
 * ⚠ TRANSPORT DOES NOT PROVE NON-DELIVERY, EITHER HALF. `v5Adapter` catches any
 * fetch rejection without observing whether the server accepted, and
 * `responseRouter` derives `network` from a MISSING `http_status` — so a commit
 * whose response is lost before headers reach the browser is indistinguishable
 * from being offline. Hence `unverified`, not `blocked`.
 *
 * `onSettled` is optional so existing call sites are unchanged; a caller that
 * renders a pending state MUST pass it, or that state has no way to end.
 */
export function settleSystemEventSend(
  send: Promise<SendTurnOutcome> | SendTurnOutcome,
  onSettled?: (
    settlement: SystemEventSendSettlement,
    detail: SystemEventSendSettlementDetail,
  ) => void,
): void {
  /**
   * ⛔⛔ FIRE ONCE, AND THE CHAIN BELOW IS WHY IT HAS TO BE ENFORCED HERE RATHER
   * THAN ASSUMED. `.catch()` is chained AFTER `.then()`, so it catches a
   * rejection of `send` **and also anything the SUCCESS callback throws** — and
   * the success callback is `onSettled`, supplied by the caller. A consumer
   * whose handler threw would be told `'sent'` and then, immediately,
   * `'unverified'`: a row that had correctly cleared would relabel itself as
   * "Olumi may not have recorded this", about a send that demonstrably left.
   *
   * ⚠ FOUND BY AN INDEPENDENT REVIEW SEAT, AND THE SPEC ABOVE IT WAS ALREADY
   * CLAIMING THE PROPERTY: its describe block reads *"every send settles exactly
   * once"* while no case asserted the count. A title stronger than its
   * assertions is the defect this module exists to remove, one level up — so the
   * guard and the test that bites it landed together.
   *
   * Reordering to `.then(ok, err)` would fix the crosstalk too and is the more
   * elegant change; a latch is chosen because it holds for EVERY future path
   * through this function, including ones that do not exist yet.
   */
  let done = false
  const settleOnce = (s: SystemEventSendSettlement, detail: SystemEventSendSettlementDetail = {}) => {
    if (done) return
    done = true
    onSettled?.(s, detail)
  }
  void Promise.resolve(send)
    .then(outcome => {
      if (outcome === SEND_DEFERRED) return settleOnce('queued')
      if (outcome === SEND_BLOCKED) return settleOnce('blocked')
      return settleOnce('sent')
    })
    .catch((err: unknown) => {
      if (err instanceof SystemEventSendError) {
        // The error already distinguishes them: `kind` separates "nothing
        // reached the server" from "the server received the turn and failed
        // it", and `conflictCategory` is carried precisely because 'server' is
        // too coarse to decide what a surface may claim.
        if (err.kind === 'server') {
          const reason = err.reason !== undefined ? { reason: err.reason } : {}
          if (isProvenNoWriteConflict(err.conflictCategory)) {
            return settleOnce('refused', { ...reason, refusal: 'conflict' })
          }
          // ⭐ The producer's other no-write statement, on `details.reason`.
          // Without this arm a request CEE declined without writing settled as
          // `unverified`, and the inspector — which did not listen at all —
          // said nothing (served `a4434670`, CDP starter, 24 Sep 2026).
          if (isProvenNoWriteReason(err.reason)) {
            return settleOnce('refused', { ...reason, refusal: 'declined' })
          }
          return settleOnce('unverified', reason)
        }
        return settleOnce('unverified')
      }
      // A rejection shape this seam does not recognise. It cannot prove
      // non-delivery, so it must not claim it: the cannot-confirm line, not the
      // confident one. The conversation's own failure channel still records the
      // error; this only decides what the CALLER says.
      settleOnce('unverified')
    })
}
