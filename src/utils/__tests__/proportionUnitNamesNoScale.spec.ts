/**
 * ⭐⭐ `ratio` IS NAMED, AND NAMING IT IS NOT LICENCE TO INTERPRET IT.
 *
 * THE USER-VISIBLE PROBLEM. The founder, on his own board: *"things like a 0.4
 * ratio aren't something that most onboarding users will understand."* Measured
 * in his debug bundle (`olumi-debug-54a6c321-20260919.json`, 19 Sep 2026):
 * `ratio` is the third unit spelling on the board, and it reaches the reader as
 * the bare string `0.4 ratio`.
 *
 * ⛔⛔ AND THE OBVIOUS FIX IS REFUSED, TWICE OVER. The tempting move is
 * `0.4 ratio` → `40%`. It was briefed, and an independent review REFUTED the
 * premise before it shipped. Both refutations are recorded here because the
 * inference is re-derivable by any later reader, and a spelling in a set is
 * exactly where the next session will come looking for permission.
 *
 * (1) THE SEMANTIC REFUTATION — the brief derived "0.4 ratio = 40%" from the
 *     founder's own words, *"the founder currently spends 60% of time on
 *     sales"*. That establishes 40% on product ONLY if sales and product
 *     exhaust the allocation. They need not: 60% sales / 25% product / 15%
 *     admin satisfies the brief and makes `0.4` not a share of anything named.
 *     The reviewer's ruling: *"A `ratio` between 0 and 1 does not itself
 *     establish a percentage. Confirm the quantity and its representation
 *     before converting it."*
 *
 * (2) THE PRODUCER REFUTATION, MEASURED AT THE BYTES, AND IT IS DECISIVE. The
 *     four option interventions carrying this unit in that bundle have exactly
 *     three keys:
 *
 *         {"display_value": "0.85 ratio", "normalised_value": 0.85, "unit": "ratio"}
 *
 *     The producer calls the number `normalised_value`. A normalised 0–1
 *     coordinate is not a percentage of anything, so ×100 would have minted
 *     meaning the wire does not carry. Per the same ruling: *"Real-world unit
 *     labels alone do not establish whether the stored number is native or
 *     normalised."*
 *
 * ⚠ SO WHAT `PROPORTION_UNITS` MEANS IS DELIBERATELY THIN: it names the
 * SPELLING of a unit that names no real-world scale a reader can interpret
 * unaided. It is NOT a conversion licence, and it carries no claim about
 * whether `ratio` denotes a proportion or a multiple — that question is
 * UNRESOLVED and owned by the backend.
 *
 * ⚠ AND IT IS NOT A MEMBER OF `GENERIC_PLACEHOLDER_UNITS`, which is where it
 * looks like it belongs. That set drives two transforms — the ×100 percent
 * scaling and the qualitative-word branch in `canvas/utils/formatValueWithUnit`
 * — and the same review ruled that *"undefined scales do not justify labels
 * such as 'moderate'"*. Joining it would turn `0.4 ratio` into the word `low`,
 * which invents a band where none is defined. The two sets answer different
 * questions and are named apart, exactly as `BARE_MAGNITUDE_UNITS` is (trap 21).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PROPORTION_UNITS,
  isProportionUnit,
  GENERIC_PLACEHOLDER_UNITS,
  BARE_MAGNITUDE_UNITS,
  classifyUnit,
  unitIsDisplayable,
} from '../unitClassifier'

const CLASSIFIER_SRC = join(__dirname, '../unitClassifier.ts')

describe('PROPORTION_UNITS names the measured spelling and nothing else', () => {
  /**
   * ⭐ EXACT MEMBERSHIP, NOT "CONTAINS". `ratio` is the spelling MEASURED on the
   * wire, 13 times in one bundle. `proportion`, `fraction` and `share` have
   * never appeared there, and the file's own standing rule — stated for
   * `'per cent'` and for `'counts'` — is that an unmeasured spelling *"would be
   * a guess"*. A `toContain` assertion would let a guess in silently.
   */
  it('contains exactly ["ratio"]', () => {
    expect([...PROPORTION_UNITS]).toEqual(['ratio'])
  })

  it('recognises ratio case- and whitespace-insensitively, as every other set here does', () => {
    for (const spelling of ['ratio', 'Ratio', 'RATIO', '  ratio  ', ' Ratio ']) {
      expect(isProportionUnit(spelling), `isProportionUnit(${JSON.stringify(spelling)})`).toBe(true)
    }
  })

  /**
   * Negative controls. Without these the suite would pass against an
   * `isProportionUnit` that had been made to return `true` for everything —
   * the vacuity shape trap 13 exists for.
   */
  it('does NOT recognise unmeasured spellings, or any other unit class', () => {
    for (const spelling of [
      'proportion', 'fraction', 'share', 'ratios', 'rate', 'percent', '%',
      '£', 'USD', 'scale', 'months', 'count', '', '   ',
    ]) {
      expect(isProportionUnit(spelling), `isProportionUnit(${JSON.stringify(spelling)})`).toBe(false)
    }
    expect(isProportionUnit(null)).toBe(false)
    expect(isProportionUnit(undefined)).toBe(false)
  })
})

