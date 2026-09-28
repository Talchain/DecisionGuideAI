/**
 * WHERE A LINK ARRIVES, AND WHERE ITS SIGN SITS — the owner's rules, and the
 * distinctness guarantee exercised rather than asserted.
 *
 * ⚠ RE-WRITTEN 28 Sep 2026 (canvas/paul-test-edges, Canvas lead's ruling on
 * Paul's two staging models). The rule this file used to pin — every link into
 * a card ending at one point, the card's signs in ONE row 19 above it
 * (contract v3.1 `renderEdges`) — is the defect that ruling replaced: six
 * arrowheads on one point at the `tech_lead` goal, and a `+` 130 flow units
 * off its own line on `pa_vs_ai`. The rules now pinned (`edgeGlyphPlacement.ts`
 * header): A — arrivals spread along the card's top in their sources' order;
 * B — each sign on its own line, just behind its own head. The boards
 * themselves are in `StyledEdge.paulTestBoards.edgeLegibility.spec.tsx`.
 *
 * ⚠ THE CORPUS INCLUDES CASES A HAND-WRITTEN ONE OMITS (trap 22): exactly equal
 * source positions, sources on the target, missing geometry, a card too narrow
 * for its group, and an exhaustive sweep of group sizes and source positions.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveArrivalSlot,
  resolveArrivalSlotOnBoard,
  arrivalSiblingsOnBoard,
  resolvePolarityGlyphOnPath,
  glyphMetricsAt,
  arrivalHeadKeepOut,
  polarityGlyphTransform,
  pointBackFromEnd,
  ARRIVAL_HEAD_MAX_FLOW,
  ARRIVAL_PITCH_FLOW,
  ARRIVAL_CARD_MARGIN_FLOW,
  ARRIVAL_TITLE_CLEARANCE_FLOW,
  GLYPH_RISE_MAX_ABOVE_CARD_FLOW,
  GLYPH_ROW_RISE_MAX_FLOW,
  GLYPH_PAINTED_BOX_FLOW,
  GLYPH_BOX_GAP_FLOW,
  type ArrivalSibling,
  type ArrivalBox,
} from '../edgeGlyphPlacement'
import { flattenSvgPath } from '../../edges/fragileCuePlacement'
import { MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from '../zoomLegibility'
import { EDGE_STROKE_WIDTH_BANDS } from '../graphDisplayCalculations'
import { edgeArrowheadSize } from '../../edges/edgePresentation'
import { kindGlyphOverhangAt, kindGlyphSizeAt, LAYOUT_LAYER_GAP, LAYOUT_PADDING_Y } from '../nodeLayoutConstants'

/** A 720-wide card (a goal) and a 248-wide one (a repeated card), both centred on x 1000. */
const WIDE = { x: 640, width: 720 }
const NARROW = { x: 876, width: 248 }
const CX = 1000

/** A source `dx` to the side of the card centre, somewhere above it. */
const src = (id: string, dx: number): ArrivalSibling => ({ id, sourceCentre: { x: CX + dx, y: 200 } })

function slots(target: { x: number; width: number }, sibs: ArrivalSibling[]) {
  return Object.fromEntries(sibs.map((s) => [s.id, resolveArrivalSlot(s.id, target, sibs)]))
}
const dxs = (target: { x: number; width: number }, sibs: ArrivalSibling[]) => sibs.map((s) => resolveArrivalSlot(s.id, target, sibs).dx)

