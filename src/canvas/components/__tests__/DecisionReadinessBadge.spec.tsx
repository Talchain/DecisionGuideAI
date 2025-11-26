import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  DecisionReadinessBadge,
  DecisionReadinessBadgeCompact,
} from '../DecisionReadinessBadge'
import type { DecisionReadiness } from '../../../types/plot'

const mockReadyData: DecisionReadiness = {
  ready: true,
  confidence: 'high',
  blockers: [],
  warnings: ['Price sensitivity estimate based on assumptions'],
  passed: ['Identifiable causal structure', 'Good evidence coverage'],
}

const mockNotReadyData: DecisionReadiness = {
  ready: false,
  confidence: 'low',
  blockers: ['Missing treatment node', 'No outcome defined'],
  warnings: ['Limited data quality'],
  passed: ['Graph connected'],
}

describe('DecisionReadinessBadge', () => {
  describe('Ready state', () => {
    it('renders ready status with green styling', () => {
      render(<DecisionReadinessBadge readiness={mockReadyData} />)

      const badge = screen.getByTestId('decision-readiness-badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('border-green-200', 'bg-green-50/50')
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('displays high confidence indicator', () => {
      render(<DecisionReadinessBadge readiness={mockReadyData} />)

      const confidence = screen.getByTestId('confidence-indicator')
      expect(confidence).toHaveTextContent('High Confidence')
      expect(confidence).toHaveClass('text-green-700', 'bg-green-50')
    })
  })

  describe('Not Ready state', () => {
    it('renders not ready status with red styling', () => {
      render(<DecisionReadinessBadge readiness={mockNotReadyData} />)

      const badge = screen.getByTestId('decision-readiness-badge')
      expect(badge).toHaveClass('border-red-200', 'bg-red-50/50')
      expect(screen.getByText('Not Ready')).toBeInTheDocument()
    })

    it('displays low confidence indicator', () => {
      render(<DecisionReadinessBadge readiness={mockNotReadyData} />)

      const confidence = screen.getByTestId('confidence-indicator')
      expect(confidence).toHaveTextContent('Low Confidence')
      expect(confidence).toHaveClass('text-red-700', 'bg-red-50')
    })
  })

  describe('Expandable details', () => {
    it('shows details when expanded', () => {
      render(
        <DecisionReadinessBadge readiness={mockNotReadyData} defaultExpanded />
      )

      const details = screen.getByTestId('readiness-details')
      expect(details).toBeInTheDocument()

      // Check blockers
      const blockersList = screen.getByTestId('blockers-list')
      expect(blockersList).toBeInTheDocument()
      expect(screen.getByText('Missing treatment node')).toBeInTheDocument()
      expect(screen.getByText('No outcome defined')).toBeInTheDocument()

      // Check warnings
      const warningsList = screen.getByTestId('warnings-list')
      expect(warningsList).toBeInTheDocument()
      expect(screen.getByText('Limited data quality')).toBeInTheDocument()

      // Check passed
      const passedList = screen.getByTestId('passed-list')
      expect(passedList).toBeInTheDocument()
      expect(screen.getByText('Graph connected')).toBeInTheDocument()
    })

    it('toggles expansion on click', () => {
      render(<DecisionReadinessBadge readiness={mockNotReadyData} />)

      // Initially collapsed - no details visible
      expect(screen.queryByTestId('readiness-details')).not.toBeInTheDocument()

      // Click to expand
      const button = screen.getByRole('button')
      fireEvent.click(button)

      // Now details should be visible
      expect(screen.getByTestId('readiness-details')).toBeInTheDocument()

      // Click again to collapse
      fireEvent.click(button)
      expect(screen.queryByTestId('readiness-details')).not.toBeInTheDocument()
    })

    it('does not show expand button when no details', () => {
      const emptyReadiness: DecisionReadiness = {
        ready: true,
        confidence: 'high',
        blockers: [],
        warnings: [],
        passed: [],
      }

      render(<DecisionReadinessBadge readiness={emptyReadiness} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Composed badges', () => {
    it('renders IdentifiabilityBadge when provided', () => {
      render(
        <DecisionReadinessBadge
          readiness={mockReadyData}
          identifiability="identifiable"
        />
      )

      expect(screen.getByTestId('identifiability-badge')).toBeInTheDocument()
      expect(screen.getByText('Identifiable')).toBeInTheDocument()
    })

    it('renders EvidenceCoverageCompact when provided', () => {
      render(
        <DecisionReadinessBadge
          readiness={mockReadyData}
          evidenceCoverage={{ evidencedCount: 5, totalCount: 10 }}
        />
      )

      expect(screen.getByTestId('evidence-coverage-compact')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('renders both composed badges together', () => {
      render(
        <DecisionReadinessBadge
          readiness={mockReadyData}
          identifiability="identifiable"
          evidenceCoverage={{ evidencedCount: 8, totalCount: 10 }}
        />
      )

      expect(screen.getByTestId('identifiability-badge')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-coverage-compact')).toBeInTheDocument()
      expect(screen.getByText('Model checks:')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has correct role and aria-label', () => {
      render(<DecisionReadinessBadge readiness={mockReadyData} />)

      const status = screen.getByRole('status')
      expect(status).toHaveAttribute(
        'aria-label',
        'Decision readiness: Ready'
      )
    })

    it('has aria-expanded on toggle button', () => {
      render(<DecisionReadinessBadge readiness={mockNotReadyData} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('has aria-labels on lists', () => {
      render(
        <DecisionReadinessBadge readiness={mockNotReadyData} defaultExpanded />
      )

      expect(
        screen.getByRole('list', { name: 'Blockers that must be fixed' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('list', { name: 'Warnings to review' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('list', { name: 'Checks that passed' })
      ).toBeInTheDocument()
    })
  })

  describe('Medium confidence', () => {
    it('displays medium confidence with amber styling', () => {
      const mediumConfidence: DecisionReadiness = {
        ...mockReadyData,
        confidence: 'medium',
      }

      render(<DecisionReadinessBadge readiness={mediumConfidence} />)

      const confidence = screen.getByTestId('confidence-indicator')
      expect(confidence).toHaveTextContent('Medium Confidence')
      expect(confidence).toHaveClass('text-amber-700', 'bg-amber-50')
    })
  })

  it('accepts custom className', () => {
    render(
      <DecisionReadinessBadge readiness={mockReadyData} className="custom-class" />
    )

    const badge = screen.getByTestId('decision-readiness-badge')
    expect(badge).toHaveClass('custom-class')
  })
})

describe('DecisionReadinessBadgeCompact', () => {
  it('renders ready state in compact form', () => {
    render(<DecisionReadinessBadgeCompact readiness={mockReadyData} />)

    const badge = screen.getByTestId('decision-readiness-compact')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-50', 'border-green-200', 'text-green-700')
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('renders not ready state with blocker count', () => {
    render(<DecisionReadinessBadgeCompact readiness={mockNotReadyData} />)

    const badge = screen.getByTestId('decision-readiness-compact')
    expect(badge).toHaveClass('bg-red-50', 'border-red-200', 'text-red-700')
    expect(screen.getByText('Not Ready')).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument() // 2 blockers
  })

  it('has correct accessibility attributes', () => {
    render(<DecisionReadinessBadgeCompact readiness={mockReadyData} />)

    const badge = screen.getByTestId('decision-readiness-compact')
    expect(badge).toHaveAttribute('role', 'status')
    expect(badge).toHaveAttribute('aria-label', 'Decision readiness: Ready')
  })

  it('accepts custom className', () => {
    render(
      <DecisionReadinessBadgeCompact
        readiness={mockReadyData}
        className="custom-class"
      />
    )

    const badge = screen.getByTestId('decision-readiness-compact')
    expect(badge).toHaveClass('custom-class')
  })
})
