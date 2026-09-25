/**
 * `resolveSameRowRoute` — the pure geometry behind the same-row link route
 * (canvas polish #1). The rendered wiring is pinned in
 * `StyledEdge.sameRowRoute.spec.tsx`; this pins the selection rules.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveSameRowRoute,
  routeBoxOf,
  SAME_ROW_MIN_OVERLAP,
  UNDER_ROW_CLEARANCE,
  type RouteBox,
} from '../sameRowRoute'

const box = (id: string, x: number, y = 324, width = 248, height = 117): RouteBox => ({ id, x, y, width, height })
// A five-card row, 32-unit gutters.
const A = box('a', 0)
const B = box('b', 280)
const C = box('c', 560)
const D = box('d', 840)
const E = box('e', 1120)
const ROW = [A, B, C, D, E]
const othersFor = (s: RouteBox, t: RouteBox) => ROW.filter((n) => n !== s && n !== t)

describe('which route a same-row pair takes', () => {
  it('adjacent → side; one or more cards between → under', () => {
    expect(resolveSameRowRoute(A, B, othersFor(A, B))?.kind).toBe('side')
    expect(resolveSameRowRoute(B, A, othersFor(B, A))?.kind).toBe('side')
    expect(resolveSameRowRoute(A, C, othersFor(A, C))?.kind).toBe('under')
    expect(resolveSameRowRoute(E, A, othersFor(E, A))?.kind).toBe('under')
  })

  it('a card in ANOTHER row, or beyond the pair, does not count as between', () => {
    // Both straddle the A|B gutter (x 248..280) horizontally — only their ROW
    // keeps them out.
    const above = box('above', 140, 158)
    const below = box('below', 140, 525)
    expect(resolveSameRowRoute(A, B, [above, below, C, D, E])?.kind).toBe('side')
  })

  it('the side route stops short of the TARGET, on the face towards the source', () => {
    expect(resolveSameRowRoute(A, B, [])!.path).toBe('M248,382.5 L276,382.5')
    expect(resolveSameRowRoute(B, A, [])!.path).toBe('M280,382.5 L252,382.5')
  })

  it('two under-routes into one target from the same side neither share a lead nor stack glyphs', () => {
    const fromA = resolveSameRowRoute(A, D, othersFor(A, D))!
    const fromB = resolveSameRowRoute(B, D, othersFor(B, D))!
    expect(fromA.kind).toBe('under')
    expect(fromB.kind).toBe('under')
    expect(fromA.path).not.toBe(fromB.path)
    const dx = Math.abs(fromA.glyphX - fromB.glyphX)
    const dy = Math.abs(fromA.glyphY - fromB.glyphY)
    expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(20)
  })
})

describe('the label anchor sits ON the drawn path', () => {
  it('side: null — the caller keeps the handle midpoint, already on the connector', () => {
    expect(resolveSameRowRoute(A, B, othersFor(A, B))!.labelAnchor).toBeNull()
  })

  it.each([
    ['A → C (one card between)', A, C],
    ['A → D (two cards between)', A, D],
    ['E → A (target to the LEFT)', E, A],
  ])('under, %s: the midpoint of the arc (t = 0.5)', (_label, s, t) => {
    const route = resolveSameRowRoute(s, t, othersFor(s, t))!
    expect(route.kind).toBe('under')
    const pts = samplePath(route.path)
    expect(pts.length, `PRECONDITION: the under path parses — ${route.path}`).toBeGreaterThan(10)
    const mid = pts[Math.floor(pts.length / 2)]
    expect(route.labelAnchor).not.toBeNull()
    expect(route.labelAnchor!.x).toBeCloseTo(mid.x, 0)
    expect(route.labelAnchor!.y).toBeCloseTo(mid.y, 0)
    // Below the row, never on a card.
    expect(route.labelAnchor!.y).toBeGreaterThan(s.y + s.height)
  })
})

/**
 * ⭐ PAUL'S 25 SEP SCREENSHOT: two same-row links whose spans overlap by one card
 * (salary → capacity over admin; admin → higher-value time over capacity) drew
 * their flat gutter runs ON TOP of each other for a whole card slot, so they read
 * as one cable. Bound by edge id; the run-sharing length is measured on the
 * drawn geometry.
 */
describe('overlapping same-row spans stay individually traceable', () => {
  const OUTCOME = box('outcome', 280, 324 + 117 + 60)
  const routeOf = (s: RouteBox, t: RouteBox) => resolveSameRowRoute(s, t, [...othersFor(s, t), OUTCOME])!
  const eSalCap = routeOf(A, C) // e-sal-cap: a → c, one card (b) between
  const eDawHvt = routeOf(B, D) // e-daw-hvt: b → d, one card (c) between

  it('the two routes share less than 40 units of drawn length (a flat run shared ~220)', () => {
    expect(eSalCap.kind).toBe('under')
    expect(eDawHvt.kind).toBe('under')
    const a = samplePath(eSalCap.path)
    const b = samplePath(eDawHvt.path)
    let shared = 0
    for (let i = 1; i < a.length; i++) {
      const p = a[i]
      const near = b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 3)
      if (near) shared += Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y)
    }
    expect(shared).toBeLessThan(40)
  })

  it('each arc clears the card in the next sub-row by at least 8 units', () => {
    for (const r of [eSalCap, eDawHvt]) {
      const lowestY = Math.max(...samplePath(r.path).map((p) => p.y))
      expect(lowestY).toBeLessThanOrEqual(OUTCOME.y - 8)
    }
  })

  it('CONTRAST: the adjacent pair c → b still takes the side route', () => {
    expect(routeOf(C, B).kind).toBe('side')
  })
})

