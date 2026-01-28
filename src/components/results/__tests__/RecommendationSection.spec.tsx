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
  // NOTE: Values are in percentage form matching PLoT contract (p50: 58 = 58%)
  // NOT probability form (p50: 0.58). See golden fixture for reference.
  const mockData: RecommendationSectionData = {
    recommendedOption: {
      id: 'option-1',
      label: 'Hire Tech Lead',
      p10: 23,
      p50: 58,
      p90: 81,
      expected: 58,
      outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
      isRecommended: true,
      winProbability: 0.67,
    },
    allOptions: [
      {
        id: 'option-1',
        label: 'Hire Tech Lead',
        p10: 23,
        p50: 58,
        p90: 81,
        expected: 58,
        outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
        isRecommended: true,
        winProbability: 0.67,
      },
      {
        id: 'option-2',
        label: 'Hire 2 Developers',
        p10: 18,
        p50: 41,
        p90: 68,
        expected: 41,
        outcome: { mean: 41, p10: 18, p50: 41, p90: 68 },
        isRecommended: false,
        winProbability: 0.33,
      },
    ],
    goalLabel: 'increase revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
    outcomeUnit: 'percent',
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

    expect(screen.getByText(/Complete your model to see recommendations/)).toBeInTheDocument()
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

    // Task 1.3: range width = 81-23 = 58 > 50 → "Likely positive, but with wide uncertainty."
    expect(screen.getByText(/Likely positive, but with wide uncertainty/)).toBeInTheDocument()
  })

  it('renders moderate outcome description', () => {
    const moderateData: RecommendationSectionData = {
      ...mockData,
      recommendedOption: {
        ...mockData.recommendedOption!,
        expected: 35,  // Mean
        outcome: { mean: 35, p10: 15, p50: 35, p90: 55 },
        p10: 15,
        p50: 35,
        p90: 55,
      },
    }

    render(<RecommendationSection data={moderateData} />)

    expect(screen.getByText(/Likely a moderate positive outcome/)).toBeInTheDocument()
  })

  // =========================================================================
  // Range Bar Validity Tests (Fix 2)
  // =========================================================================

  describe('Range Bar Validity', () => {
    it('should display extreme values correctly (negative and >100%)', () => {
      // Test that component handles extreme percentile values without breaking
      // NOTE: Data layer (useResultsSectionData.normalizePercentiles) ensures p10 < expected < p90
      // This test uses pre-sorted data as it would arrive from the data layer
      const extremeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 24,  // Expected outcome (mean)
          outcome: { mean: 24, p10: -22, p50: 20, p90: 114 },
          p10: -22,   // Negative outcome possible
          p50: 20,    // Median (different from mean for skewed distribution)
          p90: 114,   // >100% improvement possible
        },
      }

      render(<RecommendationSection data={extremeData} />)

      // Component displays: Worse=-22%, Expected=24% (mean), Better=114%
      expect(screen.getByText('-22%')).toBeInTheDocument()
      expect(screen.getByText('24%')).toBeInTheDocument()
      expect(screen.getByText('114%')).toBeInTheDocument()
    })

    it('should handle negative values correctly', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: -10,  // Mean
          outcome: { mean: -10, p10: -30, p50: -10, p90: 20 },
          p10: -30,
          p50: -10,
          p90: 20,
        },
      }

      render(<RecommendationSection data={negativeData} />)

      expect(screen.getByText('-30%')).toBeInTheDocument()
      expect(screen.getByText('-10%')).toBeInTheDocument()
      expect(screen.getByText('20%')).toBeInTheDocument()
    })

    it('should handle >100% values correctly', () => {
      // Values > 100 can occur in improvement scenarios
      const highData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 150,  // Mean
          outcome: { mean: 150, p10: 50, p50: 150, p90: 200 },
          p10: 50,
          p50: 150,
          p90: 200,
        },
      }

      render(<RecommendationSection data={highData} />)

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('150%')).toBeInTheDocument()
      expect(screen.getByText('200%')).toBeInTheDocument()
    })

    it('should show expected-only fallback when p10/p90 missing', () => {
      // Simulate missing bounds
      // Note: In practice, useResultsSectionData normalizes these
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 65,  // Mean
          outcome: { mean: 65, p10: null, p50: 65, p90: null },
          p10: null as unknown as number,
          p50: 65,
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
            p10: 20,
            p50: 30,
            p90: 40,
            expected: 30,
            outcome: { mean: 30, p10: 20, p50: 30, p90: 40 },
            isRecommended: false,
          },
          {
            id: 'opt-b',
            label: 'Option B',
            p10: 40,
            p50: 55,
            p90: 70,
            expected: 55,
            outcome: { mean: 55, p10: 40, p50: 55, p90: 70 },
            isRecommended: true,
          },
        ],
        recommendedOption: {
          id: 'opt-b',
          label: 'Option B',
          p10: 40,
          p50: 55,
          p90: 70,
          expected: 55,
          outcome: { mean: 55, p10: 40, p50: 55, p90: 70 },
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
            p10: 20,
            p50: 30,
            p90: 40,
            expected: 30,
            outcome: { mean: 30, p10: 20, p50: 30, p90: 40 },
            isRecommended: true,  // Backend marked this as recommended
          },
          {
            id: 'opt-b',
            label: 'Option B',
            p10: 40,
            p50: 55,  // Higher p50 but NOT recommended
            p90: 70,
            expected: 55,
            outcome: { mean: 55, p10: 40, p50: 55, p90: 70 },
            isRecommended: false,
          },
        ],
        recommendedOption: {
          id: 'opt-a',
          label: 'Option A',
          p10: 20,
          p50: 30,
          p90: 40,
          expected: 30,
          outcome: { mean: 30, p10: 20, p50: 30, p90: 40 },
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
          p10: 15,
          p50: 42,
          p90: 67,
          expected: 42,
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

  // =========================================================================
  // Polarity Language Tests
  // =========================================================================

  describe('Polarity Language', () => {
    it('shows "improvement" for positive expected outcome', () => {
      const positiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 0.20,
          p50: 0.20,
        },
      }

      render(<RecommendationSection data={positiveData} />)

      expect(screen.getByText(/20% improvement/)).toBeInTheDocument()
      expect(screen.queryByText(/decline/)).not.toBeInTheDocument()
    })

    it('shows "decline" for negative expected outcome', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: -0.20,
          p50: -0.20,
        },
      }

      render(<RecommendationSection data={negativeData} />)

      expect(screen.getByText(/20% decline/)).toBeInTheDocument()
      expect(screen.queryByText(/improvement/)).not.toBeInTheDocument()
    })

    it('shows "improvement" for zero expected outcome (edge case)', () => {
      const zeroData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 0,
          p50: 0,
        },
      }

      render(<RecommendationSection data={zeroData} />)

      // Zero is treated as non-negative, so shows "improvement"
      expect(screen.getByText(/0% improvement/)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Recommendation Stability Tests
  // =========================================================================

  // =========================================================================
  // Task 1.6: Recommendation Stability Tests (Updated text format)
  // =========================================================================

  describe('Recommendation Stability', () => {
    it('shows "Stays best in 85% of scenarios tested" for stability 0.85', () => {
      const stabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.85,
      }

      render(<RecommendationSection data={stabilityData} />)

      expect(screen.getByText(/Stays best in 85% of scenarios tested/)).toBeInTheDocument()
    })

    it('shows "Stays best in 92% of scenarios tested" for high stability', () => {
      const highStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.92,
      }

      render(<RecommendationSection data={highStabilityData} />)

      expect(screen.getByText(/Stays best in 92% of scenarios tested/)).toBeInTheDocument()
    })

    it('shows "Stays best in 65% of scenarios tested" for medium stability', () => {
      const mediumStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.65,
      }

      render(<RecommendationSection data={mediumStabilityData} />)

      expect(screen.getByText(/Stays best in 65% of scenarios tested/)).toBeInTheDocument()
    })

    it('shows "Stays best in 35% of scenarios tested" for low stability', () => {
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.35,
      }

      render(<RecommendationSection data={lowStabilityData} />)

      expect(screen.getByText(/Stays best in 35% of scenarios tested/)).toBeInTheDocument()
    })

    it('does not show stability chip when recommendationStability is undefined', () => {
      const noStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
      }

      render(<RecommendationSection data={noStabilityData} />)

      expect(screen.queryByText(/Stays best in/i)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 1.3: Win Probability Display Tests
  // =========================================================================

  describe('Win Probability Display', () => {
    it('shows "Wins in 67% of scenarios tested" when win_probability present', () => {
      const winProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: 0.67,
      }

      render(<RecommendationSection data={winProbData} />)

      expect(screen.getByText(/Wins in 67% of scenarios tested/)).toBeInTheDocument()
    })

    it('does not show win probability when undefined', () => {
      const noWinProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: undefined,
      }

      render(<RecommendationSection data={noWinProbData} />)

      expect(screen.queryByText(/Wins in.*scenarios tested/)).not.toBeInTheDocument()
    })

    it('does not show win probability when 0', () => {
      const zeroWinProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: 0,
      }

      render(<RecommendationSection data={zeroWinProbData} />)

      expect(screen.queryByText(/Wins in 0% of scenarios tested/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 1.4: Honest Winner Labelling Tests
  // =========================================================================

  describe('Winner Labelling', () => {
    it('shows "MOST LIKELY TO BE BEST" when win_probability present', () => {
      const winProbData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'win_probability',
      }

      render(<RecommendationSection data={winProbData} />)

      expect(screen.getByText('MOST LIKELY TO BE BEST')).toBeInTheDocument()
    })

    it('shows "HIGHEST EXPECTED OUTCOME" when only expected_outcome available', () => {
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'expected_outcome',
      }

      render(<RecommendationSection data={expectedOnlyData} />)

      expect(screen.getByText('HIGHEST EXPECTED OUTCOME')).toBeInTheDocument()
    })

    it('shows "UNABLE TO DETERMINE BEST OPTION" when neither available', () => {
      const unknownData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'unknown',
      }

      render(<RecommendationSection data={unknownData} />)

      expect(screen.getByText('UNABLE TO DETERMINE BEST OPTION')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 1.5: Robustness Badge Tests
  // =========================================================================

  describe('Robustness Badge', () => {
    it('shows Robust badge for robustnessLevel=high', () => {
      const highLevelData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'high',
      }

      render(<RecommendationSection data={highLevelData} />)

      expect(screen.getByText('Robust')).toBeInTheDocument()
    })

    it('shows Robust badge for robustnessLabel=robust (fallback)', () => {
      const robustLabelData: RecommendationSectionData = {
        ...mockData,
        robustnessLabel: 'robust',
      }

      render(<RecommendationSection data={robustLabelData} />)

      expect(screen.getByText('Robust')).toBeInTheDocument()
    })

    it('shows Moderate badge for robustnessLevel=medium', () => {
      const mediumLevelData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'medium',
      }

      render(<RecommendationSection data={mediumLevelData} />)

      expect(screen.getByText('Moderate')).toBeInTheDocument()
    })

    it('shows Moderate badge for robustnessLabel=moderate (fallback)', () => {
      const moderateLabelData: RecommendationSectionData = {
        ...mockData,
        robustnessLabel: 'moderate',
      }

      render(<RecommendationSection data={moderateLabelData} />)

      expect(screen.getByText('Moderate')).toBeInTheDocument()
    })

    it('shows Fragile badge for robustnessLevel=low', () => {
      const lowLevelData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'low',
      }

      render(<RecommendationSection data={lowLevelData} />)

      expect(screen.getByText('Fragile')).toBeInTheDocument()
    })

    it('shows Very Fragile badge for robustnessLevel=very_low', () => {
      const veryLowData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'very_low',
      }

      render(<RecommendationSection data={veryLowData} />)

      expect(screen.getByText('Very Fragile')).toBeInTheDocument()
    })

    it('does not render badge when both level and label are missing', () => {
      const noBadgeData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: undefined,
        robustnessLabel: undefined,
      }

      render(<RecommendationSection data={noBadgeData} />)

      expect(screen.queryByText('Robust')).not.toBeInTheDocument()
      expect(screen.queryByText('Moderate')).not.toBeInTheDocument()
      expect(screen.queryByText('Fragile')).not.toBeInTheDocument()
    })

    it('prefers level over label when both present', () => {
      const bothPresentData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'high',
        robustnessLabel: 'fragile', // Should be ignored
      }

      render(<RecommendationSection data={bothPresentData} />)

      expect(screen.getByText('Robust')).toBeInTheDocument()
      expect(screen.queryByText('Fragile')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 1.7: Goal Context Tests
  // =========================================================================

  describe('Goal Context', () => {
    it('shows "Goal: {text}" when goalText present', () => {
      const goalTextData: RecommendationSectionData = {
        ...mockData,
        goalText: 'Maximize user retention',
      }

      render(<RecommendationSection data={goalTextData} />)

      expect(screen.getByText('Goal:')).toBeInTheDocument()
      expect(screen.getByText(/Maximize user retention/)).toBeInTheDocument()
    })

    it('does not show goal line when goalText is empty', () => {
      const emptyGoalData: RecommendationSectionData = {
        ...mockData,
        goalText: '',
      }

      render(<RecommendationSection data={emptyGoalData} />)

      expect(screen.queryByText('Goal:')).not.toBeInTheDocument()
    })

    it('does not show goal line when goalText is undefined', () => {
      const noGoalData: RecommendationSectionData = {
        ...mockData,
        goalText: undefined,
      }

      render(<RecommendationSection data={noGoalData} />)

      expect(screen.queryByText('Goal:')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Range Display Fix Tests (P0: p90=1.8 should show 180%, not 2%)
  // =========================================================================

  describe('Range Display (> 100% improvements)', () => {
    it('correctly formats p90=1.8 as 180% (probability form)', () => {
      // Values in probability form: 1.8 = 180% improvement
      const highImprovementData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'High Improvement',
          p10: 0.3,
          p50: 0.93,
          p90: 1.8,
          expected: 0.93,
          outcome: { mean: 0.93, p10: 0.3, p50: 0.93, p90: 1.8 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={highImprovementData} />)

      // p90=1.8 in probability form should display as 180%
      expect(screen.getByText('180%')).toBeInTheDocument()
      // p50=0.93 should display as 93%
      expect(screen.getByText('93%')).toBeInTheDocument()
      // p10=0.3 should display as 30%
      expect(screen.getByText('30%')).toBeInTheDocument()
    })

    it('uses threshold of 2 for probability detection (values > 1 but <= 2)', () => {
      const nearThresholdData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Near Threshold',
          p10: 0.5,
          p50: 1.0,
          p90: 1.95,  // Just under 2, should still be probability form
          expected: 1.0,
          outcome: { mean: 1.0, p10: 0.5, p50: 1.0, p90: 1.95 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={nearThresholdData} />)

      // p90=1.95 should display as 195%
      expect(screen.getByText('195%')).toBeInTheDocument()
      // p50=1.0 should display as 100%
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Description Threshold Fix Tests (P1: 93% should show "strong positive")
  // =========================================================================

  // =========================================================================
  // Outcome Description Thresholds Tests
  // =========================================================================

  describe('Outcome Description Thresholds', () => {
    it('shows "wide uncertainty" when range > 50% even with high expected value', () => {
      // Task 1.3: Wide range (40-120% = 80% width) triggers uncertainty message
      const strongPositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Strong Positive',
          p10: 0.4,
          p50: 0.93,  // 93% expected
          p90: 1.2,
          expected: 0.93,
          outcome: { mean: 0.93, p10: 0.4, p50: 0.93, p90: 1.2 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={strongPositiveData} />)

      // Wide range (80%) overrides high expected value
      expect(screen.getByText(/Likely positive, but with wide uncertainty/i)).toBeInTheDocument()
    })

    it('shows "moderate positive" for p50 20-50% (in probability form 0.2-0.5)', () => {
      const moderatePositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Moderate Positive',
          p10: 0.1,
          p50: 0.35,  // 35% - should trigger "moderate positive"
          p90: 0.6,
          expected: 0.35,
          outcome: { mean: 0.35, p10: 0.1, p50: 0.35, p90: 0.6 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={moderatePositiveData} />)

      expect(screen.getByText(/moderate positive/i)).toBeInTheDocument()
    })

    it('shows "small positive" for p50 < 20% (in probability form < 0.2)', () => {
      const smallPositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Small Positive',
          p10: 0.05,
          p50: 0.15,  // 15% - should trigger "small positive"
          p90: 0.25,
          expected: 0.15,
          outcome: { mean: 0.15, p10: 0.05, p50: 0.15, p90: 0.25 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={smallPositiveData} />)

      expect(screen.getByText(/small positive/i)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 3: Conditional Stability/Win Display Tests
  // =========================================================================

  describe('Conditional Stability/Win Display', () => {
    it('shows only stability when stability = 0.60 and win = 0.60 (same value)', () => {
      const sameValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.60,
        winProbability: 0.60,
      }

      render(<RecommendationSection data={sameValueData} />)

      // Stability should show
      expect(screen.getByText(/Stays best in 60% of scenarios tested/)).toBeInTheDocument()
      // Win probability should NOT show (difference <= 0.05)
      expect(screen.queryByText(/Wins in 60% of scenarios tested/)).not.toBeInTheDocument()
    })

    it('shows both stability and win when they differ by > 0.05', () => {
      const differentValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.70,
        winProbability: 0.55,
      }

      render(<RecommendationSection data={differentValueData} />)

      // Both should show
      expect(screen.getByText(/Stays best in 70% of scenarios tested/)).toBeInTheDocument()
      expect(screen.getByText(/Wins in 55% of scenarios tested/)).toBeInTheDocument()
    })

    it('shows only win probability when stability is null', () => {
      const onlyWinData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
        winProbability: 0.60,
      }

      render(<RecommendationSection data={onlyWinData} />)

      // Win should show alone
      expect(screen.getByText(/Wins in 60% of scenarios tested/)).toBeInTheDocument()
      // Stability should not show
      expect(screen.queryByText(/Stays best/)).not.toBeInTheDocument()
    })

    it('shows only stability when win probability is null', () => {
      const onlyStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.75,
        winProbability: undefined,
      }

      render(<RecommendationSection data={onlyStabilityData} />)

      // Stability should show
      expect(screen.getByText(/Stays best in 75% of scenarios tested/)).toBeInTheDocument()
      // Win should not show
      expect(screen.queryByText(/Wins in/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 5: Near-Tie Explanatory Text Tests
  // =========================================================================

  describe('Near-Tie Explanatory Text', () => {
    it('shows tie explanation when outcomes are same but win probabilities differ', () => {
      // Both options have same expected value (58%) but different win probabilities
      const tiedOutcomesData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Option A',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            isRecommended: true,
            winProbability: 0.65,
          },
          {
            id: 'option-2',
            label: 'Option B',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: 58,  // Same expected value
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            isRecommended: false,
            winProbability: 0.35,  // Different win probability (spread = 0.30 > 0.1)
          },
        ],
        isSingleOption: false,
      }

      render(<RecommendationSection data={tiedOutcomesData} />)

      expect(screen.getByText(/Expected outcomes are similar/)).toBeInTheDocument()
    })

    it('does not show tie explanation when outcomes differ', () => {
      // Options have different expected values
      const differentOutcomesData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Option A',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            isRecommended: true,
            winProbability: 0.65,
          },
          {
            id: 'option-2',
            label: 'Option B',
            p10: 18,
            p50: 41,
            p90: 68,
            expected: 41,  // Different expected value
            outcome: { mean: 41, p10: 18, p50: 41, p90: 68 },
            isRecommended: false,
            winProbability: 0.35,
          },
        ],
        isSingleOption: false,
      }

      render(<RecommendationSection data={differentOutcomesData} />)

      expect(screen.queryByText(/Expected outcomes are similar/)).not.toBeInTheDocument()
    })

    it('does not show tie explanation when win probability spread is small', () => {
      // Same expected values but win probabilities are close (spread = 0.04 < 0.1)
      const smallSpreadData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Option A',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            isRecommended: true,
            winProbability: 0.52,
          },
          {
            id: 'option-2',
            label: 'Option B',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: 58,  // Same expected value
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            isRecommended: false,
            winProbability: 0.48,  // Small spread (0.04 < 0.1)
          },
        ],
        isSingleOption: false,
      }

      render(<RecommendationSection data={smallSpreadData} />)

      expect(screen.queryByText(/Expected outcomes are similar/)).not.toBeInTheDocument()
    })

    it('does not show tie explanation when outcomes are null/missing', () => {
      // FIX: When expected values are null, should NOT show "Expected outcomes are similar"
      const nullOutcomesData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Option A',
            p10: null as unknown as number,
            p50: null as unknown as number,
            p90: null as unknown as number,
            expected: null as unknown as number,
            outcome: { mean: null, p10: null, p50: null, p90: null },
            isRecommended: true,
            winProbability: 0.65,
          },
          {
            id: 'option-2',
            label: 'Option B',
            p10: null as unknown as number,
            p50: null as unknown as number,
            p90: null as unknown as number,
            expected: null as unknown as number,
            outcome: { mean: null, p10: null, p50: null, p90: null },
            isRecommended: false,
            winProbability: 0.35,
          },
        ],
        isSingleOption: false,
      }

      render(<RecommendationSection data={nullOutcomesData} />)

      // Should NOT show tie explanation when outcomes are missing
      expect(screen.queryByText(/Expected outcomes are similar/)).not.toBeInTheDocument()
    })

    it('falls back to outcome.mean when expected is null', () => {
      // When expected is null but outcome.mean exists, should use outcome.mean
      const fallbackData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Option A',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: null as unknown as number,  // null expected
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },  // but outcome.mean exists
            isRecommended: true,
            winProbability: 0.65,
          },
          {
            id: 'option-2',
            label: 'Option B',
            p10: 23,
            p50: 58,
            p90: 81,
            expected: null as unknown as number,  // null expected
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },  // same outcome.mean
            isRecommended: false,
            winProbability: 0.35,  // spread = 0.30 > 0.1
          },
        ],
        isSingleOption: false,
      }

      render(<RecommendationSection data={fallbackData} />)

      // Should show tie explanation using outcome.mean fallback
      expect(screen.getByText(/Expected outcomes are similar/)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Win Probability Small Value Formatting Tests
  // =========================================================================

  describe('Win Probability Formatting', () => {
    it('formats small win probabilities with decimal to avoid "0%"', () => {
      // 0.4% should show as "0.4%" not "0%"
      const smallWinProbData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,  // No stability, so win shows alone
        winProbability: 0.004,  // 0.4%
      }

      render(<RecommendationSection data={smallWinProbData} />)

      // Should show "0.4%" not "0%"
      expect(screen.getByText(/Wins in 0\.4% of scenarios tested/)).toBeInTheDocument()
      expect(screen.queryByText(/Wins in 0% of scenarios tested/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 2.1 & 2.2: Baseline & Delta Display Tests
  // =========================================================================

  describe('Baseline & Delta Display', () => {
    it('shows "Baseline" badge for baseline option', () => {
      const baselineData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Hire Tech Lead',
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            p10: 23,
            p50: 58,
            p90: 81,
            isRecommended: true,
          },
          {
            id: 'option-2',
            label: 'Status Quo',
            expected: 30,
            outcome: { mean: 30, p10: 10, p50: 30, p90: 50 },
            p10: 10,
            p50: 30,
            p90: 50,
            isRecommended: false,
            isBaseline: true,
          },
        ],
        baselineId: 'option-2',
        baselineOutcome: 30,
        isSingleOption: false,
      }

      render(<RecommendationSection data={baselineData} />)

      expect(screen.getByText('Baseline')).toBeInTheDocument()
    })

    it('shows delta vs baseline for non-baseline options', () => {
      const deltaData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Hire Tech Lead',
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            p10: 23,
            p50: 58,
            p90: 81,
            isRecommended: true,
            deltaFromBaseline: 28, // 58 - 30 = 28
          },
          {
            id: 'option-2',
            label: 'Status Quo',
            expected: 30,
            outcome: { mean: 30, p10: 10, p50: 30, p90: 50 },
            p10: 10,
            p50: 30,
            p90: 50,
            isRecommended: false,
            isBaseline: true,
            deltaFromBaseline: null, // Baseline has no delta
          },
        ],
        baselineId: 'option-2',
        baselineOutcome: 30,
        isSingleOption: false,
      }

      render(<RecommendationSection data={deltaData} />)

      // Should show delta for non-baseline option
      expect(screen.getByText('+28% vs baseline')).toBeInTheDocument()
    })

    it('does not show delta for baseline option', () => {
      const baselineData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Hire Tech Lead',
            expected: 58,
            outcome: { mean: 58, p10: 23, p50: 58, p90: 81 },
            p10: 23,
            p50: 58,
            p90: 81,
            isRecommended: true,
            deltaFromBaseline: 28,
          },
          {
            id: 'option-2',
            label: 'Status Quo',
            expected: 30,
            outcome: { mean: 30, p10: 10, p50: 30, p90: 50 },
            p10: 10,
            p50: 30,
            p90: 50,
            isRecommended: false,
            isBaseline: true,
            deltaFromBaseline: null,
          },
        ],
        baselineId: 'option-2',
        baselineOutcome: 30,
        isSingleOption: false,
      }

      render(<RecommendationSection data={baselineData} />)

      // Status Quo (baseline) should not show delta text
      const baselineRow = screen.getByRole('button', { name: /Status Quo/i })
      expect(baselineRow).not.toHaveTextContent('vs baseline')
    })

    it('shows negative delta correctly', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Status Quo',
            expected: 50,
            outcome: { mean: 50, p10: 30, p50: 50, p90: 70 },
            p10: 30,
            p50: 50,
            p90: 70,
            isRecommended: true,
            isBaseline: true,
            deltaFromBaseline: null,
          },
          {
            id: 'option-2',
            label: 'Risky Option',
            expected: 35,
            outcome: { mean: 35, p10: 10, p50: 35, p90: 60 },
            p10: 10,
            p50: 35,
            p90: 60,
            isRecommended: false,
            deltaFromBaseline: -15, // 35 - 50 = -15
          },
        ],
        baselineId: 'option-1',
        baselineOutcome: 50,
        isSingleOption: false,
      }

      render(<RecommendationSection data={negativeData} />)

      // Should show negative delta
      expect(screen.getByText('-15% vs baseline')).toBeInTheDocument()
    })

    it('shows "Same as baseline" for zero delta (Issue #3 fix)', () => {
      const zeroDeltaData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Status Quo',
            expected: 50,
            outcome: { mean: 50, p10: 30, p50: 50, p90: 70 },
            p10: 30,
            p50: 50,
            p90: 70,
            isRecommended: true,
            isBaseline: true,
            deltaFromBaseline: null,
          },
          {
            id: 'option-2',
            label: 'Equal Option',
            expected: 50, // Same as baseline
            outcome: { mean: 50, p10: 25, p50: 50, p90: 75 },
            p10: 25,
            p50: 50,
            p90: 75,
            isRecommended: false,
            deltaFromBaseline: 0, // 50 - 50 = 0
          },
        ],
        baselineId: 'option-1',
        baselineOutcome: 50,
        isSingleOption: false,
      }

      render(<RecommendationSection data={zeroDeltaData} />)

      // Should show "Same as baseline" instead of hiding
      expect(screen.getByText('Same as baseline')).toBeInTheDocument()
    })

    it('shows "Same as baseline" for near-zero delta (Bug 3 fix)', () => {
      const nearZeroDeltaData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Status Quo',
            expected: 50,
            outcome: { mean: 50, p10: 30, p50: 50, p90: 70 },
            p10: 30,
            p50: 50,
            p90: 70,
            isRecommended: true,
            isBaseline: true,
            deltaFromBaseline: null,
          },
          {
            id: 'option-2',
            label: 'Nearly Equal Option',
            expected: 50.01, // Near-baseline
            outcome: { mean: 50.01, p10: 25, p50: 50.01, p90: 75 },
            p10: 25,
            p50: 50.01,
            p90: 75,
            isRecommended: false,
            deltaFromBaseline: 0.01, // Within epsilon (0.05)
          },
        ],
        baselineId: 'option-1',
        baselineOutcome: 50,
        isSingleOption: false,
      }

      render(<RecommendationSection data={nearZeroDeltaData} />)

      // Should show "Same as baseline" instead of "+0.0%"
      expect(screen.getByText('Same as baseline')).toBeInTheDocument()
      // Should NOT show "+0.0" or similar
      expect(screen.queryByText(/\+0\.0/)).not.toBeInTheDocument()
      expect(screen.queryByText(/-0\.0/)).not.toBeInTheDocument()
    })

    it('shows negative near-zero delta as "Same as baseline" (Bug 3 fix)', () => {
      const negativeNearZeroDeltaData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          {
            id: 'option-1',
            label: 'Status Quo',
            expected: 50,
            outcome: { mean: 50, p10: 30, p50: 50, p90: 70 },
            p10: 30,
            p50: 50,
            p90: 70,
            isRecommended: true,
            isBaseline: true,
            deltaFromBaseline: null,
          },
          {
            id: 'option-2',
            label: 'Slightly Lower Option',
            expected: 49.98,
            outcome: { mean: 49.98, p10: 25, p50: 49.98, p90: 75 },
            p10: 25,
            p50: 49.98,
            p90: 75,
            isRecommended: false,
            deltaFromBaseline: -0.02, // Within epsilon (0.05)
          },
        ],
        baselineId: 'option-1',
        baselineOutcome: 50,
        isSingleOption: false,
      }

      render(<RecommendationSection data={negativeNearZeroDeltaData} />)

      // Should show "Same as baseline" instead of "-0.0%"
      expect(screen.getByText('Same as baseline')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Near-Tie Detection Tests
  // =========================================================================

  describe('Near-Tie Detection', () => {
    it('shows near-tie callout when nearTie.isTie is true with gap', () => {
      const nearTieData: RecommendationSectionData = {
        ...mockData,
        nearTie: {
          isTie: true,
          topOptionId: 'option-1',
          secondOptionId: 'option-2',
          tiedOptionIds: ['option-1', 'option-2'],
          gap: 0.04,
          threshold: 0.10,
        },
      }

      render(<RecommendationSection data={nearTieData} />)

      // Should show near-tie warning with gap percentage
      expect(screen.getByText(/Too close to call/)).toBeInTheDocument()
      expect(screen.getByText(/Only 4% separates the top options/)).toBeInTheDocument()
    })

    it('shows generic message when nearTie.isTie is true with zero gap', () => {
      const nearTieZeroGapData: RecommendationSectionData = {
        ...mockData,
        nearTie: {
          isTie: true,
          topOptionId: 'option-1',
          secondOptionId: 'option-2',
          tiedOptionIds: ['option-1', 'option-2'],
          gap: 0,
          threshold: 0.10,
        },
      }

      render(<RecommendationSection data={nearTieZeroGapData} />)

      // Should show generic near-tie message
      expect(screen.getByText(/Too close to call/)).toBeInTheDocument()
      expect(screen.getByText(/Small changes in your assumptions could shift the recommendation/)).toBeInTheDocument()
    })

    it('shows tied options when tiedOptionIds has valid labels', () => {
      const nearTieWithLabelsData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          { ...mockData.allOptions[0], id: 'option-1', label: 'Hire Tech Lead' },
          { ...mockData.allOptions[1], id: 'option-2', label: 'Hire 2 Developers' },
        ],
        nearTie: {
          isTie: true,
          topOptionId: 'option-1',
          secondOptionId: 'option-2',
          tiedOptionIds: ['option-1', 'option-2'],
          gap: 0.05,
          threshold: 0.10,
        },
      }

      render(<RecommendationSection data={nearTieWithLabelsData} />)

      // Should show tied options message
      expect(screen.getByText(/Hire Tech Lead and Hire 2 Developers are effectively tied/)).toBeInTheDocument()
    })

    it('does not show near-tie callout when nearTie.isTie is false', () => {
      const noNearTieData: RecommendationSectionData = {
        ...mockData,
        nearTie: {
          isTie: false,
          topOptionId: 'option-1',
          secondOptionId: 'option-2',
          tiedOptionIds: [],
          gap: 0.25,
          threshold: 0.10,
        },
      }

      render(<RecommendationSection data={noNearTieData} />)

      // Should NOT show near-tie warning
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
    })

    it('falls back to stability-based near-tie when nearTie is undefined', () => {
      // Low stability (< 0.6) should trigger near-tie display
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        nearTie: undefined,
        recommendationStability: 0.45,  // Below THRESHOLDS.STABILITY_MODERATE (0.6)
      }

      render(<RecommendationSection data={lowStabilityData} />)

      // Should show near-tie warning based on stability fallback
      expect(screen.getByText(/Too close to call/)).toBeInTheDocument()
    })

    it('does not show near-tie when nearTie undefined and stability is high', () => {
      const highStabilityData: RecommendationSectionData = {
        ...mockData,
        nearTie: undefined,
        recommendationStability: 0.85,  // Above threshold
      }

      render(<RecommendationSection data={highStabilityData} />)

      // Should NOT show near-tie warning
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
    })

    it('shows generic fallback when only one valid label found', () => {
      const partialLabelsData: RecommendationSectionData = {
        ...mockData,
        allOptions: [
          { ...mockData.allOptions[0], id: 'option-1', label: 'Hire Tech Lead' },
        ],
        nearTie: {
          isTie: true,
          topOptionId: 'option-1',
          secondOptionId: 'option-unknown',  // Not in allOptions
          tiedOptionIds: ['option-1', 'option-unknown'],
          gap: 0.04,
          threshold: 0.10,
        },
      }

      render(<RecommendationSection data={partialLabelsData} />)

      // Should show near-tie warning with generic fallback (per brief: show fallback when tiedOptionIds can't be fully resolved)
      expect(screen.getByText(/Too close to call/)).toBeInTheDocument()
      expect(screen.getByText(/effectively tied within the model's uncertainty/)).toBeInTheDocument()
    })
  })
})
