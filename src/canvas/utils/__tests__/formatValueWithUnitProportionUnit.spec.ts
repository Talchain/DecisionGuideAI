/**
 * ⭐⭐ A PROPORTION UNIT'S FIGURE IS PRESERVED, NOT INTERPRETED.
 *
 * `formatValueWithUnit` renders `{value, unit}` for panel display. For the
 * `ratio` unit measured on the founder's board it produced `0.4 ratio`, which he
 * correctly called illegible to an onboarding user. This file pins what the
 * formatter does about that, and — more importantly — the three things it
 * MUST NOT do, each of which was proposed and refused.
 *
 * ⛔ (1) NO ×100. `0.4 ratio` must not become `40%`. The producer names these
 *        numbers `normalised_value` (measured at the bytes in
 *        `olumi-debug-54a6c321-20260919.json`), and a 0–1 normalised coordinate
 *        is not a percentage of anything. Independently, ×100 would break the
 *        round-trip proof this module documents at
 *        `DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS`: measured over 200,000 adjacent
 *        IEEE-754 pairs from 0.1, 43,750 collide after ×100 — e.g.
 *        `0.10000000000000005` and `0.10000000000000006` both become
 *        `10.000000000000005`, identical even at seventeen significant digits.
 *        `describeRebaseDivergence`'s termination-by-proof would have silently
 *        become termination-by-hope.
 *
 * ⛔ (2) NO QUALITATIVE WORD. `0.4 ratio` must not become `moderate`. That is
 *        what joining `GENERIC_PLACEHOLDER_UNITS` would do, and undefined scales
 *        do not justify a band label.
 *
 * ⛔ (3) NO ROUNDING THAT MISREPRESENTS THE STORED VALUE — and this is the one
 *        real defect the increment removes. See the describe block below.
 *
 * ⚠ HONEST LIMIT, STATED HERE BECAUSE THE NEXT READER WILL ASK. None of this
 * makes `0.4` legible. Legibility needs disclosure — the figure behind an
 * affordance, with meaning on the face — and this helper returns a `string`. Its
 * three production callers interpolate that string into a `<span>`
 * (`AddOptionPanel.tsx:203`), into a subtitle (`resolveCapHintSubtitle`) and
 * into a prose sentence (`optimisticFactorEdit.ts:518`); no formatter in this
 * codebase returns a face+detail shape, and the disclosure affordances that
 * exist live in `src/pages/sandbox-guide/**` and `src/components/debug/**`,
 * neither reachable from a string return. So the disclosure limb is NOT in this
 * increment, and what `ratio` actually denotes is an open question owned by the
 * backend. What is here is the naming, the refusals, and the removal of one lie.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  formatValueWithUnit,
  qualitativeLabel,
  DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS,
} from '../formatValueWithUnit'

/**
 * The founder's board, measured. The bundle carries 13 objects with
 * `unit: "ratio"`, but they are FIVE distinct numbers: one factor
 * `observed_state` (`/full_graph/factors/6`, value `0.4`, composed UI-side) and
 * four option interventions on one factor id (`65f6ae27`, values below),
 * mirrored across three copies of the same payload. Recorded precisely because
 * the brief's "13 values / 31% of the board" counted one payload three times.
 */
const FOUNDER_VALUES = [0.4, 0.55, 0.65, 0.85] as const

