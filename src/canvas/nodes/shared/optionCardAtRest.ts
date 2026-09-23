/**
 * ⭐ D2 · THE OPTION CARD AT REST — locked Experience Design, Paul-approved
 * 23 Sep 2026. Supersedes the one-row draft of #1888 (22 Sep), whose selection
 * mechanism and row-choice rule this keeps; the budget moves from ONE row to
 * TWO and the rows become a two-column grid.
 *
 * ── WHAT THE CARD LEADS WITH ───────────────────────────────────────────────
 *
 * What the option CHANGES: its structured deltas, as a compact grid of
 * `label | from → to`, one grid row per target. At most
 * `OPTION_CARD_AT_REST_ROWS` rows at rest, then a `+N more` control that opens
 * — and pins — the card's EXISTING preview (`NodePopover`), which carries the
 * full list under full labels. Above the rows, the reference they are measured
 * against, cut to one line (`compactReferenceLine`).
 *
 * What stays exactly as it was: the differentiator sentence (Paul 10 Sep,
 * "both stay"; confirmed 23 Sep), the `N factor targets` route (#1873) and the
 * question chip with their gates, every post-analysis row with its gate, the
 * baseline card (it has no deltas), and the Detailed view (every row).
 *
 * ── WHICH ROWS ─────────────────────────────────────────────────────────────
 *
 * #1888's rule: the differentiator's factor first, when it has a row —
 * `computeAllDifferentiators` already picks, per option, the factor whose
 * target sits furthest from the other options', which is the comparison a row
 * of options invites — then the list's own order. The kept rows RENDER in the
 * list's order, so the card shows a subsequence of the preview's list rather
 * than a second ordering of it.
 *
 * ⚠ THE FALLBACK IS THE LIST'S ORDER, AND THAT IS NOT A DISTINCTIVENESS
 * JUDGEMENT. `allInterventionChips` sorts by |target value|, so with no
 * differentiator the kept rows are the two largest targets. Said here rather
 * than dressed up.
 *
 * ── WHY SELECTION DOES NOT GROW THE CARD ───────────────────────────────────
 *
 * `useMeasureThenLayout` re-runs `applyLayout` when any card grows more than
 * `HEIGHT_GROWTH_TOLERANCE_PX` past the height recorded at the last layout,
 * and it corrects on GROWTH only — so a card that expanded on select would
 * re-lay out the whole board on the first click and keep the option row
 * reserved at the expanded height for good. The card's box is therefore the
 * same pinned or not; the rest of the list rides the preview, which is
 * portalled and tracks the card. No new overlay layer: `OptionNode` argues
 * against minting one and names the preview as this card's recovery surface.
 *
 * ── ONE LINE PER TARGET, AND WHERE THAT STOPS BEING TRUE ───────────────────
 *
 * Each target is ONE grid row: the label cell and the value cell sit side by
 * side. The LABEL is cut in JavaScript to half a row (`OPTION_DELTA_LABEL_MAX_CHARS`)
 * — never by CSS, because a CSS ellipsis inside a canvas node REDs
 * `nodeTextClipping.visual.spec.ts` — and its full name rides the row's
 * `title` and the preview. The VALUE is never cut: it is the pair the shared
 * formatter (or CEE) produced, and it wraps inside its own column when it is
 * longer than the column.
 *
 * ⚠ AT THE LEGIBILITY FLOOR IT WILL WRAP. `OptionNode.tsx` records the 30 Aug
 * measurement that ruled "one line per change" unbuildable without truncating
 * values: ~19–25 characters a line at counter-scale 2. The pricing starter's
 * pairs are 19–32 characters ("Very high (0.8) → Moderate (0.4)"), so in a
 * half-row column they take two or more lines there. This module claims ONE
 * GRID ROW per target, never one visual line — a pixel height is the
 * `Canvas Browser Gate`'s to measure, and nothing here has measured one.
 *
 * ── DETAILED VIEW IS UNCHANGED ─────────────────────────────────────────────
 *
 * Detailed is the view a user chose for detail, and in it the differentiator
 * sentence is hidden (`differentiatorRenders` carries `!isDetailed`), so
 * compacting there would leave the card saying almost nothing. Every row
 * stays, in its original stacked markup.
 */
