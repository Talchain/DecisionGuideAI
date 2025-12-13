/**
 * AppliedFormsCallout Tests
 *
 * Brief 11.2: Tests for high-confidence auto-applied forms callout
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppliedFormsCallout } from '../AppliedFormsCallout'
import type { EdgeFormRecommendation } from '../types'

const mockRecommendations: EdgeFormRecommendation[] = [
  {
    edge_id: 'edge-1',
    source_label: 'Marketing Spend',
    target_label: 'Revenue',
    current_form: 'linear',
    recommended_form: 'diminishing_returns',
    form_confidence: 'high',
    rationale: 'Marketing investments typically show diminishing marginal returns',
    auto_applied: true,
    provenance: 'cee',
  },
  {
    edge_id: 'edge-2',
    source_label: 'Risk Factor',
    target_label: 'Failure Probability',
    current_form: 'linear',
    recommended_form: 'noisy_or',
    form_confidence: 'high',
    rationale: 'Multiple risk factors combine independently',
    auto_applied: true,
    provenance: 'cee',
  },
]

describe('AppliedFormsCallout', () => {
  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} />)
      expect(screen.getByTestId('applied-forms-callout')).toBeInTheDocument()
    })

    it('returns null when no forms to show', () => {
      const { container } = render(<AppliedFormsCallout appliedForms={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('shows correct count badge', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('shows singular text for one form', () => {
      render(<AppliedFormsCallout appliedForms={[mockRecommendations[0]]} />)
      expect(screen.getByText('Relationship form applied')).toBeInTheDocument()
    })

    it('shows plural text for multiple forms', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} />)
      expect(screen.getByText('2 relationship forms applied')).toBeInTheDocument()
    })
  })

  describe('Form items display', () => {
    it('shows all applied forms when expanded', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)
      expect(screen.getByTestId('applied-form-edge-1')).toBeInTheDocument()
      expect(screen.getByTestId('applied-form-edge-2')).toBeInTheDocument()
    })

    it('shows edge labels', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)
      expect(screen.getByText(/Marketing Spend.*→.*Revenue/)).toBeInTheDocument()
    })

    it('shows form names in plain language', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)
      expect(screen.getByText(/Diminishing/)).toBeInTheDocument()
    })

    it('shows rationale for each form', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)
      expect(screen.getByText(/Marketing investments typically show/)).toBeInTheDocument()
    })
  })

  describe('Expand/collapse behaviour', () => {
    it('starts collapsed by default when defaultExpanded is false', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded={false} />)
      expect(screen.queryByTestId('applied-form-edge-1')).not.toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)
      expect(screen.getByTestId('applied-form-edge-1')).toBeInTheDocument()
    })

    it('toggles expanded state on header click', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded={false} />)

      // Click to expand
      const button = screen.getByRole('button', { expanded: false })
      fireEvent.click(button)
      expect(screen.getByTestId('applied-form-edge-1')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(button)
      expect(screen.queryByTestId('applied-form-edge-1')).not.toBeInTheDocument()
    })

    it('hides toggle when collapsible is false', () => {
      render(
        <AppliedFormsCallout
          appliedForms={mockRecommendations}
          collapsible={false}
          defaultExpanded
        />
      )
      // Should not have expand/collapse button
      expect(screen.queryByRole('button', { expanded: true })).not.toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn()
      render(
        <AppliedFormsCallout
          appliedForms={mockRecommendations}
          defaultExpanded
          onConfirm={onConfirm}
        />
      )

      const confirmButtons = screen.getAllByTitle('Confirm this form')
      fireEvent.click(confirmButtons[0])

      expect(onConfirm).toHaveBeenCalledWith('edge-1')
    })

    it('calls onChange when change button is clicked', () => {
      const onChange = vi.fn()
      render(
        <AppliedFormsCallout
          appliedForms={mockRecommendations}
          defaultExpanded
          onChange={onChange}
        />
      )

      const changeButtons = screen.getAllByTitle('Change this form')
      fireEvent.click(changeButtons[0])

      expect(onChange).toHaveBeenCalledWith('edge-1')
    })

    it('calls onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn()
      render(
        <AppliedFormsCallout
          appliedForms={mockRecommendations}
          defaultExpanded
          onDismiss={onDismiss}
        />
      )

      const dismissButton = screen.getByTitle('Dismiss all')
      fireEvent.click(dismissButton)

      expect(onDismiss).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)

      const region = screen.getByRole('region', { name: /auto-applied relationship forms/i })
      expect(region).toBeInTheDocument()
    })

    it('has accessible labels for action buttons', () => {
      render(<AppliedFormsCallout appliedForms={mockRecommendations} defaultExpanded />)

      expect(screen.getAllByLabelText(/Confirm.*for/)).toHaveLength(2)
      expect(screen.getAllByLabelText(/Change form for/)).toHaveLength(2)
    })
  })
})
