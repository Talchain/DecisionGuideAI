import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { seedCanvas } from './__helpers__/mergeAppliedGraphHarness'

const optionId = 'option-olumi'
const canvasNodes = [
  {
    id: optionId, type: 'option', position: { x: 40, y: 20 },
    data: { kind: 'option', label: 'Try a £54 tier', proposed_by: 'olumi', description: 'Keep this note' },
  },
  { id: 'goal-1', type: 'goal', position: { x: 300, y: 20 }, data: { kind: 'goal', label: 'MRR' } },
]
const unmarkedWireNodes = [
  { id: optionId, kind: 'option', label: 'Try a £54 tier' },
  { id: 'goal-1', kind: 'goal', label: 'MRR' },
]

function canonicalReceipt() {
  return {
    nodes: unmarkedWireNodes,
    edges: [],
    options: [],
    goal_node_id: 'goal-1',
    goal_constraints: [],
    node_count: 2,
    edge_count: 0,
  } as never
}

function optionData(): Record<string, unknown> {
  return useCanvasStore.getState().nodes.find((n) => n.id === optionId)!.data as Record<string, unknown>
}

function registeredOption(): Record<string, unknown> {
  const state = useCanvasStore.getState()
  const projected = buildRegistrationGraph(state.nodes, state.edges)
  expect(projected.ok).toBe(true)
  if (!projected.ok) throw new Error('canvas graph was not projectable')
  return projected.graph.nodes.find((n) => n.id === optionId)!
}

beforeEach(() => {
  useCanvasStore.getState().reset()
  seedCanvas(canvasNodes, [])
})

describe('an adopted option clears only its old proposal marker', () => {
  it('a complete committed receipt clears the marker before the next registration', () => {
    expect(registeredOption().proposed_by).toBe('olumi')

    const result = reconcileAppliedGraph(canonicalReceipt())

    expect(result.updatedNodeCount).toBe(1)
    expect(optionData()).not.toHaveProperty('proposed_by')
    expect(optionData().description).toBe('Keep this note')
    expect(registeredOption()).not.toHaveProperty('proposed_by')
  })

  it('a cold authoritative graph read clears the marker before the next registration', () => {
    const result = mergeServerGraphOnHydrate({ nodes: unmarkedWireNodes, edges: [] })

    expect(result.accepted).toBe(true)
    expect(result.updatedNodeCount).toBe(1)
    expect(optionData()).not.toHaveProperty('proposed_by')
    expect(optionData().description).toBe('Keep this note')
    expect(registeredOption()).not.toHaveProperty('proposed_by')
  })

  it('a partial legacy receipt cannot clear authorship by omission', () => {
    reconcileAppliedGraph({ nodes: unmarkedWireNodes, edges: [] } as never)

    expect(optionData().proposed_by).toBe('olumi')
    expect(registeredOption().proposed_by).toBe('olumi')
  })

  it('an authoritative read that still marks Olumi authorship keeps it', () => {
    mergeServerGraphOnHydrate({
      nodes: [{ ...unmarkedWireNodes[0], proposed_by: 'olumi' }, unmarkedWireNodes[1]],
      edges: [],
    })

    expect(optionData().proposed_by).toBe('olumi')
  })
})
