/**
 * ⭐⭐ UI #2138 FOUND CASE — the rank-1 factor may grow by its flip plot, and the
 * board still shows 0 overlaps and 0 NEW edges under cards.
 *
 * RULING (Delivery Lead, #70 5850012381, amending 5849644637): a FOUND turning
 * point stays on the card as the prototype's flip plot. No card grows after a
 * Run EXCEPT the rank-1 factor, and only by that plot; in the found case the
 * board must still show 0 overlaps and 0 new edges under cards. The card half
 * (which testids arrive, on which card) is pinned in
 * `nodes/__tests__/FactorNode.noGrowthAfterRun.spec.tsx`; this is the board half.
 *
 * WHAT GROWS, AND WHAT THE PRODUCT DOES ABOUT IT. The layout reserves each card's
 * height AT THE LABEL BOUND (`measureNodeHeightsAtLabelBound` → `layoutGraph`'s
 * `heightAtLabelBound`), and `useMeasureThenLayout` re-lays the board when a card
 * grows past it (`HEIGHT_GROWTH_TOLERANCE_PX`). So the post-run board is the
 * production layout run again at the post-run heights. Both are exercised here
 * through the real `layoutGraph` and the real edge leads (`resolveLayeredEdgeLeads`
 * / `layeredLeadPath`, what `StyledEdge` draws), with the same box, overlap and
 * sampling rules as `v31Ws1LandingComposition.spec.ts`.
 *
 * HEIGHTS: measured in real Chromium on this branch's product code at d54545f6
 * (9dc3e7af + staging c976c029; local dev server, `playwright.geometry.config.ts`,
 * pricing starter, 1280x800, zoom 0.5, label scale 2), by calling the production
 * `measureNodeHeightsAtLabelBound` before and after a completed Run seeded with
 * the served shares, the served rank (`Driver 1 of 5 analysed` on
 * fac_top_account_concentration only) and MG's FOUND row (#2138 review:
 * flip_reason 'found', current 0.4, flip 0.7, display scale). Only ONE card's
 * bound height moved: fac_top_account_concentration 218 → 406. On screen that
 * card went 109.1 → 202.9px: the flip plot (91.8px) arrived under the driver
 * slot; title (52.5px) and slot (15.1px) were unchanged. (#2133 omits the
 * producer's bare model-scale range on the card, so neither phase has a range
 * line here; at 9dc3e7af the plot replaced a 30.3px one, 283 → 406.) The same
 * run read the DOM directly: layoutVersion 1 → 2, 0 overlapping card pairs and
 * 0 edge paths (30 of 30 sampled with getPointAtLength) under a non-endpoint
 * card, before and after. (Option heights here are post-#2140 one-line change
 * rows; the relation under test does not depend on them.)
 *
 * CLAIM SCOPE: local Chromium with a seeded result, not the deployed build. The
 * served found-case witness is still owed after the merge.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { isGhostNode } from '../utils/fitTargets'
import { REPEATED_CARD_W, TIER_BY_KIND, cardWidthCapForTier } from '../utils/nodeLayoutConstants'
import { resolveLayeredEdgeLeads, layeredLeadPath, type RouteBox } from '../edges/sameRowRoute'
import { useLayoutStore } from '../layoutStore'
import pricingModel from '../starters/data/pricing-model.draft.json'

const RANK_1 = 'fac_top_account_concentration'

/** Bound heights (flow px), Chromium, before the Run. */
const PRE_BOUND: Record<string, number> = {
  dec_pricing: 108,
  fac_adoption_friction: 226,
  fac_enterprise_revenue_risk: 296,
  fac_market_competition: 218,
  fac_top_account_concentration: 218,
  fac_usage_exposure: 264,
  goal_pricing_transition: 190,
  opt_full_switch: 315,
  opt_hybrid: 425,
  opt_new_logos: 425,
  opt_status_quo: 313,
  out_bottom_up_growth: 186,
  out_nrr: 283,
  risk_enterprise_churn: 252,
  risk_pricing_complexity: 252,
}
/** …and after the FOUND Run: the same reads, with the one card that moved. */
const POST_BOUND: Record<string, number> = { ...PRE_BOUND, [RANK_1]: 406 }

