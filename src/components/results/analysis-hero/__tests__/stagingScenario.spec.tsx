/**
 * Staging regression — the exact run from the manual trust review
 * (debug export 012093c1, client 10cd309b), reproduced end to end through
 * the pure model and both rendered surfaces.
 *
 * The run: goal "productivity ROI" with raw threshold 20 (%), cap 25;
 * four options whose denormalised outcome centres sit within ±0.41% while
 * p10/p90 spreads reach ±6.9%; win probabilities 38.7/38.0/23.0/0.3%; and
 * probability_of_joint_goal = 0 for every option (auto goal threshold).
 *
 * What went wrong on staging, pinned here forever:
 *  - readouts inflated ×100 ("-37%", "40%") while OptionCards showed raw
 *    values — both surfaces must now share one scale (check A);
 *  - the target line said "80%" (normalised 0.8 leaked into user units) —
 *    it must read "20%" and sit inside the layout domain;
 *  - the headline crowned the win-probability leader with outcome-lens
 *    wording while the visible chart ranked it last — with the goal lens
 *    restored and every option at 0%, the honest state is the
 *    no-option-on-track headline plus the outcome-leader subline;
 *  - hero numbering contradicted the cards below — both now use the
 *    shared win-probability display order.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { OptionCards } from '../../OptionCards'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'
import type { OptionResult } from '../../types'

// Denormalised user-unit values: producer normalised outcome × cap 25.
const CAP = 25
const STAGING_OPTIONS: OptionResult[] = [
  makeOption({
    id: 'opt_virtual',
    label: 'Use Virtual Assistant Service',
    expected: 0.016169463109813893 * CAP,
    outcome: {
      mean: 0.016169463109813893 * CAP,
      p10: -0.10984511002983598 * CAP,
      p50: 0.015170281737704926 * CAP,
      p90: 0.14336571646189283 * CAP,
    },
    winProbability: 0.23,
    goalProbability: 0,
    nValidSamples: 4000,
  }),
  makeOption({
    id: 'opt_hire_parttime',
    label: 'Hire Part-Time PA',
    expected: 0.0033772367188032826 * CAP,
    outcome: {
      mean: 0.0033772367188032826 * CAP,
      p10: -0.1603958071527788 * CAP,
      p50: 0.0010471562039442855 * CAP,
      p90: 0.17275256936419212 * CAP,
    },
    winProbability: 0.00325,
    goalProbability: 0,
    nValidSamples: 4000,
  }),
  makeOption({
    id: 'opt_status_quo',
    label: 'No Assistant (Status Quo)',
    expected: -0.0007347430497562173 * CAP,
    outcome: {
      mean: -0.0007347430497562173 * CAP,
      p10: -0.09578819492982026 * CAP,
      p50: 0,
      p90: 0.09669126514877201 * CAP,
    },
    winProbability: 0.3795,
    goalProbability: 0,
    nValidSamples: 4000,
  }),
  makeOption({
    id: 'opt_hire_fulltime',
    label: 'Hire Full-Time PA',
    expected: -0.014668886265334986 * CAP,
    outcome: {
      mean: -0.014668886265334986 * CAP,
      p10: -0.2771086209292998 * CAP,
      p50: -0.014154519600240147 * CAP,
      p90: 0.2554064091440543 * CAP,
    },
    winProbability: 0.38725,
    isRecommended: true,
    goalProbability: 0,
    nValidSamples: 4000,
  }),
]

function stagingData() {
  return makeHeroData({
    options: STAGING_OPTIONS,
    recommendation: {
      goalLabel: 'Achieve 20%+ Productivity Gain',
      outcomeUnit: 'percent',
      outcomeUnitSymbol: undefined,
      // Post-fix store contract: goal_threshold_raw in user units.
      goalThreshold: 20,
      isNormalised: false,
      storyHeadlines: undefined,
      flipThresholds: undefined,
    },
  })
}

function stagingModel(): HeroChartModel {
  const model = buildHeroModel(stagingData())
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

describe('staging scenario — model truth', () => {
  it('orders and numbers rows by the shared display order (matches the cards below)', () => {
    const m = stagingModel()
    expect(m.rows.map((r) => r.id)).toEqual([
      'opt_hire_fulltime',
      'opt_status_quo',
      'opt_virtual',
      'opt_hire_parttime',
    ])
    expect(m.rows.map((r) => r.index)).toEqual([1, 2, 3, 4])
  })

  it('states the goal truth: no option on track, outcome leader named in the subline', () => {
    const m = stagingModel()
    expect(m.headline).toBe('No option is currently on track to reach your goal.')
    expect(m.subline).toBe('Use Virtual Assistant Service has the highest expected outcome.')
    // No goal-fit leader ring; the outcome highlight stays factual.
    expect(m.leaders.goal).toBeNull()
    expect(m.leaders.outcome).toBe('opt_virtual')
    // Goal lens exists AND is the default — the "< 1%" rows ARE the story.
    expect(m.lenses).toEqual(['goal', 'outcome'])
    expect(m.defaultLens).toBe('goal')
    expect(m.rows.every((r) => r.goal.readout === '< 1%')).toBe(true)
  })

  it('outcome readouts equal the denormalised values — never ×100 — and share the dot source field', () => {
    const m = stagingModel()
    const byId = Object.fromEntries(m.rows.map((r) => [r.id, r]))
    expect(byId.opt_hire_fulltime.outcome.readout).toBe('-0.37%')
    expect(byId.opt_virtual.outcome.readout).toBe('0.4%')
    expect(byId.opt_status_quo.outcome.readout).toBe('-0.02%')
    expect(byId.opt_hire_parttime.outcome.readout).toBe('0.08%')
    // Dot position and readout derive from the SAME centre field.
    for (const [id, opt] of STAGING_OPTIONS.map((o) => [o.id, o] as const)) {
      expect(byId[id].outcome.centre).toBe(opt.expected)
    }
  })

  it('places the raw 20% target inside the layout domain (never a normalised 0.8 or an "80%" label)', () => {
    const m = stagingModel()
    expect(m.targetValue).toBe(20)
    expect(m.targetReadout).toBe('20%')
    expect(m.outcomeDomain!.max).toBeGreaterThanOrEqual(20)
    expect(m.outcomeDomain!.min).toBeLessThanOrEqual(-6.92)
    // Every row draws a range bar — the caption's "bars" claim is sourced.
    expect(m.rows.every((r) => r.outcome.p10 != null && r.outcome.p90 != null)).toBe(true)
  })
})

describe('staging scenario — rendered surfaces (numeric parity, check A)', () => {
  function renderHero() {
    return render(
      <AnalysisHeroPanel
        model={stagingModel()}
        isStale={false}
        onRerun={() => {}}
        rerunDisabled={false}
        focusPanelMounted={false}
      />,
    )
  }

  it('hero never renders the inflated strings; outcome lens names the 20% target', () => {
    const { container } = renderHero()
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    const text = container.textContent ?? ''
    expect(text).toContain('your target of 20%')
    expect(text).toContain('-0.37%')
    expect(text).not.toContain('-37%')
    expect(text).not.toContain('80%')
    for (const marker of screen.getAllByTestId('hero-target-marker')) {
      expect(marker).toHaveAttribute('data-visible', 'true')
    }
  })

  it('hero row 1 is the same option OptionCards ranks first, and both surfaces share one scale', () => {
    renderHero()
    expect(screen.getByTestId('hero-option-row-1')).toHaveAttribute(
      'data-option-id',
      'opt_hire_fulltime',
    )
    // Same options through the real OptionCards (winner = recommended;
    // expertMode exposes the p10-p90 range labels for the scale check).
    const cards = render(
      <OptionCards
        options={STAGING_OPTIONS}
        winnerId="opt_hire_fulltime"
        hasGoalThreshold
        expertMode
      />,
    )
    const cardsText = cards.container.textContent ?? ''
    // Raw-scale range labels (formatRangeValue), not ×100 inflations.
    expect(cardsText).toContain('-6.93')
    expect(cardsText).toContain('6.39')
    expect(cardsText).not.toContain('-37%')
    expect(cardsText).not.toContain('80%')
    // Goal honesty below stays consistent with the hero's "< 1%" readouts.
    expect(within(cards.container).getAllByText(/< 1% likely to reach target/).length)
      .toBeGreaterThan(0)
  })
})
