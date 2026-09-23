/**
 * ⭐⭐ AN ADDED OPTION LANDS IN THE OPTION ROW — not in a column at the top right.
 *
 * FOUNDER REPORT (manual test on staging, 23 Sep 2026): *"Every time I add an
 * option, it appears in the wrong row. When I run the analysis, it is put into
 * the correct row."*
 *
 * ## The mechanism, at the bytes
 *
 * The Add-option panel does not place a node. It sends an `add_option` chip to
 * CEE, and the option reaches the canvas in the applied receipt's `draft_graph`,
 * which `reconcileAppliedGraph` ingests. Every node on the wire and not on the
 * canvas was then placed in ONE column right of the surviving bounding box,
 * starting at the TOP-most y:
 *
 *     mergeAppliedGraph.ts  baseX = max(x) + ADDED_COLUMN_X_GAP
 *                           baseY = min(y)          <- the Question's row
 *     mergeServerGraph.ts   the same, mirrored, for boot hydration
 *
 * So the option sat level with the Question card until something ran the
 * canonical layout (`layoutGraph`, `utils/layout.ts`), which analysis does. The
 * canonical layout keys rows on `TIER_BY_KIND` — which is why the analysis "put
 * it into the correct row".
 *
 * ## What this spec binds
 *
 * The canvas is the CANONICAL LAYOUT's own output (`layoutGraph` over a real
 * decision/options/factors/outcome/goal graph), rendered the way React Flow
 * renders it — each card measured at the width the layout told it to draw at.
 * An option added to it must take the option row's y, sit right of the
 * rightmost option, and overlap nothing. The strongest form is the last case:
 * running the canonical layout AGAIN (what analysis does) must leave the new
 * option in the row it was already in.
 *
 * Every assertion is on behaviour, never on the helper, so this file runs
 * unchanged on the base (RED) and on the fix (GREEN).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { reconcileAppliedGraph, ADDED_COLUMN_X_GAP } from '../mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../applyDraftResult'
import { layoutGraph } from '../layout'
import { LAYOUT_NODE_GAP } from '../nodeLayoutConstants'

// ---------------------------------------------------------------------------
// The graph — the shape a real pricing decision drafts to. Wire form (CEE's
// NodeV3 carries no geometry), so the SAME objects feed the receipt.
// ---------------------------------------------------------------------------

type WireNode = { id: string; kind: string; label: string }
type WireEdge = { id: string; from: string; to: string }

const WIRE_NODES: WireNode[] = [
  { id: 'dec', kind: 'decision', label: 'Which pricing model should we adopt?' },
  { id: 'opt_flat', kind: 'option', label: 'Flat monthly fee' },
  { id: 'opt_seat', kind: 'option', label: 'Per-seat pricing' },
  { id: 'opt_usage', kind: 'option', label: 'Usage-based pricing' },
  { id: 'fac_price', kind: 'factor', label: 'Price point' },
  { id: 'fac_churn', kind: 'factor', label: 'Churn rate' },
  { id: 'fac_cac', kind: 'factor', label: 'Acquisition cost' },
  { id: 'fac_seats', kind: 'factor', label: 'Seats per account' },
  { id: 'out_rev', kind: 'outcome', label: 'Recurring revenue' },
  { id: 'goal', kind: 'goal', label: 'Grow ARR 30% this year' },
]

const edge = (from: string, to: string): WireEdge => ({ id: `${from}::${to}::0`, from, to })

const WIRE_EDGES: WireEdge[] = [
  edge('dec', 'opt_flat'),
  edge('dec', 'opt_seat'),
  edge('dec', 'opt_usage'),
  edge('opt_flat', 'fac_price'),
  edge('opt_seat', 'fac_seats'),
  edge('opt_usage', 'fac_price'),
  edge('opt_usage', 'fac_churn'),
  edge('fac_price', 'out_rev'),
  edge('fac_churn', 'out_rev'),
  edge('fac_cac', 'out_rev'),
  edge('fac_seats', 'out_rev'),
  edge('out_rev', 'goal'),
]

/** Rendered card heights by kind — options carry the most text. */
const HEIGHT_BY_KIND: Record<string, number> = {
  decision: 120,
  option: 180,
  factor: 140,
  outcome: 110,
  goal: 130,
}

// ---------------------------------------------------------------------------
// The canvas, as the canonical layout left it and React Flow measured it.
// ---------------------------------------------------------------------------

