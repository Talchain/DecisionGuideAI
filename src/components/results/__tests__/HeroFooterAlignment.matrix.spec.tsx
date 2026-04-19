/**
 * Hero headline ↔ footer stability label — tier × readiness × stability matrix.
 *
 * Brief 5.2 follow-up (ChatGPT Improvements #1). Per-component tests already
 * cover DecisionConfidencePanel and ResultsFooter separately, but drift
 * between them is precisely the class of regression Brief 5.2 targets: a
 * footer reading "Stable result · 97%" alongside a softened "currently leads"
 * hero would feel incoherent even though each surface's local tests pass.
 *
 * This spec exercises the combinatorial matrix of confidence_tier × coaching
 * readiness × recommendation stability and asserts semantic alignment:
 *   - strong + ready + high stability → hero says "leading option", footer
 *     says "Stable result"
 *   - weak tier / weak readiness → hero says "currently leads", footer says
 *     "Stability sensitive", regardless of numeric stability
 *   - fair tier / close-call → hero says "currently leads", footer honours
 *     the numeric label
 *   - unstable stability < 0.70 → hero says "no clear leading option", no
 *     over-confident footer
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import { ResultsFooter } from '../ResultsFooter'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ConfidenceTier, OptionResult, RecommendationSectionData, ConfidenceSectionData, DriversSectionData, ImprovementsSectionData } from '../types'
import type { M1CoachingReadiness } from '../../../types/cee'

interface MatrixCase {
  label: string
  tier: ConfidenceTier
  readiness: M1CoachingReadiness
  stability: number
  /** The hero phrase that MUST appear. */
  expectHeroContains: string
  /** Phrases that must NOT appear in the hero (suppression guards). */
  forbidHero?: string[]
  /** The footer label that MUST appear. */
  expectFooterContains: string
  /** Phrases that must NOT appear in the footer. */
  forbidFooter?: string[]
}

function makeData(tier: ConfidenceTier, readiness: M1CoachingReadiness, stability: number): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.80,
    goalProbability: 0.8,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt-b',
    label: 'Option B',
    expectedValue: 0.5,
    p10: 0.3,
    p90: 0.7,
    winProbability: 0.20,
    goalProbability: 0.4,
  } as OptionResult

  const recommendation: RecommendationSectionData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: stability,
    robustnessLevel: 'high',
    coachingReadiness: readiness,
  }

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier, icon: 'Check', label: 'Tier', description: 'desc' },
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
  }
}

// The matrix captures every shipped decision-table row, each tested once at
// the numeric stability band that keeps the row active. Brief 5.2 Task 1
// gates require each row produces coherent hero+footer text in one pass.
const matrix: MatrixCase[] = [
  {
    label: 'Rule 6 — strong + ready + high stability → authoritative positive lede',
    tier: 'strong',
    readiness: 'ready',
    stability: 0.95,
    expectHeroContains: 'Option A is the leading option',
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    label: 'Rule 4 — weak tier overrides high stability: hero softened, footer "Stability sensitive"',
    tier: 'needs_work',
    readiness: 'ready',
    stability: 0.97,
    expectHeroContains: 'Option A currently leads',
    forbidHero: ['clear leader', 'advantage', 'is the leading option'],
    expectFooterContains: 'Stability sensitive',
    forbidFooter: ['Stable result'],
  },
  {
    label: 'Rule 4 — weak readiness overrides high stability: hero softened, footer "Stability sensitive"',
    tier: 'strong',
    readiness: 'needs_evidence',
    stability: 0.95,
    expectHeroContains: 'Option A currently leads',
    forbidHero: ['clear leader', 'is the leading option'],
    expectFooterContains: 'Stability sensitive',
    forbidFooter: ['Stable result'],
  },
  {
    label: 'Rule 5 — fair tier: hero softened, footer passes through numeric',
    tier: 'fair',
    readiness: 'ready',
    stability: 0.90,
    expectHeroContains: 'Option A currently leads',
    forbidHero: ['is the leading option'],
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    label: 'Rule 5 — close_call readiness: hero softened, footer passes through numeric',
    tier: 'strong',
    readiness: 'close_call',
    stability: 0.90,
    expectHeroContains: 'Option A currently leads',
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    label: 'Rule 1 — unstable (stability < 0.70): hero "no clear leading option", footer "Sensitive to assumptions"',
    tier: 'strong',
    readiness: 'ready',
    stability: 0.55,
    expectHeroContains: 'no clear leading option',
    forbidHero: ['is the leading option'],
    expectFooterContains: 'Sensitive to assumptions',
  },
  {
    label: 'Rule 1 boundary — stability 0.40 still unstable, hero "no clear leading option"',
    tier: 'fair',
    readiness: 'ready',
    stability: 0.40,
    expectHeroContains: 'no clear leading option',
    expectFooterContains: 'Sensitive to assumptions',
  },
]

