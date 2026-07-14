/**
 * P0-1 (external review 2026-07-14) — the global goal-threshold scalar must
 * never outlive the goal node it describes.
 *
 * Lane 5 cleared the decision context on full-context REPLACEMENTS (scenario
 * load, import, reset, draft apply/undo). This lane closes the two remaining
 * normal-UI paths the reviewer found:
 *   (1) general node-history undo/redo — the scalar is not in the history
 *       snapshot and is not in READINESS_CLEAR_FIELDS, so it survived a graph
 *       revert (set 60% → Undo → node reverts but the scalar stayed 0.6 and the
 *       run path still forwarded it to PLoT);
 *   (2) in-session goal reselection — switching the selected goal left the
 *       previous goal's scalar (and cap) in place, so goal B inherited goal A's
 *       target.
 *
 * The fix re-derives the scalar from the resolved goal node's user
 * success_threshold whenever the graph or the selection changes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

const goalNode = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: id, ...extra },
})

describe('P0-1: undo/redo re-derive the goal-threshold scalar from the reverted graph', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('undo of a target-set reverts the node AND clears the stale global scalar', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    // Writes the global scalar + the node success_threshold, and pushes the
    // PRE-threshold node to history.
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    expect(useCanvasStore.getState().goalThreshold).toBe(60)

    useCanvasStore.getState().undo()
    // RED before the fix: the scalar stayed 60 while the node reverted.
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBeNull()
  })

  it('redo re-applies the target and restores its scalar (raw)', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().goalThreshold).toBeNull()

    useCanvasStore.getState().redo()
    expect(useCanvasStore.getState().goalThreshold).toBe(60)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
  })
})

describe('P0-1: goal reselection re-derives the scalar from the newly selected goal', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('switching to a goal with NO target clears the previous goal\'s stale scalar', () => {
    useCanvasStore.setState({
      nodes: [
        goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }),
        goalNode('goal_B'),
      ],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
    } as never)

    useCanvasStore.getState().setOutcomeNode('goal_B', { rederiveThreshold: true })
    expect(useCanvasStore.getState().outcomeNodeId).toBe('goal_B')
    // RED before the fix: goal_B inherited goal_A's 0.6/60.
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBeNull()
  })

  it('switching to a goal with its OWN target adopts that target (raw)', () => {
    useCanvasStore.setState({
      nodes: [
        goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }),
        goalNode('goal_B', { success_threshold: 80, threshold_source: 'user' }),
      ],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
    } as never)

    useCanvasStore.getState().setOutcomeNode('goal_B', { rederiveThreshold: true })
    expect(useCanvasStore.getState().goalThreshold).toBe(80)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
  })

  it('setOutcomeNode WITHOUT the flag preserves the scalar (producer paths unaffected)', () => {
    // applyDraftResult / applyAutoApplyPatch call setOutcomeNode with no opts and
    // carry their own threshold sync — the re-derive must NOT clobber it.
    useCanvasStore.setState({
      nodes: [goalNode('goal_A'), goalNode('goal_B')],
      goalThreshold: 0.4,
      goalThresholdRepresentation: 'normalised',
      outcomeNodeId: 'goal_A',
    } as never)

    useCanvasStore.getState().setOutcomeNode('goal_B')
    expect(useCanvasStore.getState().outcomeNodeId).toBe('goal_B')
    expect(useCanvasStore.getState().goalThreshold).toBe(0.4)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
  })
})
