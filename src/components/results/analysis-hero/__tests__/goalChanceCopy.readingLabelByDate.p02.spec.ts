import { describe, expect, it } from 'vitest'
import served from './fixtures/served-t1b-f440be4a-goal-chance-records.json'
import { goalChanceOptionLines } from '../goalChanceCopy'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'

const LICENSED = served.inference_warnings.find((warning) => warning.code === 'GOAL_CHANCE_LICENSED')!
const READING = {
  v: 1, source: 'olumi_reading', goal: { id: 'progress', label: 'Progress' },
  factors: [{ id: 'capacity', label: 'Team capacity' }, { id: 'pace', label: 'Delivery pace' }],
  addends: [{ id: 'rework', label: 'Rework', sign: 'less' }],
}

describe('F: a reading-labelled share-by-date chance uses the ruled goal sentence', () => {
  it.each([
    ['the feature launch', 'chance of launching by 7 April 2027'],
    ['the security review', 'chance of finishing the security review by 7 April 2027'],
  ])('%s: labelled words and the byte-identical plain control', (deliverable, plainWords) => {
    const record = {
      ...LICENSED,
      target: { comparator: 'at_least', value: 100, unit: `% of ${deliverable}`, by_date: '2027-04-07' },
    }
    const labelled = readGoalChanceLicence([{ ...record, reading_label: READING }])!
    expect(goalChanceOptionLines(labelled, () => 'Option')?.[0]).toBe(
      '‘Option’: about 46% chance of meeting your goal, in this model, if ‘Progress’ = ‘Team capacity’ × ‘Delivery pace’, less ‘Rework’ (Olumi’s reading).',
    )
    const plain = readGoalChanceLicence([record])!
    expect(goalChanceOptionLines(plain, () => 'Option')?.[0]).toBe(`‘Option’: about 46% ${plainWords}, in this model.`)
  })
})
