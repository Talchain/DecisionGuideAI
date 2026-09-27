/**
 * ⭐ HOW WIDE A DRIVER CAPTION IS — without a layout engine (jsdom has none).
 *
 * jsdom reports `scrollWidth` and `clientWidth` as 0, so a spec cannot ask a
 * rendered caption whether it truncates. This helper answers the same question
 * from MEASURED glyph advances: Inter Regular (the app's `font-sans`) at 11px
 * (`typography.edgeLabel`), read with `measureText` in Playwright Chromium on
 * 27 Sep 2026 from a local copy of the font — three Inter builds agreed to
 * 0.1px. The numbers came from the browser, not from the author's head.
 *
 * ⚠ CONSERVATIVE BY CONSTRUCTION. Summing single-glyph advances ignores
 * kerning, and Inter's kerning only ever TIGHTENED these strings: the sum ran
 * 0.22–0.47px wider than Chromium's kerned width on every caption measured
 * (`MEASURED_KERNED_11PX`, pinned in `FactorDriverLine.landingFit.spec.tsx`).
 * A glyph the table lacks THROWS — new copy must be measured, never guessed.
 *
 * CLAIM SCOPE: a width budget for one font at one weight. It is not a
 * rendering; the browser measurement (`driverfit.mjs`, see the spec header)
 * is the evidence, and this is the guard that keeps the copy inside it.
 */
import { REPEATED_CARD_W, NODE_CARD_PADDING_X } from '../../../utils/nodeLayoutConstants'
import { CANVAS_CARD_FRAME_PX } from '../../shared/canvasGlyphScale'

/** Inter Regular advance widths at 11px, CSS px (Chromium `measureText`). */
export const INTER_REGULAR_ADVANCE_11PX: Readonly<Record<string, number>> = {
  ' ': 3.094, '·': 3.031,
  '1': 5.109, '2': 6.656, '3': 7, '5': 6.688, '6': 6.859,
  D: 7.906, L: 6.188,
  a: 6.203, d: 6.828, e: 6.406, f: 3.969, h: 6.5, i: 2.609, k: 5.984, l: 2.609,
  n: 6.438, o: 6.563, r: 4.094, s: 5.75, t: 4, u: 6.391, v: 6.125, y: 6.125,
}

/** Chromium's kerned widths at 11px for the same font — the table's calibration. */
export const MEASURED_KERNED_11PX: ReadonlyArray<readonly [string, number]> = [
  ['Driver 1 of 3 ranked in this run', 155.97],
  ['Driver 3 of 3 ranked in this run', 157.86],
  ['Last run · Driver 1 of 3 ranked', 153.11],
  ['Last run · Driver 3 of 3 ranked', 155],
  ['Last run · Driver 1 of 6 analysed', 163.83],
]

/** The caption's width in card px at label scale `scale` (an upper bound; see above). */
export function captionWidthPx(text: string, scale = 1): number {
  let w = 0
  for (const ch of text) {
    const a = INTER_REGULAR_ADVANCE_11PX[ch]
    if (a === undefined) throw new Error(`no measured Inter advance for ${JSON.stringify(ch)} — measure it in Chromium first`)
    w += a
  }
  return w * scale
}

/**
 * BaseNode's `padAdj` on a card that NEEDS INPUT: its `legacyBorderPx` is 2, so
 * each side's 12px padding becomes 13px (a valued factor's 0.5 gives 11.5px).
 * A ranked factor can need input — 90b8's rank 1 does.
 */
const INCOMPLETE_PAD_ADJ_PX = 2 - 1

/**
 * The TIGHTEST factor text measure the driver slot can have: the repeated card
 * inside its 1px frame and a needs-input card's padding — 220px. Measured in
 * Chromium on Paul's MRR boards: 223px on a valued factor, 220px on 90b8's
 * needs-input rank 1 (`fac_existing_customers_grandfathered`).
 */
export const FACTOR_SLOT_MEASURE_PX =
  REPEATED_CARD_W - 2 * CANVAS_CARD_FRAME_PX - NODE_CARD_PADDING_X - 2 * INCOMPLETE_PAD_ADJ_PX

/** The contract's `.driver` gap (6px, `gap-x-1.5`) and the 30px track, which counter-scales. */
export const DRIVER_GAP_PX = 6
export const DRIVER_TRACK_W_PX = 30
