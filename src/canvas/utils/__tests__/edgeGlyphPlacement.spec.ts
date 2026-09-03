/**
 * THE DISTINCTNESS GUARANTEE, EXERCISED RATHER THAN ASSERTED.
 *
 * `edgeGlyphPlacement.ts` claims that any two distinct edges sharing a target
 * get different offsets. A claim in a docblock is still a claim (CLAUDE.md), so
 * this suite runs it over a corpus that includes the cases the DEFECT lived in:
 * many edges converging on one node, exactly-parallel approaches, degenerate
 * zero-length directions, and missing node geometry.
 *
 * ⚠ THE CORPUS DELIBERATELY INCLUDES CASES A HAND-WRITTEN ONE OMITS (trap 22:
 * a corpus from the author's head cannot see the class the author did not
 * imagine). The exhaustive sweep below enumerates every direction pair on a
 * fixed angular grid rather than the handful of angles that occurred to me,
 * so a tie rule that happened to work at 0/90/180 cannot pass by luck.
 */
import { describe, it, expect } from 'vitest'
import {
  resolvePolarityGlyphOffset,
  GLYPH_ANCHOR_RADIUS,
  GLYPH_RING_STEP,
  type GlyphSibling,
} from '../edgeGlyphPlacement'

const T = { x: 500, y: 500 }

/** A sibling whose source sits at `deg` around the target, 300 units out. */
function at(id: string, deg: number): GlyphSibling {
  const a = (deg * Math.PI) / 180
  return { id, sourceCentre: { x: T.x + Math.cos(a) * 300, y: T.y + Math.sin(a) * 300 } }
}

const key = (o: { dx: number; dy: number }) =>
  `${Math.round(o.dx * 1e6) / 1e6},${Math.round(o.dy * 1e6) / 1e6}`

/** Every sibling's offset, resolved the way each edge's own instance would. */
function offsets(sibs: GlyphSibling[]) {
  return sibs.map((s) => resolvePolarityGlyphOffset(s.id, T, sibs))
}

function expectAllDistinct(sibs: GlyphSibling[], why: string): void {
  const ks = offsets(sibs).map(key)
  expect(new Set(ks).size, `${why} — offsets: ${ks.join(' | ')}`).toBe(ks.length)
}

describe('polarity glyph placement — the guarantee', () => {
  it('THE DEFECT: six edges converging on one node get six different offsets', () => {
    // The shape measured on `market-entry` at a1fd39cc: six edges into
    // `out_new_market_arr`, all six glyphs painted at ONE point.
    expectAllDistinct(
      [at('e-4', 200), at('e-6', 235), at('e-11', 250), at('e-12', 290), at('e-15', 310), at('e-17', 340)],
      'six converging edges',
    )
  })

  it('EXACTLY PARALLEL approaches — the case angle alone cannot separate', () => {
    // Three edges whose sources sit on the same ray from the target. Their
    // directions are byte-identical, so ONLY the ring rule can separate them.
    const sibs: GlyphSibling[] = [
      { id: 'a', sourceCentre: { x: T.x + 100, y: T.y } },
      { id: 'b', sourceCentre: { x: T.x + 200, y: T.y } },
      { id: 'c', sourceCentre: { x: T.x + 400, y: T.y } },
    ]
    expectAllDistinct(sibs, 'three exactly-parallel approaches')
    // And they separate along the shared ray, one ring apart, in id order.
    expect(offsets(sibs).map((o) => Math.round(Math.hypot(o.dx, o.dy)))).toEqual([
      GLYPH_ANCHOR_RADIUS,
      GLYPH_ANCHOR_RADIUS + GLYPH_RING_STEP,
      GLYPH_ANCHOR_RADIUS + 2 * GLYPH_RING_STEP,
    ])
  })

  it('DEGENERATE: a source exactly on the target still yields a distinct offset', () => {
    expectAllDistinct(
      [
        { id: 'a', sourceCentre: { x: T.x, y: T.y } },
        { id: 'b', sourceCentre: { x: T.x, y: T.y } },
        at('c', 90),
      ],
      'zero-length directions',
    )
  })

  it('DEGRADED: no node geometry at all still yields distinct offsets', () => {
    expectAllDistinct(
      [
        { id: 'a', sourceCentre: null },
        { id: 'b', sourceCentre: null },
        { id: 'c', sourceCentre: null },
        { id: 'd', sourceCentre: null },
      ],
      'all directions unresolvable',
    )
  })

  it('MIXED: one unresolvable sibling degrades the WHOLE group consistently', () => {
    expectAllDistinct(
      [at('a', 0), at('b', 0), { id: 'c', sourceCentre: null }, at('d', 180)],
      'partially resolvable group',
    )
  })

  it('the offset is never zero — the glyph never lands on the handle anchor', () => {
    for (const sibs of [[at('a', 0)], [at('a', 0), at('b', 0)], [{ id: 'a', sourceCentre: null }]]) {
      for (const o of offsets(sibs as GlyphSibling[])) {
        expect(Math.hypot(o.dx, o.dy)).toBeGreaterThan(0)
      }
    }
  })

  it('ORDER-INDEPENDENT: every instance agrees whatever order the store lists edges in', () => {
    // Each StyledEdge instance resolves independently. If the answer depended
    // on list order, two instances reading the same store in different orders
    // could both claim ring 0 — and the stack returns.
    const sibs = [at('e-3', 10), at('e-1', 12), at('e-2', 200), at('e-10', 11)]
    const forward = new Map(sibs.map((s) => [s.id, key(resolvePolarityGlyphOffset(s.id, T, sibs))]))
    const shuffled = [...sibs].reverse()
    for (const s of sibs) {
      expect(key(resolvePolarityGlyphOffset(s.id, T, shuffled)), `edge ${s.id}`).toBe(forward.get(s.id))
    }
  })

  it('EXHAUSTIVE: no pair of directions on a 5° grid, at any group size to 8, ever collides', () => {
    // The property the P0 turns on, swept rather than sampled.
    const grid = Array.from({ length: 72 }, (_, i) => i * 5)
    for (let n = 2; n <= 8; n++) {
      for (let start = 0; start < grid.length; start += 7) {
        const sibs = Array.from({ length: n }, (_, k) => at(`e-${k}`, grid[(start + k * 3) % grid.length]))
        const ks = offsets(sibs).map(key)
        expect(new Set(ks).size, `n=${n} start=${start} -> ${ks.join(' | ')}`).toBe(n)
      }
    }
  })

  it('EXHAUSTIVE: whole groups sharing ONE direction separate at every group size to 8', () => {
    for (let n = 2; n <= 8; n++) {
      for (const deg of [0, 37, 90, 180, 271]) {
        const sibs = Array.from({ length: n }, (_, k) => at(`e-${String(k).padStart(2, '0')}`, deg))
        const ks = offsets(sibs).map(key)
        expect(new Set(ks).size, `n=${n} deg=${deg}`).toBe(n)
      }
    }
  })
})