describe('the constants are derived, never literals', () => {
  it('the widest head at the bound, the pitch, the margin, the title clearance', () => {
    expect(ARRIVAL_HEAD_MAX_FLOW).toBe(edgeArrowheadSize(Math.max(...Object.values(EDGE_STROKE_WIDTH_BANDS))) * MAX_GLYPH_COUNTER_SCALE)
    expect(ARRIVAL_HEAD_MAX_FLOW).toBe(40)
    // Two widest heads a mark gap apart; a border head a mark gap off the kind shape.
    expect(ARRIVAL_PITCH_FLOW).toBeGreaterThanOrEqual(ARRIVAL_HEAD_MAX_FLOW + GLYPH_BOX_GAP_FLOW)
    expect(ARRIVAL_PITCH_FLOW).toBeGreaterThanOrEqual(kindGlyphSizeAt(MAX_LABEL_COUNTER_SCALE) / 2 + ARRIVAL_HEAD_MAX_FLOW / 2 + GLYPH_BOX_GAP_FLOW)
    expect(ARRIVAL_PITCH_FLOW).toBe(44)
    expect(ARRIVAL_CARD_MARGIN_FLOW).toBe(20)
    expect(ARRIVAL_TITLE_CLEARANCE_FLOW).toBe(24)
  })

  it('the rise bound: the visible gap less half a box and the mark gap above the card (50); less the kind overhang above the apex (22.64)', () => {
    expect(GLYPH_RISE_MAX_ABOVE_CARD_FLOW).toBe(LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y - GLYPH_PAINTED_BOX_FLOW / 2 - GLYPH_BOX_GAP_FLOW)
    expect(GLYPH_RISE_MAX_ABOVE_CARD_FLOW).toBe(50)
    expect(GLYPH_ROW_RISE_MAX_FLOW).toBeCloseTo(GLYPH_RISE_MAX_ABOVE_CARD_FLOW - kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE), 10)
    expect(GLYPH_ROW_RISE_MAX_FLOW).toBeCloseTo(22.64, 10)
  })
})

describe('A — arrivals', () => {
  it('ONE link keeps the kind apex', () => {
    expect(resolveArrivalSlot('a', WIDE, [src('a', -300)])).toEqual({ dx: 0, onKindShape: true })
    expect(resolveArrivalSlot('a', NARROW, [{ id: 'a', sourceCentre: null }])).toEqual({ dx: 0, onKindShape: true })
  })

  it('several: each as near below its own source as the card allows, in source order', () => {
    const o = slots(WIDE, [src('r', 250), src('l', -200)])
    expect(o.l).toEqual({ dx: -200, onKindShape: false })
    expect(o.r).toEqual({ dx: 250, onKindShape: false })
  })

  it('ordered by where each source sits, not by id', () => {
    const o = slots(WIDE, [src('z-left', -300), src('m-mid', -290), src('a-right', 300)])
    expect(o['z-left'].dx).toBeLessThan(o['m-mid'].dx)
    expect(o['m-mid'].dx).toBeLessThan(o['a-right'].dx)
  })

  it('neighbours at least a pitch apart; a source far outside the card clamps to its usable end', () => {
    const o = slots(WIDE, [src('a', -900), src('b', -890), src('c', -880)])
    const lo = -(WIDE.width / 2 - ARRIVAL_CARD_MARGIN_FLOW)
    expect(o.a.dx).toBeCloseTo(lo, 9)
    expect(o.b.dx - o.a.dx).toBeGreaterThanOrEqual(ARRIVAL_PITCH_FLOW - 1e-9)
    expect(o.c.dx - o.b.dx).toBeGreaterThanOrEqual(ARRIVAL_PITCH_FLOW - 1e-9)
  })

  it('THE KIND COLUMN: at most one link within a pitch of the centre, and it is ON the apex', () => {
    const o = slots(WIDE, [src('a', -10), src('b', 5), src('c', 20)])
    const inColumn = Object.values(o).filter((s) => Math.abs(s.dx) < ARRIVAL_PITCH_FLOW)
    expect(inColumn).toEqual([{ dx: 0, onKindShape: true }])
    expect(o.b).toEqual({ dx: 0, onKindShape: true })
    expect(o.a.dx).toBeLessThanOrEqual(-ARRIVAL_PITCH_FLOW)
    expect(o.c.dx).toBeGreaterThanOrEqual(ARRIVAL_PITCH_FLOW)
  })

  it('every slot stays inside the card less the margin', () => {
    for (const target of [WIDE, NARROW]) {
      const sibs = [src('a', -2000), src('b', -5), src('c', 5), src('d', 2000)]
      for (const dx of dxs(target, sibs)) {
        expect(Math.abs(dx)).toBeLessThanOrEqual(target.width / 2 - ARRIVAL_CARD_MARGIN_FLOW + 1e-9)
      }
    }
  })

  it('STATED LIMIT: a group too wide for its card is spread evenly across it — distinct, in order, heads may touch', () => {
    const sibs = Array.from({ length: 8 }, (_, k) => src(`e-${k}`, -300 + k * 80))
    const xs = dxs(NARROW, sibs)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    expect(xs[1] - xs[0]).toBeLessThan(ARRIVAL_PITCH_FLOW)
  })
})

