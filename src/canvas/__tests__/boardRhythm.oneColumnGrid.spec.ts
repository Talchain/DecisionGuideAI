/**
 * ⭐⭐ BOARD RHYTHM — a wrapped family sits on ONE column grid, and the row
 * stride carries no slack beyond the landing counter-scale (design audit
 * 26 Sep 2026, items 12 and 10, served UI 853feeb7).
 *
 * SERVED EVIDENCE, not a fixture from anyone's head: every height below is the
 * served card rect divided by the served zoom (`__fixtures__/starter-node-
 * heights.served-2026-09-26-853feeb7.json`, provenance inside), and the node
 * sets are the five shipped starter drafts the served app loads.
 *
 * #12 (served): pricing's factors wrapped 3 + 2 as brick courses — x 255.5 /
 * 413.5 / 571.5 over 334.5 / 492.5, the second course half a card right. Here
 * every course of every wrapped family must start on the first course's
 * columns, card k under card k, and the row-end prompt on the next column.
 *
 * #10 (served, pricing at ~100%): tier gaps 187 / 368 / 216 / 264. The arm at the
 * bottom pins WHY, executably: at the served landing heights every tier gap is
 * exactly the designed 64, so the 100% gap is the card's own landing growth plus
 * 64 and nothing else. A tighter 100% rhythm cannot come from the layout without
 * cards overlapping at the landing zoom — it needs cards that grow less at the
 * landing counter-scale.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import { isGhostNode } from '../utils/fitTargets'
import {
  LAYOUT_LAYER_GAP,
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  REPEATED_CARD_W,
  ROW_PROMPT_H,
  ROW_PROMPT_W,
  TIER_BY_KIND,
} from '../utils/nodeLayoutConstants'
import served from './__fixtures__/starter-node-heights.served-2026-09-26-853feeb7.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from?: string; to?: string }> }
const STARTERS: Record<string, Draft> = {
  'pricing-model': pricingModel as unknown as Draft,
  'market-entry': marketEntry as unknown as Draft,
  'vendor-selection': vendorSelection as unknown as Draft,
  'build-vs-buy': buildVsBuy as unknown as Draft,
  'headcount-allocation': headcountAllocation as unknown as Draft,
}
const SERVED = served as unknown as {
  landing: Record<string, Record<string, number>>
  z100: Record<string, Record<string, number>>
  factorRowsAtLanding: Record<string, Array<Array<{ id: string; x: number }>>>
}

/** Card box plus the card gap: one grid column. */
const STRIDE = REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP
/** The designed gap between two rows, in layout units (`WS1 #11`). */
const ROW_GAP = LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y

/** Lay a starter out the way the product does: heights at the label bound. */
async function laidOut(starter: string) {
  const draft = STARTERS[starter]
  const bound = SERVED.landing[starter]
  const nodes = draft.nodes.map((n) => {
    const h = bound[n.id]
    if (typeof h !== 'number') throw new Error(`${starter}: no served landing height for ${n.id}`)
    return {
      id: n.id,
      type: n.kind,
      position: { x: 0, y: 0 },
      data: { label: n.label, kind: n.kind },
      measured: { width: REPEATED_CARD_W, height: h },
    }
  }) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from!, target: e.to! })) as Edge[]
  const out = await layoutGraph(nodes, edges, { heightAtLabelBound: new Map(Object.entries(bound)) })
  const withPrompts = withGhostTiers(out.nodes)
  const at = (id: string): Node => {
    const n = withPrompts.find((x) => x.id === id)
    if (!n) throw new Error(`${starter}: no node ${id}`)
    return n
  }
  return { out, at, draft, withPrompts }
}

/** Every family (tier) of real cards, as sub-rows by exact y, each left to right. */
function familiesOf(nodes: Node[]): Map<number, Node[][]> {
  const byTier = new Map<number, Map<number, Node[]>>()
  for (const n of nodes) {
    if (isGhostNode(n.id)) continue
    const tier = TIER_BY_KIND[n.type as string]
    const rows = byTier.get(tier) ?? new Map<number, Node[]>()
    rows.set(n.position.y, [...(rows.get(n.position.y) ?? []), n])
    byTier.set(tier, rows)
  }
  const out = new Map<number, Node[][]>()
  for (const [tier, rows] of byTier) {
    out.set(
      tier,
      [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.position.x - b.position.x)),
    )
  }
  return out
}

const NAMES = Object.keys(STARTERS)

describe('#12 — a wrapped family sits on ONE column grid (served 853feeb7: brick courses)', () => {
  it('non-vacuity: the served boards wrap — every starter has at least one family in two courses', async () => {
    for (const s of NAMES) {
      const { out } = await laidOut(s)
      const wrapped = [...familiesOf(out.nodes).values()].filter((rows) => rows.length > 1)
      expect(wrapped.length, s).toBeGreaterThan(0)
    }
  })

  it.each(NAMES)('%s: the factor courses hold the SERVED cards, in the served reading order', async (s) => {
    const { out } = await laidOut(s)
    const rows = familiesOf(out.nodes).get(TIER_BY_KIND.factor)!
    expect(rows.map((r) => r.map((n) => n.id))).toEqual(SERVED.factorRowsAtLanding[s].map((r) => r.map((c) => c.id)))
  })

  it.each(NAMES)('%s: card k of every course stands on card k\'s column of the first course, by id', async (s) => {
    const { out } = await laidOut(s)
    const offGrid: string[] = []
    for (const rows of familiesOf(out.nodes).values()) {
      const first = rows[0]
      for (const row of rows.slice(1)) {
        row.forEach((n, k) => {
          const dx = n.position.x - first[k].position.x
          if (dx !== 0) offGrid.push(`${n.id} is ${dx} right of ${first[k].id}`)
        })
      }
    }
    expect(offGrid).toEqual([])
  })

  it.each(NAMES)('%s: the row-end prompt stands on the NEXT column of the final course', async (s) => {
    const { out, withPrompts } = await laidOut(s)
    const prompts = withPrompts.filter((n) => isGhostNode(n.id))
    let checked = 0
    for (const rows of familiesOf(out.nodes).values()) {
      if (rows.length < 2) continue
      const finalRow = rows[rows.length - 1]
      const last = finalRow[finalRow.length - 1]
      const prompt = prompts.find((p) => p.position.y === last.position.y && p.position.x > last.position.x)
      if (!prompt) continue
      checked++
      expect(prompt.position.x, `${s} ${prompt.id}`).toBe(rows[0][0].position.x + finalRow.length * STRIDE)
    }
    expect(checked, `${s}: a wrapped family carried no row-end prompt`).toBeGreaterThan(0)
  })
})

