/**
 * G4/G5 phase 2, P3 — what an option's goal chance rests on most (design-g4g6 Q6; DL rulings 6 Oct 2026).
 *
 * CEE decides the claim (`driver_by_option` on the `GOAL_CHANCE_LICENSED` record: which row, the side where the chance
 * FALLS, whose assumption it is). The UI reads it by shape and words it. These rows pin, from the wire record:
 *   1  the exact sentence for each ruled case (A to E);
 *   2  nothing is said where the rulings give no words, or a label or the cut cannot be said;
 *   3  a claim that is not the ruled shape, or sits on a withheld or unknown option, is not read;
 *   4  the sentence follows its OWN option's line and no other.
 *
 * The wire records follow CEE's own shape (CEE `goal-chance-driver.ts`, `GoalChanceDriver`).
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence, type GoalChanceLicence } from '../../utils/goalChanceLicence'
import { goalChanceDriverLines, goalChanceOptionLines } from '../goalChanceCopy'

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

const LABELS: Readonly<Record<string, string>> = { churn: 'Monthly churn', price: 'Price', support: 'Support hours' }
const UNITS: Readonly<Record<string, string>> = { churn: '%', price: '£' }
const NAMES = {
  labelOf: (id: string) => LABELS[id] ?? null,
  unitOf: (id: string) => UNITS[id] ?? null,
}
const OPTION_LABELS: Readonly<Record<string, string>> = { raise: 'Raise to £59', hold: 'Keep £49', trial: 'Longer trial' }
const optionLabelOf = (id: string) => OPTION_LABELS[id] ?? null

// CEE's claim shapes, one per kind.
const FACTOR = { quantity_id: 'churn', kind: 'factor_value', factor_id: 'churn', side: 'high', cut_value: 4.1, cut_unit: '%', pct_if_side: 40, pct_if_side_rounding: 'whole', authored_by: 'user' }
const STRENGTH = { quantity_id: 'price->churn', kind: 'link_strength', from: 'price', to: 'churn', side: 'low', strength: 'weaker', authored_by: 'olumi', user_stated_link: false }
const EXISTENCE = { quantity_id: 'price->churn', kind: 'link_existence', from: 'price', to: 'churn', side: 'absent', pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false }

const lineFor = (claim: Record<string, unknown>, names = NAMES): string | undefined =>
  goalChanceDriverLines(read({ driver_by_option: { raise: claim } }), names).raise

describe('the driver sentence: one exact sentence per ruled case', () => {
  it('A. a factor on the user’s own value and range', () => {
    expect(lineFor(FACTOR)).toBe('It rests most on ‘Monthly churn’: if it is above 4.1%, the chance falls to about 40%.')
  })

  it('A. the side is CEE’s: a chance that falls on the low side says "below", in the factor’s own unit', () => {
    expect(lineFor({ ...FACTOR, quantity_id: 'price', factor_id: 'price', side: 'low', cut_value: 48, cut_unit: '£', pct_if_side: 35 }))
      .toBe('It rests most on ‘Price’: if it is below £48, the chance falls to about 35%.')
  })

  it('A. the cut’s unit is the one CEE carried with it; the canvas unit is only the fallback', () => {
    const price = { ...FACTOR, quantity_id: 'price', factor_id: 'price', side: 'low', cut_value: 48, cut_unit: '£', pct_if_side: 35 }
    // The canvas says the price is a percentage here; the claim's own unit wins.
    const canvasDisagrees = { ...NAMES, unitOf: () => '%' }
    expect(lineFor(price, canvasDisagrees)).toBe('It rests most on ‘Price’: if it is below £48, the chance falls to about 35%.')
    // A claim with no unit of its own takes the canvas node's.
    expect(lineFor({ ...price, cut_unit: undefined }, canvasDisagrees))
      .toBe('It rests most on ‘Price’: if it is below 48%, the chance falls to about 35%.')
  })

  it('A. a factor CEE could not attribute claims no author', () => {
    expect(lineFor({ ...FACTOR, authored_by: 'unattributed' }))
      .toBe('It rests most on ‘Monthly churn’: if it is above 4.1%, the chance falls to about 40%.')
  })

  it('B. a factor on a range Olumi assumed says so and asks', () => {
    expect(lineFor({ ...FACTOR, authored_by: 'olumi' }))
      .toBe('It rests most on ‘Monthly churn’, using a range Olumi assumed: if it is above 4.1%, the chance falls to about 40%. Do you know it more precisely?')
  })

  it('C. the strength of a link Olumi sized: no figure, weaker or stronger as CEE says', () => {
    expect(lineFor(STRENGTH))
      .toBe('It rests most on Olumi’s own estimate of how strongly ‘Price’ affects ‘Monthly churn’: if that effect is weaker than Olumi assumed, the chance falls. Is that estimate right?')
    expect(lineFor({ ...STRENGTH, side: 'high', strength: 'stronger' }))
      .toBe('It rests most on Olumi’s own estimate of how strongly ‘Price’ affects ‘Monthly churn’: if that effect is stronger than Olumi assumed, the chance falls. Is that estimate right?')
  })

  // U and N (DL ruling 6 Oct): the direction word is the record's own `strength`, on either side.
  it.each(['weaker', 'stronger'] as const)('U. the strength of a link the user sized, %s: the size is theirs, and Olumi asks how sure', (strength) => {
    expect(lineFor({ ...STRENGTH, strength, authored_by: 'user', user_stated_link: true }))
      .toBe(`It rests most on how strongly ‘Price’ affects ‘Monthly churn’, at the size you set: if that effect is ${strength} than that, the chance falls. How sure are you of that size?`)
  })

  it.each(['weaker', 'stronger'] as const)('N. the strength of a link CEE could not attribute, %s: no author, no question', (strength) => {
    expect(lineFor({ ...STRENGTH, strength, authored_by: 'unattributed' }))
      .toBe(`It rests most on how strongly ‘Price’ affects ‘Monthly churn’: if that effect is ${strength} than this model assumes, the chance falls.`)
  })

  it('U / N. the direction word follows `strength`, never `side`', () => {
    // A negative link: the chance falls on the HIGH draws, which CEE words as "weaker".
    expect(lineFor({ ...STRENGTH, side: 'high', strength: 'weaker', authored_by: 'user', user_stated_link: true })).toContain('is weaker than that')
    expect(lineFor({ ...STRENGTH, side: 'low', strength: 'stronger', authored_by: 'unattributed' })).toContain('is stronger than this model assumes')
  })

  it('D. whether a link Olumi assumed holds at all', () => {
    expect(lineFor(EXISTENCE))
      .toBe('It rests most on Olumi’s own assumption that ‘Price’ affects ‘Monthly churn’: in the model runs without that link, the chance is about 30%. Is that right?')
  })

  it('E. the user’s own link, with Olumi’s doubt that it holds', () => {
    expect(lineFor({ ...EXISTENCE, user_stated_link: true }))
      .toBe('It rests most on your link from ‘Price’ to ‘Monthly churn’: Olumi’s model also allows that it does not hold, and in those runs the chance is about 30%.')
  })

  it('a chance that displays as 0 is "less than 1%", never "about 0%"', () => {
    expect(lineFor({ ...FACTOR, pct_if_side: 0 })).toBe('It rests most on ‘Monthly churn’: if it is above 4.1%, the chance falls to less than 1%.')
  })
})

describe('the driver sentence: nothing is said where there are no ruled words', () => {
  it.each([
    ['an existence driver whose falling side is the runs WITH the link', { ...EXISTENCE, side: 'present' }],
    ['an existence driver with no author', { ...EXISTENCE, authored_by: 'unattributed' }],
    ['an existence driver on a link the user holds', { ...EXISTENCE, authored_by: 'user', user_stated_link: true }],
  ])('%s', (_name, claim) => {
    // The claim itself is read (it is CEE's shape); only the words are withheld.
    expect(read({ driver_by_option: { raise: claim } }).driverByOption).toHaveProperty('raise')
    expect(lineFor(claim)).toBeUndefined()
  })

  it('a factor or link end this model has no label for', () => {
    expect(lineFor({ ...FACTOR, quantity_id: 'gone', factor_id: 'gone' })).toBeUndefined()
    expect(lineFor({ ...EXISTENCE, from: 'gone' })).toBeUndefined()
    expect(lineFor({ ...STRENGTH, to: 'gone' })).toBeUndefined()
    // Control: the same claims with their labels are said.
    expect(lineFor(FACTOR)).toBeDefined()
    expect(lineFor(EXISTENCE)).toBeDefined()
    expect(lineFor(STRENGTH)).toBeDefined()
  })

  it('CEE’s "no driver" for an option is silence', () => {
    const licence = read({ driver_by_option: { raise: FACTOR }, no_driver_by_option: { hold: 'below_resolution', trial: 'correlated' } })
    expect(Object.keys(goalChanceDriverLines(licence, NAMES))).toEqual(['raise'])
  })

  it('no licence, or a licence with no claims, gives no sentences', () => {
    expect(goalChanceDriverLines(null, NAMES)).toEqual({})
    expect(goalChanceDriverLines(read({}), NAMES)).toEqual({})
  })
})

describe('U: "How sure are you of that size?" is asked once per link the user sized', () => {
  const QUESTION = 'How sure are you of that size?'
  const USER_STRENGTH = { ...STRENGTH, authored_by: 'user', user_stated_link: true }
  const asks = (line: string | undefined) => line?.endsWith(QUESTION) === true
  const count = (lines: Readonly<Record<string, string>>) => Object.values(lines).join(' ').split(QUESTION).length - 1

  it('two options resting on the SAME link: the first shown asks, the second says the sentence without asking', () => {
    const lines = goalChanceDriverLines(read({ driver_by_option: { hold: USER_STRENGTH, raise: USER_STRENGTH } }), NAMES)
    expect(lines.raise).toBe('It rests most on how strongly ‘Price’ affects ‘Monthly churn’, at the size you set: if that effect is weaker than that, the chance falls. How sure are you of that size?')
    expect(lines.hold).toBe('It rests most on how strongly ‘Price’ affects ‘Monthly churn’, at the size you set: if that effect is weaker than that, the chance falls.')
    expect(count(lines)).toBe(1)
  })

  it('the same link in OPPOSITE directions is still one link: asked once', () => {
    const lines = goalChanceDriverLines(read({ driver_by_option: { raise: USER_STRENGTH, trial: { ...USER_STRENGTH, side: 'high', strength: 'stronger' } } }), NAMES)
    expect(asks(lines.raise)).toBe(true)
    expect(lines.trial).toBe('It rests most on how strongly ‘Price’ affects ‘Monthly churn’, at the size you set: if that effect is stronger than that, the chance falls.')
    expect(count(lines)).toBe(1)
  })

  it('CONTROL: two options resting on DIFFERENT links each ask about their own', () => {
    const other = { ...USER_STRENGTH, quantity_id: 'support->churn', from: 'support' }
    const lines = goalChanceDriverLines(read({ driver_by_option: { raise: USER_STRENGTH, hold: other } }), NAMES)
    expect(asks(lines.raise)).toBe(true)
    expect(asks(lines.hold)).toBe(true)
    expect(count(lines)).toBe(2)
  })

  it('an option with no line of its own does not use up the question: the first option SHOWN asks', () => {
    const licence = read({ driver_by_option: { raise: USER_STRENGTH, hold: USER_STRENGTH } })
    const lines = goalChanceDriverLines(licence, NAMES, ['raise'])
    expect(Object.keys(lines)).toEqual(['hold'])
    expect(asks(lines.hold)).toBe(true)
  })

  it('an option whose sentence cannot be said does not use up the question either', () => {
    const unlabelled = { ...USER_STRENGTH, to: 'gone' }
    const lines = goalChanceDriverLines(read({ driver_by_option: { raise: unlabelled, hold: USER_STRENGTH } }), NAMES)
    expect(Object.keys(lines)).toEqual(['hold'])
    expect(asks(lines.hold)).toBe(true)
  })

  it('the other questions are untouched: two options on one Olumi-sized link each keep theirs', () => {
    const lines = goalChanceDriverLines(read({ driver_by_option: { raise: STRENGTH, hold: STRENGTH } }), NAMES)
    expect(lines.raise).toBe(lines.hold)
    expect(lines.hold?.endsWith('Is that estimate right?')).toBe(true)
  })
})

describe('U / N: a label is the user’s own words, verbatim and inside quotes; Olumi’s words frame no contest', () => {
  // The DL's three (best / winner / ahead) and the canvas guard's own (`noContestFraming`: leader, beats).
  const CONTEST = /\b(best|winners?|ahead|leader|beats?)\b/i
  const LOADED_LABELS: Readonly<Record<string, string>> = { price: 'Best price ahead', churn: 'Winner beats the leader' }
  const LOADED = { ...NAMES, labelOf: (id: string) => LOADED_LABELS[id] ?? null }
  /** Everything Olumi wrote: the sentence with each quoted label removed. */
  const olumisWords = (line: string) => line.replace(/‘[^’]*’/g, '‘’')

  it.each([
    ['U, weaker', { ...STRENGTH, authored_by: 'user', user_stated_link: true }],
    ['U, stronger', { ...STRENGTH, side: 'high', strength: 'stronger', authored_by: 'user', user_stated_link: true }],
    ['N, weaker', { ...STRENGTH, authored_by: 'unattributed' }],
    ['N, stronger', { ...STRENGTH, side: 'high', strength: 'stronger', authored_by: 'unattributed' }],
  ])('%s', (_name, claim) => {
    const line = lineFor(claim, LOADED) as string
    // Verbatim, and fenced.
    expect(line).toContain('how strongly ‘Best price ahead’ affects ‘Winner beats the leader’')
    // Outside the quotes there is no contest word …
    expect(olumisWords(line)).not.toMatch(CONTEST)
    // … MUST FIRE: the same check on the same sentence with its labels unfenced, so it can fail.
    expect(olumisWords(line.replace(/[‘’]/g, ''))).toMatch(CONTEST)
  })
})

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

