/**
 * Science 393023 (1), CEE #2775 — the spread-driven chance note on the card. CEE decides where it applies
 * (`spread_note_by_option` on the `GOAL_CHANCE_LICENSED` record); the UI reads it by shape and words it after that
 * option's chance, before its driver. Rows: exact line on the named option only; nothing on other forms, withheld or
 * unknown ids, or unknown text; one malformed entry silences the Run.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { GOAL_CHANCE_SPREAD_NOTE, goalChanceOptionLines } from '../goalChanceCopy'

const WITH = 'Its typical result falls short of your target: this chance comes from its wider spread, which also widens how far short it could fall (see its downside).'
const WITHOUT = 'Its typical result falls short of your target: this chance comes from its wider spread, which also means it could fall further short.'
const TARGET = { comparator: 'at_least', value: 120000, unit: '£' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['raise', 'hold', 'trial'], pct_by_option: { raise: 62, hold: 41, trial: 20 }, target: TARGET, ...extra,
}]
const LABELS: Readonly<Record<string, string>> = { raise: 'Raise to £59', hold: 'Keep £49', trial: 'Longer trial' }
const linesOf = (extra: Record<string, unknown>): string[] => {
  const licence = readGoalChanceLicence(wire(extra))
  expect(licence, 'the record itself is well formed').not.toBeNull()
  return goalChanceOptionLines(licence!, (id) => LABELS[id] ?? null) ?? []
}
const noted = (lines: string[]) => lines.filter((l) => l.includes(GOAL_CHANCE_SPREAD_NOTE))

describe('spread note: CEE decides, the card words it after the chance', () => {
  it('the card words it without "see its downside" (no downside is guaranteed beside the line)', () => {
    expect(GOAL_CHANCE_SPREAD_NOTE).toBe(WITHOUT)
  })
  it('on the named option only, right after its chance', () => {
    const lines = linesOf({ spread_note_by_option: { raise: WITH } })
    expect(lines[0]).toBe(`‘Raise to £59’: about 62% chance of meeting your goal, in this model. ${WITHOUT}`)
    expect(noted(lines)).toHaveLength(1)
    // control: the same Run without the record says no note anywhere
    expect(noted(linesOf({}))).toHaveLength(0)
  })
  it('it precedes the driver sentence', () => {
    const licence = readGoalChanceLicence(wire({ spread_note_by_option: { hold: WITHOUT } }))!
    const lines = goalChanceOptionLines(licence, (id) => LABELS[id] ?? null, [], { hold: 'DRIVER.' })!
    expect(lines[1].endsWith(`${WITHOUT} DRIVER.`)).toBe(true)
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
    expect(licence!.spreadNoteOptionIds ?? []).toEqual([])
    expect(noted(goalChanceOptionLines(licence!, (id) => LABELS[id] ?? null) ?? [])).toHaveLength(0)
  })
  it('a withheld option never carries it', () => {
    const licence = readGoalChanceLicence(wire({
      withheld_option_ids: ['trial'], pct_by_option: { raise: 62, hold: 41 }, spread_note_by_option: { trial: WITH },
    }))
    expect(licence).not.toBeNull()
    expect(licence!.spreadNoteOptionIds ?? []).toEqual([])
  })
})
