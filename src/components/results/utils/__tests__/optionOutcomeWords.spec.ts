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

  it('a single ranged option (CEE message \'\') still says its sentence', () => {
    const w = readOptionOutcomeWords([{ code: 'OPTION_OUTCOME_WORDS', message: '', options: [RECORD.options[0]] }])!
    expect(optionOutcomeReading(w)).toBe(RECORD.options[0].words)
  })

  it.each([
    ['no record', [{ code: 'GOAL_CHANCE_LICENSED' }]],
    ['not an array', { code: 'OPTION_OUTCOME_WORDS' }],
    ['options not an array', [{ ...RECORD, options: 'x' }]],
    ['message not a string', [{ ...RECORD, message: 3 }]],
    ['message missing', [{ code: 'OPTION_OUTCOME_WORDS', options: RECORD.options }]],
    ['nothing to say', [{ ...RECORD, options: [], message: '' }]],
    // ⛔ MALFORMED READS AS NONE, WHOLE (Codex #2889 r1): one bad entry withholds every sentence, the separation included.
    ['one entry with a numeric id', [{ ...RECORD, options: [RECORD.options[0], { option_id: 2, words: 'x' }] }]],
    ['one entry with a blank id', [{ ...RECORD, options: [RECORD.options[0], { option_id: ' ', words: 'x' }] }]],
    ['one entry with blank words', [{ ...RECORD, options: [RECORD.options[0], { option_id: 'c', words: ' ' }] }]],
    ['every entry invalid', [{ ...RECORD, options: [null, 'x'] }]],
  ])('%s → none', (_, warnings) => {
    expect(readOptionOutcomeWords(warnings)).toBeNull()
    expect(optionOutcomeReading(readOptionOutcomeWords(warnings))).toBeNull()
  })
})
