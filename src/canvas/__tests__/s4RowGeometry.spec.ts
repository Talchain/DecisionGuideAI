/**
 * ⭐⭐ S4 ROW GEOMETRY — Experience Design's locked choices, bound by node identity.
 *
 * #63 5806207128 / 5806266691 (24 Sep 2026):
 *   · "Repeated cards target 248px: Option, Factor, Outcome and Risk." — raised
 *     to the legibility floor `NODE_LAYOUT_MIN_W` (260), the bounded exception
 *     ED allowed "if code proves a hard minimum".
 *   · "Question and Goal ≤460px, wide and shallow." — raised to ≤720 on 27 Sep.
 *   · "Do not let one long title widen an entire row."
 *   · "Rows above 5 cards wrap into balanced sub-rows under ONE left family
 *     label. 6→3+3, 7→4+3, 8→4+4, 9→5+4 … Keep causal reading order stable."
 *   · "Row-end reasoning prompts stay at the row end, 160px, inside the row
 *     budget … one prompt at the end of the final sub-row … if Outcome + Risk
 *     share one visual lane, use one 160px frontier column with the two small
 *     prompts stacked."
 *
 * 27 Sep 2026: Paul's laptop-width ruling — five per row, anchors ≤720, row gap 40.
 * 30 Sep 2026: Paul's "wider and shorter" ruling — a repeated card is its row's
 * FAIR SHARE of `ROW_BUDGET_W` (1656, the 1280 dock-open frame at the floor),
 * clamped to [REPEATED_CARD_W 248, REPEATED_CARD_MAX_W 400]; the row-end prompt
 * is a 64-unit icon (`ROW_PROMPT_W`), not the 160 tile.
 *
 * Every assertion names the node it is about. Positions come from the real
 * `layoutGraph`; prompts from the real `withGhostTiers` on that output.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, balancedRowSizes, solveLayoutCardWidths } from '../utils/layout'
import { GHOST_TIERS, withGhostTiers } from '../utils/ghostTiers'
import { GHOST_OPTION_NODE_ID, isGhostNode } from '../utils/fitTargets'
import {
  ANCHOR_CARD_MAX_W,
  LAYOUT_LAYER_GAP,
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  MAX_CARDS_PER_ROW,
  NODE_LAYOUT_MIN_W,
  REPEATED_CARD_MAX_W,
  REPEATED_CARD_TARGET_W,
  REPEATED_CARD_W,
  ROW_BUDGET_W,
  ROW_PROMPT_H,
  ROW_PROMPT_W,
  TIER_BY_KIND,
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

/**
 * ⭐ THE FAIR SHARE, WRITTEN FROM THE 30 SEP RULE (`ROW_BUDGET_W`'s header), not
 * read back from `tierCardWidth` — so a drift in either shows here. The widest
 * sub-row of `k` cards plus its prompt slot (gap + icon) shares the budget; a
 * WRAPPED tier's brick-shifted course, (k + ½) boxes and (k − ½) gaps, must fit it
 * too; legibility (REPEATED_CARD_W) wins over the budget, and the cap is 400.
 */
function fairShare(k: number, wrapped: boolean, prompt = true): number {
  const g = LAYOUT_NODE_GAP
  const slot = prompt ? g + ROW_PROMPT_W : 0
  let share = Math.floor((ROW_BUDGET_W - slot - (k - 1) * g) / k) - LAYOUT_PADDING_X
  if (wrapped) share = Math.min(share, Math.floor((ROW_BUDGET_W - (k - 0.5) * g) / (k + 0.5)) - LAYOUT_PADDING_X)
  return Math.max(REPEATED_CARD_W, Math.min(REPEATED_CARD_MAX_W, share))
}

/** The fair share of the tier `kind` sits in, for a draft: its occupancy → balanced sub-rows. */
function fairShareInDraft(d: Draft, kind: string): number {
  const tier = TIER_BY_KIND[kind]
  const count = d.nodes.filter((n) => TIER_BY_KIND[n.kind] === tier).length
  const sizes = balancedRowSizes(count)
  return fairShare(Math.max(...sizes), sizes.length > 1)
}

const byId = (nodes: Node[], id: string) => {
  const n = nodes.find((x) => x.id === id)
  if (!n) throw new Error(`no node ${id}`)
  return n
}

