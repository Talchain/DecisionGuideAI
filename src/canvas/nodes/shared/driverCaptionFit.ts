/**
 * ⭐ WHICH DRIVER CAPTION THE CARD'S ONE-LINE SLOT PRINTS — the LONGEST form that
 * fits the slot at the landing bound (Canvas owner, 27 Sep 2026, landing text
 * cap 1.36 → 1.64).
 *
 * THE DEFECT IT CLOSES. At the 1.64 bound (`MAX_LABEL_COUNTER_SCALE`, derived
 * from the 9px landing body floor) every caption the slot used to print ran past
 * the tightest factor measure (220px): the fresh "Driver N of M ranked in this
 * run" at 253.3–259.5px and the stale "Last run · Driver N of M ranked" at
 * 248.8–255.0px (every N ≤ M ≤ 3, the budget below) — so each would ellipsise
 * at landing. The owner's ruling: the resting caption shows the longest of
 *   fresh  "Driver N of M ranked in this run" → "Driver N of M ranked" → "Driver N of M"
 *   stale  "Last run · Driver N of M ranked"  → "Last run · Driver N of M"
 * that fits at the landing bound; the full sentence stays in the accessible
 * name and the hover. Every shorter form is a PREFIX of the full sentence, so
 * the visible words are still where the accessible name starts.
 *
 * WHY ONE FORM FOR EVERY CARD, CHOSEN AT THE BOUND. The choice reads the
 * TIGHTEST slot measure (a needs-input card) at the landing bound, not the live
 * zoom or the card in hand: the caption is the same words on every ranked card
 * and never changes as the camera moves, so a zoom never re-flows the slot. The
 * slot is one line and `overflow-hidden`, so nothing here can grow a card.
 *
 * THE WIDTH BUDGET IS THE ONE THE GUARD SPEC READS (`FactorDriverLine.landingFit
 * .spec.tsx`, via `__tests__/__helpers__/driverCaptionFit.ts`): Inter Regular
 * advances at 11px, measured with `measureText` in Playwright Chromium on 27 Sep
 * 2026 (three Inter builds agreed to 0.1px). Summing single-glyph advances
 * ignores kerning, which only ever TIGHTENED these strings (0.22–0.47px), so the
 * sum is an upper bound. A glyph the table lacks makes a form unmeasurable, and
 * an unmeasurable form is never assumed to fit: the shortest form is the
 * fallback, and the caption's `truncate` stays a last resort for copy nobody
 * has measured. (The guard spec's helper THROWS on such a glyph instead — new
 * copy must be measured in Chromium before it ships.)
 */
import { CANVAS_TYPE_PX } from '../../../styles/typography'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import { NODE_CARD_PADDING_X, REPEATED_CARD_W } from '../../utils/nodeLayoutConstants'
import { CANVAS_CARD_FRAME_PX } from './canvasGlyphScale'
import { DRIVER_LINE_COPY, LAST_RUN_PREFIX } from './metricVocabulary'

/** The font size the advances below were measured at, in CSS px. */
export const DRIVER_CAPTION_MEASURED_AT_PX = 11

/** Inter Regular advance widths at 11px, CSS px (Chromium `measureText`, 27 Sep 2026). */
export const INTER_REGULAR_ADVANCE_11PX: Readonly<Record<string, number>> = Object.freeze({
  ' ': 3.094, '·': 3.031,
  '1': 5.109, '2': 6.656, '3': 7, '5': 6.688, '6': 6.859,
  D: 7.906, L: 6.188,
  a: 6.203, d: 6.828, e: 6.406, f: 3.969, h: 6.5, i: 2.609, k: 5.984, l: 2.609,
  n: 6.438, o: 6.563, r: 4.094, s: 5.75, t: 4, u: 6.391, v: 6.125, y: 6.125,
})

/**
 * A caption's width in card px at label scale `scale`, at the caption's own type
 * size (`typography.edgeLabel`) — an upper bound (see above). `Infinity` when a
 * glyph has no measured advance: an unmeasured caption is never assumed to fit.
 */
export function driverCaptionWidthPx(text: string, scale = 1): number {
  let w = 0
  for (const ch of text) {
    const advance = INTER_REGULAR_ADVANCE_11PX[ch]
    if (advance === undefined) return Number.POSITIVE_INFINITY
    w += advance
  }
  return w * (CANVAS_TYPE_PX.edgeLabel / DRIVER_CAPTION_MEASURED_AT_PX) * scale
}

/**
 * BaseNode's `padAdj` on a card that NEEDS INPUT: its `legacyBorderPx` is 2, so
 * each side's 12px padding becomes 13px (a valued factor's 0.5 gives 11.5px).
 * A ranked factor can need input — Paul's MRR `90b8` rank 1 does.
 */
const NEEDS_INPUT_PAD_ADJ_PX = 2 - 1

/**
 * The TIGHTEST factor text measure the driver slot can have: the repeated card
 * inside its 1px frame and a needs-input card's padding — 220px. Measured in
 * Chromium on Paul's MRR boards: 223px on a valued factor, 220px on 90b8's
 * needs-input rank 1 (`fac_existing_customers_grandfathered`).
 */
export const FACTOR_DRIVER_SLOT_MEASURE_PX =
  REPEATED_CARD_W - 2 * CANVAS_CARD_FRAME_PX - NODE_CARD_PADDING_X - 2 * NEEDS_INPUT_PAD_ADJ_PX

/**
 * The caption the card's one-line driver slot prints, `Last run · ` included:
 * the longest `DRIVER_LINE_COPY.rankSlotForms` form whose width at `scale` fits
 * `FACTOR_DRIVER_SLOT_MEASURE_PX`, else the shortest form. `scale` defaults to
 * the landing bound; it is a parameter only so the guard spec can show the
 * choice follows the bound rather than a pinned string.
 */
export function restingDriverCaption(
  rank: { rank: number; setSize: number },
  fromLastRun = false,
  scale: number = MAX_LABEL_COUNTER_SCALE,
): string {
  const prefix = fromLastRun ? LAST_RUN_PREFIX : ''
  const forms = DRIVER_LINE_COPY.rankSlotForms(rank.rank, rank.setSize, fromLastRun).map((f) => `${prefix}${f}`)
  return forms.find((f) => driverCaptionWidthPx(f, scale) <= FACTOR_DRIVER_SLOT_MEASURE_PX) ?? forms[forms.length - 1]
}
