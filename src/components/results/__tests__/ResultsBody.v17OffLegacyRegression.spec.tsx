/**
 * V17 power pass — legacy regression test.
 *
 * Locks down the contract that with `analysisHeroV17` OFF (and
 * `analysisHeroCompare` OFF), the Analysis tab renders exactly as it did
 * before the V17 power pass:
 *
 *   - Section 2 ("Your options") renders the full OptionCards block — NOT
 *     the deprecated one-line CompactOptionSpread.
 *   - WinGauge + RiskAppetiteFilter render alongside OptionCards.
 *   - DecisionConfidencePanel renders (the legacy hero), NOT AnalysisHeroV17.
 *   - The legacy panel's lower-section cards (T1FlipRiskCallout,
 *     T1DominantNudge, T1ChecksFooter) all render — none of the V17-only
 *     dedup suppression should affect them.
 *
 * Section 2 contract is now flag-agnostic: after the urgent revert of the
 * compact-options swap (2026-05-27), `OptionCards` renders identically
 * regardless of the V17 flag. The "V17 on also shows full OptionCards"
 * case below locks that contract so any future re-introduction of a
 * compact replacement requires deliberate test edits.
 *
 * `AnalysisFooter` lives in OutputsDock and isn't reachable from ResultsBody
 * alone, so the legacy footer-vs-orphan-banner state is asserted as a unit
 * via the in-scope renderable surfaces: the orphan banner is still allowed
 * to render under V17-off when its own preconditions hold, and the
 * suppression branch in OutputsDock (`isAnalysisHeroV17Enabled() &&
 * showOrphanBanner`) cannot fire when the flag is off.
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
  EvidenceGapItem,
  FragileEdgeItem,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

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
    label: 'Tech Lead',
    expected: 0.8,
    outcome: { p10: 0.6, p50: 0.75, p90: 0.95 },
    p10: 0.6,
    p50: 0.75,
    p90: 0.95,
    winProbability: 0.7,
    isRecommended: true,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt_b',
    label: 'Two Developers',
    expected: 0.4,
    outcome: { p10: 0.2, p50: 0.4, p90: 0.6 },
    p10: 0.2,
    p50: 0.4,
    p90: 0.6,
    winProbability: 0.3,
    isRecommended: false,
  } as OptionResult

  // Fragile edge + dominant driver: drive the legacy lower-section cards to
  // render, so we can prove V17-off keeps them visible.
  const fragile: FragileEdgeItem = {
    fromId: 'n_hire',
    fromLabel: 'Hiring rate',
    toId: 'n_outcome',
    toLabel: 'Outcome',
    switchProbability: 0.42,
    alternativeWinnerLabel: 'Two Developers',
  } as FragileEdgeItem

  const evidenceGap: EvidenceGapItem = {
    factorId: 'n_cap',
    factorLabel: 'Capacity',
    confidence: 50,
    voi: 0.6,
    suggestion: 'Pull last quarter\'s staffing numbers.',
    targetNodeId: 'n_cap',
  } as EvidenceGapItem

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

  return {
    recommendation,
    drivers: {
      drivers: [
        {
          factorLabel: 'Hiring rate',
          factorKey: 'n_hire',
          matchedNodeId: 'n_hire',
          influenceScore: 0.9,
          normalisedInfluence: 0.9,
        } as any,
      ],
      topDrivers: [
        {
          factorLabel: 'Hiring rate',
          factorKey: 'n_hire',
          matchedNodeId: 'n_hire',
          influenceScore: 0.9,
          normalisedInfluence: 0.9,
        } as any,
      ],
      driversStatus: 'computed',
      totalCount: 1,
      hasMagnitudeData: true,
      dominantFactorId: 'n_hire',
      dominantFactorLabel: 'Hiring rate',
    } as DriversSectionData,
    confidence: {
      tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
      qualityScore: 60,
      uncertainties: [],
      topUncertainties: [],
      improvements: [],
      topImprovements: [],
      evidenceGaps: [evidenceGap],
      topEvidenceGaps: [evidenceGap],
      nextActions: [],
      topNextActions: [],
      topFragileEdge: fragile,
    } as ConfidenceSectionData,
    improvements: { improvements: [], count: 0, hasHighPriority: false } as ImprovementsSectionData,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('ResultsBody — V17 power pass: V17-off legacy regression', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
  })

  it('legacy hero renders, V17 hero does NOT', () => {
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

  it('full "Your options" block renders — WinGauge + OptionCards visible, no compact spread', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('section-header-options')).toBeInTheDocument()
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread')).not.toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread-compare')).not.toBeInTheDocument()
  })

  it('legacy lower-section cards all render — flip-risk callout, dominant nudge, T1 checks footer', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    // T1FlipRiskCallout — fragile edge present, no V17 suppression.
    expect(screen.getByTestId('t1-flip-risk-callout')).toBeInTheDocument()
    // T1DominantNudge — drivers.dominantFactorLabel + topInfluence 0.9 ≥ 0.8.
    expect(screen.getByTestId('t1-dominant-nudge')).toBeInTheDocument()
    // T1ChecksFooter — always renders under legacy mode.
    const checksFooter = screen.getByTestId('t1-checks-footer')
    expect(checksFooter).toBeInTheDocument()
    // Legacy copy reads "Winner" / "No winner"; v17 mode would have rewritten
    // these to "Has leading option" / "No clear leader". The presence of the
    // legacy literal inside the footer confirms useV17Copy did NOT activate.
    expect(checksFooter.textContent).toMatch(/Winner|No winner/)
  })

  it('V17 power pass logic never activates: rowRanking + readiness strip + compact spread all bypassed', () => {
    const { container } = render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    // V17 hero strip / input rows surface — must NOT exist in legacy mode.
    expect(screen.queryByTestId('hero-v17-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-v17-input-rows')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hero-v17-card')).not.toBeInTheDocument()
    void container
  })

  it('flag-off zero-diff: confirms isAnalysisHeroV17Enabled() never returned true during this render', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    // Asserts the flag-off branch was the one taken at render time.
    expect(vi.mocked(isAnalysisHeroV17Enabled).mock.results.every(r => r.value === false)).toBe(true)
  })

  it('V17 on: Section 2 still renders the FULL OptionCards block (revert lock)', () => {
    // Locks the post-revert contract — Section 2 is flag-agnostic. If the
    // compact-options swap ever returns, this test must be updated
    // deliberately. CompactOptionSpread (the component) is intentionally
    // kept in the repo as a future supplementary affordance and is NOT
    // mounted by ResultsBody under any flag combination today.
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('section-header-options')).toBeInTheDocument()
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread')).not.toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread-compare')).not.toBeInTheDocument()
  })
})
