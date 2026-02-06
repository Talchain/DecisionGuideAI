/**
 * SuccessTarget Component Tests (Redesigned)
 *
 * Tests for the inline-editable success target component
 * with click-to-edit values and multi-target ready architecture.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTarget } from '../SuccessTarget'
import type { GoalConstraint } from '../types'

// Mock focusHelpers (defensive — not directly used by SuccessTarget,
// but kept in case a transitive import pulls it in)
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

/** Helper to build a GoalConstraint with sensible defaults */
function makeConstraint(overrides: Partial<GoalConstraint> = {}): GoalConstraint {
  return {
    id: 'c1',
    label: 'Revenue',
    operator: '>=',
    value: 100000,
    probability: 0.72,
    ...overrides,
  }
}

describe('SuccessTarget', () => {
  // ===========================================================================
  // Empty state
  // ===========================================================================
  describe('Empty state (no constraints)', () => {
    it('renders the empty-state message when goalConstraints is empty', () => {
      render(<SuccessTarget goalConstraints={[]} />)

      expect(
        screen.getByText('Set a success target to see how likely you are to achieve your goal'),
      ).toBeInTheDocument()
    })

    it('still renders the header and "+ Add" button in the empty state', () => {
      render(<SuccessTarget goalConstraints={[]} />)

      expect(screen.getByText('Success target')).toBeInTheDocument()
      expect(screen.getByText('Add')).toBeInTheDocument()
    })

    it('has proper data-testid for testing', () => {
      render(<SuccessTarget goalConstraints={[]} />)

      expect(screen.getByTestId('success-target')).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Single constraint display
  // ===========================================================================
  describe('Single constraint display', () => {
    it('renders label, operator, value and probability', () => {
      const constraint = makeConstraint()
      render(<SuccessTarget goalConstraints={[constraint]} />)

      expect(screen.getByText('Revenue')).toBeInTheDocument()
      // >= renders as ≥
      expect(screen.getByText('≥')).toBeInTheDocument()
      // Value is rendered as a clickable button
      expect(screen.getByRole('button', { name: /Edit Revenue value: 100000/i })).toBeInTheDocument()
      // Probability formatted as integer percentage
      expect(screen.getByText('72%')).toBeInTheDocument()
    })

    it('renders <= operator as ≤', () => {
      const constraint = makeConstraint({ operator: '<=' })
      render(<SuccessTarget goalConstraints={[constraint]} />)

      expect(screen.getByText('≤')).toBeInTheDocument()
    })

    it('shows dash when probability is null', () => {
      const constraint = makeConstraint({ probability: null })
      render(<SuccessTarget goalConstraints={[constraint]} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('shows singular header "Success target" for single constraint', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      expect(screen.getByText('Success target')).toBeInTheDocument()
    })

    it('shows "(from your brief)" when isFromBrief is true', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} isFromBrief />)

      expect(screen.getByText(/from your brief/)).toBeInTheDocument()
    })

    it('does not show "(from your brief)" when isFromBrief is false', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} isFromBrief={false} />)

      expect(screen.queryByText(/from your brief/)).not.toBeInTheDocument()
    })

    it('has proper data-testid when constraints exist', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      expect(screen.getByTestId('success-target')).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Click-to-edit flow
  // ===========================================================================
  describe('Click-to-edit flow', () => {
    it('enters edit mode when value button is clicked', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      // Click the value button
      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))

      // Should now have a number input
      expect(screen.getByRole('spinbutton', { name: /Edit Revenue value/i })).toBeInTheDocument()
    })

    it('shows edit hint text when in edit mode', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))

      expect(screen.getByText(/Enter to apply/)).toBeInTheDocument()
      expect(screen.getByText(/Esc to cancel/)).toBeInTheDocument()
    })

    it('shows Apply check-icon button in edit mode', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))

      expect(screen.getByRole('button', { name: 'Apply value' })).toBeInTheDocument()
    })

    it('does not enter edit mode when isRunning is true', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} isRunning />)

      // The value button should be disabled
      const btn = screen.getByRole('button', { name: /Edit Revenue value/i })
      expect(btn).toBeDisabled()
    })
  })

  // ===========================================================================
  // Enter commits
  // ===========================================================================
  describe('Enter key commits', () => {
    it('calls onUpdateConstraint with parsed value on Enter', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '150000' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onUpdate).toHaveBeenCalledWith('c1', 150000)
    })

    it('exits edit mode after Enter', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '150000' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      // Should be back to display mode (value button, not input)
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('does not commit when value is not a valid number', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onUpdate).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Escape reverts
  // ===========================================================================
  describe('Escape key reverts', () => {
    it('exits edit mode without committing on Escape', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '999999' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(onUpdate).not.toHaveBeenCalled()
      // Should be back to display mode
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('hides edit hint text after Escape', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      expect(screen.getByText(/Enter to apply/)).toBeInTheDocument()

      const input = screen.getByRole('spinbutton')
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByText(/Enter to apply/)).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Blur reverts
  // ===========================================================================
  describe('Blur reverts', () => {
    it('exits edit mode without committing on blur', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '999999' } })
      fireEvent.blur(input)

      expect(onUpdate).not.toHaveBeenCalled()
      // Should be back to display mode
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Apply button (onMouseDown to prevent blur)
  // ===========================================================================
  describe('Apply button', () => {
    it('commits the value via Apply button using onMouseDown', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '200000' } })

      // The Apply button uses onMouseDown (not onClick) to prevent blur
      const applyBtn = screen.getByRole('button', { name: 'Apply value' })
      fireEvent.mouseDown(applyBtn)

      expect(onUpdate).toHaveBeenCalledWith('c1', 200000)
    })

    it('exits edit mode after Apply button is used', () => {
      const onUpdate = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[makeConstraint()]}
          onUpdateConstraint={onUpdate}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Revenue value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '200000' } })

      const applyBtn = screen.getByRole('button', { name: 'Apply value' })
      fireEvent.mouseDown(applyBtn)

      // Should be back to display mode
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Disabled "+ Add" button
  // ===========================================================================
  describe('Disabled "+ Add" button', () => {
    it('renders the Add button as disabled', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      const addBtn = screen.getByText('Add').closest('button')!
      expect(addBtn).toBeDisabled()
    })

    it('has title="Coming soon" on the Add button', () => {
      render(<SuccessTarget goalConstraints={[makeConstraint()]} />)

      const addBtn = screen.getByText('Add').closest('button')!
      expect(addBtn).toHaveAttribute('title', 'Coming soon')
    })

    it('shows disabled Add button in empty state as well', () => {
      render(<SuccessTarget goalConstraints={[]} />)

      const addBtn = screen.getByText('Add').closest('button')!
      expect(addBtn).toBeDisabled()
      expect(addBtn).toHaveAttribute('title', 'Coming soon')
    })
  })

  // ===========================================================================
  // Legacy props fallback
  // ===========================================================================
  describe('Legacy props fallback', () => {
    it('builds constraint from goalThreshold when goalConstraints is empty', () => {
      render(<SuccessTarget goalConstraints={[]} goalThreshold={50000} />)

      // Should display a target row with the threshold value
      expect(screen.getByRole('button', { name: /Edit Target value: 50000/i })).toBeInTheDocument()
    })

    it('uses goalLabel for the label in legacy mode', () => {
      render(<SuccessTarget goalConstraints={[]} goalThreshold={50000} goalLabel="MRR" />)

      expect(screen.getByText('MRR')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Edit MRR value: 50000/i })).toBeInTheDocument()
    })

    it('defaults label to "Target" when goalLabel is not provided', () => {
      render(<SuccessTarget goalConstraints={[]} goalThreshold={50000} />)

      expect(screen.getByText('Target')).toBeInTheDocument()
    })

    it('calls onApplyThreshold as legacy fallback when onUpdateConstraint is absent', () => {
      const onApply = vi.fn()
      render(
        <SuccessTarget
          goalConstraints={[]}
          goalThreshold={50000}
          onApplyThreshold={onApply}
        />,
      )

      // Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /Edit Target value/i }))
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '75000' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onApply).toHaveBeenCalledWith(75000)
    })

    it('prefers goalConstraints over goalThreshold when both provided', () => {
      const constraint = makeConstraint({ label: 'Revenue', value: 100000 })
      render(
        <SuccessTarget
          goalConstraints={[constraint]}
          goalThreshold={50000}
          goalLabel="Legacy"
        />,
      )

      // Should show the goalConstraints value, not the legacy one
      expect(screen.getByText('Revenue')).toBeInTheDocument()
      expect(screen.queryByText('Legacy')).not.toBeInTheDocument()
    })

    it('does not use legacy fallback when goalThreshold is null', () => {
      render(<SuccessTarget goalConstraints={[]} goalThreshold={null} />)

      // Should show empty state
      expect(
        screen.getByText('Set a success target to see how likely you are to achieve your goal'),
      ).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Multi-constraint display
  // ===========================================================================
  describe('Multi-constraint display', () => {
    it('shows plural header "Success targets" for multiple constraints', () => {
      const constraints = [
        makeConstraint({ id: 'c1', label: 'Revenue', value: 100000 }),
        makeConstraint({ id: 'c2', label: 'Churn', operator: '<=', value: 5 }),
      ]
      render(<SuccessTarget goalConstraints={constraints} />)

      expect(screen.getByText('Success targets')).toBeInTheDocument()
    })

    it('shows combined probability row when multi-target with joint probability', () => {
      const constraints = [
        makeConstraint({ id: 'c1', label: 'Revenue', value: 100000, probability: 0.8 }),
        makeConstraint({ id: 'c2', label: 'Churn', operator: '<=', value: 5, probability: 0.9 }),
      ]
      render(
        <SuccessTarget
          goalConstraints={constraints}
          probabilityOfJointGoal={0.65}
        />,
      )

      expect(screen.getByText('Combined')).toBeInTheDocument()
      expect(screen.getByText('65%')).toBeInTheDocument()
    })
  })
})
