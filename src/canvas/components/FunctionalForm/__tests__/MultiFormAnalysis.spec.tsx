/**
 * MultiFormAnalysis Tests
 *
 * Brief 11.7: Tests for form sensitivity analysis panel
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiFormAnalysis } from '../MultiFormAnalysis'
import type { FormSensitivityResult } from '../types'

const mockResults: FormSensitivityResult[] = [
  {
    edge_id: 'edge-1',
    source_label: 'Marketing Spend',
    target_label: 'Revenue',
    form_used: 'linear',
    alternative_form: 'diminishing_returns',
    impact_pct: -15.5,
    causes_flip: false,
    impact_description: 'Using diminishing returns reduces expected revenue by 15.5%',
  },
  {
    edge_id: 'edge-2',
    source_label: 'Risk Factor',
    target_label: 'Failure',
    form_used: 'linear',
    alternative_form: 'noisy_or',
    impact_pct: 25.3,
    causes_flip: true,
    impact_description: 'Using noisy-or increases failure probability significantly',
  },
  {
    edge_id: 'edge-3',
    source_label: 'Quality',
    target_label: 'Customer Satisfaction',
    form_used: 'linear',
    alternative_form: 's_curve',
    impact_pct: 3.2,
    causes_flip: false,
  },
]

describe('MultiFormAnalysis', () => {
  describe('Basic rendering', () => {
    it('renders without crashing', () => {
      render(<MultiFormAnalysis results={[]} />)
      expect(screen.getByTestId('multi-form-analysis')).toBeInTheDocument()
    })

    it('shows header with title', () => {
      render(<MultiFormAnalysis results={[]} />)
      expect(screen.getByText('Form Sensitivity Analysis')).toBeInTheDocument()
    })

    it('shows run analysis button', () => {
      const onRunAnalysis = vi.fn()
      render(<MultiFormAnalysis results={[]} onRunAnalysis={onRunAnalysis} />)
      expect(screen.getByRole('button', { name: /Run Analysis/i })).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no results', () => {
      render(<MultiFormAnalysis results={[]} />)
      expect(screen.getByText(/Run analysis to test/)).toBeInTheDocument()
    })

    it('shows empty state explanation', () => {
      render(<MultiFormAnalysis results={[]} />)
      expect(screen.getByText(/identify which relationships/)).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    it('shows loading state', () => {
      render(<MultiFormAnalysis results={[]} loading />)
      expect(screen.getByText(/Testing alternative forms/)).toBeInTheDocument()
    })

    it('disables run button when loading', () => {
      const onRunAnalysis = vi.fn()
      render(<MultiFormAnalysis results={[]} loading onRunAnalysis={onRunAnalysis} />)
      expect(screen.getByRole('button', { name: /Analysing/i })).toBeDisabled()
    })
  })

  describe('Error state', () => {
    it('shows error message', () => {
      render(<MultiFormAnalysis results={[]} error="Failed to analyse forms" />)
      expect(screen.getByText('Failed to analyse forms')).toBeInTheDocument()
    })
  })

  describe('Results display', () => {
    it('shows all significant results', () => {
      render(<MultiFormAnalysis results={mockResults} />)

      // Significant results (>5% impact or causes flip)
      expect(screen.getByTestId('sensitivity-result-edge-1')).toBeInTheDocument()
      expect(screen.getByTestId('sensitivity-result-edge-2')).toBeInTheDocument()

      // Low impact result should be hidden by default
      expect(screen.queryByTestId('sensitivity-result-edge-3')).not.toBeInTheDocument()
    })

    it('shows edge labels', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/Marketing Spend.*→.*Revenue/)).toBeInTheDocument()
    })

    it('shows form transition', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      // Multiple results may have "Proportional" (linear form)
      expect(screen.getAllByText('Proportional').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Diminishing')).toBeInTheDocument() // alternative
    })

    it('shows impact percentage', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/-15\.5%/)).toBeInTheDocument()
    })

    it('shows impact description when available', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/Using diminishing returns reduces/)).toBeInTheDocument()
    })
  })

  describe('Flip warning', () => {
    it('shows flip warning for results that cause flip', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/would change the recommended option/)).toBeInTheDocument()
    })

    it('shows flip count in summary', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/1 potential flip/)).toBeInTheDocument()
    })
  })

  describe('Impact classification', () => {
    it('shows high impact count', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/1 high impact/)).toBeInTheDocument()
    })

    it('shows total edges tested', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/3 edges tested/)).toBeInTheDocument()
    })
  })

  describe('Show all toggle', () => {
    it('shows "Show all" button when there are hidden results', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/Show all 3 results/)).toBeInTheDocument()
    })

    it('shows all results when toggled', () => {
      render(<MultiFormAnalysis results={mockResults} />)

      fireEvent.click(screen.getByText(/Show all 3 results/))

      expect(screen.getByTestId('sensitivity-result-edge-3')).toBeInTheDocument()
    })

    it('shows "Show only significant" when expanded', () => {
      render(<MultiFormAnalysis results={mockResults} />)

      fireEvent.click(screen.getByText(/Show all 3 results/))

      expect(screen.getByText(/Show only significant/)).toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('calls onRunAnalysis when button is clicked', () => {
      const onRunAnalysis = vi.fn()
      render(<MultiFormAnalysis results={[]} onRunAnalysis={onRunAnalysis} />)

      fireEvent.click(screen.getByRole('button', { name: /Run Analysis/i }))

      expect(onRunAnalysis).toHaveBeenCalled()
    })

    it('calls onApplyAlternative when apply link is clicked', () => {
      const onApplyAlternative = vi.fn()
      render(
        <MultiFormAnalysis
          results={mockResults}
          onApplyAlternative={onApplyAlternative}
        />
      )

      const applyLinks = screen.getAllByText(/Apply.*to this edge/)
      fireEvent.click(applyLinks[0])

      expect(onApplyAlternative).toHaveBeenCalledWith('edge-1', 'diminishing_returns')
    })
  })

  describe('Pluralisation', () => {
    it('shows singular "flip" for one flip', () => {
      render(<MultiFormAnalysis results={mockResults} />)
      expect(screen.getByText(/1 potential flip$/)).toBeInTheDocument()
    })

    it('shows plural "flips" for multiple flips', () => {
      const multiFlipResults = [
        { ...mockResults[1] },
        { ...mockResults[1], edge_id: 'edge-4' },
      ]
      render(<MultiFormAnalysis results={multiFlipResults} />)
      expect(screen.getByText(/2 potential flips/)).toBeInTheDocument()
    })

    it('shows singular "edge" for one edge', () => {
      render(<MultiFormAnalysis results={[mockResults[0]]} />)
      expect(screen.getByText(/1 edge tested/)).toBeInTheDocument()
    })
  })
})