describe('the measured case: a ratio renders its own figure and its own word', () => {
  it.each(FOUNDER_VALUES)('%f ratio renders as the stored figure plus the producer word', v => {
    expect(formatValueWithUnit(v, 'ratio')).toBe(`${v} ratio`)
  })

  it('a ratio above 1 — the multiple reading — is equally untouched', () => {
    expect(formatValueWithUnit(2.5, 'ratio')).toBe('2.5 ratio')
    expect(formatValueWithUnit(1, 'ratio')).toBe('1 ratio')
  })

  /**
   * ⚠ BOUND BY A DISCRIMINATING VALUE, NOT BY THE WORD. `0.4` renders the same on
   * the proportion path and the plain `other` path, so asserting it proves nothing
   * about which path ran.
   *
   * ⚠⚠ THE DISCRIMINATOR WAS REPLACED BY R9, BECAUSE R9 DESTROYED THE OLD ONE.
   * This case used `0.00001`, on the stated grounds that it "renders `0` on the
   * `other` path and its own value on the proportion path". That was true when
   * written and is FALSE now: `formatNumber` no longer annihilates, so `0.00001`
   * renders `0.00001` on BOTH paths and this assertion would have passed while
   * proving nothing about the predicate — a guard that silently stopped
   * discriminating, with no red anywhere.
   *
   * `0.000012345` discriminates against the CURRENT code: the proportion arm's
   * FOUR significant digits give `0.00001235`, while the `other` arm's rescue
   * gives TWO — `0.000012`. The precondition is asserted IN-TEST below, so if a
   * later change collapses the two arms again this case REDs instead of quietly
   * going vacuous.
   *
   * The unit WORD keeps the producer's own casing — `classifyUnit` canonicalises
   * case for ISO codes only, and echoing the producer is the convention here.
   */
  it('case and whitespace in the unit reach the proportion path', () => {
    // PRECONDITION, PINNED: the two arms must still render this value
    // differently, or the assertions below discriminate nothing.
    expect(formatValueWithUnit(0.000012345, 'months')).toBe('0.000012 months')
    expect(formatValueWithUnit(0.000012345, 'ratio')).toBe('0.00001235 ratio')

    expect(formatValueWithUnit(0.000012345, ' Ratio ')).toBe('0.00001235 Ratio')
    expect(formatValueWithUnit(0.000012345, 'RATIO')).toBe('0.00001235 RATIO')
  })
})

describe('⛔ the two refused transforms', () => {
  it.each(FOUNDER_VALUES)('%f ratio is NOT converted to a percentage', v => {
    const out = formatValueWithUnit(v, 'ratio')
    expect(out, 'a ×100 conversion reached the face — the producer calls this normalised').not.toContain('%')
    // The exact string a ×100 conversion would have produced, pinned per value.
    expect(out).not.toBe(`${v * 100}%`)
    expect(out).toBe(`${v} ratio`)
  })

  it.each(FOUNDER_VALUES)('%f ratio is NOT replaced by a qualitative band word', v => {
    const out = formatValueWithUnit(v, 'ratio')
    for (const word of ['very low', 'low', 'moderate', 'high', 'very high']) {
      expect(out, `the qualitative branch fired for a ratio ("${word}")`).not.toBe(word)
    }
    // BINDING THE CONTROL: the word this value WOULD have become is a real
    // output of a real branch, so the assertion above is not vacuous.
    expect(qualitativeLabel(0.4)).toBe('moderate')
    expect(formatValueWithUnit(0.4, 'scale')).toBe('moderate')
  })
})

/**
 * ⭐⭐ THE DEFECT THIS INCREMENT REMOVES: THE HOUSE BOUND ANNIHILATES A SMALL
 * MAGNITUDE, SO A NON-ZERO STORED VALUE RENDERS AS ZERO.
 *
 * `BOUNDED_FMT` is `maximumFractionDigits: 4`. That caps DECIMAL PLACES, so
 * anything under 5e-5 formats as the string `0`:
 *
 *     0.00001  ratio  →  "0 ratio"      ← asserts zero for a value that is not
 *     0.000004 ratio  →  "0 ratio"
 *
 * ⚠ TWO DIFFERENT HARMS WERE SHARING ONE PARAMETER, WHICH IS WHY NEITHER WAS
 * SAFE. The bound was introduced against OVER-CLAIMED precision — a measured
 * corpus of causal-edge means arriving at seventeen significant figures
 * (`0.24782608695652172`). That harm is real and the four-figure budget is the
 * right answer to it. But `maximumFractionDigits` answers it with an instrument
 * that also DESTROYS MAGNITUDE at the small end, and destroying a magnitude is
 * the worse of the two: an over-claimed figure is still the value, whereas `0`
 * is a different number. Trap 21 — two questions under one name.
 *
 * `maximumSignificantDigits: 4` is the SAME four-figure honesty budget stated
 * against significant figures instead of decimal places. It bounds the
 * over-claim identically and cannot annihilate. Measured: it is BYTE-IDENTICAL
 * on every value on the founder's board and on every value pinned in this file
 * except the annihilating ones. That is the whole blast radius.
 *
 * ⚠⚠ THE PROPORTION-ONLY SCOPE IS SUPERSEDED — R9 CLOSED IT. This paragraph said
 * the same annihilation for every other unit class (`0.00001 months` →
 * `0 months`) was "a real defect … NOT fixed here … a separate, reviewable
 * change", pinned below as UNCHANGED. That change has now been made in
 * `formatNumber` itself: every class below 5e-5 falls back to TWO significant
 * digits where the house bound erased the magnitude. The two pins were moved
 * deliberately and still carry their history.
 *
 * ⚠ THE PROPORTION ARM IS STILL DIFFERENT, DELIBERATELY: FOUR significant digits
 * UNCONDITIONALLY, not two on rescue. A proportion value's whole population lives
 * where the fraction bound bites, so it gets the wider budget. Two budgets for one
 * harm is correct here, not an inconsistency to reconcile — and it is what makes
 * the discriminating case below able to tell the two arms apart at all.
 */
