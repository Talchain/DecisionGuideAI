/**
 * `resolveSameRowRoute` — the pure geometry behind the same-row link route
 * (canvas polish #1). The rendered wiring is pinned in
 * `StyledEdge.sameRowRoute.spec.tsx`; this pins the selection rules.
 */
import { describe, it, expect } from 'vitest'
import { resolveSameRowRoute, routeBoxOf, SAME_ROW_MIN_OVERLAP, type RouteBox } from '../sameRowRoute'

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
  ])('under, %s: the midpoint of the horizontal gutter run', (_label, s, t) => {
    const route = resolveSameRowRoute(s, t, othersFor(s, t))!
    expect(route.kind).toBe('under')
    // The straight run is `... ,LOW L X2,LOW ...`, entered from `X1,LOW`.
    const m = /Q[-\d.]+,[-\d.]+ ([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/.exec(route.path)
    expect(m, `PRECONDITION: the under path has a straight gutter run — ${route.path}`).not.toBeNull()
    const [x1, y1, x2, y2] = m!.slice(1).map(Number)
    expect(y1).toBe(y2)
    expect(route.labelAnchor).not.toBeNull()
    expect(route.labelAnchor!.y).toBe(y1)
    expect(route.labelAnchor!.x).toBeCloseTo((x1 + x2) / 2, 5)
    // Below the row, never on a card.
    expect(route.labelAnchor!.y).toBeGreaterThan(s.y + s.height)
  })
})

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
