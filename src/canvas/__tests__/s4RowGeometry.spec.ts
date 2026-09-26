/**
 * ⭐⭐ S4 ROW GEOMETRY — Experience Design's locked choices, bound by node identity.
 *
 * #63 5806207128 / 5806266691 (24 Sep 2026):
 *   · "Repeated cards target 248px: Option, Factor, Outcome and Risk." — raised
 *     to the legibility floor `NODE_LAYOUT_MIN_W` (260), the bounded exception
 *     ED allowed "if code proves a hard minimum".
 *   · "Question and Goal ≤460px, wide and shallow."
 *   · "Do not let one long title widen an entire row."
 *   · "Rows above 5 cards wrap into balanced sub-rows under ONE left family
 *     label. 6→3+3, 7→4+3, 8→4+4, 9→5+4 … Keep causal reading order stable."
 *   · "Row-end reasoning prompts stay at the row end, 160px, inside the row
 *     budget … one prompt at the end of the final sub-row … if Outcome + Risk
 *     share one visual lane, use one 160px frontier column with the two small
 *     prompts stacked."
 *
 * Every assertion names the node it is about. Positions come from the real
 * `layoutGraph`; prompts from the real `withGhostTiers` on that output.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, balancedRowSizes, solveLayoutCardWidths } from '../utils/layout'
import { withGhostTiers } from '../utils/ghostTiers'
import { GHOST_OPTION_NODE_ID, isGhostNode } from '../utils/fitTargets'
import {
  ANCHOR_CARD_MAX_W,
  LAYOUT_LAYER_GAP,
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  MAX_CARDS_PER_ROW,
  NODE_LAYOUT_MIN_W,
  REPEATED_CARD_TARGET_W,
  REPEATED_CARD_W,
  ROW_PROMPT_H,
  ROW_PROMPT_W,
} from '../utils/nodeLayoutConstants'
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

const node = (id: string, type: string, h = 120, label = id): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, kind: type }, measured: { width: REPEATED_CARD_W, height: h } }) as unknown as Node

function fromDraft(d: Draft): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: d.nodes.map((n) => node(n.id, n.kind, 150, n.label)),
    edges: d.edges.map((e, i) => ({ id: `e${i}`, source: e.from!, target: e.to! })) as Edge[],
  }
}

/** A model whose factor tier holds exactly `n` factors, all fed by one option, in id order. */
function factorTier(n: number, factorH = 120): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [node('dec', 'decision'), node('opt_a', 'option'), node('opt_b', 'option')]
  const edges: Edge[] = [
    { id: 'd_a', source: 'dec', target: 'opt_a' },
    { id: 'd_b', source: 'dec', target: 'opt_b' },
  ]
  for (let i = 0; i < n; i++) {
    nodes.push(node(`fac_${i}`, 'factor', factorH))
    edges.push({ id: `a_${i}`, source: 'opt_a', target: `fac_${i}` })
  }
  nodes.push(node('goal', 'goal'))
  edges.push({ id: 'f_g', source: 'fac_0', target: 'goal' })
  return { nodes, edges }
}

/** Sub-rows of the nodes whose id starts with `prefix`: grouped by y, each ordered by x. */
function subRows(nodes: Node[], prefix: string): string[][] {
  const byY = new Map<number, Node[]>()
  for (const n of nodes.filter((x) => x.id.startsWith(prefix))) {
    const y = n.position.y
    byY.set(y, [...(byY.get(y) ?? []), n])
  }
  return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row.sort((a, b) => a.position.x - b.position.x).map((n) => n.id))
}

const byId = (nodes: Node[], id: string) => {
  const n = nodes.find((x) => x.id === id)
  if (!n) throw new Error(`no node ${id}`)
  return n
}

