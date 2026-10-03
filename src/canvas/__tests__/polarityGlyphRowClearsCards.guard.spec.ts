/**
 * ⭐⭐ code-review F1 (27 Sep 2026) — AT THE LANDING, NO POLARITY SIGN STANDS ON
 * A CARD, on the five starters.
 *
 * What went wrong then: #2208 put the signs in one row 19 above the arrival,
 * multiplied by `--canvas-glyph-scale` (2 at the 0.50 landing), while the tier
 * gap it stands in is a FIXED 64 flow units; the row landed on the upper card's
 * bottom border and the cards, which paint after the edge-label layer, covered
 * it. Served at 1280×800: 38 of 86 glyph boxes overlapped a card.
 *
 * ⚠ RE-WRITTEN 28 Sep 2026 (canvas/paul-test-edges). There is no row any more:
 * links into one card end at their own slots and each sign stands ON its own
 * line, just behind its own head (`edgeGlyphPlacement.ts` rules A and B). The
 * guard keeps its claim and re-derives it from the new placement: the rise
 * bound still fits the tier gap, and no sign box meets a card on the five
 * starters — for EVERY width band's head, the widest included.
 *
 * ## What is real here
 * - LAYOUT: the real `layoutGraph` (ELK) on the five starters with the S5
 *   landing-rung heights, the same board `bandTitleClearsKindGlyph.guard.spec.ts`
 *   lays out.
 * - PLACEMENT: the real `resolveArrivalSlotOnBoard` (with the real band title,
 *   `tierLaneTitleBoxFor`), the real path rebuild (`cardEdgePathFromBoxes`) and
 *   the real `resolvePolarityGlyphOnPath`, fed the keep-outs `StyledEdge` feeds
 *   it: every card, the row's band title and the other heads at the card.
 * - HANDLES: the landing offsets measured in Chromium (`fragileCueLanding
 *   .geometry.json`, 90b8 e-6: port 5.02 below the card, target handle 26.36
 *   above it).
 *
 * ## What is not
 * No paint and no font: the glyph box is the module's own conservative
 * `GLYPH_PAINTED_BOX_FLOW`. The browser probe on the served build is the
 * witness; this is the regression gate.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import {
  LAYOUT_LAYER_GAP,
  LAYOUT_PADDING_Y,
  REPEATED_CARD_W,
  TIER_BY_KIND,
  kindGlyphOverhangAt,
} from '../utils/nodeLayoutConstants'
import { MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'
import { tierLaneTitleBoxFor } from '../utils/tierLanes'
import {
  GLYPH_PAINTED_BOX_FLOW,
  GLYPH_BOX_GAP_FLOW,
  GLYPH_RISE_MAX_ABOVE_CARD_FLOW,
  GLYPH_ROW_RISE_MAX_FLOW,
  arrivalHeadKeepOut,
  glyphMetricsAt,
  resolveArrivalSlotOnBoard,
  resolvePolarityGlyphOnPath,
  type ArrivalBox,
  type GlyphKeepOut,
} from '../utils/edgeGlyphPlacement'
import { cardEdgePathFromBoxes, flattenSvgPath, pointAtFraction } from '../edges/fragileCuePlacement'
import type { RouteBox } from '../edges/sameRowRoute'
import { EDGE_STROKE_WIDTH_BANDS } from '../utils/graphDisplayCalculations'
import capture from './__fixtures__/starter-node-heights.browser-capture-2026-09-24-s5.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ id?: string; from?: string; to?: string }> }
const STARTERS: Record<string, Draft> = {
  'vendor-selection': vendorSelection as unknown as Draft,
  'market-entry': marketEntry as unknown as Draft,
  'build-vs-buy': buildVsBuy as unknown as Draft,
  'headcount-allocation': headcountAllocation as unknown as Draft,
  'pricing-model': pricingModel as unknown as Draft,
}
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

/** The landing handle offsets measured in Chromium (see header). */
const ENDS = { sourceDy: 5.015625, targetDy: -26.359375 }

type Box = { id: string; x0: number; y0: number; x1: number; y1: number }

