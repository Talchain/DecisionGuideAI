/**
 * buildHeroModel — GOAL-PROBABILITY IDENTITY in the hero detail line.
 *
 * `probability_of_joint_goal` standing in for an absent `goal_probability`
 * (the ISL-auto-derived-goal-threshold run) is a real, computed, decision-
 * relevant number, and the hero shows it. But it answers "P(all targets
 * jointly satisfied)", not "P(this option clears YOUR goal)" — so the
 * possessive sentence the hero otherwise prints names a question the number
 * does not answer.
 *
 * The row carries `goalFitIsSubstitutedJoint`, set once by
 * `selectGoalProbability` (via useResultsSectionData) and never re-derived
 * here — the same discipline the caveat flag follows, and for the same
 * reason: two sites deriving one meaning is how the canvas and the panel
 * came to contradict each other.
 */
import '@testing-library/jest-dom/vitest'
import { chanceCellOf } from './helpers/chanceCellOf'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildRunView } from '../../../../canvas/runView/runView'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

afterEach(cleanup)

function constrainedRow() {
  const data = makeHeroData({ options: [
    makeOption({ ...OPTION_A, constraintAnalysis: { constraints: [{ node_id: 'limit' }] } as never }),
    OPTION_B,
  ] })
  data.runView = buildRunView({ inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
    option_ids: [OPTION_A.id, OPTION_B.id], pct_by_option: { [OPTION_A.id]: 34, [OPTION_B.id]: 49 },
    target: { comparator: 'at_least', value: 62, unit: 'count' },
  }] })
  data.goalChanceLicence = data.runView.goalChance
  const model = chart(buildHeroModel(data))
  const row = model.rows.find(r => r.id === OPTION_A.id)!
  const cellText = chanceCellOf(data, row.id).text
  expect(cellText).toContain('34%')
  render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  const element = screen.getByTestId(`hero-option-row-${row.index}`)
  fireEvent.click(within(element).getByRole('button'))
  return { row, element, cellText }
}

describe('buildHeroModel — goal-fit detail line identity', () => {
  // C-FALSE: joint words beside a goal-only figure removed (DL ruling 8 Oct; staging measurement /private/tmp/ws5-core-constrained.md)
  it('C-FALSE removed: a constrained goal row shows exactly its cell without joint words', () => {
    const { row, element, cellText } = constrainedRow()
    expect(row.goal.readout).toBe(cellText)
    expect(element.querySelector('.text-right > span')!.textContent).toBe(cellText)
    expect(element.textContent).not.toMatch(/and limits|limits together/i)
  })

  it('C-FALSE removed: a constrained goal detail shows exactly its cell without joint words', () => {
    const { row, element, cellText } = constrainedRow()
    expect(row.detail.goalFit).toBe(cellText)
    expect(within(element).getByTestId('hero-detail-goal-fit').textContent).toBe(cellText)
    expect(within(element).getByTestId('hero-option-detail').textContent).not.toMatch(/and limits|limits together/i)
  })

  it('POSITIVE CONTROL: the target line is what the hero prints by default', () => {
    // Fixes the un-flagged behaviour first, so the assertions below cannot
    // pass by the line being absent rather than being re-voiced. The plain arm
    // says "Reaches the target in N% of model runs" (AIQ #72 5885033487).
    const data = makeHeroData()
    const m = chart(buildHeroModel(data))
    expect(m.rows[0].detail.goalFit).toBe(chanceCellOf(data, OPTION_A.id).text ?? HERO_COPY.readout.missing)
  })

  it('drops the possessive framing when the number is a substituted joint figure', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: true })
    const b = makeOption({ ...OPTION_B, goalFitIsSubstitutedJoint: true })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.rows[0].detail.goalFit).not.toContain('chance of meeting your goal')
    expect(m.rows[0].detail.goalFit).toBe(
      HERO_COPY.detail.goalFitJointBasis(m.rows[0].goal.readout),
    )
  })

  it('still shows the NUMBER on a substituted joint figure (copy switch, never a value transform)', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: true })
    const plain = chart(buildHeroModel(makeHeroData({ options: [a, makeOption(OPTION_B)] })))
    const control = chart(buildHeroModel(makeHeroData()))
    expect(plain.rows[0].goal.value).toBe(control.rows[0].goal.value)
    expect(plain.rows[0].goal.readout).toBe(control.rows[0].goal.readout)
  })

  it('keeps the target framing for rows that are NOT substituted', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: true })
    const b = makeOption({ ...OPTION_B, goalFitIsSubstitutedJoint: false })
    const data = makeHeroData({ options: [a, b] })
    const m = chart(buildHeroModel(data))
    const rowA = m.rows.find((r) => r.id === OPTION_A.id)
    const rowB = m.rows.find((r) => r.id === OPTION_B.id)
    expect(rowA?.detail.goalFit).not.toContain('chance of meeting your goal')
    expect(rowB?.detail.goalFit).toBe(chanceCellOf(data, OPTION_B.id).text ?? HERO_COPY.readout.missing)
  })
})
