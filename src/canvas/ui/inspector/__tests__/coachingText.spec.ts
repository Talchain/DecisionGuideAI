/**
 * ⚠ UPDATED 15 Sep 2026 — these pinned the CLAIMS, and the claims were the defect.
 *
 * Every expectation below used to assert a sentence this file's subject had no
 * right to say: "few real-world factors have this much influence" (a claim about
 * the world), "analysis will rely heavily on this link" (a claim about the
 * engine), "a reasonable starting point" (a judgement) — each selected by a
 * threshold `coachingText.ts` invented.
 *
 * The BAND LABEL survives and is what these now assert. It labels the value under
 * the user's own hand, which is legitimate calibration; the claims attached to it
 * were not. Founder's rule, 15 Sep: the UI renders the data, it does not decide
 * what the data means.
 */
import { describe, it, expect } from 'vitest'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../../../domain/vocabulary'
import {
  getConfidenceCoaching,
  getEffectSizeCoaching,
  shouldShowInfluenceCoaching,
} from '../coachingText'

// ---------------------------------------------------------------------------
// D.2: getConfidenceCoaching
// ---------------------------------------------------------------------------
describe('getConfidenceCoaching', () => {
  it('returns danger for 0% (very low)', () => {
    const r = getConfidenceCoaching(0)
    expect(r.colorClass).toBe('text-danger')
    expect(r.text).toContain('Very low')
  })

  it('returns danger for exactly 15%', () => {
    expect(getConfidenceCoaching(0.15).colorClass).toBe('text-danger')
  })

  it('returns warning for 16% (low)', () => {
    const r = getConfidenceCoaching(0.16)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('Low confidence')
  })

  it('returns warning for exactly 39%', () => {
    expect(getConfidenceCoaching(0.39).colorClass).toBe('text-warning')
  })

  it('returns muted for 40% (moderate)', () => {
    const r = getConfidenceCoaching(0.40)
    expect(r.colorClass).toBe('text-text-light')
    expect(r.text).toContain('Moderate confidence')
  })

  it('returns muted for 50%', () => {
    expect(getConfidenceCoaching(0.5).colorClass).toBe('text-text-light')
  })

  it('returns muted for exactly 69%', () => {
    expect(getConfidenceCoaching(0.69).colorClass).toBe('text-text-light')
  })

  it('returns muted for 70% (high)', () => {
    const r = getConfidenceCoaching(0.70)
    expect(r.colorClass).toBe('text-text-light')
    expect(r.text).toContain('High confidence')
  })

  it('returns muted for 80%', () => {
    expect(getConfidenceCoaching(0.80).colorClass).toBe('text-text-light')
  })

  it('returns muted for exactly 89%', () => {
    expect(getConfidenceCoaching(0.89).colorClass).toBe('text-text-light')
  })

  it('returns warning for 90% (very high)', () => {
    const r = getConfidenceCoaching(0.90)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('consider lowering')
  })

  it('returns warning for 95%', () => {
    expect(getConfidenceCoaching(0.95).colorClass).toBe('text-warning')
  })

  it('returns warning for 100%', () => {
    expect(getConfidenceCoaching(1.0).colorClass).toBe('text-warning')
  })
})

