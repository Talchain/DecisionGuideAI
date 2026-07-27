/**
 * WITHHELD RUNS MAY NOT DESIGNATE — the analysis-hero half (ROADMAP 1.267).
 *
 * Sibling of `../../__tests__/withheldDesignations.spec.tsx`, which covers
 * the shared comparator and the ranked card repeat. Both drive the SAME
 * fixture pair (`../../__fixtures__/withheldDesignations.fixtures`), so the
 * two halves are provably describing one run.
 *
 * It lives HERE, inside the module, because `inertness.spec.ts` allows
 * analysis-hero imports only from inside the analysis-hero module and from
 * ResultsBody — the architectural guard caught the first draft of this file
 * sitting in `results/__tests__/` and it was right to.
 *
 * ## What this half pins
 *
 * The hero is where the defect was screenshotted: on a withheld run it
 * ordered rows by win probability, numbered them 1/2/3, filled the leader's
 * badge, emphasised its readout, set `aria-current`, and appended a
 * visually-hidden "(Highest on this view)" — so a screen-reader user was
 * told which option was highest on a run whose own prose said no option
 * could be put forward yet.
 *
 * ## The srLeader reversal, stated plainly
 *
 * `heroCopy.srLeader` carried a comment arguing this cue was DELIBERATELY
 * exempt: the crown is a per-lens argmax, "a property of the view, not the
 * producer's leader designation". Row 1.306 overturns that at the
 * screenshots. An argmax rendered as a filled badge, an emphasised readout,
 * `aria-current` and a spoken label is a designation whatever it is derived
 * from. This file is the pin for the reversal, not for the original.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { OptionResult } from '../../types'
import {
  CANONICAL_IDS,
  CANONICAL_LABELS,
  DESIGNATION_RE,
  HERO_CLAIM_RE,
  HIGH_LABEL,
  MID_LABEL,
  MISALIGNED_BAND,
  MISALIGNED_BAND_VERDICT,
  PERMITTED_VERDICT,
  PROBABILITY_IDS,
  WITHHELD_VERDICT,
  flooredGoalFixtureOptions,
  misalignedBandFixtureOptions,
  noRecommendationFixtureOptions,
  renderedRowIds,
  screenReaderStrings,
  withheldFixtureOptions as options,
} from '../../__fixtures__/withheldDesignations.fixtures'

function heroModel(
  verdict: typeof WITHHELD_VERDICT,
  overrides: { options?: OptionResult[]; recommendation?: Record<string, unknown> } = {},
): HeroChartModel {
  return buildHeroModel(
    makeHeroData({
      options: overrides.options ?? options(),
      recommendation: {
        verdict,
        storyHeadlines: {},
        ...overrides.recommendation,
      } as never,
    }),
  ) as HeroChartModel
}

function renderHero(verdict: typeof WITHHELD_VERDICT) {
  return render(<AnalysisHeroPanel model={heroModel(verdict)} rerunDisabled={false} />)
}

describe('analysis hero — WITHHELD', () => {
  it('renders rows in canonical order, not probability order', () => {
    const { container } = renderHero(WITHHELD_VERDICT)
    expect(renderedRowIds(container)).toEqual([...CANONICAL_IDS])
  })

  it('renders no ordinal number token', () => {
    renderHero(WITHHELD_VERDICT)
    expect(screen.queryAllByTestId('hero-row-number')).toHaveLength(0)
  })

  it('crowns no row (no aria-current anywhere)', () => {
    const { container } = renderHero(WITHHELD_VERDICT)
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0)
  })

  /**
   * THE A11Y LEG. `sr-only` is invisible to sighted users and to a text diff
   * of the rendered page, which is precisely why it survived four prose
   * slices — the render probe only caught it because text extraction sees
   * what a screenshot does not.
   */
  it('exposes no designation to a screen reader', () => {
    const { container } = renderHero(WITHHELD_VERDICT)
    for (const s of screenReaderStrings(container)) {
      expect(s, `screen-reader string leaked a designation: "${s}"`).not.toMatch(
        DESIGNATION_RE,
      )
    }
  })

  /**
   * The REAL accessible-name computation, over `aria-labelledby` — this is
   * what a screen reader announces when the row receives focus, and it is
   * the assertion the sr-only cue actually has to survive. Asserting the
   * span's absence from the DOM alone would not prove it had stopped
   * reaching the announced name.
   */
  it('announces no designation in any row button accessible name', () => {
    renderHero(WITHHELD_VERDICT)
    for (const label of CANONICAL_LABELS) {
      const row = screen.getByRole('button', { name: new RegExp(label) })
      expect(row).not.toHaveAccessibleName(/highest/i)
    }
  })

  it('does not put the designation in the DOM text either', () => {
    const { container } = renderHero(WITHHELD_VERDICT)
    expect(container.textContent ?? '').not.toMatch(/Highest on this view/i)
  })

  it('DATA PRESERVED: every option is still listed', () => {
    renderHero(WITHHELD_VERDICT)
    for (const label of CANONICAL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getAllByTestId('hero-row-label')).toHaveLength(3)
  })
})

