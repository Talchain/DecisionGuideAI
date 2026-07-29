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
  DecisionResultData,
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

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.75, // above 0.70 (no-clear-leader) but below 0.85 (caveat fires for needs_work)
    robustnessLevel: 'high',
    coachingHeadline: opts.coachingHeadline,
    coachingDecisionStatement: opts.coachingDecisionStatement,
    // Use `in` so callers can explicitly set `coachingReadiness: undefined`
    // to simulate missing readiness (Brief 5.2 follow-up non-caveat tests).
    coachingReadiness: 'coachingReadiness' in opts ? opts.coachingReadiness : 'ready',
    // ROADMAP 1.267. This fixture depicts a 97.4% / 2.4% run — a 95-point
    // lead — and every assertion below is about the copy for a run where a
    // leading option EXISTS. That precondition used to be implicit: the
    // fixture omitted `verdict`, `buildCertaintyCopy`'s parameter was
    // optional, and the leader-asserting rules were reached by default.
    // The panel now resolves an absent verdict to NO_CLAIM_VERDICT (silence),
    // so the run this fixture means has to say so.
    verdict: {
      leaderId: 'opt-a',
      separation: 'clear',
      hasLeadingOption: true,
      gapPp: 95,
      source: 'producer_near_tie',
    },
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
    // V7-C slice 1 (ROADMAP 2.141): `null` is the honest-gate verdict — this
    // fixture predates the Resolve next view and asserts nothing about it.
    voiRanking: null,
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

  it('§2.7 — strong + weak readiness: readiness never softens; confident fallback renders, coaching statement suppressed', () => {
    // Brief 5.5 §2.7 correction: readiness is NOT a softening trigger. A
    // strong tier at any readiness / any stability renders confident copy.
    // The coachingDecisionStatement override is still blocked because the
    // fallback path carries conservative: true (strong alone does not opt in
    // to coaching overrides — Rule 6 requires strong AND ready).
    const data = makeData({
      coachingDecisionStatement: 'Proceed with Option A with confidence.',
      confidenceTier: 'strong',
      coachingReadiness: 'needs_evidence',
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(
      screen.queryByText('Proceed with Option A with confidence.'),
    ).not.toBeInTheDocument()
    // Confident fallback — "leads by N points", no "currently".
    expect(
      screen.getByText(/Option A leads by 95 points/),
    ).toBeInTheDocument()
    // No caveat — caveat is scoped to needs_work only, and readiness never
    // softens a strong tier.
    expect(
      screen.queryByText(/Result depends on factors with limited evidence/),
    ).not.toBeInTheDocument()
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

  it('§2.7 — fair + low stability (0.75): soft headline, no caveat, coachingHeadline suppressed', () => {
    // Brief 5.5 §2.7 lock (new): fair + stab < 0.85 now softens the headline.
    // Caveat still scoped to needs_work — fair softens without the evidence
    // caveat. conservative: true preserved → coaching override blocked.
    const data = makeData({
      coachingHeadline: 'Option A has a slight edge',
      confidenceTier: 'fair',
      coachingReadiness: 'ready',
    })
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByText('Option A has a slight edge')).not.toBeInTheDocument()
    expect(screen.getByText(/Option A currently leads by 95 points/)).toBeInTheDocument()
    // No caveat — fair softens but is not evidence-weak.
    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
  })

  it('no coaching text, fair tier at low stability: caveat absent (fair softens without caveat)', () => {
    const data = makeData({ confidenceTier: 'fair', coachingReadiness: 'ready' })
    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
  })

  // Brief 5.2 follow-up (ChatGPT P0 #1 + P1 #3): conservative certainty
  // states without a caveat (unstable, fair tier, fallback) must ALSO
  // suppress over-confident coachingHeadline overrides. The earlier gate
  // only protected caveat-bearing branches, leaking "clear leader" copy
  // into fair-tier / unstable renders even though the underlying lede
  // was already softened.
  describe('conservative branches without caveat still suppress coachingHeadline', () => {
    it('§2.7 — fair + low stability: over-confident coachingHeadline is suppressed, soft certaintyCopy wins', () => {
      // fair + stab 0.75 → soft headline per §2.7 new gate. conservative: true
      // → PLoT "clear leader" coaching is still blocked.
      const data = makeData({
        coachingHeadline: 'Option A is the clear leader',
        confidenceTier: 'fair',
        coachingReadiness: 'ready',
      })
      render(<DecisionConfidencePanel data={data} />)
      expect(screen.queryByText(/clear leader/)).not.toBeInTheDocument()
      expect(screen.getByText(/Option A currently leads by 95 points/)).toBeInTheDocument()
      // No caveat — caveat is scoped to needs_work.
      expect(screen.queryByText(/limited evidence/)).not.toBeInTheDocument()
    })

    it('fallback (unknown tier + absent readiness): confident fallback suppresses coachingHeadline', () => {
      // Unknown tier does not enter the soft gate. Falls through to confident
      // fallback "leads by N points". conservative: true → coaching override
      // suppressed.
      const data = makeData({
        coachingHeadline: 'Option A is clearly the best choice',
        confidenceTier: 'unknown',
      })
      render(<DecisionConfidencePanel data={data} />)
      expect(screen.queryByText(/clearly the best choice/)).not.toBeInTheDocument()
      expect(screen.getByText(/Option A leads by 95 points/)).toBeInTheDocument()
    })

    it('§2.7 — strong + missing readiness: confident fallback, coachingHeadline suppressed', () => {
      // Brief 5.5 §2.7 correction: strong never softens via readiness. But
      // Rule 6 requires strong AND readiness=ready, so missing readiness
      // drops to the confident fallback (conservative: true). The coaching
      // override remains blocked.
      const data = makeData({
        coachingHeadline: 'Option A is the clear leader with a strong advantage',
        confidenceTier: 'strong',
        coachingReadiness: undefined,
      })
      render(<DecisionConfidencePanel data={data} />)
      expect(screen.queryByText(/clear leader/)).not.toBeInTheDocument()
      expect(screen.getByText(/Option A leads by 95 points/)).toBeInTheDocument()
    })
  })
})