// ---------------------------------------------------------------------------
// D.2: getEffectSizeCoaching
// ---------------------------------------------------------------------------
describe('getEffectSizeCoaching', () => {
  /**
   * ⭐⭐⭐ REWRITTEN 18 Sep 2026 — THIS BLOCK WAS PINNING A SECOND VOCABULARY.
   *
   * It asserted `Negligible / Moderate / Strong / Very strong / Near-total` at
   * cuts of 0.1 / 0.4 / 0.7 / 0.9, INCLUSIVE UPWARDS. The canonical contract
   * table (`CANVAS_STRENGTH_BANDS`) is four bands at 0.20 / 0.40 / 0.70, inclusive
   * DOWNWARDS — and `EdgePanel` renders both surfaces together, so the pills
   * and this sentence described one number side by side and disagreed. The old
   * assertions were true of the code and the code was wrong, which is exactly
   * the shape a green suite cannot see.
   *
   * ⚠ THE EXPECTATIONS ARE DERIVED FROM THE TABLE, NOT RE-TYPED (trap 12), and
   * every BOUNDARY is bound to `band.min` rather than to a literal — the two
   * cells where the old and new tables inverted were exactly the boundaries, so
   * a literal here would be the most likely thing to go quietly stale.
   */
  it('INSTRUMENT CONTROL: the table is non-empty and its words are distinct', () => {
    // An `each` over an empty or degenerate table asserts nothing (trap 13).
    expect(CANVAS_STRENGTH_BANDS.length).toBeGreaterThanOrEqual(4)
    const labels = CANVAS_STRENGTH_BANDS.map(b => b.label)
    expect(new Set(labels).size, 'two bands share a word — the assertions below cannot discriminate').toBe(labels.length)
  })

  it('names every band with the canonical word, at its own lower bound', () => {
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(
        getEffectSizeCoaching(band.min).text,
        `|v| = ${band.min} is the "${band.label}" band's own lower bound and the slider says something else`,
      ).toBe(`${band.label} effect.`)
    }
  })

  it('agrees with the band pills at every boundary — the cells that used to invert', () => {
    // ⚠ WHAT THIS DOES AND DOES NOT PROVE, stated rather than implied. The
    // pills light `getCanvasStrengthBand(|v|)`, and so — since 18 Sep — does this
    // sentence, so the two sides of the comparison share a resolver. That
    // makes this a DRIFT guard, not an independent oracle: it REDs the moment
    // anyone reintroduces a local table here (which is precisely how the
    // disagreement arose), and it is silent about whether the table's own cuts
    // are right. The cuts are the contract's; their correctness is settled
    // there, not here.
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(getEffectSizeCoaching(band.min).text).toBe(`${getCanvasStrengthBand(band.min).label} effect.`)
      const justBelow = band.min - 0.01
      expect(getEffectSizeCoaching(justBelow).text).toBe(`${getCanvasStrengthBand(justBelow).label} effect.`)
    }
  })

  it('retires the two words with no band behind them', () => {
    // "Negligible" and "Near-total" were rungs five and one of a ladder the
    // product no longer speaks. Sampled across the whole domain, not asserted
    // at one point.
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const { text } = getEffectSizeCoaching(v)
      expect(text, `|v| = ${v.toFixed(2)} still prints a retired word`).not.toContain('Negligible')
      expect(text).not.toContain('Near-total')
    }
  })

  it('reserves the warning colour for the top band, and only the top band', () => {
    const top = CANVAS_STRENGTH_BANDS[CANVAS_STRENGTH_BANDS.length - 1]
    expect(getEffectSizeCoaching(top.min).colorClass).toBe('text-warning')
    expect(getEffectSizeCoaching(1.0).colorClass).toBe('text-warning')
    for (const band of CANVAS_STRENGTH_BANDS.slice(0, -1)) {
      expect(
        getEffectSizeCoaching(band.min).colorClass,
        `the "${band.label}" band warns — the warning no longer means "this is the top of the scale"`,
      ).toBe('text-text-light')
    }
  })

  it('is total over the clamped weight domain — |weight| is capped at 2, not 1', () => {
    // UI-SEM-023 clamps to [0, 2], so a value above 1 is reachable and must
    // still name a band rather than falling off the table.
    expect(getEffectSizeCoaching(1.5).text).toBe(`${CANVAS_STRENGTH_BANDS[CANVAS_STRENGTH_BANDS.length - 1].label} effect.`)
    expect(getEffectSizeCoaching(0).text).toBe(`${CANVAS_STRENGTH_BANDS[0].label} effect.`)
  })
})

// ---------------------------------------------------------------------------
// D.3: shouldShowInfluenceCoaching
// ---------------------------------------------------------------------------
describe('shouldShowInfluenceCoaching', () => {
  it('returns true when rank=1, fragile, confidence < 0.7', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.5)).toBe(true)
  })

  it('returns true at confidence boundary 0.69', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.69)).toBe(true)
  })

  it('returns false when rank=2', () => {
    expect(shouldShowInfluenceCoaching(2, true, 0.5)).toBe(false)
  })

  it('returns false when rank=3', () => {
    expect(shouldShowInfluenceCoaching(3, true, 0.3)).toBe(false)
  })

  it('returns false when not fragile', () => {
    expect(shouldShowInfluenceCoaching(1, false, 0.5)).toBe(false)
  })

  it('returns false when confidence >= 0.7', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.7)).toBe(false)
  })

  it('returns false when confidence is null', () => {
    expect(shouldShowInfluenceCoaching(1, true, null)).toBe(false)
  })

  it('returns false when rank is null', () => {
    expect(shouldShowInfluenceCoaching(null, true, 0.5)).toBe(false)
  })

  it('returns true when confidence is 0 (valid low)', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0)).toBe(true)
  })
})
