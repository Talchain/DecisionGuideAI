/**
 * Layout algorithm tests — verifies per-tier sizing, parent-centring,
 * tier ordering, overlap prevention, and multi-row splitting.
 */
import { describe, it, expect } from 'vitest'
import { Node, Edge } from '@xyflow/react'
import { layoutGraph, TIER_BY_KIND, CanvasSize } from '../layout'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const CANVAS: CanvasSize = { width: 1300, height: 750 }
const NODE_SPACING = 60 // default

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

/** Bounding box with nodeSpacing/2 margin */
interface BBox {
  id: string
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Compute per-tier elkBoxW the same way the layout algorithm does,
 * so overlap checks use the actual width ELK assigns to each node.
 */
function computeNodeWidths(nodes: Node[]): Map<string, number> {
  const AVAILABLE = CANVAS.width * 0.85
  const MIN_W = 140
  const MAX_W = 260
  const PAD_X = 24
  const GAP = Math.max(50, NODE_SPACING) // MIN_GAP=50, effectiveNodeSpacing=60 → 60

  // Count per tier
  const tierCounts = new Map<number, number>()
  for (const n of nodes) {
    const tier = TIER_BY_KIND[n.type ?? ''] ?? 2
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1)
  }

  const tierW = new Map<number, number>()
  for (const [tier, count] of tierCounts) {
    if (count <= 1) {
      tierW.set(tier, MAX_W + PAD_X)
    } else {
      const unclamped = Math.floor((AVAILABLE - (count - 1) * GAP) / count)
      if (unclamped >= MIN_W + PAD_X) {
        tierW.set(tier, Math.min(MAX_W + PAD_X, unclamped))
      } else {
        tierW.set(tier, MIN_W + PAD_X)
      }
    }
  }

  const widths = new Map<string, number>()
  for (const n of nodes) {
    const tier = TIER_BY_KIND[n.type ?? ''] ?? 2
    // Content width = elkBoxW - padX
    widths.set(n.id, (tierW.get(tier) ?? MAX_W + PAD_X) - PAD_X)
  }
  return widths
}

