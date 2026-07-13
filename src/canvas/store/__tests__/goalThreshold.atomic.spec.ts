/**
 * setGoalThresholdAndUpdateNode — the Codex final-audit B2 fix — multi-field
 * invariant pins (Lane 1 seam coverage + Lane 1b missing-node detectability).
 *
 * The action exists precisely because a bare setGoalThreshold left the goal
 * node stale ("target missing") while the global store held the value. These
 * pins assert the PAIR, not the fields separately: store value AND node
 * annotation move together, in both directions, and a silently-unmatched
 * node id (which would recreate the audited split-brain) is at least
 * detectable via a console warning.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'

const initialState = useCanvasStore.getState()

beforeEach(() => {
  useCanvasStore.setState(
    {
      ...initialState,
      nodes: [
        {
          id: 'goal_1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Conversion' },
        },
      ],
      edges: [],
      goalThreshold: null,
    } as never,
    true,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('setGoalThresholdAndUpdateNode — store↔node invariant', () => {
  it('sets the global value AND the node annotation atomically', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)

    const state = useCanvasStore.getState()
    const node = state.nodes.find((n) => n.id === 'goal_1')!
    const data = node.data as {
      success_threshold?: number
      threshold_source?: string
      threshold_confirmed?: boolean
    }
    expect(state.goalThreshold).toBe(60)
    expect(data.success_threshold).toBe(60)
    expect(data.threshold_source).toBe('user')
    expect(data.threshold_confirmed).toBe(false)
  })

  it('null clears BOTH the global value and the node annotation', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', null)

    const state = useCanvasStore.getState()
    const node = state.nodes.find((n) => n.id === 'goal_1')!
    const data = node.data as {
      success_threshold?: number | null
      threshold_source?: string
    }
    expect(state.goalThreshold).toBeNull()
    expect(data.success_threshold).toBeNull()
    expect(data.threshold_source).toBeUndefined()
  })

  it('a goalNodeId matching NO node still sets the global value but WARNS (split-brain must be detectable)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_gone', 60)

    const state = useCanvasStore.getState()
    expect(state.goalThreshold).toBe(60)
    // No node annotated — the original goal_1 is untouched.
    const node = state.nodes.find((n) => n.id === 'goal_1')!
    expect((node.data as { success_threshold?: number }).success_threshold).toBeUndefined()
    // The silent no-op recreates the audited B2 split-brain — it must warn.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('setGoalThresholdAndUpdateNode'),
      expect.objectContaining({ goalNodeId: 'goal_gone' }),
    )
  })
})
