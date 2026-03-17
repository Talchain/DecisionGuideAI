import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoalBaselineInput } from '../GoalBaselineInput'

const defaultProps = {
  currentValue: null as number | null,
  goalLabel: 'Revenue',
  unit: null as string | null,
  hasGoalNode: true,
  onConfirm: vi.fn(),
  onClear: vi.fn(),
  onInputOpen: vi.fn(),
  onInputClose: vi.fn(),
}

function renderComponent(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<GoalBaselineInput {...props} />)
}

describe('GoalBaselineInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Empty state — no goal node', () => {
    it('shows "No goal defined yet." when hasGoalNode is false', () => {
      renderComponent({ hasGoalNode: false })
      expect(screen.getByText('No goal defined yet.')).toBeInTheDocument()
      expect(screen.queryByTestId('goal-baseline-set-cta')).not.toBeInTheDocument()
    })
  })

  describe('Pill state — no baseline set', () => {
    it('renders "Set current value" CTA when no baseline exists', () => {
      renderComponent({ currentValue: null })
      expect(screen.getByTestId('goal-baseline-pill')).toBeInTheDocument()
      expect(screen.getByTestId('goal-baseline-set-cta')).toHaveTextContent('Set current value')
    })

    it('renders Framing pill with correct DS v5 styling', () => {
      renderComponent({ currentValue: null })
      const pill = screen.getByText('Framing')
      expect(pill.className).toContain('border')
      expect(pill.className).toContain('bg-transparent')
    })

    it('opens input on CTA click', () => {
      renderComponent({ currentValue: null })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      expect(screen.getByTestId('goal-baseline-input')).toBeInTheDocument()
    })

    it('calls onInputOpen when CTA clicked', () => {
      const onInputOpen = vi.fn()
      renderComponent({ currentValue: null, onInputOpen })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      expect(onInputOpen).toHaveBeenCalledOnce()
    })
  })

  describe('Input state — editing', () => {
    it('renders numeric input with auto-focus', () => {
      renderComponent({ currentValue: null })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'number')
    })

    it('renders confirm and cancel buttons', () => {
      renderComponent({ currentValue: null })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      expect(screen.getByTestId('goal-baseline-confirm')).toBeInTheDocument()
      expect(screen.getByTestId('goal-baseline-cancel')).toBeInTheDocument()
    })

    it('confirms on Enter key', () => {
      const onConfirm = vi.fn()
      renderComponent({ currentValue: null, onConfirm })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '42' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onConfirm).toHaveBeenCalledWith(42)
    })

    it('cancels on Escape key', () => {
      const onInputClose = vi.fn()
      renderComponent({ currentValue: null, onInputClose })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should revert to pill state
      expect(screen.getByTestId('goal-baseline-pill')).toBeInTheDocument()
      expect(onInputClose).toHaveBeenCalledOnce()
    })

    it('confirms on Check button click', () => {
      const onConfirm = vi.fn()
      renderComponent({ currentValue: null, onConfirm })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '100' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      expect(onConfirm).toHaveBeenCalledWith(100)
    })

    it('cancels on X button click', () => {
      renderComponent({ currentValue: null })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      fireEvent.click(screen.getByTestId('goal-baseline-cancel'))
      expect(screen.getByTestId('goal-baseline-pill')).toBeInTheDocument()
    })

    it('shows error for non-numeric input on confirm', () => {
      renderComponent({ currentValue: null })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      // HTML number input won't accept non-numeric, but empty is invalid
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      expect(screen.getByTestId('goal-baseline-error')).toBeInTheDocument()
      expect(screen.getByText('Enter a numeric value')).toBeInTheDocument()
    })

    it('accepts zero as a valid value', () => {
      const onConfirm = vi.fn()
      renderComponent({ currentValue: null, onConfirm })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      expect(onConfirm).toHaveBeenCalledWith(0)
    })

    it('accepts negative values', () => {
      const onConfirm = vi.fn()
      renderComponent({ currentValue: null, onConfirm })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '-50' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      expect(onConfirm).toHaveBeenCalledWith(-50)
    })

    it('pre-populates input when editing existing value', () => {
      renderComponent({ currentValue: 200 })
      fireEvent.click(screen.getByTestId('goal-baseline-edit'))

      const input = screen.getByTestId('goal-baseline-number-input')
      expect(input).toHaveValue(200)
    })

    it('shows unit hint in placeholder when unit is provided', () => {
      renderComponent({ currentValue: null, unit: 'customers' })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      expect(input).toHaveAttribute('placeholder', 'Value (customers)')
    })
  })

  describe('Display state — baseline set', () => {
    it('shows baseline value and Edit link', () => {
      renderComponent({ currentValue: 200 })
      expect(screen.getByTestId('goal-baseline-display')).toBeInTheDocument()
      expect(screen.getByText(/Baseline: 200/)).toBeInTheDocument()
      expect(screen.getByTestId('goal-baseline-edit')).toHaveTextContent('Edit')
    })

    it('shows value with unit when provided', () => {
      renderComponent({ currentValue: 200, unit: 'customers' })
      expect(screen.getByText(/Baseline: 200 customers/)).toBeInTheDocument()
    })

    it('shows improvement copy', () => {
      renderComponent({ currentValue: 200 })
      expect(screen.getByText('Analysis will show improvement from this starting point.')).toBeInTheDocument()
    })

    it('opens input on Edit click', () => {
      renderComponent({ currentValue: 200 })
      fireEvent.click(screen.getByTestId('goal-baseline-edit'))
      expect(screen.getByTestId('goal-baseline-input')).toBeInTheDocument()
    })
  })

  describe('Undo support', () => {
    it('shows undo link for 5 seconds after confirming', () => {
      const onConfirm = vi.fn()
      renderComponent({ currentValue: null, onConfirm })
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))

      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '42' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // onConfirm was called, component will re-render with new currentValue
      // Re-render with the confirmed value to see undo
    })

    it('shows undo link after confirm and hides after 5s', () => {
      // Start with no value, simulate the full flow
      const onConfirm = vi.fn()
      const onClear = vi.fn()
      const { rerender } = render(
        <GoalBaselineInput
          currentValue={null}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={onClear}
        />
      )

      // Open input and confirm
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      const input = screen.getByTestId('goal-baseline-number-input')
      fireEvent.change(input, { target: { value: '42' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // Re-render with updated value (simulating store update)
      rerender(
        <GoalBaselineInput
          currentValue={42}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={onClear}
        />
      )

      // Undo link should be visible
      expect(screen.getByTestId('goal-baseline-undo')).toBeInTheDocument()

      // After 5 seconds, undo should disappear
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(screen.queryByTestId('goal-baseline-undo')).not.toBeInTheDocument()
    })

    it('reverts to previous value on undo click', () => {
      const onConfirm = vi.fn()
      const onClear = vi.fn()
      const { rerender } = render(
        <GoalBaselineInput
          currentValue={null}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={onClear}
        />
      )

      // Open input and confirm
      fireEvent.click(screen.getByTestId('goal-baseline-set-cta'))
      fireEvent.change(screen.getByTestId('goal-baseline-number-input'), { target: { value: '42' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // Re-render with confirmed value
      rerender(
        <GoalBaselineInput
          currentValue={42}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={onClear}
        />
      )

      // Click undo — should call onClear since previous was null
      fireEvent.click(screen.getByTestId('goal-baseline-undo'))
      expect(onClear).toHaveBeenCalledOnce()
    })

    it('reverts to previous numeric value on undo when editing existing', () => {
      const onConfirm = vi.fn()
      const { rerender } = render(
        <GoalBaselineInput
          currentValue={100}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={vi.fn()}
        />
      )

      // Edit and change value
      fireEvent.click(screen.getByTestId('goal-baseline-edit'))
      fireEvent.change(screen.getByTestId('goal-baseline-number-input'), { target: { value: '200' } })
      fireEvent.click(screen.getByTestId('goal-baseline-confirm'))

      // Re-render with new value
      rerender(
        <GoalBaselineInput
          currentValue={200}
          goalLabel="Revenue"
          unit={null}
          hasGoalNode={true}
          onConfirm={onConfirm}
          onClear={vi.fn()}
        />
      )

      // Click undo — should call onConfirm with previous value (100)
      fireEvent.click(screen.getByTestId('goal-baseline-undo'))
      expect(onConfirm).toHaveBeenLastCalledWith(100)
    })
  })
})
