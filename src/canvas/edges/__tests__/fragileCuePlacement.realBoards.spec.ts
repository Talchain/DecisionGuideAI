/**
 * ⭐ EVERY FRAGILE CUE AT ITS CONNECTION'S MIDPOINT — OR, WHERE A MARK REALLY
 * STANDS THERE, AT THE NEAREST CLEAR POINT ALONG ITS OWN PATH WITHIN A QUARTER
 * OF IT — CLEAR OF CARDS, SIGN GLYPHS AND OTHER CUES, on Paul's two real MRR
 * boards (post-run DIFF item 12, 27 Sep 2026; contract v3.1 `renderEdges`: one
 * r=8 disc per fragile connection at `(ax+bx)/2, (ay+by)/2`).
 *
 * Each board carries exactly TWO `visible: true` fragile edges (90b8: 0.696
 * and 0.2716; 17d1: 0.638 and 0.1576). The geometry is the REAL landing
 * layout of each board, captured in Chromium (`fixtures/fragileCueLanding
 * .geometry.json`, provenance inside): card boxes, the paths xyflow DREW, the
 * browser's own arc length and midpoint for each, and every sign glyph's
 * painted box. The placement pass runs on that geometry exactly as
 * `StyledEdge` runs it — the path rebuilt from the boxes with the handle
 * offsets read off one edge's own endpoints — and every claim is then checked
 * against the DRAWN path, not the rebuilt one.
 *
 * ⚠ WHAT THIS DOES NOT CLAIM. Which edges carry a cue is the budget, and it is
 * unchanged: Standard shows the single top fragile edge (Paul's 2026-07-11
 * verdict E4, a2255511 #277), and 17d1 shows none because its comparison is
 * withheld (#2218, `fragileCueNeedsAShownComparison.spec.tsx`). The pass is
 * run here over BOTH visible edges of each board so the placement is proven for
 * every cue the budget can admit (Detailed admits both), not only the one
 * Standard paints.
 *
 * CLAIM SCOPE: graph-unit geometry at the landing zoom (0.5 / 0.51) of the
 * layout at staging b40d5436 (re-captured 28 Sep 2026), with the disc at the
 * label scale the page carried (`--canvas-label-scale` 1.64).
 *
 * ⚠ 28 Sep 2026 (canvas/paul-test-edges): the capture PREDATES spread arrivals
 * and on-line signs (`edgeGlyphPlacement.ts` rules A and B). So this file
 * rebuilds the capture's OWN paths (every link to its card's apex, no arrival
 * slot) — the geometry Chromium drew and this file checks against — and hands
 * the pass the marks the way `StyledEdge` now builds them: each card's kind
 * column, and every causal link's head and sign as the last stretch of its own
 * path (`arrivalMarkBoxes`), in place of the old glyph row's span. The painted
 * glyph boxes in the capture are where the OLD row put the signs; the
 * clearance claim against them below is therefore a claim about that paint.
 * The spread-arrival geometry is proven on Paul's 28 Sep boards
 * (`StyledEdge.paulTestBoards.edgeLegibility.spec.tsx`).
 */
import { describe, it, expect } from 'vitest'
import geometry from './fixtures/fragileCueLanding.geometry.json'
import fx90b8 from '../../../../e2e/geometry/fixtures/mrr-90b8f080.fixture.json'
import fx17d1 from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import {
  arrivalMarkBoxes,
  cardEdgePathFromBoxes,
  flattenSvgPath,
  fragileCueSpotIsClear,
  pointAtFraction,
  resolveFragileCuePlacements,
  FRAGILE_CUE_DISC_PX,
  FRAGILE_CUE_MAX_SLIDE,
  FRAGILE_CUE_RADIUS_FLOW,
  type PathPolyline,
} from '../fragileCuePlacement'
import { layeredLeadPath, resolveLayeredEdgeLeads, type RouteBox } from '../sameRowRoute'
import { TIER_BY_KIND } from '../../utils/nodeLayoutConstants'
import { isGhostNode } from '../../utils/fitTargets'

type Box = { x: number; y: number; width: number; height: number }
type GeoNode = { id: string; type: string | null; hidden: boolean; box: Box; painted: Box }
type GeoEdge = { id: string; source: string; target: string; d: string; L: number; midGraph: { x: number; y: number } }
type Glyph = { edge: string; text: string; x0: number; y0: number; x1: number; y1: number }
type Board = {
  view: string
  viewport: { zoom: number; labelScale: string | null }
  nodes: GeoNode[]
  fragileEdges: GeoEdge[]
  glyphs: Glyph[]
  arrivals: Record<string, number>
}
type WireFragile = { edge_id: string; from_id: string; to_id: string; visible?: boolean; switch_probability?: number }

