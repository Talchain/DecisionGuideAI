/**
 * ⭐⭐ code-review F1 (27 Sep 2026) — AT THE LANDING, NO POLARITY SIGN STANDS ON
 * A CARD. Every `+` / `−` row, painted where `polarityGlyphTransform` puts it at
 * the glyph counter-scale bound, sits inside the tier gap on the five starters.
 *
 * What went wrong: #2208 put the signs in one row 19 glyph units above the
 * arrival, multiplied by `--canvas-glyph-scale` (2 at the 0.50 landing), while
 * the tier gap it stands in is a FIXED 56 flow units and the arrival is already
 * the kind shape's overhang (20.64) above the card. The row's centre landed
 * 58.64 above the target card — on the upper row's bottom border — and the
 * cards, which paint after `.react-flow__edgelabel-renderer`, covered it.
 * Served at 1280×800: 38 of 86 glyph boxes overlapped a card; build-vs-buy's
 * e-8, e-10 and e-16 `−` showed 0% of their ink.
 *
 * ## What is real here
 * - LAYOUT: the real `layoutGraph` (ELK) on the five starters with the S5
 *   landing-rung heights, the same board `bandTitleClearsKindGlyph.guard.spec.ts`
 *   lays out.
 * - PLACEMENT: the real `resolvePolarityGlyphOffset` (with the real band-title
 *   keep-out, `tierLaneTitleBoxFor`) and the real `polarityGlyphTransform`
 *   STRING, evaluated at the bound by a small calc() evaluator below — so the
 *   guard reads the position the glyph is painted at, not a restatement of it.
 * - ANCHOR: the target handle — the card's top-centre, raised by the kind
 *   shape's overhang at the label bound (`BaseNode`; `kindGlyphOverhangAt`).
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
  polarityGlyphTransform,
  resolvePolarityGlyphOffset,
  type GlyphSibling,
} from '../utils/edgeGlyphPlacement'
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

/**
 * Evaluate the TRANSLATE part of `polarityGlyphTransform`'s output at a glyph
 * counter-scale, in flow px. Handles exactly the grammar that function emits —
 * `calc()`, `max()`/`min()`, `+ - *`, `px`, the one var — and refuses anything
 * else, so a change of shape fails loudly rather than being misread.
 */
