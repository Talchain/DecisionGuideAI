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
 * (`directionStroke.ts:113`). **It is FALSE in the causal lens.**
 * `resolveEdgeStroke`'s `lens_causal` branch (`edgePresentation.ts:236-244`)
 * picks its colour from `direction` ALONE and never reads magnitude, while
 * `StyledEdge.tsx:1180-1184` picks width from magnitude. So in the one lens
 * whose entire purpose is strength, an edge with a stated direction and an
 * UNSET strength rendered identically — same width AND same colour — to a
 * measured weak one. Colour cannot be the discriminator there, because colour
 * is answering a different question.
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
import { resolveEdgeStroke, type EdgePresentationState } from '../edgePresentation'

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
      'the magnitude sampler produced fewer than 3 distinct widths — it is not reaching the bands, so the ordering assertions below are vacuous',
    ).toBeGreaterThanOrEqual(3)
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
    expect(MEASURED_EDGE_STROKE_WIDTH_FLOOR).toBe(EDGE_STROKE_WIDTH_BANDS.weak)
  })

  it('draws strictly THINNER than every width a measurement can produce', () => {
    for (const w of measuredWidths()) {
      expect(
        UNSET_EDGE_STROKE_WIDTH,
        `UNSET_EDGE_STROKE_WIDTH (${UNSET_EDGE_STROKE_WIDTH}) is not strictly below the measured width ${w}: "nobody has said" is drawn as, or thicker than, a measurement`,
      ).toBeLessThan(w)
    }
  })

  it('is distinguishable from the WEAKEST measurement specifically', () => {
    // The named collision, bound by identity to the weakest band rather than to
    // "some width": |mean| = 0.2 is a real, stated, weak strength.
    const weakest = weightMagnitudeToStrokeWidth(0.2)
    expect(
      UNSET_EDGE_STROKE_WIDTH,
      `an unset strength and a stated weak strength (|mean| 0.2) both draw at ${weakest}px — the reader cannot tell "we set this to weak" from "nobody has said"`,
    ).not.toBe(weakest)
  })

  it('CAUSAL LENS: the stroke rule is blind to magnitude, so width is the only discriminator', () => {
    // ⚠ NOT A SELF-COMPARISON. An earlier draft of this test resolved the SAME
    // state twice and asserted the two results equal — which is true of any
    // pure function and asserts nothing (trap 13b: a guard agreeing with
    // itself). The real claim is STRUCTURAL: the causal-lens stroke rule
    // decides colour from `direction` ALONE, so no strength difference of any
    // kind can change it. That is what makes width load-bearing here, and it is
    // pinned two ways below.
    const negative: EdgePresentationState = {
      isStructural: false,
      lensMode: 'causal',
      causalParams: { direction: 'negative' },
      evidenceClass: null,
      contested: { isContested: false, needsUserInput: false, directionDisputed: false, dash: null },
      isHighlighted: false,
      // Two DIFFERENT polarity strokes below, to prove the lens ignores them:
      // if `lens_causal` ever started falling through to polarity, these two
      // would diverge and this test REDs.
      polarityStroke: 'var(--edge-negative)',
      existenceDash: null,
      visualPropsDash: undefined,
    }
    const sameDirectionOtherPolarity: EdgePresentationState = {
      ...negative,
      polarityStroke: 'var(--edge-neutral)',
    }

    const a = resolveEdgeStroke(negative)
    const b = resolveEdgeStroke(sameDirectionOtherPolarity)
    expect(a.rule, 'the causal-lens branch did not fire — this test is not exercising the lens').toBe('lens_causal')
    expect(b.rule).toBe('lens_causal')
    expect(
      b.value,
      'the causal lens colour changed with a channel other than direction — the precondition of this test no longer holds',
    ).toBe(a.value)

    // Discrimination check: the lens DOES still distinguish the thing it claims
    // to (direction), so the equality above is not blindness.
    const positive = resolveEdgeStroke({ ...negative, causalParams: { direction: 'positive' } })
    expect(
      positive.value,
      'the causal lens returned the same colour for positive and negative — the resolver is not discriminating at all, so the equality above proves nothing',
    ).not.toBe(a.value)

    // …so colour cannot separate "nobody set a strength" from "somebody set a
    // weak one" in this lens. Width must, and now does.
    expect(
      UNSET_EDGE_STROKE_WIDTH,
      'in the causal lens an unset strength and a weak measured strength render at the same colour AND the same width — indistinguishable on the lens built to show strength',
    ).not.toBe(weightMagnitudeToStrokeWidth(0.2))
  })
})