/** Store positions the same Chromium run read before the Run (after it, it read the bands below the factors +110). */
const PRE_POSITIONS: Record<string, { x: number; y: number }> = {
  dec_pricing: { x: 494, y: 24 },
  fac_adoption_friction: { x: 261, y: 685 },
  fac_enterprise_revenue_risk: { x: 419, y: 994 },
  fac_market_competition: { x: 577, y: 685 },
  fac_top_account_concentration: { x: 735, y: 994 },
  fac_usage_exposure: { x: 893, y: 685 },
  goal_pricing_transition: { x: 494, y: 1701 },
  opt_full_switch: { x: 24, y: 196 },
  opt_hybrid: { x: 340, y: 196 },
  opt_new_logos: { x: 656, y: 196 },
  opt_status_quo: { x: 972, y: 196 },
  out_bottom_up_growth: { x: 340, y: 1354 },
  out_nrr: { x: 972, y: 1354 },
  risk_enterprise_churn: { x: 656, y: 1354 },
  risk_pricing_complexity: { x: 24, y: 1354 },
}
const BELOW_FACTORS = ['goal_pricing_transition', 'out_bottom_up_growth', 'out_nrr', 'risk_enterprise_churn', 'risk_pricing_complexity']

type Draft = { nodes: Array<{ id: string; kind: string; label: string }>; edges: Array<{ from: string; to: string }> }
const draft = pricingModel as unknown as Draft
const edges = draft.edges.map((e, i) => ({ id: `e${i}:${e.from}->${e.to}`, source: e.from, target: e.to })) as Edge[]

type Box = RouteBox & { tier: number }

/** The production layout at these bound heights, with the layout store's own options (as `applyLayout` passes them). */
async function laidOut(bound: Record<string, number>) {
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: REPEATED_CARD_W, height: bound[n.id] },
  })) as unknown as Node[]
  const opts = useLayoutStore.getState()
  const out = await layoutGraph(nodes, edges, {
    direction: opts.direction,
    spacing: opts.nodeSpacing,
    layerSpacing: opts.layerSpacing,
    preserveLocked: opts.respectLocked,
    heightAtLabelBound: new Map(Object.entries(bound)),
  })
  const boxes: Box[] = out.nodes
    .filter((n) => !isGhostNode(n.id))
    .map((n) => {
      const tier = TIER_BY_KIND[n.type as string]
      const width = out.layoutCardWidths[n.type as string] ?? cardWidthCapForTier(tier)
      return { id: n.id, x: n.position.x, y: n.position.y, width, height: bound[n.id]!, tier }
    })
  return { out, boxes }
}

/** Every pair of cards whose full rectangles intersect. */
function overlaps(boxes: Box[]): string[] {
  const hits: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (ix > 0 && iy > 0) hits.push(`${a.id} × ${b.id} (${ix}x${iy})`)
    }
  }
  return hits
}

const inside = (p: { x: number; y: number }, b: RouteBox, inset = 3): boolean =>
  p.x > b.x + inset && p.x < b.x + b.width - inset && p.y > b.y + inset && p.y < b.y + b.height - inset

/** Sample a path of M/L/C commands at `n` points per segment. */
function samplePath(d: string, n = 60): Array<{ x: number; y: number }> {
  const tokens = d.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? []
  const pts: Array<{ x: number; y: number }> = []
  let i = 0
  let cur = { x: 0, y: 0 }
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'M') cur = { x: num(), y: num() }
    else if (cmd === 'L') {
      const to = { x: num(), y: num() }
      for (let k = 0; k <= n; k++) pts.push({ x: cur.x + ((to.x - cur.x) * k) / n, y: cur.y + ((to.y - cur.y) * k) / n })
      cur = to
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() }
      const c2 = { x: num(), y: num() }
      const to = { x: num(), y: num() }
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const u = 1 - t
        pts.push({
          x: u * u * u * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
        })
      }
      cur = to
    } else throw new Error(`samplePath: unexpected command ${cmd}`)
  }
  return pts
}

/** The contract's plain near-straight cubic (`StyledEdge` E9) when no leads apply. */
function plainPath(sx: number, sy: number, tx: number, ty: number): string {
  const bend = Math.max(6, Math.min(30, (ty - sy) / 2))
  return `M${sx},${sy} C${sx},${sy + bend} ${tx},${ty - bend} ${tx},${ty}`
}

