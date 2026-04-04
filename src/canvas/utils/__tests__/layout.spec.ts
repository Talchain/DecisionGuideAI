/**
 * Layout algorithm tests — verifies ELK partition-based tier ordering,
 * overlap prevention, DOM-width consistency, and multi-row splitting.
 */
import { describe, it, expect } from 'vitest'
import { Node, Edge } from '@xyflow/react'
import { layoutGraph, TIER_BY_KIND, CanvasSize } from '../layout'

// ---------------------------------------------------------------------------
// Constants (must match layout.ts)
// ---------------------------------------------------------------------------
const CANVAS: CanvasSize = { width: 1300, height: 750 }
const NODE_SPACING = 60
const sizePaddingX = 24

const DOM_MAX_WIDTH: Record<string, number> = {
  decision: 320, goal: 300, option: 240, risk: 240,
  outcome: 220, factor: 200, action: 200, constraint: 200,
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeNode(id: string, type: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, kind: type },
  }
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target }
}

function getNodeWidth(node: Node): number {
  const kind = (node.type ?? '') as string
  return (DOM_MAX_WIDTH[kind] ?? 200) + sizePaddingX
}

interface BBox {
  id: string
  left: number
  right: number
  top: number
  bottom: number
}

function getBBoxes(nodes: Node[], margin: number): BBox[] {
  return nodes.map(n => {
    const w = getNodeWidth(n)
    const h = 100 + 16 // default height + sizePaddingY
    return {
      id: n.id,
      left: n.position.x - margin,
      right: n.position.x + w + margin,
      top: n.position.y - margin,
      bottom: n.position.y + h + margin,
    }
  })
}

function assertNoOverlap(nodes: Node[], margin = NODE_SPACING / 2) {
  const boxes = getBBoxes(nodes, margin)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const overlapsX = a.left < b.right && a.right > b.left
      const overlapsY = a.top < b.bottom && a.bottom > b.top
      if (overlapsX && overlapsY) {
        throw new Error(
          `Nodes ${a.id} and ${b.id} overlap: ` +
          `A(${a.left.toFixed(0)},${a.top.toFixed(0)})-(${a.right.toFixed(0)},${a.bottom.toFixed(0)}) ` +
          `B(${b.left.toFixed(0)},${b.top.toFixed(0)})-(${b.right.toFixed(0)},${b.bottom.toFixed(0)})`
        )
      }
    }
  }
}

function assertTierOrdering(nodes: Node[]) {
  const tierYs = new Map<number, number[]>()
  for (const n of nodes) {
    const tier = TIER_BY_KIND[n.type ?? ''] ?? 2
    if (!tierYs.has(tier)) tierYs.set(tier, [])
    tierYs.get(tier)!.push(n.position.y)
  }
  const tiers = [...tierYs.keys()].sort((a, b) => a - b)
  const medians = tiers.map(t => {
    const ys = tierYs.get(t)!.sort((a, b) => a - b)
    return { tier: t, median: ys[Math.floor(ys.length / 2)] }
  })
  for (let i = 0; i < medians.length - 1; i++) {
    expect(medians[i].median).toBeLessThan(medians[i + 1].median)
  }
}

// ---------------------------------------------------------------------------
// Test graphs
// ---------------------------------------------------------------------------
/** 3 options, 4 factors, 3 outcomes, 2 risks, 1 goal */
function outcomeRiskGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
    makeNode('f1', 'factor'), makeNode('f2', 'factor'),
    makeNode('f3', 'factor'), makeNode('f4', 'factor'),
    makeNode('out1', 'outcome'), makeNode('out2', 'outcome'), makeNode('out3', 'outcome'),
    makeNode('r1', 'risk'), makeNode('r2', 'risk'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'), makeEdge('d1', 'o3'),
    makeEdge('o1', 'f1'), makeEdge('o2', 'f2'), makeEdge('o2', 'f3'), makeEdge('o3', 'f4'),
    makeEdge('f1', 'out1'), makeEdge('f2', 'out2'), makeEdge('f3', 'out3'),
    makeEdge('f4', 'r1'), makeEdge('out1', 'r2'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'), makeEdge('out3', 'g1'),
    makeEdge('r1', 'g1'), makeEdge('r2', 'g1'),
  ]
  return { nodes, edges }
}

/** 4 options, 6 factors, 4 outcomes, 0 risks, 1 goal */
function noRiskGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'),
    makeNode('o3', 'option'), makeNode('o4', 'option'),
    makeNode('f1', 'factor'), makeNode('f2', 'factor'),
    makeNode('f3', 'factor'), makeNode('f4', 'factor'),
    makeNode('f5', 'factor'), makeNode('f6', 'factor'),
    makeNode('out1', 'outcome'), makeNode('out2', 'outcome'),
    makeNode('out3', 'outcome'), makeNode('out4', 'outcome'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'), makeEdge('d1', 'o3'), makeEdge('d1', 'o4'),
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('o2', 'f3'), makeEdge('o3', 'f4'),
    makeEdge('o4', 'f5'), makeEdge('o4', 'f6'),
    makeEdge('f1', 'out1'), makeEdge('f2', 'out2'),
    makeEdge('f3', 'out3'), makeEdge('f4', 'out4'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'),
    makeEdge('out3', 'g1'), makeEdge('out4', 'g1'),
  ]
  return { nodes, edges }
}

