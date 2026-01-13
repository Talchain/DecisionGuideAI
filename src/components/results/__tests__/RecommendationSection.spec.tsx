/**
 * RecommendationSection Tests
 *
 * Tests for the recommendation display with range bar and option comparison.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecommendationSection } from '../RecommendationSection'
import type { RecommendationSectionData } from '../types'

// Mock focusNodeById
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

describe('RecommendationSection', () => {
  const mockData: RecommendationSectionData = {
    recommendedOption: {
      id: 'option-1',
      label: 'Hire Tech Lead',
      p10: 0.23,
      p50: 0.58,
      p90: 0.81,
      isRecommended: true,
      winProbability: 0.67,
    },
    allOptions: [
      {
        id: 'option-1',
        label: 'Hire Tech Lead',
        p10: 0.23,
        p50: 0.58,
        p90: 0.81,
        isRecommended: true,
        winProbability: 0.67,
      },
      {
        id: 'option-2',
        label: 'Hire 2 Developers',
        p10: 0.18,
        p50: 0.41,
        p90: 0.68,
        isRecommended: false,
        winProbability: 0.33,
      },
    ],
    goalLabel: 'increase revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
  }

  it('renders best estimate headline', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText(/Best estimate:/)).toBeInTheDocument()
    // Goal label removed from headline per Polish F - now shows only "~58% improvement"
    expect(screen.getByText(/~58% improvement/)).toBeInTheDocument()
  })

  it('renders probability range labels', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText('Worse')).toBeInTheDocument()
    expect(screen.getByText('Expected')).toBeInTheDocument()
    expect(screen.getByText('Better')).toBeInTheDocument()
  })

  it('renders p10, p50, p90 values', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText('23%')).toBeInTheDocument()
    expect(screen.getByText('58%')).toBeInTheDocument()
    expect(screen.getByText('81%')).toBeInTheDocument()
  })

  it('renders option comparison when multiple exist', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText('How this compares:')).toBeInTheDocument()
    expect(screen.getByText('Hire Tech Lead')).toBeInTheDocument()
    expect(screen.getByText('Hire 2 Developers')).toBeInTheDocument()
  })

  it('renders Recommended badge for top option', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('hides option comparison for single option', () => {
    const singleOptionData: RecommendationSectionData = {
      ...mockData,
      allOptions: [mockData.allOptions[0]],
      isSingleOption: true,
    }

    render(<RecommendationSection data={singleOptionData} />)

    expect(screen.queryByText('How this compares:')).not.toBeInTheDocument()
    expect(screen.getByText(/Add another option/)).toBeInTheDocument()
  })

  it('renders error state when analysis failed', () => {
    const errorData: RecommendationSectionData = {
      ...mockData,
      analysisStatus: 'failed',
      statusReason: 'Model has numerical instability',
    }

    render(<RecommendationSection data={errorData} />)

    expect(screen.getByText('Analysis could not complete')).toBeInTheDocument()
    expect(screen.getByText('Model has numerical instability')).toBeInTheDocument()
  })

  it('renders blocked state', () => {
    const blockedData: RecommendationSectionData = {
      ...mockData,
      analysisStatus: 'blocked',
      statusReason: 'Missing required nodes',
    }

    render(<RecommendationSection data={blockedData} />)

    expect(screen.getByText('Analysis could not complete')).toBeInTheDocument()
    expect(screen.getByText('Missing required nodes')).toBeInTheDocument()
  })

  it('renders pre-run state when no recommendation', () => {
    const preRunData: RecommendationSectionData = {
      recommendedOption: null,
      allOptions: [],
      goalLabel: 'your goal',
      isSingleOption: true,
      analysisStatus: 'computed',
    }

    render(<RecommendationSection data={preRunData} />)

    expect(screen.getByText(/Run an analysis/)).toBeInTheDocument()
  })

  it('calls onFocusNode when option clicked', () => {
    const onFocusNode = vi.fn()
    render(<RecommendationSection data={mockData} onFocusNode={onFocusNode} />)

    // Click on the Hire 2 Developers option (not the first one which is nested differently)
    fireEvent.click(screen.getByText('Hire 2 Developers'))

    expect(onFocusNode).toHaveBeenCalledWith('option-2')
  })

  it('does not render goal link in recommendation section (moved to Objective section)', () => {
    // Goal link was removed from RecommendationSection - it's now in Objective section only
    const dataWithGoalId: RecommendationSectionData = {
      ...mockData,
      goalNodeId: 'goal-123',
    }

    render(<RecommendationSection data={dataWithGoalId} />)

    // Link should NOT be present (removed per Polish E)
    expect(screen.queryByText(/View goal on canvas/)).not.toBeInTheDocument()
  })

  it('renders expected probability in option list', () => {
    render(<RecommendationSection data={mockData} />)

    expect(screen.getByText('58% expected')).toBeInTheDocument()
    expect(screen.getByText('41% expected')).toBeInTheDocument()
  })

  it('renders natural language outcome description', () => {
    render(<RecommendationSection data={mockData} />)

    // p50 = 0.58 > 0.5 → "Likely a strong positive outcome"
    expect(screen.getByText(/Likely a strong positive outcome/)).toBeInTheDocument()
  })

  it('renders moderate outcome description', () => {
    const moderateData: RecommendationSectionData = {
      ...mockData,
      recommendedOption: {
        ...mockData.recommendedOption!,
        p50: 0.35,
      },
    }

    render(<RecommendationSection data={moderateData} />)

    expect(screen.getByText(/Likely a moderate positive outcome/)).toBeInTheDocument()
  })

  // =========================================================================
  // Range Bar Validity Tests (Fix 2)
  // =========================================================================

  describe('Range Bar Validity', () => {
    it('should handle expected outside initial bounds by reordering', () => {
      // p10=-22%, p50=114%, p90=24% → should reorder to -22%, 24%, 114%
      const reorderData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          p10: -0.22,
          p50: 1.14,
          p90: 0.24,
        },
      }

      render(<RecommendationSection data={reorderData} />)

      // After reorder: worse=-22%, expected=24%, better=114%
      expect(screen.getByText('-22%')).toBeInTheDocument()
      expect(screen.getByText('24%')).toBeInTheDocument()
      expect(screen.getByText('114%')).toBeInTheDocument()
    })

    it('should handle negative values correctly', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          p10: -0.30,
          p50: -0.10,
          p90: 0.20,
        },
      }

      render(<RecommendationSection data={negativeData} />)

      expect(screen.getByText('-30%')).toBeInTheDocument()
      expect(screen.getByText('-10%')).toBeInTheDocument()
      expect(screen.getByText('20%')).toBeInTheDocument()
    })

    it('should handle >100% values correctly', () => {
      const highData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          p10: 0.50,
          p50: 1.50,
          p90: 2.00,
        },
      }

      render(<RecommendationSection data={highData} />)

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('150%')).toBeInTheDocument()
      expect(screen.getByText('200%')).toBeInTheDocument()
    })

    it('should show expected-only fallback when p10/p90 missing', () => {
      // Simulate missing bounds by setting them to 0 with null-like behavior
      // Note: In practice, useResultsSectionData normalizes these
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          p10: null as unknown as number,
          p50: 0.65,
          p90: null as unknown as number,
        },
      }

      render(<RecommendationSection data={expectedOnlyData} />)

      // Should show expected-only view
      expect(screen.getByText('65%')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Option Expected Value Uniqueness Tests (Fix 4)
  // =========================================================================

  describe('Option Comparison', () => {
    it('should show different expected values for different options', () => {
      const optionsWithDifferentValues: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'opt-a',
            label: 'Option A',
            p10: 0.20,
            p50: 0.30,
            p90: 0.40,
            isRecommended: false,
          },
          {
            id: 'opt-b',
            label: 'Option B',
            p10: 0.40,
            p50: 0.55,
            p90: 0.70,
            isRecommended: true,
          },
        ],
        recommendedOption: {
          id: 'opt-b',
          label: 'Option B',
          p10: 0.40,
          p50: 0.55,
          p90: 0.70,
          isRecommended: true,
        },
        isSingleOption: false,
      }

      render(<RecommendationSection data={optionsWithDifferentValues} />)

      // Different options should show different expected values
      expect(screen.getByText('30% expected')).toBeInTheDocument()
      expect(screen.getByText('55% expected')).toBeInTheDocument()
    })

    it('should mark correct option as recommended based on data', () => {
      // Option B has higher p50 but Option A is marked recommended (backend override)
      const backendOverrideData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'opt-a',
            label: 'Option A',
            p10: 0.20,
            p50: 0.30,
            p90: 0.40,
            isRecommended: true,  // Backend marked this as recommended
          },
          {
            id: 'opt-b',
            label: 'Option B',
            p10: 0.40,
            p50: 0.55,  // Higher p50 but NOT recommended
            p90: 0.70,
            isRecommended: false,
          },
        ],
        recommendedOption: {
          id: 'opt-a',
          label: 'Option A',
          p10: 0.20,
          p50: 0.30,
          p90: 0.40,
          isRecommended: true,
        },
        isSingleOption: false,
      }

      render(<RecommendationSection data={backendOverrideData} />)

      // The Recommended badge should appear only once
      const recommendedBadges = screen.getAllByText('Recommended')
      expect(recommendedBadges).toHaveLength(1)

      // Option A should have the badge (check parent element structure)
      const optionAButton = screen.getByRole('button', { name: /Option A/i })
      expect(optionAButton).toHaveTextContent('Recommended')
    })
  })

  // =========================================================================
  // Metric Consistency Tests (Fix 1)
  // =========================================================================

  describe('Metric Consistency', () => {
    it('should use same value for headline and range bar expected', () => {
      const consistencyData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          p10: 0.15,
          p50: 0.42,
          p90: 0.67,
        },
      }

      render(<RecommendationSection data={consistencyData} />)

      // Headline shows ~42% improvement
      expect(screen.getByText(/~42% improvement/)).toBeInTheDocument()

      // Range bar also shows 42% as expected (middle value)
      // The 42% appears twice: once in headline, once in range bar
      const percentages = screen.getAllByText('42%')
      expect(percentages.length).toBeGreaterThanOrEqual(1)
    })
  })
})