describe('the sentence follows its own option’s line', () => {
  const sentence = 'It rests most on ‘Monthly churn’: if it is above 4.1%, the chance falls to about 40%.'

  it('is appended to the option CEE made the claim for, and to no other', () => {
    const licence = read({ driver_by_option: { hold: FACTOR } })
    expect(goalChanceOptionLines(licence, optionLabelOf, [], goalChanceDriverLines(licence, NAMES))).toEqual([
      '‘Raise to £59’: about 62% chance of meeting your goal, in this model.',
      `‘Keep £49’: about 41% chance of meeting your goal, in this model. ${sentence}`,
      '‘Longer trial’: about 20% chance of meeting your goal, in this model.',
    ])
  })

  it('CONTROL: with no sentences the lines are exactly what they were', () => {
    const licence = read({ driver_by_option: { hold: FACTOR } })
    expect(goalChanceOptionLines(licence, optionLabelOf)).toEqual([
      '‘Raise to £59’: about 62% chance of meeting your goal, in this model.',
      '‘Keep £49’: about 41% chance of meeting your goal, in this model.',
      '‘Longer trial’: about 20% chance of meeting your goal, in this model.',
    ])
  })

  it('a withheld option keeps its withheld line and never takes a sentence', () => {
    const licence = read({ pct_by_option: { raise: 62, hold: 41 }, withheld_option_ids: ['trial'] })
    const lines = goalChanceOptionLines(licence, optionLabelOf, [], { trial: sentence, raise: sentence })
    expect(lines?.[0]).toBe(`‘Raise to £59’: about 62% chance of meeting your goal, in this model. ${sentence}`)
    expect(lines?.[2]).toBe('‘Longer trial’: Olumi can’t yet say its chance of meeting your goal, in this model.')
  })
})
