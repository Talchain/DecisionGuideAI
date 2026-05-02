/**
 * DecisionConfidencePanel — Brief 5.8B hotfix regressions.
 *
 * Fix 1: Stability indicator renders as a plain text label ("Stability: N%"),
 * not a progress-bar element. The bar layout was causing misalignment with the
 * Evidence/Robustness/Framing dimension grid in the right column.
 *
 * Fix 2: Dominant-factor nudge preserves the full factor name — never truncated.
 * Only the explanation text ("drives N% of the outcome.") is allowed to clip.
 * Asserts that the factor name span has whitespace-nowrap and does NOT carry truncate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  DriverItem,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
} from '../types'
import { useCanvasStore } from '@/canvas/store'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Top factor',
    rawElasticity: 1,
    normalisedInfluence: 0.85,
    influenceScore: 0.85,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
    ...overrides,
  }
}

function makeData(overrides: {
  stabilityScore?: number
  topInfluence?: number
  dominantFactorLabel?: string
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const topInfluence = overrides.topInfluence ?? 0.3
  const drivers: DriverItem[] = [makeDriver({ influenceScore: topInfluence, normalisedInfluence: topInfluence })]

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: overrides.stabilityScore ?? 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const driversSection: DriversSectionData = {
    drivers,
    topDrivers: drivers,
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
    dominantFactorLabel: overrides.dominantFactorLabel,
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
    drivers: driversSection,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

beforeEach(() => {
  useCanvasStore.setState({ draftCoaching: null })
})

describe('DecisionConfidencePanel — 5.8B hotfix: stability indicator layout', () => {
  it('renders stability as a plain text element, not a bar', () => {
    render(<DecisionConfidencePanel data={makeData({ stabilityScore: 0.87 })} />)
    const indicator = screen.getByTestId('hero-stability-indicator')
    // Must be a <p> tag, not a div wrapping a bar.
    expect(indicator.tagName).toBe('P')
    expect(indicator).toHaveTextContent('Stability: 87%')
  })

  it('suppresses stability indicator when stability is missing', () => {
    const data = makeData()
    // @ts-expect-error — intentionally clearing the field to test suppression
    data.recommendation.recommendationStability = undefined
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByTestId('hero-stability-indicator')).not.toBeInTheDocument()
  })

  it('suppresses stability indicator when stability is NaN', () => {
    const data = makeData()
    // @ts-expect-error — testing NaN guard
    data.recommendation.recommendationStability = NaN
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByTestId('hero-stability-indicator')).not.toBeInTheDocument()
  })
})

describe('DecisionConfidencePanel — 5.8B hotfix: dominant nudge factor-name preservation', () => {
  const LONG_FACTOR = 'Senior Technical Leadership in Place'

  it('shows the full factor name in the nudge row', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ topInfluence: 0.9, dominantFactorLabel: LONG_FACTOR })}
      />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge).toHaveTextContent(LONG_FACTOR)
  })

  it('factor name span has whitespace-nowrap and does not carry truncate', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ topInfluence: 0.9, dominantFactorLabel: LONG_FACTOR })}
      />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    // The factor name lives in a span that must NOT have truncate.
    // Query all spans within the nudge and find the one with the factor name.
    const spans = nudge.querySelectorAll('span')
    const factorSpan = Array.from(spans).find(s => s.textContent?.includes(LONG_FACTOR))
    expect(factorSpan).toBeDefined()
    expect(factorSpan!.classList.contains('truncate')).toBe(false)
    expect(factorSpan!.classList.contains('whitespace-nowrap')).toBe(true)
  })

  it('explanation span carries the truncate class', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ topInfluence: 0.9, dominantFactorLabel: LONG_FACTOR })}
      />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    const spans = nudge.querySelectorAll('span')
    const explSpan = Array.from(spans).find(s => s.textContent?.includes('drives') && s.textContent?.includes('% of the outcome'))
    expect(explSpan).toBeDefined()
    expect(explSpan!.classList.contains('truncate')).toBe(true)
  })
})
