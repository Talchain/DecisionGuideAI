/**
 * THE CORE TURN'S COMPLETE PROGRAM GRAPH (DET-HARM D228; SPEC C13: the graph's limits match the saved canonical model).
 * A core turn's graph omits `goal_constraints` once the model has none (compose/applied-graph-emit.ts: an empty list is
 * left off). Legacy receipts keep their rules. (D225/D227, parallel links matched one-to-one, is pinned in
 * mergeAppliedGraph.parallelLinks.spec.ts.)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { useCanvasStore } from '../../store'
import { seedCanvas as seedStore } from './__helpers__/mergeAppliedGraphHarness'

const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Sales' } },
  { id: 'factor-1', type: 'factor', position: { x: 40, y: 200 }, data: { kind: 'factor', label: 'Added capacity' } },
]
const WIRE_NODES = [
  { id: 'goal-1', kind: 'goal', label: 'Sales' },
  { id: 'factor-1', kind: 'factor', label: 'Added capacity' },
]

beforeEach(() => {
  useCanvasStore.getState().reset()
  seedStore(NODES, [])
  useCanvasStore.getState().setGoalConstraints(null, { fromProducerSync: true })
})

describe('a core turn\'s complete graph with no limits clears the limits shown (D228)', () => {
  const LIMIT = [{ constraint_id: 'c_budget', node_id: 'factor-1', operator: '<=', value: 5000, unit: '£' }]
  it('clears the store\'s limits when the complete graph omits goal_constraints', () => {
    useCanvasStore.getState().setGoalConstraints(LIMIT as never, { fromProducerSync: true })
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [] } as never, { restoreReplace: true, constraintsComplete: true })
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })

  it('contrast: a version restore (complete nodes and edges, no constraint authority) keeps them', () => {
    useCanvasStore.getState().setGoalConstraints(LIMIT as never, { fromProducerSync: true })
    reconcileAppliedGraph({ graph: { nodes: WIRE_NODES, edges: [] } } as never, { restoreReplace: true })
    expect(useCanvasStore.getState().goalConstraints).toHaveLength(1)
  })

  it('contrast: a complete graph that carries limits adopts them', () => {
    reconcileAppliedGraph({ nodes: WIRE_NODES, edges: [], goal_constraints: LIMIT } as never, { restoreReplace: true, constraintsComplete: true })
    expect(useCanvasStore.getState().goalConstraints).toHaveLength(1)
  })
})