const BOARDS = (geometry as unknown as { boards: Record<string, Board> }).boards
const WIRE: Record<string, typeof fx90b8> = { 'mrr-90b8f080': fx90b8, 'mrr-17d1cd3a': fx17d1 as unknown as typeof fx90b8 }

const visibleFragile = (board: string): WireFragile[] =>
  ((WIRE[board].analysis_block.enrichment as unknown as { robustness: { fragile_edges: WireFragile[] } }).robustness.fragile_edges)
    .filter((f) => f.visible === true)

/** The boxes the ROUTE RESOLVERS read (store position + measured), as `StyledEdge` builds them. */
function boxesOf(b: Board) {
  const routeBoxes: RouteBox[] = []
  const tieredBoxes: Array<RouteBox & { tier: number }> = []
  for (const n of b.nodes) {
    if (n.hidden) continue
    const box = { id: n.id, ...n.box }
    routeBoxes.push(box)
    const tier = typeof n.type === 'string' ? TIER_BY_KIND[n.type as keyof typeof TIER_BY_KIND] : undefined
    if (tier !== undefined && !isGhostNode(n.id)) tieredBoxes.push({ ...box, tier })
  }
  return { routeBoxes, tieredBoxes }
}

/** Each card's kind column, as `StyledEdge` builds `rows` for the pass: no span. */
function rowsOf(routeBoxes: RouteBox[]) {
  return new Map<string, { dxMin: number; dxMax: number } | null>(routeBoxes.map((c) => [c.id, null]))
}

/**
 * Every causal link's arrival marks, as `StyledEdge` builds them — from the
 * capture's own paths (see the header): every draft link that is not
 * structural (decision → option, option → factor), rebuilt from the boxes.
 */
function marksOf(board: string, b: Board, routeBoxes: RouteBox[], tieredBoxes: Array<RouteBox & { tier: number }>, ends: { sourceDy: number; targetDy: number }) {
  const kind = new Map(b.nodes.map((n) => [n.id, n.type]))
  const draft = (WIRE[board] as unknown as { draft: { edges: Array<{ from: string; to: string }> } }).draft
  const causal = draft.edges.filter((e) => {
    const sk = kind.get(e.from)
    const tk = kind.get(e.to)
    return !((sk === 'decision' && tk === 'option') || (sk === 'option' && tk === 'factor'))
  })
  return arrivalMarkBoxes(causal.map((e) => cardEdgePathFromBoxes(e.from, e.to, routeBoxes, tieredBoxes, ends)))
}

/** The handle offsets, read off ONE edge's drawn endpoints — what `StyledEdge` reads off its own props. */
function endsFrom(e: GeoEdge, routeBoxes: RouteBox[]) {
  const poly = flattenSvgPath(e.d)!
  const start = poly.points[0]
  const end = poly.points[poly.points.length - 1]
  const src = routeBoxes.find((r) => r.id === e.source)!
  const tgt = routeBoxes.find((r) => r.id === e.target)!
  return { sourceDy: start.y - (src.y + src.height), targetDy: end.y - tgt.y }
}

const distToRect = (p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) =>
  Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.width)), Math.max(r.y - p.y, 0, p.y - (r.y + r.height)))

/**
 * Every PAINTED mark a disc of radius `r` centred at `p` touches: a card as
 * painted (on some cards the routed box is stale after the run) or a sign
 * glyph's painted box. The clearance claim and its CONTROL read this one check.
 */
function marksTouched(b: Board, p: { x: number; y: number }, r: number): string[] {
  const hits: string[] = []
  for (const n of b.nodes) if (distToRect(p, n.painted) <= r) hits.push(`card ${n.id}`)
  for (const g of b.glyphs) {
    if (distToRect(p, { x: g.x0, y: g.y0, width: g.x1 - g.x0, height: g.y1 - g.y0 }) <= r) hits.push(`glyph ${g.edge}`)
  }
  return hits
}

