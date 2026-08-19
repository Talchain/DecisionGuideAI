/**
 * Analysis hero — a headline computed over a SUBSET says which options it
 * compared.
 *
 * ## Why this file lives HERE and not beside its siblings
 *
 * The rest of this change's pins are in
 * `src/components/results/__tests__/comparisonScopeDisclosure.spec.tsx`. The
 * hero half is separated because `analysis-hero/__tests__/inertness.spec.ts`
 * enforces that ONLY `ResultsBody` may import the analysis hero from outside
 * this module — a real architectural boundary (the module was forked three
 * times and every fork stayed mounted). Splitting the file respects that
 * guard; adding this spec to its authorised-importer allowlist would have
 * widened a boundary to suit a test, which is the wrong direction.
 *
 * ## The claim
 *
 * `model.headline` names a LEADER. A superlative ranges over the candidate set
 * even where the underlying per-option quantity is subset-invariant: "has the
 * highest chance of hitting your goal" is a claim about the FIELD, and a field
 * smaller than the user's option set makes it a different claim from the one
 * the user thinks they are reading. So the hero is in scope even though
 * `probability_of_goal` itself is not.
 *
 * ## Deployed-flag posture (trap 3b)
 *
 * `AnalysisHeroContainer` mounts UNCONDITIONALLY in `ResultsBody` — the
 * analysis-hero fork is closed and `netlify.toml` records
 * `VITE_FEATURE_ANALYSIS_HERO_PANEL` as retired with no readers. This spec is
 * therefore a claim about a surface a user loads.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import { deriveComparisonScope } from '../../utils/goalAnchorCopy'
import type { HeroChartModel } from '../heroTypes'
import type { OptionResult } from '../../types'

const KEEP_A = 'opt-keep-a'
const KEEP_B = 'opt-keep-b'
const KEEP_C = 'opt-keep-c'
const DROPPED = 'opt-dropped'
const DROPPED_LABEL = 'Hybrid Phased Approach'

const HERO_NOTE = 'comparison-scope-note-hero'

function analysed(id: string, winProbability: number): OptionResult {
  return {
    id,
    label: `Analysed ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability,
    goalProbability: 0.55,
  } as OptionResult
}

function excluded(id: string, label: string): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
  } as OptionResult
}

/** THREE ARMS OF FOUR — the measured draw-10 shape from the CEE capture. */
const subsetOptions = (): OptionResult[] => [
  analysed(KEEP_A, 0.62),
  analysed(KEEP_B, 0.23),
  analysed(KEEP_C, 0.15),
  excluded(DROPPED, DROPPED_LABEL),
]

const fullSetOptions = (): OptionResult[] => [
  analysed(KEEP_A, 0.62),
  analysed(KEEP_B, 0.23),
  analysed(KEEP_C, 0.15),
]

function renderHero(options: OptionResult[]) {
  const model = buildHeroModel(
    makeHeroData({ options, recommendation: { storyHeadlines: {} } as never }),
  ) as HeroChartModel
  return render(
    <AnalysisHeroPanel
      model={model}
      rerunDisabled={false}
      comparisonScope={deriveComparisonScope(options)}
    />,
  )
}

describe('analysis hero — comparison-scope disclosure', () => {
  it('renders the scope note beneath the headline on a subset run', () => {
    renderHero(subsetOptions())
    const note = screen.getByTestId(HERO_NOTE)
    expect(note).toHaveTextContent('3 of your 4 options')
    expect(note).toHaveTextContent(DROPPED_LABEL)
  })

  // CONTROL — without this, "the note appeared" could be true of a render
  // carrying no headline claim at all (trap 13e: a control must be plausible).
  it('CONTROL — the headline the note qualifies is present in the same render', () => {
    renderHero(subsetOptions())
    expect(screen.getByTestId('hero-headline')).toBeTruthy()
  })

  // THE BOUNDARY. Without it the pin above is satisfied by rendering the note
  // unconditionally, which is the noise failure mode this change must not ship.
  it('renders NO scope note when every option was compared', () => {
    renderHero(fullSetOptions())
    expect(screen.queryByTestId(HERO_NOTE)).toBeNull()
  })
})