import { NODE_ROW_LABEL_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import { CANVAS_TYPE_PX } from '../../../styles/typography'
import { truncateAtWordBoundary } from '../../../utils/text'

/** How many delta rows an option card renders at rest in Standard view. */
export const OPTION_CARD_AT_REST_ROWS = 2

/**
 * The label column's character budget: half of `NODE_ROW_LABEL_MAX_CHARS`,
 * the row's measured capacity at the WORST-CASE counter-scale, so the value
 * column is left at least the other half at every zoom the product reaches.
 * Derived, so a card-width or type change moves it without anyone remembering.
 */
export const OPTION_DELTA_LABEL_MAX_CHARS = Math.floor(NODE_ROW_LABEL_MAX_CHARS / 2)

/**
 * The reference line's character budget: one whole row, re-expressed for the
 * SMALLER type it is set in (`edgeLabel`, against the `nodeLabel` the row
 * budget was measured with). Rounded down, as the row budget is: a wrap costs
 * a whole line of card height.
 */
export const OPTION_REFERENCE_LINE_MAX_CHARS = Math.floor(
  (NODE_ROW_LABEL_MAX_CHARS * CANVAS_TYPE_PX.nodeLabel) / CANVAS_TYPE_PX.edgeLabel,
)

const REFERENCE_PREFIX = 'Reference: '

/**
 * The card's one-line reference. Ellipsis-with-recovery (Paul, 29 Aug): when
 * the line is cut, `title` carries the whole sentence, and the preview states
 * it in full as well. `title` is undefined when nothing was cut, so hover
 * never merely repeats what is on screen — the rule the differentiator's
 * `title` already follows.
 */
export function compactReferenceLine(label: string): { text: string; title: string | undefined } {
  const full = `${REFERENCE_PREFIX}${label}`
  if (full.length <= OPTION_REFERENCE_LINE_MAX_CHARS) return { text: full, title: undefined }
  return {
    text: `${REFERENCE_PREFIX}${truncateAtWordBoundary(label, OPTION_REFERENCE_LINE_MAX_CHARS - REFERENCE_PREFIX.length)}`,
    title: full,
  }
}

export interface OptionCardAtRestInput {
  /** Factor ids of the delta rows the card WOULD render, in the list's order.
   *  Empty when the delta block does not render at all (baseline, no reference). */
  readonly deltaFactorIds: readonly string[]
  /** The differentiator's factor, when this card has a differentiator. */
  readonly distinctiveFactorId: string | null
  /** `viewMode === 'expert'` — the Detailed view. */
  readonly isDetailed: boolean
  /** Something asked for the full list: the card is selected, or `+N more`
   *  was pressed (`useOptionPreviewPin`). */
  readonly pinRequested: boolean
}

export interface OptionCardAtRestPlan {
  /** Factor ids whose rows render IN the card, in the list's order. */
  readonly cardRowIds: readonly string[]
  /** Rows the card is not showing — the `N` of `+N more`. */
  readonly hiddenCount: number
  /** The card dropped rows it would otherwise render. */
  readonly compacted: boolean
  /** Hold the card's preview open: asked for, AND there is something the card
   *  itself is not showing. A pin never changes `cardRowIds`. */
  readonly previewPinned: boolean
}

export function planOptionCardAtRest(input: OptionCardAtRestInput): OptionCardAtRestPlan {
  const ids = input.deltaFactorIds
  if (input.isDetailed || ids.length <= OPTION_CARD_AT_REST_ROWS) {
    return { cardRowIds: [...ids], hiddenCount: 0, compacted: false, previewPinned: false }
  }
  const lead =
    input.distinctiveFactorId !== null && ids.includes(input.distinctiveFactorId)
      ? input.distinctiveFactorId
      : ids[0]
  const kept = new Set([lead, ...ids.filter(id => id !== lead)].slice(0, OPTION_CARD_AT_REST_ROWS))
  const cardRowIds = ids.filter(id => kept.has(id))
  return {
    cardRowIds,
    hiddenCount: ids.length - cardRowIds.length,
    compacted: true,
    previewPinned: input.pinRequested,
  }
}
