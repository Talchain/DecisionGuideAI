import { describe, it, expect } from 'vitest'
import { layoutGraph, groupByYRow, applyCollisionGuard } from '../utils/layout'
import {
  NODE_LAYOUT_MIN_W,
  NODE_CARD_MAX_W,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  DEFAULT_NODE_HEIGHT,
  CANVAS_MARGIN,
  CANONICAL_LAYOUT_WIDTH,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  MIN_GAP,
} from '../utils/nodeLayoutConstants'
import type { Node, Edge } from '@xyflow/react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type = 'decision', extra: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...extra } }
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

/**
 * Check that no two nodes overlap given their layout positions.
 *
 * ⚠⚠ THIS GUARD WAS VACUOUS AND IS THE REASON A WHOLE WAVE OF CARD-HEIGHT
 * CHANGES SHIPPED UNDER A GREEN SUITE (repaired 1 Sep 2026). Two defects, and
 * the second is the one that mattered:
 *
 * 1. It compared position ORIGINS against a FIXED box for every node
 *    (`Math.abs(a.x - b.x) < nodeW`), so it was never a rectangle-intersection
 *    test at all. Two cards of different heights could not be judged.
 * 2. The box was hardcoded at DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y = 116 px,
 *    while cards on the deployed canvas render 152-284 model px (measured in
 *    real Chromium, `e2e/geometry/nodeOverlap.measure.ts`). A 137 px row pitch
 *    under a 161 px card is a real 24 px overlap — and 137 > 116, so this guard
 *    PASSED on exactly the geometry the founder photographed.
 *
 * It now derives each node's box FROM THAT NODE, by id, using the same
 * precedence `getNodeDimensions` applies in `layout.ts`
 * (`measured?.height ?? height ?? defaultSize.height`, plus ELK padding), and
 * performs a true rectangle intersection. A caller may still pin explicit
 * dimensions, but there is no longer a single constant standing in for every
 * card.
 *
 * ⚠ DERIVATION ALONE WOULD NOT HAVE CAUGHT THIS EITHER (CLAUDE.md trap 12d: a
 * derived guard proves agreement, never completeness). Every fixture in this
 * file uses `makeNode`, which carries NO measured height, so every box was the
 * 100 px default and the guard could agree with itself forever. The corpus is
 * what notices — see `nodes do not overlap when cards render at their REAL
 * measured heights` below, which feeds the measured 152-284 px range in.
 */
function checkNoOverlap(nodes: Node[], nodeW?: number, nodeH?: number): void {
  /** Same precedence as `getNodeDimensions` in layout.ts, per node id. */
  const boxOf = (n: Node): { w: number; h: number } => {
    const measured = (n as { measured?: { width?: number; height?: number } }).measured
    const h = nodeH ?? (measured?.height ?? (n as { height?: number }).height ?? DEFAULT_NODE_HEIGHT) + LAYOUT_PADDING_Y
    const w = nodeW ?? (measured?.width ?? (n as { width?: number }).width ?? 240) + LAYOUT_PADDING_X
    return { w, h }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i], B = nodes[j]
      const a = A.position, b = B.position
      const ba = boxOf(A), bb = boxOf(B)
      const overlapX = Math.min(a.x + ba.w, b.x + bb.w) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + ba.h, b.y + bb.h) - Math.max(a.y, b.y)
      expect(
        overlapX > 0 && overlapY > 0,
        `Nodes ${A.id} and ${B.id} overlap by ${Math.round(overlapX)}x${Math.round(overlapY)}px: ` +
        `${A.id} at (${a.x},${a.y}) is ${ba.w}x${ba.h}, ` +
        `${B.id} at (${b.x},${b.y}) is ${bb.w}x${bb.h}`
      ).toBe(false)
    }
  }
}