describe('S4 card widths', () => {
  it('the repeated-card width is the ED target raised to the legibility floor — 260, a bounded +12 exception', () => {
    expect(REPEATED_CARD_TARGET_W).toBe(248)
    expect(NODE_LAYOUT_MIN_W).toBe(260)
    expect(REPEATED_CARD_W).toBe(Math.max(REPEATED_CARD_TARGET_W, NODE_LAYOUT_MIN_W))
    expect(REPEATED_CARD_W).toBe(260)
  })

  it.each(Object.keys(STARTERS))('%s: options, factors, outcomes and risks all draw at the repeated width', async (id) => {
    const { nodes, edges } = fromDraft(STARTERS[id])
    const out = await layoutGraph(nodes, edges, {})
    for (const kind of ['option', 'factor', 'outcome', 'risk']) {
      expect(out.layoutCardWidths[kind], `${id}: ${kind}`).toBe(REPEATED_CARD_W)
    }
  })

  /** ED's ruled bound, written as the RULING says it — never read back from the
   *  constant under test (a mutant raising the constant would move both sides). */
  const ED_ANCHOR_MAX = 460

  it('the anchor cap is the ruled 460', () => {
    expect(ANCHOR_CARD_MAX_W).toBe(ED_ANCHOR_MAX)
  })

  it.each(Object.keys(STARTERS))('%s: the Question and the Goal are wide (≤460) and wider than a repeated card', async (id) => {
    const { nodes, edges } = fromDraft(STARTERS[id])
    const out = await layoutGraph(nodes, edges, {})
    for (const kind of ['decision', 'goal']) {
      expect(out.layoutCardWidths[kind], `${id}: ${kind}`).toBeLessThanOrEqual(ED_ANCHOR_MAX)
      expect(out.layoutCardWidths[kind], `${id}: ${kind}`).toBeGreaterThan(REPEATED_CARD_W)
    }
  })

  it('⛔ one long title does not widen its row — widths are a function of the graph, never of a label', async () => {
    const plain = factorTier(4)
    const long = factorTier(4)
    long.nodes = long.nodes.map((n) =>
      n.id === 'fac_2' ? ({ ...n, data: { ...(n.data as object), label: 'An extremely long factor title '.repeat(8) } } as Node) : n,
    )
    const a = await layoutGraph(plain.nodes, plain.edges, {})
    const b = await layoutGraph(long.nodes, long.edges, {})
    expect(b.layoutCardWidths).toEqual(a.layoutCardWidths)
    expect(b.layoutCardWidths.factor).toBe(REPEATED_CARD_W)
    expect(b.nodes.map((n) => [n.id, n.position.x])).toEqual(a.nodes.map((n) => [n.id, n.position.x]))
  })

  it('⭐ a wrapped row keeps full card width — and wrapping one tier does not shrink another', async () => {
    const { nodes, edges } = factorTier(9)
    const out = await layoutGraph(nodes, edges, {})
    // 9 → 3 + 3 + 3 under the four-card cap (gap 7; it was 5 + 4 under five).
    expect(subRows(out.nodes, 'fac_').length, 'precondition: the factor tier wrapped').toBe(3)
    expect(out.layoutCardWidths.factor).toBe(REPEATED_CARD_W)
    // The retired gate dropped EVERY tier to the floor once any tier split — the
    // Question included. Bound to the decision node's own tier.
    expect(out.layoutCardWidths.decision).toBe(ANCHOR_CARD_MAX_W)
    expect(solveLayoutCardWidths(nodes, {})).toEqual(out.layoutCardWidths)
  })
})

