/**
 * "NO GOAL SELECTED" ON A MODEL WITH A GOAL (DL ruling A, 23 Oct). A thin session clears the canvas and fills it only
 * from CEE's read (`mergeServerGraphOnHydrate`), which never set the goal selection, so `outcomeNodeId` stayed null and
 * the pre-run panel said "No goal selected" on the capacity board, whose read carries one goal node. The hydrated
 * graph's own goal node is now the selection, as every full-graph load does (`deriveGoalContext`).
 * Fixture: CEE's served capacity read (S3 smoke-alpha2 r1, trimmed).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import capacity from '../../runView/__tests__/fixtures/alpha2-capacity-r1-read.json'

const emptyCanvas = (outcomeNodeId: string | null) => useCanvasStore.setState({
  currentScenarioId: capacity.scenario_id,
  nodes: [] as never,
  edges: [] as never,
  outcomeNodeId,
  lastAuthoritativeGraph: null,
} as never)

beforeEach(() => { useCanvasStore.setState(useCanvasStore.getState(), true) })

describe('the goal selection after hydrating an empty canvas from CEE’s read', () => {
  it('is the read’s goal node', () => {
    emptyCanvas(null)
    expect(mergeServerGraphOnHydrate(capacity.graph).accepted).toBe(true)
    expect(useCanvasStore.getState().nodes.length).toBe(capacity.graph.nodes.length)
    expect(useCanvasStore.getState().outcomeNodeId).toBe('support_capacity_goal')
  })

  it('a stale selection from another graph is replaced by the read’s goal node', () => {
    emptyCanvas('weekly_customers')
    mergeServerGraphOnHydrate(capacity.graph)
    expect(useCanvasStore.getState().outcomeNodeId).toBe('support_capacity_goal')
  })

  it('CONTRAST: a read with no goal node leaves no selection', () => {
    emptyCanvas(null)
    mergeServerGraphOnHydrate({ nodes: capacity.graph.nodes.filter(n => n.kind !== 'goal'), edges: [] })
    expect(useCanvasStore.getState().nodes.length).toBe(capacity.graph.nodes.length - 1)
    expect(useCanvasStore.getState().outcomeNodeId).toBeNull()
  })

  it('CONTRAST: a merge into a canvas that already holds the model keeps the user’s selection', () => {
    emptyCanvas(null)
    mergeServerGraphOnHydrate(capacity.graph)
    useCanvasStore.setState({ outcomeNodeId: 'weekly_support_capacity' } as never)
    mergeServerGraphOnHydrate(capacity.graph)
    expect(useCanvasStore.getState().outcomeNodeId).toBe('weekly_support_capacity')
  })
})
