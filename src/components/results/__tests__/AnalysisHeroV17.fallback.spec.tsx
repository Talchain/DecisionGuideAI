/**
 * AnalysisHeroV17 — fallback-safety guards.
 *
 * Locks in the EXISTING safe degradation of the live hero across data states.
 * No source change — regression guards over behaviour the hero already has.
 *
 * Assertions are BEHAVIOUR-LEVEL via structural hooks (testids + check state),
 * not specific copy, so they don't freeze wording that robustness reconciliation
 * / canonical freshness / the Decision Data Spine may change. Where the guard is
 * "a section/claim is absent", it is paired with the PRESENT case (a differential)
 * so the absence can't pass vacuously. Contract-safe: no new fields, no freshness
 * chip, no new robustness wording.
 */
import type { ReactElement } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { configureAxe } from 'vitest-axe'
import { AnalysisHeroV17 } from '../AnalysisHeroV17'
import { buildResultsVM } from '../buildResultsVM'
import { normalisedFixture } from '../../../__fixtures__/resultsPanelV7.normalised.hook'
import { sensitiveFixture } from '../../../__fixtures__/resultsPanelV7.sensitive.hook'
import { minimalFixture } from '../../../__fixtures__/resultsPanelV7.minimal.hook'
import * as heroStories from '../AnalysisHeroV17.stories'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

// configureAxe RETURNS the configured instance; the default `axe` export is
// unconfigured. Use the returned function so the color-contrast exclusion (a
// jsdom-incompatible rule) actually applies.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } })

type RSD = ResultsSectionDataReturn

function over(
  base: RSD,
  o: {
    recommendation?: Partial<RSD['recommendation']>
    drivers?: Partial<RSD['drivers']>
    confidence?: Partial<RSD['confidence']>
  } = {},
): RSD {
  return {
    ...base,
    recommendation: { ...base.recommendation, ...o.recommendation },
    drivers: { ...base.drivers, ...o.drivers },
    confidence: { ...base.confidence, ...o.confidence },
  }
}

/** The data states the hero must degrade through safely (shared across tests). */
const STATES: Record<string, RSD> = {
  full: normalisedFixture,
  partial: minimalFixture,
  sensitive: sensitiveFixture, // close margin, low stability — winner present but flagged
  missingRobustness: over(normalisedFixture, {
    recommendation: {
      recommendationStability: undefined,
      robustnessLevel: undefined,
      robustnessLabel: undefined,
    },
    confidence: { rankingStability: undefined, robustnessLevel: undefined, totalHighRiskEdges: 0 },
  }),
  noWinner: over(normalisedFixture, {
    recommendation: { recommendedOption: null, allOptions: [] },
  }),
  coachingUnavailable: over(normalisedFixture, {
    drivers: { drivers: [], topDrivers: [] },
    confidence: {
      evidenceGaps: [],
      topEvidenceGaps: [],
      nextActions: [],
      topNextActions: [],
      uncertainties: [],
      topUncertainties: [],
      m2DecisionQualityPrompts: undefined,
      m1CoachingTopFragileEdge: undefined,
      topFragileEdge: undefined,
      conditionalWinners: undefined,
    },
  }),
}

function renderHero(data: RSD) {
  return render(<AnalysisHeroV17 data={data} vm={buildResultsVM(data)} onFocusNode={() => {}} />)
}

/** State of a checks glyph by its icon colour token (text-success = positive claim). */
function checkIsPositive(testid: string): boolean {
  const icon = screen.getByTestId(testid).querySelector('svg')
  return !!icon?.classList.contains('text-success')
}

describe('AnalysisHeroV17 — safe degradation (behaviour, not copy)', () => {
  it('renders full data with the hero shell + result context', () => {
    renderHero(STATES.full)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.getByTestId('hero-v17-result-context')).toBeInTheDocument()
  })

  it('renders sparse/partial data without throwing', () => {
    renderHero(STATES.partial)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
  })

  it('makes no positive robustness claim when stability is absent', () => {
    renderHero(STATES.missingRobustness)
    expect(screen.getByTestId('checks-robust')).toBeInTheDocument()
    expect(checkIsPositive('checks-robust')).toBe(false)
  })

  it('makes no positive winner claim when there are no options', () => {
    renderHero(STATES.noWinner)
    expect(screen.getByTestId('hero-v17-result-context')).toBeInTheDocument()
    expect(checkIsPositive('checks-winner')).toBe(false)
  })

  it('treats a close-margin result as a sensitive winner, NOT "no clear leader"', () => {
    // Guards the sensitive-vs-no-winner distinction: a sensitive result still
    // has a winner (positive winner check) but is flagged sensitive (robust not positive).
    renderHero(STATES.sensitive)
    expect(checkIsPositive('checks-winner')).toBe(true)
    expect(checkIsPositive('checks-robust')).toBe(false)
  })
})

describe('AnalysisHeroV17 — differential guards (present ⇄ absent)', () => {
  it('shows positive winner + robustness only when the data supports them', () => {
    const a = renderHero(over(normalisedFixture, {
      recommendation: { recommendationStability: 0.95, robustnessLevel: 'high' },
    }))
    expect(checkIsPositive('checks-winner')).toBe(true)
    expect(checkIsPositive('checks-robust')).toBe(true)
    a.unmount()
    // …and not when stability is absent / there is no winner (proves the above isn't vacuous).
    renderHero(STATES.missingRobustness)
    expect(checkIsPositive('checks-robust')).toBe(false)
  })

  it('renders the coaching input-rows when present and omits them when coaching is unavailable', () => {
    const a = renderHero(normalisedFixture)
    expect(a.getByTestId('hero-v17-input-rows')).toBeInTheDocument()
    a.unmount()
    const b = renderHero(STATES.coachingUnavailable)
    expect(b.queryByTestId('hero-v17-input-rows')).toBeNull()
    expect(b.queryByTestId('hero-v17-key-question')).toBeNull()
  })

  it('renders the fragile-risk callout when present and hides it when its data is omitted', () => {
    // normalisedFixture HAS topFragileEdge, so the callout renders; omitting it hides it.
    const a = renderHero(normalisedFixture)
    expect(a.getByTestId('t1-flip-risk-callout')).toBeInTheDocument()
    a.unmount()
    const b = renderHero(
      over(normalisedFixture, {
        confidence: { topFragileEdge: undefined, m1CoachingTopFragileEdge: undefined },
      }),
    )
    expect(b.queryByTestId('t1-flip-risk-callout')).toBeNull()
  })
})

describe('AnalysisHeroV17 — accessibility across data states', () => {
  it.each(Object.keys(STATES))('has no axe violations: %s', async (key) => {
    const { container } = renderHero(STATES[key])
    expect((await axe(container)).violations).toEqual([])
  })
})

describe('AnalysisHeroV17 stories — render smoke', () => {
  // Guards the .stories.tsx file (not otherwise executed by the test runner):
  // every exported story renders the real hero without throwing.
  const storyEntries = Object.entries(heroStories).filter(
    ([name, val]) => name !== 'default' && typeof val === 'function',
  ) as Array<[string, () => ReactElement]>

  it('exports the expected number of stories', () => {
    expect(storyEntries.length).toBe(6)
  })

  it.each(storyEntries)('renders story %s', (_name, story) => {
    render(story())
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
  })
})
