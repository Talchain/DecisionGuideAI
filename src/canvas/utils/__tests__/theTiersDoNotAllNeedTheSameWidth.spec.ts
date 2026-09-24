/**
 * ⭐⭐ THE TIERS DO NOT ALL NEED THE SAME WIDTH — and proving it costs the board
 * nothing is the whole of this file.
 *
 * ## Where this came from
 *
 * Paul, 15 Sep 2026, after a manual test: *"You still haven't increased the
 * width of the nodes. They don't all have to be the same width. There are
 * always less options, and there's more in it, so making them wider would make
 * sense. I also think the question or initial node and the nodes can be a lot
 * wider, so we can fit more content in and make use of them more."*
 *
 * The measurement agrees with him — median characters per card, counted on the
 * `pricing-model` starter:
 *
 *     option 250 · factor 141 · decision 122 · goal 102 · risk 86 · outcome 73
 *
 * An option carried **3.4x an outcome's content in an identical 336px box**.
 *
 * ## ⛔ THE PREVIOUS ATTEMPT WIDENED THE BOX AND NOT THE CARD
 *
 * A first cut widened `getNodeDimensions`'s ELK box and added a `maxWidth`
 * pass-through on `DecisionNode`/`GoalNode` reading React Flow's `props.width`.
 * Measured on the deployed board afterwards: **decision 327, goal 336, option
 * 336 — unchanged**. `props.width` is the MEASURED width and was `undefined`,
 * and `BaseNode` renders at one global `layoutNodeWidth`. Built, not plugged in.
 *
 * So the binding tests here assert **the width a card is told to DRAW at**
 * (`solveLayoutCardWidths`, which is what `BaseNode` reads), not the width ELK
 * was handed. A test on the box alone would have passed over that whole defect.
 *
 * ## The bound is derived, and that is the argument
 *
 * A tier may widen only into width the board ALREADY has: its share of the
 * widest row. The widest tier is at the bound by definition and keeps exactly
 * today's width, so no graph gets wider. `theBoardDoesNotGrow` asserts that
 * over all five shipped starters rather than reasoning about it.
 */
/*
 * ⭐⭐ S4 (24 Sep 2026) SUPERSEDES THE OPTION WIDENING, AND THIS FILE SAYS WHICH
 * HALF. Experience Design (#63 5806207128 / 5806266691): "Paul's earlier 'they
 * don't all have to be the same width' was permission, not a requirement to
 * keep Options at ~300–430px. 248 is the target" for Option, Factor, Outcome and
 * Risk (260 here — the legibility floor wins), and "Question and Goal ≤460px,
 * wide and shallow." So the title's claim survives — the tiers still do NOT all
 * share one width: the Question and the Goal are wide and the repeated families
 * are narrow — but "options wider than outcomes" is retired by ruling, and the
 * "never below 336" rule is discharged because the one character budget that
 * needed it (`NODE_ROW_LABEL_MAX_CHARS`) now follows the card.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, solveLayoutCardWidths } from '../layout'
import {
  NODE_CARD_MAX_W,
  CARD_W_CAP_BY_TIER,
  TIER_BY_KIND,
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  REPEATED_CARD_W,
  ANCHOR_CARD_MAX_W,
} from '../nodeLayoutConstants'

import capture from '../../__tests__/__fixtures__/starter-node-heights.browser-capture-2026-08-18.json'
import vendorSelection from '../../starters/data/vendor-selection.draft.json'
import marketEntry from '../../starters/data/market-entry.draft.json'
import buildVsBuy from '../../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../../starters/data/headcount-allocation.draft.json'
import pricingModel from '../../starters/data/pricing-model.draft.json'

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
  const heights = HEIGHTS[id]
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: NODE_CARD_MAX_W, height: heights[n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: (e.from ?? e.source) as string,
    target: (e.to ?? e.target) as string,
  })) as Edge[]
  return { nodes, edges }
}

/** The widest row a laid-out board occupies, in model units. */
function boardExtentX(nodes: Node[], widths: Record<string, number>): number {
  let minX = Infinity
  let maxX = -Infinity
  for (const n of nodes) {
    const w = widths[(n.type ?? '') as string] ?? NODE_CARD_MAX_W
    if (n.position.x < minX) minX = n.position.x
    if (n.position.x + w > maxX) maxX = n.position.x + w
  }
  return maxX - minX
}

const IDS = Object.keys(STARTERS) as StarterId[]

