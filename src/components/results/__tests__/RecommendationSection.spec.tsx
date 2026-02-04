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

  it('renders headline with outperforms message when no goal probability', () => {
    render(<RecommendationSection data={mockData} />)

    // Task 4: Headline now shows "X outperforms alternatives most consistently" when no goal probability
    expect(screen.getByText(/outperforms alternatives most consistently/)).toBeInTheDocument()
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

  it('renders Strongest performer badge for top option', () => {
    render(<RecommendationSection data={mockData} />)

    // Task 3: Changed from "Recommended" to stability-based "Strongest performer"
    expect(screen.getByText('Strongest performer')).toBeInTheDocument()
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

  it('renders rank-based labels in option list when probability_of_goal absent (Fix A)', () => {
    // mockData has no goalThreshold/goalProbability, so rank labels should show
    const dataWithRanks: RecommendationSectionData = {
      ...mockData,
      allOptions: mockData.allOptions.map((opt, idx) => ({
        ...opt,
        rank: idx + 1,
      })),
      recommendedOption: { ...mockData.recommendedOption!, rank: 1 },
    }
    render(<RecommendationSection data={dataWithRanks} />)

    // Fix A: "X expected" replaced with rank labels when probability_of_goal absent
    expect(screen.queryByText(/expected$/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Strongest performer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Second strongest')).toBeInTheDocument()
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
    it('should show rank-based labels when probability_of_goal is absent (Fix A)', () => {
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
            rank: 2,
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
            rank: 1,
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
          rank: 1,
        },
        isSingleOption: false,
      }

      render(<RecommendationSection data={optionsWithDifferentValues} />)

      // Fix A: When probability_of_goal is absent, show rank-based labels not "X expected"
      // "Strongest performer" may appear multiple times (badge + option card)
      expect(screen.getAllByText('Strongest performer').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Second strongest')).toBeInTheDocument()
      // "X expected" should NOT appear
      expect(screen.queryByText(/expected$/)).not.toBeInTheDocument()
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

      // Task 3: The Strongest performer badge should appear only once
      const recommendedBadges = screen.getAllByText('Strongest performer')
      expect(recommendedBadges).toHaveLength(1)

      // Option A should have the badge (check parent element structure)
      // Task 2: Option rows now use role="link" instead of role="button"
      const optionARow = screen.getByRole('link', { name: /Option A/i })
      expect(optionARow).toHaveTextContent('Strongest performer')
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

      // Task 4: Headline now shows "outperforms alternatives" when no goal probability
      expect(screen.getByText(/outperforms alternatives most consistently/)).toBeInTheDocument()

      // Range bar shows 42% as expected (middle value)
      const percentages = screen.getAllByText('42%')
      expect(percentages.length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // Polarity Language Tests
  // =========================================================================

  describe('Headline Display (Task 4 updated)', () => {
    // Task 4: Headline now shows "X outperforms alternatives" when no goal probability
    // The old polarity language (improvement/decline) has been removed
    it('shows outperforms message regardless of expected outcome sign', () => {
      const positiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 0.20,
          p50: 0.20,
        },
      }

      render(<RecommendationSection data={positiveData} />)

      // Task 4: Now shows "X outperforms alternatives" instead of "improvement"
      expect(screen.getByText(/outperforms alternatives most consistently/)).toBeInTheDocument()
    })

    it('shows outperforms message for negative expected outcome', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: -0.20,
          p50: -0.20,
        },
      }

      render(<RecommendationSection data={negativeData} />)

      // Task 4: Now shows "X outperforms alternatives" instead of "decline"
      expect(screen.getByText(/outperforms alternatives most consistently/)).toBeInTheDocument()
    })

    it('shows outperforms message for zero expected outcome', () => {
      const zeroData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 0,
          p50: 0,
        },
      }

      render(<RecommendationSection data={zeroData} />)

      // Task 4: Now shows "X outperforms alternatives" for all cases
      expect(screen.getByText(/outperforms alternatives most consistently/)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Recommendation Stability Tests
  // =========================================================================

  // =========================================================================
  // Task 5: Recommendation Stability Tests (Tiered plain language labels)
  // =========================================================================

  describe('Recommendation Stability', () => {
    it('shows "Stable result" label for stability >= 0.85', () => {
      const stabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.85,
        robustnessLevel: 'high',
      }

      render(<RecommendationSection data={stabilityData} />)

      // Task 5: Now shows tiered label instead of percentage
      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('shows "Stable result" label for high stability (0.92)', () => {
      const highStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.92,
        robustnessLevel: 'high',
      }

      render(<RecommendationSection data={highStabilityData} />)

      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('shows "Sensitive to assumptions" label for medium stability (0.65)', () => {
      const mediumStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.65,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={mediumStabilityData} />)

      // 0.65 is >= 0.55 but < 0.70, so "Sensitive to assumptions"
      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
    })

    it('shows "Highly sensitive" label for low stability (0.35)', () => {
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.35,
        robustnessLevel: 'low',
      }

      render(<RecommendationSection data={lowStabilityData} />)

      // 0.35 is < 0.55, so "Highly sensitive"
      expect(screen.getByText('Highly sensitive')).toBeInTheDocument()
    })

    it('does not show stability badge when recommendationStability is undefined', () => {
      const noStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={noStabilityData} />)

      // Task 5: No stability badge should show when stability is undefined
      expect(screen.queryByText('Stable result')).not.toBeInTheDocument()
      expect(screen.queryByText('Mostly stable')).not.toBeInTheDocument()
      expect(screen.queryByText('Sensitive to assumptions')).not.toBeInTheDocument()
      expect(screen.queryByText('Highly sensitive')).not.toBeInTheDocument()
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
    it('shows "Most likely to be best" when win_probability present', () => {
      const winProbData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'win_probability',
      }

      render(<RecommendationSection data={winProbData} />)

      // Task 1: Changed from ALL CAPS to sentence case
      expect(screen.getByText('Most likely to be best')).toBeInTheDocument()
    })

    it('shows "Highest expected outcome" when only expected_outcome available', () => {
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'expected_outcome',
      }

      render(<RecommendationSection data={expectedOnlyData} />)

      // Task 1: Changed from ALL CAPS to sentence case
      expect(screen.getByText('Highest expected outcome')).toBeInTheDocument()
    })

    it('shows "Unable to determine best option" when neither available', () => {
      const unknownData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'unknown',
      }

      render(<RecommendationSection data={unknownData} />)

      // Task 1: Changed from ALL CAPS to sentence case
      expect(screen.getByText('Unable to determine best option')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 5: Stability Badge Tests (replaced Robustness Badge)
  // =========================================================================

  describe('Stability Badge', () => {
    // Note: The old Robustness Badge (Robust/Moderate/Fragile) has been replaced
    // with StabilityBadge showing tiered plain language labels based on stability score.
    // robustnessLevel/Label are no longer used for badge display.

    it('shows stability badge when recommendationStability is provided', () => {
      const stabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.85,
      }

      render(<RecommendationSection data={stabilityData} />)

      // Task 5: Stability >= 0.85 shows "Stable result"
      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('does not show old robustness badges anymore', () => {
      const highLevelData: RecommendationSectionData = {
        ...mockData,
        robustnessLevel: 'high',
        recommendationStability: 0.90,
      }

      render(<RecommendationSection data={highLevelData} />)

      // Old badges should not appear
      expect(screen.queryByText('Robust')).not.toBeInTheDocument()
      expect(screen.queryByText('Moderate')).not.toBeInTheDocument()
      expect(screen.queryByText('Fragile')).not.toBeInTheDocument()
      // New stability badge should appear
      expect(screen.getByText('Stable result')).toBeInTheDocument()
    })

    it('does not render stability badge when recommendationStability is undefined', () => {
      const noStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
      }

      render(<RecommendationSection data={noStabilityData} />)

      // No stability labels should appear
      expect(screen.queryByText('Stable result')).not.toBeInTheDocument()
      expect(screen.queryByText('Mostly stable')).not.toBeInTheDocument()
      expect(screen.queryByText('Sensitive to assumptions')).not.toBeInTheDocument()
      expect(screen.queryByText('Highly sensitive')).not.toBeInTheDocument()
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
          label: 'Test Option',  // Use different label to avoid double match
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

      // Match the exact outcome description
      expect(screen.getByText(/Likely a moderate positive outcome/i)).toBeInTheDocument()
    })

    it('shows "small positive" for p50 < 20% (in probability form < 0.2)', () => {
      const smallPositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Test Option',  // Use different label to avoid double match
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

      // Match the exact outcome description text
      expect(screen.getByText(/Likely a small positive outcome/i)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 3: Conditional Stability/Win Display Tests
  // =========================================================================

  describe('Conditional Stability/Win Display', () => {
    it('shows only inline stability when stability = 0.60 and win = 0.60 (same value)', () => {
      const sameValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.60,
        winProbability: 0.60,
        robustnessLevel: 'moderate',  // Required for inline stability
      }

      render(<RecommendationSection data={sameValueData} />)

      // Task 5: Stability now shows tiered label
      // 0.60 is >= 0.55 && < 0.70 → "Sensitive to assumptions"
      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
      // Win probability should NOT show (difference <= 0.05)
      expect(screen.queryByText(/Wins in 60% of scenarios tested/)).not.toBeInTheDocument()
    })

    it('shows both inline stability and win when they differ by > 0.05', () => {
      const differentValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.70,
        winProbability: 0.55,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={differentValueData} />)

      // Both should show
      // 0.70 is >= 0.70 && < 0.85 → "Mostly stable"
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
      expect(screen.getByText(/Wins in 55% of scenarios tested/)).toBeInTheDocument()
    })

    it('shows only win probability when stability is null', () => {
      const onlyWinData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
        winProbability: 0.60,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={onlyWinData} />)

      // Win should show alone
      expect(screen.getByText(/Wins in 60% of scenarios tested/)).toBeInTheDocument()
      // Stability badge should not show (no stability value)
      expect(screen.queryByText('Stable result')).not.toBeInTheDocument()
      expect(screen.queryByText('Mostly stable')).not.toBeInTheDocument()
      expect(screen.queryByText('Sensitive to assumptions')).not.toBeInTheDocument()
      expect(screen.queryByText('Highly sensitive')).not.toBeInTheDocument()
    })

    it('shows only inline stability when win probability is null', () => {
      const onlyStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.75,
        winProbability: undefined,
        robustnessLevel: 'high',
      }

      render(<RecommendationSection data={onlyStabilityData} />)

      // Task 5: 0.75 is >= 0.70 && < 0.85 → "Mostly stable"
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
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
      const baselineRow = screen.getByRole('link', { name: /Status Quo/i })
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

      // Fix D3: "Too close to call" card removed - near-tie now communicated via stability badge
      // The card no longer renders; stability badge shows "Highly sensitive" or similar
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
    })

    it('does not show Too close to call card (removed per D3 fix)', () => {
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

      // Fix D3: "Too close to call" card removed - redundant with "No clear front-runner" + stability badge
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
    })

    it('does not show tied options card (Fix D3 - card removed)', () => {
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

      // Fix D3: "Too close to call" card with tied options message removed
      // Near-tie information is now communicated via stability badge
      expect(screen.queryByText(/effectively tied/)).not.toBeInTheDocument()
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

    it('shows No clear front-runner when stability is low (replaces Too close to call)', () => {
      // Low stability (< 0.55) triggers "No clear front-runner" chip
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        nearTie: undefined,
        recommendationStability: 0.45,  // Below 0.55 threshold
      }

      render(<RecommendationSection data={lowStabilityData} />)

      // Fix D3: "Too close to call" removed, now shows "No clear front-runner" instead
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
      expect(screen.getByText(/No clear front-runner/)).toBeInTheDocument()
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

    it('does not show Too close to call with partial labels (Fix D3)', () => {
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

      // Fix D3: "Too close to call" card removed - information conveyed via stability badge
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
    })
  })
})
