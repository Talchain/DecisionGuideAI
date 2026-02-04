/**
 * LimitedOptionsCard Component Tests
 *
 * P2 Task 3: Tests for the limited options coaching card component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LimitedOptionsCard } from '../LimitedOptionsCard'

describe('LimitedOptionsCard', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  describe('visibility conditions', () => {
    it('renders when optionCount is 2 and hasBaseline is true', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByTestId('limited-options-card')).toBeInTheDocument()
    })

    it('does not render when optionCount is 1 (single option)', () => {
      render(
        <LimitedOptionsCard
          optionCount={1}
          hasBaseline={true}
        />
      )

      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()
    })

    it('does not render when optionCount is 3 or more', () => {
      render(
        <LimitedOptionsCard
          optionCount={3}
          hasBaseline={true}
        />
      )

      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()
    })

    it('does not render when hasBaseline is false (BaselineToggleCard takes priority)', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={false}
        />
      )

      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()
    })
  })

  describe('content', () => {
    it('displays option count in message', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByText(/You're comparing 2 options/)).toBeInTheDocument()
    })

    it('displays coaching suggestion text', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByText(/Adding alternatives would strengthen the analysis/)).toBeInTheDocument()
    })
  })

  describe('dismissal', () => {
    it('shows dismiss button', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument()
    })

    it('hides card when dismiss button is clicked', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))

      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()
    })

    it('persists dismissal in sessionStorage when responseHash is provided', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
          responseHash="abc123"
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))

      expect(sessionStorage.getItem('limited-options-dismissed-abc123')).toBe('true')
    })

    it('stays hidden after dismissal with same responseHash', () => {
      // Pre-set the dismissal in sessionStorage
      sessionStorage.setItem('limited-options-dismissed-abc123', 'true')

      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
          responseHash="abc123"
        />
      )

      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()
    })

    it('shows card again with different responseHash', () => {
      // Pre-set dismissal for first hash
      sessionStorage.setItem('limited-options-dismissed-abc123', 'true')

      // First render: dismissed
      const { rerender } = render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
          responseHash="abc123"
        />
      )
      expect(screen.queryByTestId('limited-options-card')).not.toBeInTheDocument()

      // Second render: different hash (not dismissed)
      rerender(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
          responseHash="xyz789"
        />
      )
      expect(screen.getByTestId('limited-options-card')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper testId for testing', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByTestId('limited-options-card')).toBeInTheDocument()
    })

    it('dismiss button has accessible label', () => {
      render(
        <LimitedOptionsCard
          optionCount={2}
          hasBaseline={true}
        />
      )

      expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument()
    })
  })
})