describe('A — the distinctness guarantee', () => {
  const key = (s: { dx: number; onKindShape: boolean }) => `${Math.round(s.dx * 1e6) / 1e6}|${s.onKindShape}`
  const expectAllDistinct = (target: { x: number; width: number }, sibs: ArrivalSibling[], why: string) => {
    const ks = sibs.map((s) => key(resolveArrivalSlot(s.id, target, sibs)))
    expect(new Set(ks).size, `${why} — ${ks.join(' | ')}`).toBe(ks.length)
  }

  it('THE DEFECT: six links into one goal get six different arrivals', () => {
    expectAllDistinct(WIDE, [src('e-13', -388), src('e-0-a', -240), src('e-20', -240), src('e-14', -92), src('e-17', 56), src('e-19', 204)], 'tech_lead goal shape')
  })

  it('EXACTLY EQUAL source positions still separate, in id order', () => {
    const sibs = [src('b', 100), src('a', 100), src('c', 100)]
    const o = slots(WIDE, sibs)
    expect(o.a.dx).toBeLessThan(o.b.dx)
    expect(o.b.dx).toBeLessThan(o.c.dx)
  })

  it('DEGRADED: no geometry at all still yields distinct slots — the symmetric ones', () => {
    const sibs = ['a', 'b', 'c', 'd'].map((id) => ({ id, sourceCentre: null }))
    expectAllDistinct(WIDE, sibs, 'all unresolvable')
    expect(dxs(WIDE, sibs)).toEqual([-88, -44, 44, 88])
  })

  it('MIXED: one unresolvable sibling degrades the WHOLE group consistently', () => {
    expectAllDistinct(WIDE, [src('a', 0), src('b', 0), { id: 'c', sourceCentre: null }, src('d', 180)], 'partially resolvable group')
  })

  it('an edge missing from its own list is placed past the listed ones, never on one of them', () => {
    const sibs = [src('a', -100), src('b', 100)]
    const listed = sibs.map((s) => key(resolveArrivalSlot(s.id, WIDE, [...sibs, { id: 'x', sourceCentre: null }])))
    const missing = key(resolveArrivalSlot('x', WIDE, sibs))
    expect(listed).not.toContain(missing)
  })

  it('ORDER-INDEPENDENT: every instance agrees whatever order the store lists edges in', () => {
    const sibs = [src('e-3', 10), src('e-1', 12), src('e-2', 200), src('e-10', 11)]
    const forward = new Map(sibs.map((s) => [s.id, key(resolveArrivalSlot(s.id, WIDE, sibs))]))
    const shuffled = [...sibs].reverse()
    for (const s of sibs) expect(key(resolveArrivalSlot(s.id, WIDE, shuffled)), s.id).toBe(forward.get(s.id))
  })

  it('EXHAUSTIVE: every group to 8, sources on a grid across and beyond both cards — distinct, ordered, a pitch apart where it fits', () => {
    for (const target of [WIDE, NARROW]) {
      for (let n = 2; n <= 8; n++) {
        for (let start = -600; start <= 600; start += 150) {
          const sibs = Array.from({ length: n }, (_, k) => src(`e-${k}`, start + ((k * 97) % 400) - 200))
          const ordered = [...sibs].sort((a, b) => a.sourceCentre!.x - b.sourceCentre!.x || (a.id < b.id ? -1 : 1))
          const xs = ordered.map((s) => resolveArrivalSlot(s.id, target, sibs).dx)
          const fits = (n - 1) * ARRIVAL_PITCH_FLOW <= target.width - 2 * ARRIVAL_CARD_MARGIN_FLOW
          for (let i = 1; i < n; i++) {
            expect(xs[i] - xs[i - 1], `w=${target.width} n=${n} start=${start}`).toBeGreaterThan(0)
            if (fits) expect(xs[i] - xs[i - 1], `w=${target.width} n=${n} start=${start}`).toBeGreaterThanOrEqual(ARRIVAL_PITCH_FLOW - 1e-9)
          }
        }
      }
    }
  })
})