describe('S4 row wrapping — balanced sub-rows, order preserved', () => {
  // ⚠ GAP 7 (25 Sep 2026): ED's S4 table wrapped above FIVE (…9→5+4, 10→5+5).
  // ED #63 5808428246 made 1280x800 dock-open the acceptance size, where five
  // cards and the prompt spill 220 units (110px), so the Canvas lead capped a row at
  // FOUR with the same balanced wrap: 5→3+2, 9→3+3+3, 10→4+3+3; 6/7/8/11 are
  // unchanged.
  it('the sizes are the balanced table at a cap of four: 5→3+2, 6→3+3, 7→4+3, 8→4+4, 9→3+3+3, 10→4+3+3; four or fewer stay on one row', () => {
    expect(MAX_CARDS_PER_ROW).toBe(4)
    expect(balancedRowSizes(4)).toEqual([4])
    expect(balancedRowSizes(5)).toEqual([3, 2])
    expect(balancedRowSizes(6)).toEqual([3, 3])
    expect(balancedRowSizes(7)).toEqual([4, 3])
    expect(balancedRowSizes(8)).toEqual([4, 4])
    expect(balancedRowSizes(9)).toEqual([3, 3, 3])
    expect(balancedRowSizes(10)).toEqual([4, 3, 3])
    expect(balancedRowSizes(11)).toEqual([4, 4, 3])
  })

  it.each([
    [4, [4]],
    [5, [3, 2]],
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [9, [3, 3, 3]],
    [10, [4, 3, 3]],
  ])('%i factors lay out as %j sub-rows, in reading order fac_0, fac_1, …', async (n, sizes) => {
    const { nodes, edges } = factorTier(n)
    const out = await layoutGraph(nodes, edges, {})
    const rows = subRows(out.nodes, 'fac_')
    expect(rows.map((r) => r.length)).toEqual(sizes)
    // Reading order — left to right, then down — is the model order.
    expect(rows.flat()).toEqual(Array.from({ length: n }, (_, i) => `fac_${i}`))
  })

  it('sub-rows sit on ONE column grid: every course starts at the first course\'s left edge (design audit 26 Sep #12)', async () => {
    // Was, from v3.1 WS1 #10 until the 26 Sep design audit: "sub-rows are laid in
    // BRICK courses, half a stride apart". Served, the brick read as a staggered
    // band (pricing's factors at x 255.5 / 413.5 / 571.5 over 334.5 / 492.5);
    // the audit and the Canvas brief put every course back on one grid. The
    // edge trade that the brick was bought for is stated in `layout.ts`.
    const { nodes, edges } = factorTier(7)
    const out = await layoutGraph(nodes, edges, {})
    const [first, second] = subRows(out.nodes, 'fac_')
    // 7 → 4 + 3: card k of the second course stands on card k's column.
    second.forEach((id, k) => {
      expect(byId(out.nodes, id).position.x - byId(out.nodes, first[k]).position.x, `${id} under ${first[k]}`).toBe(0)
    })
    // …and the stride inside a sub-row is the card plus the card gap, exactly.
    expect(byId(out.nodes, first[1]).position.x - byId(out.nodes, first[0]).position.x).toBe(
      REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP,
    )
  })
})

