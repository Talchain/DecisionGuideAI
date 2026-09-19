/**
 * ⭐⭐ THE ONLY THING THAT CAN CATCH A SHORT LIST IS A CORPUS FROM OUTSIDE IT.
 *
 * `GENERIC_PLACEHOLDER_UNITS` is consumed by every value formatter, and each of
 * those consumers is DERIVED from it — so they can never drift from the list,
 * and they can never notice the list is missing a member. That is CLAUDE.md
 * trap 12d stated exactly: *"deriving a guard from a list MOVES the risk, it
 * does not remove it. The list itself then needs a completeness check that is
 * NOT derived from it."*
 *
 * It is not hypothetical here. `unit_interval` — the mathematical name for
 * [0,1], the purest placeholder there is — was absent for the whole life of the
 * set, and rendered on the founder's factor cards as `0.15 unit_interval est.`
 * while `0.3 scale` beside it was correctly suppressed. Every derived consumer
 * agreed with the list and every one of them was wrong together.
 *
 * ⛔ THE CORPUS IS MEASURED, NOT IMAGINED. Every unit below was counted across
 * nine of the founder's debug bundles from 19 Sep 2026 — real CEE output, with
 * its real frequency recorded. A corpus from the author's head cannot see the
 * class the author did not imagine (trap 22), which is the class that bit.
 *
 * ⚠ BOTH DIRECTIONS ARE ASSERTED. A set that grows is as dangerous as one that
 * is short: adding `months` would blank a legitimate figure on every card that
 * carries one. The negative half is the guard against curing a short list by
 * over-reaching.
 */
import { describe, it, expect } from 'vitest'
import { classifyUnit, GENERIC_PLACEHOLDER_UNITS } from '../unitClassifier'
import { formatFactorDisplayValue } from '../formatFactorDisplayValue'

/**
 * Units that NAME A RANGE and say nothing about what is measured. Counts are
 * from the 19 Sep capture; a unit with no count is a spelling the same producer
 * could plausibly emit for the same idea.
 */
const PLACEHOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['scale', '204 occurrences — the original case'],
  ['unit_interval', '18 occurrences — MISSING until 19 Sep 2026; the defect this file exists for'],
  ['index', 'same family'],
  ['score', 'same family'],
  ['normalised', 'same family'],
  ['normalized', 'same family'],
  ['norm', 'same family'],
  ['unit', 'same family'],
  ['units', 'same family'],
]

/**
 * Units that NAME A QUANTITY. A reader knows what five of them is, so the
 * figure means something and must render.
 */
const REAL_UNITS: ReadonlyArray<readonly [string, string]> = [
  ['months', '52 occurrences'],
  ['senior engineers', '30 occurrences — a counted noun phrase'],
  ['active leads', '23 occurrences — a counted noun phrase'],
  ['%', '31 occurrences'],
  ['£', '54 occurrences'],
  ['$', '33 occurrences'],
  ['ratio', '27 occurrences — ⛔ a PROPORTION unit; its frame is an open producer question'],
  ['days', 'same family as months'],
  ['GBP', 'ISO code'],
  ['people', 'a counted noun'],
]

describe('the placeholder set against a corpus measured off the wire', () => {
  it.each(PLACEHOLDERS)('%s IS a placeholder — %s', (unit) => {
    expect(GENERIC_PLACEHOLDER_UNITS.has(unit), `${unit} is missing from the set`).toBe(true)
    expect(classifyUnit(unit).kind, `${unit} does not classify as a placeholder`).toBe('placeholder')
  })

  it.each(REAL_UNITS)('%s is NOT a placeholder — %s', (unit) => {
    expect(GENERIC_PLACEHOLDER_UNITS.has(unit), `${unit} was wrongly added to the set`).toBe(false)
    expect(classifyUnit(unit).kind, `${unit} wrongly classifies as a placeholder`).not.toBe('placeholder')
  })

  it('⭐ classification is case- and spacing-insensitive for the spellings we ship', () => {
    // A producer that sends `Unit_Interval` or `UNIT_INTERVAL` means the same
    // thing, and a set matched case-sensitively would miss it silently.
    for (const spelling of ['unit_interval', 'Unit_Interval', 'UNIT_INTERVAL', ' unit_interval ']) {
      expect(classifyUnit(spelling).kind, `${spelling} escaped classification`).toBe('placeholder')
    }
  })

  it('⛔ PRECONDITION: the corpus is not vacuous and covers both directions', () => {
    // A corpus that had quietly emptied would pass every assertion above.
    expect(PLACEHOLDERS.length).toBeGreaterThan(5)
    expect(REAL_UNITS.length).toBeGreaterThan(5)
    // And the two must genuinely disagree — if every entry classified the same
    // way, this file would be measuring nothing.
    const kinds = new Set([
      ...PLACEHOLDERS.map(([u]) => classifyUnit(u).kind),
      ...REAL_UNITS.map(([u]) => classifyUnit(u).kind),
    ])
    expect(kinds.size, 'every corpus entry classified identically — the probe is not discriminating').toBeGreaterThan(1)
  })
})

