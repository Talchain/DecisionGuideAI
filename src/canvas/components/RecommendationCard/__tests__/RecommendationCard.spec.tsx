/**
 * RecommendationCard Tests
 *
 * Tests for the Phase 4 CEE-powered Recommendation Card component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecommendationCard } from '../index'
import type { GenerateRecommendationResponse } from '../types'

// Mock the canvas store
const mockSetHighlightedNodes = vi.fn()
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = {
      nodes: [
        { id: 'option-1', type: 'option', data: { label: 'Option A' } },
        { id: 'option-2', type: 'option', data: { label: 'Option B' } },
      ],
      edges: [
        { id: 'edge-1', source: 'option-1', target: 'outcome-1' },
      ],
      results: {
        runId: 'test-run-123',
        report: {
          results: { conservative: 20, likely: 50, optimistic: 80 },
          confidence: { level: 'medium', why: 'Test confidence' },
          drivers: [{ label: 'Revenue', strength: 'high', polarity: 'up' }],
          model_card: { response_hash: 'hash-123' },
        },
      },
      comparisonMode: null,
      setHighlightedNodes: mockSetHighlightedNodes,
    }
    return selector(state)
  }),
}))

// Mock the useRecommendation hook
const mockFetchRecommendation = vi.fn()
vi.mock('../../../hooks/useRecommendation', () => ({
  useRecommendation: vi.fn(() => ({
    recommendation: null,
    loading: false,
    error: null,
    fetch: mockFetchRecommendation,
    clear: vi.fn(),
  })),
}))

// Get the mocked module
import { useRecommendation } from '../../../hooks/useRecommendation'
const mockedUseRecommendation = vi.mocked(useRecommendation)

// Sample recommendation response
const mockRecommendation: GenerateRecommendationResponse = {
  recommendation: {
    headline: 'Proceed with Option A',
    confidence: 'high',
    summary: 'Option A offers the best expected outcome with high confidence based on the analysis.',
  },
  reasoning: {
    primary_drivers: [
      {
        factor: 'Revenue Potential',
        edge_id: 'edge-1',
        contribution: 'high',
        explanation: 'Higher revenue due to market positioning',
        node_id: 'option-1',
      },
      {
        factor: 'Cost Efficiency',
        edge_id: 'edge-2',
        contribution: 'medium',
        explanation: 'Lower operational costs',
      },
    ],
    key_tradeoffs: [
      {
        description: 'Higher upfront investment required',
        severity: 'medium',
        alternative_benefits: 'Option B requires less initial capital',
      },
    ],
    assumptions: [
      {
        description: 'Market conditions remain stable',
        criticality: 'critical',
        edge_id: 'edge-3',
        validation_suggestion: 'Monitor market indicators quarterly',
      },
      {
        description: 'Team capacity is available',
        criticality: 'important',
        validation_suggestion: 'Confirm with HR',
      },
    ],
    validation_steps: [
      {
        action: 'Review market analysis',
        rationale: 'Ensures assumptions are current',
        effort: 'medium',
      },
    ],
  },
  provenance: 'cee',
}

describe('RecommendationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseRecommendation.mockReturnValue({
      recommendation: null,
      loading: false,
      error: null,
      fetch: mockFetchRecommendation,
      clear: vi.fn(),
    })
  })

  describe('Loading State', () => {
    it('renders loading state when fetching recommendation', () => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: null,
        loading: true,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })

      render(<RecommendationCard />)

      expect(screen.getByTestId('recommendation-card-loading')).toBeInTheDocument()
      expect(screen.getByText('Generating recommendation...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('renders error state with retry button', () => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: null,
        loading: false,
        error: 'Failed to fetch',
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })

      render(<RecommendationCard />)

      expect(screen.getByTestId('recommendation-card-error')).toBeInTheDocument()
      expect(screen.getByText('Could not generate recommendation')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('calls fetch when retry button is clicked', () => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: null,
        loading: false,
        error: 'Failed to fetch',
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })

      render(<RecommendationCard />)

      fireEvent.click(screen.getByText('Retry'))
      expect(mockFetchRecommendation).toHaveBeenCalled()
    })
  })

  describe('Recommendation Display', () => {
    beforeEach(() => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: mockRecommendation,
        loading: false,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })
    })

    it('renders recommendation card with headline', () => {
      render(<RecommendationCard />)

      expect(screen.getByTestId('recommendation-card')).toBeInTheDocument()
      expect(screen.getByText('Proceed with Option A')).toBeInTheDocument()
    })

    it('displays confidence indicator', () => {
      render(<RecommendationCard />)

      expect(screen.getByText('Confidence:')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
    })

    it('displays recommendation summary', () => {
      render(<RecommendationCard />)

      expect(screen.getByText(/Option A offers the best expected outcome/)).toBeInTheDocument()
    })

    it('displays AI badge', () => {
      render(<RecommendationCard />)

      expect(screen.getByText('Recommended Action')).toBeInTheDocument()
    })
  })

  describe('Expandable Sections', () => {
    beforeEach(() => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: mockRecommendation,
        loading: false,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })
    })

    it('renders all expandable sections', () => {
      render(<RecommendationCard />)

      expect(screen.getByText('Why this option')).toBeInTheDocument()
      expect(screen.getByText("What you're trading off")).toBeInTheDocument()
      expect(screen.getByText('Assumptions to validate')).toBeInTheDocument()
      expect(screen.getByText('When to reconsider')).toBeInTheDocument()
    })

    it('shows badge count for drivers section', () => {
      render(<RecommendationCard />)

      // Should show "2" for 2 drivers
      const driverSection = screen.getByTestId('section-drivers')
      expect(driverSection).toHaveTextContent('2')
    })

    it('shows badge count with critical variant for assumptions', () => {
      render(<RecommendationCard />)

      // Should show "1" for 1 critical assumption (critical ones take priority in badge)
      const assumptionSection = screen.getByTestId('section-assumptions')
      expect(assumptionSection).toHaveTextContent('1')
    })

    it('expands section when clicked', () => {
      render(<RecommendationCard />)

      // Click on "Why this option" section
      fireEvent.click(screen.getByText('Why this option'))

      // Should now show driver content
      expect(screen.getByText('Revenue Potential')).toBeInTheDocument()
      expect(screen.getByText('Higher revenue due to market positioning')).toBeInTheDocument()
    })
  })

  describe('Driver Interactions', () => {
    beforeEach(() => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: mockRecommendation,
        loading: false,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })
    })

    it('calls onDriverClick when driver is clicked', () => {
      const onDriverClick = vi.fn()
      render(<RecommendationCard onDriverClick={onDriverClick} />)

      // Expand the drivers section
      fireEvent.click(screen.getByText('Why this option'))

      // Click on a driver
      fireEvent.click(screen.getByText('Revenue Potential'))

      // Callback should not be called directly (goes through store)
      // But setHighlightedNodes should be called
      expect(mockSetHighlightedNodes).toHaveBeenCalledWith(['option-1'])
    })
  })

  describe('Action Buttons', () => {
    beforeEach(() => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: mockRecommendation,
        loading: false,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })
    })

    // Compare All Options button was moved to DecisionSummary (Task 2.3: Unify compare CTAs)
    // Tests for Compare button removed - Compare CTA now in DecisionSummary only

    it('renders Validate Assumptions button when assumptions exist', () => {
      const onValidateClick = vi.fn()
      render(<RecommendationCard onValidateClick={onValidateClick} />)

      expect(screen.getByText('Validate Assumptions')).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('returns null when no recommendation and not loading/error', () => {
      mockedUseRecommendation.mockReturnValue({
        recommendation: null,
        loading: false,
        error: null,
        fetch: mockFetchRecommendation,
        clear: vi.fn(),
      })

      const { container } = render(<RecommendationCard />)
      expect(container.firstChild).toBeNull()
    })
  })
})

describe('ExpandableSection', () => {
  it('toggles expanded state on click', async () => {
    mockedUseRecommendation.mockReturnValue({
      recommendation: mockRecommendation,
      loading: false,
      error: null,
      fetch: mockFetchRecommendation,
      clear: vi.fn(),
    })

    render(<RecommendationCard />)

    // Initially collapsed - content not visible
    expect(screen.queryByText('Revenue Potential')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByText('Why this option'))

    // Now content should be visible
    await waitFor(() => {
      expect(screen.getByText('Revenue Potential')).toBeInTheDocument()
    })

    // Click again to collapse
    fireEvent.click(screen.getByText('Why this option'))

    // Content should be hidden again
    await waitFor(() => {
      expect(screen.queryByText('Revenue Potential')).not.toBeInTheDocument()
    })
  })
})
