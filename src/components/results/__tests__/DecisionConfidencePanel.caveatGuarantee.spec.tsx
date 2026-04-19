/**
 * Certainty copy — headline AND caveat are both tier-driven when tier is weak.
 *
 * Brief 5.1 locked the caveat guarantee (caveat attaches whenever tier is
 * weak, regardless of headline source). That was not enough — PLoT could
 * still emit "Option A is the clear leader with a 95-point advantage" and
 * the panel rendered it verbatim alongside the caveat, producing an
 * internally-contradictory headline + caveat pair.
 *
 * Brief 5.2 Task 1 contract:
 *   - When tier is weak (certainty.caveat is present), the headline is
 *     replaced with the tier-aware lede "{winner} currently leads[ by N
 *     points]". PLoT's coaching copy is suppressed — it cannot claim a
 *     clear leader when the caveat says evidence is limited.
 *   - When tier is strong/fair, coaching copy keeps precedence.
 *   - The caveat is still derived purely from tier fields.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  ImprovementsSectionData,
  RecommendationSectionData,
  OptionResult,
} from '../types'
import type { M1CoachingReadiness } from '../../../types/cee'

interface FixtureOpts {
  coachingHeadline?: string
  coachingDecisionStatement?: string
  coachingReadiness?: M1CoachingReadiness
  confidenceTier?: 'strong' | 'fair' | 'needs_work' | 'unknown'
}

function makeData(opts: FixtureOpts): ResultsSectionDataReturn {
  // Brief 5.2 Task 1: winner and runner-up have distinct winProbability so
  // the gap computation (97.4 − 2.4 ≈ 95 points) exercises the new
  // "by N points" suffix. Earlier fixtures used identical winProb on both
  // which hid the gap suffix behaviour.
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.974,
    goalProbability: 0.8,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt-b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: 0.024,
    goalProbability: 0.3,
  } as OptionResult

  const recommendation: RecommendationSectionData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.85, // above 0.70 so the stability branch doesn't fire
    robustnessLevel: 'high',
    coachingHeadline: opts.coachingHeadline,
    coachingDecisionStatement: opts.coachingDecisionStatement,
    coachingReadiness: opts.coachingReadiness ?? 'ready',
  }

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: {
      tier: opts.confidenceTier ?? 'strong',
      icon: 'Check',
      label: 'Tier',
      description: 'desc',
    },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [{
      factorId: 'fac-x',
      factorLabel: 'Value of Strategic Work',
      confidence: 55,
      voi: 0.6,
      evpiPp: 40,
      suggestion: 'Gather evidence',
    }],
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
  }
}

describe('DecisionConfidencePanel — Brief 5.2 Task 1 tier-aware headline + caveat', () => {
  it('needs_work tier: suppresses over-confident coachingHeadline and renders softened lede with "by N points"', () => {
    const data = makeData({
      coachingHeadline: 'Option A is the clear leader with a 95-point advantage',
      confidenceTier: 'needs_work',
      coachingReadiness: 'ready',
    })

    render(<DecisionConfidencePanel data={data} />)

    // Brief 5.2: "clear leader" copy is suppressed when tier is weak.
    expect(
      screen.queryByText(/clear leader/),
    ).not.toBeInTheDocument()

    // Softened lede renders instead — preserves numeric lead without the
    // over-confident framing. Gap = 97.4 − 2.4 = 95 points.
    expect(
      screen.getByText(/Option A currently leads by 95 points/),
    ).toBeInTheDocument()

    // Caveat renders — tier is needs_work.
    expect(
      screen.getByText(/Result depends on factors with limited evidence/),
    ).toBeInTheDocument()
  })

  it('weak readiness: suppresses over-confident coachingDecisionStatement, renders softened lede', () => {
    const data = makeData({
      coachingDecisionStatement: 'Proceed with Option A with confidence.',
      confidenceTier: 'strong',
      coachingReadiness: 'needs_evidence',
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(
      screen.queryByText('Proceed with Option A with confidence.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Option A currently leads by 95 points/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Result depends on factors with limited evidence/),
    ).toBeInTheDocument()
  })

  it('strong tier + ready readiness: coachingHeadline keeps precedence', () => {
    const data = makeData({
      coachingHeadline: 'Option A is the leading option',
      confidenceTier: 'strong',
      coachingReadiness: 'ready',
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.getByText('Option A is the leading option')).toBeInTheDocument()
    expect(
      screen.queryByText(/Result depends on factors with limited evidence/),
    ).not.toBeInTheDocument()
  })

  it('fair tier + ready readiness: coachingHeadline keeps precedence, no caveat', () => {
    const data = makeData({
      coachingHeadline: 'Option A has a slight edge',
      confidenceTier: 'fair',
      coachingReadiness: 'ready',
    })
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.getByText('Option A has a slight edge')).toBeInTheDocument()
    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
  })

  it('no coaching text, fair tier: caveat absent (row 5 of the table)', () => {
    const data = makeData({ confidenceTier: 'fair', coachingReadiness: 'ready' })
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
  })
})