describe('⭐ a proportion figure is never rounded into a different number', () => {
  it('0.00001 ratio renders its value, not "0"', () => {
    expect(formatValueWithUnit(0.00001, 'ratio')).toBe('0.00001 ratio')
  })

  it('0.000004 ratio renders its value, not "0"', () => {
    expect(formatValueWithUnit(0.000004, 'ratio')).toBe('0.000004 ratio')
  })

  it('no non-zero proportion value renders as zero', () => {
    for (const v of [0.00001, 0.000004, 0.00004999, 1e-7, -0.00001]) {
      const out = formatValueWithUnit(v, 'ratio')
      const magnitude = out.replace(' ratio', '')
      expect(Number(magnitude), `formatValueWithUnit(${v}, 'ratio') === ${JSON.stringify(out)}`).not.toBe(0)
    }
  })

  it('a genuine zero still renders as zero', () => {
    expect(formatValueWithUnit(0, 'ratio')).toBe('0 ratio')
  })

  it('the four-figure honesty budget is kept — seventeen figures do not reach the reader', () => {
    expect(formatValueWithUnit(0.24782608695652172, 'ratio')).toBe('0.2478 ratio')
    expect(formatValueWithUnit(0.123456, 'ratio')).toBe('0.1235 ratio')
  })

  it('thousand separators still apply above 1000', () => {
    expect(formatValueWithUnit(1500, 'ratio')).toBe('1,500 ratio')
  })
})

describe('the significantDigits contrast override still reaches full resolution', () => {
  /**
   * `describeRebaseDivergence` walks a precision ladder until two renderings
   * differ, and terminates by PROOF at 17 significant digits. A proportion unit
   * must not break that — which is the second reason ×100 was refused, since
   * ×100 collapses distinct doubles.
   */
  it('two doubles that differ only in the last bit render differently at the top rung', () => {
    const a = 0.10000000000000005
    const b = 0.10000000000000006
    expect(a).not.toBe(b)
    const ra = formatValueWithUnit(a, 'ratio', DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS)
    const rb = formatValueWithUnit(b, 'ratio', DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS)
    expect(ra).not.toBe(rb)
    expect(ra).toBe('0.10000000000000005 ratio')
    expect(rb).toBe('0.10000000000000006 ratio')
  })

  it('an explicit override outranks the proportion default', () => {
    expect(formatValueWithUnit(0.24782608695652172, 'ratio', 8)).toBe('0.24782609 ratio')
  })
})