describe('A — the row\'s band word takes no signed arrival', () => {
  // The word above the NARROW card's left part, over its apex (left-anchored at the board column).
  const title = { x0: NARROW.x, y0: 400, x1: NARROW.x + 150, y1: 420 }

  it('ONE link whose apex the word covers arrives just past the word, on the border', () => {
    const s = resolveArrivalSlot('a', NARROW, [src('a', 300)], title)
    expect(s.onKindShape).toBe(false)
    expect(CX + s.dx).toBeGreaterThanOrEqual(Math.min(title.x1 + ARRIVAL_TITLE_CLEARANCE_FLOW, NARROW.x + NARROW.width - ARRIVAL_CARD_MARGIN_FLOW) - 1e-9)
    // CONTRAST: without the word it keeps the apex.
    expect(resolveArrivalSlot('a', NARROW, [src('a', 300)])).toEqual({ dx: 0, onKindShape: true })
  })

  it('a word clear of the apex changes nothing', () => {
    const short = { ...title, x1: NARROW.x + 40 }
    expect(resolveArrivalSlot('a', NARROW, [src('a', 300)], short)).toEqual({ dx: 0, onKindShape: true })
  })

  it('a GROUP that does not fit the room the word leaves ignores the word (distinct slots over the whole card)', () => {
    const sibs = [src('a', -100), src('b', 0), src('c', 100)]
    const withWord = sibs.map((s) => resolveArrivalSlot(s.id, NARROW, sibs, title).dx)
    const without = sibs.map((s) => resolveArrivalSlot(s.id, NARROW, sibs).dx)
    expect(withWord).toEqual(without)
  })

  it('on the board: the word is honoured only where an arrival carries a sign', () => {
    const boxes = new Map<string, ArrivalBox>([
      ['t', { id: 't', x: NARROW.x, y: 600, width: NARROW.width, height: 100 }],
      ['s', { id: 's', x: CX + 200, y: 200, width: 248, height: 100 }],
    ])
    const edges = [{ id: 'e', source: 's', target: 't' }]
    expect(resolveArrivalSlotOnBoard('e', 't', boxes, edges, title, () => true).onKindShape).toBe(false)
    expect(resolveArrivalSlotOnBoard('e', 't', boxes, edges, title, () => false)).toEqual({ dx: 0, onKindShape: true })
  })
})

describe('A — the arrivals on a board are the TOP arrivals, by the boxes', () => {
  const boxes = new Map<string, ArrivalBox>([
    ['t', { id: 't', x: 0, y: 500, width: 720, height: 100 }],
    ['above', { id: 'above', x: 0, y: 100, width: 248, height: 100 }],
    ['rowmate', { id: 'rowmate', x: 800, y: 500, width: 248, height: 100 }],
  ])
  const edges = [
    { id: 'e-above', source: 'above', target: 't' },
    { id: 'e-rowmate', source: 'rowmate', target: 't' },
    { id: 'e-ghost', source: 'unmeasured', target: 't' },
  ]

  it('a row-mate (same-row route) takes no top slot; an unmeasured source is kept, unresolvable', () => {
    expect(arrivalSiblingsOnBoard('t', boxes, edges).map((s) => s.id)).toEqual(['e-above', 'e-ghost'])
    expect(resolveArrivalSlotOnBoard('e-rowmate', 't', boxes, edges)).toEqual({ dx: 0, onKindShape: true })
  })
})

