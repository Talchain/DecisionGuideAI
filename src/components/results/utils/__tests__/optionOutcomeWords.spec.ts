/**
 * CEE's OPTION_OUTCOME_WORDS record, read verbatim (Paul 21 Oct: no win share). The UI composes none of these words.
 */
import { describe, expect, it } from 'vitest'
import { optionOutcomeReading, readOptionOutcomeWords } from '../optionOutcomeWords'

const RECORD = {
  code: 'OPTION_OUTCOME_WORDS', severity: 'info', message: 'Their likely ranges clearly separate.', separation: 'separate',
  options: [
    { option_id: 'option_a', words: 'With the data provided, Option A most likely gives about 170 orders a week (likely 140–200 orders a week).' },
    { option_id: 'option_b', words: 'With the data provided, Option B most likely gives about 140 orders a week (likely 130–150 orders a week).' },
  ],
}

describe('readOptionOutcomeWords', () => {
  it('reads each option\'s words by its id, then the separation sentence once', () => {
    const w = readOptionOutcomeWords([{ code: 'GOAL_CHANCE_LICENSED' }, RECORD])!
    expect(w.options.map((o) => o.optionId)).toEqual(['option_a', 'option_b'])
    expect(optionOutcomeReading(w)).toBe(`${RECORD.options[0].words} ${RECORD.options[1].words} Their likely ranges clearly separate.`)
  })

  it('a normalised Run (no option sentence) still says whether the ranges separate', () => {
    expect(optionOutcomeReading(readOptionOutcomeWords([{ ...RECORD, options: [] }]))).toBe('Their likely ranges clearly separate.')
  })

  it.each([
    ['no record', [{ code: 'GOAL_CHANCE_LICENSED' }]],
    ['not an array', { code: 'OPTION_OUTCOME_WORDS' }],
    ['options not an array', [{ ...RECORD, options: 'x' }]],
    ['message not a string', [{ ...RECORD, message: 3 }]],
    ['nothing to say', [{ ...RECORD, options: [], message: '' }]],
  ])('%s → none', (_, warnings) => {
    expect(readOptionOutcomeWords(warnings)).toBeNull()
    expect(optionOutcomeReading(readOptionOutcomeWords(warnings))).toBeNull()
  })

  it('a malformed option entry is dropped alone (contrast: the well-formed one stays)', () => {
    const w = readOptionOutcomeWords([{ ...RECORD, options: [RECORD.options[0], { option_id: 2, words: 'x' }, { option_id: 'c', words: ' ' }] }])!
    expect(w.options).toEqual([{ optionId: 'option_a', words: RECORD.options[0].words }])
  })
})