/** Every box a reader can see: real cards at their drawn width, prompts at theirs. */
function boxesAt(
  withPrompts: Node[],
  widths: Record<string, number>,
  heights: Record<string, number>,
): Array<{ id: string; x: number; y: number; w: number; h: number }> {
  return withPrompts.map((n) => {
    if (isGhostNode(n.id)) return { id: n.id, x: n.position.x, y: n.position.y, w: ROW_PROMPT_W, h: ROW_PROMPT_H }
    const h = heights[n.id]
    if (typeof h !== 'number') throw new Error(`no height for ${n.id}`)
    return { id: n.id, x: n.position.x, y: n.position.y, w: widths[n.type as string], h }
  })
}

function overlapsOf(boxes: ReturnType<typeof boxesAt>): string[] {
  const hits: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ix > 0 && iy > 0) hits.push(`${a.id} x ${b.id} (${ix.toFixed(1)} x ${iy.toFixed(1)})`)
    }
  }
  return hits
}

describe('no card or prompt overlaps another — at the landing counter-scale AND at 100%', () => {
  it.each(NAMES)('%s at the served LANDING heights (label scale 2)', async (s) => {
    const { out, withPrompts } = await laidOut(s)
    expect(overlapsOf(boxesAt(withPrompts, out.layoutCardWidths, SERVED.landing[s]))).toEqual([])
  })

  it.each(Object.keys(SERVED.z100))('%s at the served ~100% heights (label scale 1)', async (s) => {
    const { out, withPrompts } = await laidOut(s)
    expect(overlapsOf(boxesAt(withPrompts, out.layoutCardWidths, SERVED.z100[s]))).toEqual([])
  })

  it('CONTRAST — the probe bites: the same pricing board with its factor courses collapsed onto one line overlaps', async () => {
    const { out, withPrompts } = await laidOut('pricing-model')
    const rows = familiesOf(out.nodes).get(TIER_BY_KIND.factor)!
    const collapsed = withPrompts.map((n) =>
      rows[1].some((m) => m.id === n.id) ? { ...n, position: { x: n.position.x, y: rows[0][0].position.y } } : n,
    )
    expect(overlapsOf(boxesAt(collapsed, out.layoutCardWidths, SERVED.landing['pricing-model'])).length).toBeGreaterThan(0)
  })
})

/**
 * #10 — WHY THE 100% RHYTHM IS WHAT IT IS, pinned so it cannot silently get worse
 * for a layout reason. This arm is GREEN on the served base: the layout already
 * spends nothing beyond `ROW_GAP` at the landing heights. The regressed 100% gaps
 * are the cards' own growth under the 2× landing counter-scale.
 */
describe('#10 — the row stride has no slack: at landing every tier gap is exactly the designed 64', () => {
  function tierGaps(nodes: Node[], heights: Record<string, number>): number[] {
    const fam = familiesOf(nodes)
    const tiers = [...fam.keys()].sort((a, b) => a - b)
    expect(tiers).toEqual([0, 1, 2, 3, 5])
    return tiers.slice(1).map((t, i) => {
      const above = fam.get(tiers[i])!.flat()
      const here = fam.get(t)!.flat()
      const top = Math.min(...here.map((n) => n.position.y))
      const bottom = Math.max(...above.map((n) => n.position.y + heights[n.id]))
      return Math.round((top - bottom) * 10) / 10
    })
  }

  it.each(NAMES)('%s: every tier gap at the served landing heights is at least 64, and the tightest is exactly 64', async (s) => {
    const { out } = await laidOut(s)
    // A tier's gap is measured from its tallest card, so a family whose final
    // sub-row carries the row-end prompt can only be at or above the designed gap.
    // ±0.5: the layout rounds each served height to a whole unit (`getNodeDimensions`).
    const gaps = tierGaps(out.nodes, SERVED.landing[s])
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(ROW_GAP - 0.5)
    expect(Math.abs(Math.min(...gaps) - ROW_GAP)).toBeLessThanOrEqual(0.5)
  })

  it('pricing at ~100%: the layout reproduces the SERVED gaps 187 / 368 / 216 / 264 within 1.5 units — the gap is landing growth + 64', async () => {
    const { out } = await laidOut('pricing-model')
    const gaps = tierGaps(out.nodes, SERVED.z100['pricing-model'])
    const servedGaps = [187, 368, 216, 264]
    gaps.forEach((g, i) => expect(Math.abs(g - servedGaps[i]), `tier ${i + 1}: ${g} vs served ${servedGaps[i]}`).toBeLessThanOrEqual(1.5))
  })
})