let CANONICAL_NODES: Node[] = []
let CANONICAL_EDGES: Edge[] = []
let CARD_WIDTHS: Record<string, number> = {}

beforeAll(async () => {
  const mapped = WIRE_NODES.map((n) => {
    const node = mapDraftNodeToCanvas(n as never) as Node
    return { ...node, measured: { height: HEIGHT_BY_KIND[n.kind] } } as Node
  })
  CANONICAL_EDGES = WIRE_EDGES.map((e, i) => mapDraftEdgeToCanvas(e as never, i) as Edge)
  const laid = await layoutGraph(mapped, CANONICAL_EDGES)
  CARD_WIDTHS = laid.layoutCardWidths
  // React Flow measures each card at the width `BaseNode` draws it at.
  CANONICAL_NODES = laid.nodes.map(
    (n) =>
      ({
        ...n,
        measured: { width: CARD_WIDTHS[n.type as string], height: HEIGHT_BY_KIND[n.type as string] },
      }) as Node,
  )
})

function seed(nodes: Node[] = CANONICAL_NODES): void {
  useCanvasStore.setState({
    currentScenarioId: '11111111-2222-4333-8444-555555555555',
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(CANONICAL_EDGES) as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    importPendingServerRegistration: false,
    history: { past: [], future: [] },
  } as never)
}

beforeEach(() => seed())

// ---------------------------------------------------------------------------
// Geometry helpers — boxes are what the user sees, so overlap is judged on them.
// ---------------------------------------------------------------------------

type Box = { id: string; x: number; y: number; w: number; h: number }

const storeNodes = (): Node[] => useCanvasStore.getState().nodes as unknown as Node[]
const byId = (id: string): Node => {
  const n = storeNodes().find((x) => x.id === id)
  if (!n) throw new Error(`node ${id} is not on the canvas`)
  return n
}
const ofKind = (nodes: Node[], kind: string): Node[] => nodes.filter((n) => n.type === kind)

/**
 * The box a node occupies on screen. An ADDED node is not measured yet, so it
 * is judged at the size it WILL draw at: its kind's layout card width, and its
 * row's height.
 */
function boxOf(n: Node): Box {
  const m = n as { measured?: { width?: number; height?: number } }
  const kind = n.type as string
  return {
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w: m.measured?.width ?? CARD_WIDTHS[kind],
    h: m.measured?.height ?? HEIGHT_BY_KIND[kind],
  }
}

const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function overlapsWith(id: string): string[] {
  const me = boxOf(byId(id))
  return storeNodes()
    .filter((n) => n.id !== id)
    .filter((n) => intersects(me, boxOf(n)))
    .map((n) => n.id)
}

function rowY(kind: string): number {
  const ys = new Set(ofKind(CANONICAL_NODES, kind).map((n) => n.position.y))
  expect(ys.size, `the canonical layout put every ${kind} in ONE row`).toBe(1)
  return [...ys][0]
}

function rightEdgeOfRow(kind: string, nodes: Node[] = CANONICAL_NODES): number {
  return Math.max(...ofKind(nodes, kind).map((n) => boxOf(n).x + boxOf(n).w))
}

// ---------------------------------------------------------------------------
// The receipt / server graph: the committed graph plus what was added.
// ---------------------------------------------------------------------------

const NEW_OPTION: WireNode = { id: 'opt_freemium', kind: 'option', label: 'Freemium with paid tiers' }
const NEW_FACTOR: WireNode = { id: 'fac_conversion', kind: 'factor', label: 'Free-to-paid conversion' }
const SECOND_OPTION: WireNode = { id: 'opt_annual', kind: 'option', label: 'Annual contract only' }

function graphWith(added: WireNode[], extraEdges: WireEdge[] = []) {
  return {
    nodes: [...WIRE_NODES, ...added],
    edges: [...WIRE_EDGES, ...extraEdges],
  }
}

const receiptAddingOption = () =>
  graphWith([NEW_OPTION], [edge('dec', NEW_OPTION.id), edge(NEW_OPTION.id, 'fac_price')])

// ---------------------------------------------------------------------------

