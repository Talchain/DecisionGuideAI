/**
 * ⭐ W3 — A UNITLESS SCORE IS NEVER SHOWN AS AN OUTCOME (AIQ #72 5894808343 (3); DL 5894722351 (4)).
 *
 * Served (R3-B 5894575583, guest `7c23be87`, UI `d90af91`): the cut-costs brief's goal has NO today's level, so PLoT
 * returns the options' outcomes as normalised model scores (Stay on AWS −0.2233), and the hero's "Likely outcome"
 * printed them through `formatThreshold`'s "% shift" branch as "Stay on AWS −22%" beside "−24%" and "−23%": a cut
 * nobody computed, from an assumed baseline of 0.
 *
 * AIQ's rule: an outcome is shown in the goal's units or as a change ONLY when the goal holds today's level; otherwise
 * the lens says "Not shown: Olumi doesn't hold today's level of '…', so these outcomes can't be given in £ or as a
 * change." A unitless score is never shown.
 *
 * The options below carry R3-B's reported scores (constructed, not a served capture); the control is the same run
 * with a real unit. The served witness on `7c23be87` is the acceptance.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { selectVisibleLenses } from '../HeroLensTabs'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'

const GOAL = 'Monthly cloud spend'

function scored(id: string, label: string, mean: number, winProbability: number) {
  return makeOption({
    id,
    label,
    expected: mean,
    outcome: { mean, p10: mean - 0.03, p50: mean, p90: mean + 0.03 },
    winProbability,
  })
}

const OPTIONS = [
  scored('opt_stay', 'Stay on AWS', -0.2233, 0.45),
  scored('opt_switch', 'Switch to GCP', -0.2412, 0.55),
  scored('opt_phased', 'Phased migration', -0.2297, 0.004),
]

function heroFor(recommendation: Record<string, unknown>): HeroChartModel {
  const model = buildHeroModel(
    makeHeroData({ options: OPTIONS, recommendation: { goalLabel: GOAL, goalThreshold: null, ...recommendation } }),
  )
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

const noLevel = () => heroFor({ isNormalised: true, outcomeUnit: undefined, outcomeUnitSymbol: undefined })

describe('W3: no today\'s level → the hero shows no outcome figure, and says why', () => {
  it('SERVED SHAPE: no option carries an outcome figure, range or readout', () => {
    const m = noLevel()
    for (const row of m.rows) {
      expect(row.outcome).toEqual({ p10: null, p90: null, centre: null, readout: HERO_COPY.readout.missing })
      expect(row.detail.range).toBeUndefined()
    }
    expect(m.lenses).not.toContain('outcome')
    expect(m.leaders.outcome).toBeNull()
    expect(m.outcomeDomain).toBeNull()
  })

  it('SERVED SHAPE: no "%" rests on the scores anywhere in the model (headline, readouts, detail lines)', () => {
    const text = JSON.stringify(noLevel())
    expect(text).not.toMatch(/[−-]\s?2[234]\s?%/)
    expect(text).not.toMatch(/0\.22|0\.24|0\.23/)
  })

  it('SERVED SHAPE: the outcome lens stays on the strip and carries AIQ\'s sentence, naming the goal', () => {
    const m = noLevel()
    expect(m.outcomeWithheldNoTodayLevel).toBe(true)
    expect(m.outcomeWithheldBody).toBe(
      "Not shown: Olumi doesn't hold today's level of ‘Monthly cloud spend’, so these outcomes can't be given in the goal's units or as a change.",
    )
    render(<AnalysisHeroPanel model={m} rerunDisabled={false} />)
    const tab = screen.getByRole('tab', { name: /Likely outcome/ })
    fireEvent.click(tab)
    expect(screen.getByText(m.outcomeWithheldBody!)).toBeTruthy()
    expect(document.body.textContent ?? '').not.toMatch(/[−-]\s?2[234]\s?%/)
  })

  it('CONTROL — a run in the goal\'s units: outcomes are shown as before, and nothing is withheld', () => {
    const m = heroFor({ isNormalised: false, outcomeUnit: 'currency', outcomeUnitSymbol: '£' })
    expect(m.lenses).toContain('outcome')
    expect(m.outcomeWithheldNoTodayLevel).toBe(false)
    expect(m.outcomeWithheldBody).toBeNull()
    for (const row of m.rows) expect(row.outcome.centre).not.toBeNull()
  })
})

describe('W3: the strip keeps a withheld lens only when the model asks', () => {
  it('without the model\'s ask the rule is unchanged: only Goal fit stays when empty', () => {
    expect(selectVisibleLenses([])).toEqual(['goal'])
  })
  it('with it, "Likely outcome" stays; producer-gap lenses stay hidden', () => {
    expect(selectVisibleLenses([], ['outcome'])).toEqual(['goal', 'outcome'])
  })
})
