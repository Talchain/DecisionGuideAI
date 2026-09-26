/**
 * ⭐⭐ NO BAND TITLE UNDER A KIND SHAPE — every title paired with every card's
 * shape, on the five shipped starters, at the landing bound.
 *
 * Review of #2074 (Blocker 1, 26 Sep 2026). WS1 #15 counter-scaled each card's
 * kind shape to the contract's 24px (`.node .shape{width:24px;height:24px;
 * top:-12px}`), so at the 0.5 landing it stands 24 units above its card; WS1
 * #11 cut the row gap to 48 visible; WS1 #26's band words run 158–198 units at
 * the bound. The title, bottom-anchored `LANE_TITLE_GAP` above its cards, sat in
 * the shape's strip. Served at 1280×800 (`e2e/geometry`, backends unreachable,
 * `Range.getBoundingClientRect` on `tier-lane-*-title` against the
 * `node-type-glyph` svg): ALTERNATIVES under the first option's shape on
 * vendor-selection, build-vs-buy, headcount-allocation and pricing-model, and
 * OUTCOMES / RISKS under pricing's first risk — 24.0×7.5px each, none at the
 * base `948abd6c`.
 *
 * ## What is real here
 * - LAYOUT: the real `layoutGraph` (ELK included) on the five starters, with the
 *   S5 landing-rung heights (`starter-node-heights.browser-capture-2026-09-24-s5`),
 *   and the real `withGhostTiers` row-end prompts.
 * - TITLE BOX: the real `tierLaneTitleBoxFor` — the box `TierLanes` draws and the
 *   polarity-glyph keep-out (#28) reads — at the counter-scale bound. Its width
 *   is a generous per-capital estimate, so it CONTAINS the served text box.
 * - SHAPE BOX: stated here from `BaseNode`'s own style, NOT from the module under
 *   test (a guard that asked `tierLanes.ts` where the shapes are would agree
 *   with itself): `KIND_GLYPH_PX × scale` square, `top: −KIND_GLYPH_PX/2 × scale`,
 *   centred on the card (`left-1/2 -translate-x-1/2`). That style is pinned
 *   at the render by `BaseNode.contractV31Frame.spec.tsx`.
 *
 * ## What is not
 * jsdom-free arithmetic: no font, no pixels. The served measurement is the
 * witness; this is the regression gate that agrees with it starter for starter.
 */
import { describe, it, expect, afterAll } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import { isGhostNode } from '../utils/fitTargets'
import {
  LAYOUT_LAYER_GAP,
  LAYOUT_PADDING_Y,
  REPEATED_CARD_W,
  ROW_PROMPT_H,
  ROW_PROMPT_W,
  TIER_BY_KIND,
} from '../utils/nodeLayoutConstants'
import { MAX_LABEL_COUNTER_SCALE, LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'
import { deriveTierLanes, tierLaneTitleBoxFor, LANE_TITLE_GAP } from '../utils/tierLanes'
import { KIND_GLYPH_PX } from '../utils/nodeLayoutConstants'
import { LANE_TITLE_LINE_PX } from '../utils/tierLanes'
import capture from './__fixtures__/starter-node-heights.browser-capture-2026-09-24-s5.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from?: string; to?: string }> }
const STARTERS: Record<string, Draft> = {
  'vendor-selection': vendorSelection as unknown as Draft,
  'market-entry': marketEntry as unknown as Draft,
  'build-vs-buy': buildVsBuy as unknown as Draft,
  'headcount-allocation': headcountAllocation as unknown as Draft,
  'pricing-model': pricingModel as unknown as Draft,
}
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

/** The landing bound: the counter-scale every title and shape carries at 0.5. */
const S = MAX_LABEL_COUNTER_SCALE

type Box = { x0: number; y0: number; x1: number; y1: number }
const area = (a: Box, b: Box): { w: number; h: number } => ({
  w: Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)),
  h: Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)),
})

/** `BaseNode`'s kind shape at scale `s`, stated from its style (see header). */
function kindShapeBox(n: Node, cardW: number, s: number): Box {
  const size = KIND_GLYPH_PX * s
  const cx = n.position.x + cardW / 2
  const top = n.position.y - (KIND_GLYPH_PX / 2) * s
  return { x0: cx - size / 2, y0: top, x1: cx + size / 2, y1: top + size }
}

async function laidOut(starter: string) {
  const draft = STARTERS[starter]!
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: REPEATED_CARD_W, height: HEIGHTS[starter]![n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from!, target: e.to! })) as Edge[]
  const out = await layoutGraph(nodes, edges, {})
  // The board as rendered: each card at the width the layout published for its
  // kind (what `BaseNode` draws at, and what `TierLanes` reads), prompts at
  // their fixed size.
  const cardW = (n: Node) => out.layoutCardWidths[n.type as string]!
  const laid = out.nodes.map((n) => ({
    ...n,
    measured: { width: cardW(n), height: HEIGHTS[starter]![n.id] },
  })) as Node[]
  const board = withGhostTiers(laid).map((n) =>
    isGhostNode(n.id) ? ({ ...n, measured: { width: ROW_PROMPT_W, height: ROW_PROMPT_H } } as Node) : n,
  )
  const cards = laid.filter((n) => !isGhostNode(n.id))
  const prompts = board.filter((n) => isGhostNode(n.id))
  const titles = deriveTierLanes(laid).map((lane) => {
    const member = cards.find((n) => TIER_BY_KIND[n.type as string] === lane.tier)!
    return { lane, box: tierLaneTitleBoxFor(laid, member.id)! }
  })
  const shapes = cards.map((n) => ({ id: n.id, box: kindShapeBox(n, cardW(n), S) }))
  const cardBoxes = [
    ...cards.map((n) => ({ id: n.id, box: { x0: n.position.x, y0: n.position.y, x1: n.position.x + cardW(n), y1: n.position.y + HEIGHTS[starter]![n.id]! } })),
    ...prompts.map((n) => ({ id: n.id, box: { x0: n.position.x, y0: n.position.y, x1: n.position.x + ROW_PROMPT_W, y1: n.position.y + ROW_PROMPT_H } })),
  ]
  return { cards, titles, shapes, cardBoxes }
}

