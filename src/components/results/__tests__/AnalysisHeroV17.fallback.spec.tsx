/**
 * AnalysisHeroV17 — fallback-safety guards.
 *
 * Locks in the EXISTING safe degradation of the live hero across data states
 * (full / partial / missing robustness / no winner / coaching unavailable /
 * unsupported sections absent). No source change — these are regression guards
 * over behaviour the hero already has, so future edits can't silently break it
 * or introduce overclaim.
 *
 * These assertions CHARACTERISE current `AnalysisHeroV17` behaviour on
 * origin/staging — they are not a contract for the future Analysis panel and
 * should be revisited if robustness reconciliation, canonical freshness, or the
 * Decision Data Spine changes the hero. Contract-safe: no new fields, no
 * freshness chip, no new robustness wording.
 */
import type { ReactElement } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { AnalysisHeroV17 } from '../AnalysisHeroV17'
import { buildResultsVM } from '../buildResultsVM'
import { normalisedFixture } from '../../../__fixtures__/resultsPanelV7.normalised.hook'
import { minimalFixture } from '../../../__fixtures__/resultsPanelV7.minimal.hook'
import * as heroStories from '../AnalysisHeroV17.stories'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

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
  unsupportedHidden: over(minimalFixture, {
    confidence: { conditionalWinners: undefined, topFragileEdge: undefined },
  }),
}

function renderHero(data: RSD) {
  return render(<AnalysisHeroV17 data={data} vm={buildResultsVM(data)} onFocusNode={() => {}} />)
}

describe('AnalysisHeroV17 — safe degradation', () => {
  it('renders full data with the hero shell + header', () => {
    renderHero(STATES.full)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.getByText('Strengthen this decision')).toBeInTheDocument()
  })

  it('renders sparse/partial data without throwing', () => {
    renderHero(STATES.partial)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
  })

  it('does not overclaim robustness when stability is absent (shows "Robustness unknown")', () => {
    renderHero(STATES.missingRobustness)
    expect(screen.getByText('Robustness unknown')).toBeInTheDocument()
  })

  it('shows the neutral no-winner result line when there are no options', () => {
    renderHero(STATES.noWinner)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.getByText(/No option currently comes out ahead clearly/i)).toBeInTheDocument()
  })

  it('degrades quietly when coaching inputs are unavailable (no crash, no input rows)', () => {
    renderHero(STATES.coachingUnavailable)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.queryByText('Needs your input')).toBeNull()
  })

  it('hides unsupported sections when their data is absent (no placeholder, no invented values)', () => {
    renderHero(STATES.unsupportedHidden)
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
    expect(screen.queryByText('Conditional scenarios')).toBeNull()
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
    expect(storyEntries.length).toBe(7)
  })

  it.each(storyEntries)('renders story %s', (_name, story) => {
    render(story())
    expect(screen.getByTestId('analysis-hero-v17')).toBeInTheDocument()
  })
})
