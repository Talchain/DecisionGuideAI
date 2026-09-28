/**
 * THE POLARITY-GLYPH ROW — the contract's placement, and the distinctness
 * guarantee exercised rather than asserted.
 *
 * ⭐ WHAT THE CONTRACT DRAWS, MEASURED (27 Sep 2026, not transcribed). The
 * contract (`olumi-canvas-visual-contract-v31.html`, `renderEdges`) was loaded in
 * Chromium and every `.polarity` text's `getBBox()` centre was read against its
 * own path's end point (`getPointAtLength(getTotalLength())`):
 *
 *   revenue (2 in)    −17.5, +17.5            all at −19
 *   retention (2 in)  −17.5, +17.5            all at −19
 *   loss (2 in)       −17.5, +17.5            all at −19
 *   g (3 in)          −27 (−19), +8 (−12), +27 (−19)
 *
 * So: one row 19 above the arrival point, 19 apart, centred on the arrival, and
 * nothing in the arrival column itself (the ±8 step). The one place this module
 * departs from those numbers is the ODD group's middle glyph, which the contract
 * drops to −12: at +8 across and −12 up it sits inside the arrowhead of any
 * stroke 3 or wider (the head is 4× the stroke), so here it stays IN the row.
 * The brief for this change asks for ONE row; that case is pinned below.
 *
 * ⚠ THE CORPUS INCLUDES CASES A HAND-WRITTEN ONE OMITS (trap 22): exactly equal
 * approach positions, sources on the target, missing geometry, and an
 * exhaustive sweep of group sizes and approach angles.
 */
import { describe, it, expect } from 'vitest'
import {
  resolvePolarityGlyphOffset,
  polarityGlyphTransform,
  GLYPH_ROW_RISE,
  GLYPH_ROW_PITCH,
  GLYPH_ROW_CENTRE_CLEARANCE,
  GLYPH_PAINTED_BOX_FLOW,
  GLYPH_BOX_GAP_FLOW,
  GLYPH_ROW_RISE_MAX_FLOW,
  paintedGlyphDyFlow,
  type GlyphSibling,
} from '../edgeGlyphPlacement'
import { MAX_GLYPH_COUNTER_SCALE } from '../zoomLegibility'

const T = { x: 500, y: 500 }

/** A sibling whose source sits at `deg` around the target, 300 units out. */
function at(id: string, deg: number): GlyphSibling {
  const a = (deg * Math.PI) / 180
  return { id, sourceCentre: { x: T.x + Math.cos(a) * 300, y: T.y + Math.sin(a) * 300 } }
}

/** A sibling whose source sits `dx` to the side of the target and 300 above it. */
function above(id: string, dx: number): GlyphSibling {
  return { id, sourceCentre: { x: T.x + dx, y: T.y - 300 } }
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

/** Offsets keyed by edge id — identity, never list position (trap 19). */
function byId(sibs: GlyphSibling[]): Record<string, { dx: number; dy: number }> {
  return Object.fromEntries(sibs.map((s) => [s.id, resolvePolarityGlyphOffset(s.id, T, sibs)]))
}

describe('contract v3.1: ONE row of sign glyphs above the arrival', () => {
  it('the row constants are the contract\'s measured numbers', () => {
    expect(GLYPH_ROW_RISE).toBe(19)
    expect(GLYPH_ROW_PITCH).toBe(19)
    expect(GLYPH_ROW_CENTRE_CLEARANCE).toBe(8)
  })

  it('two edges into one target sit at the contract\'s −17.5 / +17.5, 19 above the arrival', () => {
    // Bound by identity: the edge approaching from the LEFT takes the left slot.
    const o = byId([above('from-right', 240), above('from-left', -180)])
    expect(o['from-left']).toEqual({ dx: -17.5, dy: -19 })
    expect(o['from-right']).toEqual({ dx: 17.5, dy: -19 })
  })

  it('three edges sit at the contract\'s −27 / +8 / +27 — all in the ONE row', () => {
    const o = byId([above('c', 300), above('a', -300), above('b', 10)])
    expect(o.a).toEqual({ dx: -27, dy: -19 })
    // The contract drops this one to −12; the row keeps it at −19 (see header).
    expect(o.b).toEqual({ dx: 8, dy: -19 })
    expect(o.c).toEqual({ dx: 27, dy: -19 })
  })

  it('every glyph into one target shares ONE height, at every group size to 8', () => {
    for (let n = 1; n <= 8; n++) {
      const sibs = Array.from({ length: n }, (_, k) => at(`e-${k}`, 200 + k * 20))
      const dys = new Set(offsets(sibs).map((o) => o.dy))
      expect([...dys], `n=${n}`).toEqual([-GLYPH_ROW_RISE])
    }
  })

  it('neighbours are at least one pitch apart and none sits in the arrival column', () => {
    for (let n = 1; n <= 8; n++) {
      const sibs = Array.from({ length: n }, (_, k) => above(`e-${k}`, -400 + k * 110))
      const xs = offsets(sibs).map((o) => o.dx).sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1], `n=${n} gap ${i}`).toBeGreaterThanOrEqual(GLYPH_ROW_PITCH)
      }
      for (const x of xs) expect(Math.abs(x), `n=${n}`).toBeGreaterThanOrEqual(GLYPH_ROW_CENTRE_CLEARANCE)
    }
  })

  it('an even group is centred on the arrival', () => {
    for (const n of [2, 4, 6, 8]) {
      const sibs = Array.from({ length: n }, (_, k) => above(`e-${k}`, -400 + k * 110))
      const sum = offsets(sibs).reduce((s, o) => s + o.dx, 0)
      expect(sum, `n=${n}`).toBeCloseTo(0, 9)
    }
  })

  it('the row is ordered by the side each edge approaches from, not by id', () => {
    // ids deliberately in the opposite order to the approach positions.
    const o = byId([above('z-left', -300), above('m-mid', 0), above('a-right', 300)])
    expect(o['z-left'].dx).toBeLessThan(o['m-mid'].dx)
    expect(o['m-mid'].dx).toBeLessThan(o['a-right'].dx)
  })

  it('never on the card and never on the kind glyph — the whole row is above the arrival point', () => {
    // The arrival point is the kind glyph's apex; the glyph and the card hang
    // BELOW it. The glyph's painted box (≤ 12 tall at 11px) must end above it.
    for (const o of offsets([at('a', 200), at('b', 250), at('c', 300), at('d', 340)])) {
      expect(o.dy + 6).toBeLessThan(0)
    }
  })
})

