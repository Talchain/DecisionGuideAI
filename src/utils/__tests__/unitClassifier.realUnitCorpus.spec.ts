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
