/**
 * ⭐ THE PROPERTY A MOVED DIGEST CANNOT SEE: NO TWO CARDS IN ONE ROW OVERLAP
 * (S4, 24 Sep 2026 — measured BEFORE the five canonical-shape digests are
 * re-recorded; the 14 Sep re-record set this precedent).
 *
 * S4 narrows repeated cards to REPEATED_CARD_W, widens nothing past
 * ANCHOR_CARD_MAX_W, wraps rows above MAX_CARDS_PER_ROW into balanced sub-rows
 * and restores the row-end prompt cards. Any of those can make same-row
 * neighbours collide, and a digest only says "different from last time". So
 * this measures, for every starter, at the width each card ACTUALLY RENDERS at
 * (`layoutCardWidths`, the same record `BaseNode` reads) and with the row-end
 * prompts placed exactly as the canvas places them (`withGhostTiers`): every
 * same-row gap is ≥ 0.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import { ROW_PROMPT_W, NODE_CARD_MAX_W } from '../utils/nodeLayoutConstants'
import capture from './__fixtures__/starter-node-heights.browser-capture-2026-08-18.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

const STARTERS = {
  'vendor-selection': vendorSelection,
  'market-entry': marketEntry,
  'build-vs-buy': buildVsBuy,
  'headcount-allocation': headcountAllocation,
  'pricing-model': pricingModel,
} as const
type StarterId = keyof typeof STARTERS
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

function buildGraph(id: StarterId): { nodes: Node[]; edges: Edge[] } {
  const draft = STARTERS[id] as unknown as {
    nodes: Array<{ id: string; kind: string; label: string }>
    edges: Array<{ id?: string; from?: string; to?: string; source?: string; target?: string }>
  }
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: NODE_CARD_MAX_W, height: HEIGHTS[id][n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: (e.from ?? e.source) as string,
    target: (e.to ?? e.target) as string,
  })) as Edge[]
  return { nodes, edges }
}

type Box = { id: string; x: number; y: number; w: number }

async function rowBoxes(id: StarterId): Promise<Box[]> {
  const { nodes, edges } = buildGraph(id)
  const out = await layoutGraph(nodes, edges, {})
  const widthOf = (n: Node): number => {
    if (String(n.id).startsWith('__ghost')) return ROW_PROMPT_W
    const w = out.layoutCardWidths[String(n.type)]
    return typeof w === 'number' ? w : out.layoutNodeWidth
  }
  // The canvas places the row-end prompts against the laid-out, WIDTH-STAMPED
  // cards, so stamp each card with the width it renders at before placing them.
  const stamped = out.nodes.map((n) => ({ ...n, width: widthOf(n), measured: { ...(n.measured ?? {}), width: widthOf(n) } })) as Node[]
  return withGhostTiers(stamped).map((n) => ({ id: String(n.id), x: n.position.x, y: Math.round(n.position.y), w: widthOf(n) }))
}

function worstSameRowGap(boxes: Box[]): { gap: number; pair: string } {
  const rows = new Map<number, Box[]>()
  for (const b of boxes) rows.set(b.y, [...(rows.get(b.y) ?? []), b])
  let worst = { gap: Number.POSITIVE_INFINITY, pair: '' }
  for (const row of rows.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].w)
      if (gap < worst.gap) worst = { gap, pair: `${sorted[i - 1].id} | ${sorted[i].id}` }
    }
  }
  return worst
}

describe('S4: no two cards in one row overlap, at their rendered widths, prompts included', () => {
  it.each(Object.keys(STARTERS) as StarterId[])('%s — every same-row gap is ≥ 0', async (id) => {
    const boxes = await rowBoxes(id)
    expect(boxes.some((b) => b.id.startsWith('__ghost')), 'no row-end prompt was placed — the prompts are not in this measurement').toBe(true)
    const worst = worstSameRowGap(boxes)
    expect(worst.gap, `overlap between ${worst.pair}`).toBeGreaterThanOrEqual(0)
  })

  it('DISCRIMINATION: the measure catches an overlap when widths exceed the placement stride', () => {
    const boxes: Box[] = [
      { id: 'a', x: 0, y: 100, w: 300 },
      { id: 'b', x: 260, y: 100, w: 260 },
      { id: 'c', x: 0, y: 400, w: 100 },
    ]
    expect(worstSameRowGap(boxes).gap).toBe(-40)
  })
})
