/**
 * VerificationBadge Tests
 *
 * Tests for verification badge display and interaction:
 * - Correct visual state based on score
 * - Issue expansion/collapse
 * - Accessibility attributes
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VerificationBadge } from '../VerificationBadge'

describe('VerificationBadge', () => {
  describe('Visual States', () => {
    it('shows verified state for high score (>=0.95)', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.97,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      expect(screen.getByText('Verified')).toBeInTheDocument()
      expect(screen.getByLabelText('Verification: Verified')).toHaveClass('text-green-600')
    })

    it('shows review state for medium score (0.80-0.94)', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      expect(screen.getByText('Review Recommended')).toBeInTheDocument()
      expect(screen.getByLabelText('Verification: Review Recommended')).toHaveClass(
        'text-amber-600'
      )
    })

    it('shows issues state for low score (<0.80)', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.65,
            schema_valid: false,
            engine_validated: true,
            issues_detected: [
              { stage: 'numerical', severity: 'error', code: 'UNGROUNDED' },
            ],
          }}
        />
      )

      expect(screen.getByText('Verification Issues')).toBeInTheDocument()
      expect(screen.getByLabelText('Verification: Verification Issues')).toHaveClass(
        'text-red-600'
      )
    })

    it('shows issue count when critical issues present', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              { stage: 'schema', severity: 'warning', code: 'FORMAT' },
              { stage: 'numerical', severity: 'error', code: 'UNGROUNDED' },
            ],
          }}
        />
      )

      expect(screen.getByText('(2)')).toBeInTheDocument()
    })
  })

  describe('Visibility', () => {
    it('hides when no verification data provided', () => {
      const { container } = render(<VerificationBadge />)
      expect(container.firstChild).toBeNull()
    })

    it('hides when verification is undefined', () => {
      const { container } = render(<VerificationBadge verification={undefined} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Issue Expansion', () => {
    it('expands to show issues on click', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              {
                stage: 'schema',
                severity: 'warning',
                code: 'FORMAT',
                message: 'Minor format issue',
              },
            ],
          }}
        />
      )

      const button = screen.getByText('Review Recommended')
      expect(screen.queryByText(/Minor format issue/)).not.toBeInTheDocument()

      fireEvent.click(button)
      expect(screen.getByText(/Minor format issue/)).toBeInTheDocument()
    })

    it('collapses issues on second click', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              {
                stage: 'schema',
                severity: 'warning',
                code: 'FORMAT',
                message: 'Minor format issue',
              },
            ],
          }}
        />
      )

      const button = screen.getByText('Review Recommended')

      fireEvent.click(button)
      expect(screen.getByText(/Minor format issue/)).toBeInTheDocument()

      fireEvent.click(button)
      expect(screen.queryByText(/Minor format issue/)).not.toBeInTheDocument()
    })

    it('displays stage and message for each issue', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              {
                stage: 'schema',
                severity: 'warning',
                code: 'FORMAT',
                message: 'Minor format issue',
              },
              {
                stage: 'numerical',
                severity: 'error',
                code: 'UNGROUNDED',
                message: 'Number not grounded',
              },
            ],
          }}
        />
      )

      fireEvent.click(screen.getByText('Review Recommended'))

      expect(screen.getByText(/schema:/)).toBeInTheDocument()
      expect(screen.getByText(/Minor format issue/)).toBeInTheDocument()
      expect(screen.getByText(/numerical:/)).toBeInTheDocument()
      expect(screen.getByText(/Number not grounded/)).toBeInTheDocument()
    })

    it('uses code when message is not provided', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              {
                stage: 'schema',
                severity: 'warning',
                code: 'FORMAT_ERROR',
              },
            ],
          }}
        />
      )

      fireEvent.click(screen.getByText('Review Recommended'))
      expect(screen.getByText(/FORMAT_ERROR/)).toBeInTheDocument()
    })

    it('limits display to first 3 issues', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.65,
            schema_valid: false,
            engine_validated: true,
            issues_detected: [
              { stage: 'schema', severity: 'error', code: 'ERR1', message: 'Issue 1' },
              { stage: 'schema', severity: 'error', code: 'ERR2', message: 'Issue 2' },
              { stage: 'schema', severity: 'error', code: 'ERR3', message: 'Issue 3' },
              { stage: 'schema', severity: 'error', code: 'ERR4', message: 'Issue 4' },
              { stage: 'schema', severity: 'error', code: 'ERR5', message: 'Issue 5' },
            ],
          }}
        />
      )

      fireEvent.click(screen.getByText('Verification Issues'))

      expect(screen.getByText(/Issue 1/)).toBeInTheDocument()
      expect(screen.getByText(/Issue 2/)).toBeInTheDocument()
      expect(screen.getByText(/Issue 3/)).toBeInTheDocument()
      expect(screen.queryByText(/Issue 4/)).not.toBeInTheDocument()
      expect(screen.getByText('Show all 5 issues')).toBeInTheDocument()
    })

    it('does not show expansion when no critical issues', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [{ stage: 'info', severity: 'info', code: 'INFO' }],
          }}
        />
      )

      const button = screen.getByText('Review Recommended')
      fireEvent.click(button)

      expect(screen.queryByRole('region', { name: 'Verification details' })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label on button', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.97,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      expect(screen.getByLabelText('Verification: Verified')).toBeInTheDocument()
    })

    it('expands and collapses when issues present', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              { stage: 'schema', severity: 'warning', code: 'FORMAT', message: 'Test issue' },
            ],
          }}
        />
      )

      const button = screen.getByText('Review Recommended')

      // Initially collapsed - details not visible
      expect(screen.queryByText('Test issue')).not.toBeInTheDocument()

      // After click, details should be visible
      fireEvent.click(button)
      expect(screen.getByText('Test issue')).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(button)
      expect(screen.queryByText('Test issue')).not.toBeInTheDocument()
    })

    it('does not have aria-expanded when no critical issues', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.97,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      const button = screen.getByText('Verified')
      expect(button).not.toHaveAttribute('aria-expanded')
    })

    it('marks detail region with proper role', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [
              { stage: 'schema', severity: 'warning', code: 'FORMAT' },
            ],
          }}
        />
      )

      fireEvent.click(screen.getByText('Review Recommended'))
      expect(screen.getByRole('region', { name: 'Verification details' })).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles score at exact threshold 0.95', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.95,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('handles score at exact threshold 0.80', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.80,
            schema_valid: true,
            engine_validated: true,
          }}
        />
      )

      expect(screen.getByText('Review Recommended')).toBeInTheDocument()
    })

    it('handles empty issues_detected array', () => {
      render(
        <VerificationBadge
          verification={{
            numerical_grounding_score: 0.87,
            schema_valid: true,
            engine_validated: true,
            issues_detected: [],
          }}
        />
      )

      expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
    })
  })
})
