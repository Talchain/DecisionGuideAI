/**
 * Certainty caveat cannot be overridden by upstream coaching text.
 *
 * Follow-up regression (post-ChatGPT review, P0 #2). The earlier wiring
 * had a loophole: when coachingHeadline or coachingDecisionStatement was
 * present, the tier-driven caveat was suppressed. That let an LLM
 * "clear leading option" string mask a needs_work / needs_evidence
 * bundle — exactly the staging QA failure certaintyCopy.ts was meant to
 * prevent.
 *
 * Current contract: the caveat is derived purely from tier fields. If
 * buildCertaintyCopy returns a caveat, it renders, regardless of
 * whether the headline came from coachingHeadline,
 * coachingDecisionStatement, or the certainty fallback itself.
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
  const option: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.85,
    goalProbability: 0.8,
  } as OptionResult

  const recommendation: RecommendationSectionData = {
    recommendedOption: option,
    allOptions: [option, { ...option, id: 'opt-b', label: 'Option B' } as OptionResult],
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

describe('DecisionConfidencePanel — certainty caveat cannot be overridden by coaching text', () => {
  it('coachingHeadline present AND needs_work tier: headline uses coaching text, caveat still renders from tier', () => {
    const data = makeData({
      coachingHeadline: 'Option A is the clear leader with a 61-point advantage',
      confidenceTier: 'needs_work',
      coachingReadiness: 'ready',
    })

    render(<DecisionConfidencePanel data={data} />)

    // Headline retains the coaching text (coaching pipeline still has precedence).
    expect(
      screen.getByText('Option A is the clear leader with a 61-point advantage'),
    ).toBeInTheDocument()

    // Caveat renders regardless — tier is needs_work.
    expect(
      screen.getByText(/Result depends on factors with limited evidence/),
    ).toBeInTheDocument()
  })

  it('coachingDecisionStatement present AND weak readiness: caveat still renders from tier', () => {
    const data = makeData({
      coachingDecisionStatement: 'Proceed with Option A — the evidence supports it.',
      confidenceTier: 'strong',
      coachingReadiness: 'needs_evidence',
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(
      screen.getByText('Proceed with Option A — the evidence supports it.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Result depends on factors with limited evidence/),
    ).toBeInTheDocument()
  })

  it('coachingHeadline present AND strong tier + ready readiness: no caveat (correctly absent)', () => {
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

  it('no coaching text, fair tier: caveat absent (row 5 of the table)', () => {
    const data = makeData({ confidenceTier: 'fair', coachingReadiness: 'ready' })
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
  })
})
