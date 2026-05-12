/**
 * ResultsBody — analysis-hero v17 flag substitution + comparison-mode tests.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 10 + §5 def-of-done:
 *   - flag-off zero-diff: render with both flags unset must be identical
 *     to the pre-change baseline (DecisionConfidencePanel renders alone).
 *   - flag-on substitution: with analysisHeroV17 on, AnalysisHeroV17 renders
 *     in place of DecisionConfidencePanel.
 *   - comparison mode: with analysisHeroCompare on, BOTH render, v17 above.
 *
 * The flag exports are mocked so each test can drive the desired state
 * deterministically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

// Mock the two new flag exports so tests can flip them per case. Other flag
// exports keep their real implementations (we pass `flags` through, then
// re-export everything else).
vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
  }
})

import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled } from '@/flags'

function makeData(): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt_b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const driversData: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers: driversData,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('ResultsBody — analysis-hero v17 flag substitution', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
  })

  it('flag-off: DecisionConfidencePanel renders, AnalysisHeroV17 does NOT (zero-diff for non-staging users)', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-hero-v17')).not.toBeInTheDocument()
  })

  it('analysisHeroV17 on: AnalysisHeroV17 renders INSTEAD OF DecisionConfidencePanel', () => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
  })

  it('comparison mode: BOTH render, v17 above legacy panel', () => {
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(true)
    const { container } = render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    const hero = screen.getByTestId('analysis-hero-v17')
    const legacy = screen.getByTestId('decision-confidence-panel')
    expect(hero).toBeInTheDocument()
    expect(legacy).toBeInTheDocument()
    // v17 must precede legacy in document order.
    expect(hero.compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    void container
  })

  it('comparison mode also active when both flags on (compare wins — never duplicates v17)', () => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(true)
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    // Exactly one of each — comparison-mode renders v17 ABOVE, then the
    // default render slot resolves to DecisionConfidencePanel because we
    // gate it on `showV17 && !showCompare`.
    expect(screen.getAllByTestId('analysis-hero-v17')).toHaveLength(1)
    expect(screen.getAllByTestId('decision-confidence-panel')).toHaveLength(1)
  })

  it('flag-off: AnalysisHeroV17 testid never appears in the tree (additive proof)', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('analysis-hero-v17')).toBeNull()
    expect(screen.queryByTestId('analysis-hero-v17-card')).toBeNull()
  })
})
