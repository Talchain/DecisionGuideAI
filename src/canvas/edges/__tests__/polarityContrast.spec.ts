/**
 * E1 follow-up — the CVD validation the recolour shipped without.
 *
 * PR #282 titled itself "CVD-aware polarity edge recolour" and justified the
 * rose negative with ΔE figures (99.7 from green, 66.9 from amber, 48.4 from
 * the risk border, 27.6 for the old red). Those figures reproduce EXACTLY as
 * CIE76 in NORMAL vision — no colour-vision deficiency was simulated, and no
 * validator was ever committed, so nothing held the numbers in place.
 *
 * These pins measure what was actually claimed: separation as a dichromat sees
 * it. They exist to keep the polarity palette honest, not to re-litigate the
 * hues — the shipped values are Paul's call.
 */
import { describe, it, expect } from 'vitest'
import {
  deltaE2000,
  deltaE76,
  POLARITY_POSITIVE,
  POLARITY_NEGATIVE,
  RGB_TO_LMS,
  LMS_TO_RGB,
} from '../cvdContrast'

/** Below this, two strokes read as "more similar than different" to that viewer. */
const CLEARLY_DISTINCT = 20

describe('polarity edge colours — normal-vision ΔE (reproduces PR #282 prose)', () => {
  it('reproduces the #282 CIE76 figure for green vs the shipped rose (99.7)', () => {
    expect(deltaE76('#62B290', '#D6336C', 'normal')).toBeCloseTo(99.7, 0)
  })

  it('reproduces the #282 CIE76 figure for the old red vs the risk-node border (27.6)', () => {
    expect(deltaE76('#ef4444', '#EA7B4B', 'normal')).toBeCloseTo(27.6, 0)
  })

  it('the shipped rose does clear the risk-node border in normal vision (#282 48.4)', () => {
    expect(deltaE76('#D6336C', '#EA7B4B', 'normal')).toBeCloseTo(48.4, 0)
  })
})

describe('polarity edge colours — CVD separation (what #282 never measured)', () => {
  it("Paul's amber pair collapses under protanopia (ΔE2000 ~13.8, ΔL* ~1.8)", () => {
    // #FFA656 was Paul's original E1 ruling for negative. Under protanopia it
    // lands within ~2 L* of the green: two muddy tans of near-identical
    // lightness. Recorded, not shipped — the palette shipped rose instead.
    const d = deltaE2000('#62B290', '#FFA656', 'protan')
    expect(d).toBeCloseTo(13.8, 0)
    expect(d).toBeLessThan(CLEARLY_DISTINCT)
  })

  it('the SHIPPED rose pair collapses under deuteranopia (ΔE2000 ~11.7)', () => {
    // Deuteranopia is the most common CVD. This is the shipped palette's
    // worst case and it is worse than the amber it was chosen over.
    const d = deltaE2000('#62B290', '#D6336C', 'deutan')
    expect(d).toBeCloseTo(11.7, 0)
    expect(d).toBeLessThan(CLEARLY_DISTINCT)
  })

  it('the OLD green/red pair separated BETTER under CVD than either new pair', () => {
    // The regression is driven by lightness, not hue: the old green #a7f3d0
    // sat at L* 90.3, the new #62B290 at L* 66.9. Dichromats lean on
    // lightness, and 23 L* points of it were spent on the recolour.
    const oldWorst = Math.min(
      deltaE2000('#a7f3d0', '#ef4444', 'protan'),
      deltaE2000('#a7f3d0', '#ef4444', 'deutan'),
    )
    const shippedWorst = Math.min(
      deltaE2000('#62B290', '#D6336C', 'protan'),
      deltaE2000('#62B290', '#D6336C', 'deutan'),
    )
    expect(oldWorst).toBeCloseTo(28.3, 0)
    expect(shippedWorst).toBeCloseTo(11.7, 0)
    expect(shippedWorst).toBeLessThan(oldWorst)
  })

  it('records the worst-case ranking across both red-green deficiencies', () => {
    const worst = (a: string, b: string) =>
      Math.min(deltaE2000(a, b, 'protan'), deltaE2000(a, b, 'deutan'))
    // Amber (Paul's ruling) is marginally better worst-case than the shipped
    // rose; both sit well under the old pair. Neither clears CLEARLY_DISTINCT.
    expect(worst('#62B290', '#FFA656')).toBeCloseTo(13.8, 0)
    expect(worst('#62B290', '#D6336C')).toBeCloseTo(11.7, 0)
    expect(worst('#a7f3d0', '#ef4444')).toBeCloseTo(28.3, 0)
  })

  it('neither shipped polarity hue is safe on colour alone — the glyph is load-bearing', () => {
    // The DS a11y rule (never colour alone) is not a nicety here: at ΔE2000 12
    // the +/- glyph is the cue actually carrying polarity for a dichromat.
    const worstShipped = Math.min(
      deltaE2000(POLARITY_POSITIVE, POLARITY_NEGATIVE, 'protan'),
      deltaE2000(POLARITY_POSITIVE, POLARITY_NEGATIVE, 'deutan'),
    )
    expect(worstShipped).toBeLessThan(CLEARLY_DISTINCT)
  })
})

describe('cvdContrast validator — method sanity', () => {
  it('LMS_TO_RGB is the inverse of RGB_TO_LMS (RGB→LMS→RGB round-trips)', () => {
    // The simulation is RGB → LMS → projection → RGB, so LMS_TO_RGB must be
    // the true matrix inverse or every ΔE this module reports is biased.
    // This is not hypothetical: the first cut shipped [1][0] mistranscribed
    // as -0.011248 (true value -0.0102485335), which put ~4.9e-2 of error
    // into linear G on every round-trip and moved the headline figures by
    // 0.5–1.3 ΔE (12.2→11.7, 14.5→13.8, 29.6→28.3).
    //
    // Tolerance: the published Viénot coefficients are quoted to ~6
    // significant figures, so the product deviates from identity by ~1.4e-5,
    // not machine epsilon. 1e-4 gives 7x headroom over that quotation noise
    // while sitting 400x below the 4.4e-2 deviation of the transcription bug.
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const product =
          LMS_TO_RGB[i][0] * RGB_TO_LMS[0][j] +
          LMS_TO_RGB[i][1] * RGB_TO_LMS[1][j] +
          LMS_TO_RGB[i][2] * RGB_TO_LMS[2][j]
        expect(Math.abs(product - (i === j ? 1 : 0))).toBeLessThan(1e-4)
      }
    }
  })

  it('simulates the textbook dichromat confusions', () => {
    // Blue is untouched by red-green deficiency; identical colours are ΔE 0.
    expect(deltaE2000('#0000ff', '#0000ff', 'protan')).toBe(0)
    // Red loses far more luminance for a protan than a deutan (the defining
    // difference between the two deficiencies).
    expect(deltaE2000('#ff0000', '#000000', 'protan'))
      .toBeLessThan(deltaE2000('#ff0000', '#000000', 'deutan'))
  })

  it('is symmetric and zero on identity', () => {
    expect(deltaE2000('#62B290', '#62B290', 'normal')).toBe(0)
    expect(deltaE2000('#62B290', '#D6336C', 'deutan'))
      .toBeCloseTo(deltaE2000('#D6336C', '#62B290', 'deutan'), 6)
  })
})
