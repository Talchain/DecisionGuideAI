import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ModelQualityScore,
  ModelQualityScoreCompact,
} from '../ModelQualityScore'
import type { GraphQuality } from '../../../types/plot'

const mockGoodQuality: GraphQuality = {
  score: 0.85,
  completeness: 0.9,
  evidence_coverage: 0.8,
  balance: 0.85,
  issues_count: 0,
  recommendation: undefined,
}

const mockMediumQuality: GraphQuality = {
  score: 0.72,
  completeness: 0.85,
  evidence_coverage: 0.43,
  balance: 0.88,
  issues_count: 2,
  recommendation: 'Add evidence to strengthen key relationships',
}

const mockPoorQuality: GraphQuality = {
  score: 0.45,
  completeness: 0.5,
  evidence_coverage: 0.2,
  balance: 0.65,
  issues_count: 5,
  recommendation: 'Model needs significant improvements before analysis',
}

describe('ModelQualityScore', () => {
  describe('Good quality (>= 0.8)', () => {
    it('renders with green styling', () => {
      render(<ModelQualityScore quality={mockGoodQuality} />)

      const component = screen.getByTestId('model-quality-score')
      expect(component).toBeInTheDocument()
      expect(component).toHaveClass('border-green-200')
    })

    it('displays score as percentage', () => {
      render(<ModelQualityScore quality={mockGoodQuality} />)

      const score = screen.getByTestId('quality-score')
      expect(score).toHaveTextContent('85%')
    })

    it('does not show issues badge when zero issues', () => {
      render(<ModelQualityScore quality={mockGoodQuality} />)

      expect(screen.queryByTestId('issues-count')).not.toBeInTheDocument()
    })
  })

  describe('Medium quality (>= 0.6)', () => {
    it('renders with amber styling', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      const component = screen.getByTestId('model-quality-score')
      expect(component).toHaveClass('border-amber-200')
    })

    it('displays score as percentage', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      const score = screen.getByTestId('quality-score')
      expect(score).toHaveTextContent('72%')
    })

    it('shows issues count badge', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      const issuesBadge = screen.getByTestId('issues-count')
      expect(issuesBadge).toHaveTextContent('2 issues')
    })
  })

  describe('Poor quality (< 0.6)', () => {
    it('renders with red styling', () => {
      render(<ModelQualityScore quality={mockPoorQuality} />)

      const component = screen.getByTestId('model-quality-score')
      expect(component).toHaveClass('border-red-200')
    })

    it('displays score as percentage', () => {
      render(<ModelQualityScore quality={mockPoorQuality} />)

      const score = screen.getByTestId('quality-score')
      expect(score).toHaveTextContent('45%')
    })

    it('shows issues count with correct pluralization for many', () => {
      render(<ModelQualityScore quality={mockPoorQuality} />)

      const issuesBadge = screen.getByTestId('issues-count')
      expect(issuesBadge).toHaveTextContent('5 issues')
    })
  })

  describe('Single issue pluralization', () => {
    it('shows singular "issue" for 1 issue', () => {
      const singleIssue: GraphQuality = {
        ...mockMediumQuality,
        issues_count: 1,
      }
      render(<ModelQualityScore quality={singleIssue} />)

      const issuesBadge = screen.getByTestId('issues-count')
      expect(issuesBadge).toHaveTextContent('1 issue')
      expect(issuesBadge).not.toHaveTextContent('1 issues')
    })
  })

  describe('Expandable details', () => {
    it('shows sub-metrics when expanded', () => {
      render(<ModelQualityScore quality={mockMediumQuality} defaultExpanded />)

      const details = screen.getByTestId('quality-details')
      expect(details).toBeInTheDocument()

      expect(screen.getByText('Completeness')).toBeInTheDocument()
      expect(screen.getByText('Evidence Coverage')).toBeInTheDocument()
      expect(screen.getByText('Balance')).toBeInTheDocument()

      // Check percentage values
      expect(screen.getByText('85%')).toBeInTheDocument() // completeness
      expect(screen.getByText('43%')).toBeInTheDocument() // evidence_coverage
      expect(screen.getByText('88%')).toBeInTheDocument() // balance
    })

    it('toggles expansion on click', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      // Initially collapsed
      expect(screen.queryByTestId('quality-details')).not.toBeInTheDocument()

      // Click to expand
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Now visible
      expect(screen.getByTestId('quality-details')).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(button)
      expect(screen.queryByTestId('quality-details')).not.toBeInTheDocument()
    })

    it('shows recommendation when present', () => {
      render(<ModelQualityScore quality={mockMediumQuality} defaultExpanded />)

      const recommendation = screen.getByTestId('quality-recommendation')
      expect(recommendation).toBeInTheDocument()
      expect(
        screen.getByText('Add evidence to strengthen key relationships')
      ).toBeInTheDocument()
    })

    it('does not show recommendation section when not present', () => {
      render(<ModelQualityScore quality={mockGoodQuality} defaultExpanded />)

      expect(
        screen.queryByTestId('quality-recommendation')
      ).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has correct aria-label on score', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      const score = screen.getByTestId('quality-score')
      expect(score).toHaveAttribute(
        'aria-label',
        'Model quality score: 72%'
      )
      expect(score).toHaveAttribute('role', 'status')
    })

    it('has aria-expanded on toggle button', () => {
      render(<ModelQualityScore quality={mockMediumQuality} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('has progressbar role on sub-metric bars', () => {
      render(<ModelQualityScore quality={mockMediumQuality} defaultExpanded />)

      const progressBars = screen.getAllByRole('progressbar')
      expect(progressBars.length).toBeGreaterThanOrEqual(3) // completeness, evidence, balance
    })
  })

  it('accepts custom className', () => {
    render(
      <ModelQualityScore quality={mockGoodQuality} className="custom-class" />
    )

    const component = screen.getByTestId('model-quality-score')
    expect(component).toHaveClass('custom-class')
  })
})

describe('ModelQualityScoreCompact', () => {
  it('renders score in compact form', () => {
    render(<ModelQualityScoreCompact quality={mockGoodQuality} />)

    const badge = screen.getByTestId('model-quality-compact')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('border-green-200', 'bg-green-50', 'text-green-700')
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('shows issues count inline', () => {
    render(<ModelQualityScoreCompact quality={mockMediumQuality} />)

    const badge = screen.getByTestId('model-quality-compact')
    expect(badge).toHaveClass('border-amber-200')
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // issues count
  })

  it('does not show issues badge when zero', () => {
    render(<ModelQualityScoreCompact quality={mockGoodQuality} />)

    // Only the percentage should be present, no issues badge
    const badge = screen.getByTestId('model-quality-compact')
    expect(badge).toHaveTextContent('85%')
    expect(badge.querySelectorAll('span').length).toBe(1) // only the percentage span
  })

  it('has correct accessibility attributes', () => {
    render(<ModelQualityScoreCompact quality={mockMediumQuality} />)

    const badge = screen.getByTestId('model-quality-compact')
    expect(badge).toHaveAttribute('role', 'status')
    expect(badge).toHaveAttribute('aria-label', 'Model quality: 72%')
  })

  it('accepts custom className', () => {
    render(
      <ModelQualityScoreCompact
        quality={mockGoodQuality}
        className="custom-class"
      />
    )

    const badge = screen.getByTestId('model-quality-compact')
    expect(badge).toHaveClass('custom-class')
  })
})
