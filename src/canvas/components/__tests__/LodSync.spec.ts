import { describe, expect, it } from 'vitest'
import { isLodZoom, LOD_ZOOM_THRESHOLD } from '../LodSync'
import { LABEL_LEGIBLE_ZOOM, resolveLodRung } from '../../utils/zoomLegibility'

describe('isLodZoom — D2 threshold predicate', () => {
  it('activates below the threshold, not at or above it', () => {
    expect(isLodZoom(0.1)).toBe(true)
    expect(isLodZoom(LOD_ZOOM_THRESHOLD - 0.01)).toBe(true)
    expect(isLodZoom(LOD_ZOOM_THRESHOLD)).toBe(false)
    expect(isLodZoom(1)).toBe(false)
    expect(isLodZoom(4)).toBe(false)
  })

  /**
   * ⚠ THE THRESHOLD CONSTANT IS SOURCE-PINNED ELSEWHERE and stays exactly as it
   * was: `lodTitleBoostIsBounded.spec.ts:378-384` reads this file's bytes and
   * requires `LOD_ZOOM_THRESHOLD = LABEL_LEGIBLE_ZOOM`. The ladder added a
   * SECOND boundary above it; it did not move this one.
   */
  it('is still the one legibility floor, derived and not restated', () => {
    expect(LOD_ZOOM_THRESHOLD).toBe(LABEL_LEGIBLE_ZOOM)
  })
})

describe('what LodSync now writes — the rung, agreeing with the old boolean at the floor', () => {
  /**
   * `LodSync` selected `isLodZoom(transform[2])` and wrote a boolean; it now
   * selects `resolveLodRung(transform[2])` and writes a rung. The property that
   * must survive that swap is that the FLOOR has not moved — `line` is the rung
   * the old `true` named, at every zoom, including the degenerate one.
   *
   * Asserted as an AGREEMENT rather than as a list of expected rungs, so the two
   * cannot drift apart independently. (`zoomLadder.spec.ts` owns the boundary
   * pairs and the derivation of the upper threshold; this file owns the claim
   * that this component's own contract is unchanged.)
   */
  it('`line` is exactly where the old boolean was true — across the range and at NaN', () => {
    const zooms = [0.1, 0.26, 0.38, 0.4999, LABEL_LEGIBLE_ZOOM, 0.6, 0.7139, 0.7143, 1, 4, Number.NaN]
    for (const z of zooms) {
      expect(
        resolveLodRung(z) === 'line',
        `the rung and the predicate it replaced disagree at zoom ${z}`,
      ).toBe(isLodZoom(z))
    }
  })

  it('POSITIVE CONTROL — the sweep above actually exercises BOTH answers', () => {
    // An agreement assertion over a list that happens to be all-true, or all
    // -false, agrees for free (CLAUDE.md trap 13). This proves the corpus
    // straddles the floor.
    expect(resolveLodRung(0.1)).toBe('line')
    expect(resolveLodRung(1)).toBe('full')
  })
})
