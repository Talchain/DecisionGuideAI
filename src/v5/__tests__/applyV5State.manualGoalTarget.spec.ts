import { beforeEach, describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State } from '../applyV5State'
import { useCanvasStore } from '../../canvas/store'
import { resolveGoalTarget } from '../../canvas/domain/goalTarget'

function response(status = 'applied', operator = '>=', nodeId = 'goal-a'): OlumiResponse {
  return { response_version: 2, assistant_text: '', suggested_actions: [], insights: [], stage_indicator: 'frame',
    blocks: [{ type: 'graph_patch', status, operation: 'add_constraint', target_id: 'goal-a', before: null,
      after: { node_id: nodeId, operator, value: 120000, unit: '£', constraint_id: 'constraint-a' } }] } as OlumiResponse
}
beforeEach(() => {
  useCanvasStore.setState({ nodes: [{ id: 'goal-a', type: 'goal', position: { x: 0, y: 0 },
    data: { kind: 'goal', label: 'Revenue', threshold_source: 'user', success_threshold: 100000,
      goal_threshold_raw: 100000, goal_threshold_unit: '£' } }], edges: [], goalConstraints: [],
    goalThreshold: 100000, goalThresholdRepresentation: 'raw', analysisFreshnessDirty: false })
})
describe('acknowledged manual goal target', () => {
  it('updates the existing node/display/global channels only from the actual committed target', () => {
    applyV5State(response(), useCanvasStore.getState())
    const state = useCanvasStore.getState()
    expect(resolveGoalTarget(state.nodes[0].data)).toMatchObject({ raw: 120000, unit: '£' })
    expect(state.goalThreshold).toBe(120000)
    expect(state.goalConstraints?.[0]).toMatchObject({ node_id: 'goal-a', value: 120000, unit: '£' })
    expect(state.analysisFreshnessDirty).toBe(true)
  })
  it.each(['proposed', 'rejected'])('does not treat %s as a saved target', status => {
    applyV5State(response(status), useCanvasStore.getState())
    expect(resolveGoalTarget(useCanvasStore.getState().nodes[0].data)?.raw).toBe(100000)
  })
  it('does not turn an upper bound into the minimum success target', () => {
    applyV5State(response('applied', '<='), useCanvasStore.getState())
    expect(resolveGoalTarget(useCanvasStore.getState().nodes[0].data)?.raw).toBe(100000)
  })
  it('cannot attach another node’s constraint to this goal', () => {
    applyV5State(response('applied', '>=', 'other-goal'), useCanvasStore.getState())
    expect(resolveGoalTarget(useCanvasStore.getState().nodes[0].data)?.raw).toBe(100000)
  })
  it('rejects an old response before target synchronisation', () => {
    applyV5State(response(), useCanvasStore.getState(), { turnClientId: 'old', currentClientTurnId: 'new' })
    expect(resolveGoalTarget(useCanvasStore.getState().nodes[0].data)?.raw).toBe(100000)
  })
  it('does not dirty the same acknowledged value again', () => {
    applyV5State(response(), useCanvasStore.getState())
    useCanvasStore.setState({ analysisFreshnessDirty: false })
    applyV5State(response(), useCanvasStore.getState())
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
  it('does not give a factor the goal threshold channel', () => {
    const node = useCanvasStore.getState().nodes[0]
    useCanvasStore.setState({ nodes: [{ ...node, type: 'factor', data: { kind: 'factor', label: 'Revenue' } }] })
    applyV5State(response(), useCanvasStore.getState())
    expect(useCanvasStore.getState().nodes[0].data).not.toHaveProperty('goal_threshold_raw')
    expect(useCanvasStore.getState().goalThreshold).toBe(100000)
  })
})
