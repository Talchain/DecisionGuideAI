/**
 * #2747 re-scope 2 (U2, finding 3): "Goal: at least 10%" was said for the hiring CHANGE target ("10% higher than today"),
 * because the licence target's reader dropped `frame` and its sayers passed the literal 'level'. The target is said in
 * its OWN frame, or not at all; never a change read as a level.
 */
import { describe, expect, it } from 'vitest'
import { goalChanceTargetBound, readGoalChanceTarget } from '../goalChanceTarget'
import { goalChanceHeroSays, type GoalChanceLicence } from '../goalChanceLicence'
import { goalChanceTargetWords } from '../../analysis-hero/goalChanceCopy'

/** A level misreading of the 10% change: "at least 10%" not followed by its change words. */
const LEVEL_MISREADING = /\bat least 10%(?! from today)/

const CHANGE_REL = { comparator: 'at_least', value: 0.1, unit: '%', frame: 'change_rel' }
const OPTIONS = [{ id: 'a', goalProbability: 0.4 }, { id: 'b', goalProbability: 0.3 }]
const licenceOf = (target: unknown) => ({ optionIds: ['a', 'b'], target: readGoalChanceTarget(target) }) as unknown as GoalChanceLicence

describe('the licence target is said in its own frame (finding 3)', () => {
  it('the reader carries the frame CEE wrote, verbatim (an unknown one too, so it fails closed later)', () => {
    expect(readGoalChanceTarget(CHANGE_REL)?.frame).toBe('change_rel')
    expect(readGoalChanceTarget({ ...CHANGE_REL, frame: 'per_head' })?.frame).toBe('per_head')
    expect(readGoalChanceTarget({ comparator: 'at_most', value: 400, unit: 'tickets' })).not.toHaveProperty('frame')
  })

  it('a relative change is said as the change from today, never as a level', () => {
    const words = goalChanceTargetBound(readGoalChanceTarget(CHANGE_REL)!)
    expect(words).toBe('up at least 10% from today')
    expect(words).not.toMatch(LEVEL_MISREADING)
    expect(goalChanceTargetWords(licenceOf(CHANGE_REL))).toBe('up at least 10% from today')
  })

  it('a % absolute change has no sayable size without its quantity frame, and an unread frame says no number', () => {
    expect(goalChanceTargetBound(readGoalChanceTarget({ ...CHANGE_REL, value: 10, frame: 'change_abs' })!)).toBeNull()
    expect(goalChanceTargetBound(readGoalChanceTarget({ ...CHANGE_REL, value: 10, frame: 'per_head' })!)).toBeNull()
  })

  it('an absolute change in a named unit is said in that unit, as the change', () => {
    expect(goalChanceTargetBound(readGoalChanceTarget({ comparator: 'at_most', value: -40, unit: 'tickets', frame: 'change_abs' })!))
      .toBe('down at least 40 tickets from today')
  })

  it('CONTROL: a level target (no frame) keeps its level words', () => {
    expect(goalChanceTargetBound(readGoalChanceTarget({ comparator: 'at_most', value: 400, unit: 'tickets' })!)).toBe('at most 400 tickets')
  })

  it('the hero gate checks the target in its own frame: an unsayable change opens no headline without the Run\'s chance words', () => {
    expect(goalChanceHeroSays(0.1, OPTIONS, licenceOf({ ...CHANGE_REL, value: 10, frame: 'change_abs' }), null)).toBe(false)
    expect(goalChanceHeroSays(0.1, OPTIONS, licenceOf(CHANGE_REL), null)).toBe(true)
    expect(goalChanceHeroSays(0.1, OPTIONS, licenceOf({ ...CHANGE_REL, value: 10, frame: 'change_abs' }), 'chance of productivity up 10%')).toBe(true)
  })
})
