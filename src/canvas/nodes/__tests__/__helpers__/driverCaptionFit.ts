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
import {
  FACTOR_DRIVER_SLOT_MEASURE_PX,
  INTER_REGULAR_ADVANCE_11PX,
  driverCaptionWidthPx,
} from '../../shared/driverCaptionFit'

/**
 * ⭐ THE TABLE AND THE MEASURE ARE THE PRODUCT'S OWN (27 Sep 2026, landing text
 * cap). They moved to `shared/driverCaptionFit.ts` when the card started
 * CHOOSING its caption from them (`restingDriverCaption`), so the guard and the
 * product read one budget. Re-exported here under the names the specs use.
 */
export { INTER_REGULAR_ADVANCE_11PX }

/** Chromium's kerned widths at 11px for the same font — the table's calibration. */
export const MEASURED_KERNED_11PX: ReadonlyArray<readonly [string, number]> = [
  ['Driver 1 of 3 ranked in this run', 155.97],
  ['Driver 3 of 3 ranked in this run', 157.86],
  ['Last run · Driver 1 of 3 ranked', 153.11],
  ['Last run · Driver 3 of 3 ranked', 155],
  ['Last run · Driver 1 of 6 analysed', 163.83],
]

/**
 * The caption's width in card px at label scale `scale` (an upper bound; see
 * above) — the product's `driverCaptionWidthPx`, made STRICT: a glyph the table
 * lacks throws here, where the product only refuses to assume such a caption fits.
 */
export function captionWidthPx(text: string, scale = 1): number {
  for (const ch of text) {
    if (INTER_REGULAR_ADVANCE_11PX[ch] === undefined) {
      throw new Error(`no measured Inter advance for ${JSON.stringify(ch)} — measure it in Chromium first`)
    }
  }
  return driverCaptionWidthPx(text, scale)
}

/**
 * The TIGHTEST factor text measure the driver slot can have (220px, a
 * needs-input card) — the product's `FACTOR_DRIVER_SLOT_MEASURE_PX`, derived
 * there from `REPEATED_CARD_W`, the card frame and the padding.
 */
export const FACTOR_SLOT_MEASURE_PX = FACTOR_DRIVER_SLOT_MEASURE_PX

/** The contract's `.driver` gap (6px, `gap-x-1.5`) and the 30px track, which counter-scales. */
export const DRIVER_GAP_PX = 6
export const DRIVER_TRACK_W_PX = 30
