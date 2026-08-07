/**
 * GoalSection — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalSection } from '../GoalSection'
import type { Node } from '@xyflow/react'

// ROADMAP 2.121 slice 1: the target commit no longer hand-rolls an
// `updateNode` — it goes through `setGoalThresholdAndUpdateNode`, the atomic
// store+node action every other success-target editor already uses (it writes
// the global scalar, `success_threshold`, `threshold_source` and
// `threshold_confirmed` together, and invalidates analysis readiness).
const mockSetGoalThresholdAndUpdateNode = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ setGoalThresholdAndUpdateNode: mockSetGoalThresholdAndUpdateNode })
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

  // Dress-rehearsal 2026-07-20 regression: a USER-set success_threshold is
  // RAW user units (store.ts setGoalThresholdAndUpdateNode — the only
  // production writer — and computeSuccessState both define it so). This
  // section rendered it through the normalised ×100 branch, showing the
  // 50012 mis-parse as "5,001,200% likelihood".
  it('renders a user-set success_threshold as the raw number — never ×100 "% likelihood"', () => {
    render(<GoalSection goalNode={makeGoalNode({
      success_threshold: 50012,
      threshold_source: 'user',
      goal_threshold: undefined,
      goal_threshold_raw: undefined,
    })} />)
    expect(screen.getByText(/50,012/)).toBeInTheDocument()
    expect(screen.queryByText(/likelihood/)).not.toBeInTheDocument()
    expect(screen.queryByText(/5,001,200/)).not.toBeInTheDocument()
  })

  it('renders a user-set success_threshold with the captured unit', () => {
    render(<GoalSection goalNode={makeGoalNode({
      success_threshold: 500000,
      threshold_source: 'user',
      goal_threshold_unit: '£',
      goal_threshold: undefined,
      goal_threshold_raw: undefined,
    })} />)
    expect(screen.getByText(/£500,000/)).toBeInTheDocument()
  })

  it('a user-set threshold wins over a stale CEE raw anchor (mirrors computeSuccessState priority)', () => {
    render(<GoalSection goalNode={makeGoalNode({
      success_threshold: 600000,
      threshold_source: 'user',
      goal_threshold_raw: 500000,
      goal_threshold_unit: '£',
    })} />)
    expect(screen.getByText(/£600,000/)).toBeInTheDocument()
    expect(screen.queryByText(/£500,000/)).not.toBeInTheDocument()
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

  it('commits the target through the canonical user-target action', () => {
    mockSetGoalThresholdAndUpdateNode.mockClear()
    render(<GoalSection goalNode={makeGoalNode({ success_threshold: 0.75 })} />)

    const displayEl = screen.getByTestId('goal-threshold-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('goal-threshold')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.blur(input)

    // The action is what stamps `threshold_source: 'user'` — AND moves
    // `success_threshold` and the global scalar with it. The hand-rolled write
    // this replaces stamped the source while leaving both numbers behind, so a
    // stale value outranked the one the user had just typed.
    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal-1', 80)
  })

  it('persists the target as the raw numeric value without conversion', () => {
    mockSetGoalThresholdAndUpdateNode.mockClear()
    render(<GoalSection goalNode={makeGoalNode({
      goal_threshold_raw: 500000,
      goal_threshold_unit: '£',
    })} />)

    const displayEl = screen.getByTestId('goal-threshold-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('goal-threshold')
    fireEvent.change(input, { target: { value: '750000' } })
    fireEvent.blur(input)

    // No unit conversion — exactly what the user entered, on their scale.
    expect(mockSetGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal-1', 750000)
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
