/**
 * Banned Strings Integration Test
 *
 * P0 Fix 6: Ensures deprecated copy patterns don't appear in rendered results.
 * Tests multiple fixture variants to catch regressions across data scenarios.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendationSection } from '../RecommendationSection'
import { ConfidenceSection } from '../ConfidenceSection'
import { DriversSection } from '../DriversSection'
import type { RecommendationSectionData, ConfidenceSectionData, DriversSectionData } from '../types'

// Mock canvas helpers
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

/**
 * Banned copy patterns that should never appear in the Results Panel
 * P1 Brief: "scenarios", "recommendation", "Runner-up", "win probability", "(0/1)"
 * Task D additions: "outperforms by", "points"
 * Final polish: "simulated scenarios", "Scenarios simulated"
 */
const BANNED_STRINGS = [
  'YOUR OBJECTIVE',           // Should be sentence case: "Your objective"
  "What's Influencing This",  // Should be sentence case: "What's influencing this"
  'What Needs Attention',     // Should be sentence case: "What needs attention"
  'View on canvas',           // Removed - goal text itself is now clickable
  'Runner-up',                // Should use rank-based labels: "Second strongest"
  'runner-up',                // Case variant
  'front-runner',             // P2: Use "Strongest performer" or "No clear winner" instead
  'win probability',          // PLoT-generated label for non-winners
  '(0/1)',                    // Encoding notation
  '(0-1)',                    // Encoding notation variant
  '(0–1)',                    // Encoding notation with en-dash
  'scenarios tested',         // P1: Replace with "simulations" - banned in main UI
  'of scenarios',             // P1: "% of scenarios" is banned (use "simulations" instead)
  'outperforms by',           // Task D: story_headline banned term
  'points',                   // Task D: story_headline banned term (e.g., "leads by 5 points")
  '(0–1 qualitative scale)',  // Task D: encoding pattern that should be stripped
  'simulated scenarios',      // Final polish: use "simulations" instead
  'Scenarios simulated',      // Final polish: use "Simulations run" instead
  // C8: RTL banned term additions
  'assumption tests',         // Use "simulations" instead
  'lower bound',              // Use formatted p10 value instead
  'upper bound',              // Use formatted p90 value instead
  'Could flip recommendation',// Use "Could change the recommendation" or "{alt} could become stronger"
  'Reduce uncertainty',       // Use "Review this assumption"
  'performs strongest',       // Use "performs best"
  'WHAT NEEDS',               // All-caps banned — use sentence case
  'SUCCESS TARGET',           // All-caps banned — use sentence case
  "WHAT'S INFLUENCING",       // All-caps banned, use sentence case
  '\u2014',                   // Em-dash banned, use comma or period
  '\u2013',                   // En-dash banned in user-facing text, use hyphen or comma
  // V11.2: Internal field names that must never leak to UI
  'observed_state.value',     // PLoT internal field name
  'intercept=0',              // PLoT internal parameter
  'constraint_fac_',          // PLoT internal constraint prefix
  // V12.1 Fix 2: Discrete encoding notation
  '0=Developers',             // Discrete encoding leak
  '0=Tech Lead',              // Discrete encoding leak
  // V12.1 Fix 3: Removed section heading
  'Recommended actions',      // Merged into Validate group
]

/**
 * Fixture: hasGoalThreshold scenario
 * When probability_of_goal is present with a valid threshold
 */
const fixtureWithGoalThreshold: RecommendationSectionData = {
  recommendedOption: {
    id: 'option-1',
    label: 'Option A',
    p10: 20,
    p50: 50,
    p90: 80,
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    isRecommended: true,
    winProbability: 0.72,
    goalProbability: 0.85,
    rank: 1,
  },
  allOptions: [
    {
      id: 'option-1',
      label: 'Option A',
      p10: 20,
      p50: 50,
      p90: 80,
      expected: 50,
      outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
      isRecommended: true,
      winProbability: 0.72,
      goalProbability: 0.85,
      rank: 1,
    },
    {
      id: 'option-2',
      label: 'Option B',
      p10: 15,
      p50: 40,
      p90: 70,
      expected: 40,
      outcome: { mean: 40, p10: 15, p50: 40, p90: 70 },
      isRecommended: false,
      winProbability: 0.28,
      goalProbability: 0.65,
      rank: 2,
    },
  ],
  goalLabel: 'increase revenue',
  goalThreshold: 100000,
  isSingleOption: false,
  analysisStatus: 'computed',
  outcomeUnit: 'currency',
  outcomeUnitSymbol: '$',
  recommendationStability: 0.80,
}

