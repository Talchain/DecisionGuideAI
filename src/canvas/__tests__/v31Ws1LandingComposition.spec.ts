/**
 * ⭐⭐ CANVAS v3.1 WS1 — LANDING COMPOSITION (26 Sep 2026).
 *
 * The pure-function half of WS1's rows in `DESIGN-GAP-v31.md`, bound by node
 * identity and by the real `layoutGraph` / `withGhostTiers` / placement code:
 *   #10 edges never run under a non-endpoint card (brick courses + vertical leads)
 *   #11 the row gap is one constant, whatever a browser persisted (64 visible
 *       again since the 27 Sep landing text cap; 56 under the laptop-width ruling
 *       before it; 64 from the review of #2074 until then)
 *   #17 the corner-mark spacer yields line 1 only when THIS title's first word needs it
 *   #25 far-zoom title scale
 *   #26 band words
 *   #27 one row-end prompt per band
 *   #28 polarity glyphs keep off the band titles
 * plus the MIXED-HEIGHT / TALL-CARD check a prior reviewer asked for: digest
 * specs laid out at height 100 prove row assignment only, so this lays out
 * boards whose cards differ in height by up to 4×, in both orders, and samples
 * every card and every edge over its WHOLE extent.
 *
 * 27 Sep 2026: Paul's laptop-width ruling — five per row, anchors ≤720, row gap 40.
 * Five no longer wraps, so the both-families-wrap shape below is six and six (was five and five).
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import { withGhostTiers, CONSEQUENCE_DOOR_ID, CONSEQUENCE_DOOR_LABEL } from '../utils/ghostTiers'
import { isGhostNode } from '../utils/fitTargets'
import {
  CANONICAL_LAYOUT_WIDTH,
  LAYOUT_LAYER_GAP,
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  REPEATED_CARD_W,
  ROW_PROMPT_W,
  TIER_BY_KIND,
  cardWidthCapForTier,
} from '../utils/nodeLayoutConstants'
import { resolveLayeredEdgeLeads, layeredLeadPath, type RouteBox } from '../edges/sameRowRoute'
import { resolveArrivalSlot, resolvePolarityGlyphOnPath, glyphMetricsAt } from '../utils/edgeGlyphPlacement'
import { flattenSvgPath } from '../edges/fragileCuePlacement'
import { deriveTierLanes, tierLaneTitleBoxFor } from '../utils/tierLanes'
import { cornerMarksTitleSpacerCss } from '../nodes/shared/canvasGlyphScale'
import { farTitleScale, labelCounterScale, FAR_TITLE_PX, FAR_TITLE_MAX_SCALE, MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'
import { CANVAS_TYPE_PX } from '../../styles/typography'

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const node = (id: string, type: string, h = 120, label = id): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, kind: type }, measured: { width: REPEATED_CARD_W, height: h } }) as unknown as Node

/**
 * A board with the starters' grammar: Question → options → factors → outcomes /
 * risks → Goal, every option feeding every factor, every factor feeding every
 * consequence. `h(kind, i)` sets each card's height at the bound.
 */
function board(
  counts: { options: number; factors: number; outcomes: number; risks: number },
  h: (kind: string, i: number) => number,
): { nodes: Node[]; edges: Edge[]; heights: Map<string, number> } {
  const nodes: Node[] = [node('dec', 'decision', h('decision', 0))]
  const edges: Edge[] = []
  const add = (kind: string, n: number, prefix: string): string[] => {
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const id = `${prefix}_${i}`
      nodes.push(node(id, kind, h(kind, i)))
      ids.push(id)
    }
    return ids
  }
  const opts = add('option', counts.options, 'opt')
  const facs = add('factor', counts.factors, 'fac')
  const cons = [...add('outcome', counts.outcomes, 'out'), ...add('risk', counts.risks, 'risk')]
  nodes.push(node('goal', 'goal', h('goal', 0)))
  for (const o of opts) edges.push({ id: `dec-${o}`, source: 'dec', target: o })
  for (const o of opts) for (const f of facs) edges.push({ id: `${o}-${f}`, source: o, target: f })
  for (const f of facs) for (const c of cons) edges.push({ id: `${f}-${c}`, source: f, target: c })
  for (const c of cons) edges.push({ id: `${c}-goal`, source: c, target: 'goal' })
  const heights = new Map(nodes.map((n) => [n.id, (n as unknown as { measured: { height: number } }).measured.height]))
  return { nodes, edges, heights }
}

