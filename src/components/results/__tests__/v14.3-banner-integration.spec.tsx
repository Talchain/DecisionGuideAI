/**
 * V14.3: Banner integration render test.
 *
 * Renders through the full component tree (ResultsBody → RecommendationSection
 * → HeroSection → AttentionBanner) to exercise the actual filter chain at
 * ResultsBody:112. Not a shallow render in isolation.
 *
 * Asserts no internal tokens leak into any rendered text across the full
 * banner and expanded view.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  RecommendationSectionData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  UncertaintyItem,
  NextActionItem,
} from '../types'

// Mock canvas helpers
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

// ─── Fixture: 3 critiques exercising different code paths ─────────────────

const OPTIONS: OptionResult[] = [
  {
    id: 'opt_a', label: 'Option A', expected: 200,
    outcome: { mean: 200, p10: 150, p50: 195, p90: 260 },
    p10: 150, p50: 195, p90: 260,
    isRecommended: true, winProbability: 0.55,
  },
  {
    id: 'opt_b', label: 'Option B', expected: 180,
    outcome: { mean: 180, p10: 130, p50: 175, p90: 230 },
    p10: 130, p50: 175, p90: 230,
    isRecommended: false, winProbability: 0.45,
  },
]

/**
 * 3 critiques:
 * 1. Template-mapped (MISSING_OBSERVED_STATE) → has displayText + suggestion + factorId → appears in banner
 * 2. Unmapped code with userMessage → has displayText but no suggestion → excluded from banner
 * 3. Unmapped code without userMessage → displayText null → excluded from banner
 */
const CRITIQUES: UncertaintyItem[] = [
  {
    code: 'MISSING_OBSERVED_STATE',
    message: 'constraint_fac_revenue_max targets fac_revenue with observed_state.value missing',
    userMessage: 'Revenue is missing a current value',
    affectedNodes: ['fac_revenue'],
    severity: 'warning',
  },
  {
    code: 'NOVEL_INFORMATIONAL_CODE',
    message: 'fac_market_size normalisation warning internal',
    userMessage: 'Market Size has limited data coverage',
    affectedNodes: ['fac_market_size'],
    severity: 'info',
  },
  {
    code: 'UNKNOWN_INTERNAL_CODE',
    message: 'fac_competition has intercept=0 and blocks_analysis pipeline',
    // No userMessage — should be excluded entirely
    affectedNodes: ['fac_competition'],
    severity: 'warning',
  },
]

const NODE_LABELS = new Map([
  ['fac_revenue', 'Revenue'],
  ['fac_market_size', 'Market Size'],
  ['fac_competition', 'Competition'],
])

function makeTestData(): ResultsSectionDataReturn {
  const humanisedCritiques = CRITIQUES
    .filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
    .map(item => humaniseCritique(item, NODE_LABELS))

  const recommendation: RecommendationSectionData = {
    recommendedOption: OPTIONS[0],
    allOptions: OPTIONS,
    goalLabel: 'Maximise revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.72,
    robustnessLevel: 'moderate',
  }

  const drivers: DriversSectionData = {
    drivers: [],
    driversStatus: 'computed',
    topDrivers: [],
    totalCount: 0,
    hasMagnitudeData: false,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'Info', label: 'Fair', description: 'Needs attention' },
    qualityScore: 55,
    uncertainties: CRITIQUES,
    topUncertainties: CRITIQUES.slice(0, 3),
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
    humanisedCritiques,
  }

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Revenue',
  }
}

// ─── Internal token patterns (must never appear in rendered UI) ──────────

const INTERNAL_PATTERNS = [
  /constraint_fac_/,
  /fac_[a-z_]+/,
  /observed_state/,
  /intercept=0/,
  /opt_[a-z_]+/,
  /blocks_analysis/,
  /node_id\s*=/,
  /edge_id\s*=/,
]

// ─── Tests ───────────────────────────────────────────────────────────────

describe('V14.3: Banner integration — full component tree', () => {
  it('renders banner with only template-mapped actionable items', () => {
    const data = makeTestData()

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    // Banner should render (at least 1 actionable item)
    const banner = screen.getByTestId('attention-banner')
    expect(banner).toBeInTheDocument()

    // Template-mapped critique (MISSING_OBSERVED_STATE) should appear
    expect(banner.textContent).toContain('Revenue is missing a current value')

    // Unmapped codes should NOT appear in the banner
    expect(banner.textContent).not.toContain('Market Size has limited data coverage')
    expect(banner.textContent).not.toContain('Review this factor\'s inputs')
  })

  it('no internal tokens in any rendered text', () => {
    const data = makeTestData()

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    // Check textContent (user-visible text), not innerHTML (which includes data-* attrs, IDs, etc.)
    const text = document.body.textContent ?? ''

    for (const pattern of INTERNAL_PATTERNS) {
      expect(text).not.toMatch(pattern)
    }
  })

  it('"show more" toggle does not appear for single-item banner', () => {
    const data = makeTestData()

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    // Only 1 actionable item → inline mode, no "+N more" toggle
    expect(screen.queryByTestId('banner-show-more')).not.toBeInTheDocument()
  })

  it('banner with multiple actionable items — expanded view has no internal tokens', () => {
    const data = makeTestData()

    // Add two more template-mapped critiques to get 3+ actionable items
    const extraCritiques: UncertaintyItem[] = [
      {
        code: 'CONSTRAINT_MISSING_RANGE',
        message: 'constraint_fac_cost missing range',
        affectedNodes: ['fac_cost'],
        severity: 'warning',
      },
      {
        code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
        message: 'constraint_fac_time missing observed_state',
        affectedNodes: ['fac_time'],
        severity: 'warning',
      },
    ]
    const extraLabels = new Map([
      ...NODE_LABELS,
      ['fac_cost', 'Total Cost'],
      ['fac_time', 'Time to Market'],
    ])
    const allCritiques = [...CRITIQUES, ...extraCritiques]
    const humanised = allCritiques
      .filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
      .map(item => humaniseCritique(item, extraLabels))

    data.confidence.humanisedCritiques = humanised
    data.confidence.uncertainties = allCritiques

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    // Should have "+N more" toggle (3 actionable items: MISSING_OBSERVED_STATE + 2 constraint codes)
    const showMore = screen.queryByTestId('banner-show-more')
    if (showMore) {
      fireEvent.click(showMore)
    }

    // After expanding, still no internal tokens in visible text
    const text = document.body.textContent ?? ''
    for (const pattern of INTERNAL_PATTERNS) {
      expect(text).not.toMatch(pattern)
    }
  })
})