/**
 * Fixture: noGoalThreshold scenario
 * When probability_of_goal is absent (expected_outcome mode)
 */
const fixtureNoGoalThreshold: RecommendationSectionData = {
  recommendedOption: {
    id: 'option-1',
    label: 'Option A',
    p10: 20,
    p50: 50,
    p90: 80,
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    isRecommended: true,
    winProbability: 0.65,
    rank: 1,
  },
  allOptions: [
    {
      id: 'option-1',
      label: 'Option A',
      p10: 20,
      p50: 50,
      p90: 80,
      expected: 50,
      outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
      isRecommended: true,
      winProbability: 0.65,
      rank: 1,
    },
    {
      id: 'option-2',
      label: 'Option B',
      p10: 15,
      p50: 40,
      p90: 70,
      expected: 40,
      outcome: { mean: 40, p10: 15, p50: 40, p90: 70 },
      isRecommended: false,
      winProbability: 0.35,
      rank: 2,
    },
    {
      id: 'option-3',
      label: 'Option C',
      p10: 10,
      p50: 30,
      p90: 60,
      expected: 30,
      outcome: { mean: 30, p10: 10, p50: 30, p90: 60 },
      isRecommended: false,
      winProbability: 0.15,
      rank: 3,
    },
  ],
  goalLabel: 'maximize profit',
  isSingleOption: false,
  analysisStatus: 'computed',
  outcomeUnit: 'percent',
  recommendationStability: 0.55,
  // Fix C: Include dirty story headlines that PLoT generates
  storyHeadlines: {
    'option-1': 'Option A leads, but Factor X (0/1) → Outcome Y could swing the outcome to Option B',
    'option-2': 'Runner-up with 35% win probability',
    'option-3': 'Third place with 15% win probability',
  },
}

/**
 * Fixture: DriversSection data
 */
const driversData: DriversSectionData = {
  drivers: [
    {
      factorKey: 'factor-1',
      factorLabel: 'Market Size (0-100)',
      rawElasticity: 0.8,
      normalisedInfluence: 1.0,
      rank: 1,
      direction: 'positive',
    },
    {
      factorKey: 'factor-2',
      factorLabel: 'Tech Lead Hired (0/1)',
      rawElasticity: 0.6,
      normalisedInfluence: 0.75,
      rank: 2,
      direction: 'positive',
    },
  ],
  topDrivers: [
    {
      factorKey: 'factor-1',
      factorLabel: 'Market Size (0-100)',
      rawElasticity: 0.8,
      normalisedInfluence: 1.0,
      rank: 1,
      direction: 'positive',
    },
    {
      factorKey: 'factor-2',
      factorLabel: 'Tech Lead Hired (0/1)',
      rawElasticity: 0.6,
      normalisedInfluence: 0.75,
      rank: 2,
      direction: 'positive',
    },
  ],
  driversStatus: 'computed',
  totalCount: 2,
  hasMagnitudeData: true,
}

/**
 * Fixture: DriversSection data with (0–1 qualitative scale) encoding (Task D)
 * Tests that cleanFactorLabel strips this pattern from production payloads
 */
