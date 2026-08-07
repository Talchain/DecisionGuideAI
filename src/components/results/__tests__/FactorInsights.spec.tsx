/**
 * FactorInsights Component Tests
 *
 * Tests for CEE-generated enrichment display in factor cards.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FactorInsights, hasEnrichmentContent } from '../FactorInsights'
import type { FactorEnrichment } from '../../../lib/mappers/types'

// Test fixtures
const enrichmentWithObservationsOnly: FactorEnrichment = {
  factor_id: 'f1',
  factor_label: 'Price',
  observations: ['High impact on market share', 'Seasonal variation observed'],
  perspectives: [],
}

const enrichmentWithPerspectivesOnly: FactorEnrichment = {
  factor_id: 'f2',
  factor_label: 'Volume',
  observations: [],
  perspectives: ['May vary by region', 'Consider long-term trends'],
}

const enrichmentWithConfidenceQuestion: FactorEnrichment = {
  factor_id: 'f3',
  factor_label: 'Cost',
  observations: ['Rank 1 driver'],
  perspectives: ['Consider alternatives'],
  confidence_question: 'How confident are you in this assumption?',
}

const enrichmentWithEmptyArrays: FactorEnrichment = {
  factor_id: 'f4',
  factor_label: 'Empty',
  observations: [],
  perspectives: [],
}

const enrichmentComplete: FactorEnrichment = {
  factor_id: 'f5',
  factor_label: 'Complete',
  observations: ['First observation', 'Second observation'],
  perspectives: ['First perspective'],
  confidence_question: 'Are you sure about this?',
}

describe('FactorInsights', () => {
  describe('hasEnrichmentContent helper', () => {
    it('returns false for undefined enrichment', () => {
      expect(hasEnrichmentContent(undefined)).toBe(false)
    })

    it('returns false when both arrays are empty', () => {
      expect(hasEnrichmentContent(enrichmentWithEmptyArrays)).toBe(false)
    })

    it('returns true when observations has content', () => {
      expect(hasEnrichmentContent(enrichmentWithObservationsOnly)).toBe(true)
    })

    it('returns true when perspectives has content', () => {
      expect(hasEnrichmentContent(enrichmentWithPerspectivesOnly)).toBe(true)
    })

    it('returns true when both arrays have content', () => {
      expect(hasEnrichmentContent(enrichmentComplete)).toBe(true)
    })

    it('returns true when only confidence_question has content', () => {
      const enrichmentWithQuestionOnly = {
        factor_id: 'f6',
        factor_label: 'Question Only',
        observations: [],
        perspectives: [],
        confidence_question: 'How sure are you about this?',
      }
      expect(hasEnrichmentContent(enrichmentWithQuestionOnly)).toBe(true)
    })

    it('returns false when confidence_question is empty string', () => {
      const enrichmentWithEmptyQuestion = {
        factor_id: 'f7',
        factor_label: 'Empty Question',
        observations: [],
        perspectives: [],
        confidence_question: '   ',  // Whitespace only
      }
      expect(hasEnrichmentContent(enrichmentWithEmptyQuestion)).toBe(false)
    })
  })

  describe('rendering', () => {
    it('renders when enrichment has observations', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)
      expect(screen.getByRole('button', { name: /insights/i })).toBeInTheDocument()
    })

    it('renders when enrichment has perspectives', () => {
      render(<FactorInsights enrichment={enrichmentWithPerspectivesOnly} />)
      expect(screen.getByRole('button', { name: /insights/i })).toBeInTheDocument()
    })

    it('does not render when both arrays are empty', () => {
      const { container } = render(<FactorInsights enrichment={enrichmentWithEmptyArrays} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('collapsed state', () => {
    it('is collapsed by default', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      // Content should not be visible initially
      expect(screen.queryByText('High impact on market share')).not.toBeInTheDocument()
    })

    it('has aria-expanded=false when collapsed', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('expansion', () => {
    it('expands on click', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })
      fireEvent.click(button)

      // Content should now be visible
      expect(screen.getByText('High impact on market share')).toBeInTheDocument()
    })

    it('has aria-expanded=true when expanded', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })
      fireEvent.click(button)

      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('collapses on second click', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })

      // Expand
      fireEvent.click(button)
      expect(screen.getByText('High impact on market share')).toBeInTheDocument()

      // Collapse
      fireEvent.click(button)
      expect(screen.queryByText('High impact on market share')).not.toBeInTheDocument()
    })
  })

  describe('observations display', () => {
    it('renders observations as list items when expanded', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.getByText('High impact on market share')).toBeInTheDocument()
      expect(screen.getByText('Seasonal variation observed')).toBeInTheDocument()
    })

    it('renders Observations heading when observations present', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.getByText('Observations')).toBeInTheDocument()
    })
  })

  describe('perspectives display', () => {
    it('renders perspectives as list items when expanded', () => {
      render(<FactorInsights enrichment={enrichmentWithPerspectivesOnly} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.getByText('May vary by region')).toBeInTheDocument()
      expect(screen.getByText('Consider long-term trends')).toBeInTheDocument()
    })

    it('renders Perspectives heading when perspectives present', () => {
      render(<FactorInsights enrichment={enrichmentWithPerspectivesOnly} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.getByText('Perspectives')).toBeInTheDocument()
    })
  })

  describe('confidence question callout', () => {
    it('renders confidence question when present', () => {
      render(<FactorInsights enrichment={enrichmentWithConfidenceQuestion} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.getByText('How confident are you in this assumption?')).toBeInTheDocument()
    })

    it('does not render callout when confidence_question is undefined', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(screen.queryByText(/confident/i)).not.toBeInTheDocument()
    })

    it('does not render callout when confidence_question is empty string', () => {
      // POSITIVE CONTROL FIRST. This assertion used to query '.bg-info-50' —
      // a class FactorInsights has never rendered (it uses the documented
      // bg-panel + border-info/30 recipe), so the count was 0 whatever the
      // component did and the test proved nothing. Prove the selector can SEE
      // a callout before asserting its absence.
      const calloutSelector = '.border-info\\/30'

      const { unmount } = render(<FactorInsights enrichment={enrichmentWithConfidenceQuestion} />)
      fireEvent.click(screen.getByRole('button', { name: /insights/i }))
      expect(document.querySelectorAll(calloutSelector).length).toBe(1)
      unmount()

      const enrichmentWithEmptyQuestion: FactorEnrichment = {
        ...enrichmentWithObservationsOnly,
        confidence_question: '',
      }

      render(<FactorInsights enrichment={enrichmentWithEmptyQuestion} />)
      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      expect(document.querySelectorAll(calloutSelector).length).toBe(0)
    })
  })

  describe('accessibility', () => {
    it('toggle button has aria-controls attribute', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })
      expect(button).toHaveAttribute('aria-controls')
    })

    it('content region has matching id for aria-controls', () => {
      render(<FactorInsights enrichment={enrichmentWithObservationsOnly} />)

      const button = screen.getByRole('button', { name: /insights/i })
      fireEvent.click(button)

      const controlledId = button.getAttribute('aria-controls')
      expect(document.getElementById(controlledId!)).toBeInTheDocument()
    })
  })

  describe('complete enrichment', () => {
    it('renders all sections when all data present', () => {
      render(<FactorInsights enrichment={enrichmentComplete} />)

      fireEvent.click(screen.getByRole('button', { name: /insights/i }))

      // Observations
      expect(screen.getByText('Observations')).toBeInTheDocument()
      expect(screen.getByText('First observation')).toBeInTheDocument()
      expect(screen.getByText('Second observation')).toBeInTheDocument()

      // Perspectives
      expect(screen.getByText('Perspectives')).toBeInTheDocument()
      expect(screen.getByText('First perspective')).toBeInTheDocument()

      // Confidence question
      expect(screen.getByText('Are you sure about this?')).toBeInTheDocument()
    })
  })
})
