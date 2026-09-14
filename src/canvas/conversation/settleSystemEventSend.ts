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
import { isProvenNoWriteConflict } from '../../v5/provenNoWriteConflict'

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
  onSettled?: (settlement: SystemEventSendSettlement) => void,
): void {
  void Promise.resolve(send)
    .then(outcome => {
      if (outcome === SEND_DEFERRED) return onSettled?.('queued')
      if (outcome === SEND_BLOCKED) return onSettled?.('blocked')
      return onSettled?.('sent')
    })
    .catch((err: unknown) => {
      if (err instanceof SystemEventSendError) {
        // The error already distinguishes them: `kind` separates "nothing
        // reached the server" from "the server received the turn and failed
        // it", and `conflictCategory` is carried precisely because 'server' is
        // too coarse to decide what a surface may claim.
        if (err.kind === 'server') {
          return onSettled?.(
            isProvenNoWriteConflict(err.conflictCategory) ? 'refused' : 'unverified',
          )
        }
        return onSettled?.('unverified')
      }
      // A rejection shape this seam does not recognise. It cannot prove
      // non-delivery, so it must not claim it: the cannot-confirm line, not the
      // confident one. The conversation's own failure channel still records the
      // error; this only decides what the CALLER says.
      onSettled?.('unverified')
    })
}
