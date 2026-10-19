/**
 * "WE SET THIS TO WEAK" AND "NOBODY HAS SAID" MUST NOT DRAW THE SAME.
 *
 * THE DEFECT, MEASURED AT THE BYTES ON `be4b30b7`
 * ----------------------------------------------
 * `UNSET_EDGE_STROKE_WIDTH` was `1.5` (`graphDisplayCalculations.ts:135`) and
 * `weightMagnitudeToStrokeWidth` returns `1.5` for every `|mean| < 0.4`
 * (`:137-142`). Width is the one channel the canvas explicitly TEACHES the
 * reader to read as strength — the legend has a whole thickness key for it —
 * and on that channel an unset strength was PIXEL-IDENTICAL to a measured weak
 * one.
 *
 * The estate had already diagnosed this and declined to fix it from a lane
 * scoped elsewhere: `metricVocabulary.ts:172-183`, *"`UNSET_EDGE_STROKE_WIDTH`
 * is 1.5 — IDENTICAL to the weakest band … ⛔ DELIBERATELY NOT BUILT. Whether
 * 'unset' should be visually distinct from 'weakest' is a live product question
 * with Paul."* It is now cleared, and this spec is the answer.
 *
 * ⭐ WHY THE LEGEND'S EXISTING DEFENCE IS NOT ENOUGH — the sharpest form, and
 * the case this spec binds to. `CanvasLegendPopover.tsx:167-170` papers over the
 * collision by arguing colour discriminates: *"Thickness alone cannot tell them
 * apart — the colour does."* True in the DEFAULT view, where
 * `computeDirectionStroke` returns neutral grey on `!strength.show`
 * (`directionStroke.ts:113`). It was FALSE in the retired causal lens (18 Oct
 * 2026), whose colour read `direction` alone; width stays the discriminator
 * wherever colour answers a different question.
 *
 * WHAT THIS SPEC BINDS TO
 * -----------------------
 * The ORDERING, derived — not the literals. `UNSET_EDGE_STROKE_WIDTH` must be
 * strictly below EVERY width a measurement can produce, where "every" is
 * computed by sampling the magnitude domain rather than by mirroring the band
 * list (CLAUDE.md trap 12: a hand-copied list drifts, and the drift reads
 * green). Lower a band to 1, or raise the unset floor, and this REDs by name.
 */
import { describe, it, expect } from 'vitest'
import {
  EDGE_STROKE_WIDTH_BANDS,
  MEASURED_EDGE_STROKE_WIDTH_FLOOR,
  UNSET_EDGE_STROKE_WIDTH,
  weightMagnitudeToStrokeWidth,
} from '../../utils/graphDisplayCalculations'

/**
 * Every width a MEASUREMENT can produce, derived by sampling the whole
 * magnitude domain at a resolution finer than any band edge. Deliberately NOT
 * `Object.values(BANDS)` — that would be the same mirror one level along, and
 * would still agree with itself if a band were added and left out of the list.
 */
function measuredWidths(): number[] {
  const out = new Set<number>()
  for (let m = 0; m <= 1.0001; m += 0.005) out.add(weightMagnitudeToStrokeWidth(m))
  return [...out]
}

describe('an unset strength is not drawn as a measurement', () => {
  it('samples the magnitude domain and finds every measured band — instrument check', () => {
    const widths = measuredWidths()
    // Positive control: the sampler must actually SEE the bands, or every
    // assertion below passes by testing nothing (trap 13).
    expect(
      widths.length,
      `the magnitude sampler produced ${widths.length} distinct widths against ${Object.keys(EDGE_STROKE_WIDTH_BANDS).length} bands — it is not reaching them all, so the ordering assertions below are vacuous`,
    ).toBeGreaterThanOrEqual(Object.keys(EDGE_STROKE_WIDTH_BANDS).length)
  })

  /**
   * TWO INDEPENDENT DERIVATIONS OF THE SAME FLOOR, CROSS-CHECKED.
   *
   * `MEASURED_EDGE_STROKE_WIDTH_FLOOR` is `Math.min(...bands object)`. The
   * sampler above walks the magnitude domain through the FUNCTION. They agree
   * only while the function and the object describe the same encoding — so a
   * band added to one and not the other REDs here instead of silently widening
   * what counts as "a measurement". A guard derived from a list can only prove
   * agreement, never completeness (CLAUDE.md trap 12d); this is the agreement
   * half, and the sampling is what makes it non-circular.
   */
  it('agrees with the bands-derived floor — the function and the table describe one encoding', () => {
    expect(Math.min(...measuredWidths())).toBe(MEASURED_EDGE_STROKE_WIDTH_FLOOR)
    expect(MEASURED_EDGE_STROKE_WIDTH_FLOOR).toBe(EDGE_STROKE_WIDTH_BANDS.slight)
  })

  it('draws strictly THINNER than every width a measurement can produce', () => {
    for (const w of measuredWidths()) {
      expect(
        UNSET_EDGE_STROKE_WIDTH,
        `UNSET_EDGE_STROKE_WIDTH (${UNSET_EDGE_STROKE_WIDTH}) is not strictly below the measured width ${w}: "nobody has said" is drawn as, or thicker than, a measurement`,
      ).toBeLessThan(w)
    }
  })

  it('is distinguishable from the THINNEST measurement specifically', () => {
    // The named collision, bound by identity to the thinnest band rather than
    // to "some width": |mean| = 0.1 is a real, stated, Slight strength.
    //
    // ⚠ WAS 0.2 UNTIL 18 Sep 2026. That magnitude used to sit in the thinnest
    // band; the fourth rung cut at exactly 0.20 moved it up to *Moderate*, so
    // the old value would still have passed this test while no longer
    // exercising the band it names — a guard quietly pointed at the wrong
    // object (trap 19). Moved deliberately, not left to pass by luck.
    const thinnest = weightMagnitudeToStrokeWidth(0.1)
    expect(
      thinnest,
      'the |mean| 0.1 sample is not in the thinnest band — this test has drifted off the collision it names',
    ).toBe(MEASURED_EDGE_STROKE_WIDTH_FLOOR)
    expect(
      UNSET_EDGE_STROKE_WIDTH,
      `an unset strength and a stated slight strength (|mean| 0.1) both draw at ${thinnest}px — the reader cannot tell "we set this to slight" from "nobody has said"`,
    ).not.toBe(thinnest)
  })
})
