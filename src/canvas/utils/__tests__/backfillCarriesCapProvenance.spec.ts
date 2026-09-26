/**
 * ⭐ THE CAP'S PROVENANCE TRAVELS WITH THE CAP onto the goal node.
 *
 * Paul's manual test `1a298d6d`: CEE's `analysis_ready` said
 * `goal_threshold_cap_provenance: "target_derived_headroom"`, but the goal node
 * the Panel reads carried the cap (25,000) WITHOUT it — so a reader could not
 * fail closed on a denominator no user supplied. Bound by identity: the node id
 * and the exact tag string.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'

const goal = () => useCanvasStore.getState().nodes.find((n) => n.id === 'mrr')!.data as Record<string, unknown>

describe('backfill carries the cap provenance', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [{ id: 'mrr', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'MRR' } }],
    } as never)
  })

  it('writes the tag beside the cap it describes', () => {
    backfillGoalThresholdOntoGoalNode({
      goal_node_id: 'mrr', goal_threshold_raw: 20000, goal_threshold_unit: 'GBP MRR',
      goal_threshold_cap: 25000, goal_threshold_cap_provenance: 'target_derived_headroom',
    })
    expect(goal().goal_threshold_cap).toBe(25000)
    expect(goal().goal_threshold_cap_provenance).toBe('target_derived_headroom')
  })

  it('an absent tag is written as absent (unattested), never defaulted — and a stale tag is cleared with a new cap', () => {
    backfillGoalThresholdOntoGoalNode({ goal_node_id: 'mrr', goal_threshold_cap: 25000, goal_threshold_cap_provenance: 'target_derived_headroom' })
    backfillGoalThresholdOntoGoalNode({ goal_node_id: 'mrr', goal_threshold_cap: 100 })
    expect(goal().goal_threshold_cap).toBe(100)
    expect(goal().goal_threshold_cap_provenance).toBeUndefined()
  })
})
