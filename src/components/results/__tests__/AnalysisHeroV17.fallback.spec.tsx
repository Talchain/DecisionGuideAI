/**
 * AnalysisHeroV17 — fallback-safety guards.
 *
 * Locks in the EXISTING safe degradation of the live hero across data states.
 * No source change — regression guards over behaviour the hero already has.
 *
 * Guards are STRUCTURAL only (renders-without-throwing, axe, and present⇄absent
 * differentials on stable testids). They deliberately do NOT assert:
 *   - copy strings (wording is under active revision), nor
 *   - presentation details like the checks-glyph colour class (the glyph exposes
 *     no semantic state hook — its success/danger token is purely visual, so
 *     asserting it would freeze presentation and break on a safe robustness-
 *     reconciliation change). "No-overclaim" intent is documented in the stories
 *     and should get a real test once the hero exposes a semantic state hook.
 *
 * Contract-safe: no new fields, no freshness chip, no new robustness wording.
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

describe('AnalysisHeroV17 — safe degradation + accessibility across data states', () => {
  it.each(Object.keys(STATES))('renders the hero shell, axe-clean: %s', async (key) => {
    const { container } = renderHero(STATES[key])
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect((await axe(container)).violations).toEqual([])
  })

  it('renders the result context for a full analysis', () => {
    renderHero(STATES.full)
    expect(screen.getByTestId('hero-v17-result-context')).toBeInTheDocument()
  })
})

describe('AnalysisHeroV17 — differential guards (present ⇄ absent)', () => {
  it('renders coaching input-rows when present and omits them when coaching is unavailable', () => {
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