/**
 * Where the pass put each cue on the layout at staging b40d5436 (label scale
 * 1.64), as measured by this file's own pass on the re-captured fixture and by
 * the browser (`r3/design2/probe-mrr-*.json`: 90b8 e-6's painted disc at 0.500,
 * 0 cards / 0 glyphs touched, 5.4 px to the nearest card at landing):
 *
 *   mrr-90b8f080  e-6  (Pro plan price → MRR)                   0.50  clear
 *   mrr-90b8f080  e-10 (Monthly churn → Pro paying subscribers) 0.49  clear
 *   mrr-17d1cd3a  e-6  (Pro plan price → MRR)                   0.50  clear
 *   mrr-17d1cd3a  e-10 (Monthly churn → Pro paying subscribers) 0.50  clear
 *
 * 90b8 e-10 slides 0.01 (5.7 graph units) towards its source because a mark
 * REALLY stands at its midpoint (409.98, 1395.07): Price sensitivity's arrival
 * marks — its kind shape and the arrowhead of Pro plan price → Price
 * sensitivity, with that edge's `+` beside it — whose band (x 424.3 … 470.0,
 * y 1366.6 … 1441) is 14.3 units away, inside the disc (13.12) plus the mark
 * gap (4). The browser shows the arrowhead's left edge about 5 units from a
 * disc there (`r3/design2/e10-midpoint-vs-049-zoom.png`). That is the slide
 * rule doing its job, not the pass mis-reading the layout, so this file pins
 * the RULE (on the path, clear, within `FRAGILE_CUE_MAX_SLIDE`, and moved only
 * when the midpoint itself is blocked), not these four numbers.
 */

/** Arc-length fraction of the drawn path nearest to `p`. */
function fractionNearest(poly: PathPolyline, p: { x: number; y: number }): number {
  let best = { d: Infinity, f: 0 }
  for (let k = 0; k <= 2000; k++) {
    const q = pointAtFraction(poly, k / 2000)
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d < best.d) best = { d, f: k / 2000 }
  }
  return best.f
}

describe.each(['mrr-90b8f080', 'mrr-17d1cd3a'])('%s — the real landing layout', (board) => {
  const b = BOARDS[board]
  const { routeBoxes, tieredBoxes } = boxesOf(b)
  // The disc as painted on this page: r = 8 × the live label scale (graph units).
  const labelScale = Number(b.viewport.labelScale)
  const r = (FRAGILE_CUE_DISC_PX / 2) * labelScale
  const top = b.fragileEdges.find((e) => e.source === 'pro_plan_price' && e.target === 'mrr')!
  const ends = endsFrom(top, routeBoxes)
  const cues = b.fragileEdges.map((e) => ({ id: e.id, path: cardEdgePathFromBoxes(e.source, e.target, routeBoxes, tieredBoxes, ends) }))
  const marks = marksOf(board, b, routeBoxes, tieredBoxes, ends)
  const placed = resolveFragileCuePlacements(cues, routeBoxes, ends.targetDy, rowsOf(routeBoxes), marks)
  const drawnPoint = (e: GeoEdge) => pointAtFraction(flattenSvgPath(e.d)!, placed.get(e.id)!.fraction)

  it('PRECONDITION: exactly two visible fragile edges on the wire, each one drawn connection on the canvas', () => {
    const wire = visibleFragile(board)
    expect(wire.map((f) => f.edge_id).sort()).toEqual(['monthly_churn->pro_paying_subscribers', 'pro_plan_price->mrr'])
    expect(b.fragileEdges).toHaveLength(2)
    for (const f of wire) expect(b.fragileEdges.filter((e) => e.source === f.from_id && e.target === f.to_id)).toHaveLength(1)
    // The page painted the disc at the scale the placement's bound allows for.
    expect(labelScale).toBeGreaterThan(1)
    expect(r).toBeLessThanOrEqual(FRAGILE_CUE_RADIUS_FLOW)
  })

  it('the pass rebuilds each DRAWN path from the boxes: same length and same midpoint as the browser measured', () => {
    for (const e of b.fragileEdges) {
      const rebuilt = flattenSvgPath(cues.find((c) => c.id === e.id)!.path)!
      expect(Math.abs(rebuilt.length - e.L), e.id).toBeLessThan(1)
      const mid = pointAtFraction(rebuilt, 0.5)
      expect(Math.hypot(mid.x - e.midGraph.x, mid.y - e.midGraph.y), e.id).toBeLessThan(1)
    }
  })

  it('⭐ each cue sits ON its drawn path, clear, within a quarter of the midpoint — and at the midpoint unless a mark stands there', () => {
    // The pass places cues in id order, each clear of the ones placed before it.
    const before: Array<{ x: number; y: number }> = []
    for (const e of [...b.fragileEdges].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
      const p = placed.get(e.id)!
      expect(p.clear, e.id).toBe(true)
      expect(Math.abs(p.fraction - 0.5), e.id).toBeLessThanOrEqual(FRAGILE_CUE_MAX_SLIDE)
      // ON the path xyflow drew: the pass's point (on the rebuilt path) is the drawn path's point at that fraction.
      const rebuilt = flattenSvgPath(cues.find((c) => c.id === e.id)!.path)!
      const onRebuilt = pointAtFraction(rebuilt, p.fraction)
      const q = drawnPoint(e)
      expect(Math.hypot(onRebuilt.x - q.x, onRebuilt.y - q.y), e.id).toBeLessThan(0.5)
      if (p.fraction === 0.5) {
        // At the midpoint: the browser's own getPointAtLength(L/2).
        expect(Math.hypot(q.x - e.midGraph.x, q.y - e.midGraph.y), e.id).toBeLessThan(0.5)
      } else {
        // Moved only because the midpoint itself is not clear.
        expect(fragileCueSpotIsClear(pointAtFraction(rebuilt, 0.5), routeBoxes, before, ends.targetDy, rowsOf(routeBoxes), marks), e.id).toBe(false)
      }
      before.push(onRebuilt)
    }
  })

  it('⭐ and there it is clear of every card, every sign glyph and the other cue', () => {
    const points = b.fragileEdges.map((e) => ({ id: e.id, p: drawnPoint(e) }))
    for (const { id, p } of points) expect(marksTouched(b, p, r), id).toEqual([])
    const [a, c] = points
    expect(Math.hypot(a.p.x - c.p.x, a.p.y - c.p.y)).toBeGreaterThan(2 * r)
  })

  it('CONTROL — the clearance check is not blind: a cue at a departure touches its card, one at the second edge\'s arrival touches its sign glyph', () => {
    for (const e of b.fragileEdges) {
      const start = pointAtFraction(flattenSvgPath(e.d)!, 0)
      expect(marksTouched(b, start, r), `${e.id} at its departure`).toContain(`card ${e.source}`)
    }
    const e10 = b.fragileEdges.find((e) => e.id === 'e-10')!
    const arrival = pointAtFraction(flattenSvgPath(e10.d)!, 1)
    expect(marksTouched(b, arrival, r), 'e-10 at its arrival').toContain('glyph e-10')
  })
})

