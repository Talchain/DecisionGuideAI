import { describe, it, expect } from 'vitest'
import { layoutGraph, groupByYRow, applyCollisionGuard } from '../utils/layout'
import type { CanvasSize } from '../utils/layout'
import {
  NODE_LAYOUT_MIN_W,
  NODE_CARD_MAX_W,
  LAYOUT_PADDING_X,
  LAYOUT_PADDING_Y,
  DEFAULT_NODE_HEIGHT,
  CANVAS_MARGIN,
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
 * Uses the largest NODE_REGISTRY bounding box as the conservative check:
 *   goal/decision: defaultSize 240w + 24px ELK padding = 264px wide
 *   all types:     defaultSize 100h + 16px ELK padding = 116px tall
 */
function checkNoOverlap(nodes: Node[], nodeW = 264, nodeH = 116): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position
      const b = nodes[j].position
      const overlapX = Math.abs(a.x - b.x) < nodeW
      const overlapY = Math.abs(a.y - b.y) < nodeH
      expect(
        overlapX && overlapY,
        `Nodes ${nodes[i].id} and ${nodes[j].id} overlap: ` +
        `(${a.x},${a.y}) vs (${b.x},${b.y})`
      ).toBe(false)
    }
  }
}

// Standard test canvas — reference viewport minus fixed chrome
const TEST_CANVAS: CanvasSize = { width: 1300, height: 750 }
// Narrow canvas simulating right panel open (1440 - 48 - 416 - 40 ≈ 936px)
const NARROW_CANVAS: CanvasSize = { width: 936, height: 750 }
// Wide canvas where 5 factors at NODE_CARD_MAX_W would previously have been
// compressed under the old fit-to-viewport policy; used to verify the
// pin-at-MAX-and-overflow rule and the uniform-stride rule.
const WIDE_CANVAS: CanvasSize = { width: 1700, height: 900 }

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
    const { layoutNodeWidth } = await layoutGraph(mockNodes, mockEdges, {}, TEST_CANVAS)
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
    const { nodes } = await layoutGraph(fiveNodes, fiveEdges, {}, TEST_CANVAS)
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
    const { nodes } = await layoutGraph(tenNodes, tenEdges, {}, TEST_CANVAS)
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
    const { nodes } = await layoutGraph(chain, chainEdges, {}, TEST_CANVAS)

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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {}, TEST_CANVAS)
    expect(layoutNodeWidth).toBeGreaterThanOrEqual(NODE_LAYOUT_MIN_W)
    expect(layoutNodeWidth).toBeLessThanOrEqual(NODE_CARD_MAX_W)
    // All positions must be finite
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('4-factor tier on 1300px canvas: max-single fires; row overflows canvas (regression-lock for NODE_CARD_MAX_W=320)', async () => {
    // After restoring NODE_CARD_MAX_W from 256 → 320 and removing the
    // smarter "max-row-fits visible canvas" gate (introduced in PR #163),
    // a 4-node tier on a 1300px canvas falls into the max-single branch
    // and the rendered row visibly overflows the canvas. Math:
    //
    //   rightEdge = CANVAS_MARGIN
    //             + (N-1) * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + spacing)
    //             + NODE_CARD_MAX_W
    //             = 24 + 3 * (320 + 24 + 60) + 320
    //             = 24 + 3 * 404 + 320
    //             = 1556
    //
    // 1556 > 1300 → 256px overflow past the canvas right edge. The
    // accompanying panel-aware visibleCanvasWidth computation in
    // layoutGraph still narrows availableWidth when the dock is open and
    // can force the min-width branch via the per-box check, but the
    // gate that previously forced min-width purely because the rendered
    // row wouldn't fit visibly is no longer present.
    //
    // This test locks both the placement formula and the accepted
    // overflow so that any future tweak of any contributing constant
    // (NODE_CARD_MAX_W, LAYOUT_PADDING_X, default spacing, CANVAS_MARGIN)
    // surfaces immediately rather than as a silent layout drift.
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
    const SPACING = 60
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { spacing: SPACING },
      TEST_CANVAS,
    )

    // max-single fires: unclamped = floor((1300*0.85 - 90)/4) = 253 ≥ 164.
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)

    const factors = laid
      .filter(n => n.type === 'factor')
      .sort((a, b) => a.position.x - b.position.x)
    expect(factors).toHaveLength(4)

    // Symbolic placement formula — resilient to future constant tweaks.
    const lastVisibleRightEdge = factors[3].position.x + NODE_CARD_MAX_W
    expect(lastVisibleRightEdge).toBe(
      CANVAS_MARGIN + 3 * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + SPACING) + NODE_CARD_MAX_W,
    )

    // Outcome: row overflows the canvas. If any contributing constant
    // changes such that the rendered row now fits the canvas (or worse,
    // gets clipped to min-width via a re-introduced smarter threshold),
    // this assertion flips and forces a deliberate review.
    expect(lastVisibleRightEdge).toBeGreaterThan(TEST_CANVAS.width)
  })

  it('nodeW stays at NODE_CARD_MAX_W when widest tier overflows the viewport', async () => {
    // 5 factors on a 1700px canvas previously compressed every node to ~241px.
    // New policy: pin every node to NODE_CARD_MAX_W and overflow horizontally.
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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {}, WIDE_CANVAS)
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
    const { nodes: laid } = await layoutGraph(nodes, edges, {}, WIDE_CANVAS)

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
    const { nodes: laid } = await layoutGraph(nodes, edges, {}, WIDE_CANVAS)

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

  it('nodeW is clamped to NODE_LAYOUT_MIN_W (200) when tier is too wide for canvas', async () => {
    // 14-node graph: 7 factors in tier 2. On a 936px narrow canvas,
    // 7 * 200 + 6 * 30 = 1580px > 936 * 0.85 = 795px, so multi-row fires.
    // layoutNodeWidth must equal 200.
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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {}, NARROW_CANVAS)
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
    const { nodes: laid } = await layoutGraph(nodes, edges, {}, NARROW_CANVAS)
    checkNoOverlap(laid, NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X, DEFAULT_NODE_HEIGHT + LAYOUT_PADDING_Y)
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
    const { nodes: laid } = await layoutGraph(nodes, edges, {}, NARROW_CANVAS)

    const dY = laid.find(n => n.id === 'd')!.position.y
    const o1Y = laid.find(n => n.id === 'o1')!.position.y
    const f1Y = laid.find(n => n.id === 'f1')!.position.y
    const gY = laid.find(n => n.id === 'g')!.position.y

    expect(dY).toBeLessThan(o1Y)
    expect(o1Y).toBeLessThan(f1Y)
    expect(f1Y).toBeLessThan(gY)
  })

  // ---------------------------------------------------------------------------
  // First-load panel subtraction (isFirstLoad option)
  //
  // layoutGraph accepts an optional `isFirstLoad: true` flag that subtracts
  // ANALYSIS_PANEL_WIDTH (416) from canvasSize.width before computing
  // availableWidth. The flag is opt-in: callers that omit it (or pass false)
  // get the panel-agnostic behaviour used for all manual auto-arranges.
  //
  // Asserting BOTH `layoutNodeWidth` (which branch fired) AND `factorRowCount`
  // (actual row splitting) to lock the distinction: the min-width branch
  // lowers per-box elkBoxW AND sets a nodesPerRow ceiling; actual tier-row
  // splitting only happens when tierSize > nodesPerRow. At 1440 + isFirstLoad
  // for a 4-node tier this means a true 2+2 split, not a single overflowing
  // row.
  // ---------------------------------------------------------------------------

  function factorRowCount(nodes: Node[]): number {
    return new Set(
      nodes.filter(n => n.type === 'factor').map(n => Math.round(n.position.y)),
    ).size
  }

  /**
   * Distribution of factor nodes per Y-row, sorted by Y ascending. Locks the
   * balanced-split contract from applyTierRowSplitting — e.g. 4 nodes at
   * nodesPerRow=3 should produce [2, 2] (balanced), not [3, 1] (greedy).
   */
  function factorRowDistribution(nodes: Node[]): number[] {
    const buckets = new Map<number, number>()
    for (const n of nodes) {
      if (n.type !== 'factor') continue
      const y = Math.round(n.position.y)
      buckets.set(y, (buckets.get(y) ?? 0) + 1)
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, count]) => count)
  }

  it('first-load: 4-factor tier @ 1440px with isFirstLoad=true → min-width branch + splits into 2 rows', async () => {
    // effectiveCanvasWidth = max(224, 1440 - 416) = 1024
    // availableWidth      = 1024 * 0.85 = 870
    // unclamped per-box   = floor((870 - 3*30) / 4) = 195 < 224 (= MIN_W + PAD_X)
    //   → min-width branch fires (elkBoxW = 224)
    // nodesPerRow         = floor((870 + 60) / (224 + 60)) = 3
    //   → tier size 4 > 3 → applyTierRowSplitting splits 2+2
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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { isFirstLoad: true },
      { width: 1440, height: 900 },
    )
    expect(layoutNodeWidth).toBe(NODE_LAYOUT_MIN_W)
    expect(factorRowCount(laid)).toBe(2)
    // Balanced 2+2 split: 4 nodes at nodesPerRow=3
    //   → rowCount = ceil(4/3) = 2, base = floor(4/2) = 2, remainder = 0
    //   → rows = [2, 2]
    expect(factorRowDistribution(laid)).toEqual([2, 2])
  })

  it('first-load: 4-factor tier @ 1440px with isFirstLoad=false → full canvas, max-width branch, single row', async () => {
    // availableWidth    = 1440 * 0.85 = 1224
    // unclamped per-box = floor((1224 - 90) / 4) = 283 ≥ 224
    //   → max-width branch fires (elkBoxW = NODE_CARD_MAX_W + LAYOUT_PADDING_X)
    // 4 nodes single row at NODE_CARD_MAX_W, no splitting.
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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { isFirstLoad: false },
      { width: 1440, height: 900 },
    )
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)
    expect(factorRowCount(laid)).toBe(1)
  })

  it('global-threshold-shift: 5-factor tier @ 1300px, no isFirstLoad → now min-width branch + splits (was max-width pre NODE_LAYOUT_MIN_W=200)', async () => {
    // Locks the GLOBAL behaviour change introduced by raising NODE_LAYOUT_MIN_W
    // from 140 to 200. The threshold check is `unclamped ≥ NODE_LAYOUT_MIN_W +
    // LAYOUT_PADDING_X`, which jumped from 164 to 224.
    //
    // 5-factor tier @ 1300px canvas (no first-load):
    //   availableWidth      = 1300 * 0.85 = 1105
    //   unclamped per-box   = floor((1105 - 4*30) / 5) = floor(985/5) = 197
    //   Pre-200: 197 ≥ 164 → max-width branch, single row at NODE_CARD_MAX_W
    //   Post-200: 197 < 224 → min-width branch fires
    //   nodesPerRow = floor((1105 + 60) / (224 + 60)) = floor(1165/284) = 4
    //   tier size 5 > 4 → applyTierRowSplitting splits 3+2
    //
    // This test exists to make the global threshold shift explicit. A
    // non-first-load 5-factor tier at typical viewport now produces 200px
    // multi-row instead of 320px single-row. Intended outcome of the brief
    // (compressed cards stay readable at 200 instead of 140) — but it
    // affects every layout path, not just first-load. The brief's risk-tier
    // A "two constants + first-load gate" framing under-stated this; this
    // test makes future agents see it.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'),
      makeNode('f3', 'factor'), makeNode('f4', 'factor'), makeNode('f5', 'factor'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'),
      makeEdge('e2', 'o1', 'f1'), makeEdge('e3', 'o1', 'f2'),
      makeEdge('e4', 'o1', 'f3'), makeEdge('e5', 'o1', 'f4'),
      makeEdge('e6', 'o1', 'f5'),
    ]
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      {},
      TEST_CANVAS,
    )
    expect(layoutNodeWidth).toBe(NODE_LAYOUT_MIN_W) // 200, was 320 pre-change
    expect(factorRowCount(laid)).toBe(2)            // 2 distinct Y-rows
    // Exact balanced distribution: 5 nodes / 2 rows = base 2 + remainder 1
    //   → rowCount = ceil(5/4) = 2, base = floor(5/2) = 2, remainder = 5%2 = 1
    //   → rows = [base+1, base] = [3, 2]
    // Locks the balanced-split contract in applyTierRowSplitting — a future
    // change to greedy (5,0) or unbalanced (4,1) would surface here.
    expect(factorRowDistribution(laid)).toEqual([3, 2])
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
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(nodes, edges, {}, TEST_CANVAS)

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
