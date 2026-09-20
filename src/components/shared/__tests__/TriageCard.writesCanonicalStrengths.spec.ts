/**
 * ⭐⭐ A WRITING CONTROL MAY NOT HAVE A PRIVATE VOCABULARY.
 *
 * `domain/vocabulary.ts` states the rule and named this exact surface as the
 * reason: *"a divergent cut on a WRITING control does not merely mislabel, it
 * attributes a fabricated number to the user."*
 *
 * What `TriageCard`'s local table wrote, measured 18 Sep 2026:
 *
 *   label        wrote   canonical band for that number
 *   "Weak"        0.3    Moderate
 *   "Moderate"    0.7    Very strong
 *   "Strong"      1.2    Very strong — and outside |0..1| altogether
 *
 * All three mislabelled, two writing the same band, one off the scale.
 *
 * ⚠ THE ASSERTIONS BELOW ARE DERIVED FROM `CANVAS_STRENGTH_BANDS`, NOT COPIED
 * FROM IT. A spec that restated the four numbers would be a third mirror of the
 * same table and would go stale in the same way the component did. Every
 * expectation here is computed from the canonical source, so moving a canonical
 * cut moves this guard with it — and a re-introduced local table reds.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../../../canvas/domain/vocabulary'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/shared/TriageCard.tsx'), 'utf8')

describe('TriageCard writes canonical strengths', () => {
  it('⛔ it reads the canonical table — no local band list survives', () => {
    expect(SOURCE).toContain('CANVAS_STRENGTH_BANDS')
    // The exact literals that were there. A re-introduction reds here by value,
    // not by shape, so a rename cannot slip it back in.
    expect(SOURCE, 'the off-scale 1.2 is back').not.toMatch(/value:\s*1\.2/)
    expect(SOURCE, 'a hand-written band list is back').not.toMatch(/label:\s*'Weak',\s*value/)
  })

  it('⭐ every label names the band its own value falls in — the property that failed', () => {
    // This is the whole defect in one assertion, and it is computed: for each
    // pill, the word must be the word the canonical classifier gives its number.
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(
        getCanvasStrengthBand(band.midpoint).label,
        `a pill labelled "${band.label}" would write ${band.midpoint}, which the canvas calls "${getCanvasStrengthBand(band.midpoint).label}"`,
      ).toBe(band.label)
    }
  })

  it('⭐ no two pills write the same band — "Moderate" and "Strong" both wrote Very strong', () => {
    const bandsWritten = CANVAS_STRENGTH_BANDS.map(b => getCanvasStrengthBand(b.midpoint).id)
    expect(new Set(bandsWritten).size, 'two pills are indistinguishable in the model').toBe(bandsWritten.length)
  })

  it('⭐ every value a pill can write is inside the model\'s range', () => {
    // 1.2 was not merely mislabelled; canvas strengths live in |0..1| and there
    // is no room for it at all.
    for (const band of CANVAS_STRENGTH_BANDS) {
      expect(band.midpoint, `${band.label} writes ${band.midpoint}, outside |0..1|`).toBeGreaterThanOrEqual(0)
      expect(band.midpoint, `${band.label} writes ${band.midpoint}, outside |0..1|`).toBeLessThanOrEqual(1)
    }
  })

  it('⛔ the strongest band is reachable — the old row had three pills for four bands', () => {
    // Choosing a subset is how a private vocabulary starts. A user could not
    // state the strongest relationship at all.
    expect(CANVAS_STRENGTH_BANDS.length).toBe(4)
    const rendered = (SOURCE.match(/STRENGTH_BANDS\.map/g) ?? []).length
    expect(rendered, 'the pill row no longer maps the band list').toBeGreaterThan(0)
    expect(SOURCE, 'the derivation slices the table — a subset is a private vocabulary')
      .not.toMatch(/CANVAS_STRENGTH_BANDS\s*\.\s*slice/)
  })

  it('⛔ PRECONDITION: the canonical table is non-trivial, or every assertion above is vacuous', () => {
    expect(CANVAS_STRENGTH_BANDS.length).toBeGreaterThan(2)
    expect(new Set(CANVAS_STRENGTH_BANDS.map(b => b.label)).size).toBe(CANVAS_STRENGTH_BANDS.length)
    expect(new Set(CANVAS_STRENGTH_BANDS.map(b => b.midpoint)).size).toBe(CANVAS_STRENGTH_BANDS.length)
  })
})
