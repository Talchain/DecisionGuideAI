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
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { useGoalNodeActions } from '../../components/GoalNodeSelector'

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

// ─── External review round 2 (2026-07-14) — the paths the first fix missed ───

describe('P0-1 round 2: repeated target edits are distinct history entries', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('60 → 80 → Undo restores 60 (not null), then Undo restores null', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 80)
    expect(useCanvasStore.getState().goalThreshold).toBe(80)

    useCanvasStore.getState().undo()
    // RED before the fix: historyHash excluded success_threshold, so the 80 edit
    // was deduped away and Undo jumped straight to null.
    expect(useCanvasStore.getState().goalThreshold).toBe(60)

    useCanvasStore.getState().undo()
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })
})

describe('P0-1 round 2: deleting the targeted goal clears its stale threshold', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('deleteNodeById(goal) clears goalThreshold + representation', () => {
    useCanvasStore.setState({
      nodes: [goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }), goalNode('goal_B')],
      edges: [],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
    } as never)

    useCanvasStore.getState().deleteNodeById('goal_A')
    const s = useCanvasStore.getState()
    expect(s.nodes.map((n) => n.id)).toEqual(['goal_B'])
    expect(s.outcomeNodeId).toBeNull()
    // RED before the fix: goalThreshold stayed 60 after deleting goal_A.
    expect(s.goalThreshold).toBeNull()
    expect(s.goalThresholdRepresentation).toBeNull()
  })

  it('deleteSelected(goal) clears goalThreshold + representation', () => {
    useCanvasStore.setState({
      nodes: [goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }), goalNode('goal_B')],
      edges: [],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
      selection: { nodeIds: new Set(['goal_A']), edgeIds: new Set(), anchorPosition: null },
    } as never)

    useCanvasStore.getState().deleteSelected()
    const s = useCanvasStore.getState()
    expect(s.outcomeNodeId).toBeNull()
    expect(s.goalThreshold).toBeNull()
    expect(s.goalThresholdRepresentation).toBeNull()
  })

  it('deleting a NON-goal node keeps the goal target intact', () => {
    useCanvasStore.setState({
      nodes: [
        goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }),
        { id: 'factor_C', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'C' } },
      ],
      edges: [],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
    } as never)

    useCanvasStore.getState().deleteNodeById('factor_C')
    const s = useCanvasStore.getState()
    expect(s.outcomeNodeId).toBe('goal_A')
    expect(s.goalThreshold).toBe(60)
  })
})

describe('P0-1 round 2: goal reselection strips the previous goal producer target', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('switching A → B removes goal_threshold / _raw / _unit from readiness (no stale panel fallback)', () => {
    // Reproduces handleGoalChange's two store writes for A → B.
    useCanvasStore.setState({
      nodes: [goalNode('goal_A', { success_threshold: 60, threshold_source: 'user' }), goalNode('goal_B')],
      edges: [],
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      outcomeNodeId: 'goal_A',
      ceeAnalysisReady: {
        goal_node_id: 'goal_A',
        options: [],
        goal_threshold: 0.6,
        goal_threshold_raw: 60,
        goal_threshold_unit: '%',
        goal_threshold_cap: 100,
      },
    } as never)

    // The single atomic transition the pre-analysis goal selector calls.
    useCanvasStore.getState().reselectGoalNode('goal_B')

    const s = useCanvasStore.getState()
    expect(s.goalThreshold).toBeNull()
    expect(s.ceeAnalysisReady?.goal_node_id).toBe('goal_B')
    // RED before the fix: the handler dropped only goal_threshold_cap, so
    // usePreAnalysisData.successThreshold still fell back to the old 0.6 / 60.
    expect(s.ceeAnalysisReady?.goal_threshold ?? null).toBeNull()
    expect(s.ceeAnalysisReady?.goal_threshold_raw ?? null).toBeNull()
    expect(s.ceeAnalysisReady?.goal_threshold_unit ?? null).toBeNull()
  })
})

describe('P0-1 round 2: mark-as-goal re-derives the threshold', () => {
  it('handleMarkAsGoal passes { rederiveThreshold: true } to setOutcomeNode', () => {
    const setOutcomeNode = vi.fn()
    const updateNodeData = vi.fn()
    const { handleMarkAsGoal } = useGoalNodeActions(updateNodeData, setOutcomeNode)

    handleMarkAsGoal('node_1')

    expect(updateNodeData).toHaveBeenCalledWith('node_1', { kind: 'goal' })
    // RED before the fix: setOutcomeNode('node_1') with no opts — a previous
    // goal's target could ride the newly-marked goal.
    expect(setOutcomeNode).toHaveBeenCalledWith('node_1', { rederiveThreshold: true })
  })
})