describe('polarity glyph placement — the distinctness guarantee', () => {
  it('THE DEFECT: six edges converging on one node get six different offsets', () => {
    // The shape measured on `market-entry` at a1fd39cc: six edges into
    // `out_new_market_arr`, all six glyphs painted at ONE point.
    expectAllDistinct(
      [at('e-4', 200), at('e-6', 235), at('e-11', 250), at('e-12', 290), at('e-15', 310), at('e-17', 340)],
      'six converging edges',
    )
  })

  it('EXACTLY EQUAL approach positions still separate, in id order', () => {
    const sibs: GlyphSibling[] = [
      { id: 'a', sourceCentre: { x: T.x + 100, y: T.y - 50 } },
      { id: 'b', sourceCentre: { x: T.x + 100, y: T.y - 200 } },
      { id: 'c', sourceCentre: { x: T.x + 100, y: T.y - 400 } },
    ]
    expectAllDistinct(sibs, 'three sources at one x')
    expect(offsets(sibs).map((o) => o.dx)).toEqual([-27, 8, 27])
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
    const sibs = [at('e-3', 10), at('e-1', 12), at('e-2', 200), at('e-10', 11)]
    const forward = new Map(sibs.map((s) => [s.id, key(resolvePolarityGlyphOffset(s.id, T, sibs))]))
    const shuffled = [...sibs].reverse()
    for (const s of sibs) {
      expect(key(resolvePolarityGlyphOffset(s.id, T, shuffled)), `edge ${s.id}`).toBe(forward.get(s.id))
    }
  })

  it('EXHAUSTIVE: no pair of approaches on a 5° grid, at any group size to 8, ever collides', () => {
    const grid = Array.from({ length: 72 }, (_, i) => i * 5)
    for (let n = 2; n <= 8; n++) {
      for (let start = 0; start < grid.length; start += 7) {
        const sibs = Array.from({ length: n }, (_, k) => at(`e-${k}`, grid[(start + k * 3) % grid.length]))
        const ks = offsets(sibs).map(key)
        expect(new Set(ks).size, `n=${n} start=${start} -> ${ks.join(' | ')}`).toBe(n)
      }
    }
  })

  it('EXHAUSTIVE: whole groups sharing ONE approach separate at every group size to 8', () => {
    for (let n = 2; n <= 8; n++) {
      for (const deg of [0, 37, 90, 180, 271]) {
        const sibs = Array.from({ length: n }, (_, k) => at(`e-${String(k).padStart(2, '0')}`, deg))
        const ks = offsets(sibs).map(key)
        expect(new Set(ks).size, `n=${n} deg=${deg}`).toBe(n)
      }
    }
  })
})

