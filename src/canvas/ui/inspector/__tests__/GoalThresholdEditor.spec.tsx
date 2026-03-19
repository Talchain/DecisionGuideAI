/**
 * GoalThresholdEditor — regression tests for threshold serialisation.
 *
 * Verifies that editing the threshold via the inspector pathway writes
 * through setGoalThresholdAndUpdateNode (which serialises success_threshold,
 * threshold_source, and threshold_confirmed on the node) rather than the
 * scalar-only setGoalThreshold.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetGoalThresholdAndUpdateNode = vi.fn()
const mockSetGoalThreshold = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: (selector: (state: any) => any) =>
    selector({
      goalThreshold: null,
      outcomeNodeId: 'goal_node_1',
      setGoalThresholdAndUpdateNode: mockSetGoalThresholdAndUpdateNode,
      setGoalThreshold: mockSetGoalThreshold,
    }),
}))

const { GoalThresholdEditor } = await import('../GoalThresholdEditor')

describe('GoalThresholdEditor — threshold serialisation (inspector pathway)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls setGoalThresholdAndUpdateNode with the inspected nodeId on blur', () => {
    render(<GoalThresholdEditor nodeId="goal_node_1" />)

    const input = screen.getByPlaceholderText('e.g. 200')
    fireEvent.change(input, { target: { value: '150' } })
    fireEvent.blur(input)

    // Must use the unified action — not setGoalThreshold alone
    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledTimes(1)
    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal_node_1', 150)
    expect(mockSetGoalThreshold).not.toHaveBeenCalled()
  })

  it('uses the nodeId prop rather than outcomeNodeId when they differ', () => {
    // The nodeId prop ("inspected_goal_node") is a different goal node to the
    // store's outcomeNodeId ("goal_node_1"). The prop must take precedence so
    // threshold edits go to the currently inspected node.
    render(<GoalThresholdEditor nodeId="inspected_goal_node" />)

    const input = screen.getByPlaceholderText('e.g. 200')
    fireEvent.change(input, { target: { value: '200' } })
    fireEvent.blur(input)

    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('inspected_goal_node', 200)
  })

  it('clears threshold (passes null) when input is emptied', () => {
    render(<GoalThresholdEditor nodeId="goal_node_1" />)

    const input = screen.getByPlaceholderText('e.g. 200')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal_node_1', null)
  })

  it('uses outcomeNodeId from store when no nodeId prop is provided', () => {
    // No nodeId prop — falls back to store's outcomeNodeId
    render(<GoalThresholdEditor />)

    const input = screen.getByPlaceholderText('e.g. 200')
    fireEvent.change(input, { target: { value: '75' } })
    fireEvent.blur(input)

    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal_node_1', 75)
    expect(mockSetGoalThreshold).not.toHaveBeenCalled()
  })
})
