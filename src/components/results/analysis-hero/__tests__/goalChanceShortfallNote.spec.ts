/**
 * Science 393023 B19, CEE #2787 — the goal-relative shortfall sentence on the card. CEE decides and words it
 * (`shortfall_note_by_option` on the `GOAL_CHANCE_LICENSED` record); the card says it verbatim after that option's chance
 * and spread note, before its driver, only when the sentence names that option's label. It never formats a figure.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { GOAL_CHANCE_SPREAD_NOTE, goalChanceOptionLines } from '../goalChanceCopy'

// T1b known answers, byte for byte as CEE #2787 asserts them.
const RAISE = 'In its worst 1 in 20 runs of this model, ‘Raise prices 10%’ falls short of your target by £15,000 / month or more.'
const KEEP = 'In this model, ‘Keep pricing as is’ falls short of your target in almost every run, typically by about £6,000 / month.'
const TARGET = { comparator: 'at_least', value: 126000, unit: '£/month' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['raise', 'keep', 'starter'], pct_by_option: { raise: 47, keep: 0, starter: 99 }, target: TARGET, ...extra,
}]
const LABELS: Readonly<Record<string, string>> = { raise: 'Raise prices 10%', keep: 'Keep pricing as is', starter: 'Launch starter tier' }
const linesOf = (extra: Record<string, unknown>, labels = LABELS): string[] => {
  const licence = readGoalChanceLicence(wire(extra))
  expect(licence, 'the record itself is well formed').not.toBeNull()
  return goalChanceOptionLines(licence!, (id) => labels[id] ?? null) ?? []
}
const said = (lines: string[]) => lines.filter((l) => l.includes(RAISE) || l.includes(KEEP))

describe('B19 shortfall: CEE words it, the card says it verbatim after the chance', () => {
  it('on the named options only, after the chance; Starter (no entry) has none', () => {
    const lines = linesOf({ shortfall_note_by_option: { raise: RAISE, keep: KEEP } })
    expect(lines[0]).toBe(`‘Raise prices 10%’: about 47% chance of meeting your goal, in this model. ${RAISE}`)
    expect(lines[1].endsWith(` ${KEEP}`)).toBe(true)
    expect(said([lines[2]])).toHaveLength(0)
    // control: the same Run without the record says no shortfall anywhere
    expect(said(linesOf({}))).toHaveLength(0)
  })
  it('it follows the spread note and precedes the driver', () => {
    const licence = readGoalChanceLicence(wire({ spread_note_by_option: { raise: GOAL_CHANCE_SPREAD_NOTE }, shortfall_note_by_option: { raise: RAISE } }))!
    const lines = goalChanceOptionLines(licence, (id) => LABELS[id] ?? null, [], { raise: 'DRIVER.' })!
    expect(lines[0].endsWith(`. ${GOAL_CHANCE_SPREAD_NOTE} ${RAISE} DRIVER.`)).toBe(true)
  })
  it('a sentence naming another label is not said on this option (identity, not position)', () => {
    expect(said(linesOf({ shortfall_note_by_option: { raise: RAISE } }, { ...LABELS, raise: 'Raise prices 12%' }))).toHaveLength(0)
    expect(said(linesOf({ shortfall_note_by_option: { raise: RAISE } })), 'control: the matching label').toHaveLength(1)
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
    expect(said(goalChanceOptionLines(licence!, (id) => LABELS[id] ?? null) ?? [])).toHaveLength(0)
  })
  it('a withheld option never carries it', () => {
    const licence = readGoalChanceLicence(wire({
      withheld_option_ids: ['raise'], pct_by_option: { keep: 0, starter: 99 }, shortfall_note_by_option: { raise: RAISE },
    }))
    expect(licence).not.toBeNull()
    expect(licence!.shortfallNoteByOption ?? {}).toEqual({})
  })
})