const driversDataWithQualitativeScale: DriversSectionData = {
  drivers: [
    {
      factorKey: 'factor-1',
      factorLabel: 'Competitive Response Intensity (0–1 qualitative scale)',
      rawElasticity: 0.9,
      normalisedInfluence: 1.0,
      rank: 1,
      direction: 'negative',
    },
    {
      factorKey: 'factor-2',
      factorLabel: 'Currency Fluctuation Impact (0–1 qualitative scale)',
      rawElasticity: 0.7,
      normalisedInfluence: 0.78,
      rank: 2,
      direction: 'negative',
    },
    {
      factorKey: 'factor-3',
      factorLabel: 'Regulatory Compliance Cost (0–1, share of £200k cap)',
      rawElasticity: 0.5,
      normalisedInfluence: 0.56,
      rank: 3,
      direction: 'negative',
    },
  ],
  topDrivers: [
    {
      factorKey: 'factor-1',
      factorLabel: 'Competitive Response Intensity (0–1 qualitative scale)',
      rawElasticity: 0.9,
      normalisedInfluence: 1.0,
      rank: 1,
      direction: 'negative',
    },
    {
      factorKey: 'factor-2',
      factorLabel: 'Currency Fluctuation Impact (0–1 qualitative scale)',
      rawElasticity: 0.7,
      normalisedInfluence: 0.78,
      rank: 2,
      direction: 'negative',
    },
  ],
  driversStatus: 'computed',
  totalCount: 3,
  hasMagnitudeData: true,
}

/**
 * Fixture: RecommendationSection with story_headlines containing banned terms (Task D)
 * Tests that story_headlines with "outperforms by" and "points" are filtered
 */
const fixtureWithBannedStoryHeadlines: RecommendationSectionData = {
  recommendedOption: {
    id: 'option-1',
    label: 'Strategy Alpha',
    p10: 30,
    p50: 60,
    p90: 90,
    expected: 60,
    outcome: { mean: 60, p10: 30, p50: 60, p90: 90 },
    isRecommended: true,
    winProbability: 0.75,
    rank: 1,
  },
  allOptions: [
    {
      id: 'option-1',
      label: 'Strategy Alpha',
      p10: 30,
      p50: 60,
      p90: 90,
      expected: 60,
      outcome: { mean: 60, p10: 30, p50: 60, p90: 90 },
      isRecommended: true,
      winProbability: 0.75,
      rank: 1,
    },
    {
      id: 'option-2',
      label: 'Strategy Beta',
      p10: 20,
      p50: 45,
      p90: 75,
      expected: 45,
      outcome: { mean: 45, p10: 20, p50: 45, p90: 75 },
      isRecommended: false,
      winProbability: 0.25,
      rank: 2,
    },
  ],
  goalLabel: 'maximize ROI',
  isSingleOption: false,
  analysisStatus: 'computed',
  outcomeUnit: 'percent',
  recommendationStability: 0.70,
  // Task D: story_headlines with banned substrings
  storyHeadlines: {
    'option-1': 'Strategy Alpha outperforms by 15 points under most conditions',
    'option-2': 'Strategy Beta trails by 10 points but outperforms by 5 points in volatile markets',
  },
}

/**
 * Fixture: ConfidenceSection data
 */
const confidenceData: ConfidenceSectionData = {
  tier: {
    tier: 'fair',
    label: 'Partial picture',
    description: 'Your model covers the basics.',
  },
  qualityScore: 65,
  uncertainties: [
    {
      code: 'SENSITIVE_ASSUMPTION',
      message: 'If "Market Size (0-100) → Revenue" changes, results may shift.',
      suggestion: 'Review estimate',
    },
  ],
  topUncertainties: [
    {
      code: 'SENSITIVE_ASSUMPTION',
      message: 'If "Market Size (0-100) → Revenue" changes, results may shift.',
      suggestion: 'Review estimate',
    },
  ],
  improvements: [],
  topImprovements: [],
  evidenceGaps: [
    {
      factorId: 'factor-2',
      factorLabel: 'Tech Lead Hired (0/1)',
      gapType: 'missing_evidence',
    },
  ],
  topEvidenceGaps: [
    {
      factorId: 'factor-2',
      factorLabel: 'Tech Lead Hired (0/1)',
      gapType: 'missing_evidence',
    },
  ],
}

