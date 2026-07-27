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
import {
  CANONICAL_IDS,
  CANONICAL_LABELS,
  DESIGNATION_RE,
  PERMITTED_VERDICT,
  PROBABILITY_IDS,
  WITHHELD_VERDICT,
  renderedRowIds,
  screenReaderStrings,
  withheldFixtureOptions as options,
} from '../../__fixtures__/withheldDesignations.fixtures'

function heroModel(verdict: typeof WITHHELD_VERDICT): HeroChartModel {
  return buildHeroModel(
    makeHeroData({
      options: options(),
      recommendation: { verdict, storyHeadlines: {} },
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