describe('S4 card widths', () => {
  it('the repeated-card width is the ED target raised to the legibility floor — now the ED target itself, 248', () => {
    // RE-PINNED 27 Sep 2026 (landing text ceiling 1.36): the legibility floor is the
    // widest title word at the TEXT bound, 108 × 1.36 + 20 + 24 = 190.88, so it no
    // longer raises the ED target; the +12 exception (260) is gone.
    expect(REPEATED_CARD_TARGET_W).toBe(248)
    // 190.88 → 221.12 (27 Sep: landing text cap 1.36 → 1.64, owner decision, #70 5859837231): 108 × 1.64 + 20 + 24 —
    // still below the 248 target, so the target is still the repeated width.
    expect(NODE_LAYOUT_MIN_W).toBeCloseTo(221.12, 10)
    expect(REPEATED_CARD_W).toBe(Math.max(REPEATED_CARD_TARGET_W, NODE_LAYOUT_MIN_W))
    expect(REPEATED_CARD_W).toBe(248)
  })

  it('the fair shares, pinned so a silent constants drift is visible: 5 → 276, 4 → 358, ≤3 → 400, wrapped 4+4 → 325, wrapped 5+4 → 257', () => {
    // floor((1656 − 56 − 4·24) / 5) − 24 = 300 − 24 = 276 (the slot is 24 + 32 since Paul's 1 Oct half-size prompt)
    expect(fairShare(5, false)).toBe(276)
    // floor((1656 − 56 − 3·24) / 4) − 24 = 382 − 24 = 358
    expect(fairShare(4, false)).toBe(358)
    // floor((1656 − 88 − 2·24) / 3) − 24 = 482 → the 400 cap
    expect(fairShare(3, false)).toBe(REPEATED_CARD_MAX_W)
    // wrapped: min(358, floor((1656 − 3.5·24) / 4.5) − 24 = 349 − 24 = 325)
    expect(fairShare(4, true)).toBe(325)
    // wrapped: min(276, floor((1656 − 4.5·24) / 5.5) − 24 = 281 − 24 = 257)
    expect(fairShare(5, true)).toBe(257)
    // Every repeated width sits inside the clamp.
    for (let k = 1; k <= MAX_CARDS_PER_ROW; k++) {
      for (const w of [fairShare(k, false), fairShare(k, true)]) {
        expect(w).toBeGreaterThanOrEqual(REPEATED_CARD_W)
        expect(w).toBeLessThanOrEqual(REPEATED_CARD_MAX_W)
      }
    }
  })

  // RE-PINNED 30 Sep 2026: was "all draw at the repeated width" (the flat 248).
  it.each(Object.keys(STARTERS))('%s: options, factors, outcomes and risks each draw at their row\'s fair share of the budget', async (id) => {
    const { nodes, edges } = fromDraft(STARTERS[id])
    const out = await layoutGraph(nodes, edges, {})
    for (const kind of ['option', 'factor', 'outcome', 'risk']) {
      expect(out.layoutCardWidths[kind], `${id}: ${kind}`).toBe(fairShareInDraft(STARTERS[id], kind))
    }
  })

  /** The ruled bound, written as the RULING says it — never read back from the
   *  constant under test (a mutant raising the constant would move both sides).
   *  Paul, 27 Sep 2026: 720 (ED S4 ruled 460). */
  const ED_ANCHOR_MAX = 720

  it('the anchor cap is the ruled 720', () => {
    expect(ANCHOR_CARD_MAX_W).toBe(ED_ANCHOR_MAX)
  })

  it.each(Object.keys(STARTERS))('%s: the Question and the Goal are wide (≤720) and wider than a repeated card', async (id) => {
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
    // Four factors on one row: their fair share, 350 (was the flat 248).
    expect(b.layoutCardWidths.factor).toBe(fairShare(4, false))
    expect(b.nodes.map((n) => [n.id, n.position.x])).toEqual(a.nodes.map((n) => [n.id, n.position.x]))
  })

  it('⭐ a wrapped row keeps full card width — and wrapping one tier does not shrink another', async () => {
    const { nodes, edges } = factorTier(11)
    const out = await layoutGraph(nodes, edges, {})
    // 11 → 4 + 4 + 3 at the five-card cap (27 Sep; 9 → 5 + 4 is two rows now).
    expect(subRows(out.nodes, 'fac_').length, 'precondition: the factor tier wrapped').toBe(3)
    // 30 Sep: the wrapped tier takes the fair share of its widest sub-row (4),
    // capped by its brick course — 325 — and is NOT dropped to the 248 floor.
    expect(out.layoutCardWidths.factor).toBe(fairShare(4, true))
    expect(out.layoutCardWidths.factor).toBeGreaterThan(REPEATED_CARD_W)
    // The retired gate dropped EVERY tier to the floor once any tier split — the
    // Question included. Bound to the decision node's own tier.
    expect(out.layoutCardWidths.decision).toBe(ANCHOR_CARD_MAX_W)
    expect(solveLayoutCardWidths(nodes, {})).toEqual(out.layoutCardWidths)
  })
})

