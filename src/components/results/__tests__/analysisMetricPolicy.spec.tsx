import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import liveScoreOne from '@/test/fixtures/live-influence-score-one-2026-08-23.json'
import {
  resolveAnalysisMetric,
  resolveDriverClaimBasis,
} from '../driverDisplayModel'
import {
  analysisMetricPredicate,
  analysisMetricTitle,
  analysisMetricVisibleLabel,
} from '../influenceScaleCopy'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DriverItem, DriversSectionData } from '../types'

vi.mock('@/canvas/utils/focusHelpers', () => ({ focusNodeById: vi.fn() }))

const FORBIDDEN_SHARE = /(?:drives?|accounts? for|contributes?)\s+\d+\s*%\s+(?:of|to)\s+(?:the\s+)?(?:outcome|result|variance)/i

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    semanticLabel: 'strong',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeDriversData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers,
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
    dominantFactorId: drivers[0]?.factorKey,
    dominantFactorLabel: drivers[0]?.factorLabel,
  }
}

function makeTriageData(drivers: DriverItem[]): ResultsSectionDataReturn {
  return {
    drivers: makeDriversData(drivers),
    recommendation: { recommendedOption: null },
    confidence: { recommendedOptionId: undefined },
    assumptions: { items: [] },
    gaps: { items: [] },
    risks: { items: [] },
  } as unknown as ResultsSectionDataReturn
}

describe('analysis metric value + basis + permitted-language policy', () => {
  it.each([
    /**
     * ⚠⚠ THIS ROW SAID `'absolute_influence_score'` UNTIL 5 Sep 2026, AND THAT
     * PIN RATIFIED THE DEFECT. `influence_score` is set-relative: the producer
     * divides by `max|influence|`, so the top row is 1.0 by construction.
     * Verified from this side before changing it — every capture in the repo
     * carrying the field has a maximum of exactly 1.0, twelve files including
     * live staging responses.
     *
     * The change is deliberate and is the ruling, not a test bent to fit a
     * change. See `influenceIsNeverCalledAbsolute.spec.ts` for the evidence and
     * for the live capture where a 100% row carries `elasticity: 0` — a demoted
     * lever the panel was calling a 100% influence score.
     */
    ['influence_score', 'set_relative_influence'],
    ['normalised_elasticity', 'set_relative_influence'],
    ['pre_analysis_influence', 'pre_analysis_influence_score'],
    ['value_of_information', 'value_of_information'],
  ] as const)('resolves %s without changing the producer value', (basis, permittedLanguage) => {
    expect(resolveAnalysisMetric({ value: 0.68, basis })).toEqual({
      value: 0.68,
      basis,
      permittedLanguage,
    })
  })

  it('preserves an explicitly attested zero and does not fabricate a missing zero', () => {
    expect(resolveAnalysisMetric({ value: 0, basis: 'influence_score' })).toEqual({
      value: 0,
      basis: 'influence_score',
      permittedLanguage: 'set_relative_influence',
    })
    expect(resolveAnalysisMetric({ value: undefined, basis: 'influence_score' })).toBeNull()
    expect(resolveAnalysisMetric({ value: 0.4, basis: undefined })).toBeNull()
  })

  it('fails closed when a stamped display value contradicts the attested source field', () => {
    expect(resolveDriverClaimBasis({
      displayInfluence: 1,
      displayProvenance: 'influence_score',
      influenceScore: 0.42,
      normalisedInfluence: 1,
    })).toBeNull()
  })

  it('keeps value of information distinct from influence in visible and accessible copy', () => {
    const voi = resolveAnalysisMetric({ value: 0.62, basis: 'value_of_information' })!
    const influence = resolveAnalysisMetric({ value: 0.62, basis: 'influence_score' })!
    expect(analysisMetricVisibleLabel(voi)).toBe('Value of information 62%')
    expect(analysisMetricVisibleLabel(influence)).toBe('Relative influence 62%')
    expect(analysisMetricTitle(voi)).not.toMatch(/influence score/i)
    expect(analysisMetricTitle(influence)).not.toMatch(/value of information/i)
  })

  it.each([
    ['influence_score', 'Relative influence 68%'],
    ['normalised_elasticity', 'Relative influence 68%'],
    ['pre_analysis_influence', 'Pre-analysis influence score 68%'],
    ['value_of_information', 'Value of information 68%'],
  ] as const)('renders %s with the same licensed basis in visible and accessible copy', (basis, visible) => {
    const metric = resolveAnalysisMetric({ value: 0.68, basis })!
    render(
      <TriageCard
        cardKey={basis}
        title={basis}
        detail=""
        category="verify"
        analysisMetric={metric}
      />,
    )
    expect(screen.getByText(visible)).toBeInTheDocument()
    const metricElement = screen.getByRole('img', { name: analysisMetricTitle(metric) })
    expect(metricElement).toHaveAttribute('title', analysisMetricTitle(metric))
  })

  it('licenses magnitude/rank wording but never an outcome partition', () => {
    for (const basis of [
      'influence_score',
      'normalised_elasticity',
      'pre_analysis_influence',
      'value_of_information',
    ] as const) {
      const metric = resolveAnalysisMetric({ value: 1, basis })!
      expect(analysisMetricPredicate(metric)).not.toMatch(FORBIDDEN_SHARE)
      expect(analysisMetricTitle(metric)).not.toMatch(FORBIDDEN_SHARE)
    }
  })
})