function evaluateGlyphTranslate(transform: string, scale: number): { x: number; y: number } {
  const m = transform.match(/translate\(-50%, -50%\) translate\((calc\(.*\)), (calc\(.*\))\)$/)
  expect(m, `unexpected transform shape: ${transform}`).not.toBeNull()
  const evalCalc = (expr: string): number => {
    const js = expr
      .replace(/var\(--canvas-glyph-scale, 1\)/g, String(scale))
      .replace(/px/g, '')
      .replace(/calc\(/g, '(')
      .replace(/max\(/g, 'Math.max(')
      .replace(/min\(/g, 'Math.min(')
    expect(js.replace(/Math\.(max|min)/g, ''), `unexpected tokens in ${expr}`).toMatch(/^[\d\s.+\-*(),]+$/)
    return Function(`"use strict"; return (${js})`)() as number
  }
  return { x: evalCalc(m![1]!), y: evalCalc(m![2]!) }
}

type Box = { id: string; x0: number; y0: number; x1: number; y1: number }

async function glyphBoxesAtBound(starter: string) {
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
  const byId = new Map(laid.map((n) => [n.id, n]))
  const tierOf = (id: string) => TIER_BY_KIND[byId.get(id)!.type as string]!
  const centre = (id: string) => {
    const n = byId.get(id)!
    return { x: n.position.x + cardW(n) / 2, y: n.position.y + heights[id]! / 2 }
  }
  const cards: Box[] = laid.map((n) => ({
    id: n.id,
    x0: n.position.x,
    y0: n.position.y,
    x1: n.position.x + cardW(n),
    y1: n.position.y + heights[n.id]!,
  }))

  const overhang = kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE)
  const half = GLYPH_PAINTED_BOX_FLOW / 2
  const glyphs: Box[] = []
  for (const e of edges) {
    const srcKind = byId.get(e.source)!.type as string
    // Glyphs are drawn on CAUSAL links only; decision→option and option→factor
    // are structural. Same-row links carry their glyph on the same-row route.
    if (srcKind === 'decision' || srcKind === 'option') continue
    if (tierOf(e.source) >= tierOf(e.target)) continue
    const tgt = byId.get(e.target)!
    const targetX = tgt.position.x + cardW(tgt) / 2
    const targetY = tgt.position.y - overhang
    const siblings: GlyphSibling[] = edges
      .filter((s) => s.target === e.target)
      .map((s) => ({ id: s.id, sourceCentre: centre(s.source) }))
    const title = tierLaneTitleBoxFor(laid, e.target)
    const keepOut = title
      ? { x0: title.x0 - targetX, y0: title.y0 - targetY, x1: title.x1 - targetX, y1: title.y1 - targetY }
      : undefined
    const offset = resolvePolarityGlyphOffset(e.id, centre(e.target), siblings, keepOut)
    const p = evaluateGlyphTranslate(polarityGlyphTransform(targetX, targetY, offset), MAX_GLYPH_COUNTER_SCALE)
    glyphs.push({ id: e.id, x0: p.x - half, y0: p.y - half, x1: p.x + half, y1: p.y + half })
  }
  return { glyphs, cards }
}

const overlaps = (a: Box, b: Box) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0

describe('the glyph row fits the tier gap, at the bound (F1 budget)', () => {
  it('overhang + painted rise + half the glyph box + the mark gap ≤ the visible gap', () => {
    const visible = LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y
    const overhang = kindGlyphOverhangAt(MAX_LABEL_COUNTER_SCALE)
    // The rise the transform PAINTS at the bound, read from its own string.
    const rise = -evaluateGlyphTranslate(polarityGlyphTransform(0, 0, { dx: 0, dy: -19 }), MAX_GLYPH_COUNTER_SCALE).y
    expect(rise).toBeGreaterThan(0)
    expect(overhang + rise + GLYPH_PAINTED_BOX_FLOW / 2 + GLYPH_BOX_GAP_FLOW).toBeLessThanOrEqual(visible + 1e-9)
  })

  it('leaves the contract\'s 19 px rise untouched where it already fits (zoom ≥ ≈0.89)', () => {
    for (const scale of [1, 1.1]) {
      const y = evaluateGlyphTranslate(polarityGlyphTransform(0, 0, { dx: 0, dy: -19 }), scale).y
      expect(y, `scale ${scale}`).toBeCloseTo(-19 * scale, 10)
    }
  })
})

describe('no polarity glyph box meets a card on the five starters at the landing bound (F1)', () => {
  it.each(Object.keys(STARTERS))('%s', async (starter) => {
    const { glyphs, cards } = await glyphBoxesAtBound(starter)
    // Non-vacuity: every starter has causal glyphs to place.
    expect(glyphs.length).toBeGreaterThanOrEqual(10)
    const hits: string[] = []
    for (const g of glyphs) for (const c of cards) if (overlaps(g, c)) hits.push(`${g.id} × ${c.id}`)
    expect(hits).toEqual([])
  })

  it('CONTRAST — the probe bites: the unbounded rise (19 × 2 = 38) puts glyphs on cards on the starters', async () => {
    let bitten = 0
    for (const starter of Object.keys(STARTERS)) {
      const { glyphs, cards } = await glyphBoxesAtBound(starter)
      // The same boxes, re-centred at the unbounded rise the defect painted.
      const bound = GLYPH_PAINTED_BOX_FLOW / 2
      for (const g of glyphs) {
        const cy = (g.y0 + g.y1) / 2
        // Walk back to the anchor: the painted rise at the bound is ≤ 38.
        const anchorY = cy + -evaluateGlyphTranslate(polarityGlyphTransform(0, 0, { dx: 0, dy: -19 }), MAX_GLYPH_COUNTER_SCALE).y
        const unbounded = { ...g, y0: anchorY - 38 - bound, y1: anchorY - 38 + bound }
        if (cards.some((c) => overlaps(unbounded, c))) bitten++
      }
    }
    expect(bitten).toBeGreaterThanOrEqual(10)
  })
})