describe('S4 row wrapping — balanced sub-rows, order preserved', () => {
  // ⚠ GAP 7 (25 Sep 2026) capped a row at FOUR (5→3+2, 9→3+3+3, 10→4+3+3).
  // 27 Sep 2026: Paul's laptop-width ruling — five per row, anchors ≤720, row gap 40.
  // Back to ED's S4 table: wrap above FIVE, 9→5+4, 10→5+5; 11/12 are three rows.
  it('the sizes are the balanced table at a cap of five: 6→3+3, 7→4+3, 8→4+4, 9→5+4, 10→5+5, 11→4+4+3, 12→4+4+4; five or fewer stay on one row', () => {
    expect(MAX_CARDS_PER_ROW).toBe(5)
    expect(balancedRowSizes(4)).toEqual([4])
    expect(balancedRowSizes(5)).toEqual([5])
    expect(balancedRowSizes(6)).toEqual([3, 3])
    expect(balancedRowSizes(7)).toEqual([4, 3])
    expect(balancedRowSizes(8)).toEqual([4, 4])
    expect(balancedRowSizes(9)).toEqual([5, 4])
    expect(balancedRowSizes(10)).toEqual([5, 5])
    expect(balancedRowSizes(11)).toEqual([4, 4, 3])
    expect(balancedRowSizes(12)).toEqual([4, 4, 4])
  })

  it.each([
    [4, [4]],
    [5, [5]],
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [9, [5, 4]],
    [10, [5, 5]],
    [11, [4, 4, 3]],
  ])('%i factors lay out as %j sub-rows, in reading order fac_0, fac_1, …', async (n, sizes) => {
    const { nodes, edges } = factorTier(n)
    const out = await layoutGraph(nodes, edges, {})
    const rows = subRows(out.nodes, 'fac_')
    expect(rows.map((r) => r.length)).toEqual(sizes)
    // Reading order — left to right, then down — is the model order.
    expect(rows.flat()).toEqual(Array.from({ length: n }, (_, i) => `fac_${i}`))
  })

  it('sub-rows are laid in BRICK courses, half a stride apart, so no card stands directly under another (v3.1 WS1 #10)', async () => {
    // Was: "sub-rows share ONE left edge". Stacked columns put every edge that
    // leaves the upper course, or enters the lower one, through a card that is
    // not its endpoint (11–21 per starter at landing). Half-stride courses put
    // each card of one course under a GAP of the other; the family still reads
    // left to right, then down, under one band label.
    const { nodes, edges } = factorTier(7)
    const out = await layoutGraph(nodes, edges, {})
    const [first, second] = subRows(out.nodes, 'fac_')
    // The factor tier's OWN card width (30 Sep: 7 → 4 + 3 draws at 325, not 248).
    const factorW = out.layoutCardWidths.factor
    expect(factorW, 'precondition: the wrapped fair share').toBe(fairShare(4, true))
    const stride = factorW + LAYOUT_PADDING_X + LAYOUT_NODE_GAP
    // 7 → 4 + 3: the SECOND course shifts (the narrower of the two brick choices).
    // (325 + 24 + 24) / 2 = 186.5 (was (248 + 48) / 2 = 148).
    expect(byId(out.nodes, second[0]).position.x - byId(out.nodes, first[0]).position.x).toBe(stride / 2)
    // …and the stride inside a sub-row is the card plus the card gap, exactly.
    expect(byId(out.nodes, first[1]).position.x - byId(out.nodes, first[0]).position.x).toBe(stride)
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
    // The widest single row: five since 27 Sep (four under gap 7).
    const { nodes, edges } = factorTier(5)
    const out = await layoutGraph(nodes, edges, {})
    const cards = out.nodes.filter((n) => n.id.startsWith('fac_')).sort((a, b) => a.position.x - b.position.x)
    // The prompt is placed after the card's RENDERED width, which on a mounted
    // board is the layout's per-kind width; this file's fixture measures every
    // card at 248, so hand the drawn width in (as the mount does), not the fixture's.
    const drawnW = (n: Node) => out.layoutCardWidths[n.type as string]
    const factorW = out.layoutCardWidths.factor
    expect(factorW, 'precondition: five factors draw at their fair share').toBe(fairShare(5, false))
    const prompt = withGhostTiers(out.nodes, GHOST_TIERS, { widthOf: drawnW }).find((n) => n.id === '__ghost-factor__')!
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
    // The slot is now gap + icon = 24 + 64 = 88, so half a slot is 44 (it was
    // (24 + 160) / 2 = 92 with the tile, hence the old "> 50"); allow the 1-unit
    // tolerance the positive arm uses, and no more.
    const cardsOnlyCentre = rowLeft + (cards.length * (factorW + LAYOUT_PADDING_X) + (cards.length - 1) * LAYOUT_NODE_GAP) / 2
    expect(Math.abs(cardsOnlyCentre - decBoxCentre)).toBeGreaterThanOrEqual((LAYOUT_NODE_GAP + ROW_PROMPT_W) / 2 - 1)
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
    // Shorter than the door (ROW_PROMPT_H, 32 since Paul's 1 Oct half size), or the cards, not the door, set the row.
    const shortH = 20
    expect(shortH).toBeLessThan(ROW_PROMPT_H)
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