type Box = RouteBox & { tier: number }

/** Every laid-out card as the box it occupies: its drawn width, its bound height. */
function boxesOf(nodes: Node[], widths: Record<string, number>, heights: Map<string, number>): Box[] {
  return nodes
    .filter((n) => !isGhostNode(n.id))
    .map((n) => {
      const tier = TIER_BY_KIND[n.type as string]
      const width = widths[n.type as string] ?? cardWidthCapForTier(tier)
      return { id: n.id, x: n.position.x, y: n.position.y, width, height: heights.get(n.id)!, tier }
    })
}

const inside = (p: { x: number; y: number }, b: RouteBox, inset = 1): boolean =>
  p.x > b.x + inset && p.x < b.x + b.width - inset && p.y > b.y + inset && p.y < b.y + b.height - inset

/** Sample a path made of M/L/C commands at `n` points per segment. */
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
    }
  }
  return pts
}

/** The edge's endpoints as xyflow supplies them: source bottom-centre, target top-centre. */
function endpoints(src: Box, tgt: Box) {
  return { sx: src.x + src.width / 2, sy: src.y + src.height, tx: tgt.x + tgt.width / 2, ty: tgt.y }
}

/** The contract's plain near-straight cubic (`StyledEdge` E9), for the contrast arm. */
function plainPath(sx: number, sy: number, tx: number, ty: number): string {
  const bend = Math.max(6, Math.min(30, (ty - sy) / 2))
  return `M${sx},${sy} C${sx},${sy + bend} ${tx},${ty - bend} ${tx},${ty}`
}

/** Non-endpoint cards an edge's drawn path runs under, sampled over its whole length. */
function cardsUnder(path: string, src: Box, tgt: Box, boxes: Box[]): string[] {
  const hit = new Set<string>()
  for (const p of samplePath(path)) for (const b of boxes) if (b.id !== src.id && b.id !== tgt.id && inside(p, b, 3)) hit.add(b.id)
  return [...hit]
}

/* Height profiles: ascending, descending, tall-in-the-middle, and alternating, with a 4.2× spread. */
const PROFILES: Record<string, (kind: string, i: number) => number> = {
  ascending: (k, i) => (k === 'decision' || k === 'goal' ? 110 : 100 + 45 * i),
  descending: (k, i) => (k === 'decision' || k === 'goal' ? 110 : 420 - 45 * i),
  tallMiddle: (k, i) => (k === 'decision' || k === 'goal' ? 140 : i === 1 || i === 2 ? 420 : 100),
  alternating: (k, i) => (k === 'decision' || k === 'goal' ? 110 : i % 2 === 0 ? 100 : 380),
}
/** A board's counts, and optionally the sibling gap the layout is asked for (`layoutGraph`'s `spacing`). */
type Shape = { options: number; factors: number; outcomes: number; risks: number; spacing?: number }
const SHAPES: Record<string, Shape> = {
  'six factors (3+3), six consequences (3+3)': { options: 4, factors: 6, outcomes: 3, risks: 3 },
  'eight factors (4+4)': { options: 4, factors: 8, outcomes: 2, risks: 3 },
  'three options, seven factors (4+3)': { options: 3, factors: 7, outcomes: 2, risks: 2 },
  // 27 Sep 2026: five per row — a factor band that wraps 5+4 / 5+5 over a
  // consequence band that wraps 3+3 / 4+3. A factor → consequence link that
  // skips the first consequence course must not pass under a first-course card.
  'nine factors (5+4), six consequences (3+3)': { options: 4, factors: 9, outcomes: 3, risks: 3 },
  'ten factors (5+5), seven consequences (4+3)': { options: 4, factors: 10, outcomes: 3, risks: 4 },
  // …and the same two at a sibling gap of 32 (the constant before 27 Sep's
  // 32 → 24; `layoutGraph` still takes it as `spacing`). On tall-middle,
  // fac_5 → risk_1's diagonal cut out_0's lower-left corner BETWEEN two of the
  // router's 64 point samples, so the router called it clear and drew no lead.
  'nine factors (5+4), six consequences (3+3), sibling gap 32': { options: 4, factors: 9, outcomes: 3, risks: 3, spacing: 32 },
  'ten factors (5+5), seven consequences (4+3), sibling gap 32': { options: 4, factors: 10, outcomes: 3, risks: 4, spacing: 32 },
}

