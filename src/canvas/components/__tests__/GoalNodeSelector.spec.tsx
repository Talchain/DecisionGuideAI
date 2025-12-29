/**
 * GoalNodeSelector Tests
 *
 * Tests that verify goal node detection and selection behavior,
 * particularly after applying AI-generated drafts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalNodeSelector } from '../GoalNodeSelector'
import type { Node } from '@xyflow/react'

// Helper to create mock nodes
function createMockNode(
  id: string,
  type: string,
  label: string
): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: type, // P0 fix: kind must be in data for GoalNodeSelector
    },
  }
}

describe('GoalNodeSelector', () => {
  const mockOnChange = vi.fn()
  const mockOnMarkAsGoal = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('goal node detection', () => {
    it('shows goal node in dropdown when data.kind is "goal"', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
        createMockNode('factor_1', 'factor', 'Price'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      // Should show the select dropdown (not "No goal nodes" message)
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()

      // Goal node should be in the options
      const options = screen.getAllByRole('option')
      expect(options.length).toBe(2) // "Select goal node..." + goal_1
      expect(options[1].textContent).toBe('Reach £20k MRR')
    })

    it('shows "No goal nodes" message when no nodes have kind="goal"', () => {
      const nodes = [
        createMockNode('factor_1', 'factor', 'Price'),
        createMockNode('outcome_1', 'outcome', 'Revenue'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      expect(screen.getByText('No goal nodes in the model.')).toBeInTheDocument()
    })

    it('does NOT detect goal nodes when data.kind is missing', () => {
      // This simulates the bug before the P0 fix
      const nodesWithoutKind: Node[] = [
        {
          id: 'goal_1',
          type: 'goal', // type is set but data.kind is missing
          position: { x: 0, y: 0 },
          data: {
            label: 'Reach £20k MRR',
            // kind is NOT set - this was the bug
          },
        },
      ]

      render(
        <GoalNodeSelector
          nodes={nodesWithoutKind}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      // Without data.kind, the goal node is not detected
      expect(screen.getByText('No goal nodes in the model.')).toBeInTheDocument()
    })

    it('shows warning when no goal is selected', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      expect(screen.getByText('No goal selected. Analysis requires a goal node.')).toBeInTheDocument()
    })

    it('shows success indicator when goal is selected', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId="goal_1"
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      expect(screen.getByText('Goal: Reach £20k MRR')).toBeInTheDocument()
      expect(screen.queryByText('No goal selected.')).not.toBeInTheDocument()
    })
  })

  describe('goal selection', () => {
    it('calls onChange when user selects a goal', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
        createMockNode('goal_2', 'goal', 'Increase retention'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'goal_1' } })

      expect(mockOnChange).toHaveBeenCalledWith('goal_1')
    })

    it('calls onChange with null when user deselects', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId="goal_1"
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '' } })

      expect(mockOnChange).toHaveBeenCalledWith(null)
    })
  })

  describe('promotable candidates', () => {
    it('shows outcome nodes as promotable when no goal nodes exist', () => {
      const nodes = [
        createMockNode('outcome_1', 'outcome', 'Higher revenue'),
        createMockNode('factor_1', 'factor', 'Price'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      expect(screen.getByText('Would you like to mark one of these as the goal?')).toBeInTheDocument()
      expect(screen.getByText('Higher revenue')).toBeInTheDocument()
    })

    it('calls onMarkAsGoal when user clicks a promotable candidate', () => {
      const nodes = [
        createMockNode('outcome_1', 'outcome', 'Higher revenue'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
        />
      )

      const promoteButton = screen.getByRole('button', { name: /Higher revenue/i })
      fireEvent.click(promoteButton)

      expect(mockOnMarkAsGoal).toHaveBeenCalledWith('outcome_1')
    })
  })

  describe('compact mode', () => {
    it('renders compact view when compact prop is true', () => {
      const nodes = [
        createMockNode('goal_1', 'goal', 'Reach £20k MRR'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
          compact
        />
      )

      expect(screen.getByTestId('goal-selector-compact')).toBeInTheDocument()
    })

    it('shows "No goal nodes" in compact mode when none exist', () => {
      const nodes = [
        createMockNode('factor_1', 'factor', 'Price'),
      ]

      render(
        <GoalNodeSelector
          nodes={nodes}
          currentGoalId={null}
          onChange={mockOnChange}
          onMarkAsGoal={mockOnMarkAsGoal}
          compact
        />
      )

      expect(screen.getByText('No goal nodes')).toBeInTheDocument()
    })
  })
})

describe('GoalNodeSelector with AI-generated draft', () => {
  const mockOnChange = vi.fn()
  const mockOnMarkAsGoal = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('correctly detects goal from CEE draft response structure', () => {
    // Simulate nodes as they would be after applyDraftToCanvas with P0 fix
    const ceeGeneratedNodes: Node[] = [
      {
        id: 'dec_1',
        type: 'decision',
        position: { x: 0, y: 0 },
        data: { label: 'Increase Pro plan price?', kind: 'decision' },
      },
      {
        id: 'goal_1',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { label: 'Reach £20k MRR within 12 months', kind: 'goal' },
      },
      {
        id: 'opt_increase_price',
        type: 'option',
        position: { x: 0, y: 0 },
        data: { label: 'Increase price to £59', kind: 'option' },
      },
      {
        id: 'opt_keep_price',
        type: 'option',
        position: { x: 0, y: 0 },
        data: { label: 'Keep price at £49', kind: 'option' },
      },
      {
        id: 'out_increase_revenue',
        type: 'outcome',
        position: { x: 0, y: 0 },
        data: { label: 'Higher revenue from price increase', kind: 'outcome' },
      },
    ]

    render(
      <GoalNodeSelector
        nodes={ceeGeneratedNodes}
        currentGoalId={null}
        onChange={mockOnChange}
        onMarkAsGoal={mockOnMarkAsGoal}
      />
    )

    // Goal should be detected and shown in dropdown
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options.some((opt) => opt.textContent === 'Reach £20k MRR within 12 months')).toBe(true)
  })

  it('shows selected goal when auto-selected after draft', () => {
    const ceeGeneratedNodes: Node[] = [
      {
        id: 'goal_1',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { label: 'Reach £20k MRR within 12 months', kind: 'goal' },
      },
      {
        id: 'factor_1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Price', kind: 'factor' },
      },
    ]

    // Simulate auto-selection (currentGoalId is set)
    render(
      <GoalNodeSelector
        nodes={ceeGeneratedNodes}
        currentGoalId="goal_1"
        onChange={mockOnChange}
        onMarkAsGoal={mockOnMarkAsGoal}
      />
    )

    // Should show success indicator
    expect(screen.getByText('Goal: Reach £20k MRR within 12 months')).toBeInTheDocument()

    // No warning should be shown
    expect(screen.queryByText('No goal selected.')).not.toBeInTheDocument()
    expect(screen.queryByText('No goal nodes in the model.')).not.toBeInTheDocument()
  })
})
