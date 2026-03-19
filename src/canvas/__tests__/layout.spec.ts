import { describe, it, expect } from 'vitest'
import { layoutGraph } from '../utils/layout'
import type { CanvasSize } from '../utils/layout'
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

/**
 * Return the bounding box of a set of laid-out nodes.
 * Note: measures node origin points only, not including node dimensions.
 */
function bounds(nodes: Node[]): { w: number; h: number; minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.position.x < minX) minX = n.position.x
    if (n.position.x > maxX) maxX = n.position.x
    if (n.position.y < minY) minY = n.position.y
    if (n.position.y > maxY) maxY = n.position.y
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }
}

// Standard test canvas — reference viewport minus fixed chrome
const TEST_CANVAS: CanvasSize = { width: 1300, height: 750 }
// Narrow canvas simulating right panel open (1440 - 48 - 416 - 40 ≈ 936px)
const NARROW_CANVAS: CanvasSize = { width: 936, height: 750 }

// ---------------------------------------------------------------------------
// Core layout tests
// ---------------------------------------------------------------------------

describe('ELK Layout', () => {
  const mockNodes: Node[] = [
    makeNode('1'),
    makeNode('2'),
    makeNode('3'),
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

    // Node 1 (source) must be above nodes 2 and 3 in DOWN layout
    const node1 = nodes.find(n => n.id === '1')!
    const node2 = nodes.find(n => n.id === '2')!
    expect(node1.position.y).toBeLessThan(node2.position.y)
  })

  it('returns layoutNodeWidth', async () => {
    const { layoutNodeWidth } = await layoutGraph(mockNodes, mockEdges, {}, TEST_CANVAS)
    expect(layoutNodeWidth).toBeGreaterThanOrEqual(140)
    expect(layoutNodeWidth).toBeLessThanOrEqual(240)
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

  it('nodeW stays within [140, 240] for small graphs on a wide canvas', async () => {
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
    expect(layoutNodeWidth).toBeGreaterThanOrEqual(140)
    expect(layoutNodeWidth).toBeLessThanOrEqual(240)
    // All positions must be finite
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('nodeW is clamped to MIN_NODE_W (140) when tier is too wide for canvas', async () => {
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
    expect(layoutNodeWidth).toBe(140)
    // All positions must be finite and non-overlapping (using MIN_NODE_W for overlap check)
    laid.forEach(n => {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    })
  })

  it('multi-row splitting produces no overlapping nodes for a 7-factor tier', async () => {
    // Same 14-node graph as above, verify non-overlap using MIN_NODE_W = 140px box
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
    checkNoOverlap(laid, 140 + 24, 100 + 16) // MIN_NODE_W + ELK padding
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