describe('B — the sign sits on its own line, just behind its own head', () => {
  const AT_BOUND = glyphMetricsAt(EDGE_STROKE_WIDTH_BANDS.moderate, MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE)
  /** A vertical link into a card whose top is y 1000, arriving on its border. */
  const VERTICAL = flattenSvgPath('M500,600 L500,1000')!
  const onLine = (p: { x: number; y: number }, poly = VERTICAL) => {
    let best = Infinity
    for (let k = 1; k < poly.points.length; k++) {
      const a = poly.points[k - 1]
      const b = poly.points[k]
      const vx = b.x - a.x
      const vy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
      best = Math.min(best, Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy)))
    }
    return best
  }

  it('its sizes at the bound are the module\'s own conservative figures', () => {
    expect(AT_BOUND).toEqual({ headLength: edgeArrowheadSize(3) * 2, halfBox: 10, gap: 4 })
  })

  it('unobstructed: one head, one gap and half a box back from the tip, ON the line', () => {
    const g = resolvePolarityGlyphOnPath(VERTICAL, 1000, AT_BOUND)
    expect(g.clear).toBe(true)
    expect(g.setback).toBe(AT_BOUND.headLength + AT_BOUND.gap + AT_BOUND.halfBox)
    expect(g).toMatchObject({ x: 500, y: 1000 - g.setback })
  })

  it('a keep-out on the ideal spot: it slides ALONG its line to the nearest clear spot, never off it', () => {
    const ideal = resolvePolarityGlyphOnPath(VERTICAL, 1000, AT_BOUND)
    const keep = { x0: 480, y0: ideal.y - 5, x1: 520, y1: ideal.y + 5 }
    const g = resolvePolarityGlyphOnPath(VERTICAL, 1000, AT_BOUND, [keep])
    expect(g.clear).toBe(true)
    expect(onLine(g)).toBeLessThan(1e-9)
    const reach = AT_BOUND.halfBox + AT_BOUND.gap
    expect(g.y + reach <= keep.y0 || g.y - reach >= keep.y1).toBe(true)
    // …and it is the NEAREST such spot: one step nearer the ideal is not clear.
    const nearer = pointBackFromEnd(VERTICAL, g.setback + (g.setback > ideal.setback ? -2 : 2))
    expect(nearer.y + reach <= keep.y0 || nearer.y - reach >= keep.y1).toBe(false)
  })

  it('THE RISE BOUND: never higher than the bound above its card, even where the line is clear', () => {
    const tall = glyphMetricsAt(EDGE_STROKE_WIDTH_BANDS.veryStrong, MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE)
    const g = resolvePolarityGlyphOnPath(VERTICAL, 1000, tall)
    expect(1000 - g.y).toBeLessThanOrEqual(GLYPH_RISE_MAX_ABOVE_CARD_FLOW + 1e-9)
    // The ideal (40 + 4 + 10 = 54) is above the bound (50): it came down its line.
    expect(tall.headLength + tall.gap + tall.halfBox).toBeGreaterThan(GLYPH_RISE_MAX_ABOVE_CARD_FLOW)
    expect(onLine(g)).toBeLessThan(1e-9)
  })

  it('STATED LIMIT, pinned: an APEX arrival at the landing has 22.64 above its tip — the sign stays on its line and reaches into its head', () => {
    const apexTop = 1000 - kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE)
    const apexLine = flattenSvgPath(`M500,600 L500,${apexTop}`)!
    const g = resolvePolarityGlyphOnPath(apexLine, 1000, AT_BOUND)
    expect(apexTop - g.y).toBeCloseTo(GLYPH_ROW_RISE_MAX_FLOW, 1)
    expect(apexTop - g.y - AT_BOUND.halfBox).toBeLessThan(AT_BOUND.headLength)
    expect(onLine(g, apexLine)).toBeLessThan(1e-9)
  })

  it('with no clear spot it stands at the ideal spot, under the bound, on its line — and says so', () => {
    const wall = { x0: 0, y0: 0, x1: 1000, y1: 2000 }
    const g = resolvePolarityGlyphOnPath(VERTICAL, 1000, AT_BOUND, [wall])
    expect(g.clear).toBe(false)
    expect(g.setback).toBe(AT_BOUND.headLength + AT_BOUND.gap + AT_BOUND.halfBox)
    expect(onLine(g)).toBeLessThan(1e-9)
  })

  it('a neighbour\'s head is a keep-out: the widest head at the live scale, standing on its arrival point', () => {
    expect(arrivalHeadKeepOut({ x: 100, y: 500 }, 2)).toEqual({ x0: 80, y0: 460, x1: 120, y1: 500 })
    expect(arrivalHeadKeepOut({ x: 100, y: 500 }, 1)).toEqual({ x0: 90, y0: 480, x1: 110, y1: 500 })
  })

  it('the transform is a flow point, centred', () => {
    expect(polarityGlyphTransform(900.126, 400)).toBe('translate(-50%, -50%) translate(900.13px, 400px)')
  })
})