type Hit = { title: string; with: string; w: number; h: number }
function titleShapeHits(t: Awaited<ReturnType<typeof laidOut>>): Hit[] {
  const hits: Hit[] = []
  for (const { lane, box } of t.titles) {
    for (const s of t.shapes) {
      const o = area(box, s.box)
      if (o.w > 0 && o.h > 0) hits.push({ title: lane.title, with: s.id, w: o.w, h: o.h })
    }
  }
  return hits
}

const report: string[] = []
afterAll(() => {
  console.log(
    [
      '[bandTitleClearsKindGlyph] starter | title × kind shape | overlap (flow units) | on screen at 0.5',
      ...report,
    ].join('\n'),
  )
})

describe('the row gap holds a kind shape and a band title, both at the bound', () => {
  it('visible gap ≥ shape overhang + clearance + title line + clearance', () => {
    const visible = LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y
    const needed = (KIND_GLYPH_PX / 2) * S + LANE_TITLE_GAP + LANE_TITLE_LINE_PX * S + LANE_TITLE_GAP
    expect(S).toBe(2)
    expect(needed).toBe(64)
    expect(visible).toBeGreaterThanOrEqual(needed)
  })
})

describe('every band title × every kind shape: intersection area 0 (five starters, landing bound)', () => {
  it.each(Object.keys(STARTERS))('%s', async (starter) => {
    const t = await laidOut(starter)
    // Non-vacuity: every real card has a shape, and every occupied band a title.
    expect(t.shapes.length).toBe(STARTERS[starter]!.nodes.length)
    expect(t.titles.length).toBeGreaterThanOrEqual(4)
    const hits = titleShapeHits(t)
    if (hits.length === 0) report.push(`${starter} | none | 0 | 0`)
    for (const h of hits) {
      report.push(`${starter} | ${h.title} × ${h.with} | ${h.w.toFixed(1)}×${h.h.toFixed(1)} | ${(h.w * LABEL_LEGIBLE_ZOOM).toFixed(1)}×${(h.h * LABEL_LEGIBLE_ZOOM).toFixed(1)}px`)
    }
    expect(hits.map((h) => `${h.title} × ${h.with} ${h.w.toFixed(1)}×${h.h.toFixed(1)}`)).toEqual([])
  })

  it('CONTRAST — the probe bites: held on its cards (bottom = band top − LANE_TITLE_GAP, the pre-fix anchor), a title IS under a shape on four starters', async () => {
    const hitStarters: string[] = []
    for (const starter of Object.keys(STARTERS)) {
      const t = await laidOut(starter)
      const onCards = {
        ...t,
        titles: t.titles.map(({ lane, box }) => {
          const h = box.y1 - box.y0
          const bottom = lane.y - LANE_TITLE_GAP
          return { lane, box: { ...box, y0: bottom - h, y1: bottom } }
        }),
      }
      if (titleShapeHits(onCards).length > 0) hitStarters.push(starter)
    }
    expect(hitStarters.sort()).toEqual(['build-vs-buy', 'headcount-allocation', 'pricing-model', 'vendor-selection'])
  })
})

describe('…and the title that rises clear of a shape lands on nothing else', () => {
  it.each(Object.keys(STARTERS))('%s: no title intersects a card, a row-end prompt or another title', async (starter) => {
    const t = await laidOut(starter)
    const hits: string[] = []
    for (const { lane, box } of t.titles) {
      for (const c of t.cardBoxes) {
        const o = area(box, c.box)
        if (o.w > 0 && o.h > 0) hits.push(`${lane.title} × ${c.id}`)
      }
      for (const other of t.titles) {
        if (other.lane.tier === lane.tier) continue
        const o = area(box, other.box)
        if (o.w > 0 && o.h > 0) hits.push(`${lane.title} × ${other.lane.title}`)
      }
    }
    expect(hits).toEqual([])
  })

  it.each(Object.keys(STARTERS))('%s: the first band\'s title stays on its cards, inside the 16px the landing leaves under the top bar', async (starter) => {
    const t = await laidOut(starter)
    const first = t.titles.reduce((a, b) => (b.lane.y < a.lane.y ? b : a))
    expect(first.box.y1).toBe(first.lane.y - LANE_TITLE_GAP)
    // `laptopFit.arithmetic.spec.ts` pins the landing insets: the frame's top
    // is 73px, the top bar ends at 57px, and the clamped camera top-anchors the
    // board on the frame — so 16px (32 units at the floor) above the board.
    const boardTop = Math.min(...t.cardBoxes.map((c) => c.box.y0))
    expect(first.box.y0).toBeGreaterThanOrEqual(boardTop - (73 - 57) / LABEL_LEGIBLE_ZOOM)
  })
})
