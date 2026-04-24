/**
 * Hero headline ↔ footer stability label — tier × stability matrix.
 *
 * Brief 5.5 §2.7 lock. The softening gate now keys on (tier ∈ {needs_work,
 * fair}) AND stability < 0.85 only; coachingReadiness is NOT consulted.
 * Hero and footer stay in lock-step via the shared shouldSoftenPhrasing
 * helper.
 *
 * Matrix expectations (all values derived from §2.7):
 *   - strong + ready + high stability → hero "is the leading option",
 *     footer "Stable result"
 *   - needs_work + high stability → stability override: hero "leads"
 *     (confident fallback), footer "Stable result"
 *   - strong + weak readiness (any stability) → readiness never softens;
 *     hero "leads", footer "Stable result" at high stability, "Sensitive
 *     to assumptions" at low (numeric pass-through)
 *   - fair + high stability → stability override: hero "leads", footer
 *     "Stable result"
 *   - fair + low stability → soft: hero "currently leads", footer
 *     "Stability sensitive"
 *   - needs_work + low stability → soft: hero "currently leads", footer
 *     "Stability sensitive"
 *   - close_call readiness (orthogonal) → hero "is the leading option"
 *   - unstable stability < 0.70 → hero "no clear leading option"
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import { ResultsFooter } from '../ResultsFooter'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { ConfidenceTier, OptionResult, DecisionResultData, ConfidenceSectionData, DriversSectionData, ImprovementsSectionData } from '../types'
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

  const recommendation: DecisionResultData = {
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
    // §2.7: needs_work + high stability → stability override → confident fallback.
    // Hero emits "Option A leads" (no "currently"); footer honours numeric "Stable result".
    label: '§2.7 — needs_work + high stability: stability override to confident fallback',
    tier: 'needs_work',
    readiness: 'ready',
    stability: 0.97,
    expectHeroContains: 'Option A leads',
    forbidHero: ['currently leads', 'clear leader', 'advantage', 'is the leading option'],
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    // §2.7: readiness never softens. Strong + weak readiness + high stability → confident.
    label: '§2.7 — strong + weak readiness + high stability: readiness never softens',
    tier: 'strong',
    readiness: 'needs_evidence',
    stability: 0.95,
    expectHeroContains: 'Option A leads',
    forbidHero: ['currently leads', 'clear leader', 'is the leading option'],
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    // §2.7: fair + high stability → stability override → confident fallback.
    label: '§2.7 — fair + high stability: stability override to confident fallback',
    tier: 'fair',
    readiness: 'ready',
    stability: 0.90,
    expectHeroContains: 'Option A leads',
    forbidHero: ['Option A currently leads', 'is the leading option'],
    expectFooterContains: 'Stable result',
    forbidFooter: ['Stability sensitive'],
  },
  {
    // §2.7: fair + low stability → soft. NEW behaviour versus Brief 5.4.
    label: '§2.7 — fair + low stability: soft headline, footer "Stability sensitive"',
    tier: 'fair',
    readiness: 'ready',
    stability: 0.80,
    expectHeroContains: 'Option A currently leads',
    forbidHero: ['is the leading option'],
    expectFooterContains: 'Stability sensitive',
    forbidFooter: ['Stable result'],
  },
  {
    // close_call readiness is orthogonal — definitive copy, stability passes through.
    label: '§2.7 — close_call readiness: definitive hero, numeric footer',
    tier: 'strong',
    readiness: 'close_call',
    stability: 0.90,
    expectHeroContains: 'Option A is the leading option',
    forbidHero: ['Option A currently leads'],
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
    // Rule 1 boundary — hero fires on stability < 0.70. Footer: fair + 0.40
    // enters the §2.7 soft gate (tier ∈ {needs_work, fair} AND stab < 0.85),
    // so the override fires regardless of the numeric-classification label.
    // Hero + footer both read pessimistic, which is coherent.
    label: 'Rule 1 boundary — stability 0.40 + fair tier: hero "no clear leading option", footer "Stability sensitive" via soft gate',
    tier: 'fair',
    readiness: 'ready',
    stability: 0.40,
    expectHeroContains: 'no clear leading option',
    expectFooterContains: 'Stability sensitive',
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

  // §2.7 meta-guard: readiness cross-products. With any readiness value, a
  // strong tier never softens, and any tier at stability ≥ 0.85 takes the
  // stability override. Soft only fires for (needs_work OR fair) + stab < 0.85.
  const readinessCrossProducts: Array<{
    tier: ConfidenceTier
    readiness: M1CoachingReadiness
    stability: number
    expectSoft: boolean
  }> = [
    // Strong + weak readiness: never soft (stability irrelevant).
    { tier: 'strong', readiness: 'needs_evidence', stability: 0.95, expectSoft: false },
    { tier: 'strong', readiness: 'needs_framing', stability: 0.95, expectSoft: false },
    { tier: 'strong', readiness: 'low', stability: 0.95, expectSoft: false },
    { tier: 'strong', readiness: 'not_ready', stability: 0.95, expectSoft: false },
    // needs_work + any readiness: stability override at 0.95.
    { tier: 'needs_work', readiness: 'ready', stability: 0.95, expectSoft: false },
    { tier: 'needs_work', readiness: 'needs_evidence', stability: 0.95, expectSoft: false },
    // needs_work + low stability: soft.
    { tier: 'needs_work', readiness: 'ready', stability: 0.78, expectSoft: true },
    // fair + low stability: soft (new per §2.7).
    { tier: 'fair', readiness: 'ready', stability: 0.78, expectSoft: true },
  ]
  it.each(readinessCrossProducts)(
    '§2.7 cross-product — tier=$tier readiness=$readiness stability=$stability → soft=$expectSoft',
    ({ tier, readiness, stability, expectSoft }) => {
      const data = makeData(tier, readiness, stability)
      const panel = render(<DecisionConfidencePanel data={data} />)
      const panelText = panel.container.textContent ?? ''
      if (expectSoft) {
        expect(panelText).toContain('Option A currently leads')
      } else {
        expect(panelText).not.toContain('Option A currently leads')
      }
      panel.unmount()

      render(
        <ResultsFooter
          stability={stability}
          confidenceTier={tier}
          coachingReadiness={readiness}
        />,
      )
      const footerText = screen.getByTestId('results-footer').textContent ?? ''
      if (expectSoft) {
        expect(footerText).toContain('Stability sensitive')
        expect(footerText).not.toContain('Stable result')
      } else {
        expect(footerText).not.toContain('Stability sensitive')
      }
    },
  )
})