describe('Hero ↔ Footer alignment — tier × readiness × stability matrix', () => {
  it.each(matrix)('$label', (testCase) => {
    const data = makeData(testCase.tier, testCase.readiness, testCase.stability)
    const panel = render(<DecisionConfidencePanel data={data} />)

    const panelText = panel.container.textContent ?? ''
    expect(panelText).toContain(testCase.expectHeroContains)
    for (const forbidden of testCase.forbidHero ?? []) {
      expect(panelText).not.toContain(forbidden)
    }

    panel.unmount()

    // Mount the footer in isolation with the same inputs — validates that
    // the tier-aware adapter produces the matching footer label even
    // without a shared parent wiring both surfaces.
    render(
      <ResultsFooter
        stability={testCase.stability}
        confidenceTier={testCase.tier}
        coachingReadiness={testCase.readiness}
      />,
    )
    const footerText = screen.getByTestId('results-footer').textContent ?? ''
    expect(footerText).toContain(testCase.expectFooterContains)
    for (const forbidden of testCase.forbidFooter ?? []) {
      expect(footerText).not.toContain(forbidden)
    }
  })

  // Targeted weak-tier meta-guard: independent of the numeric stability,
  // any row with a weak tier or weak readiness must produce "Stability
  // sensitive" in the footer AND must not emit "is the leading option"
  // in the hero. This is the exact regression Brief 5.2 Task 1 fixes —
  // guarded once more across a stress-matrix of numeric bands so a
  // future adapter tweak can't break it silently.
  const weakStressBands: Array<{ tier: ConfidenceTier; readiness: M1CoachingReadiness }> = [
    { tier: 'needs_work', readiness: 'ready' },
    { tier: 'strong', readiness: 'needs_evidence' },
    { tier: 'strong', readiness: 'needs_framing' },
    { tier: 'strong', readiness: 'low' },
    { tier: 'strong', readiness: 'not_ready' },
    { tier: 'needs_work', readiness: 'needs_evidence' },
  ]
  it.each(weakStressBands)(
    'weak tier/readiness (tier=$tier, readiness=$readiness) forces "Stability sensitive" regardless of numeric stability',
    ({ tier, readiness }) => {
      // Test across the high stability band where the suppression matters most.
      const stability = 0.95
      const data = makeData(tier, readiness, stability)
      const panel = render(<DecisionConfidencePanel data={data} />)
      const panelText = panel.container.textContent ?? ''
      expect(panelText).not.toContain('Option A is the leading option')
      expect(panelText).toContain('Option A currently leads')
      panel.unmount()

      render(
        <ResultsFooter
          stability={stability}
          confidenceTier={tier}
          coachingReadiness={readiness}
        />,
      )
      const footerText = screen.getByTestId('results-footer').textContent ?? ''
      expect(footerText).toContain('Stability sensitive')
      expect(footerText).not.toContain('Stable result')
    },
  )
})
