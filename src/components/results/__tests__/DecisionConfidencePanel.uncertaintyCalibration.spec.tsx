/**
 * Sci-4B verbal uncertainty calibration — DecisionConfidencePanel headline
 * integration.
 *
 * Maps the wire robustness band (recommendation.robustnessLevel/Label) +
 * the winner's outcome interval to a fixed verbal-framing sentence rendered
 * near the hero headline. RED per tier fixture + absent-field honest-render.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
} from '../types'

function makeData(overrides: {
  robustnessLevel?: DecisionResultData['robustnessLevel']
  robustnessLabel?: DecisionResultData['robustnessLabel']
  p10?: number | null
  p90?: number | null
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expected: 0.8,
    outcome: {
      p10: overrides.p10 ?? null,
      p50: 0.8,
      p90: overrides.p90 ?? null,
    },
    p10: overrides.p10 ?? null,
    p50: 0.8,
    p90: overrides.p90 ?? null,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.9,
    robustnessLevel: overrides.robustnessLevel,
    robustnessLabel: overrides.robustnessLabel,
    coachingReadiness: 'ready',
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: true,
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
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('DecisionConfidencePanel — Sci-4B verbal uncertainty calibration', () => {
  it('renders "fairly confident" copy for high robustness + tight (non-straddling) interval', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessLevel: 'high', p10: 0.2, p90: 0.5 })}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('uncertainty-calibration-copy')).toHaveTextContent(
      'This result looks fairly confident.',
    )
  })

  it('renders "meaningful uncertainty" copy for moderate robustness', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessLevel: 'moderate' })}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('uncertainty-calibration-copy')).toHaveTextContent(
      "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    )
  })

  it('renders "tentative" copy for low/fragile robustness', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessLevel: 'very_low' })}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('uncertainty-calibration-copy')).toHaveTextContent(
      'This result is tentative. The uncertainty is substantial.',
    )
  })

  it('downgrades "high" band to the moderate framing when the interval straddles zero', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ robustnessLevel: 'high', p10: -0.1, p90: 0.3 })}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('uncertainty-calibration-copy')).toHaveTextContent(
      "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    )
  })

  it('honest-render: renders nothing when the wire carries no robustness signal at all', () => {
    render(<DecisionConfidencePanel data={makeData({})} onSendMessage={() => {}} />)
    expect(screen.queryByTestId('uncertainty-calibration-copy')).toBeNull()
  })
})