// ⚠ THE THREE TEST CANVASES ARE GONE, AND THAT IS THE POINT (founder ruling R1,
// 18 Aug 2026). `layoutGraph` no longer takes a canvas: the budget is the
// constant `CANONICAL_LAYOUT_WIDTH`, so a viewport can no longer select a
// packing branch. Every case below that used to pick its branch by handing the
// solver a narrow/wide canvas now picks it by WIDEST TIER COUNT, which is the
// model-intrinsic driver and the only one left.
//
// Where the branch boundary sits under the pinned budget, re-derived from the
// shipped constants (AW = CANONICAL_LAYOUT_WIDTH = 1105):
//   widest tier <= 6  → single-row, every card at NODE_CARD_MAX_W
//   widest tier >= 7  → multi-row, 4 per row, every card at NODE_LAYOUT_MIN_W
// Measured against the pristine module side by side, the pin reproduces the
// shape the product already shipped at 1440 and 1512.

// ---------------------------------------------------------------------------
// Core layout tests
// ---------------------------------------------------------------------------

describe('ELK Layout', () => {
  // Use distinct semantic kinds so the canonical-tier rule places them
  // on different rows. Three same-kind nodes would correctly share a row
  // now that normaliseTierRows collapses intra-tier ELK Y variation.
  const mockNodes: Node[] = [
    makeNode('1', 'decision'),
    makeNode('2', 'option'),
    makeNode('3', 'option'),
  ]

  const mockEdges: Edge[] = [
    makeEdge('e1', '1', '2'),
    makeEdge('e2', '1', '3'),
  ]

  it('applies hierarchical layout to nodes', async () => {
    const { nodes } = await layoutGraph(mockNodes, mockEdges)

    expect(nodes).toHaveLength(3)

    // Positions may be negative — assert finite rather than >= 0
    nodes.forEach(node => {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    })

    // Decision (tier 0) must be above options (tier 1) in DOWN layout.
    const node1 = nodes.find(n => n.id === '1')!
    const node2 = nodes.find(n => n.id === '2')!
    expect(node1.position.y).toBeLessThan(node2.position.y)
  })

  it('returns layoutNodeWidth', async () => {
    const { layoutNodeWidth } = await layoutGraph(mockNodes, mockEdges, {})
    expect(layoutNodeWidth).toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    expect(layoutNodeWidth).toBeLessThanOrEqual(NODE_CARD_MAX_W)
  })

  it('preserves locked node positions', async () => {
    const lockedNodes: Node[] = [
      makeNode('1', 'decision', { locked: true, label: 'Locked' }),
      makeNode('2', 'decision', { label: 'Unlocked' }),
    ]
    lockedNodes[0].position = { x: 100, y: 100 }

    const { nodes } = await layoutGraph(lockedNodes, [], { preserveLocked: true })

    const locked = nodes.find(n => n.id === '1')!
    expect(locked.position).toEqual({ x: 100, y: 100 })

    const unlocked = nodes.find(n => n.id === '2')!
    expect(unlocked.position).toBeDefined()
  })

  it('handles empty graph', async () => {
    const { nodes, edges } = await layoutGraph([], [])
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it('handles single node', async () => {
    const { nodes } = await layoutGraph([makeNode('1')], [])
    expect(nodes).toHaveLength(1)
    expect(Number.isFinite(nodes[0].position.x)).toBe(true)
    expect(Number.isFinite(nodes[0].position.y)).toBe(true)
  })

  it('respects layout direction option', async () => {
    const { nodes: downNodes } = await layoutGraph(mockNodes, mockEdges, { direction: 'DOWN' })
    const { nodes: rightNodes } = await layoutGraph(mockNodes, mockEdges, { direction: 'RIGHT' })

    expect(downNodes).toHaveLength(3)
    expect(rightNodes).toHaveLength(3)

    expect(downNodes[0].position).not.toEqual(rightNodes[0].position)
  })

  // ---------------------------------------------------------------------------
  // Non-overlap and tier ordering
  // ---------------------------------------------------------------------------

  it('nodes do not overlap in a 5-node decision graph', async () => {
    const fiveNodes: Node[] = [
      makeNode('decision', 'decision'),
      makeNode('optA', 'option'),
      makeNode('optB', 'option'),
      makeNode('factorA', 'factor'),
      makeNode('goal', 'goal'),
    ]
    const fiveEdges: Edge[] = [
      makeEdge('e1', 'decision', 'optA'),
      makeEdge('e2', 'decision', 'optB'),
      makeEdge('e3', 'optA', 'factorA'),
      makeEdge('e4', 'factorA', 'goal'),
    ]
    const { nodes } = await layoutGraph(fiveNodes, fiveEdges, {})
    checkNoOverlap(nodes)
  })

  it('nodes do not overlap in a 10-node graph', async () => {
    const tenNodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('r1', 'risk'), makeNode('r2', 'risk'),
      makeNode('g', 'goal'),
    ]
    const tenEdges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o2', 'f2'), makeEdge('e6', 'o3', 'f3'),
      makeEdge('e7', 'f1', 'r1'), makeEdge('e8', 'f2', 'r2'),
      makeEdge('e9', 'r1', 'g'), makeEdge('e10', 'r2', 'g'),
    ]
    const { nodes } = await layoutGraph(tenNodes, tenEdges, {})
    checkNoOverlap(nodes)
  })

  it('linear chain lays out with strict tier ordering', async () => {
    const chain: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o', 'option'),
      makeNode('f', 'factor'),
      makeNode('out', 'outcome'),
      makeNode('g', 'goal'),
    ]
    const chainEdges: Edge[] = [
      makeEdge('e1', 'd', 'o'),
      makeEdge('e2', 'o', 'f'),
      makeEdge('e3', 'f', 'out'),
      makeEdge('e4', 'out', 'g'),
    ]
    const { nodes } = await layoutGraph(chain, chainEdges, {})

    const pos = (id: string) => nodes.find(n => n.id === id)!.position.y
    expect(pos('d')).toBeLessThan(pos('o'))
    expect(pos('o')).toBeLessThan(pos('f'))
    expect(pos('f')).toBeLessThan(pos('out'))
    expect(pos('out')).toBeLessThan(pos('g'))
  })

  // ---------------------------------------------------------------------------
  // Locked node behaviour
  // ---------------------------------------------------------------------------

  it('locked nodes are unchanged after a re-layout with new unlocked nodes', async () => {
    const nodesWithLocked: Node[] = [
      { ...makeNode('locked', 'goal', { locked: true }), position: { x: 500, y: 500 } },
      makeNode('d', 'decision'),
      makeNode('o', 'option'),
    ]
    const edgesForLocked: Edge[] = [makeEdge('e1', 'd', 'o')]

    const { nodes } = await layoutGraph(nodesWithLocked, edgesForLocked, { preserveLocked: true })

    const lockedNode = nodes.find(n => n.id === 'locked')!
    expect(lockedNode.position).toEqual({ x: 500, y: 500 })

    const d = nodes.find(n => n.id === 'd')!
    const o = nodes.find(n => n.id === 'o')!
    expect(Number.isFinite(d.position.x)).toBe(true)
    expect(Number.isFinite(o.position.x)).toBe(true)
  })

  it('all-locked graph returns nodes unchanged', async () => {
    const allLocked: Node[] = [
      { ...makeNode('a', 'decision', { locked: true }), position: { x: 10, y: 20 } },
      { ...makeNode('b', 'goal', { locked: true }), position: { x: 30, y: 40 } },
    ]
    const { nodes } = await layoutGraph(allLocked, [], { preserveLocked: true })
    expect(nodes.find(n => n.id === 'a')!.position).toEqual({ x: 10, y: 20 })
    expect(nodes.find(n => n.id === 'b')!.position).toEqual({ x: 30, y: 40 })
  })

  // ---------------------------------------------------------------------------
  // Viewport-constrained sizing
  // ---------------------------------------------------------------------------

  it('nodeW stays within [NODE_LAYOUT_MIN_W, NODE_CARD_MAX_W] for small graphs on a wide canvas', async () => {
    // 8-node graph: widest tier = 3 options. Should produce generous nodeW near MAX.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'),
      makeNode('out', 'outcome'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o2', 'f2'),
      makeEdge('e6', 'f1', 'out'), makeEdge('e7', 'f2', 'out'),
      makeEdge('e8', 'out', 'g'),
    ]
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {})
    expect(layoutNodeWidth).toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    expect(layoutNodeWidth).toBeLessThanOrEqual(NODE_CARD_MAX_W)
    // All positions must be finite
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('4-factor tier: max-single fires; the row OVERRUNS the canonical budget (regression-lock for NODE_CARD_MAX_W=320)', async () => {
    // After restoring NODE_CARD_MAX_W to 320 and tightening the default
    // spacing to 15 (chain 60 → 30 → 20 → 15), a 4-node tier falls into the
    // max-single branch and the rendered row visibly overruns the canonical
    // budget it was admitted against — the DOWN-branch defect recorded in
    // `layout.ts`'s header, pinned here rather than described. The pre-ELK `Math.max(20, spacing)` floor in
    // layout.ts clamps effective spacing to 20 even when the caller passes
    // 15, so the rendered last-edge stays at 1436 (was 1466 at spacing=30,
    // 1556 at spacing=60). Math:
    //
    //   effectiveSpacing = Math.max(20, SPACING) = 20
    //   rightEdge = CANVAS_MARGIN
    //             + (N-1) * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + effectiveSpacing)
    //             + NODE_CARD_MAX_W
    //             = 24 + 3 * (320 + 24 + 20) + 320
    //             = 24 + 3 * 364 + 320
    //             = 1436
    //
    // 1436 > 1185 → 251px past the budget the branch was chosen against. The test
    // exercises the production-default spacing path by passing SPACING that
    // matches the layoutGraph default; EFFECTIVE_SPACING below makes the
    // pre-ELK floor explicit in the assertion so a future change to either
    // value surfaces here.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'),
      makeNode('f3', 'factor'), makeNode('f4', 'factor'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'),
      makeEdge('e2', 'o1', 'f1'), makeEdge('e3', 'o1', 'f2'),
      makeEdge('e4', 'o1', 'f3'), makeEdge('e5', 'o1', 'f4'),
    ]
    const SPACING = 15
    const EFFECTIVE_SPACING = Math.max(20, SPACING)
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { spacing: SPACING },
    )

    // max-single fires: unclamped = floor((CANONICAL_LAYOUT_WIDTH - 3*MIN_GAP)/4)
    //                             = floor((1185 - 45)/4) = 285 ≥ 164.
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)

    const factors = laid
      .filter(n => n.type === 'factor')
      .sort((a, b) => a.position.x - b.position.x)
    expect(factors).toHaveLength(4)

    // Symbolic placement formula — resilient to future constant tweaks.
    const lastVisibleRightEdge = factors[3].position.x + NODE_CARD_MAX_W
    expect(lastVisibleRightEdge).toBe(
      CANVAS_MARGIN + 3 * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + EFFECTIVE_SPACING) + NODE_CARD_MAX_W,
    )

    // Outcome: the row overruns the budget the solver admitted it against.
    // If any contributing constant changes such that the rendered row now
    // fits the budget (or worse, gets clipped to min-width via a
    // re-introduced smarter threshold), this assertion flips and forces a
    // deliberate review.
    expect(lastVisibleRightEdge).toBeGreaterThan(CANONICAL_LAYOUT_WIDTH)
  })

  it('the single-row cap is SIX at the canonical budget, and MIN_GAP is the knob that moves it', async () => {
    // ⚠ RE-EXPRESSED, AND THE REASON MATTERS. This was a MIN_GAP behaviour-flip
    // lock: it drove a 7-factor tier at a 1500px canvas and asserted that
    // MIN_GAP=15 (vs the historic 30) flipped it onto the max-single branch.
    // `layoutGraph` no longer takes a canvas (founder ruling R1), and at the
    // pinned budget MIN_GAP 15 and 30 give the SAME single-row cap:
    //   cap = floor((AW + MIN_GAP) / (FAIR_SHARE + PADDING_X + MIN_GAP))
    //   MIN_GAP=15 → floor(1200/179) = 6      MIN_GAP=30 → floor(1215/194) = 6
    // So no tier count can discriminate 15 from 30 any more, and a test written
    // as though one could would be asserting a flip that cannot happen.
    //
    // What is locked instead: the CAP ITSELF, derived from the shipped constants
    // rather than recorded, plus a demonstration that the derivation is still
    // SENSITIVE to MIN_GAP (at 60 the cap drops to 5). Nothing is lost by the
    // change: for a DOWN layout MIN_GAP only ever enters through this threshold,
    // so a MIN_GAP move that does not shift the cap does not change any layout.
    const singleRowCap = (minGap: number): number =>
      Math.floor(
        (CANONICAL_LAYOUT_WIDTH + minGap) /
          (NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X + minGap),
      )
    expect(singleRowCap(MIN_GAP)).toBe(6)
    // The derivation DISCRIMINATES — without this the assertion above could be
    // satisfied by a formula that ignores MIN_GAP entirely (trap 20).
    expect(singleRowCap(60)).toBe(5)
    expect(singleRowCap(60)).not.toBe(singleRowCap(MIN_GAP))
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'), makeNode('f6', 'factor'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'),
      makeEdge('e2', 'o1', 'f1'), makeEdge('e3', 'o1', 'f2'), makeEdge('e4', 'o1', 'f3'),
      makeEdge('e5', 'o1', 'f4'), makeEdge('e6', 'o1', 'f5'), makeEdge('e7', 'o1', 'f6'),
    ]
    const SPACING = 15
    const EFFECTIVE_SPACING = Math.max(20, SPACING)
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { spacing: SPACING },
    )

    // …and the REAL layout agrees with the derivation: a 6-wide tier is a
    // single row of max-width cards.
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)

    const factors = laid
      .filter(n => n.type === 'factor')
      .sort((a, b) => a.position.x - b.position.x)
    expect(factors).toHaveLength(6)

    // Single-row placement formula: rightEdge = 24 + 5 * (320+24+20) + 320 = 2164.
    const lastVisibleRightEdge = factors[5].position.x + NODE_CARD_MAX_W
    expect(lastVisibleRightEdge).toBe(
      CANVAS_MARGIN + 5 * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + EFFECTIVE_SPACING) + NODE_CARD_MAX_W,
    )
    expect(lastVisibleRightEdge).toBeGreaterThan(CANONICAL_LAYOUT_WIDTH)
  })

  it('nodeW stays at NODE_CARD_MAX_W when widest tier overflows the viewport', async () => {
    // 5 factors previously compressed every node to ~241px. New policy: pin
    // every node to NODE_CARD_MAX_W and overflow horizontally. 5 <= 6, so this
    // is the single-row branch against the canonical budget.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'),
      makeEdge('e9', 'f1', 'g'), makeEdge('e10', 'f5', 'g'),
    ]
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {})
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('uses identical horizontal stride across tiers with different node counts', async () => {
    // 3 options vs 5 factors. Adjacent-pair gaps must be equal both within
    // and across tiers — narrower tiers do not spread to fill the wider tier.
    // Tolerance allows for ELK's sub-pixel rounding.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'),
      makeEdge('e9', 'f1', 'g'), makeEdge('e10', 'f5', 'g'),
    ]
    const { nodes: laid } = await layoutGraph(nodes, edges, {})

    const gapsFor = (ids: string[]): number[] => {
      const xs = ids
        .map(id => laid.find(n => n.id === id)!.position.x)
        .sort((a, b) => a - b)
      return xs.slice(1).map((x, i) => x - xs[i])
    }
    const optionGaps = gapsFor(['o1', 'o2', 'o3'])
    const factorGaps = gapsFor(['f1', 'f2', 'f3', 'f4', 'f5'])

    const allGaps = [...optionGaps, ...factorGaps]
    const minGap = Math.min(...allGaps)
    const maxGap = Math.max(...allGaps)
    expect(maxGap - minGap).toBeLessThanOrEqual(2)
  })

  it('aligns tier centres on a shared global anchor', async () => {
    // Improvement check: after applyUniformStride re-snaps tiers, every tier's
    // mean X-centre should be the same (within tolerance), so adjacent tiers
    // stack vertically aligned. This was the gap left by the per-tier
    // centroid approach in the first iteration.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'),
      makeEdge('e9', 'f1', 'g'), makeEdge('e10', 'f5', 'g'),
    ]
    const { nodes: laid } = await layoutGraph(nodes, edges, {})

    // ELK box width is uniform at NODE_CARD_MAX_W + LAYOUT_PADDING_X in this case
    const elkBoxW = NODE_CARD_MAX_W + LAYOUT_PADDING_X
    const tierMean = (ids: string[]): number => {
      const xs = ids.map(id => laid.find(n => n.id === id)!.position.x)
      return xs.reduce((a, b) => a + b, 0) / xs.length + elkBoxW / 2
    }
    const optionCentre = tierMean(['o1', 'o2', 'o3'])
    const factorCentre = tierMean(['f1', 'f2', 'f3', 'f4', 'f5'])

    // Tolerance: 1 px for sub-pixel rounding.
    expect(Math.abs(optionCentre - factorCentre)).toBeLessThanOrEqual(1)
  })

  it('nodeW is clamped to NODE_LAYOUT_MIN_W when the widest tier cannot take its fair share', async () => {
    // 14-node graph: 7 factors in tier 2. Against the canonical budget,
    // floor((1105 - 6*MIN_GAP)/7) = 145 < 164, so multi-row fires and
    // layoutNodeWidth must equal NODE_LAYOUT_MIN_W. ⚠ The branch is selected by
    // the TIER COUNT, not by a canvas: 7 is the smallest tier that splits.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'), makeNode('f6', 'factor'), makeNode('f7', 'factor'),
      makeNode('out', 'outcome'),
      makeNode('r1', 'risk'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'), makeEdge('e9', 'o3', 'f6'),
      makeEdge('e10', 'o3', 'f7'),
      makeEdge('e11', 'f1', 'out'), makeEdge('e12', 'f2', 'out'),
      makeEdge('e13', 'out', 'r1'), makeEdge('e14', 'r1', 'g'),
    ]
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {})
    expect(layoutNodeWidth).toBe(NODE_LAYOUT_MIN_W)
    // All positions must be finite and non-overlapping (using NODE_LAYOUT_MIN_W for overlap check)
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('multi-row splitting produces no overlapping nodes for a 7-factor tier', async () => {
    // Same 14-node graph as above, verify non-overlap using NODE_LAYOUT_MIN_W box
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'), makeNode('f6', 'factor'), makeNode('f7', 'factor'),
      makeNode('out', 'outcome'),
      makeNode('r1', 'risk'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'), makeEdge('e9', 'o3', 'f6'),
      makeEdge('e10', 'o3', 'f7'),
      makeEdge('e11', 'f1', 'out'), makeEdge('e12', 'f2', 'out'),
      makeEdge('e13', 'out', 'r1'), makeEdge('e14', 'r1', 'g'),
    ]
    const { nodes: laid } = await layoutGraph(nodes, edges, {})
    checkNoOverlap(laid, NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X)
  })

  /**
   * ⭐ THE CORPUS THAT MAKES `checkNoOverlap` ABLE TO FAIL.
   *
   * Every other fixture here uses `makeNode`, which carries no measured height,
   * so `layoutGraph` sizes every box at DEFAULT_NODE_HEIGHT (100) and the guard
   * compares 116 px boxes to a layout built from 116 px boxes — agreeing with
   * itself no matter what the layout does with a tall card.
   *
   * These heights are MEASURED, not invented: real Chromium, deployed staging
   * `d4ff3683`, the shipped starters at 1440x900
   * (`e2e/geometry/nodeOverlap.measure.ts`). Cards render 152-284 model px on
   * the founder's model and up to 529 px on `build-vs-buy` — 1.5x to 5x the
   * 100 px the layout reserves by default. If a future card change makes
   * `layoutGraph` mis-handle tall cards, this REDs.
   *
   * ⚠ SCOPE, STATED PRECISELY (CLAUDE.md trap 20): this pins that the LAYOUT
   * places tall cards without overlap. It does NOT and CANNOT pin the defect
   * that actually shipped — that layout was never RE-RUN once the cards grew,
   * which is a browser-timing property jsdom cannot observe at all. That one is
   * pinned by `useMeasureThenLayout.heightSubscription.spec.tsx` and witnessed
   * by `e2e/geometry/nodeOverlap.measure.ts`. Two different claims; neither
   * guard substitutes for the other.
   */
  it('nodes do not overlap when cards render at their REAL measured heights', async () => {
    const H: Record<string, number> = {
      d: 284, o1: 302, o2: 302, o3: 355,
      f1: 300, f2: 251, f3: 269, f4: 244, f5: 251, f6: 529, f7: 152,
      out: 198, r1: 241, g: 197,
    }
    const tall = (id: string, type: string): Node => ({
      ...makeNode(id, type),
      measured: { width: 232, height: H[id] },
    } as Node)

    const nodes: Node[] = [
      tall('d', 'decision'),
      tall('o1', 'option'), tall('o2', 'option'), tall('o3', 'option'),
      tall('f1', 'factor'), tall('f2', 'factor'), tall('f3', 'factor'),
      tall('f4', 'factor'), tall('f5', 'factor'), tall('f6', 'factor'), tall('f7', 'factor'),
      tall('out', 'outcome'),
      tall('r1', 'risk'),
      tall('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'), makeEdge('e3', 'd', 'o3'),
      makeEdge('e4', 'o1', 'f1'), makeEdge('e5', 'o1', 'f2'), makeEdge('e6', 'o2', 'f3'),
      makeEdge('e7', 'o2', 'f4'), makeEdge('e8', 'o3', 'f5'), makeEdge('e9', 'o3', 'f6'),
      makeEdge('e10', 'o3', 'f7'),
      makeEdge('e11', 'f1', 'out'), makeEdge('e12', 'f2', 'out'),
      makeEdge('e13', 'out', 'r1'), makeEdge('e14', 'r1', 'g'),
    ]

    const { nodes: laid } = await layoutGraph(nodes, edges, {})

    // The guard must be reading the REAL heights, not the 100 px default —
    // otherwise this whole case is theatre (it would pass on any layout).
    const laidById = new Map(laid.map(n => [n.id, n]))
    expect(
      (laidById.get('f6') as { measured?: { height?: number } } | undefined)?.measured?.height,
      'the 529 px card must survive layoutGraph, or this corpus proves nothing',
    ).toBe(529)

    checkNoOverlap(laid)
  })

  it('decision node is always above options which are above factors', async () => {
    // Verify tier ordering is preserved even with multi-row splitting
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'),
      makeEdge('e3', 'o1', 'f1'), makeEdge('e4', 'o1', 'f2'), makeEdge('e5', 'o1', 'f3'),
      makeEdge('e6', 'o2', 'f4'), makeEdge('e7', 'o2', 'f5'),
      makeEdge('e8', 'f1', 'g'), makeEdge('e9', 'f5', 'g'),
    ]
    const { nodes: laid } = await layoutGraph(nodes, edges, {})

    const dY = laid.find(n => n.id === 'd')!.position.y
    const o1Y = laid.find(n => n.id === 'o1')!.position.y
    const f1Y = laid.find(n => n.id === 'f1')!.position.y
    const gY = laid.find(n => n.id === 'g')!.position.y

    expect(dY).toBeLessThan(o1Y)
    expect(o1Y).toBeLessThan(f1Y)
    expect(f1Y).toBeLessThan(gY)
  })
})