/**
 * ⭐⭐ THE FORMATTER PATH — the one the corpus above could not see.
 *
 * Independent review found that adding `unit_interval` to the placeholder set
 * fixed CLASSIFICATION and changed nothing on the card: the formatter's
 * `BARE_MAGNITUDE_SUMMARY` accepted only `[A-Za-z]+` as a suffix, so the
 * underscore made `"0.15 unit_interval"` fail to match and the producer's
 * string was forwarded verbatim. **The founder's card went on printing
 * `0.15 unit_interval est.` after the PR that claimed to stop it.**
 *
 * ⛔ THE CORPUS ABOVE SHARED THE FORMATTER'S BLIND SPOT. It asserted
 * `classifyUnit(...)` and never asked what the card renders — CLAUDE.md trap
 * 13d, in the very file written to guard against a short list. A corpus that
 * tests the wrong LAYER is as blind as one that omits a value.
 *
 * ⚠ WIDENING THE SHAPE MUST NOT WIDEN THE POLICY, which is the whole risk of
 * this delta: `"5 active leads"` and `"0.4 ratio"` now MATCH the pattern, and
 * both must still render untouched because `classifyUnit` — not the regex —
 * decides what is a placeholder. Both are pinned below with their measured
 * frequencies from the founder's boards.
 */
describe('the formatter path, not just the classifier', () => {
  it('⭐ the exact captured face: "0.15 unit_interval" renders its figure only', () => {
    expect(formatFactorDisplayValue({
      label: 'Dilution Level', value: 0.15, raw_value: null,
      unit: 'unit_interval', display_value: '0.15 unit_interval',
    })).toBe('0.15')
  })

  it.each([
    ['unit_interval', '0.15 unit_interval', '0.15'],
    ['unit interval', '0.15 unit interval', '0.15'],
    ['scale', '0.3 scale', '0.3'],
  ])('%s: the figure survives and the unit word does not', (unit, displayValue, expected) => {
    const out = formatFactorDisplayValue({
      label: 'Team Capability', value: 0.3, raw_value: null, unit, display_value: displayValue,
    })
    expect(out).toBe(expected)
    expect(out!).not.toContain(unit)
  })

  it('⛔ CONTROL: a spelling nobody has MEASURED is not silently adopted', () => {
    // ⚠ THIS CASE CAUGHT MY OWN OVER-REACH ON ITS FIRST RUN. I widened the
    // regex to accept `-` and then asserted `0.15 unit-interval` would be
    // stripped — a spelling that is NOT in `GENERIC_PLACEHOLDER_UNITS`,
    // because no capture has ever shown a producer sending it. The shape is
    // permissive; the POLICY stays measured. Inventing a spelling to make a
    // test pass is how a set stops meaning anything.
    expect(GENERIC_PLACEHOLDER_UNITS.has('unit-interval')).toBe(false)
    expect(formatFactorDisplayValue({
      label: 'Dilution Level', value: 0.15, raw_value: null,
      unit: 'unit-interval', display_value: '0.15 unit-interval',
    })).toBe('0.15 unit-interval')
  })

  it('⛔ CONTROL: a REAL multi-word unit now matches the shape and must be UNTOUCHED', () => {
    // 23 occurrences on the founder's boards. If the widened pattern had also
    // widened the policy, this would have lost its unit and read "5".
    expect(formatFactorDisplayValue({
      label: 'Investor Pipeline Size', value: 0.5, raw_value: null,
      unit: 'active leads', display_value: '5 active leads',
    })).toBe('5 active leads')
  })

  it('⛔ CONTROL: `ratio` matches the shape and must still render in full', () => {
    // 27 occurrences. Its frame is an open producer question; the UI must not
    // convert or strip it.
    expect(formatFactorDisplayValue({
      label: 'Conversion', value: 0.4, raw_value: null,
      unit: 'ratio', display_value: '0.4 ratio',
    })).toBe('0.4 ratio')
  })

  it('⛔ CONTROL: a real single-word unit is untouched', () => {
    expect(formatFactorDisplayValue({
      label: 'Lead time', value: null, raw_value: 42, unit: 'days', display_value: '42 days',
    })).toBe('42 days')
  })

  it('⛔ CONTROL: prose and parenthesised summaries still pass through', () => {
    expect(formatFactorDisplayValue({
      label: 'Tech Lead', value: 0, raw_value: null, unit: 'scale',
      display_value: 'No dedicated tech lead',
    })).toBe('No dedicated tech lead')
    expect(formatFactorDisplayValue({
      label: 'Capability', value: 0.5, raw_value: null, unit: 'scale',
      display_value: 'Moderate (0.5)',
    })).toBe('Moderate (0.5)')
  })

  it('⭐ and a declared encoding still wins over all of it', () => {
    expect(formatFactorDisplayValue({
      label: 'Germany Market Entry', value: 0, raw_value: null, unit: 'unit_interval',
      display_value: '0 unit_interval', encoding_map: { '0': 'Not pursued', '1': 'Pursued' },
    })).toBe('Not pursued')
  })
})
