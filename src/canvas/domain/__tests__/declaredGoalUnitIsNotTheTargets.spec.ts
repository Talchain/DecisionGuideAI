/**
 * ⭐⭐⭐ THE GOAL'S UNIT AND THE TARGET'S UNIT ARE THE SAME FIELD RIGHT UP UNTIL
 * THERE IS NO TARGET — AND THAT IS THE STATE EVERY READER SETTING A FIRST
 * TARGET IS IN.
 *
 * `resolveGoalTarget` answers *"what TARGET is set?"*. It reads
 * `goal_threshold_unit` on the way past and then returns `null` when no raw
 * value survives, discarding the unit with everything else. Two surfaces
 * borrowed it for a question it does not answer and both refused a unit the
 * goal had declared (`SuccessTargetLine`, `ModelTabV2Panel.beginEdit`).
 *
 * ⛔ THE DISCRIMINATING PAIR IS THE WHOLE POINT OF THIS FILE. A test that only
 * checked `declaredGoalUnit` returns `'%'` on a goal WITH a target would pass
 * on `resolveGoalTarget(d)?.unit ?? ''` — the defective expression — because
 * there the two agree exactly. Only the no-target case separates them, so it is
 * asserted against BOTH functions in the same test: the resolver must be silent
 * and the owner must answer.
 */
import { describe, it, expect } from 'vitest'
import { declaredGoalUnit, resolveGoalTarget } from '../goalTarget'

describe('the declared unit is the goal\'s, not the target\'s', () => {
  it('⭐ answers on a goal that declares a unit and carries NO target, where the resolver cannot', () => {
    const data = { goal_threshold_unit: '%' }
    // The refutation and the claim in one test: the borrowed authority is
    // silent here, which is exactly why borrowing it was the defect.
    expect(resolveGoalTarget(data)).toBeNull()
    expect(declaredGoalUnit(data)).toBe('%')
  })

  it('agrees with the resolver wherever a target DOES exist', () => {
    const data = { goal_threshold_raw: 110, goal_threshold_unit: '%' }
    expect(resolveGoalTarget(data)?.unit).toBe('%')
    expect(declaredGoalUnit(data)).toBe('%')
  })

  it('agrees on a USER-set target too, not only a brief-derived one', () => {
    const data = { threshold_source: 'user', success_threshold: 95, goal_threshold_unit: '£' }
    expect(resolveGoalTarget(data)?.unit).toBe('£')
    expect(declaredGoalUnit(data)).toBe('£')
  })

  /**
   * ⛔ THE NEGATIVE ARM. A goal that genuinely declares no unit must still read
   * empty — otherwise the refusal this unblocks would be removed rather than
   * made rare, and `buildManualGoalTarget` would be handed a unit it refuses.
   */
  it('reads empty where the goal genuinely declares no unit', () => {
    expect(declaredGoalUnit({ goal_threshold_raw: 110 })).toBe('')
    expect(declaredGoalUnit({})).toBe('')
    expect(declaredGoalUnit(null)).toBe('')
    expect(declaredGoalUnit(undefined)).toBe('')
  })

  /**
   * ⚠ A NON-STRING IS NOT A UNIT. The field is `unknown` on `GoalTargetSource`
   * because nothing on this seam validates it, so a number or an object must
   * read empty rather than reach `buildManualGoalTarget` as `'[object Object]'`.
   */
  it('refuses a non-string, which the wire type permits', () => {
    expect(declaredGoalUnit({ goal_threshold_unit: 4 })).toBe('')
    expect(declaredGoalUnit({ goal_threshold_unit: {} })).toBe('')
    expect(declaredGoalUnit({ goal_threshold_unit: null })).toBe('')
  })
})