/** 3 options, 5 factors, 2 outcomes, 1 risk, 1 goal — tested at 1024px available width */
function panelGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'), makeNode('o3', 'option'),
    makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
    makeNode('f4', 'factor'), makeNode('f5', 'factor'),
    makeNode('out1', 'outcome'), makeNode('out2', 'outcome'),
    makeNode('r1', 'risk'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'), makeEdge('d1', 'o3'),
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('o2', 'f3'), makeEdge('o2', 'f4'),
    makeEdge('o3', 'f5'),
    makeEdge('f1', 'out1'), makeEdge('f3', 'out2'),
    makeEdge('f5', 'r1'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'), makeEdge('r1', 'g1'),
  ]
  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('layoutGraph', () => {
  describe('tier assignment', () => {
    it('uses 6 tiers: decision(0), option(1), factor(2), outcome(3), risk(4), goal(5)', () => {
      expect(TIER_BY_KIND).toEqual({
        decision: 0,
        option: 1,
        factor: 2,
        action: 2,
        constraint: 2,
        outcome: 3,
        risk: 4,
        goal: 5,
      })
    })
  })

  describe('outcome/risk separation (3o, 4f, 3out, 2r, 1g)', () => {
    it('places outcomes and risks on separate Y rows', async () => {
      const { nodes, edges } = outcomeRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      const outcomes = result.nodes.filter(n => n.type === 'outcome')
      const risks = result.nodes.filter(n => n.type === 'risk')
      const maxOutcomeY = Math.max(...outcomes.map(n => n.position.y))
      const minRiskY = Math.min(...risks.map(n => n.position.y))
      expect(maxOutcomeY).toBeLessThan(minRiskY)
    })

    it('produces no overlaps', async () => {
      const { nodes, edges } = outcomeRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = outcomeRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })
  })

  describe('no-risk graph (4o, 6f, 4out, 0r, 1g)', () => {
    it('has no phantom gap between outcomes and goals', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)

      // Collect median Y per occupied tier
      const tierMedianY = new Map<number, number>()
      const tierYs = new Map<number, number[]>()
      for (const n of result.nodes) {
        const tier = TIER_BY_KIND[n.type ?? ''] ?? 2
        if (!tierYs.has(tier)) tierYs.set(tier, [])
        tierYs.get(tier)!.push(n.position.y)
      }
      for (const [tier, ys] of tierYs) {
        const sorted = [...ys].sort((a, b) => a - b)
        tierMedianY.set(tier, sorted[Math.floor(sorted.length / 2)])
      }

      const occupiedTiers = [...tierMedianY.keys()].sort((a, b) => a - b)
      expect(occupiedTiers).not.toContain(4) // no risk tier

      // Gaps between consecutive occupied tiers should be roughly uniform
      const gaps: number[] = []
      for (let i = 0; i < occupiedTiers.length - 1; i++) {
        gaps.push(tierMedianY.get(occupiedTiers[i + 1])! - tierMedianY.get(occupiedTiers[i])!)
      }
      // The outcome→goal gap should not be more than 2× the median of other gaps
      const outcomeGoalIdx = occupiedTiers.indexOf(3)
      if (outcomeGoalIdx >= 0 && outcomeGoalIdx < gaps.length) {
        const outcomeGoalGap = gaps[outcomeGoalIdx]
        const otherGaps = gaps.filter((_, i) => i !== outcomeGoalIdx)
        if (otherGaps.length > 0) {
          const medianOther = otherGaps.sort((a, b) => a - b)[Math.floor(otherGaps.length / 2)]
          expect(outcomeGoalGap).toBeLessThanOrEqual(medianOther * 2)
        }
      }
    })

    it('produces no overlaps', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })
  })

  describe('panel-constrained graph (3o, 5f, 2out, 1r, 1g at 1024px)', () => {
    const PANEL_CANVAS: CanvasSize = { width: 1024, height: 750 }

    it('produces no overlaps', async () => {
      const { nodes, edges } = panelGraph()
      const result = await layoutGraph(nodes, edges, {}, PANEL_CANVAS)
      assertNoOverlap(result.nodes, 0) // zero margin — tight viewport
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = panelGraph()
      const result = await layoutGraph(nodes, edges, {}, PANEL_CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('returns a valid layoutNodeWidth', async () => {
      const { nodes, edges } = panelGraph()
      const result = await layoutGraph(nodes, edges, {}, PANEL_CANVAS)
      expect(result.layoutNodeWidth).toBeGreaterThanOrEqual(140)
      expect(result.layoutNodeWidth).toBeLessThanOrEqual(320)
    })
  })

  describe('basic layout properties', () => {
    it('returns layoutNodeWidth', async () => {
      const { nodes, edges } = outcomeRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      expect(result.layoutNodeWidth).toBeGreaterThanOrEqual(140)
      expect(result.layoutNodeWidth).toBeLessThanOrEqual(320)
    })

    it('preserves locked node positions', async () => {
      const locked: Node = {
        id: 'locked1', type: 'decision',
        position: { x: 100, y: 200 },
        data: { label: 'Locked', kind: 'decision', locked: true },
      }
      const free: Node = {
        id: 'free1', type: 'option',
        position: { x: 0, y: 0 },
        data: { label: 'Free', kind: 'option' },
      }
      const result = await layoutGraph(
        [locked, free],
        [makeEdge('locked1', 'free1')],
        { preserveLocked: true },
        CANVAS
      )
      const lockedResult = result.nodes.find(n => n.id === 'locked1')!
      expect(lockedResult.position).toEqual({ x: 100, y: 200 })
    })

    it('handles empty graph', async () => {
      const result = await layoutGraph([], [], {}, CANVAS)
      expect(result.nodes).toEqual([])
      expect(result.layoutNodeWidth).toBe(200)
    })
  })
})