/** Every causal link's sign box at the landing bound, for a head of `width`. */
async function glyphBoxesAtBound(starter: string, width: number) {
  const draft = STARTERS[starter]!
  const heights = HEIGHTS[starter]!
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: REPEATED_CARD_W, height: heights[n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({ id: e.id ?? `e${i}`, source: e.from!, target: e.to! })) as Edge[]
  const out = await layoutGraph(nodes, edges, {})
  const cardW = (n: Node) => out.layoutCardWidths[n.type as string]!
  const laid = out.nodes.map((n) => ({ ...n, measured: { width: cardW(n), height: heights[n.id] } })) as Node[]
  const kind = new Map(laid.map((n) => [n.id, n.type as string]))
  const routeBoxes: RouteBox[] = laid.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: cardW(n), height: heights[n.id]! }))
  const tieredBoxes = routeBoxes.map((b) => ({ ...b, tier: TIER_BY_KIND[kind.get(b.id)!]! }))
  const boxes = new Map<string, ArrivalBox>(routeBoxes.map((b) => [b.id, b]))
  const carriesSign = (e: Edge) => {
    const sk = kind.get(e.source)
    const tk = kind.get(e.target)
    return !((sk === 'decision' && tk === 'option') || (sk === 'option' && tk === 'factor'))
  }
  const cards: Box[] = routeBoxes.map((b) => ({ id: b.id, x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }))
  const metrics = glyphMetricsAt(width, MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE)
  const half = GLYPH_PAINTED_BOX_FLOW / 2
  const glyphs: Box[] = []
  const paths: Array<{ id: string; source: string; d: string }> = []
  for (const e of edges) {
    if (!carriesSign(e)) continue
    const tgt = boxes.get(e.target)!
    const title = tierLaneTitleBoxFor(laid, e.target)
    const slot = resolveArrivalSlotOnBoard(e.id, e.target, boxes, edges, title, carriesSign)
    const d = cardEdgePathFromBoxes(e.source, e.target, routeBoxes, tieredBoxes, ENDS, slot)!
    paths.push({ id: e.id, source: e.source, d })
    const keepOuts: GlyphKeepOut[] = cards.map((c) => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }))
    if (title) keepOuts.push(title)
    const handleX = tgt.x + tgt.width / 2
    for (const o of edges) {
      if (o.target !== e.target || o.id === e.id || !carriesSign(o)) continue
      const src = boxes.get(o.source)!
      if (!(src.y + src.height < tgt.y)) continue
      const os = resolveArrivalSlotOnBoard(o.id, o.target, boxes, edges, title, carriesSign)
      keepOuts.push(arrivalHeadKeepOut({ x: handleX + os.dx, y: os.onKindShape ? tgt.y + ENDS.targetDy : tgt.y }, MAX_GLYPH_COUNTER_SCALE))
    }
    const p = resolvePolarityGlyphOnPath(flattenSvgPath(d)!, tgt.y, metrics, keepOuts)
    glyphs.push({ id: e.id, x0: p.x - half, y0: p.y - half, x1: p.x + half, y1: p.y + half })
  }
  return { glyphs, cards, paths }
}

const overlaps = (a: Box, b: Box) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0

describe('the sign fits the tier gap, at the bound (F1 budget)', () => {
  it('the rise bound + half the glyph box + the mark gap = the visible gap, above the card; the same bound above the apex', () => {
    const visible = LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y
    expect(GLYPH_RISE_MAX_ABOVE_CARD_FLOW + GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW).toBeLessThanOrEqual(visible + 1e-9)
    const overhang = kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE)
    expect(overhang + GLYPH_ROW_RISE_MAX_FLOW + GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW).toBeLessThanOrEqual(visible + 1e-9)
    expect(GLYPH_ROW_RISE_MAX_FLOW).toBeGreaterThan(0)
  })
})

describe('no polarity sign box meets a card on the five starters at the landing bound (F1)', () => {
  const WIDTHS = Object.values(EDGE_STROKE_WIDTH_BANDS)
  it.each(Object.keys(STARTERS))('%s — every width band\'s head', async (starter) => {
    for (const width of WIDTHS) {
      const { glyphs, cards } = await glyphBoxesAtBound(starter, width)
      // Non-vacuity: every starter has causal signs to place.
      expect(glyphs.length).toBeGreaterThanOrEqual(10)
      const hits: string[] = []
      for (const g of glyphs) for (const c of cards) if (overlaps(g, c)) hits.push(`${g.id} × ${c.id}`)
      expect(hits, `width ${width}`).toEqual([])
    }
  })

  it('CONTRAST — the probe bites: a sign box at each link\'s DEPARTURE meets its source card on every starter', async () => {
    for (const starter of Object.keys(STARTERS)) {
      const { paths, cards } = await glyphBoxesAtBound(starter, EDGE_STROKE_WIDTH_BANDS.moderate)
      const half = GLYPH_PAINTED_BOX_FLOW / 2
      let bitten = 0
      for (const p of paths) {
        const q = pointAtFraction(flattenSvgPath(p.d)!, 0)
        const box = { id: p.id, x0: q.x - half, y0: q.y - half, x1: q.x + half, y1: q.y + half }
        if (cards.some((c) => c.id === p.source && overlaps(box, c))) bitten++
      }
      expect(bitten, starter).toBeGreaterThanOrEqual(10)
    }
  })
})
