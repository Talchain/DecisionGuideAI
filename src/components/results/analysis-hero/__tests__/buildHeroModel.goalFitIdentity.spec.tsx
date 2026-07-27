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
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

describe('buildHeroModel — goal-fit detail line identity', () => {
  it('POSITIVE CONTROL: the possessive line is what the hero prints by default', () => {
    // Fixes the un-flagged behaviour first, so the assertions below cannot
    // pass by the line being absent rather than being re-voiced.
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows[0].detail.goalFit).toContain('your goal')
  })

  it('drops the possessive framing when the number is a substituted joint figure', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: true })
    const b = makeOption({ ...OPTION_B, goalFitIsSubstitutedJoint: true })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.rows[0].detail.goalFit).not.toContain('your goal')
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

  it('keeps the possessive framing for rows that are NOT substituted', () => {
    const a = makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: true })
    const b = makeOption({ ...OPTION_B, goalFitIsSubstitutedJoint: false })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    const rowA = m.rows.find((r) => r.id === OPTION_A.id)
    const rowB = m.rows.find((r) => r.id === OPTION_B.id)
    expect(rowA?.detail.goalFit).not.toContain('your goal')
    expect(rowB?.detail.goalFit).toContain('your goal')
  })
})
