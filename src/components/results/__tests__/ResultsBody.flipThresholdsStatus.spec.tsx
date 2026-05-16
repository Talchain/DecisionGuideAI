/**
 * Display-honesty (B) — flip_thresholds_status soft note.
 *
 * When PLoT classifies the post-denormalised flip_thresholds[] array, the
 * tornado-section accordion renders a single short explanatory line for
 * 'all_no_effect' and 'partial_no_effect', and renders nothing extra for
 * 'computed' or absent classification. The tornado chart itself is
 * unchanged in every case.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import type { TornadoRow } from '../TornadoChart'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.7,
    outcome: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9 },
    p10: 0.5,
    p50: 0.7,
    p90: 0.9,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
    ...overrides,
  } as OptionResult
}

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Top driver',
    rawElasticity: 1,
    normalisedInfluence: 1,
    influenceScore: 0.9,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
    confidence: 0.7,
    ...overrides,
  } as DriverItem
}

function makeData(overrides: Partial<DecisionResultData> = {}): ResultsSectionDataReturn {
  const winner = makeOption()
  const runnerUp = makeOption({ id: 'opt_b', label: 'Option B', isRecommended: false, winProbability: 0.3 })

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
    ...overrides,
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [makeDriver()],
    topDrivers: [makeDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
  } as DriversSectionData

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
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

const tornadoData = {
  rows: [
    {
      factorKey: 'fac_top',
      label: 'Top driver',
      lowOutcome: 0.4,
      highOutcome: 0.9,
      canFocus: true,
      matchedNodeId: 'node_top',
      direction: 'positive' as const,
    } satisfies TornadoRow,
  ],
  expectedOutcome: 0.7,
}

describe('ResultsBody — display-honesty (B) flip_thresholds_status', () => {
  it("renders 'No single tested factor changed the leading option…' for all_no_effect", () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: 'all_no_effect' })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    const note = screen.getByTestId('flip-thresholds-status-note')
    expect(note).toBeInTheDocument()
    expect(note.textContent).toBe('No single tested factor changed the leading option within the current range.')
    expect(note.getAttribute('role')).toBe('note')
  })

  it("renders 'Some factors did not change the leading option…' for partial_no_effect with no unresolved entries", () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: 'partial_no_effect' })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    const note = screen.getByTestId('flip-thresholds-status-note')
    expect(note).toBeInTheDocument()
    expect(note.textContent).toBe('Some factors did not change the leading option within the current range.')
  })

  it("renders the mixed-with-unresolved variant when partial_no_effect also has unresolved entries (avoids implying all non-computed were harmless)", () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({
          flipThresholdsStatus: 'partial_no_effect',
          flipThresholdsHasUnresolved: true,
        })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    const note = screen.getByTestId('flip-thresholds-status-note')
    expect(note).toBeInTheDocument()
    expect(note.textContent).toBe(
      'Some factors did not change the leading option within the current range, and others could not be resolved.',
    )
  })

  it('renders no note for computed classification', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: 'computed' })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('flip-thresholds-status-note')).not.toBeInTheDocument()
  })

  it('renders no note for unresolved classification (avoids noisy or misleading UI)', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: 'unresolved' })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('flip-thresholds-status-note')).not.toBeInTheDocument()
  })

  it('renders no note when flipThresholdsStatus is absent (older PLoT builds — backward-compatible silent absence)', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: undefined })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('flip-thresholds-status-note')).not.toBeInTheDocument()
  })

  it('the all_no_effect copy avoids banned wording (winner / winning / recommended / recommendation / Monte Carlo / no_effect)', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData({ flipThresholdsStatus: 'all_no_effect' })}
        tornadoData={tornadoData}
        onSendMessage={() => {}}
      />,
    )
    const text = screen.getByTestId('flip-thresholds-status-note').textContent ?? ''
    expect(text.toLowerCase()).not.toMatch(/\bwinner\b|\bwinning\b|\brecommend(ed|ation)\b|monte\s*carlo|no_effect/i)
  })
})
