/**
 * SuccessTarget Component Tests
 *
 * Task 2: Tests for the inline success target input component.
 * New design: always-visible inline input, no intermediate "Set target" button.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTarget } from '../SuccessTarget'

describe('SuccessTarget', () => {
  describe('Inline Input (always visible)', () => {
    it('renders input inline when no threshold exists', () => {
      render(<SuccessTarget goalThreshold={null} />)

      // Input should always be visible
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
      // Helper text should be present
      expect(screen.getByText(/Set a success target/)).toBeInTheDocument()
    })

    it('renders input with current value when threshold exists', () => {
      render(<SuccessTarget goalThreshold={100} />)

      const input = screen.getByRole('spinbutton')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue(100)
    })

    it('shows placeholder text based on unit type', () => {
      render(<SuccessTarget goalThreshold={null} outcomeUnit="currency" outcomeUnitSymbol="$" />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('placeholder', 'e.g. $20000')
    })

    it('shows percent placeholder for percent unit', () => {
      render(<SuccessTarget goalThreshold={null} outcomeUnit="percent" />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('placeholder', 'e.g. 50')
    })

    it('disables input when isRunning is true', () => {
      render(<SuccessTarget goalThreshold={null} isRunning={true} />)

      expect(screen.getByRole('spinbutton')).toBeDisabled()
    })
  })

  describe('Goal Label', () => {
    it('shows goal label when provided', () => {
      render(<SuccessTarget goalThreshold={null} goalLabel="MRR" />)

      expect(screen.getByText('MRR:')).toBeInTheDocument()
    })

    it('shows default label when goalLabel not provided', () => {
      render(<SuccessTarget goalThreshold={null} />)

      expect(screen.getByText('Success target:')).toBeInTheDocument()
    })
  })

  describe('Attribution', () => {
    it('shows "from your brief" when isFromBrief is true', () => {
      render(<SuccessTarget goalThreshold={50} isFromBrief={true} />)

      expect(screen.getByText(/from your brief/)).toBeInTheDocument()
    })

    it('shows "your target" when threshold exists and not from brief', () => {
      render(<SuccessTarget goalThreshold={50} isFromBrief={false} />)

      expect(screen.getByText(/your target/)).toBeInTheDocument()
    })

    it('shows no attribution when no threshold', () => {
      render(<SuccessTarget goalThreshold={null} />)

      expect(screen.queryByText(/from your brief/)).not.toBeInTheDocument()
      expect(screen.queryByText(/your target/)).not.toBeInTheDocument()
    })
  })

  describe('Apply and re-run button', () => {
    it('does not show Apply button when value unchanged', () => {
      render(<SuccessTarget goalThreshold={100} />)

      expect(screen.queryByRole('button', { name: /Apply and re-run/i })).not.toBeInTheDocument()
    })

    it('shows Apply button when value changes', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })

      expect(screen.getByRole('button', { name: /Apply and re-run/i })).toBeInTheDocument()
    })

    it('shows Apply button when entering value in empty input', () => {
      render(<SuccessTarget goalThreshold={null} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })

      expect(screen.getByRole('button', { name: /Apply and re-run/i })).toBeInTheDocument()
    })

    it('calls onApplyThreshold when Apply button clicked', () => {
      const mockApply = vi.fn()
      render(<SuccessTarget goalThreshold={100} onApplyThreshold={mockApply} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })
      fireEvent.click(screen.getByRole('button', { name: /Apply and re-run/i }))

      expect(mockApply).toHaveBeenCalledWith(150)
    })

    it('calls onApplyThreshold on Enter key when value changed', () => {
      const mockApply = vi.fn()
      render(<SuccessTarget goalThreshold={100} onApplyThreshold={mockApply} />)

      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '150' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockApply).toHaveBeenCalledWith(150)
    })

    it('disables Apply button when isRunning is true', () => {
      // Start with isRunning=false so we can make changes
      const { rerender } = render(<SuccessTarget goalThreshold={100} isRunning={false} />)

      // Make a change to trigger Apply button
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })
      expect(screen.getByRole('button', { name: /Apply and re-run/i })).toBeInTheDocument()

      // Now set isRunning=true
      rerender(<SuccessTarget goalThreshold={100} isRunning={true} />)

      // Input should be disabled and Apply button should be disabled
      expect(screen.getByRole('spinbutton')).toBeDisabled()
      expect(screen.getByRole('button', { name: /Running/i })).toBeDisabled()
    })
  })

  describe('Remove target', () => {
    it('shows Remove button when threshold exists', () => {
      render(<SuccessTarget goalThreshold={100} />)

      expect(screen.getByRole('button', { name: /Remove target/i })).toBeInTheDocument()
    })

    it('does not show Remove button when no threshold', () => {
      render(<SuccessTarget goalThreshold={null} />)

      expect(screen.queryByRole('button', { name: /Remove target/i })).not.toBeInTheDocument()
    })

    it('calls onApplyThreshold with null when Remove clicked', () => {
      const mockApply = vi.fn()
      render(<SuccessTarget goalThreshold={100} onApplyThreshold={mockApply} />)

      fireEvent.click(screen.getByRole('button', { name: /Remove target/i }))

      expect(mockApply).toHaveBeenCalledWith(null)
    })

    it('hides Remove button when isRunning', () => {
      render(<SuccessTarget goalThreshold={100} isRunning={true} />)

      expect(screen.queryByRole('button', { name: /Remove target/i })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper testId for testing', () => {
      render(<SuccessTarget goalThreshold={100} />)

      expect(screen.getByTestId('success-target')).toBeInTheDocument()
    })

    it('input has accessible label', () => {
      render(<SuccessTarget goalThreshold={null} goalLabel="Revenue" />)

      expect(screen.getByRole('spinbutton', { name: /Revenue value/i })).toBeInTheDocument()
    })
  })
})