/**
 * `<edge> under <card>` for every drawn edge (source bottom-centre → target
 * top-centre, with its leads) and every NON-endpoint card it crosses.
 * `withLeads: false` is the contrast arm: the plain diagonal alone.
 */
function edgesUnderCards(boxes: Box[], withLeads = true): string[] {
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const under: string[] = []
  for (const e of edges) {
    const src = byId.get(e.source)!
    const tgt = byId.get(e.target)!
    const sx = src.x + src.width / 2
    const sy = src.y + src.height
    const tx = tgt.x + tgt.width / 2
    const ty = tgt.y
    const leads = withLeads ? resolveLayeredEdgeLeads(src.id, tgt.id, sx, sy, tx, ty, boxes) : null
    const path = leads ? layeredLeadPath(sx, sy, tx, ty, leads)[0] : plainPath(sx, sy, tx, ty)
    const hit = new Set<string>()
    for (const p of samplePath(path)) for (const b of boxes) if (b.id !== src.id && b.id !== tgt.id && inside(p, b)) hit.add(b.id)
    for (const id of hit) under.push(`${e.id} under ${id}`)
  }
  return under
}

describe('#2138 found case — the pricing board at the Chromium-measured bound heights', () => {
  it('the fixture is the served starter, and only the rank-1 factor moved (non-vacuity)', () => {
    expect(Object.keys(PRE_BOUND).sort()).toEqual(draft.nodes.map((n) => n.id).sort())
    expect(edges).toHaveLength(30)
    const moved = Object.keys(PRE_BOUND).filter((id) => POST_BOUND[id] !== PRE_BOUND[id])
    expect(moved).toEqual([RANK_1])
    expect(POST_BOUND[RANK_1]! - PRE_BOUND[RANK_1]!).toBe(188)
  })

  it('pre-run: the production layout reproduces the positions Chromium read, with 0 overlaps and 0 edges under cards', async () => {
    const { out, boxes } = await laidOut(PRE_BOUND)
    const pos = Object.fromEntries(out.nodes.filter((n) => !isGhostNode(n.id)).map((n) => [n.id, n.position]))
    expect(pos).toEqual(PRE_POSITIONS)
    expect(overlaps(boxes)).toEqual([])
    expect(edgesUnderCards(boxes)).toEqual([])
  })

  it('post-run (FOUND): the re-lay moves only the bands below the factors, by exactly the growth of the row; 0 overlaps and 0 NEW edges under cards', async () => {
    const pre = await laidOut(PRE_BOUND)
    const post = await laidOut(POST_BOUND)
    const prePos = new Map(pre.boxes.map((b) => [b.id, b]))
    // The factor row was sized by its tallest card (296); it is now the rank-1 card (406).
    const rowGrowth = POST_BOUND[RANK_1]! - Math.max(...pre.boxes.filter((b) => b.tier === TIER_BY_KIND.factor && b.y === prePos.get(RANK_1)!.y).map((b) => b.height))
    expect(rowGrowth).toBe(110)
    for (const b of post.boxes) {
      const was = prePos.get(b.id)!
      expect({ id: b.id, x: b.x, y: b.y }).toEqual({ id: b.id, x: was.x, y: BELOW_FACTORS.includes(b.id) ? was.y + rowGrowth : was.y })
    }
    expect(overlaps(post.boxes)).toEqual([])
    const preUnder = new Set(edgesUnderCards(pre.boxes))
    const newUnder = edgesUnderCards(post.boxes).filter((u) => !preUnder.has(u))
    expect(newUnder).toEqual([])
  })

  it('CONTRAST — the overlap probe bites: the grown card left on the pre-run layout (no re-lay) overlaps the band below', async () => {
    const pre = await laidOut(PRE_BOUND)
    const grownInPlace = pre.boxes.map((b) => (b.id === RANK_1 ? { ...b, height: POST_BOUND[RANK_1]! } : b))
    const hits = overlaps(grownInPlace)
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) expect(h.startsWith(`${RANK_1} × `) || h.includes(` × ${RANK_1} `)).toBe(true)
  })

  it('CONTRAST — the edge probe bites: without the leads, plain diagonals run under cards on the post-run board', async () => {
    const post = await laidOut(POST_BOUND)
    expect(edgesUnderCards(post.boxes, false).length).toBeGreaterThan(0)
  })
})