describe('the fixture is the canonical layout (pinned, so no case passes for the wrong reason)', () => {
  it('decision, option and factor rows are distinct, and the old column y is the QUESTION row', () => {
    const decisionY = rowY('decision')
    const optionY = rowY('option')
    const factorY = rowY('factor')
    expect(decisionY).toBeLessThan(optionY)
    expect(optionY).toBeLessThan(factorY)
    // Non-vacuity: `min(y)` — where the defect put the option — is NOT the row
    // the option belongs in, so "y equals the option row" can actually fail.
    const minY = Math.min(...CANONICAL_NODES.map((n) => n.position.y))
    expect(minY).toBe(decisionY)
    expect(minY).not.toBe(optionY)
    // Every card was measured, so every overlap judgement below uses real widths.
    for (const n of CANONICAL_NODES) expect(boxOf(n).w).toBeGreaterThan(0)
  })
})

describe('an applied receipt that adds an option (the Add-option panel path)', () => {
  it('⭐ puts the new option IN THE OPTION ROW, right of the rightmost option, overlapping nothing', () => {
    const result = reconcileAppliedGraph(receiptAddingOption() as never)
    expect(result.addedNodeCount).toBe(1)

    const added = byId(NEW_OPTION.id)
    expect(added.position.y, 'the option row, not the Question row').toBe(rowY('option'))
    expect(added.position.x).toBe(rightEdgeOfRow('option') + LAYOUT_NODE_GAP)
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
  })

  it('never moves a node that was already on the canvas', () => {
    reconcileAppliedGraph(receiptAddingOption() as never)
    for (const before of CANONICAL_NODES) {
      expect(byId(before.id).position, before.id).toEqual(before.position)
    }
  })

  it('⭐ an option AND a factor in one receipt each go to their OWN row', () => {
    reconcileAppliedGraph(
      graphWith(
        [NEW_OPTION, NEW_FACTOR],
        [edge('dec', NEW_OPTION.id), edge(NEW_OPTION.id, NEW_FACTOR.id), edge(NEW_FACTOR.id, 'out_rev')],
      ) as never,
    )

    const option = byId(NEW_OPTION.id)
    const factor = byId(NEW_FACTOR.id)
    expect(option.position.y).toBe(rowY('option'))
    expect(factor.position.y).toBe(rowY('factor'))
    expect(option.position.x).toBe(rightEdgeOfRow('option') + LAYOUT_NODE_GAP)
    expect(factor.position.x).toBe(rightEdgeOfRow('factor') + LAYOUT_NODE_GAP)
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
    expect(overlapsWith(NEW_FACTOR.id)).toEqual([])
  })

  it('⭐ two options in one receipt sit SIDE BY SIDE in the option row without overlapping', () => {
    reconcileAppliedGraph(
      graphWith([NEW_OPTION, SECOND_OPTION], [edge('dec', NEW_OPTION.id), edge('dec', SECOND_OPTION.id)]) as never,
    )

    const first = byId(NEW_OPTION.id)
    const second = byId(SECOND_OPTION.id)
    expect(first.position.y).toBe(rowY('option'))
    expect(second.position.y).toBe(rowY('option'))
    expect(first.position.x).toBe(rightEdgeOfRow('option') + LAYOUT_NODE_GAP)
    // Right of the first new card's drawn width, not stacked beneath it.
    expect(second.position.x).toBeGreaterThanOrEqual(boxOf(first).x + boxOf(first).w + LAYOUT_NODE_GAP)
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
    expect(overlapsWith(SECOND_OPTION.id)).toEqual([])
  })

  it.each([
    ['near the top of the row', 40],
    // Below an unmeasured card's default height but inside the option row's
    // band: only a card sized at its ROW's height sees this one.
    ['low in the row band', 150],
  ])('⛔ a card the user dragged to the end of the option row (%s) is stepped over, not painted on', (_, dy) => {
    // The row-end point is where a user-arranged card can already be standing:
    // here a factor dragged up level with the options, just past their end. It
    // is not IN the option row (different y, different tier), so the row rule
    // alone cannot see it — only the overlap guard can.
    const dragged = CANONICAL_NODES.map((n) =>
      n.id === 'fac_cac'
        ? ({
            ...n,
            position: { x: rightEdgeOfRow('option') + LAYOUT_NODE_GAP + 100, y: rowY('option') + dy },
          } as Node)
        : n,
    )
    seed(dragged)

    reconcileAppliedGraph(receiptAddingOption() as never)

    const added = byId(NEW_OPTION.id)
    expect(added.position.y, 'still in its row — stepped sideways, not moved to another row').toBe(
      rowY('option'),
    )
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
    const draggedBox = boxOf(byId('fac_cac'))
    expect(added.position.x).toBeGreaterThanOrEqual(draggedBox.x + draggedBox.w)
  })

  it('⭐ the analysis re-layout no longer moves it to a DIFFERENT ROW', () => {
    // The founder's symptom, stated as a property: "when I run the analysis, it
    // is put into the correct row". The canonical layout is what analysis runs.
    // It re-centres rows (x moves), but a node already in its tier's row keeps
    // that row's y.
    reconcileAppliedGraph(receiptAddingOption() as never)
    const placedY = byId(NEW_OPTION.id).position.y

    return layoutGraph(storeNodes(), useCanvasStore.getState().edges as Edge[]).then((relaid) => {
      const after = relaid.nodes.find((n) => n.id === NEW_OPTION.id)!
      const optionYs = new Set(ofKind(relaid.nodes, 'option').map((n) => n.position.y))
      expect(optionYs.size, 'the canonical layout keeps one option row').toBe(1)
      expect(after.position.y).toBe(placedY)
    })
  })
})

