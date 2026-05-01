/**
 * DecisionConfidencePanel — Brief 5.8B D2a hero integration.
 *
 * Verifies the post-analysis hero card renders, in addition to the existing
 * win-probability ring + headline:
 *   - a Stability indicator below the ring caption (suppressed when null)
 *   - a HeroQualifier line (when the lowest readiness dim < 0.7)
 *   - 3 readiness dimension bars (Evidence / Robustness / Framing) keyed off
 *     the data-supplied {evidence, robustness, clarity} set
 *
 * The dimension audit (per the brief): post-analysis data supplies the
 * 3-key set; we render only those 3 bars rather than inventing the
 * wireframe's 4-dim set.
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

interface FixtureOpts {
  recommendationStability?: number | undefined
  coachingReadinessDimensions?: {
    evidence: number
    robustness: number
    clarity: number
  } | undefined
}

function makeData(opts: FixtureOpts = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt-b',
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
    recommendationStability:
      'recommendationStability' in opts ? opts.recommendationStability : 0.82,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions:
      'coachingReadinessDimensions' in opts
        ? opts.coachingReadinessDimensions
        : { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
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
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('DecisionConfidencePanel — Brief 5.8B D2a hero', () => {
  it('renders 3 readiness dimension bars (Evidence / Robustness / Framing) when data supplies dimensions', () => {
    render(<DecisionConfidencePanel data={makeData()} />)
    expect(screen.getByText('Evidence')).toBeInTheDocument()
    expect(screen.getByText('Robustness')).toBeInTheDocument()
    expect(screen.getByText('Framing')).toBeInTheDocument()
  })

  it('omits dimension bars when readinessDimensions is undefined (sparse bundle)', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ coachingReadinessDimensions: undefined })}
      />,
    )
    expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Robustness')).not.toBeInTheDocument()
    expect(screen.queryByText('Framing')).not.toBeInTheDocument()
  })

  it('renders the Stability indicator + percent when recommendationStability is present', () => {
    render(<DecisionConfidencePanel data={makeData({ recommendationStability: 0.82 })} />)
    const indicator = screen.getByTestId('hero-stability-indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveTextContent('Stability')
    expect(indicator).toHaveTextContent('82%')
  })

  it('suppresses the Stability indicator when recommendationStability is missing — never emits NaN', () => {
    render(<DecisionConfidencePanel data={makeData({ recommendationStability: undefined })} />)
    expect(screen.queryByTestId('hero-stability-indicator')).not.toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('renders HeroQualifier when the lowest dimension < 0.7', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          coachingReadinessDimensions: { evidence: 0.4, robustness: 0.8, clarity: 0.85 },
        })}
      />,
    )
    const q = screen.getByTestId('hero-qualifier')
    expect(q).toBeInTheDocument()
    expect(q).toHaveTextContent('Confidence limited by unverified estimates')
    expect(q.getAttribute('data-qualifier-dimension')).toBe('evidence')
  })

  it('suppresses HeroQualifier when every dimension >= 0.7', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.9 },
        })}
      />,
    )
    expect(screen.queryByTestId('hero-qualifier')).not.toBeInTheDocument()
  })

  it('suppresses HeroQualifier when readinessDimensions is undefined', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ coachingReadinessDimensions: undefined })}
      />,
    )
    expect(screen.queryByTestId('hero-qualifier')).not.toBeInTheDocument()
  })
})
