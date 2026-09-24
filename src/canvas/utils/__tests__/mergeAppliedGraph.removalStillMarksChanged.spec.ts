/**
 * The rename fix must not blind the canvas to a REMOVAL.
 *
 * `reconcileAppliedGraph` now marks the model changed only when an
 * ANALYSIS-AFFECTING difference moved (`hasAnalyticalGraphChange`), so a
 * cosmetic echo — a rename — no longer claims "Model changed"
 * (`renameDoesNotClaimModelChanged.spec.ts`). The comparison must start from
 * the canvas as it was BEFORE the reconcile. Started from the SURVIVING nodes
 * instead, a node CEE removed is already gone from both sides, the counts
 * match, and a real structural change (an agent turn that drops a factor)
 * would leave the old analysis presented as current — the opposite lie.
 *
 * Pinned:
 *   1. A receipt that REMOVES an acknowledged node marks the model changed.
 *   2. A receipt that removes an acknowledged EDGE marks the model changed.
 *   3. CONTRAST — the same receipt with nothing removed and only a cosmetic
 *      field differing does NOT. Without it, 1–2 pass for a gate that marks
 *      every receipt.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
import { seedCanvas } from './__helpers__/mergeAppliedGraphHarness'
import { canvasEdgePairKey } from '../graphIdentity'

const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Spend' } },
  { id: 'factor-2', type: 'factor', position: { x: 240, y: 200 }, data: { kind: 'factor', label: 'Churn' } },
]
/** The one edge, removable when acknowledged. No edge survives to be diffed, so nothing else can move. */
const EDGE = { id: 'e-2', source: 'factor-2', target: 'goal-1', data: { weight: 0.3, direction: 'negative' } }

const wireNode = (id: string, kind: string, label: string, extra: Record<string, unknown> = {}) =>
  ({ id, kind, label, ...extra })
const ALL_NODES_ON_WIRE = [
  wireNode('goal-1', 'goal', 'Revenue'),
  wireNode('factor-1', 'factor', 'Spend'),
  wireNode('factor-2', 'factor', 'Churn'),
]

const dirty = () => useCanvasStore.getState().analysisFreshnessDirty

function seed(opts: { edges: unknown[]; acknowledgeEdges: boolean }) {
  useCanvasStore.getState().reset()
  seedCanvas(NODES, opts.edges)
  useCanvasStore.setState({
    lastAuthoritativeGraph: {
      nodeIds: ['goal-1', 'factor-1', 'factor-2'],
      edgePairs: opts.acknowledgeEdges
        ? useCanvasStore.getState().edges.map((e) => canvasEdgePairKey(e) as string)
        : [],
    },
    analysisFreshnessDirty: false,
  } as never)
}

describe('reconcileAppliedGraph still marks a REMOVAL as a model change', () => {
  beforeEach(() => seed({ edges: [], acknowledgeEdges: false }))

  it('a receipt without an acknowledged node marks the model changed', () => {
    const result = reconcileAppliedGraph({
      nodes: [wireNode('goal-1', 'goal', 'Revenue'), wireNode('factor-1', 'factor', 'Spend')],
      edges: [],
    } as never)

    expect(result.removedNodeCount).toBe(1)
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).not.toContain('factor-2')
    expect(dirty()).toBe(true)
  })

  it('a receipt without an acknowledged EDGE marks the model changed', () => {
    seed({ edges: [EDGE], acknowledgeEdges: true })
    const result = reconcileAppliedGraph({ nodes: ALL_NODES_ON_WIRE, edges: [] } as never)

    expect(result.removedEdgeCount).toBe(1)
    expect(result.removedNodeCount).toBe(0)
    expect(dirty()).toBe(true)
  })

  it('CONTRAST — nothing removed, only a cosmetic field differs: not marked', () => {
    const result = reconcileAppliedGraph({
      nodes: [
        wireNode('goal-1', 'goal', 'Revenue'),
        wireNode('factor-1', 'factor', 'Spend', { category: 'cost' }),
        wireNode('factor-2', 'factor', 'Churn'),
      ],
      edges: [],
    } as never)

    expect(result.removedNodeCount).toBe(0)
    expect(result.updatedNodeCount).toBeGreaterThan(0)
    expect(dirty()).toBe(false)
  })
})