describe('a tier may use width the board is already paying for', () => {
  /**
   * ⭐ THE BINDING TEST, and it asserts the RENDER width. `solveLayoutCardWidths`
   * is the exact expression `BaseNode` reads through `layoutStore`, so a pass
   * here means the card draws wider — which is the claim the previous attempt
   * could not make.
   */
  it('⭐ the Question and the Goal draw WIDER than the single card width', async () => {
    for (const id of IDS) {
      const { nodes } = buildGraph(id)
      const widths = solveLayoutCardWidths(nodes)
      expect(widths.decision, `${id}: decision`).toBeGreaterThan(NODE_CARD_MAX_W)
      expect(widths.goal, `${id}: goal`).toBeGreaterThan(NODE_CARD_MAX_W)
    }
  })

  it('⭐ S4: options, factors, outcomes and risks all draw at ONE repeated width', async () => {
    // Retires "options draw wider than outcomes" by ruling (see the header).
    for (const id of IDS) {
      const { nodes } = buildGraph(id)
      const widths = solveLayoutCardWidths(nodes)
      for (const kind of ['option', 'factor', 'outcome', 'risk']) {
        expect(widths[kind], `${id}: ${kind}`).toBe(REPEATED_CARD_W)
      }
    }
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a change that simply widened
   * EVERYTHING would pass both tests above — and that is the change that makes
   * the board too wide to read, which is the defect from the other end.
   */
  it('⛔ CONTRAST: only the Question and the Goal are wide — and never past 460', async () => {
    // Without this, a change that simply widened EVERYTHING would pass the
    // Question/Goal test above — the change that makes the board too wide to
    // fit a laptop, which is the defect S4 exists to fix.
    for (const id of IDS) {
      const { nodes } = buildGraph(id)
      const widths = solveLayoutCardWidths(nodes)
      expect(widths.decision, `${id}: decision`).toBeLessThanOrEqual(ANCHOR_CARD_MAX_W)
      expect(widths.goal, `${id}: goal`).toBeLessThanOrEqual(ANCHOR_CARD_MAX_W)
      const wide = Object.entries(widths).filter(([, w]) => w > REPEATED_CARD_W).map(([k]) => k).sort()
      expect(wide, `${id}: a repeated family drew wide`).toEqual(['decision', 'goal'])
    }
  })

  /**
   * ⭐⭐ THE PROMISE, MEASURED RATHER THAN REASONED. Widening is only free if the
   * board does not grow. This lays out every shipped starter and compares the
   * extent against the same layout with every cap flattened to today's single
   * width.
   */
  it('⭐ the board does not get wider on ANY shipped starter', async () => {
    const report: string[] = []
    for (const id of IDS) {
      const { nodes, edges } = buildGraph(id)
      const laid = await layoutGraph(nodes, edges)
      const perKind = laid.layoutCardWidths
      const uniform: Record<string, number> = {}
      for (const kind of Object.keys(TIER_BY_KIND)) uniform[kind] = laid.layoutNodeWidth

      const widened = boardExtentX(laid.nodes, perKind)
      // The uniform arm is the SAME positions read at the old single width —
      // which is exactly what the board measured before this change, because
      // the positions are what moved and the width is what was not reaching
      // the card.
      const baseline = boardExtentX(laid.nodes, uniform)
      report.push(`${id}: widened ${Math.round(widened)} vs uniform ${Math.round(baseline)}`)
      expect(widened, `${id}: the board grew — ${report[report.length - 1]}`)
        .toBeLessThanOrEqual(baseline + LAYOUT_NODE_GAP)
    }
    // Recorded so a future reader sees the numbers, not just a green tick.
    expect(report).toHaveLength(IDS.length)
  })

  /**
   * ⚠ ONE AUTHORITY, ASSERTED. `layoutGraph` places on `tierBoxWidth` and
   * `solveLayoutCardWidths` tells the card what to draw at. If those two ever
   * drift, the card renders at a width its position was not computed for —
   * which is precisely the overlap defect `useRestoredLayoutWidth` exists to
   * repair, re-introduced one level up.
   */
  it('⭐ the layout and the restore path agree, per kind, on every starter', async () => {
    for (const id of IDS) {
      const { nodes, edges } = buildGraph(id)
      const laid = await layoutGraph(nodes, edges)
      const derived = solveLayoutCardWidths(nodes)
      expect(derived, `${id}: derived vs laid-out`).toEqual(laid.layoutCardWidths)
    }
  })

  it('S4 caps: the anchors at 460, every repeated tier at the repeated width — below 336 on purpose', () => {
    // "Never below NODE_CARD_MAX_W" held while a character budget was derived
    // against 336; that budget now follows `REPEATED_CARD_W`
    // (`rowLabelBudgetDerived.spec.ts`), so the rule is discharged, not ignored.
    expect(CARD_W_CAP_BY_TIER[TIER_BY_KIND.decision]).toBe(ANCHOR_CARD_MAX_W)
    expect(CARD_W_CAP_BY_TIER[TIER_BY_KIND.goal]).toBe(ANCHOR_CARD_MAX_W)
    for (const kind of ['option', 'factor', 'outcome', 'risk']) {
      expect(CARD_W_CAP_BY_TIER[TIER_BY_KIND[kind]], kind).toBe(REPEATED_CARD_W)
    }
    expect(REPEATED_CARD_W).toBeLessThan(NODE_CARD_MAX_W)
  })

  /**
   * ⚠ THE BOX IS THE CARD PLUS ITS PADDING, AND GETTING THAT WRONG BY ONE
   * PADDING IS HOW A CARD ENDS UP FLUSH AGAINST ITS NEIGHBOUR.
   */
  it('the reported width is the CARD, not the ELK box', async () => {
    const { nodes } = buildGraph('pricing-model')
    const widths = solveLayoutCardWidths(nodes)
    expect(widths.decision).toBeLessThanOrEqual(CARD_W_CAP_BY_TIER[0])
    expect(widths.decision + LAYOUT_PADDING_X).toBeGreaterThan(widths.decision)
  })

  it('an empty graph reports no widths rather than a guess', () => {
    expect(solveLayoutCardWidths([])).toEqual({})
  })
})
