import { describe, expect, it } from 'vitest'
import served from './fixtures/served-t1b-f440be4a-goal-chance-records.json'
import { goalChanceDriverLines, goalChanceHeadline, goalChanceOptionLines } from '../goalChanceCopy'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import {
  GOAL_IDENTITY_WITHHELD_FALLBACK, readGoalFigureWithholds, readGoalIdentityWithheld,
  readGoalWithheldReasonFor, withheldClaimsFor,
} from '../../utils/goalIdentityWithheld'

const LICENSED = served.inference_warnings.find((w) => w.code === 'GOAL_CHANCE_LICENSED')!
const READING = {
  v: 1, source: 'olumi_reading', goal: { id: 'mrr', label: 'MRR' },
  factors: [{ id: 'price', label: 'Pro plan price' }, { id: 'subscribers', label: 'Pro paying subscribers' }],
  addends: [
    { id: 'churn', label: 'MRR lost to price-driven churn', sign: 'less' },
    { id: 'expansion', label: 'Expansion revenue', sign: 'plus' },
  ],
}
const read = (reading_label: unknown) => readGoalChanceLicence([{ ...LICENSED, reading_label }])
const holder = (reading_label: unknown, extra: unknown[] = []) => ({ inference_warnings: [{ ...LICENSED, reading_label }, ...extra] })