/**
 * ⭐ REVIEW 2033 (blocking): the `under` arc's cubic dips `0.75·h` below its
 * ends only AT t = 0.5. Both control points sit straight below their own
 * ends, so the curve is SHALLOWER over a between card's left and right
 * edges — when that card is taller than the ends, the arc climbs back INTO
 * it well before and after the midpoint. Six configurations from the
 * reviewer's repro: cards 260 wide, 56-unit gaps, source → between `m` →
 * target, samples across `m`'s whole x-range (not just its centre).
 */
describe('the under arc clears the WHOLE between card, not just its centre (review 2033)', () => {
  const GAP = 56
  const CARD_W = 260
  const mkCard = (id: string, x: number, height: number): RouteBox => ({ id, x, y: 0, width: CARD_W, height })

  const configs: Array<{ label: string; sh: number; mh: number; th: number; reverse?: boolean }> = [
    { label: '140/140/140', sh: 140, mh: 140, th: 140 },
    { label: '140/180/140', sh: 140, mh: 180, th: 140 },
    { label: '140/220/140', sh: 140, mh: 220, th: 140 },
    { label: '140/320/140', sh: 140, mh: 320, th: 140 },
    { label: '140/260/140, right→left', sh: 140, mh: 260, th: 140, reverse: true },
    { label: '100/220/160', sh: 100, mh: 220, th: 160 },
  ]

  it.each(configs)(
    '$label: every sample inside m\'s x-range clears m.bottom + UNDER_ROW_CLEARANCE',
    ({ sh, mh, th, reverse }) => {
      const left = mkCard('left', 0, sh)
      const m = mkCard('m', CARD_W + GAP, mh)
      const right = mkCard('right', (CARD_W + GAP) * 2, th)
      const [s, t] = reverse ? [right, left] : [left, right]
      const route = resolveSameRowRoute(s, t, [m])!
      expect(route.kind, `PRECONDITION: this is an under route — ${JSON.stringify(route)}`).toBe('under')

      const pts = samplePath(route.path, 2500)
      expect(pts.length, 'PRECONDITION: >= 2,000 sampled points').toBeGreaterThanOrEqual(2000)

      const inRange = pts.filter((p) => p.x >= m.x && p.x <= m.x + m.width)
      expect(inRange.length, "PRECONDITION: some samples fall inside m's x-range").toBeGreaterThan(0)

      const required = m.y + m.height + UNDER_ROW_CLEARANCE
      const worst = Math.min(...inRange.map((p) => p.y - required))
      for (const p of inRange) {
        expect(p.y, `x=${p.x}: worst clearance in range was ${worst.toFixed(1)}`).toBeGreaterThanOrEqual(required)
      }
    },
  )
})

/**
 * Samples an `M … L … Q … C …` path (absolute commands only) into points.
 * `curveSteps` controls the subdivisions per `C`/`Q`/`L` segment (default 40,
 * matching the original fixed resolution); pass a higher value for a
 * finer-grained clearance check across a whole segment's x-range.
 */
function samplePath(d: string, curveSteps = 40): Array<{ x: number; y: number }> {
  const cSteps = curveSteps * 2
  const tok = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g) ?? []
  const pts: Array<{ x: number; y: number }> = []
  let i = 0
  let cx = 0
  let cy = 0
  const num = () => Number(tok[i++])
  while (i < tok.length) {
    const cmd = tok[i++]
    if (cmd === 'M') {
      cx = num(); cy = num(); pts.push({ x: cx, y: cy })
    } else if (cmd === 'L') {
      const x = num(), y = num()
      for (let s = 1; s <= curveSteps; s++) pts.push({ x: cx + ((x - cx) * s) / curveSteps, y: cy + ((y - cy) * s) / curveSteps })
      cx = x; cy = y
    } else if (cmd === 'Q') {
      const x1 = num(), y1 = num(), x = num(), y = num()
      for (let s = 1; s <= curveSteps; s++) {
        const t = s / curveSteps, u = 1 - t
        pts.push({ x: u * u * cx + 2 * u * t * x1 + t * t * x, y: u * u * cy + 2 * u * t * y1 + t * t * y })
      }
      cx = x; cy = y
    } else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
      for (let s = 1; s <= cSteps; s++) {
        const t = s / cSteps, u = 1 - t
        pts.push({
          x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          y: u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        })
      }
      cx = x; cy = y
    } else {
      break
    }
  }
  return pts
}

describe('CONTRAST — not a same-row pair → null (the caller keeps its path)', () => {
  it('a card in the next row down', () => {
    expect(resolveSameRowRoute(A, box('mrr', 280, 525), [])).toBeNull()
  })

  it('a card in the row above', () => {
    expect(resolveSameRowRoute(box('mrr', 280, 525), A, [])).toBeNull()
  })

  it('a sliver of shared band below the minimum overlap', () => {
    const offset = box('offset', 280, 324 + 117 - (SAME_ROW_MIN_OVERLAP - 1))
    expect(resolveSameRowRoute(A, offset, [])).toBeNull()
  })

  it('horizontally overlapping cards', () => {
    expect(resolveSameRowRoute(A, box('overlap', 100), [])).toBeNull()
  })
})

describe('routeBoxOf — never a guessed size', () => {
  it('reads positionAbsolute over position, measured over width/height', () => {
    expect(
      routeBoxOf({
        id: 'n',
        position: { x: 1, y: 2 },
        internals: { positionAbsolute: { x: 10, y: 20 } },
        measured: { width: 30, height: 40 },
        width: 99,
        height: 99,
      }),
    ).toEqual({ id: 'n', x: 10, y: 20, width: 30, height: 40 })
  })

  it('an unmeasured node has no box', () => {
    expect(routeBoxOf({ id: 'n', position: { x: 0, y: 0 } })).toBeNull()
  })
})