describe('Banned Strings Integration Test', () => {
  describe('RecommendationSection', () => {
    it('does not contain banned strings with goal threshold', () => {
      render(<RecommendationSection data={fixtureWithGoalThreshold} />)

      const html = document.body.innerHTML
      for (const banned of BANNED_STRINGS) {
        expect(html).not.toContain(banned)
      }
    })

    it('does not contain banned strings without goal threshold', () => {
      render(<RecommendationSection data={fixtureNoGoalThreshold} />)

      const html = document.body.innerHTML
      for (const banned of BANNED_STRINGS) {
        expect(html).not.toContain(banned)
      }
    })

    it('shows win probability in HeroSection when probability_of_goal is absent (P2 Task 4)', () => {
      render(<RecommendationSection data={fixtureNoGoalThreshold} />)

      // HeroSection headline renders "performs best"
      expect(screen.getByText(/performs best/)).toBeInTheDocument()

      // V9.2: Win probability now shown via WinGauge inside HeroSection (not per-option text)
      // OptionCards with "Wins" stat bars are rendered at ResultsBody level, not here
      expect(screen.getByTestId('hero-section')).toBeInTheDocument()

      // Should NOT show "X expected" values
      expect(screen.queryByText(/\d+%? expected/i)).not.toBeInTheDocument()

      // Should NOT show "chance of achieving" in hero (no goal threshold)
      expect(screen.queryByText(/chance of achieving/i)).not.toBeInTheDocument()
    })

    it('cleans story headlines and hides Runner-up labels', () => {
      render(<RecommendationSection data={fixtureNoGoalThreshold} />)

      // Fix B: Story headlines with "(0/1)" should be cleaned
      // Winner headline should be cleaned and shown
      // But "(0/1)" pattern should not appear
      expect(screen.queryByText(/\(0\/1\)/)).not.toBeInTheDocument()

      // "Runner-up" from non-winner story headlines should NOT appear
      expect(screen.queryByText(/Runner-up/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/win probability/i)).not.toBeInTheDocument()
    })

    it('Task D: does not render story headlines with "outperforms by" or "points"', () => {
      render(<RecommendationSection data={fixtureWithBannedStoryHeadlines} />)

      const html = document.body.innerHTML

      // Story headlines are no longer rendered inside RecommendationSection
      // (they render via OptionCards at ResultsBody level)
      // Verify banned terms don't appear anywhere in HeroSection output
      expect(html).not.toContain('outperforms by')
      expect(html).not.toContain('points')

      // V9.2: Winner appears in merged headline, other option names only in OptionCards (ResultsBody)
      expect(screen.getByText(/Strategy Alpha performs best/)).toBeInTheDocument()
    })
  })

  describe('DriversSection', () => {
    it('does not contain banned strings', () => {
      render(<DriversSection data={driversData} goalLabel="test goal" />)

      const html = document.body.innerHTML
      for (const banned of BANNED_STRINGS) {
        expect(html).not.toContain(banned)
      }
    })

    it('cleans encoding notation from factor labels', () => {
      render(<DriversSection data={driversData} goalLabel="test goal" />)

      // cleanFactorLabel should strip (0-100) and (0/1) patterns
      expect(screen.getByText('Market Size')).toBeInTheDocument()
      expect(screen.getByText('Tech Lead Hired')).toBeInTheDocument()
      expect(screen.queryByText(/\(0-100\)/)).not.toBeInTheDocument()
      expect(screen.queryByText(/\(0\/1\)/)).not.toBeInTheDocument()
    })

    it('Task D: strips (0–1 qualitative scale) encoding from production payloads', () => {
      render(<DriversSection data={driversDataWithQualitativeScale} goalLabel="test goal" />)

      // cleanFactorLabel should strip (0–1 qualitative scale) patterns
      // Top 2 drivers are shown by default
      expect(screen.getByText('Competitive Response Intensity')).toBeInTheDocument()
      expect(screen.getByText('Currency Fluctuation Impact')).toBeInTheDocument()

      // Encoding notation should NOT appear anywhere in rendered output
      const html = document.body.innerHTML
      expect(html).not.toContain('(0–1 qualitative scale)')
      expect(html).not.toContain('qualitative scale')
      expect(html).not.toContain('share of £200k cap')
    })
  })

  describe('ConfidenceSection', () => {
    it('does not contain banned strings', () => {
      render(<ConfidenceSection data={confidenceData} />)

      const html = document.body.innerHTML
      for (const banned of BANNED_STRINGS) {
        expect(html).not.toContain(banned)
      }
    })

    it('cleans encoding notation from evidence gap labels', () => {
      render(<ConfidenceSection data={confidenceData} />)

      // stripEncodingNotation should clean the factor label
      expect(screen.getByText('Tech Lead Hired')).toBeInTheDocument()
      expect(screen.queryByText(/\(0\/1\)/)).not.toBeInTheDocument()
    })
  })

  describe('DriversSection confidence method labels', () => {
    it('does not render confidence_source method labels (graph/isl)', () => {
      // confidence_source is a diagnostic field only, never user-facing
      const driversWithConfidence: DriversSectionData = {
        ...driversData,
        drivers: driversData.drivers.map((d) => ({
          ...d,
          confidence: 0.75,
          semanticLabel: 'biggest' as const,
          canFocus: false,
        })),
        topDrivers: driversData.topDrivers.map((d) => ({
          ...d,
          confidence: 0.75,
          semanticLabel: 'biggest' as const,
          canFocus: false,
        })),
      }
      render(<DriversSection data={driversWithConfidence} goalLabel="test goal" />)

      const html = document.body.innerHTML.toLowerCase()
      // confidence_source values must not appear as method indicator text
      expect(html).not.toContain('source: graph')
      expect(html).not.toContain('source: isl')
      // Method labels must not appear near confidence context
      expect(html).not.toMatch(/confidence.*\bgraph\b/)
      expect(html).not.toMatch(/confidence.*\bisl\b/)
    })
  })

  describe('All fixtures combined check', () => {
    it('ensures BANNED_STRINGS array is comprehensive', () => {
      // Meta-test: verify our banned list covers expected patterns
      expect(BANNED_STRINGS).toContain('YOUR OBJECTIVE')
      expect(BANNED_STRINGS).toContain("What's Influencing This")
      expect(BANNED_STRINGS).toContain('What Needs Attention')
      expect(BANNED_STRINGS).toContain('View on canvas')
      expect(BANNED_STRINGS).toContain('Runner-up')
      // P2 additions
      expect(BANNED_STRINGS).toContain('front-runner')
      // P1 additions
      expect(BANNED_STRINGS).toContain('scenarios tested')
      expect(BANNED_STRINGS).toContain('of scenarios')
      expect(BANNED_STRINGS).toContain('win probability')
      expect(BANNED_STRINGS).toContain('(0/1)')
      // Task D additions
      expect(BANNED_STRINGS).toContain('outperforms by')
      expect(BANNED_STRINGS).toContain('points')
      expect(BANNED_STRINGS).toContain('(0–1 qualitative scale)')
      // Final polish additions
      expect(BANNED_STRINGS).toContain('simulated scenarios')
      expect(BANNED_STRINGS).toContain('Scenarios simulated')
      // C8: RTL banned term additions
      expect(BANNED_STRINGS).toContain('assumption tests')
      expect(BANNED_STRINGS).toContain('lower bound')
      expect(BANNED_STRINGS).toContain('upper bound')
      expect(BANNED_STRINGS).toContain('Could flip recommendation')
      expect(BANNED_STRINGS).toContain('Reduce uncertainty')
      expect(BANNED_STRINGS).toContain('performs strongest')
      // V11: em-dash ban
      expect(BANNED_STRINGS).toContain('\u2014')
      // V12.2 Fix 2: Internal pattern bans
      expect(BANNED_STRINGS).toContain('observed_state.value')
      expect(BANNED_STRINGS).toContain('intercept=0')
      expect(BANNED_STRINGS).toContain('constraint_fac_')
    })
  })
})