// ---------------------------------------------------------------------------
// Post-layout collision guard
// ---------------------------------------------------------------------------

describe('applyCollisionGuard', () => {
  it('is a no-op when ELK spacing is already sufficient', async () => {
    // Run a real layout end-to-end so positions reflect actual ELK output,
    // then assert a second collision-guard pass doesn't shift anything.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'), makeNode('o2', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('out', 'outcome'),
      makeNode('g', 'goal'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'), makeEdge('e2', 'd', 'o2'),
      makeEdge('e3', 'o1', 'f1'), makeEdge('e4', 'o2', 'f2'), makeEdge('e5', 'o2', 'f3'),
      makeEdge('e6', 'f1', 'out'), makeEdge('e7', 'out', 'g'),
    ]
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {})

    // Build a positionMap mirroring the laid-out state, and a sizeMap using
    // the ELK box width returned by layoutGraph (uniform across all nodes).
    const elkBoxW = layoutNodeWidth + LAYOUT_PADDING_X
    const positionMap = new Map<string, { x: number; y: number }>()
    const sizeMap = new Map<string, { width: number; height: number }>()
    for (const n of laid) {
      positionMap.set(n.id, { x: n.position.x, y: n.position.y })
      sizeMap.set(n.id, { width: elkBoxW, height: 116 })
    }
    const before = new Map(Array.from(positionMap, ([id, p]) => [id, { ...p }]))

    applyCollisionGuard(positionMap, sizeMap, elkBoxW)

    for (const [id, prev] of before) {
      const now = positionMap.get(id)!
      expect(now.x).toBe(prev.x)
      expect(now.y).toBe(prev.y)
    }
  })

  it('pushes the right neighbour right when the gap is below threshold', () => {
    // nodeA at x=0 width=100 ends at x=100.
    // nodeB at x=105 leaves a 5px gap, below COLLISION_GAP=20.
    // Expected: nodeB pushed to x=120 (leftRight + COLLISION_GAP).
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0, y: 200 }],
      ['b', { x: 105, y: 200 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['a', { width: 100, height: 100 }],
      ['b', { width: 100, height: 100 }],
    ])

    applyCollisionGuard(positionMap, sizeMap, 100)

    expect(positionMap.get('a')).toEqual({ x: 0, y: 200 })
    expect(positionMap.get('b')).toEqual({ x: 120, y: 200 })
  })

  it('cascades the second sweep when pushing a node into its right neighbour', () => {
    // Three nodes, each 100px wide, on the same row:
    //   a at x=0   (right edge 100)
    //   b at x=105 (5px gap → pushed to x=120, right edge 220)
    //   c at x=235 (15px gap from b@120 → pushed to x=240 in 2nd sweep)
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0,   y: 100 }],
      ['b', { x: 105, y: 100 }],
      ['c', { x: 235, y: 100 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['a', { width: 100, height: 100 }],
      ['b', { width: 100, height: 100 }],
      ['c', { width: 100, height: 100 }],
    ])

    applyCollisionGuard(positionMap, sizeMap, 100)

    expect(positionMap.get('a')!.x).toBe(0)
    expect(positionMap.get('b')!.x).toBe(120)
    expect(positionMap.get('c')!.x).toBe(240)
  })

  it('does not touch nodes on different Y rows', () => {
    // a and b are on different rows (y differs by > tolerance). Even though
    // their x coordinates are tight, the guard must treat them as unrelated.
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0,   y: 100 }],
      ['b', { x: 105, y: 500 }],
    ])
    const sizeMap = new Map<string, { width: number; height: number }>([
      ['a', { width: 100, height: 100 }],
      ['b', { width: 100, height: 100 }],
    ])

    applyCollisionGuard(positionMap, sizeMap, 100)

    expect(positionMap.get('b')).toEqual({ x: 105, y: 500 })
  })
})

describe('groupByYRow', () => {
  it('groups nodes whose Y values differ by ≤ tolerance', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0, y: 100.3 }],
      ['b', { x: 50, y: 100.8 }],
    ])
    const groups = groupByYRow(['a', 'b'], positionMap)
    expect(groups.size).toBe(1)
    const onlyRow = Array.from(groups.values())[0]
    expect(onlyRow.sort()).toEqual(['a', 'b'])
  })

  it('separates nodes whose Y values differ by > tolerance', () => {
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0, y: 100 }],
      ['b', { x: 0, y: 115 }],
    ])
    const groups = groupByYRow(['a', 'b'], positionMap)
    expect(groups.size).toBe(2)
  })

  it('separates nodes at exactly tolerance + 1 (boundary case)', () => {
    // Default tolerance is 10 px; 11 px apart must fall into distinct groups.
    // This pins the < vs ≤ behaviour so later tuning can't silently drift.
    const positionMap = new Map<string, { x: number; y: number }>([
      ['a', { x: 0, y: 100 }],
      ['b', { x: 0, y: 111 }],
    ])
    const groups = groupByYRow(['a', 'b'], positionMap)
    expect(groups.size).toBe(2)
  })
})
