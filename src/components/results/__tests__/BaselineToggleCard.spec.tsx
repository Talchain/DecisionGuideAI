/**
 * BaselineToggleCard Component Tests
 *
 * Tests for the compact single-line baseline warning card.
 * Layout: AlertTriangle icon + "No baseline included" + [?] tooltip + [Add baseline] button
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

  describe('compact warning layout', () => {
    it('displays "No baseline included" message', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByText('No baseline included')).toBeInTheDocument()
    })

    it('renders the AlertTriangle icon as decorative (aria-hidden)', () => {
      render(<BaselineToggleCard show={true} />)

      const card = screen.getByTestId('baseline-toggle-card')
      const icon = card.querySelector('svg[aria-hidden="true"]')
      expect(icon).toBeInTheDocument()
    })

    it('shows "Add baseline" button', () => {
      render(<BaselineToggleCard show={true} />)

      expect(
        screen.getByRole('button', { name: /Add baseline/i })
      ).toBeInTheDocument()
    })
  })

  describe('tooltip', () => {
    it('renders the [?] help indicator with correct title tooltip', () => {
      render(<BaselineToggleCard show={true} />)

      const tooltip = screen.getByTitle(
        "A 'do nothing' option shows whether any option improves on your current position."
      )
      expect(tooltip).toBeInTheDocument()
    })

    it('[?] has an accessible label', () => {
      render(<BaselineToggleCard show={true} />)

      expect(screen.getByLabelText('Why add a baseline?')).toBeInTheDocument()
    })
  })

  describe('add baseline interaction', () => {
    it('calls onAddBaseline when button is clicked', () => {
      const mockAddBaseline = vi.fn()
      render(
        <BaselineToggleCard show={true} onAddBaseline={mockAddBaseline} />
      )

      fireEvent.click(screen.getByRole('button', { name: /Add baseline/i }))

      expect(mockAddBaseline).toHaveBeenCalledTimes(1)
    })

    it('logs to console when button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      render(<BaselineToggleCard show={true} />)

      fireEvent.click(screen.getByRole('button', { name: /Add baseline/i }))

      expect(consoleSpy).toHaveBeenCalledWith(
        '[BaselineToggleCard] Baseline added to draft'
      )
      consoleSpy.mockRestore()
    })
  })

  describe('running state', () => {
    it('disables button when isRunning is true', () => {
      render(<BaselineToggleCard show={true} isRunning={true} />)

      expect(screen.getByRole('button', { name: /Adding/i })).toBeDisabled()
    })

    it('shows "Adding..." text when isRunning is true', () => {
      render(<BaselineToggleCard show={true} isRunning={true} />)

      expect(screen.getByText('Adding...')).toBeInTheDocument()
    })

    it('shows "Add baseline" text when not running', () => {
      render(<BaselineToggleCard show={true} isRunning={false} />)

      expect(screen.getByText('Add baseline')).toBeInTheDocument()
    })
  })
})
