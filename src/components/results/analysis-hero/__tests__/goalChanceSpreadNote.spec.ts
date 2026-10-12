/**
 * Science 393023 (1), CEE #2775 — the spread-driven chance note. CEE decides where it applies (`spread_note_by_option` on
 * the `GOAL_CHANCE_LICENSED` record); the licence reader reads it by shape. Rows: the reader carries it for the named
 * option only; nothing on other forms, withheld or unknown ids, or unknown text; one malformed entry silences the Run.
 *
 * #2747 re-scope 2 round 2: rows deleted with `goalChanceOptionLines` (the UI's per-option chance lines, which worded
 * this note after "chance of meeting your goal"; it lost its last production caller in round 1): "the card words it
 * without \"see its downside\"…", "on the named option only, right after its chance", "it precedes the driver sentence".
 * The reader rows stay, with a positive control.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'

const WITH = 'Its typical result falls short of your target: this chance comes from its wider spread, which also widens how far short it could fall (see its downside).'
const TARGET = { comparator: 'at_least', value: 120000, unit: '£' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['raise', 'hold', 'trial'], pct_by_option: { raise: 62, hold: 41, trial: 20 }, target: TARGET, ...extra,
}]

describe('spread note: CEE decides, the reader reads it by shape', () => {
  it('CONTROL: the reader carries CEE\'s sentence verbatim for the named option', () => {
    expect(readGoalChanceLicence(wire({ spread_note_by_option: { raise: WITH } }))!.spreadNoteByOption).toEqual({ raise: WITH })
  })
  it.each([
    ['another form', { form: 'similar', similar_option_ids: ['raise', 'hold'], spread_note_by_option: { raise: WITH } }],
    ['an unknown option id', { spread_note_by_option: { ghost: WITH } }],
    ['text that is not one of CEE’s two sentences', { spread_note_by_option: { raise: 'Its spread is wide.' } }],
    ['one malformed entry beside a good one', { spread_note_by_option: { raise: WITH, hold: 42 } }],
    ['an empty record', { spread_note_by_option: {} }],
  ])('nothing for %s', (_why, extra) => {
    const licence = readGoalChanceLicence(wire(extra as Record<string, unknown>))
    expect(licence).not.toBeNull()
    expect(licence!.spreadNoteByOption ?? {}).toEqual({})
  })
  it('a withheld option never carries it', () => {
    const licence = readGoalChanceLicence(wire({
      withheld_option_ids: ['trial'], pct_by_option: { raise: 62, hold: 41 }, spread_note_by_option: { trial: WITH },
    }))
    expect(licence).not.toBeNull()
    expect(licence!.spreadNoteByOption ?? {}).toEqual({})
  })
})
