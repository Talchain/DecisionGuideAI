/**
 * Science 393023 B19, CEE #2787 — the goal-relative shortfall sentence. CEE decides and words it
 * (`shortfall_note_by_option` on the `GOAL_CHANCE_LICENSED` record); the licence reader keeps it only in CEE's templates.
 *
 * #2747 re-scope 2 round 2: rows deleted with `goalChanceOptionLines` (the UI's per-option chance lines, which said this
 * sentence after "chance of meeting your goal"; it lost its last production caller in round 1): "on the named options
 * only, after the chance…", "it follows the spread note and precedes the driver", "a sentence naming another label is not
 * said on this option". The reader rows stay, with a positive control.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'

// T1b known answers, byte for byte as CEE #2787 asserts them.
const RAISE = 'In its worst 1 in 20 runs of this model, ‘Raise prices 10%’ falls short of your target by £15,000 / month or more.'
const KEEP = 'In this model, ‘Keep pricing as is’ falls short of your target in almost every run, typically by about £6,000 / month.'
const TARGET = { comparator: 'at_least', value: 126000, unit: '£/month' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['raise', 'keep', 'starter'], pct_by_option: { raise: 47, keep: 0, starter: 99 }, target: TARGET, ...extra,
}]
describe('B19 shortfall: CEE words it, the reader keeps it only in CEE\'s templates', () => {
  it('CONTROL: the reader carries each named option\'s sentence verbatim', () => {
    expect(readGoalChanceLicence(wire({ shortfall_note_by_option: { raise: RAISE, keep: KEEP } }))!.shortfallNoteByOption)
      .toEqual({ raise: RAISE, keep: KEEP })
  })
  it.each([
    ['another form', { form: 'similar', similar_option_ids: ['raise', 'keep'], shortfall_note_by_option: { raise: RAISE } }],
    ['an unknown option id', { shortfall_note_by_option: { ghost: RAISE } }],
    ['text that is not one of CEE’s two templates', { shortfall_note_by_option: { raise: 'Raise could lose £15,000.' } }],
    ['a template with a different frequency', { shortfall_note_by_option: { raise: RAISE.replace('1 in 20', '1 in 10') } }],
    ['one malformed entry beside a good one', { shortfall_note_by_option: { raise: RAISE, keep: 42 } }],
    ['an empty record', { shortfall_note_by_option: {} }],
  ])('nothing for %s', (_why, extra) => {
    const licence = readGoalChanceLicence(wire(extra as Record<string, unknown>))
    expect(licence).not.toBeNull()
    expect(licence!.shortfallNoteByOption ?? {}).toEqual({})
  })
  it('a withheld option never carries it', () => {
    const licence = readGoalChanceLicence(wire({
      withheld_option_ids: ['raise'], pct_by_option: { keep: 0, starter: 99 }, shortfall_note_by_option: { raise: RAISE },
    }))
    expect(licence).not.toBeNull()
    expect(licence!.shortfallNoteByOption ?? {}).toEqual({})
  })
})