describe('P02 GR2: strict reading-label shape and same-sentence copy', () => {
  it('parses the complete reading and preserves factor/addend order and signs', () => {
    const licence = read(READING)!
    expect(licence.readingLabel).toEqual(READING)
    expect(goalChanceOptionLines(licence, () => 'Option')?.[0]).toBe(
      '‘Option’: about 46% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’, less ‘MRR lost to price-driven churn’, plus ‘Expansion revenue’ (Olumi’s reading).',
    )
    const reversed = read({ ...READING, factors: [...READING.factors].reverse(), addends: [...READING.addends].reverse() })!
    expect(goalChanceOptionLines(reversed, () => 'Option')?.[0]).toBe(
      '‘Option’: about 46% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro paying subscribers’ × ‘Pro plan price’, plus ‘Expansion revenue’, less ‘MRR lost to price-driven churn’ (Olumi’s reading).',
    )
  })

  it('allows no addends and never repeats the model clause', () => {
    const line = goalChanceOptionLines(read({ ...READING, addends: [] })!, () => 'Option')![0]
    expect(line).toBe('‘Option’: about 46% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’ (Olumi’s reading).')
    expect(line.match(/in this model/g)).toHaveLength(1)
  })

  it('uses the contract’s about-N-percent template for labelled extremes while preserving the plain bounds', () => {
    const licence = read({ ...READING, addends: [] })!
    const [a, b] = licence.optionIds
    const labelled = { ...licence, pctByOption: { ...licence.pctByOption, [a]: 0, [b]: 100 } }
    expect(goalChanceOptionLines(labelled, () => 'Option')?.slice(0, 2)).toEqual([
      '‘Option’: less than 1% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’ (Olumi’s reading).',
      '‘Option’: more than 99% chance of meeting your goal, in this model, if ‘MRR’ = ‘Pro plan price’ × ‘Pro paying subscribers’ (Olumi’s reading).',
    ])
    const { readingLabel: _reading, ...plain } = labelled
    expect(goalChanceOptionLines(plain, () => 'Option')?.slice(0, 2)).toEqual([
      '‘Option’: less than 1% chance of meeting your goal, in this model.',
      '‘Option’: more than 99% chance of meeting your goal, in this model.',
    ])
  })

  it.each([
    null, undefined, false, 0, '', [], {},
    { ...READING, v: '1' }, { ...READING, v: 2 }, { ...READING, source: 'user' },
    { ...READING, goal: null }, { ...READING, goal: { id: 'mrr' } },
    { ...READING, goal: { id: '', label: 'MRR' } }, { ...READING, goal: { id: 'mrr', label: ' ' } },
    { ...READING, factors: null }, { ...READING, factors: [] }, { ...READING, factors: Array(2) },
    { ...READING, factors: [READING.factors[0]] },
    { ...READING, factors: [...READING.factors, READING.factors[0]] },
    { ...READING, factors: [READING.factors[0], { id: 'subscribers', label: 1 }] },
    { ...READING, factors: [READING.factors[0], { id: ' ', label: 'Subscribers' }] },
    { ...READING, addends: undefined }, { ...READING, addends: null }, { ...READING, addends: [null] },
    { ...READING, addends: [{ id: 'churn', label: 'Churn' }] },
    { ...READING, addends: [{ id: 'churn', label: 'Churn', sign: 'minus' }] },
    { ...READING, addends: [{ id: 'churn', label: '', sign: 'less' }] },
  ])('rejects a malformed present reading_label %j without returning a plain licence', (reading) => {
    expect(read(reading)).toBeNull()
    const h = holder(reading)
    const withholds = readGoalFigureWithholds(h)
    expect(withholds).toHaveLength(1)
    expect(withholds[0].optionIds).toBeNull()
    expect([...withheldClaimsFor(withholds, 'an-option-outside-the-licence')]).toEqual(['goal_probability', 'joint_probability'])
    expect(readGoalIdentityWithheld(h)?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    expect(readGoalWithheldReasonFor(h, 'an-option-outside-the-licence')).toBe(
      GOAL_IDENTITY_WITHHELD_FALLBACK.slice('Not shown.'.length).trim(),
    )
  })

  it('keeps the synthesized fallback alone when another scoped reason applies', () => {
    const h = holder(READING, [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', option_ids: ['a'], node_ids: ['mrr'],
      message: 'Not shown. The target cannot be tested yet.', per_option: { a: { message: 'Not shown. Size this link.' } } }])
    expect(readGoalFigureWithholds(h)).toHaveLength(2)
    expect(readGoalIdentityWithheld(h)).toEqual({ nodeIds: ['mrr'], message: GOAL_IDENTITY_WITHHELD_FALLBACK })
    expect(readGoalWithheldReasonFor(h, 'a')).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK.slice('Not shown.'.length).trim())
  })

  it('a scoped typed reading warning never narrows the full reading-label withhold', () => {
    const code = { code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['a'],
      withheld_claims: ['goal_probability', 'joint_probability'], message: 'Not shown. Confirm the goal reading.' }
    const unlabelled = { inference_warnings: [code] }
    expect(readGoalFigureWithholds(unlabelled)).toHaveLength(1)
    expect(withheldClaimsFor(readGoalFigureWithholds(unlabelled), 'b').size).toBe(0)
    for (const reading of [READING, null]) {
      const h = holder(reading, [code])
      const withholds = readGoalFigureWithholds(h)
      expect(withholds).toHaveLength(2)
      for (const optionId of ['a', 'b']) {
        expect([...withheldClaimsFor(withholds, optionId)]).toEqual(['goal_probability', 'joint_probability'])
      }
      expect(readGoalIdentityWithheld(h)?.message).toBe(code.message)
      expect(readGoalWithheldReasonFor(h, 'a')).toBe('Confirm the goal reading.')
      expect(readGoalWithheldReasonFor(h, 'b')).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK.slice('Not shown.'.length).trim())
    }
  })

  it('keeps percentages out of the labelled headline and suppresses numeric driver sentences', () => {
    const licence = read(READING)!
    const [a, b] = licence.optionIds
    const withDrivers = { ...licence, driverByOption: {
      [a]: { kind: 'factor_value', factorId: 'price', side: 'low', cutValue: 20, cutUnit: '£', pctIfSide: 30, authoredBy: 'user' },
      [b]: { kind: 'link_strength', from: 'price', to: 'mrr', strength: 'weaker', authoredBy: 'user', userStatedLink: true },
    } } as const
    const names = { labelOf: (id: string) => id === 'mrr' ? 'MRR' : 'Price', unitOf: () => '£' }
    expect(goalChanceHeadline(licence, () => 'Option')).not.toMatch(/\d+%/)
    const drivers = goalChanceDriverLines(withDrivers, names)
    expect(drivers[a]).toBeUndefined()
    expect(drivers[b]).toContain('It rests most on')
    expect(Object.values(drivers).join(' ')).not.toMatch(/\d+%/)
    const { readingLabel: _reading, ...plain } = withDrivers
    expect(goalChanceDriverLines(plain, names)[a]).toContain('about 30%')
  })

  it('CONTROL: the served plain licence stays unlabelled and preserves its exact first figure line', () => {
    const licence = readGoalChanceLicence([LICENSED])!
    expect(Object.prototype.hasOwnProperty.call(licence, 'readingLabel')).toBe(false)
    expect(goalChanceOptionLines(licence, () => 'Option')?.[0]).toBe('‘Option’: about 46% chance of meeting your goal, in this model.')
  })
})