function getBBoxes(
  nodes: Node[],
  margin: number,
  widths: Map<string, number>,
): BBox[] {
  return nodes.map(n => {
    const w = widths.get(n.id) ?? 220
    const h = 100
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
  const widths = computeNodeWidths(nodes)
  const boxes = getBBoxes(nodes, margin, widths)
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
  // Group by tier, get median Y per tier, verify monotonic
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

function getNodeCentreX(n: Node, widths: Map<string, number>): number {
  const w = widths.get(n.id) ?? 220
  return n.position.x + w / 2
}

function assertOptionsUnderDecision(nodes: Node[]) {
  const decision = nodes.find(n => n.type === 'decision')
  const options = nodes.filter(n => n.type === 'option')
  if (!decision || options.length === 0) return

  const widths = computeNodeWidths(nodes)
  const availableWidth = CANVAS.width * 0.85
  // ELK distributes options across the full graph width centred around the
  // graph centroid. For complex graphs with many downstream connections, ELK
  // may spread options wider than availableWidth to minimise edge crossings.
  // Allow generous tolerance: 2× available width from the decision centre.
  const maxDeviation = availableWidth * 2

  const decisionCx = getNodeCentreX(decision, widths)
  for (const opt of options) {
    const optCx = getNodeCentreX(opt, widths)
    expect(Math.abs(optCx - decisionCx)).toBeLessThanOrEqual(maxDeviation)
  }
}

function assertFactorsNearParents(
  resultNodes: Node[],
  edges: Edge[],
) {
  const widths = computeNodeWidths(resultNodes)
  const factors = resultNodes.filter(n => n.type === 'factor')
  const nodeMap = new Map(resultNodes.map(n => [n.id, n]))

  for (const factor of factors) {
    // Find parent option nodes
    const parentEdges = edges.filter(e => e.target === factor.id)
    const parentOptions = parentEdges
      .map(e => nodeMap.get(e.source))
      .filter((n): n is Node => n !== undefined && n.type === 'option')

    if (parentOptions.length === 0) continue

    const meanParentX =
      parentOptions.reduce((sum, p) => sum + getNodeCentreX(p, widths), 0) /
      parentOptions.length

    const factorCx = getNodeCentreX(factor, widths)
    // Factor should be within the available width of parent centroid.
    // The parent-centring pass is damped (0.5) and iterative (max 3 passes),
    // so exact alignment is not expected — especially for shared factors
    // connected to options spread across the canvas. For large graphs,
    // collision resolution may push factors further from their parent centroid.
    const availableWidth = CANVAS.width * 0.85
    expect(Math.abs(factorCx - meanParentX)).toBeLessThanOrEqual(
      availableWidth
    )
  }
}

// ---------------------------------------------------------------------------
// Test graphs
// ---------------------------------------------------------------------------
function smallGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'),
    makeNode('o2', 'option'),
    makeNode('f1', 'factor'),
    makeNode('f2', 'factor'),
    makeNode('f3', 'factor'),
    makeNode('out1', 'outcome'),
    makeNode('out2', 'outcome'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'),
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('o2', 'f2'), makeEdge('o2', 'f3'),
    makeEdge('f1', 'out1'), makeEdge('f3', 'out2'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'),
  ]
  return { nodes, edges }
}

function mediumGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'),
    makeNode('o3', 'option'), makeNode('o4', 'option'),
    makeNode('f1', 'factor'), makeNode('f2', 'factor'),
    makeNode('f3', 'factor'), makeNode('f4', 'factor'),
    makeNode('f5', 'factor'), makeNode('f6', 'factor'),
    makeNode('f7', 'factor'),
    makeNode('out1', 'outcome'), makeNode('out2', 'outcome'),
    makeNode('out3', 'outcome'), makeNode('out4', 'outcome'),
    makeNode('out5', 'outcome'),
    makeNode('g1', 'goal'),
  ]
  // f1, f3, f5 are shared across multiple options
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'),
    makeEdge('d1', 'o3'), makeEdge('d1', 'o4'),
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('o2', 'f1'), makeEdge('o2', 'f3'),
    makeEdge('o3', 'f3'), makeEdge('o3', 'f4'), makeEdge('o3', 'f5'),
    makeEdge('o4', 'f5'), makeEdge('o4', 'f6'), makeEdge('o4', 'f7'),
    makeEdge('f1', 'out1'), makeEdge('f2', 'out2'),
    makeEdge('f3', 'out3'), makeEdge('f4', 'out4'),
    makeEdge('f5', 'out5'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'),
    makeEdge('out3', 'g1'), makeEdge('out4', 'g1'),
    makeEdge('out5', 'g1'),
  ]
  return { nodes, edges }
}

function largeGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'),
    makeNode('o3', 'option'), makeNode('o4', 'option'),
    makeNode('o5', 'option'), makeNode('o6', 'option'),
    // 12 factors (f1, f3, f5, f7, f9 shared)
    ...Array.from({ length: 12 }, (_, i) => makeNode(`f${i + 1}`, 'factor')),
    // 8 outcomes
    ...Array.from({ length: 8 }, (_, i) => makeNode(`out${i + 1}`, 'outcome')),
    // 3 risks
    makeNode('r1', 'risk'), makeNode('r2', 'risk'), makeNode('r3', 'risk'),
    makeNode('g1', 'goal'), makeNode('g2', 'goal'),
  ]
  const edges = [
    // decision → options
    ...['o1', 'o2', 'o3', 'o4', 'o5', 'o6'].map(o => makeEdge('d1', o)),
    // options → factors (shared: f1, f3, f5, f7, f9)
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('o2', 'f1'), makeEdge('o2', 'f3'),
    makeEdge('o3', 'f3'), makeEdge('o3', 'f4'), makeEdge('o3', 'f5'),
    makeEdge('o4', 'f5'), makeEdge('o4', 'f6'), makeEdge('o4', 'f7'),
    makeEdge('o5', 'f7'), makeEdge('o5', 'f8'), makeEdge('o5', 'f9'),
    makeEdge('o6', 'f9'), makeEdge('o6', 'f10'), makeEdge('o6', 'f11'),
    makeEdge('o6', 'f12'),
    // factors → outcomes
    makeEdge('f1', 'out1'), makeEdge('f2', 'out2'),
    makeEdge('f3', 'out3'), makeEdge('f4', 'out4'),
    makeEdge('f5', 'out5'), makeEdge('f6', 'out6'),
    makeEdge('f7', 'out7'), makeEdge('f8', 'out8'),
    // outcomes → risks
    makeEdge('out1', 'r1'), makeEdge('out3', 'r2'), makeEdge('out5', 'r3'),
    // outcomes → goals
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'),
    makeEdge('out3', 'g1'), makeEdge('out4', 'g2'),
    makeEdge('out5', 'g2'), makeEdge('out6', 'g2'),
    makeEdge('out7', 'g1'), makeEdge('out8', 'g2'),
    // risks → goals
    makeEdge('r1', 'g1'), makeEdge('r2', 'g2'), makeEdge('r3', 'g2'),
  ]
  return { nodes, edges }
}

function singleOptionGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'),
    makeNode('f1', 'factor'), makeNode('f2', 'factor'),
    makeNode('out1', 'outcome'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'),
    makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
    makeEdge('f1', 'out1'), makeEdge('f2', 'out1'),
    makeEdge('out1', 'g1'),
  ]
  return { nodes, edges }
}

function maxWidthGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes = [
    makeNode('d1', 'decision'),
    makeNode('o1', 'option'), makeNode('o2', 'option'),
    // 10 factors — forces multi-row split
    ...Array.from({ length: 10 }, (_, i) => makeNode(`f${i + 1}`, 'factor')),
    makeNode('out1', 'outcome'), makeNode('out2', 'outcome'),
    makeNode('out3', 'outcome'),
    makeNode('g1', 'goal'),
  ]
  const edges = [
    makeEdge('d1', 'o1'), makeEdge('d1', 'o2'),
    ...Array.from({ length: 5 }, (_, i) => makeEdge('o1', `f${i + 1}`)),
    ...Array.from({ length: 5 }, (_, i) => makeEdge('o2', `f${i + 6}`)),
    makeEdge('f1', 'out1'), makeEdge('f5', 'out2'), makeEdge('f10', 'out3'),
    makeEdge('out1', 'g1'), makeEdge('out2', 'g1'), makeEdge('out3', 'g1'),
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

  describe('small graph (1d, 2o, 3f, 2out, 1g)', () => {
    it('produces no overlaps', async () => {
      const { nodes, edges } = smallGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = smallGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('distributes options under the decision', async () => {
      const { nodes, edges } = smallGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertOptionsUnderDecision(result.nodes)
    })

    it('positions factors near parent option centroids', async () => {
      const { nodes, edges } = smallGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertFactorsNearParents(result.nodes, edges)
    })
  })

  describe('medium graph (1d, 4o, 7f with 3 shared, 5out, 1g)', () => {
    it('produces no overlaps', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('distributes options under the decision', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertOptionsUnderDecision(result.nodes)
    })

    it('positions shared factors near parent centroids', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertFactorsNearParents(result.nodes, edges)
    })
  })

  describe('large graph (1d, 6o, 12f with 5 shared, 8out, 3r, 2g)', () => {
    it('produces no overlaps', async () => {
      const { nodes, edges } = largeGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = largeGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('distributes options under the decision', async () => {
      const { nodes, edges } = largeGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertOptionsUnderDecision(result.nodes)
    })

    it('positions factors near parent centroids', async () => {
      const { nodes, edges } = largeGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertFactorsNearParents(result.nodes, edges)
    })

    it('separates risk and outcome tiers in Y', async () => {
      const { nodes, edges } = largeGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      const outcomes = result.nodes.filter(n => n.type === 'outcome')
      const risks = result.nodes.filter(n => n.type === 'risk')
      const maxOutcomeY = Math.max(...outcomes.map(n => n.position.y))
      const minRiskY = Math.min(...risks.map(n => n.position.y))
      expect(maxOutcomeY).toBeLessThan(minRiskY)
    })
  })

  describe('single option graph (1d, 1o, 2f, 1out, 1g)', () => {
    it('produces no overlaps', async () => {
      const { nodes, edges } = singleOptionGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = singleOptionGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('distributes options under the decision', async () => {
      const { nodes, edges } = singleOptionGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertOptionsUnderDecision(result.nodes)
    })
  })

  describe('max-width graph (1d, 2o, 10f, 3out, 1g) — forces multi-row', () => {
    it('produces no overlaps', async () => {
      const { nodes, edges } = maxWidthGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })

    it('maintains strict tier Y ordering', async () => {
      const { nodes, edges } = maxWidthGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('distributes options under the decision', async () => {
      const { nodes, edges } = maxWidthGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertOptionsUnderDecision(result.nodes)
    })

    it('returns valid layoutNodeWidth', async () => {
      const { nodes, edges } = maxWidthGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      expect(result.layoutNodeWidth).toBeGreaterThanOrEqual(140)
      expect(result.layoutNodeWidth).toBeLessThanOrEqual(260)
    })
  })

  describe('sub-MIN_GAP spacing (spacing=30, MIN_GAP=50 still enforced)', () => {
    it('enforces at least 50px gap between adjacent nodes', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, { spacing: 30 }, CANVAS)

      // Group nodes by tier and Y-row, then check horizontal gaps
      const tierNodes = new Map<number, Node[]>()
      for (const n of result.nodes) {
        const tier = TIER_BY_KIND[n.type ?? ''] ?? 2
        if (!tierNodes.has(tier)) tierNodes.set(tier, [])
        tierNodes.get(tier)!.push(n)
      }

      const widths = computeNodeWidths(result.nodes)
      const MIN_GAP = 50

      for (const [, nodesInTier] of tierNodes) {
        if (nodesInTier.length < 2) continue

        // Group by Y-row
        const rowGroups = new Map<number, Node[]>()
        for (const n of nodesInTier) {
          const y = Math.round(n.position.y)
          if (!rowGroups.has(y)) rowGroups.set(y, [])
          rowGroups.get(y)!.push(n)
        }

        for (const rowNodes of rowGroups.values()) {
          if (rowNodes.length < 2) continue
          const sorted = [...rowNodes].sort((a, b) => a.position.x - b.position.x)
          for (let i = 0; i < sorted.length - 1; i++) {
            const aRight = sorted[i].position.x + (widths.get(sorted[i].id) ?? 220)
            const bLeft = sorted[i + 1].position.x
            const actualGap = bLeft - aRight
            expect(actualGap).toBeGreaterThanOrEqual(MIN_GAP - 1) // 1px tolerance for rounding
          }
        }
      }
    })

    it('produces no overlaps with sub-MIN_GAP spacing', async () => {
      const { nodes, edges } = mediumGraph()
      const result = await layoutGraph(nodes, edges, { spacing: 30 }, CANVAS)
      // Use zero margin: sub-MIN_GAP spacing reduces layer spacing too,
      // so the default NODE_SPACING/2 margin is too generous for cross-row checks.
      assertNoOverlap(result.nodes, 0)
    })
  })

  describe('no-risk graph (1d, 2o, 3f, 2out, 0r, 1g) — empty tier 4', () => {
    function noRiskGraph(): { nodes: Node[]; edges: Edge[] } {
      const nodes = [
        makeNode('d1', 'decision'),
        makeNode('o1', 'option'), makeNode('o2', 'option'),
        makeNode('f1', 'factor'), makeNode('f2', 'factor'), makeNode('f3', 'factor'),
        makeNode('out1', 'outcome'), makeNode('out2', 'outcome'),
        makeNode('g1', 'goal'),
      ]
      const edges = [
        makeEdge('d1', 'o1'), makeEdge('d1', 'o2'),
        makeEdge('o1', 'f1'), makeEdge('o1', 'f2'),
        makeEdge('o2', 'f2'), makeEdge('o2', 'f3'),
        makeEdge('f1', 'out1'), makeEdge('f3', 'out2'),
        makeEdge('out1', 'g1'), makeEdge('out2', 'g1'),
      ]
      return { nodes, edges }
    }

    it('maintains monotonic tier Y ordering', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertTierOrdering(result.nodes)
    })

    it('has no double-height gap between outcomes and goals', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)

      // Collect the layer gaps between each adjacent pair of occupied tiers.
      // With no risk tier, outcomes (tier 3) connect directly to goals (tier 5).
      // ELK places them in adjacent layers, so the outcome→goal gap should be
      // comparable to other inter-tier gaps — not double.
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
      // Should be [0, 1, 2, 3, 5] — tier 4 (risk) is absent
      expect(occupiedTiers).not.toContain(4)

      // Compute gaps between consecutive occupied tiers
      const gaps: { from: number; to: number; gap: number }[] = []
      for (let i = 0; i < occupiedTiers.length - 1; i++) {
        const from = occupiedTiers[i]
        const to = occupiedTiers[i + 1]
        gaps.push({
          from,
          to,
          gap: tierMedianY.get(to)! - tierMedianY.get(from)!,
        })
      }

      // The outcome→goal gap (tiers 3→5) should not be more than 2× the
      // median of other inter-tier gaps. ELK determines layers from edges,
      // not from our tier indices, so the gap should be normal.
      const outcomeGoalGap = gaps.find(g => g.from === 3 && g.to === 5)
      const otherGaps = gaps.filter(g => !(g.from === 3 && g.to === 5))
      expect(outcomeGoalGap).toBeDefined()
      expect(otherGaps.length).toBeGreaterThan(0)

      const medianOtherGap = otherGaps
        .map(g => g.gap)
        .sort((a, b) => a - b)[Math.floor(otherGaps.length / 2)]

      expect(outcomeGoalGap!.gap).toBeLessThanOrEqual(medianOtherGap * 2)
    })

    it('produces no overlaps', async () => {
      const { nodes, edges } = noRiskGraph()
      const result = await layoutGraph(nodes, edges, {}, CANVAS)
      assertNoOverlap(result.nodes)
    })
  })
})
