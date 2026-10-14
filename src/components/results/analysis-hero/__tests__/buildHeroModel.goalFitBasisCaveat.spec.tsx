/**
 * buildHeroModel — goal_fit_basis modelled-basis caveat on the hero detail
 * line (ROADMAP 1.6b follow-up, claim-integrity).
 *
 * Honesty rule (UI-BOUNDARY-DATA-INVENTORY.md §5): when
 * probability_of_joint_goal is shown and goal_fit_basis.scored_from is
 * 'modelled_outcome_distribution', the caveat MUST render adjacent to the
 * number — a bare number is false precision. The caveat must NEVER appear
 * for a row that doesn't carry the flag (no invention), matching
 * OptionCards' gate on `goalFitIsModelledBasis` exactly.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'
import { withChanceReport } from './helpers/chanceCellOf'
import { report as servedReport } from '../../__tests__/helpers/paulRun4276f3f9'

// WS5 (#2709): goal rows come from RunView cells, so the numeric fixture is fed through a LICENSED report carrying the
// same values (C-CELL, as goalAttainmentCopy). A numeric goal with no licence is not a served shape.
function licensed(data: ReturnType<typeof makeHeroData>): ReturnType<typeof makeHeroData> {
  const options = data.recommendation.allOptions
  return withChanceReport(data, {
    ...servedReport,
    option_probabilities: Object.fromEntries(options.map(o => [o.id, { goal_probability: o.goalProbability }])),
    inference_warnings: [{
      code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
      option_ids: options.map(o => o.id),
      pct_by_option: Object.fromEntries(options.map(o => [o.id, Math.round(o.goalProbability! * 100)])),
      target: { comparator: 'at_least', value: data.recommendation.goalThreshold, unit: 'count' },
    }],
  })
}

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

describe('buildHeroModel — goal_fit_basis caveat', () => {
  it('renders the modelled-basis caveat adjacent to the goalFit line when flagged', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsModelledBasis: true })
    const b = makeOption({ ...OPTION_B, goalFitIsModelledBasis: false })
    const m = chart(buildHeroModel(licensed(makeHeroData({ options: [a, b] }))))
    expect(m.rows[0].detail.goalFit).toBeTruthy()
    expect(m.rows[0].detail.goalFitCaveat).toBe(GOAL_FIT_BASIS_CAVEAT_COPY)
    expect(m.rows[1].detail.goalFitCaveat).toBeUndefined()
  })

  it('renders no caveat for any row when the flag is absent (honest default)', () => {
    const m = chart(buildHeroModel(licensed(makeHeroData())))
    expect(m.rows[0].detail.goalFit).toBeTruthy()
    expect(m.rows[0].detail.goalFitCaveat).toBeUndefined()
    expect(m.rows[1].detail.goalFitCaveat).toBeUndefined()
  })

  it('withholds the caveat when no user target exists, even if flagged (UI-SEM-071 suppression)', () => {
    // Without a user target, goalValue is nulled at source, so the caveat
    // must not appear even though the row carries the modelled-basis flag —
    // the caveat qualifies a number that isn't shown.
    const a = makeOption({ ...OPTION_A, goalFitIsModelledBasis: true })
    const b = makeOption({ ...OPTION_B, goalFitIsModelledBasis: true })
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { goalThreshold: null }, options: [a, b] })),
    )
    expect(m.rows[0].goal.value).toBeNull()
    expect(m.rows[0].detail.goalFitCaveat).toBeUndefined()
    expect(m.rows[1].detail.goalFitCaveat).toBeUndefined()
  })
})

describe('AnalysisHeroPanel — goal_fit_basis caveat render', () => {
  it('renders the caveat inside the opened option detail when flagged', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsModelledBasis: true })
    const b = makeOption({ ...OPTION_B, goalFitIsModelledBasis: false })
    // C-AVAIL: this render fixture also needs the licensed report that supplies its displayed figure.
    const model = chart(buildHeroModel(licensed(makeHeroData({ options: [a, b] }))))
    render(
      <AnalysisHeroPanel
        model={model}
        rerunDisabled={false}
        focusPanelMounted={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-goal-fit-caveat')).toHaveTextContent(
      GOAL_FIT_BASIS_CAVEAT_COPY,
    )
  })

  it('renders no caveat testid anywhere when no row is flagged', () => {
    const model = chart(buildHeroModel(makeHeroData()))
    render(
      <AnalysisHeroPanel
        model={model}
        rerunDisabled={false}
        focusPanelMounted={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.queryByTestId('hero-detail-goal-fit-caveat')).toBeNull()
  })
})
