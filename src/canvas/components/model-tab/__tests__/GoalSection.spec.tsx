/**
 * GoalSection — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalSection } from '../GoalSection'
import type { Node } from '@xyflow/react'

const mockUpdateNode = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ updateNode: mockUpdateNode })
  ),
}))

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeGoalNode(overrides: Partial<Record<string, unknown>> = {}): Node {
  return {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      label: 'Maximise revenue',
      success_threshold: 0.75,
      threshold_source: 'cee_inference',
      ...overrides,
    },
  }
}

describe('GoalSection', () => {
  it('renders nothing when goalNode is undefined', () => {
    const { container } = render(<GoalSection goalNode={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders goal label', () => {
    render(<GoalSection goalNode={makeGoalNode()} />)
    expect(screen.getByText('Maximise revenue')).toBeInTheDocument()
  })

  it('renders success threshold as percentage when no raw value', () => {
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: 0.75, goal_threshold_raw: undefined })} />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('renders raw threshold with unit when goal_threshold_raw and goal_threshold_unit are set', () => {
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 500000,
      goal_threshold_unit: '£',
      goal_threshold: undefined,
    })} />)
    expect(screen.getByText(/£500,000/)).toBeInTheDocument()
  })

  it('renders editable "Not set" when no threshold data available', () => {
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: undefined, goal_threshold: undefined })} />)
    // InlineEdit renders with -display suffix in display mode
    expect(screen.getByTestId('goal-threshold-not-set-display')).toBeInTheDocument()
    expect(screen.getByTestId('goal-threshold-not-set-display')).toHaveTextContent('Not set')
  })

  it('shows coaching prompt when threshold is not set', () => {
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: undefined, goal_threshold: undefined })} />)
    expect(screen.getByTestId('goal-threshold-coaching')).toBeInTheDocument()
    expect(screen.getByTestId('goal-threshold-coaching')).toHaveTextContent('Set a success target')
  })

  it('does not show coaching prompt when threshold is set', () => {
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: 0.75 })} />)
    expect(screen.queryByTestId('goal-threshold-coaching')).not.toBeInTheDocument()
  })

  it('shows raw value without unit when only raw_value present', () => {
    render(<GoalSection goalNode={makeGoalNode({ goal_threshold_raw: 42, goal_threshold_unit: undefined, success_threshold: undefined })} />)
    expect(screen.getByText(/42/)).toBeInTheDocument()
    expect(screen.queryByTestId('goal-threshold-not-set')).not.toBeInTheDocument()
  })

  it('goal label uses break-words, not truncate', () => {
    render(<GoalSection goalNode={makeGoalNode({ label: 'Maximise long-term sustainable revenue growth across all markets' })} />)
    // The label span should have break-words class, not truncate
    const labelEl = screen.getByText('Maximise long-term sustainable revenue growth across all markets')
    expect(labelEl.className).toMatch(/break-words/)
    expect(labelEl.className).not.toMatch(/truncate/)
  })

  it('renders source provenance pill for cee_inference source', () => {
    render(<GoalSection goalNode={makeGoalNode({ threshold_source: 'cee_inference' })} />)
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('has model-goal-section testid', () => {
    render(<GoalSection goalNode={makeGoalNode()} />)
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
  })

  it('calls updateNode with source: user when threshold is edited', () => {
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: 0.75 })} />)

    const displayEl = screen.getByTestId('goal-threshold-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('goal-threshold')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({
        data: expect.objectContaining({
          threshold_source: 'user',
        }),
      })
    )
  })

  it('persists goal_threshold_raw as the raw numeric value without conversion', () => {
    mockUpdateNode.mockClear()
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 500000,
      goal_threshold_unit: '£',
    })} />)

    const displayEl = screen.getByTestId('goal-threshold-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('goal-threshold')
    fireEvent.change(input, { target: { value: '750000' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({
        data: expect.objectContaining({
          goal_threshold_raw: 750000,
          threshold_source: 'user',
        }),
      })
    )
    // Verify no unit conversion happened — raw value is exactly what user entered
    const writtenData = mockUpdateNode.mock.calls[0][1].data
    expect(writtenData.goal_threshold_raw).toBe(750000)
  })

  // ── Goal feasibility warning tests ──────────────────────────────────────────

  it('shows feasibility warning when threshold is near cap', () => {
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 90,
      goal_threshold_unit: '%',
      goal_threshold_cap: 100,
    })} />)
    expect(screen.getByTestId('goal-feasibility-warning')).toBeInTheDocument()
    expect(screen.getByText(/Near range limit/)).toBeInTheDocument()
  })

  it('does not show feasibility warning when threshold is well below cap', () => {
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 50,
      goal_threshold_unit: '%',
      goal_threshold_cap: 100,
    })} />)
    expect(screen.queryByTestId('goal-feasibility-warning')).not.toBeInTheDocument()
  })

  it('does not show feasibility warning when cap is missing', () => {
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 90,
      goal_threshold_unit: '%',
    })} />)
    expect(screen.queryByTestId('goal-feasibility-warning')).not.toBeInTheDocument()
  })
})
