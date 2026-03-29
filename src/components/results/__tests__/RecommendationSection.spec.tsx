/**
 * RecommendationSection Tests
 *
 * Tests for the recommendation display with range bar and option comparison.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders HeroSection with winner label', () => {
    render(<RecommendationSection data={mockData} />)

    // V9.2: Merged headline shows winner label
    expect(screen.getByText(/Hire Tech Lead performs best/)).toBeInTheDocument()
  })

  // Range bar removed - P1 HeroSection integration
  // Range data now available in "Learn more" expand via HeroSection

  it('renders HeroSection with data-testid', () => {
    render(<RecommendationSection data={mockData} />)

    // HeroSection is now the hero area
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('renders HeroSection with winner info (option cards moved to ResultsBody)', () => {
    render(<RecommendationSection data={mockData} />)

    // V9.2: OptionCards now render at ResultsBody level, not inside RecommendationSection
    // RecommendationSection shows HeroSection with winner in merged headline
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    expect(screen.getByText(/Hire Tech Lead performs best/)).toBeInTheDocument()
  })

  it('hides option comparison for single option', () => {
    const singleOptionData: RecommendationSectionData = {
      ...mockData,
      allOptions: [mockData.allOptions[0]],
      isSingleOption: true,
    }

    render(<RecommendationSection data={singleOptionData} />)

    // Single option shows CTA to add more options
    expect(screen.getByText(/Add another option/)).toBeInTheDocument()
    // OptionRow uses aria-label "Focus on X in model" - verify none rendered
    // (HeroSection GraphLinks use different aria-label patterns)
    expect(screen.queryByRole('link', { name: /Focus on.*in model/ })).not.toBeInTheDocument()
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

  // P1 Integration: Outcome description messages removed from hero
  // HeroSection now uses M1 templates instead of outcome description language
  it('renders HeroSection instead of outcome description messages', () => {
    render(<RecommendationSection data={mockData} />)

    // HeroSection renders with M1 templates
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    // Old outcome description messages are no longer displayed
    expect(screen.queryByText(/Likely positive, but with wide uncertainty/)).not.toBeInTheDocument()
  })

  it('renders HeroSection for moderate outcome data', () => {
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

    // HeroSection renders instead of outcome description
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    expect(screen.queryByText(/Likely a moderate positive outcome/)).not.toBeInTheDocument()
  })

  // =========================================================================
  // P1 Integration: Range bar removed - values available in HeroSection "Learn more"
  // =========================================================================

  describe('HeroSection Integration', () => {
    it('renders HeroSection for extreme value data', () => {
      const extremeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 24,
          outcome: { mean: 24, p10: -22, p50: 20, p90: 114 },
          p10: -22,
          p50: 20,
          p90: 114,
        },
      }

      render(<RecommendationSection data={extremeData} />)

      // HeroSection renders without crashing
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })

    it('renders HeroSection for negative values', () => {
      const negativeData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: -10,
          outcome: { mean: -10, p10: -30, p50: -10, p90: 20 },
          p10: -30,
          p50: -10,
          p90: 20,
        },
      }

      render(<RecommendationSection data={negativeData} />)

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })

    it('renders HeroSection for high values', () => {
      const highData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 150,
          outcome: { mean: 150, p10: 50, p50: 150, p90: 200 },
          p10: 50,
          p50: 150,
          p90: 200,
        },
      }

      render(<RecommendationSection data={highData} />)

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })

    it('renders HeroSection when p10/p90 missing', () => {
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 65,
          outcome: { mean: 65, p10: null, p50: 65, p90: null },
          p10: null as unknown as number,
          p50: 65,
          p90: null as unknown as number,
        },
      }

      render(<RecommendationSection data={expectedOnlyData} />)

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Option Expected Value Uniqueness Tests (Fix 4)
  // =========================================================================

  // =========================================================================
  // Metric Consistency Tests (Fix 1)
  // P1 Integration: Range bar removed - HeroSection shows M1 templates
  // =========================================================================

  describe('Metric Consistency', () => {
    it('HeroSection renders with consistent data', () => {
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

      // HeroSection renders with M1 templates
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Polarity Language Tests
  // =========================================================================

  describe('Headline Display (Task 4 updated)', () => {
    it('renders HeroSection with merged headline regardless of expected outcome sign', () => {
      const positiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          expected: 0.20,
          p50: 0.20,
        },
      }

      render(<RecommendationSection data={positiveData} />)

      // V9.2: Merged headline
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      expect(screen.getByText(/Hire Tech Lead performs best/)).toBeInTheDocument()
    })

    it('renders HeroSection when no win probabilities', () => {
      const noWinProbData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          ...mockData.recommendedOption!,
          winProbability: undefined,
        },
        allOptions: mockData.allOptions.map(o => ({ ...o, winProbability: undefined })),
      }

      render(<RecommendationSection data={noWinProbData} />)

      // V9.2: HeroSection still renders with merged headline
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      expect(screen.getByText(/Hire Tech Lead performs best/)).toBeInTheDocument()
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

    it('shows "Mostly stable" label for moderate stability (0.75)', () => {
      const mediumStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.75,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={mediumStabilityData} />)

      // 0.75 is >= 0.70 but < 0.85, so "Mostly stable" (Science UX Architecture v2 §4.2)
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
    })

    it('shows "Sensitive to assumptions" label for low stability (0.50)', () => {
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.50,
        robustnessLevel: 'low',
      }

      render(<RecommendationSection data={lowStabilityData} />)

      // 0.50 is >= 0.40 but < 0.70, so "Sensitive to assumptions" (Science UX Architecture v2 §4.2)
      expect(screen.getByText('Sensitive to assumptions')).toBeInTheDocument()
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
  // P1 Integration: "Wins in X% of scenarios" removed (banned language)
  // Win probability is now reflected in HeroSection M1 templates
  // =========================================================================

  describe('Win Probability Display', () => {
    it('HeroSection renders with win probability data', () => {
      const winProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: 0.67,
      }

      render(<RecommendationSection data={winProbData} />)

      // HeroSection is rendered
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // "scenarios" is banned language - should not appear
      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })

    it('does not show banned "scenarios" language when no win probability', () => {
      const noWinProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: undefined,
      }

      render(<RecommendationSection data={noWinProbData} />)

      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })

    it('does not show banned "scenarios" language when win probability is 0', () => {
      const zeroWinProbData: RecommendationSectionData = {
        ...mockData,
        winProbability: 0,
      }

      render(<RecommendationSection data={zeroWinProbData} />)

      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 1.4: Winner Labelling Tests
  // P1 Integration: Winner labelling removed from hero, HeroSection uses M1 templates
  // =========================================================================

  describe('Winner Labelling (P1)', () => {
    // P1 Integration: "Most likely to be best", "Highest expected outcome", "Unable to determine"
    // labels have been removed from the hero. HeroSection now uses M1 templates instead.
    // determinedBy field is still passed to HeroSection but not displayed as explicit labels.

    it('renders HeroSection when determinedBy is win_probability', () => {
      const winProbData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'win_probability',
      }

      render(<RecommendationSection data={winProbData} />)

      // HeroSection renders - winner labelling is embedded in M1 templates
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // Old explicit label is no longer displayed
      expect(screen.queryByText('Most likely to be best')).not.toBeInTheDocument()
    })

    it('renders HeroSection when determinedBy is expected_outcome', () => {
      const expectedOnlyData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'expected_outcome',
      }

      render(<RecommendationSection data={expectedOnlyData} />)

      // HeroSection renders - winner labelling is embedded in M1 templates
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // Old explicit label is no longer displayed
      expect(screen.queryByText('Highest expected outcome')).not.toBeInTheDocument()
    })

    it('renders HeroSection when determinedBy is unknown', () => {
      const unknownData: RecommendationSectionData = {
        ...mockData,
        determinedBy: 'unknown',
      }

      render(<RecommendationSection data={unknownData} />)

      // HeroSection renders - handles unknown determination gracefully
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // Old explicit label is no longer displayed
      expect(screen.queryByText('Unable to determine best option')).not.toBeInTheDocument()
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
  // Range Display Tests
  // P1 Integration: Range bar removed - data now available in HeroSection "Learn more"
  // =========================================================================

  describe('Range Display (P1 - range bar removed)', () => {
    // P1 Integration: The range bar with p10/p50/p90 percentages has been removed.
    // Range data is now available in the "Learn more" expand section of HeroSection.
    // These tests verify HeroSection renders correctly with the data.

    it('renders HeroSection with high improvement data', () => {
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

      // HeroSection renders with the data - range values available in "Learn more"
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // Range bar values (180%, 93%, 30%) are no longer directly displayed
      // They're available in the expanded "Learn more" section
    })

    it('renders HeroSection with near-threshold data', () => {
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

      // HeroSection renders - range data available in "Learn more"
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // P1 Integration: Outcome descriptions removed from hero (now in HeroSection)
  // HeroSection uses M1 templates instead of outcome description messages
  // =========================================================================

  describe('HeroSection M1 Templates', () => {
    it('renders HeroSection for wide uncertainty case', () => {
      const strongPositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Strong Positive',
          p10: 0.4,
          p50: 0.93,
          p90: 1.2,
          expected: 0.93,
          outcome: { mean: 0.93, p10: 0.4, p50: 0.93, p90: 1.2 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={strongPositiveData} />)

      // HeroSection renders - outcome descriptions now in M1 templates
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })

    it('renders HeroSection for moderate positive case', () => {
      const moderatePositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Test Option',
          p10: 0.1,
          p50: 0.35,
          p90: 0.6,
          expected: 0.35,
          outcome: { mean: 0.35, p10: 0.1, p50: 0.35, p90: 0.6 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={moderatePositiveData} />)

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })

    it('renders HeroSection for small positive case', () => {
      const smallPositiveData: RecommendationSectionData = {
        ...mockData,
        recommendedOption: {
          id: 'option-1',
          label: 'Test Option',
          p10: 0.05,
          p50: 0.15,
          p90: 0.25,
          expected: 0.15,
          outcome: { mean: 0.15, p10: 0.05, p50: 0.15, p90: 0.25 },
          isRecommended: true,
        },
        allOptions: [],
        isSingleOption: true,
      }

      render(<RecommendationSection data={smallPositiveData} />)

      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 3: Conditional Stability/Win Display Tests
  // =========================================================================

  describe('Conditional Stability/Win Display', () => {
    it('shows only inline stability when stability = 0.75 and win = 0.75 (same value)', () => {
      const sameValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.75,
        winProbability: 0.75,
        robustnessLevel: 'moderate',  // Required for inline stability
      }

      render(<RecommendationSection data={sameValueData} />)

      // 0.75 is >= 0.70 && < 0.85 → "Mostly stable" (Science UX Architecture v2 §4.2)
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
      // "scenarios" is banned language - should not appear
      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })

    it('shows stability label when stability and win probability differ', () => {
      const differentValueData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.70,
        winProbability: 0.55,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={differentValueData} />)

      // 0.70 is >= 0.70 && < 0.85 → "Mostly stable" in HeroSection
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
      // "scenarios" is banned language
      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })

    it('renders HeroSection when stability is null', () => {
      const onlyWinData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
        winProbability: 0.60,
        robustnessLevel: 'moderate',
      }

      render(<RecommendationSection data={onlyWinData} />)

      // HeroSection still renders (handles missing stability gracefully)
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
      // "scenarios" is banned language
      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
    })

    it('shows stability label when win probability is null', () => {
      const onlyStabilityData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: 0.75,
        winProbability: undefined,
        robustnessLevel: 'high',
      }

      render(<RecommendationSection data={onlyStabilityData} />)

      // Task 5: 0.75 is >= 0.70 && < 0.85 → "Mostly stable" in HeroSection
      expect(screen.getByText('Mostly stable')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 5: Near-Tie Explanatory Text Tests
  // =========================================================================

  // Near-Tie Explanatory Text — removed with OptionRow cards (P2-2)

  // =========================================================================
  // P1 Integration: "Wins in X% of scenarios" removed (banned language)
  // =========================================================================

  describe('Win Probability Display (P1)', () => {
    it('does not show banned "scenarios tested" language for small win probability', () => {
      const smallWinProbData: RecommendationSectionData = {
        ...mockData,
        recommendationStability: undefined,
        winProbability: 0.004,  // 0.4%
      }

      render(<RecommendationSection data={smallWinProbData} />)

      // "scenarios" is banned language - should not appear anywhere
      expect(screen.queryByText(/scenarios tested/)).not.toBeInTheDocument()
      // HeroSection should render
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Task 2.1 & 2.2: Baseline & Delta Display Tests
  // =========================================================================

  // Baseline & Delta Display — removed with OptionRow cards (P2-2)

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

      // Fix D3: "Too close to call" card removed - redundant with "No clear winner" + stability badge
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

    it('shows No clear winner when stability is low (replaces Too close to call)', () => {
      // Low stability (< 0.70) triggers "No clear winner" headline in HeroSection
      const lowStabilityData: RecommendationSectionData = {
        ...mockData,
        nearTie: undefined,
        recommendationStability: 0.45,  // Below 0.55 threshold
      }

      render(<RecommendationSection data={lowStabilityData} />)

      // Fix D3: "Too close to call" removed, now shows "no clear winner" instead
      // V9.2: lowercase "no" because it follows "To achieve [goal],"
      expect(screen.queryByText(/Too close to call/)).not.toBeInTheDocument()
      expect(screen.getByText(/no clear winner/)).toBeInTheDocument()
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

  // Badge Threshold — removed with OptionRow cards (P2-2)
})