/* ── #10 + mixed heights ──────────────────────────────────────────────────── */

describe('WS1 #10 — a wrapped family is laid in brick courses', () => {
  it('eight factors: the FIRST course is shifted by half a stride, so the block stays at 4 cards + prompt', async () => {
    const { nodes, edges, heights } = board({ options: 3, factors: 8, outcomes: 1, risks: 1 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const facs = out.nodes.filter((n) => n.id.startsWith('fac_'))
    const ys = [...new Set(facs.map((n) => n.position.y))].sort((a, b) => a - b)
    expect(ys).toHaveLength(2)
    const left = (y: number) => Math.min(...facs.filter((n) => n.position.y === y).map((n) => n.position.x))
    const stride = REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP
    expect(left(ys[0]!) - left(ys[1]!)).toBeCloseTo(stride / 2, 6)
    // The block: the shifted upper course, or the lower course plus the row-end
    // prompt slot, whichever reaches further right.
    const rightOf = (y: number) => Math.max(...facs.filter((n) => n.position.y === y).map((n) => n.position.x + REPEATED_CARD_W + LAYOUT_PADDING_X))
    const block = Math.max(rightOf(ys[0]!), rightOf(ys[1]!) + LAYOUT_NODE_GAP + ROW_PROMPT_W) - left(ys[1]!)
    expect(block).toBeCloseTo(4 * (REPEATED_CARD_W + LAYOUT_PADDING_X) + 3 * LAYOUT_NODE_GAP + LAYOUT_NODE_GAP + ROW_PROMPT_W, 6)
    expect(block).toBeLessThanOrEqual(CANONICAL_LAYOUT_WIDTH)
  })

  it('seven factors (4+3): the SECOND course is shifted (the narrower of the two brick choices)', async () => {
    const { nodes, edges, heights } = board({ options: 2, factors: 7, outcomes: 1, risks: 0 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const facs = out.nodes.filter((n) => n.id.startsWith('fac_'))
    const ys = [...new Set(facs.map((n) => n.position.y))].sort((a, b) => a - b)
    const left = (y: number) => Math.min(...facs.filter((n) => n.position.y === y).map((n) => n.position.x))
    expect(left(ys[1]!) - left(ys[0]!)).toBeCloseTo((REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP) / 2, 6)
  })

  it('CONTRAST — a family that does not wrap is not shifted', async () => {
    const { nodes, edges, heights } = board({ options: 3, factors: 4, outcomes: 1, risks: 1 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const facs = out.nodes.filter((n) => n.id.startsWith('fac_'))
    expect(new Set(facs.map((n) => n.position.y)).size).toBe(1)
  })
})

describe('WS1 mixed-height / tall-card check — every card and every edge sampled over its whole extent', () => {
  for (const [shapeName, counts] of Object.entries(SHAPES)) {
    for (const [profile, h] of Object.entries(PROFILES)) {
      it(`${shapeName}, ${profile}: no two cards overlap, and no edge runs under a card that is not its endpoint`, async () => {
        const { nodes, edges, heights } = board(counts, h)
        const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights, spacing: counts.spacing })
        const boxes = boxesOf(out.nodes, out.layoutCardWidths, heights)
        // Cards: full-rectangle intersection, not a midpoint sample.
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!
            const b = boxes[j]!
            const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
            const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
            expect(ix > 0 && iy > 0, `${a.id} overlaps ${b.id}`).toBe(false)
          }
        }
        // Edges: the drawn path (with its leads) sampled end to end.
        const byId = new Map(boxes.map((b) => [b.id, b]))
        const under: string[] = []
        for (const e of edges) {
          const src = byId.get(e.source)!
          const tgt = byId.get(e.target)!
          const { sx, sy, tx, ty } = endpoints(src, tgt)
          const leads = resolveLayeredEdgeLeads(src.id, tgt.id, sx, sy, tx, ty, boxes)
          const path = leads ? layeredLeadPath(sx, sy, tx, ty, leads)[0] : plainPath(sx, sy, tx, ty)
          for (const id of cardsUnder(path, src, tgt, boxes)) under.push(`${e.id} under ${id}`)
        }
        expect(under).toEqual([])
      })
    }
  }

  it('CONTRAST — the probe bites: the plain diagonal (no leads) runs under cards on the tall-middle eight-factor board', async () => {
    const { nodes, edges, heights } = board(SHAPES['eight factors (4+4)'], PROFILES.tallMiddle!)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const boxes = boxesOf(out.nodes, out.layoutCardWidths, heights)
    const byId = new Map(boxes.map((b) => [b.id, b]))
    let hits = 0
    for (const e of edges) {
      const src = byId.get(e.source)!
      const tgt = byId.get(e.target)!
      const { sx, sy, tx, ty } = endpoints(src, tgt)
      hits += cardsUnder(plainPath(sx, sy, tx, ty), src, tgt, boxes).length
    }
    expect(hits).toBeGreaterThan(10)
  })
})

describe('WS1 #10 — resolveLayeredEdgeLeads', () => {
  const B = (id: string, x: number, y: number, w: number, h: number, tier: number): Box => ({ id, x, y, width: w, height: h, tier })

  it('a short source beside a taller row-mate leaves below the row-mate before it turns', () => {
    const boxes = [B('s', 400, 0, 260, 100, 1), B('tall', 100, 0, 260, 300, 1), B('t', 0, 400, 260, 100, 2)]
    const leads = resolveLayeredEdgeLeads('s', 't', 530, 100, 130, 400, boxes)
    expect(leads).not.toBeNull()
    expect(leads!.outY).toBeGreaterThanOrEqual(300)
    expect(leads!.inY).toBe(400)
  })

  it('a target in the far course is entered from above the near course', () => {
    const boxes = [B('s', 0, 0, 260, 100, 1), B('near', 100, 200, 260, 150, 2), B('t', 250, 400, 260, 100, 2)]
    const leads = resolveLayeredEdgeLeads('s', 't', 130, 100, 380, 400, boxes)
    expect(leads).not.toBeNull()
    expect(leads!.inY).toBeLessThanOrEqual(200)
    expect(leads!.outY).toBe(100)
  })

  /*
   * 27 Sep 2026 — the nine-factor board at sibling gap 32, tall-middle, as laid
   * out (fac_5 → risk_1 past out_0). The plain diagonal cuts out_0's lower-left
   * corner — (407.1, 1407.5) at t = 0.35 — but the router's 64 point samples
   * straddle it: (403.8, 1403.3) at t = 22/64 is left of the card and
   * (412.0, 1413.9) at t = 23/64 is below it. The curve is inside the card only
   * for t in [0.3441, 0.3566], at most 3.7 units deep — between those two
   * samples — so the router saw nothing in the way and drew no lead.
   */
  const CORNER_CUT = {
    boxes: [
      B('fac_5', 176, 1156, 248, 100, 2), B('fac_6', 480, 1156, 248, 100, 2),
      B('out_0', 404, 1312, 248, 100, 3), B('out_1', 708, 1312, 248, 420, 3),
      B('risk_0', 252, 1772, 248, 100, 3), B('risk_1', 556, 1772, 248, 420, 3),
    ],
    sx: 300, sy: 1256, tx: 680, ty: 1772,
  }

  it('CONTRAST — the corner cut is real: the plain diagonal runs under out_0 (the probe sees it)', () => {
    const { boxes, sx, sy, tx, ty } = CORNER_CUT
    const src = boxes.find((b) => b.id === 'fac_5')!
    const tgt = boxes.find((b) => b.id === 'risk_1')!
    expect(cardsUnder(plainPath(sx, sy, tx, ty), src, tgt, boxes)).toEqual(['out_0'])
  })

  it('a diagonal that cuts a card\'s corner between two samples still gets its lead-in, and the drawn path is clear', () => {
    const { boxes, sx, sy, tx, ty } = CORNER_CUT
    const src = boxes.find((b) => b.id === 'fac_5')!
    const tgt = boxes.find((b) => b.id === 'risk_1')!
    const leads = resolveLayeredEdgeLeads('fac_5', 'risk_1', sx, sy, tx, ty, boxes)
    expect(leads).not.toBeNull()
    expect(leads!.inY).toBeLessThanOrEqual(1312 - 10)
    expect(cardsUnder(layeredLeadPath(sx, sy, tx, ty, leads!)[0], src, tgt, boxes)).toEqual([])
  })

  it('CONTRAST — nothing in the way: no leads, the plain diagonal', () => {
    const boxes = [B('s', 0, 0, 260, 100, 1), B('t', 0, 200, 260, 100, 2)]
    expect(resolveLayeredEdgeLeads('s', 't', 130, 100, 130, 200, boxes)).toBeNull()
  })

  it('an upward or same-tier edge is not this function\'s case', () => {
    const boxes = [B('s', 0, 0, 260, 100, 2), B('t', 400, 0, 260, 100, 2)]
    expect(resolveLayeredEdgeLeads('s', 't', 130, 100, 530, 0, boxes)).toBeNull()
  })
})

/* ── #11 ──────────────────────────────────────────────────────────────────── */

/*
 * The visible gap was 48 here until the review of #2074 (Blocker 1): at the
 * bound the kind shape's 24-unit overhang and the band title's 24-unit line
 * need 64 with their clearances, so the constant went back to 48 (64 visible).
 * 27 Sep 2026: Paul's laptop-width ruling — the constant is 40 (56 visible).
 * 27 Sep 2026, landing text cap 1.36 → 1.64: the budget is 63.04, so the constant
 * rose by the rounded-up shortfall, 40 → 48 (64 visible) — Canvas owner.
 * The budget itself is asserted by `bandTitleClearsKindGlyph.guard.spec.ts`;
 * this arm keeps #11's point — ONE gap, whatever a browser persisted.
 */
describe('WS1 #11 — the row gap is one constant: 64 visible units, whatever layerSpacing a browser persisted', () => {
  for (const layerSpacing of [undefined, 30, 48, 64, 90]) {
    it(`layerSpacing ${String(layerSpacing)} → the gap between two rows is ${LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y}`, async () => {
      const nodes = [node('dec', 'decision', 100), node('opt', 'option', 100)]
      const out = await layoutGraph(nodes, [{ id: 'e', source: 'dec', target: 'opt' }] as Edge[], {
        layerSpacing,
        heightAtLabelBound: new Map([['dec', 100], ['opt', 100]]),
      })
      const dec = out.nodes.find((n) => n.id === 'dec')!
      const opt = out.nodes.find((n) => n.id === 'opt')!
      expect(opt.position.y - (dec.position.y + 100)).toBe(LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y)
      expect(LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y).toBe(64)
    })
  }
})

/* ── #27 ──────────────────────────────────────────────────────────────────── */

describe('WS1 #27 — one row-end prompt per band', () => {
  const laid = async (outcomes: number, risks: number) => {
    const { nodes, edges, heights } = board({ options: 2, factors: 2, outcomes, risks }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    return withGhostTiers(out.nodes).filter((n) => isGhostNode(n.id))
  }

  it('outcomes AND risks share ONE door: "What else could follow?", asking about both', async () => {
    const ghosts = await laid(2, 2)
    const consequence = ghosts.filter((g) => ['outcome', 'risk', 'consequence'].includes((g.data as { tier?: string }).tier ?? ''))
    expect(consequence.map((g) => g.id)).toEqual([CONSEQUENCE_DOOR_ID])
    const data = consequence[0]!.data as { label: string; prompt: string }
    expect(data.label).toBe(CONSEQUENCE_DOOR_LABEL)
    expect(data.label.endsWith('?')).toBe(true)
    expect(data.prompt).toContain('2 outcomes')
    expect(data.prompt).toContain('2 risks')
    expect(data.prompt).toMatch(/go wrong/)
    // Every band has at most one prompt.
    expect(ghosts.map((g) => g.id).sort()).toEqual([CONSEQUENCE_DOOR_ID, '__ghost-factor__', '__ghost-option__'].sort())
  })

  it('CONTRAST — a band of risks only keeps the risk door', async () => {
    const ghosts = await laid(0, 2)
    expect(ghosts.map((g) => g.id)).toContain('__ghost-risk__')
    expect(ghosts.map((g) => g.id)).not.toContain(CONSEQUENCE_DOOR_ID)
  })
})

/* ── #28 ──────────────────────────────────────────────────────────────────── */

describe('WS1 #28 — a polarity glyph keeps off the band title', () => {
  // ⚠ RE-WRITTEN 28 Sep 2026 (canvas/paul-test-edges): the sign no longer stands
  // in a row that the title shifts sideways by whole slots — that shift is what
  // left a `+` 130 flow units off its own line on Paul's `pa_vs_ai`. Each sign
  // now sits ON its own line (`edgeGlyphPlacement.ts` rule B) and slides ALONG
  // it off the title; and a card whose apex the title covers takes its link just
  // past the word (rule A). Judged at the bound: the title box is `boxAtBound`,
  // the sign's box `GLYPH_PAINTED_BOX_FLOW`, the head the widest band's.
  const AT_BOUND = glyphMetricsAt(3, MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE)
  const reach = AT_BOUND.halfBox + AT_BOUND.gap
  const clear = (p: { x: number; y: number }, k: { x0: number; y0: number; x1: number; y1: number }) =>
    p.x + reach <= k.x0 || p.x - reach >= k.x1 || p.y + reach <= k.y0 || p.y - reach >= k.y1
  /** A link falling into a card whose top is y 1000, from up and to the right. */
  const LINE = flattenSvgPath('M300,940 C300,970 100,970 100,1000')!

  it('a sign whose natural spot is on the title slides along its own line off it', () => {
    const free = resolvePolarityGlyphOnPath(LINE, 1000, AT_BOUND)
    const title = { x0: free.x - 40, y0: free.y - 15, x1: free.x + 40, y1: free.y + 15 }
    expect(clear(free, title)).toBe(false) // CONTRAST: without the keep-out it IS on the title
    const moved = resolvePolarityGlyphOnPath(LINE, 1000, AT_BOUND, [title])
    expect(moved.clear).toBe(true)
    expect(clear(moved, title)).toBe(true)
    // ON its own line: within a unit of the flattened path's nearest segment.
    let off = Infinity
    for (let k = 1; k < LINE.points.length; k++) {
      const a = LINE.points[k - 1]
      const b = LINE.points[k]
      const vx = b.x - a.x
      const vy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((moved.x - a.x) * vx + (moved.y - a.y) * vy) / (vx * vx + vy * vy)))
      off = Math.min(off, Math.hypot(moved.x - (a.x + t * vx), moved.y - (a.y + t * vy)))
    }
    expect(off).toBeLessThan(1)
  })

  it('a thin title strip over the sign\'s spot still moves it', () => {
    const free = resolvePolarityGlyphOnPath(LINE, 1000, AT_BOUND)
    const title = { x0: free.x - 40, y0: free.y - 2, x1: free.x + 40, y1: free.y + 2 }
    expect(clear(free, title)).toBe(false)
    expect(clear(resolvePolarityGlyphOnPath(LINE, 1000, AT_BOUND, [title]), title)).toBe(true)
  })

  it('two links from the same place into one card still get distinct arrivals, and distinct signs under a keep-out', () => {
    const card = { x: 0, width: 720 }
    const siblings = [
      { id: 'a', sourceCentre: { x: 360, y: -400 } },
      { id: 'b', sourceCentre: { x: 360, y: -400 } },
    ]
    const a = resolveArrivalSlot('a', card, siblings)
    const b = resolveArrivalSlot('b', card, siblings)
    expect(a).not.toEqual(b)
    const lineOf = (dx: number) => flattenSvgPath(`M360,700 C360,850 ${360 + dx},850 ${360 + dx},1000`)!
    const title = { x0: 300, y0: 940, x1: 420, y1: 960 }
    const ga = resolvePolarityGlyphOnPath(lineOf(a.dx), 1000, AT_BOUND, [title])
    const gb = resolvePolarityGlyphOnPath(lineOf(b.dx), 1000, AT_BOUND, [title])
    expect(Math.hypot(ga.x - gb.x, ga.y - gb.y)).toBeGreaterThan(2 * AT_BOUND.halfBox)
    expect(clear(ga, title) && clear(gb, title)).toBe(true)
  })

  it('on a laid-out board, the first consequence card\'s one link arrives past its row\'s band word', async () => {
    const { nodes, edges, heights } = board({ options: 2, factors: 2, outcomes: 2, risks: 1 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const laid = out.nodes.map((n) => ({ ...n, measured: { width: REPEATED_CARD_W, height: heights.get(n.id) } })) as Node[]
    const lane = deriveTierLanes(laid).find((l) => l.tier === TIER_BY_KIND.outcome)!
    const first = laid.filter((n) => TIER_BY_KIND[n.type as string] === lane.tier).sort((p, q) => p.position.x - q.position.x)[0]
    const title = tierLaneTitleBoxFor(laid, first.id)!
    const cx = first.position.x + REPEATED_CARD_W / 2
    // PRECONDITION: the word stands over that card's apex.
    expect(title.x0).toBeLessThan(cx)
    expect(title.x1).toBeGreaterThan(cx)
    const slot = resolveArrivalSlot('e', { x: first.position.x, width: REPEATED_CARD_W }, [{ id: 'e', sourceCentre: { x: cx + 300, y: 0 } }], title)
    expect(slot.onKindShape).toBe(false)
    expect(cx + slot.dx).toBeGreaterThan(title.x1)
  })

  it('the title box is the band label\'s own, left-anchored at the board column, above the row', async () => {
    const { nodes, edges, heights } = board({ options: 2, factors: 2, outcomes: 2, risks: 1 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    const laid = out.nodes.map((n) => ({ ...n, measured: { width: REPEATED_CARD_W, height: heights.get(n.id) } })) as Node[]
    const box = tierLaneTitleBoxFor(laid, 'out_0')!
    const lane = deriveTierLanes(laid).find((l) => l.tier === TIER_BY_KIND.outcome)!
    expect(box.y1).toBeLessThan(lane.y)
    expect(box.x0).toBe(Math.min(...deriveTierLanes(laid).map((l) => l.x)))
    expect(tierLaneTitleBoxFor(laid, 'no-such-node')).toBeUndefined()
  })
})

/* ── #26 ──────────────────────────────────────────────────────────────────── */

describe('WS1 #26 — the band titles are the contract\'s words', () => {
  it('EXPLORATION / ALTERNATIVES / FACTORS / OUTCOMES / RISKS / GOAL', async () => {
    const { nodes, edges, heights } = board({ options: 2, factors: 2, outcomes: 1, risks: 1 }, () => 150)
    const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
    expect(deriveTierLanes(out.nodes).map((l) => l.title)).toEqual(['EXPLORATION', 'ALTERNATIVES', 'FACTORS', 'OUTCOMES / RISKS', 'GOAL'])
  })

  it('the consequence band names what it holds: risks only → RISKS, outcomes only → OUTCOMES', async () => {
    for (const [o, r, want] of [[0, 2, 'RISKS'], [2, 0, 'OUTCOMES']] as const) {
      const { nodes, edges, heights } = board({ options: 1, factors: 1, outcomes: o, risks: r }, () => 150)
      const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
      expect(deriveTierLanes(out.nodes).find((l) => l.tier === 3)!.title).toBe(want)
    }
  })
})

/* ── #17 ──────────────────────────────────────────────────────────────────── */

/**
 * Evaluate the spacer's CSS width at a (text, glyph) scale pair, with `100%` = the
 * title box. Since the landing text ceiling (27 Sep 2026) the mark grows with the
 * GLYPH scale and the title word with the TEXT scale; at the landing bound they
 * are `MAX_LABEL_COUNTER_SCALE` and `MAX_GLYPH_COUNTER_SCALE`.
 */
const AT_BOUND = { text: MAX_LABEL_COUNTER_SCALE, glyph: MAX_GLYPH_COUNTER_SCALE }
function spacerWidthPx(width: string, scale: number | { text: number; glyph: number }, boxPx: number): number {
  const { text, glyph } = typeof scale === 'number' ? { text: scale, glyph: scale } : scale
  const js = width
    .replace(/var\(--canvas-label-scale, 1\)/g, `(${text})`)
    .replace(/var\(--canvas-glyph-scale, 1\)/g, `(${glyph})`)
    .replace(/100%/g, `(${boxPx})`)
    .replace(/px/g, '')
    .replace(/calc\(/g, '(')
    .replace(/clamp\(/g, 'cl(')
    .replace(/max\(/g, 'Math.max(')
  const cl = (a: number, b: number, c: number) => Math.min(Math.max(a, b), c)
  return new Function('cl', `return ${js}`)(cl) as number
}

describe('WS1 #17 — the title yields line 1 to the corner mark only when ITS first word needs it', () => {
  const box = { measurePx: 234, rightToFramePx: 12, topPx: 12 }
  it('a short first word ("Top", 27px) shares line 1 with the mark at the landing bound', () => {
    const s = cornerMarksTitleSpacerCss(1, { ...box, firstWordPx: 27 })!
    expect(spacerWidthPx(s.width, AT_BOUND, box.measurePx)).toBeLessThan(box.measurePx / 2)
  })
  // ⚠ RE-SPECIFIED 27 Sep 2026 (landing text ceiling): at the bound the title word
  // is 1.36x and the mark 2x, so on this box a first word yields line 1 only past
  // (234 + 12 − 8 − 25 × 2) / 1.36 ≈ 138px. "Cannibalization" (105.3px), which
  // yielded at a shared 2x, now SHARES line 1; the contrast is a wider word.
  it('"Cannibalization" (105px) now SHARES line 1 at the bound — its 1.36x width fits beside the 2x mark', () => {
    const s = cornerMarksTitleSpacerCss(1, { ...box, firstWordPx: 105.3 })!
    expect(spacerWidthPx(s.width, AT_BOUND, box.measurePx)).toBeLessThan(box.measurePx / 2)
  })
  it('CONTRAST — a 140px first word cannot share line 1 at the bound: the spacer takes the whole line', () => {
    const s = cornerMarksTitleSpacerCss(1, { ...box, firstWordPx: 140 })!
    expect(spacerWidthPx(s.width, AT_BOUND, box.measurePx)).toBeCloseTo(box.measurePx, 3)
  })
  it('no text metrics (jsdom) assumes the widest word: it shares line 1 beside ONE mark at the bound, and yields to TWO', () => {
    const one = cornerMarksTitleSpacerCss(1, box)!
    expect(spacerWidthPx(one.width, AT_BOUND, box.measurePx)).toBeLessThan(box.measurePx / 2)
    const two = cornerMarksTitleSpacerCss(2, box)!
    expect(spacerWidthPx(two.width, AT_BOUND, box.measurePx)).toBeCloseTo(box.measurePx, 3)
  })
  it('at 100% even the widest word shares line 1 (unchanged)', () => {
    const s = cornerMarksTitleSpacerCss(1, { ...box, firstWordPx: 105.3 })!
    expect(spacerWidthPx(s.width, 1, box.measurePx)).toBeLessThan(box.measurePx / 2)
  })
})

/* ── #25 ──────────────────────────────────────────────────────────────────── */

describe('WS1 #25 — the far-zoom title holds the contract\'s 9px chip size', () => {
  it('at the six-zoom-outs camera (0.167) the title renders at 9px, not 4.7px', () => {
    const z = 0.167
    expect(CANVAS_TYPE_PX.nodeTitle * labelCounterScale(z) * z).toBeLessThan(5)
    expect(CANVAS_TYPE_PX.nodeTitle * farTitleScale(z) * z).toBeCloseTo(FAR_TITLE_PX, 6)
  })
  it('CONTRAST — at and above the landing floor it is the ordinary label scale', () => {
    for (const z of [0.5, 0.75, 1, 2]) expect(farTitleScale(z)).toBe(labelCounterScale(z))
    // 27 Sep 2026: under the 1.36 text ceiling the far chip lifts the title from
    // 9 / (14 × 1.36) ≈ 0.473 down — so at 0.35 (the `line` rung) it is above
    // the ordinary scale, holding the contract's 9px where the capped title
    // would draw 6.66px. (At the old 2x cap the two met down to 0.32.)
    expect(farTitleScale(0.35)).toBeGreaterThan(labelCounterScale(0.35))
    expect(CANVAS_TYPE_PX.nodeTitle * farTitleScale(0.35) * 0.35).toBeCloseTo(FAR_TITLE_PX, 6)
  })
  it('is bounded at twice the landing bound — the GLYPH bound, so the 9px chip survives the text ceiling', () => {
    expect(farTitleScale(0.05)).toBe(FAR_TITLE_MAX_SCALE)
    expect(FAR_TITLE_MAX_SCALE).toBe(2 * MAX_GLYPH_COUNTER_SCALE)
  })
})