describe('S4 row-end prompts — placed in the slot the layout reserved', () => {
  it('⭐ the factor prompt stands one card-gap after the LAST card of the FINAL sub-row (7 → 4+3)', async () => {
    const { nodes, edges } = factorTier(7)
    const out = await layoutGraph(nodes, edges, {})
    const [, finalRow] = subRows(out.nodes, 'fac_')
    const last = byId(out.nodes, finalRow[finalRow.length - 1])
    const prompts = withGhostTiers(out.nodes).filter((n) => isGhostNode(n.id))
    const factorPrompt = prompts.find((n) => n.id === '__ghost-factor__')!
    expect(factorPrompt, 'no factor prompt').toBeDefined()
    expect(factorPrompt.position).toEqual({
      x: last.position.x + REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP,
      y: last.position.y,
    })
    // ONE prompt for the family — never one per wrapped sub-row.
    expect(prompts.filter((n) => (n.data as { tier?: string }).tier === 'factor')).toHaveLength(1)
  })

  it('⭐ the prompt slot is INSIDE the row budget: the tier is centred as cards + prompt, so the prompt never widens the board past its widest row', async () => {
    // The widest single row: four since gap 7 (five would wrap 3 + 2).
    const { nodes, edges } = factorTier(4)
    const out = await layoutGraph(nodes, edges, {})
    const cards = out.nodes.filter((n) => n.id.startsWith('fac_')).sort((a, b) => a.position.x - b.position.x)
    const prompt = withGhostTiers(out.nodes).find((n) => n.id === '__ghost-factor__')!
    const rowLeft = cards[0].position.x
    const rowRight = prompt.position.x + ROW_PROMPT_W
    // The decision's box sits on the spine; the factor block (card boxes, gaps,
    // then the prompt, which has no trailing padding) is centred on the same
    // spine — so the two centres coincide, in box units on both sides.
    const dec = byId(out.nodes, 'dec')
    const decBoxCentre = dec.position.x + (out.layoutCardWidths.decision + LAYOUT_PADDING_X) / 2
    const blockCentre = rowLeft + (rowRight - rowLeft) / 2
    expect(Math.abs(blockCentre - decBoxCentre)).toBeLessThanOrEqual(1)
    // CONTRAST, same numbers: centring the CARDS alone would sit half a slot left.
    const cardsOnlyCentre = rowLeft + (cards.length * (REPEATED_CARD_W + LAYOUT_PADDING_X) + (cards.length - 1) * LAYOUT_NODE_GAP) / 2
    expect(Math.abs(cardsOnlyCentre - decBoxCentre)).toBeGreaterThan(50)
  })

  it('⭐ Outcome + Risk share ONE door at the row end — never two stacked (v3.1 WS1 #27, ED 5810951997 "once per row")', async () => {
    const nodes = [node('dec', 'decision'), node('opt', 'option'), node('fac', 'factor'), node('out_1', 'outcome'), node('risk_1', 'risk'), node('risk_2', 'risk'), node('goal', 'goal')]
    const edges = [
      { id: '1', source: 'dec', target: 'opt' }, { id: '2', source: 'opt', target: 'fac' },
      { id: '3', source: 'fac', target: 'out_1' }, { id: '4', source: 'fac', target: 'risk_1' },
      { id: '5', source: 'fac', target: 'risk_2' }, { id: '6', source: 'out_1', target: 'goal' },
    ] as Edge[]
    const out = await layoutGraph(nodes, edges, {})
    const prompts = withGhostTiers(out.nodes)
    const ids = prompts.filter((n) => isGhostNode(n.id)).map((n) => n.id)
    expect(ids).not.toContain('__ghost-outcome__')
    expect(ids).not.toContain('__ghost-risk__')
    const door = byId(prompts, '__ghost-consequence__')
    // …standing at the end of the consequence row, after whichever card ends it.
    const row = out.nodes.filter((n) => ['out_1', 'risk_1', 'risk_2'].includes(n.id))
    const rowRight = Math.max(...row.map((n) => n.position.x + REPEATED_CARD_W))
    expect(door.position.x).toBe(rowRight + LAYOUT_PADDING_X + LAYOUT_NODE_GAP)
    expect(door.position.y).toBe(row[0].position.y)
  })

  it('⭐ the layout reserves the door\'s HEIGHT: short consequence cards cannot pull the Goal up under it', async () => {
    const shortH = 60
    const nodes = [node('dec', 'decision'), node('opt', 'option'), node('fac', 'factor'), node('out_1', 'outcome', shortH), node('risk_1', 'risk', shortH), node('goal', 'goal')]
    const edges = [
      { id: '1', source: 'dec', target: 'opt' }, { id: '2', source: 'opt', target: 'fac' },
      { id: '3', source: 'fac', target: 'out_1' }, { id: '4', source: 'fac', target: 'risk_1' },
      { id: '5', source: 'out_1', target: 'goal' },
    ] as Edge[]
    const out = await layoutGraph(nodes, edges, {})
    const door = byId(withGhostTiers(out.nodes), '__ghost-consequence__')
    // ONE prompt's height — the stacked pair (2 × ROW_PROMPT_H + gap) is gone.
    const columnBottom = door.position.y + ROW_PROMPT_H
    const goal = byId(out.nodes, 'goal')
    expect(goal.position.y).toBe(columnBottom + LAYOUT_PADDING_Y + LAYOUT_LAYER_GAP)
  })

  it('CONTRAST: with only outcomes, the column holds one prompt and the row keeps its card height', async () => {
    const nodes = [node('dec', 'decision'), node('opt', 'option'), node('fac', 'factor'), node('out_1', 'outcome', 300), node('goal', 'goal')]
    const edges = [
      { id: '1', source: 'dec', target: 'opt' }, { id: '2', source: 'opt', target: 'fac' },
      { id: '3', source: 'fac', target: 'out_1' }, { id: '4', source: 'out_1', target: 'goal' },
    ] as Edge[]
    const out = await layoutGraph(nodes, edges, {})
    const prompts = withGhostTiers(out.nodes).filter((n) => isGhostNode(n.id)).map((n) => n.id).sort()
    expect(prompts).toEqual(['__ghost-factor__', '__ghost-option__', '__ghost-outcome__'])
    const outCard = byId(out.nodes, 'out_1')
    expect(byId(out.nodes, 'goal').position.y).toBe(outCard.position.y + 300 + LAYOUT_PADDING_Y + LAYOUT_LAYER_GAP)
  })

  it('the option prompt is the existing option card (`ghost-option`), at the end of the options row', async () => {
    const { nodes, edges } = factorTier(3)
    const out = await layoutGraph(nodes, edges, {})
    const option = byId(withGhostTiers(out.nodes), GHOST_OPTION_NODE_ID)
    expect(option.type).toBe('ghost-option')
    const lastOption = [byId(out.nodes, 'opt_a'), byId(out.nodes, 'opt_b')].sort((a, b) => b.position.x - a.position.x)[0]
    expect(option.position).toEqual({ x: lastOption.position.x + REPEATED_CARD_W + LAYOUT_PADDING_X + LAYOUT_NODE_GAP, y: lastOption.position.y })
  })
})