/**
 * ⭐⭐ THE PERCENT ARM DOES NOT SCALE, AND THAT IS THE CONTRACT — PINNED IN BOTH
 * DIRECTIONS.
 *
 * A separate concern from the `ratio` work above, pinned here because it was
 * reported as a defect in this file on 19 Sep 2026 and the report was
 * mis-attributed. `formatValueWithUnit(0.62, '%')` → `'0.62%'`. The sentence said
 * to promise a ×100 (*"Percent is the one exception…"*) appears ZERO times in this
 * module — it belongs to `factorPriorRange.ts:298` — while this module declares
 * ALREADY-DENORMALISED (raw) input, under which a raw percent is already in
 * percentage points. All three production callers pass raw values.
 *
 * ⛔ These rows exist so that a later lane "fixing" the arm by adding a ×100
 * REDs immediately: that change would multiply all three callers' values by 100.
 * A caller holding a NORMALISED 0–1 quantity must not use this helper.
 */
describe('⛔ the percent arm suffixes and does not scale (raw-value contract)', () => {
  it('a raw percent value keeps its magnitude — no ×100', () => {
    expect(formatValueWithUnit(0.62, '%')).toBe('0.62%')
    expect(formatValueWithUnit(62, '%')).toBe('62%')
    expect(formatValueWithUnit(4.5, '%')).toBe('4.5%')
  })

  it('the word spellings canonicalise to the glyph and are equally unscaled', () => {
    expect(formatValueWithUnit(0.62, 'percent')).toBe('0.62%')
    expect(formatValueWithUnit(0.62, 'percentage')).toBe('0.62%')
  })

  /**
   * A DERIVED DRIFT ALARM on the mis-attributed sentence: if it is ever pasted
   * into this module, the module starts promising a transform it does not perform
   * — the exact confusion that produced the false defect report.
   */
  it('this module does not claim a ×100 it does not perform', () => {
    const src = readFileSync(join(__dirname, '../formatValueWithUnit.ts'), 'utf8')
    const claim = /Percent is the one exception[\s\S]{0,120}/.exec(src)
    if (claim) {
      expect(
        /converts to\s+\*?\s*percentage points/.test(claim[0]) && !/DOES NOT|ZERO times/.test(src),
        'this module now claims the ×100 rule it does not implement',
      ).toBe(false)
    }
    // CONTRAST CONTROL: the raw-value frame declaration is present, so this
    // assertion is about a real, findable contract and not a vacuous regex.
    expect(src).toContain('ALREADY-DENORMALISED (raw) values only')
  })
})

/**
 * ⭐ BLAST RADIUS, PINNED BY ENUMERATION. Every other unit class must be
 * byte-identical. Without these rows a change to the shared magnitude path
 * would move a second class with no red anywhere — the shape
 * `theModelTabPutsTheCurrencyInFront.spec.ts` exists to prevent one level up.
 */
describe('every other unit class is untouched', () => {
  const UNCHANGED: ReadonlyArray<[number, string | undefined, string]> = [
    [250000, '£', '£250,000'],
    [49.5, '€', '€49.5'],
    [1200, 'USD', 'USD 1,200'],
    [20, '%', '20%'],
    [20, 'percent', '20%'],
    [9, 'months', '9 months'],
    [500, 'customers', '500 customers'],
    // A placeholder unit OUTSIDE 0–1 drops the word and renders bare — the
    // qualitative branch is bounded, so 8 is not "very high".
    [8, 'scale', '8'],
    [50, 'index', '50'],
    [0.4, undefined, 'moderate'],
    [250000, undefined, '250,000'],
    // ⚠⚠ THESE TWO ROWS WERE MOVED BY R9, ON PURPOSE. They pinned
    // `'0 months'` / `'£0'` — the same latent annihilation, deliberately left
    // out of #1747's scope so that its boundary was provable rather than
    // asserted. That "separate reviewable change" has now been made in
    // `formatNumber` itself, so these classes show their magnitude too. The rows
    // are KEPT rather than deleted: they are the pins that prove the boundary
    // moved, and the full enumerated blast radius lives in
    // `formatNumber.smallMagnitudeRescue.spec.ts`.
    [0.00001, 'months', '0.00001 months'],
    [0.00001, '£', '£0.00001'],
  ]

  it.each(UNCHANGED)('formatValueWithUnit(%f, %s) === %s', (v, unit, expected) => {
    expect(formatValueWithUnit(v, unit)).toBe(expected)
  })
})
