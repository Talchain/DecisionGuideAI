/**
 * V14.3: Banner integration render test.
 *
 * Renders through the full component tree (ResultsBody → AttentionBanner)
 * to exercise the actual filter chain. Not a shallow render in isolation.
 * (HeroSection and RecommendationSection were deleted in Brief 5.4 Phase 2.)
 *
 * Asserts:
 * - No internal tokens leak into any rendered text.
 * - The dedup filter (closeout item 1) correctly suppresses critiques whose
 *   factorId is already shown in the DCP top-evidence TriageCards.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  UncertaintyItem,
  NextActionItem,
  EvidenceGapItem,
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

  const recommendation: DecisionResultData = {
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

// ─── Brief 5.4 closeout item 1: AttentionBanner ↔ DCP dedup regression ──────
//
// The ResultsBody filter (introduced in closeout item 1) excludes any critique
// whose factorId already appears in confidence.topEvidenceGaps (or evidenceGaps
// as fallback). The existing tests above always use topEvidenceGaps: [] and
// therefore never exercise the match path. These tests close that gap.

describe('V14.3 item-1 dedup: banner suppresses critiques already in DCP evidence gaps', () => {
  const DEDUP_CRITIQUES: UncertaintyItem[] = [
    {
      // This critique's affectedNodes[0] matches a topEvidenceGap factorId.
      // It should be SUPPRESSED by the ResultsBody filter.
      code: 'MISSING_OBSERVED_STATE',
      message: 'constraint_fac_revenue_max targets fac_revenue with observed_state.value missing',
      affectedNodes: ['fac_revenue'],
      severity: 'warning',
    },
    {
      // This critique's affectedNodes[0] does NOT match any evidence gap.
      // It should APPEAR in the banner.
      code: 'CONSTRAINT_MISSING_RANGE',
      message: 'constraint_fac_cost missing range',
      affectedNodes: ['fac_cost'],
      severity: 'warning',
    },
  ]

  const DEDUP_LABELS = new Map([
    ['fac_revenue', 'Revenue'],
    ['fac_cost', 'Total Cost'],
  ])

  const DCP_EVIDENCE_GAP: EvidenceGapItem = {
    factorId: 'fac_revenue',
    factorLabel: 'Revenue',
    confidence: 40,
    voi: 0.8,
    evpiPp: 12,
    suggestion: 'Observe current revenue value',
  }

  function makeDedupData(): ResultsSectionDataReturn {
    const humanisedCritiques = DEDUP_CRITIQUES.map(item =>
      humaniseCritique(item, DEDUP_LABELS),
    )

    const recommendation: DecisionResultData = {
      recommendedOption: OPTIONS[0],
      allOptions: OPTIONS,
      goalLabel: 'Maximise revenue',
      isSingleOption: false,
      analysisStatus: 'computed',
      recommendationStability: 0.85,
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
      uncertainties: DEDUP_CRITIQUES,
      topUncertainties: DEDUP_CRITIQUES,
      improvements: [],
      topImprovements: [],
      evidenceGaps: [DCP_EVIDENCE_GAP],
      // topEvidenceGaps contains fac_revenue — the banner filter must exclude it
      topEvidenceGaps: [DCP_EVIDENCE_GAP],
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

  it('critique whose factorId matches a DCP topEvidenceGap is suppressed from the banner', () => {
    render(
      <ResultsBody
        resultsSectionData={makeDedupData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const banner = screen.getByTestId('attention-banner')
    // fac_cost critique has no evidence gap overlap → must appear
    expect(banner.textContent).toContain('Total Cost')

    // fac_revenue critique IS in topEvidenceGaps → must NOT appear in banner
    // (it is already shown as a DCP TriageCard, showing it again would be a duplicate)
    expect(banner.textContent).not.toContain('Revenue is missing a current value')
  })

  it('critique whose factorId matches only evidenceGaps (not topEvidenceGaps) is still suppressed', () => {
    // ResultsBody uses topEvidenceGaps ?? evidenceGaps as the fallback.
    // When topEvidenceGaps is absent the filter must still fire via evidenceGaps.
    const data = makeDedupData()
    data.confidence.topEvidenceGaps = undefined

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const banner = screen.getByTestId('attention-banner')
    expect(banner.textContent).toContain('Total Cost')
    expect(banner.textContent).not.toContain('Revenue is missing a current value')
  })

  it('critique whose factorId has NO evidence gap overlap is not suppressed', () => {
    // Sanity-check: when evidence gaps are empty the banner shows all eligible critiques.
    // With 2 items the banner collapses by default — expand before asserting text.
    const data = makeDedupData()
    data.confidence.topEvidenceGaps = []
    data.confidence.evidenceGaps = []

    render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const banner = screen.getByTestId('attention-banner')
    // 2 items → collapsed; "2 items to review" confirms both are present
    expect(banner.textContent).toContain('2 items to review')

    // Expand the toggle to make item text available in the DOM
    const toggle = banner.querySelector('button[aria-expanded]')
    if (toggle) fireEvent.click(toggle)

    // Both critiques now eligible and visible after expansion
    expect(banner.textContent).toContain('Revenue is missing a current value')
    expect(banner.textContent).toContain('Total Cost')
  })
})
