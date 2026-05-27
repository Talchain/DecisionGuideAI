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
    // After restoring NODE_CARD_MAX_W to 320 and tightening the default
    // spacing to 15 (chain 60 → 30 → 20 → 15), a 4-node tier on a 1300px
    // canvas falls into the max-single branch and the rendered row visibly
    // overflows the canvas. The pre-ELK `Math.max(20, spacing)` floor in
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
    // 1436 > 1300 → 136px overflow past the canvas right edge. The test
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
      TEST_CANVAS,
    )

    // max-single fires: unclamped = floor((1300*0.85 - 3*MIN_GAP)/4)
    //                             = floor((1105 - 45)/4) = 265 ≥ 164.
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

    // Outcome: row overflows the canvas. If any contributing constant
    // changes such that the rendered row now fits the canvas (or worse,
    // gets clipped to min-width via a re-introduced smarter threshold),
    // this assertion flips and forces a deliberate review.
    expect(lastVisibleRightEdge).toBeGreaterThan(TEST_CANVAS.width)
  })

  it('7-factor tier on 1500px canvas: MIN_GAP=15 flips max-single ON (regression-lock for MIN_GAP)', async () => {
    // MIN_GAP behaviour-flip lock. The `unclamped >= NODE_LAYOUT_MIN_W +
    // LAYOUT_PADDING_X` gate decides max-single vs multi-row branch; MIN_GAP
    // is the only knob that moves this threshold without touching widths.
    //
    //   unclamped = floor((1500*0.85 - 6*MIN_GAP) / 7)
    //
    // At MIN_GAP=30 (prior): floor((1275 - 180)/7) = floor(1095/7) = 156.
    //   156 < 164 (= MIN_W + PADDING_X) → multi-row branch, nodes compress
    //   to NODE_LAYOUT_MIN_W=140, the row fits the canvas at ~1268px.
    // At MIN_GAP=15 (current): floor((1275 - 90)/7) = floor(1185/7) = 169.
    //   169 >= 164 → max-single fires, every node at NODE_CARD_MAX_W=320,
    //   the row visibly overflows by ~1028px.
    //
    // If MIN_GAP rises back to ~25+ this assertion flips and forces a
    // deliberate review of whether 7-factor tiers should overflow at MAX_W
    // or compress to fit.
    const nodes: Node[] = [
      makeNode('d', 'decision'),
      makeNode('o1', 'option'),
      makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
      makeNode('f4', 'factor'), makeNode('f5', 'factor'), makeNode('f6', 'factor'),
      makeNode('f7', 'factor'),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'd', 'o1'),
      makeEdge('e2', 'o1', 'f1'), makeEdge('e3', 'o1', 'f2'), makeEdge('e4', 'o1', 'f3'),
      makeEdge('e5', 'o1', 'f4'), makeEdge('e6', 'o1', 'f5'), makeEdge('e7', 'o1', 'f6'),
      makeEdge('e8', 'o1', 'f7'),
    ]
    const FLIP_CANVAS: CanvasSize = { width: 1500, height: 900 }
    const SPACING = 15
    const EFFECTIVE_SPACING = Math.max(20, SPACING)
    const { nodes: laid, layoutNodeWidth } = await layoutGraph(
      nodes,
      edges,
      { spacing: SPACING },
      FLIP_CANVAS,
    )

    // max-single fired: nodes at MAX_W (proves MIN_GAP threshold relaxed).
    expect(layoutNodeWidth).toBe(NODE_CARD_MAX_W)

    const factors = laid
      .filter(n => n.type === 'factor')
      .sort((a, b) => a.position.x - b.position.x)
    expect(factors).toHaveLength(7)

    // Single-row placement formula: rightEdge = 24 + 6 * (320+24+20) + 320 = 2528.
    const lastVisibleRightEdge = factors[6].position.x + NODE_CARD_MAX_W
    expect(lastVisibleRightEdge).toBe(
      CANVAS_MARGIN + 6 * (NODE_CARD_MAX_W + LAYOUT_PADDING_X + EFFECTIVE_SPACING) + NODE_CARD_MAX_W,
    )
    expect(lastVisibleRightEdge).toBeGreaterThan(FLIP_CANVAS.width)
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

  it('nodeW is clamped to NODE_LAYOUT_MIN_W (140) when tier is too wide for canvas', async () => {
    // 14-node graph: 7 factors in tier 2. On a 936px narrow canvas,
    // 7 * 140 + 6 * 30 = 1160px > 936 * 0.85 = 795px, so multi-row fires.
    // layoutNodeWidth must equal 140.
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