describe('⛔ ratio is NOT a placeholder, and the sets stay disjoint', () => {
  /**
   * ⭐ THE LOAD-BEARING PIN OF THIS FILE. Derived by intersecting the two sets
   * rather than asserting one literal, so it REDs however the membership is
   * spelled — including a later edit that adds `ratio` to the placeholder set
   * "for consistency". That edit is precisely what the review forbade.
   */
  it('PROPORTION_UNITS and GENERIC_PLACEHOLDER_UNITS share no member', () => {
    const overlap = [...PROPORTION_UNITS].filter(u => GENERIC_PLACEHOLDER_UNITS.has(u))
    expect(
      overlap,
      'a proportion unit joined GENERIC_PLACEHOLDER_UNITS — that set drives the ×100 percent '
      + 'scaling and the qualitative-word branch, so this turns a precise figure into "low"',
    ).toEqual([])
  })

  it('ratio is not a bare-magnitude sentinel either — its word is real and stays on screen', () => {
    expect(BARE_MAGNITUDE_UNITS.has('ratio')).toBe(false)
    // CONTRAST CONTROL: the set is not simply empty.
    expect(BARE_MAGNITUDE_UNITS.has('count')).toBe(true)
  })

  /**
   * `unitIsDisplayable` decides whether the unit's WORD appears. `ratio` must
   * keep it: suppressing the word would leave a bare `0.4` with no indication
   * of what it is, which is less honest than today, not more — and it would
   * move six surfaces that read this predicate.
   */
  it('unitIsDisplayable("ratio") stays true — suppressing the word would hide the unit', () => {
    expect(unitIsDisplayable('ratio')).toBe(true)
    // CONTRAST CONTROLS either side of the predicate.
    expect(unitIsDisplayable('count')).toBe(false)
    expect(unitIsDisplayable('months')).toBe(true)
  })
})

describe('⭐ the predicate is separate from UnitClass — classifyUnit is UNCHANGED', () => {
  /**
   * ⭐⭐ THE KIND-VS-PREDICATE DECISION, PINNED SO IT CANNOT BE QUIETLY REVERSED.
   *
   * 22 production files consume `classifyUnit`, and NONE of them switches on
   * the kind — every one is an if/else chain ending in an `other` fall-through.
   * So adding a `'proportion'` member to `UnitClass` produces ZERO TypeScript
   * errors and a SILENT behaviour change in all 22, four of which read
   * `=== 'other'` explicitly (`labelUtils.ts:839`, `labelUtils.ts:904`,
   * `goalConstraintText.ts:21`, `TriageCard.tsx:265`). Two more sit in files
   * this lane does not own (`canvas/nodes/OptionNode.tsx`,
   * `canvas/nodes/shared/factorPriorRange.ts`), so a new member could not even
   * be made safe from here. `ratio` therefore stays in the `other` class and
   * the proportion question is asked by a PREDICATE the formatter consults.
   */
  it('classifyUnit("ratio") still returns kind "other" with the producer spelling', () => {
    expect(classifyUnit('ratio')).toEqual({ kind: 'other', canonical: 'ratio' })
  })

  it('the UnitClass union in source gained no member', () => {
    const src = readFileSync(CLASSIFIER_SRC, 'utf8')
    const decl = /export type UnitClass\s*=\s*([^\n]+)/.exec(src)
    expect(decl, 'UnitClass union not found — this guard has drifted').not.toBeNull()
    const members = decl![1].match(/'([^']+)'/g)?.map(m => m.slice(1, -1)) ?? []
    expect(members).toEqual(['none', 'symbol', 'iso', 'percent', 'placeholder', 'other'])
    expect(
      members,
      'a "proportion" UnitClass member was added — 22 consumers branch on this union with no '
      + 'switch anywhere, so TypeScript reports nothing and every one of them changes silently',
    ).not.toContain('proportion')
  })

  /**
   * A DERIVED DRIFT ALARM, not a hand-maintained mirror: it reads the file and
   * fails if the ×100 transform appears next to the proportion set at all. The
   * refuted premise is the one a later session is most likely to re-derive, and
   * a comment cannot fail.
   */
  it('the classifier contains no ×100 conversion for a proportion unit', () => {
    const src = readFileSync(CLASSIFIER_SRC, 'utf8')
    const decl = /export const PROPORTION_UNITS[\s\S]{0,400}/.exec(src)
    expect(decl, 'PROPORTION_UNITS declaration not found').not.toBeNull()
    expect(
      /\*\s*100|100\s*\*/.test(decl![0]),
      'a ×100 appeared at PROPORTION_UNITS. The producer names these values '
      + '`normalised_value`; converting one to a percentage mints meaning the wire does not carry.',
    ).toBe(false)
  })
})
