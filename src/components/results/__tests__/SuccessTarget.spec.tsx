/**
 * SuccessTarget Component Tests
 *
 * P2 Task 1: Tests for the inline success target affordance component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTarget } from '../SuccessTarget'

describe('SuccessTarget', () => {
  describe('State C: No target set', () => {
    it('renders prompt to set target when no threshold exists', () => {
      render(<SuccessTarget goalThreshold={null} />)

      expect(screen.getByText(/Set a success target/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Set target/i })).toBeInTheDocument()
    })

    it('shows inline input when "Set target" is clicked', () => {
      render(<SuccessTarget goalThreshold={null} />)

      fireEvent.click(screen.getByRole('button', { name: /Set target/i }))

      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Apply & re-run/i })).toBeInTheDocument()
    })

    it('disables Set target button when running', () => {
      render(<SuccessTarget goalThreshold={null} isRunning={true} />)

      expect(screen.getByRole('button', { name: /Set target/i })).toBeDisabled()
    })
  })

  describe('State A/B: Target exists', () => {
    it('renders target value with "Target:" prefix', () => {
      render(
        <SuccessTarget
          goalThreshold={100}
          outcomeUnit="currency"
          outcomeUnitSymbol="$"
        />
      )

      expect(screen.getByText(/Target:/)).toBeInTheDocument()
      // Value is formatted - check for the number
      expect(screen.getByText(/100/)).toBeInTheDocument()
    })

    it('shows "from your brief" attribution when isFromBrief is true', () => {
      render(
        <SuccessTarget
          goalThreshold={50}
          outcomeUnit="percent"
          isFromBrief={true}
        />
      )

      expect(screen.getByText(/from your brief/)).toBeInTheDocument()
    })

    it('shows "your target" attribution when isFromBrief is false', () => {
      render(
        <SuccessTarget
          goalThreshold={50}
          outcomeUnit="percent"
          isFromBrief={false}
        />
      )

      expect(screen.getByText(/your target/)).toBeInTheDocument()
    })

    it('shows goal label when provided', () => {
      render(
        <SuccessTarget
          goalThreshold={75}
          goalLabel="MRR"
          outcomeUnit="percent"
        />
      )

      expect(screen.getByText(/MRR/)).toBeInTheDocument()
    })

    it('renders edit button', () => {
      render(<SuccessTarget goalThreshold={100} />)

      expect(screen.getByRole('button', { name: /Edit target/i })).toBeInTheDocument()
    })
  })

  describe('Edit mode', () => {
    it('enters edit mode when pencil icon is clicked', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))

      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
      expect(screen.getByRole('spinbutton')).toHaveValue(100)
    })

    it('shows "Apply & re-run" button in edit mode', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))

      expect(screen.getByRole('button', { name: /Apply & re-run/i })).toBeInTheDocument()
    })

    it('disables "Apply & re-run" button when value unchanged', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))

      expect(screen.getByRole('button', { name: /Apply & re-run/i })).toBeDisabled()
    })

    it('enables "Apply & re-run" button when value changes', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })

      expect(screen.getByRole('button', { name: /Apply & re-run/i })).not.toBeDisabled()
    })

    it('calls onApplyThreshold with new value when "Apply & re-run" is clicked', () => {
      const mockApply = vi.fn()
      render(<SuccessTarget goalThreshold={100} onApplyThreshold={mockApply} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })
      fireEvent.click(screen.getByRole('button', { name: /Apply & re-run/i }))

      expect(mockApply).toHaveBeenCalledWith(150)
    })

    it('exits edit mode on Cancel click', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })

    it('shows "Remove target" option in edit mode when target exists', () => {
      render(<SuccessTarget goalThreshold={100} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))

      expect(screen.getByRole('button', { name: /Remove target/i })).toBeInTheDocument()
    })

    it('calls onApplyThreshold with null when "Remove target" is clicked', () => {
      const mockApply = vi.fn()
      render(<SuccessTarget goalThreshold={100} onApplyThreshold={mockApply} />)

      fireEvent.click(screen.getByRole('button', { name: /Edit target/i }))
      fireEvent.click(screen.getByRole('button', { name: /Remove target/i }))

      expect(mockApply).toHaveBeenCalledWith(null)
    })

    it('disables edit button when isRunning is true', () => {
      render(<SuccessTarget goalThreshold={100} isRunning={true} />)

      expect(screen.getByRole('button', { name: /Edit target/i })).toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('has proper testId for testing', () => {
      render(<SuccessTarget goalThreshold={100} />)

      expect(screen.getByTestId('success-target')).toBeInTheDocument()
    })
  })
})
