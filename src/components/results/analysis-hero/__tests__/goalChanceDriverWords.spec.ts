/**
 * G4/G5 phase 2, P3 — what an option's goal chance rests on most (design-g4g6 Q6; DL rulings 6 Oct 2026): the READER.
 *
 * CEE decides the claim (`driver_by_option` on the `GOAL_CHANCE_LICENSED` record: which row, the side where the chance
 * FALLS, whose assumption it is). These rows pin that a claim that is not the ruled shape, or sits on a withheld or
 * unknown option, is not read.
 *
 * #2747 re-scope 2 (U2): the UI no longer WORDS a driver. What a chance rests on most is CEE's own sentence
 * (`main_driver.detail`, `RunView.mainDriverDetailOf`), said verbatim on the Results hero; the sentence rows that pinned
 * the UI's own driver wording went with the wording (`goalChanceDriverLine(s)`, deleted).
 *
 * The wire records follow CEE's own shape (CEE `goal-chance-driver.ts`, `GoalChanceDriver`).
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence, type GoalChanceLicence } from '../../utils/goalChanceLicence'

const TARGET = { comparator: 'at_least', value: 120000, unit: '£' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['raise', 'hold', 'trial'], pct_by_option: { raise: 62, hold: 41, trial: 20 }, target: TARGET, ...extra,
}]
const read = (extra: Record<string, unknown>): GoalChanceLicence => {
  const licence = readGoalChanceLicence(wire(extra))
  expect(licence, 'the record itself is well formed').not.toBeNull()
  return licence as GoalChanceLicence
}

// CEE's claim shapes, one per kind.
const FACTOR = { quantity_id: 'churn', kind: 'factor_value', factor_id: 'churn', side: 'high', cut_value: 4.1, cut_unit: '%', pct_if_side: 40, pct_if_side_rounding: 'whole', authored_by: 'user' }
const STRENGTH = { quantity_id: 'price->churn', kind: 'link_strength', from: 'price', to: 'churn', side: 'low', strength: 'weaker', authored_by: 'olumi', user_stated_link: false }
const EXISTENCE = { quantity_id: 'price->churn', kind: 'link_existence', from: 'price', to: 'churn', side: 'absent', pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false }

describe('the reader: a claim is read whole or not at all', () => {
  it('CONTROL: each kind in CEE’s shape is read', () => {
    const drivers = read({ driver_by_option: { raise: FACTOR, hold: STRENGTH, trial: EXISTENCE } }).driverByOption
    expect(drivers).toEqual({
      raise: { kind: 'factor_value', factorId: 'churn', side: 'high', cutValue: 4.1, cutUnit: '%', pctIfSide: 40, authoredBy: 'user' },
      hold: { kind: 'link_strength', from: 'price', to: 'churn', strength: 'weaker', authoredBy: 'olumi', userStatedLink: false },
      trial: { kind: 'link_existence', from: 'price', to: 'churn', side: 'absent', pctIfSide: 30, authoredBy: 'olumi', userStatedLink: false },
    })
  })

  it.each([
    ['a kind off the vocabulary', { ...FACTOR, kind: 'node_value' }],
    ['an author off the vocabulary', { ...FACTOR, authored_by: 'cee' }],
    ['a factor with no id', { ...FACTOR, factor_id: '' }],
    ['a factor side that is a link’s', { ...FACTOR, side: 'absent' }],
    ['a factor with no cut', { ...FACTOR, cut_value: undefined }],
    ['a cut that is not a number', { ...FACTOR, cut_value: '4.1' }],
    ['a cut unit that is not text', { ...FACTOR, cut_unit: 4 }],
    ['a blank cut unit', { ...FACTOR, cut_unit: '  ' }],
    ['a chance that is not a whole percentage', { ...FACTOR, pct_if_side: 40.5 }],
    ['a chance above 100', { ...FACTOR, pct_if_side: 140 }],
    ['a link with one end missing', { ...EXISTENCE, to: undefined }],
    ['a link with no word on whose it is', { ...EXISTENCE, user_stated_link: undefined }],
    ['an existence side that is a factor’s', { ...EXISTENCE, side: 'high' }],
    ['an existence claim with no chance', { ...EXISTENCE, pct_if_side: undefined }],
    ['a strength off the vocabulary', { ...STRENGTH, strength: 'low' }],
    ['a claim that is not an object', 'churn'],
  ])('not read: %s', (_name, claim) => {
    const licence = read({ driver_by_option: { raise: claim, hold: FACTOR } })
    // The bad claim is dropped; the record and its sibling's claim stand.
    expect(Object.keys(licence.driverByOption ?? {})).toEqual(['hold'])
    expect(licence.pctByOption.raise).toBe(62)
  })

  it('a claim on a withheld option, or on an option the record does not name, is not read', () => {
    const licence = read({
      pct_by_option: { raise: 62, hold: 41 }, withheld_option_ids: ['trial'],
      driver_by_option: { raise: FACTOR, trial: FACTOR, elsewhere: FACTOR },
    })
    expect(Object.keys(licence.driverByOption ?? {})).toEqual(['raise'])
  })

  it('a driver map that is not an object leaves the rest of the record as it was', () => {
    const licence = read({ driver_by_option: [FACTOR] })
    expect(licence.driverByOption).toEqual({})
    expect(licence.form).toBe('each')
  })
})
