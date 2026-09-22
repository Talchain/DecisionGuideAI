/**
 * ⭐ THE OPTION CARD'S AT-REST BUDGET — a DRAFT for Paul's design critique
 * (22 Sep 2026), not a ratified rule. Paul may veto it; if he does, delete this
 * module and its one call site in `OptionNode.tsx` and the card is back to
 * rendering every delta row at rest.
 *
 * ── THE PROBLEM IT ANSWERS ─────────────────────────────────────────────────
 *
 * Paul: the graph "doesn't fit on a standard laptop screen". The camera is
 * bounded — `cameraComfort.ts` records that at 1280x800 "~96px is lost whatever
 * we do" — so the remaining lever is CARD HEIGHT.
 *
 * ⚠ SCOPE OF THAT LEVER, read from the same comment rather than assumed: the
 * ~96px it records is a WIDTH loss on the two landscape starters (a 1776-unit
 * model needs 888px at zoom 0.5 against 792px of visible canvas). Card height
 * cannot recover a width overflow; it shortens the model's VERTICAL extent only.
 * Whether that moves what a 1280x800 screen shows on a given starter is a
 * geometry measurement, not something this module can claim.
 *
 * Option cards are the tallest on the board: one `<li>` per changed factor, each a label line plus a
 * from→to line that wraps ("Low (0) → Very high (1)"), up to four rows. On the
 * pricing starter every non-baseline option carries three. The rows also make
 * the cards RAGGED, which defeats reading options side by side — the one thing
 * an option row exists for.
 *
 * ── THE RULE, TAKEN FROM THE NODE DESIGN SYSTEM ────────────────────────────
 *
 * The anatomy (`output/node-design-20260916/`, Main + Option artboards): every
 * card answers *what is this · what does the model record · what is the useful
 * next step*, and "everything past this … belongs to the EXPANDED card, opened
 * deliberately". For an option the producer walk says the recorded quantity is
 * "what it sets, in the target factor's unit". So at rest the card keeps:
 *
 *   · the reference it is measured against (the artboard's "vs holding at £59" —
 *     "every comparison names the baseline it is measured against");
 *   · ONE from→to row — the change that most distinguishes this option;
 *   · the `N factor targets` line (#1873), which is BOTH the count of what it
 *     changes AND the route to editing them — untouched here;
 *   · its one question, and the differentiator sentence (Paul 10 Sep, "both
 *     stay" — this module suppresses neither).
 *
 * ── WHICH ROW IS "MOST DISTINCTIVE" ────────────────────────────────────────
 *
 * The differentiator's factor, when that factor has a row: `computeAllDifferentiators`
 * already picks, per option, the factor whose target sits furthest from the
 * other options' — which is precisely the comparison a row of options invites.
 * The row then states the CHANGE and the sentence under it states the REASON,
 * the division the 10 Sep ruling itself draws.
 *
 * ⚠ THE FALLBACK IS THE LIST'S OWN FIRST ROW, AND THAT IS NOT A DISTINCTIVENESS
 * JUDGEMENT. `allInterventionChips` sorts by |target value|, so with no
 * differentiator the kept row is the largest target, not the most distinctive
 * change. Said here rather than dressed up.
 *
 * ── WHY SELECTION DOES NOT GROW THE CARD ───────────────────────────────────
 *
 * The obvious build — render every row while the node is selected — would
 * re-lay out the whole board on the first click of every option.
 * `useMeasureThenLayout` re-runs `applyLayout` when any card grows more than
 * `HEIGHT_GROWTH_TOLERANCE_PX` past the height recorded at the last layout, and
 * it corrects on growth only, so after one click the option row is reserved at
 * the EXPANDED height and the saving is gone for good. So the card's box is the
 * same selected or not; the full list is carried by the card's existing preview
 * (`NodePopover`, portalled, tracks the card), which selection holds open. No new
 * overlay layer is minted — `OptionNode` itself argues against one and names the
 * preview as this card's compaction recovery surface.
 *
 * ── DETAILED VIEW IS UNCHANGED ─────────────────────────────────────────────
 *
 * Detailed is the view a user chose for detail, and in it the differentiator
 * sentence is hidden (`differentiatorRenders` carries `!isDetailed`), so
 * compacting there would leave the card saying almost nothing. Every row stays.
 */

/** How many delta rows an option card renders at rest in Standard view. */
export const OPTION_CARD_AT_REST_ROWS = 1

export interface OptionCardAtRestInput {
  /** Factor ids of the delta rows the card WOULD render, in the list's order.
   *  Empty when the delta block does not render at all (baseline, no reference). */
  readonly deltaFactorIds: readonly string[]
  /** The differentiator's factor, when this card has a differentiator. */
  readonly distinctiveFactorId: string | null
  /** `viewMode === 'expert'` — the Detailed view. */
  readonly isDetailed: boolean
  /** React Flow's `selected` — the user opened this card deliberately. */
  readonly selected: boolean
}

export interface OptionCardAtRestPlan {
  /** Factor ids whose rows render IN the card, in the list's order. */
  readonly cardRowIds: readonly string[]
  /** The card dropped rows it would otherwise render. */
  readonly compacted: boolean
  /** Hold the card's preview open, carrying the full list: the card is
   *  selected AND there is something the card itself is not showing. */
  readonly previewPinned: boolean
}

export function planOptionCardAtRest(input: OptionCardAtRestInput): OptionCardAtRestPlan {
  const ids = input.deltaFactorIds
  if (ids.length === 0) return { cardRowIds: [], compacted: false, previewPinned: false }
  if (input.isDetailed || ids.length <= OPTION_CARD_AT_REST_ROWS) {
    return { cardRowIds: [...ids], compacted: false, previewPinned: false }
  }
  const lead =
    input.distinctiveFactorId !== null && ids.includes(input.distinctiveFactorId)
      ? input.distinctiveFactorId
      : ids[0]
  const kept = new Set([lead, ...ids.filter(id => id !== lead)].slice(0, OPTION_CARD_AT_REST_ROWS))
  return {
    cardRowIds: ids.filter(id => kept.has(id)),
    compacted: true,
    previewPinned: input.selected,
  }
}
