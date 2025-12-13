/**
 * FormSuggestionBadge Tests
 *
 * Brief 11.3: Tests for medium-confidence suggestion badges
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormSuggestionBadge } from '../FormSuggestionBadge'
import type { EdgeFormRecommendation } from '../types'

const mockRecommendation: EdgeFormRecommendation = {
  edge_id: 'edge-1',
  source_label: 'Marketing Spend',
  target_label: 'Revenue',
  current_form: 'linear',
  recommended_form: 'diminishing_returns',
  form_confidence: 'medium',
  rationale: 'Marketing investments typically show diminishing marginal returns over time',
  auto_applied: false,
  provenance: 'cee',
}

describe('FormSuggestionBadge', () => {
  describe('Compact mode', () => {
    it('renders compact badge', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} compact />)
      expect(screen.getByTestId('form-suggestion-badge-edge-1')).toBeInTheDocument()
    })

    it('shows form name in compact mode', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} compact />)
      expect(screen.getByText('Diminishing')).toBeInTheDocument()
    })

    it('has apply and dismiss buttons in compact mode', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} compact />)
      expect(screen.getByLabelText(/Apply Diminishing/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Dismiss suggestion/)).toBeInTheDocument()
    })
  })

  describe('Full mode', () => {
    it('renders full badge by default', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.getByTestId('form-suggestion-badge-edge-1')).toBeInTheDocument()
    })

    it('shows suggestion header with form name', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      // "Suggestion: Use" and "Diminishing" are in separate elements
      expect(screen.getByText(/Suggestion: Use/)).toBeInTheDocument()
      expect(screen.getByText('Diminishing')).toBeInTheDocument()
    })

    it('shows edge labels', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.getByText(/Marketing Spend.*→.*Revenue/)).toBeInTheDocument()
    })

    it('has Apply button', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      // Button has aria-label="Apply Diminishing" but visible text is "Apply"
      expect(screen.getByText('Apply')).toBeInTheDocument()
    })

    it('has dismiss button', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.getByLabelText('Dismiss suggestion')).toBeInTheDocument()
    })
  })

  describe('Rationale toggle', () => {
    it('hides rationale by default', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.queryByText(mockRecommendation.rationale)).not.toBeInTheDocument()
    })

    it('shows rationale toggle button', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.getByText('Why this form?')).toBeInTheDocument()
    })

    it('shows rationale when toggled', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)

      fireEvent.click(screen.getByText('Why this form?'))

      expect(screen.getByText(mockRecommendation.rationale)).toBeInTheDocument()
    })

    it('hides rationale when toggled again', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)

      // Show
      fireEvent.click(screen.getByText('Why this form?'))
      expect(screen.getByText(mockRecommendation.rationale)).toBeInTheDocument()

      // Hide
      fireEvent.click(screen.getByText('Hide rationale'))
      expect(screen.queryByText(mockRecommendation.rationale)).not.toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('calls onApply with edge ID and form when Apply is clicked', () => {
      const onApply = vi.fn()
      render(<FormSuggestionBadge recommendation={mockRecommendation} onApply={onApply} />)

      // Button has aria-label="Apply Diminishing"
      fireEvent.click(screen.getByLabelText(/Apply Diminishing/))

      expect(onApply).toHaveBeenCalledWith('edge-1', 'diminishing_returns')
    })

    it('calls onApply in compact mode', () => {
      const onApply = vi.fn()
      render(<FormSuggestionBadge recommendation={mockRecommendation} onApply={onApply} compact />)

      fireEvent.click(screen.getByLabelText(/Apply Diminishing/))

      expect(onApply).toHaveBeenCalledWith('edge-1', 'diminishing_returns')
    })

    it('calls onDismiss when dismiss is clicked', () => {
      const onDismiss = vi.fn()
      render(<FormSuggestionBadge recommendation={mockRecommendation} onDismiss={onDismiss} />)

      fireEvent.click(screen.getByLabelText('Dismiss suggestion'))

      expect(onDismiss).toHaveBeenCalledWith('edge-1')
    })

    it('calls onDismiss in compact mode', () => {
      const onDismiss = vi.fn()
      render(<FormSuggestionBadge recommendation={mockRecommendation} onDismiss={onDismiss} compact />)

      fireEvent.click(screen.getByLabelText('Dismiss suggestion'))

      expect(onDismiss).toHaveBeenCalledWith('edge-1')
    })
  })

  describe('Different form types', () => {
    it('shows correct name for threshold form', () => {
      const rec = { ...mockRecommendation, recommended_form: 'threshold' as const }
      render(<FormSuggestionBadge recommendation={rec} />)
      expect(screen.getByText(/Threshold/)).toBeInTheDocument()
    })

    it('shows correct name for s_curve form', () => {
      const rec = { ...mockRecommendation, recommended_form: 's_curve' as const }
      render(<FormSuggestionBadge recommendation={rec} />)
      expect(screen.getByText(/Adoption curve/)).toBeInTheDocument()
    })

    it('shows correct name for noisy_or form', () => {
      const rec = { ...mockRecommendation, recommended_form: 'noisy_or' as const }
      render(<FormSuggestionBadge recommendation={rec} />)
      expect(screen.getByText(/Combined causes/)).toBeInTheDocument()
    })

    it('shows correct name for logistic form', () => {
      const rec = { ...mockRecommendation, recommended_form: 'logistic' as const }
      render(<FormSuggestionBadge recommendation={rec} />)
      expect(screen.getByText(/Tipping point/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has accessible badge region', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      expect(screen.getByRole('region', { name: 'Form suggestion' })).toBeInTheDocument()
    })

    it('has ARIA expanded attribute on rationale toggle', () => {
      render(<FormSuggestionBadge recommendation={mockRecommendation} />)
      const toggle = screen.getByText('Why this form?')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(toggle)
      expect(screen.getByText('Hide rationale')).toHaveAttribute('aria-expanded', 'true')
    })
  })
})
