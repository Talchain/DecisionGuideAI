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
  /**
   * ⭐⭐ THIS WAS THE SECOND COPY OF THE AGREEMENT CLAIM, AND IT CAUGHT ME.
   *
   * The comment above says this is asserted as an agreement "so the two cannot
   * drift apart independently". It did exactly that job: I moved the cliff in
   * `zoomLadder.spec.ts`, updated the copy I had found, missed this one, and CI
   * red on shard 3/4. Recorded rather than quietly patched, because the reason
   * this file exists is that one such claim in one place is not enough.
   *
   * ⛔ THE FLOOR HAS NOW MOVED, DELIBERATELY. The presentation cliff
   * (`resolveLodRung`) and the counter-scale floor (`isLodZoom`) were one number
   * answering two questions — and `fitBoundsFor('product')` parks the camera on
   * that number, so the board flipped on any nudge. They are separate now, and
   * the band between them is the margin that fix buys. See the full argument in
   * `zoomLegibility.ts` at `LOD_BODY_HIDDEN_ZOOM`.
   *
   * So this file's claim changes from "the two agree everywhere" to "this
   * component's contract is the SEPARATION, and the separation is exactly the
   * margin" — which is still a property that reds if either side moves alone.
   */
  it('`line` tracks the BODY cliff, not the legibility floor — and the gap is the margin', () => {
    // Below the cliff, and above the legibility floor, the two still agree.
    const agree = [0.1, 0.26, 0.37, LABEL_LEGIBLE_ZOOM, 0.6, 0.7139, 0.7143, 1, 4, Number.NaN]
    for (const z of agree) {
      expect(
        resolveLodRung(z) === 'line',
        `the rung and the floor predicate should still agree at zoom ${z}`,
      ).toBe(isLodZoom(z))
    }

    // ⭐ And in between they disagree ON PURPOSE: the counter-scale has stopped
    // compensating (isLodZoom true) while the card still shows its body. That
    // band IS the fix — it is the travel the founder had none of.
    for (const z of [0.38, 0.4999]) {
      expect(isLodZoom(z), `isLodZoom should be true below the legibility floor at ${z}`).toBe(true)
      expect(
        resolveLodRung(z),
        `the body must still be shown at ${z} — this is the margin the camera parks inside`,
      ).not.toBe('line')
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
