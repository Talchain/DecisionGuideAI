/**
 * ⭐⭐ CANVAS v3.1 WS1 — LANDING COMPOSITION (26 Sep 2026).
 *
 * The pure-function half of WS1's rows in `DESIGN-GAP-v31.md`, bound by node
 * identity and by the real `layoutGraph` / `withGhostTiers` / placement code:
 *   #10 edges never run under a non-endpoint card (brick courses + vertical leads)
 *   #11 the row gap is one constant (48 visible), whatever a browser persisted
 *   #17 the corner-mark spacer yields line 1 only when THIS title's first word needs it
 *   #25 far-zoom title scale
 *   #26 band words
 *   #27 one row-end prompt per band
 *   #28 polarity glyphs keep off the band titles
 * plus the MIXED-HEIGHT / TALL-CARD check a prior reviewer asked for: digest
 * specs laid out at height 100 prove row assignment only, so this lays out
 * boards whose cards differ in height by up to 4×, in both orders, and samples
 * every card and every edge over its WHOLE extent.
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
import { resolvePolarityGlyphOffset, GLYPH_PAINTED_BOX_FLOW } from '../utils/edgeGlyphPlacement'
import { deriveTierLanes, tierLaneTitleBoxFor } from '../utils/tierLanes'
import { cornerMarksTitleSpacerCss } from '../nodes/shared/canvasGlyphScale'
import { farTitleScale, labelCounterScale, FAR_TITLE_PX, FAR_TITLE_MAX_SCALE, MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'
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
const SHAPES = {
  'five factors (3+2), five consequences (3+2)': { options: 4, factors: 5, outcomes: 2, risks: 3 },
  'eight factors (4+4)': { options: 4, factors: 8, outcomes: 2, risks: 3 },
  'three options, seven factors (4+3)': { options: 3, factors: 7, outcomes: 2, risks: 2 },
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

  it('five factors: the SECOND course is shifted (the narrower of the two brick choices)', async () => {
    const { nodes, edges, heights } = board({ options: 2, factors: 5, outcomes: 1, risks: 0 }, () => 150)
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
        const out = await layoutGraph(nodes, edges, { heightAtLabelBound: heights })
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

describe('WS1 #11 — the row gap is one constant: 48 visible units, whatever layerSpacing a browser persisted', () => {
  for (const layerSpacing of [undefined, 30, 48, 90]) {
    it(`layerSpacing ${String(layerSpacing)} → the gap between two rows is ${LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y}`, async () => {
      const nodes = [node('dec', 'decision', 100), node('opt', 'option', 100)]
      const out = await layoutGraph(nodes, [{ id: 'e', source: 'dec', target: 'opt' }] as Edge[], {
        layerSpacing,
        heightAtLabelBound: new Map([['dec', 100], ['opt', 100]]),
      })
      const dec = out.nodes.find((n) => n.id === 'dec')!
      const opt = out.nodes.find((n) => n.id === 'opt')!
      expect(opt.position.y - (dec.position.y + 100)).toBe(LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y)
      expect(LAYOUT_LAYER_GAP + LAYOUT_PADDING_Y).toBe(48)
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
  const half = GLYPH_PAINTED_BOX_FLOW / 2
  const clear = (o: { dx: number; dy: number }, k: { x0: number; y0: number; x1: number; y1: number }) =>
    o.dx + half <= k.x0 || o.dx - half >= k.x1 || o.dy + half <= k.y0 || o.dy - half >= k.y1

  it('a glyph whose natural spot is on the title moves off it', () => {
    const target = { x: 0, y: 60 }
    const siblings = [{ id: 'e1', sourceCentre: { x: 0, y: -400 } }]
    const free = resolvePolarityGlyphOffset('e1', target, siblings)
    // A title box covering the natural spot.
    const keepOut = { x0: free.dx - 40, y0: free.dy - 15, x1: free.dx + 40, y1: free.dy + 15 }
    expect(clear(free, keepOut)).toBe(false) // CONTRAST: without the keep-out it IS on the title
    const moved = resolvePolarityGlyphOffset('e1', target, siblings, keepOut)
    expect(clear(moved, keepOut)).toBe(true)
  })

  it('two edges approaching from the same direction still get distinct spots under a keep-out', () => {
    const target = { x: 0, y: 60 }
    const siblings = [
      { id: 'a', sourceCentre: { x: 0, y: -400 } },
      { id: 'b', sourceCentre: { x: 0, y: -400 } },
    ]
    const base = resolvePolarityGlyphOffset('a', target, siblings)
    const keepOut = { x0: base.dx - 40, y0: base.dy - 15, x1: base.dx + 40, y1: base.dy + 15 }
    const a = resolvePolarityGlyphOffset('a', target, siblings, keepOut)
    const b = resolvePolarityGlyphOffset('b', target, siblings, keepOut)
    expect(a).not.toEqual(b)
    expect(clear(a, keepOut) && clear(b, keepOut)).toBe(true)
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

/** Evaluate the spacer's CSS width at a label scale, with `100%` = the title box. */
function spacerWidthPx(width: string, scale: number, boxPx: number): number {
  const js = width
    .replace(/var\(--canvas-label-scale, 1\)/g, `(${scale})`)
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
    expect(spacerWidthPx(s.width, MAX_LABEL_COUNTER_SCALE, box.measurePx)).toBeLessThan(box.measurePx / 2)
  })
  it('CONTRAST — "Cannibalization" (105px) cannot share line 1 at the bound: the spacer takes the whole line', () => {
    const s = cornerMarksTitleSpacerCss(1, { ...box, firstWordPx: 105.3 })!
    expect(spacerWidthPx(s.width, MAX_LABEL_COUNTER_SCALE, box.measurePx)).toBeCloseTo(box.measurePx, 3)
  })
  it('no text metrics (jsdom) keeps the old, conservative yield', () => {
    const s = cornerMarksTitleSpacerCss(1, box)!
    expect(spacerWidthPx(s.width, MAX_LABEL_COUNTER_SCALE, box.measurePx)).toBeCloseTo(box.measurePx, 3)
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
    for (const z of [0.35, 0.5, 0.75, 1, 2]) expect(farTitleScale(z)).toBe(labelCounterScale(z))
  })
  it('is bounded at twice the landing bound', () => {
    expect(farTitleScale(0.05)).toBe(FAR_TITLE_MAX_SCALE)
    expect(FAR_TITLE_MAX_SCALE).toBe(2 * MAX_LABEL_COUNTER_SCALE)
  })
})
