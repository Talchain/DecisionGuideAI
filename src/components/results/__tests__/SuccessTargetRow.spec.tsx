/**
 * SuccessTargetRow Component Tests (V9.2 Phase 2)
 *
 * Tests for the compact inline success target input.
 * Layout: "Success target ≥ [value]" + edit mode + microcopy.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTargetRow } from '../SuccessTargetRow'

describe('SuccessTargetRow', () => {
  describe('No target set', () => {
    it('renders with data-testid', () => {
      render(<SuccessTargetRow />)

      expect(screen.getByTestId('success-target-row')).toBeInTheDocument()
    })

    it('shows "Set target" button', () => {
      render(<SuccessTargetRow />)

      expect(screen.getByText('Set target')).toBeInTheDocument()
    })

    it('shows placeholder microcopy', () => {
      render(<SuccessTargetRow />)

      expect(
        screen.getByText("Set a success target to see each option's chance of achieving it.")
      ).toBeInTheDocument()
    })

    it('hides "Wins"/"Hits target" microcopy', () => {
      render(<SuccessTargetRow />)

      expect(screen.queryByText(/outperforms alternatives/)).not.toBeInTheDocument()
    })
  })

  describe('Target set', () => {
    it('shows target value', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('shows ≥ operator', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText('≥')).toBeInTheDocument()
    })

    it('shows Wins/Hits target microcopy', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(screen.getByText(/outperforms alternatives/)).toBeInTheDocument()
      expect(screen.getByText(/reaches your success target/)).toBeInTheDocument()
    })

    it('hides placeholder microcopy', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      expect(
        screen.queryByText("Set a success target to see each option's chance of achieving it.")
      ).not.toBeInTheDocument()
    })

    it('shows "(from brief)" when isFromBrief is true', () => {
      render(<SuccessTargetRow goalThreshold={100} isFromBrief={true} />)

      expect(screen.getByText('(from brief)')).toBeInTheDocument()
    })
  })

  describe('Edit mode', () => {
    it('opens edit mode when "Set target" is clicked', () => {
      render(<SuccessTargetRow />)

      fireEvent.click(screen.getByText('Set target'))

      expect(screen.getByLabelText('Edit success target value')).toBeInTheDocument()
    })

    it('opens edit mode when current value is clicked', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      fireEvent.click(screen.getByText('100'))

      expect(screen.getByLabelText('Edit success target value')).toBeInTheDocument()
    })

    it('calls onApplyThreshold on Enter', () => {
      const onApply = vi.fn()
      render(<SuccessTargetRow goalThreshold={100} onApplyThreshold={onApply} />)

      fireEvent.click(screen.getByText('100'))

      const input = screen.getByLabelText('Edit success target value')
      fireEvent.change(input, { target: { value: '150' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onApply).toHaveBeenCalledWith(150)
    })

    it('reverts on Escape', () => {
      render(<SuccessTargetRow goalThreshold={100} />)

      fireEvent.click(screen.getByText('100'))
      const input = screen.getByLabelText('Edit success target value')
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should exit edit mode, showing the value button again
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.queryByLabelText('Edit success target value')).not.toBeInTheDocument()
    })

    it('disables input when isRunning', () => {
      render(<SuccessTargetRow goalThreshold={100} isRunning={true} />)

      // "Set target" or value button should be disabled
      const button = screen.getByLabelText(/Edit success target/)
      expect(button).toBeDisabled()
    })
  })
})
