/**
 * #2747 re-scope 2 (U2, finding 3): "Goal: at least 10%" was said for the hiring CHANGE target ("10% higher than today"),
 * because the licence target's reader dropped `frame` and its sayers passed the literal 'level'. The target is said in
 * its OWN frame, or not at all; never a change read as a level.
 *
 * Round 2 (Codex r1 blocking 2; DL D, 12 Oct): a missing frame still became "(at least 10%)", because the UI's own
 * target sayer (`goalChanceTargetBound` / `goalChanceTargetWords`) defaulted a frameless target to a level. Both are
 * deleted: the UI says the licence target in no words of its own, so the hero headline opens only on CEE's served chance
 * words. Rows deleted with them (their only subject was the UI's target words): "a relative change is said as the change
 * from today, never as a level", "a % absolute change has no sayable size without its quantity frame…", "an absolute
 * change in a named unit is said in that unit, as the change", "CONTROL: a level target (no frame) keeps its level words".
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceTarget } from '../goalChanceTarget'
import { goalChanceHeroSays, type GoalChanceLicence } from '../goalChanceLicence'
import { goalChanceHeadline } from '../../analysis-hero/goalChanceCopy'

const CHANGE_REL = { comparator: 'at_least', value: 0.1, unit: '%', frame: 'change_rel' }
const LEVEL_NO_FRAME = { comparator: 'at_least', value: 10, unit: '%' }
const OPTIONS = [{ id: 'a', goalProbability: 0.4 }, { id: 'b', goalProbability: 0.3 }]
const licenceOf = (target: unknown) => ({ optionIds: ['a', 'b'], target: readGoalChanceTarget(target) }) as unknown as GoalChanceLicence

describe('the licence target is said in its own frame (finding 3)', () => {
  it('the reader carries the frame CEE wrote, verbatim (an unknown one too, so it fails closed later)', () => {
    expect(readGoalChanceTarget(CHANGE_REL)?.frame).toBe('change_rel')
    expect(readGoalChanceTarget({ ...CHANGE_REL, frame: 'per_head' })?.frame).toBe('per_head')
    expect(readGoalChanceTarget({ comparator: 'at_most', value: 400, unit: 'tickets' })).not.toHaveProperty('frame')
  })

  it('round 2 (D): the arm opens on CEE\'s licence alone, whatever the target\'s frame (present or missing); the headline needs CEE\'s chance words', () => {
    for (const target of [CHANGE_REL, LEVEL_NO_FRAME, { ...CHANGE_REL, value: 10, frame: 'change_abs' }]) {
      expect(goalChanceHeroSays(0.1, OPTIONS, licenceOf(target))).toBe(true)
      expect(goalChanceHeadline(licenceOf(target), null)).toBeNull()
      expect(goalChanceHeadline(licenceOf(target), 'chance of productivity up 10%')).toBe(
        'In this model, on current information, each option’s chance of productivity up 10%:')
    }
  })

  it('CONTROL: the arm stays shut when a licensed option is not a row, so the gate still discriminates', () => {
    expect(goalChanceHeroSays(0.1, [OPTIONS[0], { id: 'c', goalProbability: 0.3 }], licenceOf(CHANGE_REL))).toBe(false)
  })
})