describe('analysis hero — PERMITTED (over-suppression control)', () => {
  it('renders rows in probability order, exactly as today', () => {
    const { container } = renderHero(PERMITTED_VERDICT)
    expect(renderedRowIds(container)).toEqual([...PROBABILITY_IDS])
  })

  it('still renders the ordinal number tokens 1, 2, 3', () => {
    renderHero(PERMITTED_VERDICT)
    const tokens = screen.getAllByTestId('hero-row-number').map((n) => n.textContent?.trim())
    expect(tokens).toEqual(['1', '2', '3'])
  })

  it('still crowns the leader with aria-current and the sr-only cue', () => {
    const { container } = renderHero(PERMITTED_VERDICT)
    expect(container.querySelectorAll('[aria-current]').length).toBeGreaterThan(0)
    expect(container.textContent ?? '').toMatch(/Highest on this view/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The model's own gate — asserted directly so a regression names the FIELD
// rather than a rendered symptom three components away.
// ─────────────────────────────────────────────────────────────────────────────

describe('HeroChartModel.designationsWithheld', () => {
  it('is true on the withheld run and nulls every lens leader', () => {
    const model = heroModel(WITHHELD_VERDICT)
    expect(model.designationsWithheld).toBe(true)
    expect(Object.values(model.leaders).every((v) => v == null)).toBe(true)
  })

  it('is false on the permitted run and keeps the lens leaders', () => {
    const model = heroModel(PERMITTED_VERDICT)
    expect(model.designationsWithheld).toBe(false)
    expect(Object.values(model.leaders).some((v) => v != null)).toBe(true)
  })

  it('is false when no verdict is supplied (legacy fixtures unchanged)', () => {
    const model = buildHeroModel(makeHeroData({ options: options() })) as HeroChartModel
    expect(model.designationsWithheld).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE PROSE LEG — added after the 2026-07-27 browser sweep.
//
// The blocks above pin the NON-PROSE designations (order, ordinals, crown,
// sr-only cue). They passed on the deployed build while the hero's own two
// sentences went on naming a leader: the sweep photographed
//
//     No option is currently on track to meet every target this run scored.
//     Continue Current Arrangement (Status Quo) has the highest expected outcome.
//
// — the withheld headline with the leader claim relocated one line down, which
// is the exact failure mode `buildHeroModel`'s state-C subline comment already
// names and guards against. That guard was never applied to its siblings.
//
// Driven by RUN SHAPES rather than by branch names on purpose: a branch list
// is the hand-maintained mirror this programme keeps being bitten by. Each
// shape is an input a live withheld run can actually take; if a future edit
// adds a branch, the shape that reaches it still has to satisfy the contract.
// ─────────────────────────────────────────────────────────────────────────────

interface RunShape {
  name: string
  options: OptionResult[]
  verdict: typeof WITHHELD_VERDICT
  recommendation?: Record<string, unknown>
}

const WITHHELD_RUN_SHAPES: RunShape[] = [
  {
    // goal-fit crown: the goalProbability argmax is unique and clears the
    // floor, so the headline crowns it and the subline agrees with it.
    name: 'goal-fit crown',
    options: options(),
    verdict: WITHHELD_VERDICT,
  },
  {
    // THE SWEEP RUN: no option on track, so the neutral headline is correct
    // and the leader claim survives in the subline alone.
    name: 'no option on track (the sweep run)',
    options: flooredGoalFixtureOptions(),
    verdict: WITHHELD_VERDICT,
  },
  {
    // the hero's own producer-band fallback re-banding a withheld claim,
    // because its identity gate anchors on the RECOMMENDED option while
    // `deriveDecisionVerdict`'s anchors on the win argmax.
    name: 'misaligned producer band',
    options: misalignedBandFixtureOptions(),
    verdict: MISALIGNED_BAND_VERDICT,
    recommendation: { headlineBanded: MISALIGNED_BAND },
  },
  {
    // no recommended option among the rows: the headline states the outcome
    // fact itself, which names an option just the same.
    name: 'no recommended option',
    options: noRecommendationFixtureOptions(),
    verdict: WITHHELD_VERDICT,
    recommendation: { recommendedOption: null },
  },
]

function heroProse(shape: RunShape): { headline: string; subline: string | null } {
  const model = heroModel(shape.verdict, {
    options: shape.options,
    recommendation: shape.recommendation,
  })
  expect(
    model.designationsWithheld,
    `run shape "${shape.name}" is not withheld — the assertion below would be vacuous`,
  ).toBe(true)
  return { headline: model.headline, subline: model.subline }
}

describe('analysis hero — WITHHELD: the prose may not designate either', () => {
  for (const shape of WITHHELD_RUN_SHAPES) {
    it(`names no option in the headline or the subline — ${shape.name}`, () => {
      const { headline, subline } = heroProse(shape)
      for (const [surface, text] of [
        ['headline', headline],
        ['subline', subline ?? ''],
      ] as const) {
        for (const label of CANONICAL_LABELS) {
          expect(
            text,
            `${surface} named an option on a withheld run: "${text}"`,
          ).not.toContain(label)
        }
      }
    })

    it(`asserts no superlative in the headline or the subline — ${shape.name}`, () => {
      const { headline, subline } = heroProse(shape)
      expect(headline, `headline claimed a superlative: "${headline}"`).not.toMatch(
        HERO_CLAIM_RE,
      )
      expect(subline ?? '', `subline claimed a superlative: "${subline}"`).not.toMatch(
        HERO_CLAIM_RE,
      )
    })
  }

  /**
   * OVER-SUPPRESSION GUARD. The sweep proved this surface renders on a
   * withheld run, so an empty subline would be a regression of its own —
   * the fix must SUBSTITUTE the neutral companion line, not delete the line.
   */
  it('still renders a non-empty subline on the sweep run', () => {
    const { subline } = heroProse(WITHHELD_RUN_SHAPES[1])
    expect(subline).toBeTruthy()
    expect((subline ?? '').trim().length).toBeGreaterThan(0)
  })

  /** The neutral line is the one the guarded sibling already prescribes. */
  it('uses the existing state-C companion line, not new copy', () => {
    expect(heroProse(WITHHELD_RUN_SHAPES[1]).subline).toBe(
      'Compare the top options before deciding.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PERMITTED — the over-suppression controls for the prose leg. Two are pinned
// BYTE-FOR-BYTE to what the deployed build renders today, so a fix that
// suppressed the claim on permitted runs too would fail here rather than pass
// quietly by suppressing everything.
// ─────────────────────────────────────────────────────────────────────────────

describe('analysis hero — PERMITTED prose (over-suppression controls)', () => {
  it('goal-fit crown: headline and subline unchanged, byte-for-byte', () => {
    const model = heroModel(PERMITTED_VERDICT)
    expect(model.designationsWithheld).toBe(false)
    expect(model.headline).toBe(
      'Hire two developers is most likely to meet every target this run scored.',
    )
    expect(model.subline).toBe('Hire two developers also has the strongest expected outcome.')
  })

  it('no option on track: headline and subline unchanged, byte-for-byte', () => {
    const model = heroModel(PERMITTED_VERDICT, { options: flooredGoalFixtureOptions() })
    expect(model.designationsWithheld).toBe(false)
    expect(model.headline).toBe(
      'No option is currently on track to meet every target this run scored.',
    )
    expect(model.subline).toBe('Hire two developers has the highest expected outcome.')
  })

  it('producer band: still bands the recommended option by name', () => {
    const model = heroModel(PERMITTED_VERDICT, {
      options: misalignedBandFixtureOptions(),
      recommendation: { headlineBanded: MISALIGNED_BAND },
    })
    expect(model.designationsWithheld).toBe(false)
    expect(model.headline).toContain(MID_LABEL)
    expect(model.headline).toMatch(HERO_CLAIM_RE)
  })

  it('no recommended option: still headlines the outcome leader by name', () => {
    const model = heroModel(PERMITTED_VERDICT, {
      options: noRecommendationFixtureOptions(),
      recommendation: { recommendedOption: null },
    })
    expect(model.designationsWithheld).toBe(false)
    expect(model.headline).toContain(HIGH_LABEL)
    expect(model.headline).toMatch(HERO_CLAIM_RE)
  })
})
