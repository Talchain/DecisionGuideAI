/**
 * ResultsBody — V17 power pass: compact "Your options" replacement.
 *
 * When `analysisHeroV17` is on (and comparison mode is off), the Analysis
 * tab swaps the large OptionCards block for a one-line CompactOptionSpread
 * with a "Compare options" link. The Compare tab keeps its own full-card
 * render path; this swap is Analysis-tab-only.
 *
 * Legacy regression: with V17 off, the full OptionCards block must render
 * exactly as before.
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

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
  }
})

import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled } from '@/flags'

function makeData(opts: { options?: OptionResult[] } = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Tech Lead',
    expected: 0.8,
    outcome: { p10: 0.6, p50: 0.75, p90: 0.95 },
    p10: 0.6,
    p50: 0.75,
    p90: 0.95,
    winProbability: 0.8,
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
    winProbability: 0.18,
    isRecommended: false,
  } as OptionResult
  const thirdOption: OptionResult = {
    id: 'opt_c',
    label: 'Hold',
    expected: 0.1,
    outcome: { p10: 0, p50: 0.1, p90: 0.2 },
    p10: 0,
    p50: 0.1,
    p90: 0.2,
    winProbability: 0.02,
    isRecommended: false,
  } as OptionResult

  const allOptions = opts.options ?? [winner, runnerUp, thirdOption]

  const recommendation: DecisionResultData = {
    recommendedOption: allOptions[0],
    allOptions,
    goalLabel: 'Maximise success',
    isSingleOption: allOptions.length === 1,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  return {
    recommendation,
    drivers: {
      drivers: [],
      topDrivers: [],
      driversStatus: 'computed',
      totalCount: 0,
      hasMagnitudeData: false,
    } as DriversSectionData,
    confidence: {
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
    } as ConfidenceSectionData,
    improvements: { improvements: [], count: 0, hasHighPriority: false } as ImprovementsSectionData,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('ResultsBody — V17 compact "Your options"', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
  })

  it('V17 on (no compare): renders compact spread, hides full OptionCards + WinGauge', () => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('compact-option-spread')).toBeInTheDocument()
    expect(screen.getByTestId('compact-option-spread-compare')).toBeInTheDocument()
    // Section header still renders so the "Your options" label is preserved.
    expect(screen.getByTestId('section-header-options')).toBeInTheDocument()
    // Full cards block must be gone.
    expect(screen.queryByTestId('option-cards')).not.toBeInTheDocument()
  })

  it('V17 off: renders full OptionCards block, no compact spread', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread')).not.toBeInTheDocument()
  })

  it('comparison mode (both flags on): keeps full OptionCards (compare wins, never compact)', () => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(true)
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread')).not.toBeInTheDocument()
  })

  it('single-option fixture: section is not rendered (existing guard preserved under V17)', () => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    const onlyOne = makeData({
      options: [{
        id: 'opt_a',
        label: 'Only Option',
        winProbability: 1,
        isRecommended: true,
        expected: 0.7,
        outcome: { p10: 0.5, p50: 0.7, p90: 0.9 },
        p10: 0.5,
        p50: 0.7,
        p90: 0.9,
      } as OptionResult],
    })
    onlyOne.recommendation.isSingleOption = true
    render(
      <ResultsBody
        resultsSectionData={onlyOne}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('section-header-options')).not.toBeInTheDocument()
    expect(screen.queryByTestId('compact-option-spread')).not.toBeInTheDocument()
    expect(screen.queryByTestId('option-cards')).not.toBeInTheDocument()
  })
})
