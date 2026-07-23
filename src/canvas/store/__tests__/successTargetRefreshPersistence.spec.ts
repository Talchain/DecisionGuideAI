/**
 * Success-target refresh-persistence — the live defect found 2026-07-23 on
 * 15d60a0c. A guest sets a success target then reloads; the target is lost.
 *
 * Two independent links dropped the value. `setGoalThresholdAndUpdateNode` writes
 * BOTH the goal node's data.success_threshold (threshold_source='user') AND the
 * store's goalThreshold scalar (a derived cache of the node field).
 *
 *   Link 1 — the node field never reached localStorage. useAutosave's dirty-gate
 *   (computeGraphHash) did not cover success_threshold/threshold_source, so a
 *   target-set (which changes nothing else the hash sees) never flipped the hash;
 *   the 30s autosave was skipped and the node target was never persisted. Pinned
 *   in useAutosave.staleValueHash.spec.ts.
 *
 *   Link 2 — the scalar was never re-derived on restore. hydrateGraphSlice (guest
 *   autosave restore) and loadScenario (logged-in restore) clear goalThreshold on
 *   the previous context and re-derive only outcomeNodeId — never the scalar. So
 *   the V7 goal lens (buildV7Lenses gate: goalThreshold == null → no_target) read
 *   "no target" even when the node carried one. Pinned in goalContextRestore.spec.
 *
 * This spec exercises the REAL save → serialise → load → hydrate round-trip end to
 * end, and the nudge's gate input (GoalTargetNudge's hasSuccessTarget comes from
 * computeSuccessState, which reads the goal node's user target).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { projectAutosaveData, autosaveSourceFromStore } from '../autosaveProjection'
import { computeSuccessState } from '../../components/pre-analysis-v3/selectors/computeSuccessState'

const goalNode = (id: string, extra: Record<string, unknown> = {}): Node =>
  ({ id, type: 'goal', position: { x: 0, y: 0 }, data: { label: id, ...extra } } as Node)

/**
 * Simulate the exact localStorage round-trip the autosave path performs:
 * store → autosaveSourceFromStore → projectAutosaveData → JSON (setItem) →
 * JSON (getItem). The serialise/parse catches any non-serialisable drift, and
 * is what loadAutosave hands hydrateGraphSlice.
 */
function persistAndReload(): { nodes: Node[]; edges: unknown[] } {
  const payload = projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState()))
  return JSON.parse(JSON.stringify(payload)) as { nodes: Node[]; edges: unknown[] }
}

describe('success target survives a refresh (save → load → hydrate round-trip)', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('persists the node target AND re-derives the goalThreshold scalar', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    // The exact write GoalThresholdEditor performs (no unit).
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 20)

    const persisted = persistAndReload()

    // Link 1: the node target is in the persisted payload.
    const savedGoal = persisted.nodes.find((n) => n.id === 'goal_1')
    expect((savedGoal?.data as Record<string, unknown> | undefined)?.success_threshold).toBe(20)
    expect((savedGoal?.data as Record<string, unknown> | undefined)?.threshold_source).toBe('user')

    // Fresh page: a new store boots from initialState (null decision context).
    // reset() clears the graph but deliberately not the scalar, so null it too.
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null, goalThresholdRepresentation: null } as never)
    expect(useCanvasStore.getState().goalThreshold).toBeNull()

    useCanvasStore.getState().hydrateGraphSlice({ nodes: persisted.nodes, edges: persisted.edges as never })

    const s = useCanvasStore.getState()
    const goal = s.nodes.find((n) => n.id === 'goal_1')
    // node field survived the round-trip
    expect((goal?.data as Record<string, unknown> | undefined)?.success_threshold).toBe(20)
    // Link 2: scalar re-derived — this is what the V7 goal lens gates on
    expect(s.goalThreshold).toBe(20)
    expect(s.goalThresholdRepresentation).toBe('raw')
  })

  it('nudge gate reads the restored target as SET → nudge hides (restored-with-target)', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 20)
    const persisted = persistAndReload()
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null, goalThresholdRepresentation: null } as never)
    useCanvasStore.getState().hydrateGraphSlice({ nodes: persisted.nodes, edges: persisted.edges as never })

    const goal = useCanvasStore.getState().nodes.find((n) => n.id === 'goal_1') ?? null
    const success = computeSuccessState(goal, null, null)
    // GoalTargetNudge: !hasGoalNode || hasSuccessTarget → null. isSet===true ⇒ absent.
    expect(success.isSet).toBe(true)
    expect(success.rawValue).toBe(20)
  })

  it('nudge gate reads no restored target as UNSET → nudge renders (restored-no-target)', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal_1')], edges: [], outcomeNodeId: 'goal_1' } as never)
    // No target set before the reload.
    const persisted = persistAndReload()
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null, goalThresholdRepresentation: null } as never)
    useCanvasStore.getState().hydrateGraphSlice({ nodes: persisted.nodes, edges: persisted.edges as never })

    const s = useCanvasStore.getState()
    expect(s.goalThreshold).toBeNull()
    const goal = s.nodes.find((n) => n.id === 'goal_1') ?? null
    const success = computeSuccessState(goal, null, null)
    // hasGoalNode (goal present) && !hasSuccessTarget ⇒ the nudge renders again.
    expect(success.isSet).toBe(false)
  })
})