describe('the row keeps off a keep-out box (the band title), measured at the counter-scale bound', () => {
  // The glyph's painted box at the bound, halved, plus the canvas mark gap.
  const HALF_AT_BOUND = GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW
  const clearAtBound = (o: { dx: number; dy: number }, k: { x0: number; y0: number; x1: number; y1: number }) => {
    const x = o.dx * MAX_GLYPH_COUNTER_SCALE
    const y = o.dy * MAX_GLYPH_COUNTER_SCALE
    return x + HALF_AT_BOUND <= k.x0 || x - HALF_AT_BOUND >= k.x1 || y + HALF_AT_BOUND <= k.y0 || y - HALF_AT_BOUND >= k.y1
  }

  it('shifts the WHOLE row right, slot by slot, until every glyph clears — one height, order kept, arrival column still empty', () => {
    const sibs = [above('l', -200), above('r', 200)]
    // A title box to the left of the arrival covering the left glyph at the bound.
    const keepOut = { x0: -140, y0: -60, x1: -20, y1: -20 }
    const free = byId(sibs)
    expect(clearAtBound(free.l, keepOut), 'CONTRAST: without the keep-out the left glyph IS on the title').toBe(false)
    const l = resolvePolarityGlyphOffset('l', T, sibs, keepOut)
    const r = resolvePolarityGlyphOffset('r', T, sibs, keepOut)
    expect(clearAtBound(l, keepOut) && clearAtBound(r, keepOut)).toBe(true)
    expect(l.dy).toBe(r.dy)
    expect(l.dx).toBeGreaterThan(free.l.dx)
    expect(r.dx - l.dx).toBeGreaterThanOrEqual(GLYPH_ROW_PITCH)
    for (const o of [l, r]) expect(Math.abs(o.dx)).toBeGreaterThanOrEqual(GLYPH_ROW_CENTRE_CLEARANCE)
  })

  it('leaves the row alone when nothing is in the way', () => {
    const sibs = [above('l', -200), above('r', 200)]
    const far = { x0: -2000, y0: -2000, x1: -1900, y1: -1900 }
    expect(resolvePolarityGlyphOffset('l', T, sibs, far)).toEqual(resolvePolarityGlyphOffset('l', T, sibs))
  })
})

describe('the offset is counter-scaled — the row is the contract\'s size on screen at every zoom', () => {
  // ⚠ RE-PINNED 27 Sep 2026 (code-review F1). The old string encoded the
  // defect: an UNBOUNDED rise, 19 × the counter-scale, which put the row on the
  // upper card's bottom border at the landing (the tier gap is fixed in flow
  // units). The x term is unchanged; the y term now bounds the rise at
  // `GLYPH_ROW_RISE_MAX_FLOW` (21.36 flow units). `polarityGlyphRowClearsCards.
  // guard.spec.ts` evaluates this string at the bound on the five starters.
  // ⚠ RE-PINNED 28 Sep 2026 (landing text cap 1.36 → 1.64, LAYOUT_LAYER_GAP
  // 40 → 48): the bound is DERIVED from the gap, so it moves with it —
  // 21.36 → 22.64 flow units. The derivation and the no-card guard are unchanged.
  it('multiplies the offset (never the anchor) by the glyph counter-scale, with the rise bounded to the tier gap', () => {
    expect(GLYPH_ROW_RISE_MAX_FLOW).toBeCloseTo(22.64, 10)
    expect(polarityGlyphTransform(900, 400, { dx: -17.5, dy: -19 })).toBe(
      'translate(-50%, -50%) translate(calc(900px + -17.5px * var(--canvas-glyph-scale, 1)), calc(400px + max(-19px * var(--canvas-glyph-scale, 1), -22.64px)))',
    )
  })

  it('the keep-out reads the PAINTED rise: bounded at the landing, the contract\'s 19 where it fits', () => {
    expect(paintedGlyphDyFlow(-19, MAX_GLYPH_COUNTER_SCALE)).toBeCloseTo(-GLYPH_ROW_RISE_MAX_FLOW, 10)
    expect(paintedGlyphDyFlow(-19, 1)).toBe(-19)
    // CONTRAST: a keep-out spanning only the UNBOUNDED spot (38 above the anchor
    // at the bound) no longer moves the row, because the glyph is not painted there.
    const sibs = [above('l', -200), above('r', 200)]
    const onlyUnbounded = { x0: -200, y0: -60, x1: 200, y1: -38 + 1 }
    const onlyPainted = { x0: -200, y0: -GLYPH_ROW_RISE_MAX_FLOW - 1, x1: 200, y1: -GLYPH_ROW_RISE_MAX_FLOW + 1 }
    expect(resolvePolarityGlyphOffset('l', T, sibs, onlyPainted)).not.toEqual(resolvePolarityGlyphOffset('l', T, sibs))
    expect(onlyUnbounded.y1).toBeLessThan(-GLYPH_ROW_RISE_MAX_FLOW - GLYPH_PAINTED_BOX_FLOW / 2 - GLYPH_BOX_GAP_FLOW)
    expect(resolvePolarityGlyphOffset('l', T, sibs, onlyUnbounded)).toEqual(resolvePolarityGlyphOffset('l', T, sibs))
  })
})