describe('live influence_score:1 regression and contrast twins', () => {
  const liveDrivers = liveScoreOne.factors.map((factor, index) => makeDriver({
    factorKey: factor.factor_id,
    factorLabel: factor.factor_label,
    rawElasticity: factor.elasticity,
    normalisedInfluence: factor.influence_score,
    influenceScore: factor.influence_score,
    displayInfluence: factor.influence_score,
    displayProvenance: 'influence_score',
    rank: index + 1,
    semanticLabel: index === 0 ? 'biggest' : 'strong',
  }))

  it('renders the live 1.0 score without visible, title, or aria share language', () => {
    render(<TriageActionCardsBody data={makeTriageData(liveDrivers)} suppressTriageQueue />)
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge.textContent).toContain('100%')
    expect(nudge.textContent ?? '').not.toMatch(FORBIDDEN_SHARE)
    expect(nudge.getAttribute('title') ?? '').not.toMatch(FORBIDDEN_SHARE)
    expect(nudge.getAttribute('aria-label') ?? '').not.toMatch(FORBIDDEN_SHARE)
  })

  it('withholds a comparative dominance claim on a tie', () => {
    const tied = liveDrivers.slice(0, 2).map((driver) => ({
      ...driver,
      influenceScore: 1,
      displayInfluence: 1,
    }))
    render(<TriageActionCardsBody data={makeTriageData(tied)} suppressTriageQueue />)
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  it('withholds the mounted claim when the display value contradicts its stamped basis', () => {
    const contradictory = [
      makeDriver({
        ...liveDrivers[0],
        factorKey: liveDrivers[0].factorKey,
        displayInfluence: 1,
        influenceScore: 0.42,
        displayProvenance: 'influence_score',
      }),
      liveDrivers[1],
    ]
    render(<TriageActionCardsBody data={makeTriageData(contradictory)} suppressTriageQueue />)
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  it('renders an attested zero but withholds a bare value whose basis is absent', () => {
    const zero = resolveAnalysisMetric({ value: 0, basis: 'pre_analysis_influence' })!
    const { rerender } = render(
      <TriageCard cardKey="zero" title="Zero" detail="" category="verify" analysisMetric={zero} />,
    )
    expect(screen.getByText('Pre-analysis influence score 0%')).toBeInTheDocument()

    rerender(<TriageCard cardKey="missing" title="Missing" detail="" category="verify" />)
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
  })
})