describe('boot hydration that finds an option the local canvas lacks (the mirror)', () => {
  it('⭐ puts the new option IN THE OPTION ROW, right of the rightmost option, overlapping nothing', () => {
    const result = mergeServerGraphOnHydrate(receiptAddingOption())
    expect(result.accepted).toBe(true)
    expect(result.addedNodeCount).toBe(1)

    const added = byId(NEW_OPTION.id)
    expect(added.position.y, 'the option row, not the Question row').toBe(rowY('option'))
    expect(added.position.x).toBe(rightEdgeOfRow('option') + LAYOUT_NODE_GAP)
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
  })

  it('⭐ an option AND a factor each go to their own row, and nothing already there moves', () => {
    mergeServerGraphOnHydrate(
      graphWith(
        [NEW_OPTION, NEW_FACTOR],
        [edge('dec', NEW_OPTION.id), edge(NEW_OPTION.id, NEW_FACTOR.id), edge(NEW_FACTOR.id, 'out_rev')],
      ),
    )
    expect(byId(NEW_OPTION.id).position.y).toBe(rowY('option'))
    expect(byId(NEW_FACTOR.id).position.y).toBe(rowY('factor'))
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
    expect(overlapsWith(NEW_FACTOR.id)).toEqual([])
    for (const before of CANONICAL_NODES) {
      expect(byId(before.id).position, before.id).toEqual(before.position)
    }
  })
})

describe('a kind with NO row yet keeps the column fallback (discriminating twin)', () => {
  // Only a Question and a goal on the board: there is no option row to join,
  // and inventing a y for one would be a guess. The added option keeps today's
  // column — right of the bounding box, at its top — and still overlaps nothing.
  const SPARSE: Node[] = [
    {
      id: 'dec',
      type: 'decision',
      position: { x: 0, y: 40 },
      measured: { width: 560, height: 120 },
      data: { kind: 'decision', label: 'Which pricing model should we adopt?' },
    } as Node,
    {
      id: 'goal',
      type: 'goal',
      position: { x: 700, y: 400 },
      measured: { width: 480, height: 130 },
      data: { kind: 'goal', label: 'Grow ARR 30% this year' },
    } as Node,
  ]

  it('the receipt path', () => {
    seed(SPARSE)
    reconcileAppliedGraph({
      nodes: [
        { id: 'dec', kind: 'decision', label: 'Which pricing model should we adopt?' },
        { id: 'goal', kind: 'goal', label: 'Grow ARR 30% this year' },
        NEW_OPTION,
      ],
      edges: [edge('dec', NEW_OPTION.id)],
    } as never)
    const added = byId(NEW_OPTION.id)
    expect(added.position).toEqual({ x: 700 + ADDED_COLUMN_X_GAP, y: 40 })
    expect(overlapsWith(NEW_OPTION.id)).toEqual([])
  })

  it('the boot path', () => {
    seed(SPARSE)
    mergeServerGraphOnHydrate({
      nodes: [
        { id: 'dec', kind: 'decision', label: 'Which pricing model should we adopt?' },
        { id: 'goal', kind: 'goal', label: 'Grow ARR 30% this year' },
        NEW_OPTION,
      ],
      edges: [edge('dec', NEW_OPTION.id)],
    })
    expect(byId(NEW_OPTION.id).position).toEqual({ x: 700 + ADDED_COLUMN_X_GAP, y: 40 })
  })
})
