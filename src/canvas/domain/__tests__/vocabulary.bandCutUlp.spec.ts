/**
 * A CUT IS MET BY ITS OWN VALUE WRITTEN IN FLOAT (`vocabulary.ts`
 * `getCanvasStrengthBand`, 27 Sep 2026).
 *
 * CEE rescales strengths by raw float division, so Paul's MRR board
 * (`e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json`) carried "Other MRR growth
 * → MRR" at 0.39999999999999997 — one ulp under the 0.40 cut — and drew it a
 * band (and a px) thinner than the 0.4 beside it. A display-band decision only:
 * the band word, the lit band button and the stroke width read it; no stored
 * value changes. (It sat in the POM-8 placeholder spec at first; it lives here
 * so it ships with the fix it pins, which is not a POM-8 change.)
 */
import { describe, it, expect } from 'vitest'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { getCanvasStrengthBand } from '../vocabulary'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const OTHER_TO_MRR = WIRE.find((w) => w.from === 'other_mrr_growth' && w.to === 'mrr')

describe('band cuts: a strength one ulp under its cut is ON the cut (vocabulary.ts)', () => {
  it('0.39999999999999997 (Paul\'s "Other MRR growth → MRR") is Strong, like 0.4', () => {
    expect(OTHER_TO_MRR, 'other_mrr_growth → mrr is in the fixture').toBeDefined()
    const mean = (OTHER_TO_MRR!.strength as { mean: number }).mean
    expect(mean).toBe(0.39999999999999997)
    expect(mean).not.toBe(0.4) // the hazard, stated
    expect(getCanvasStrengthBand(mean).id).toBe('strong')
    expect(getCanvasStrengthBand(0.4).id).toBe('strong')
  })

  it('CONTRAST: a value genuinely under the cut stays in the band below', () => {
    expect(getCanvasStrengthBand(0.3999).id).toBe('moderate')
    expect(getCanvasStrengthBand(0.19999).id).toBe('slight')
  })
})