describe('CONTRAST — the placement this replaces, on 90b8\'s top fragile edge (the DIFF\'s "at the Goal arrival")', () => {
  it('the old anchor (the lead path\'s label point) sits 0.9+ of the way along Pro plan price → MRR, on the Goal\'s arrival', () => {
    // The browser measured the old DISC at 0.953 (`r3/design/before-mrr-90b8f080-fresh-standard.json`):
    // this anchor plus the label resolver's offset. The anchor alone is already on the arrival.
    const b = BOARDS['mrr-90b8f080']
    const { tieredBoxes } = boxesOf(b)
    const e = b.fragileEdges.find((x) => x.id === 'e-6')!
    const poly = flattenSvgPath(e.d)!
    const s = poly.points[0]
    const t = poly.points[poly.points.length - 1]
    const leads = resolveLayeredEdgeLeads(e.source, e.target, s.x, s.y, t.x, t.y, tieredBoxes)
    expect(leads, 'the drawn path is a lead path').not.toBeNull()
    const [, lx, ly] = layeredLeadPath(s.x, s.y, t.x, t.y, leads!)
    expect(fractionNearest(poly, { x: lx, y: ly })).toBeGreaterThan(0.9)
    // A disc there stands within one disc of the Goal card and its arrival
    // glyphs (the label resolver's offset then moved it ONTO the card: the
    // browser read `cardHits: ['mrr']`) — the DIFF's "at the Goal arrival".
    const r = (FRAGILE_CUE_DISC_PX / 2) * Number(b.viewport.labelScale)
    const goal = b.nodes.find((c) => c.id === 'mrr')!.painted
    const goalGlyphs = b.glyphs.filter((g) => g.y1 <= goal.y && g.y1 > goal.y - 80)
    expect(goalGlyphs.length).toBeGreaterThan(0)
    const nearest = Math.min(
      distToRect({ x: lx, y: ly }, goal),
      ...goalGlyphs.map((g) => distToRect({ x: lx, y: ly }, { x: g.x0, y: g.y0, width: g.x1 - g.x0, height: g.y1 - g.y0 })),
    )
    expect(nearest).toBeLessThan(2 * r)
  })
})
