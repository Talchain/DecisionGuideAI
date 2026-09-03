/**
 * ⭐ HAS A HUMAN ACCEPTED RESPONSIBILITY FOR THIS EDGE'S STRENGTH?
 *
 * ── WHY THIS IS A SEPARATE MODULE FROM `edgeValueProvenance` ────────────────
 * Two questions that look like one, which is this estate's signature defect
 * (CLAUDE.md trap 21 — write down the question each authority answers before
 * reconciling them, and NEVER fix the divergence by aligning two fields):
 *
 *   `edgeValueSource(data, 'weight')`   WHOSE NUMBER IS THIS?   Value
 *                                       provenance. `'cee'` means a producer
 *                                       supplied the figure. It is a claim
 *                                       about the NUMBER'S AUTHOR.
 *
 *   `strengthIsHumanSettled(data)`      HAS A HUMAN SETTLED IT?  Adjudication.
 *                                       It is a claim about a PERSON'S ACT,
 *                                       and it is what any sentence of the
 *                                       form "nobody has set this" must
 *                                       consume.
 *
 * ⛔ THE DIVERGENCE THAT MADE THIS NECESSARY, render-witnessed on PR #1174
 * (3 Sep 2026). `ModelTabBody.handleResolveContested`'s `accepted_pass2` branch
 * stamps `weightSource: 'cee'` DELIBERATELY AND CORRECTLY — the accepted value
 * genuinely is the producer's pass-2 mean, and routing it through `setStrength`
 * would be "provenance laundering" (that handler's own words). So an edge a
 * user explicitly adjudicated via `ContestedEdgeCard`'s "Accept review" reads
 * `weightSource !== 'user'` FOREVER. A card reading that field and printing
 * *"Nobody has set the strength of this connection"* tells the user who
 * adjudicated it that nobody did, and invites them to do it again.
 *
 * The remedy is NOT to widen `weightSource`, and NOT to have each surface
 * consult a second field beside it. It is ONE admission, here, that every
 * surface making the human-action claim consumes — so the sentence is true by
 * construction rather than by two readers happening to agree today.
 *
 * ── WHY NOT `resolved_by === 'user'`, THE OBVIOUS ONE-FIELD ANSWER ──────────
 * Because it is TOO WIDE, and its width is invisible.
 * `handleResolveContested` sets `resolved_by: 'user'` on ALL FOUR actions,
 * including `dismissed` — which `types/validation.ts` defines as *"user chose
 * not to engage"*. A dismissal is the user DECLINING to settle the strength;
 * reading it as settlement would suppress the very invitation the dismissal
 * left open. The discriminating field is `user_action`, and `resolved_by` is
 * required alongside it so that an action stamped by something other than a
 * person cannot claim a person's act.
 *
 * ── THE CLASSIFICATION FAILS LOUD, IT IS NOT A MIRROR (trap 12) ─────────────
 * `STRENGTH_SETTLED_BY_ACTION` is typed `Record<UserAction, boolean>`. Adding a
 * member to `UserAction` therefore FAILS TYPECHECK until it is classified here
 * — the compiler is the completeness check, so this list cannot silently go
 * short the way a hand-kept array would.
 */

import type { UserAction } from '../../types/validation'
import { edgeValueSource } from './edgeValueProvenance'

/**
 * Which resolutions of a contested edge mean a human has taken responsibility
 * for its strength.
 *
 * ⚠ EXHAUSTIVE BY TYPE, NOT BY DISCIPLINE. See the module header: the `Record`
 * is what makes a new `UserAction` a compile error rather than a silent `false`.
 */
const STRENGTH_SETTLED_BY_ACTION: Record<UserAction, boolean> = {
  /** Not yet resolved — the invitation stands. */
  pending: false,
  /** Kept the original value. A choice to keep IS a choice. */
  accepted_pass1: true,
  /** Switched to the reviewer's value. Explicit adjudication. */
  accepted_pass2: true,
  /** Entered their own number. Also stamps `weightSource: 'user'`. */
  overridden: true,
  /**
   * ⛔ FALSE, AND THIS IS THE ROW THAT PROVES THE PREDICATE IS NOT JUST
   * READING `resolved_by`. `types/validation.ts`: *"user chose not to
   * engage"*. Declining to settle a strength is not settling it, and the card
   * must keep offering.
   */
  dismissed: false,
}

/** Structural, unknown-safe read of the two validation fields this consumes. */
function readSettlementFields(
  data: Record<string, unknown>,
): { action: UserAction | null; resolvedByUser: boolean } {
  const validation = data.validation
  if (validation === null || typeof validation !== 'object' || Array.isArray(validation)) {
    return { action: null, resolvedByUser: false }
  }
  const vm = validation as Record<string, unknown>
  const rawAction = vm.user_action
  const action =
    typeof rawAction === 'string' && rawAction in STRENGTH_SETTLED_BY_ACTION
      ? (rawAction as UserAction)
      : null
  return { action, resolvedByUser: vm.resolved_by === 'user' }
}

/**
 * THE ONE ADMISSION. `true` exactly when a person has taken responsibility for
 * this edge's strength — by stating the number, by reviewing it, or by
 * adjudicating a contested estimate.
 *
 * ⚠ ABSENCE-SAFE IN THE HONEST DIRECTION. Every unknown shape returns `false`,
 * so the failure mode of a payload this cannot read is the product KEEPING its
 * invitation open, never claiming a settlement that did not happen.
 */
export function strengthIsHumanSettled(
  data: Record<string, unknown> | undefined | null,
): boolean {
  if (!data) return false

  // The person typed or dragged the number themselves. `edgeValueSource` — not
  // a raw `data.weightSource` read — so the back-compat rules stay in one place.
  if (edgeValueSource(data, 'weight') === 'user') return true

  // The pre-analysis panel's explicit review marker (`PreAnalysisPanel`,
  // `isReviewedByUser`). It writes `weightSource: 'user'` in the same update
  // today, so this arm is belt-and-braces — but the two are independent facts
  // and a future writer of one without the other must land on `true`.
  if (data.userReviewedStrength === true) return true

  // The contested-edge adjudication channel.
  const { action, resolvedByUser } = readSettlementFields(data)
  return action !== null && resolvedByUser && STRENGTH_SETTLED_BY_ACTION[action]
}
