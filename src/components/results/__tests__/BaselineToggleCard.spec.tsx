/**
 * BaselineToggleCard Component Tests
 *
 * P2 Task 2: Tests for the actionable baseline toggle card component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BaselineToggleCard } from '../BaselineToggleCard'

describe('BaselineToggleCard', () => {
  describe('visibility', () => {
    it('renders when show is true', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByTestId('baseline-toggle-card')).toBeInTheDocument()
    })

    it('does not render when show is false', () => {
      render(<BaselineToggleCard show={false} />)

      expect(screen.queryByTestId('baseline-toggle-card')).not.toBeInTheDocument()
    })
  })

  describe('content', () => {
    it('displays "No baseline option included" message', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByText(/No baseline option included/)).toBeInTheDocument()
    })

    it('displays explanatory text about baselines', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByText(/A baseline helps compare options against your current situation/)).toBeInTheDocument()
    })

    it('shows "Add \'do nothing\' baseline" button', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByRole('button', { name: /Add.*baseline/i })).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onAddBaseline when button is clicked', () => {
      const mockAddBaseline = vi.fn()
      render(<BaselineToggleCard show={true} onAddBaseline={mockAddBaseline} />)

      fireEvent.click(screen.getByRole('button', { name: /Add.*baseline/i }))

      expect(mockAddBaseline).toHaveBeenCalledTimes(1)
    })

    it('disables button when isRunning is true', () => {
      render(<BaselineToggleCard show={true} isRunning={true} />)

      expect(screen.getByRole('button', { name: /Adding.../i })).toBeDisabled()
    })

    it('shows "Adding..." text when isRunning is true', () => {
      render(<BaselineToggleCard show={true} isRunning={true} />)

      expect(screen.getByText(/Adding.../)).toBeInTheDocument()
    })
  })

  describe('expandable explanation', () => {
    it('shows "Learn why baselines help" toggle', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByText(/Learn why baselines help/)).toBeInTheDocument()
    })

    it('does not show explanation by default', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.queryByText(/A baseline anchors comparisons/)).not.toBeInTheDocument()
    })

    it('shows explanation when toggle is clicked', () => {
      render(<BaselineToggleCard show={true} />)

      fireEvent.click(screen.getByText(/Learn why baselines help/))

      expect(screen.getByText(/A baseline anchors comparisons/)).toBeInTheDocument()
    })

    it('hides explanation when toggle is clicked again', () => {
      render(<BaselineToggleCard show={true} />)

      // Open explanation
      fireEvent.click(screen.getByText(/Learn why baselines help/))
      expect(screen.getByText(/A baseline anchors comparisons/)).toBeInTheDocument()

      // Close explanation
      fireEvent.click(screen.getByText(/Learn why baselines help/))
      expect(screen.queryByText(/A baseline anchors comparisons/)).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper testId for testing', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByTestId('baseline-toggle-card')).toBeInTheDocument()
    })

    it('button has proper accessible name', () => {
      render(<BaselineToggleCard show={true} />)

      // Button should be accessible
      const button = screen.getByRole('button', { name: /Add.*baseline/i })
      expect(button).toBeInTheDocument()
    })
  })
})
