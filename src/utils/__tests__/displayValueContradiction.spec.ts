/**
 * ROADMAP 2.1003 / audit finding F3 — "the screen lies".
 *
 * RED-first. At pristine `538677ff`, `isDisplayValueContradicted` does not
 * exist and `formatFactorDisplayValue` returns a contradicting `display_value`
 * verbatim.
 *
 * MEASURED ON DEPLOYED STAGING, 2026-08-09: a CEE receipt carried
 * `observed_state.value = 40` beside a stale top-level
 * `display_value = "20%"`. The canvas preferred the string and kept showing
 * 20% — before AND after reload — while the rerun computed on 40 and flipped
 * the leading option from Pricing 32% to Onboarding 53%.
 *
 * ⚠ THE CORPUS BELOW IS NOT DRAWN FROM MY HEAD (trap 22). Every "must not be
 * judged" string is either taken from the deployed capture, from the golden
 * staging fixture in this repo (`golden-path-staging-2026-04-05.json`), or
 * from the PRODUCER's own declared output vocabulary — CEE's
 * `synthesiseDisplayValue` doc-comment enumerates exactly what it can emit:
 * "£500k", "$2.1m", "3%", "42 days", "18 months", "500,000", "Low (0.15)",
 * "0.15" — plus `synthesiseRangeDisplayValue`'s "0.48 to 1".
 */
import { describe, it, expect } from 'vitest'

import {
  isDisplayValueContradicted,
  formatFactorDisplayValue,
} from '../formatFactorDisplayValue'

describe('isDisplayValueContradicted — the measured case', () => {
  it('⭐ "20%" beside observed value 40 IS contradicted', () => {
    expect(isDisplayValueContradicted('20%', { value: 40 })).toBe(true)
  })

  it('"40%" beside observed value 40 is NOT contradicted', () => {
    expect(isDisplayValueContradicted('40%', { value: 40 })).toBe(false)
  })

  it('honours the 0-1 percent scaling in both directions', () => {
    expect(isDisplayValueContradicted('40%', { value: 0.4 })).toBe(false)
    expect(isDisplayValueContradicted('20%', { value: 0.4 })).toBe(true)
    expect(isDisplayValueContradicted('0.4', { value: 40 })).toBe(false)
  })

  it('accepts a display string that is a ROUNDING of the value', () => {
    expect(isDisplayValueContradicted('0.42', { value: 0.4234 })).toBe(false)
    expect(isDisplayValueContradicted('35%', { value: 35.2 })).toBe(false)
    // …but not a different number at the precision the string committed to.
    expect(isDisplayValueContradicted('0.42', { value: 0.51 })).toBe(true)
  })

  it('accepts agreement with raw_value as well as value', () => {
    expect(isDisplayValueContradicted('£30,000', { value: 0.3, raw_value: 30000 })).toBe(false)
  })
})

describe('isDisplayValueContradicted — the breadth guard (must judge NOTHING else)', () => {
  // Each row is a string the PRODUCER can legitimately emit. Judging any of
  // them would need a vocabulary, and a vocabulary over natural language is
  // exactly the predicate class this estate keeps getting wrong. Expectations
  // were written from `synthesiseDisplayValue`'s declared output list BEFORE
  // running, not from what the code does.
  const NEVER_JUDGED: Array<[string, string]> = [
    ['Moderate', 'qualitative band'],
    ['Low (0.15)', 'qualitative band with a parenthesised number'],
    ['0.48 to 1', 'a prior RANGE — two numbers, not the observed point'],
    ['3 to 5', 'range, bare'],
    ['£500k', 'currency magnitude shorthand — the digits are not the value'],
    ['$2.1m', 'currency magnitude shorthand'],
    ['42 days', 'time unit'],
    ['18 months', 'time unit'],
    ['6 developers', 'count with a unit word'],
    ['CHF 500', 'ISO currency prefix'],
    ['No acquisition pursued', 'contextual text from the golden fixture'],
    ['No dedicated tech lead', 'contextual text'],
    ['No cost allocated', 'contextual text'],
  ]

  it.each(NEVER_JUDGED)('never judges %s (%s)', (text) => {
    // Deliberately paired with a wildly different numeric state: if the guard
    // were willing to judge these at all, it would call them contradicted.
    expect(isDisplayValueContradicted(text, { value: 999, raw_value: 999 })).toBe(false)
  })

  it('THE SHAPE GATE IS THE AUTHORITY, not Number() — exotic numeric literals are not judged', () => {
    // MEASURED GAP: a mutant that DELETED the single-numeric shape gate left
    // this whole suite green, because every string above also fails
    // `Number.isFinite` after stripping. These two DO parse via `Number()`
    // while failing the shape gate, so they are the only cases that can tell
    // the gate apart from the finiteness check — without them the gate is
    // untested and a tidy-up would remove it.
    expect(isDisplayValueContradicted('1e5', { value: 999 })).toBe(false)
    expect(isDisplayValueContradicted('0x10', { value: 999 })).toBe(false)
    // Positive control for the pair: a plain number at the same magnitude IS
    // judged, so the two assertions above are about SHAPE, not magnitude.
    expect(isDisplayValueContradicted('100000', { value: 999 })).toBe(true)
  })

  it('never judges when there is no numeric state to contradict it with', () => {
    expect(isDisplayValueContradicted('20%', {})).toBe(false)
    expect(isDisplayValueContradicted('20%', { value: null, raw_value: null })).toBe(false)
  })

  it('never judges an empty or absent display value', () => {
    expect(isDisplayValueContradicted('', { value: 40 })).toBe(false)
    expect(isDisplayValueContradicted(null, { value: 40 })).toBe(false)
    expect(isDisplayValueContradicted(undefined, { value: 40 })).toBe(false)
  })
})

describe('formatFactorDisplayValue — the seam (not just the unit)', () => {
  it('⭐ THE MEASURED CASE: a contradicting display_value no longer wins', () => {
    // PRECONDITION PINNED IN-TEST: this is the exact shape the audit captured
    // — a numeric observed value, NO raw_value, and a stale percent string.
    const input = {
      label: 'Customer Success Coverage Depth',
      value: 40,
      raw_value: null,
      unit: '%',
      display_value: '20%',
    }
    expect(input.display_value).toBe('20%')
    expect(input.value).toBe(40)

    // ⭐ ASSERT THE POSITIVE OUTCOME, NOT THE ABSENCE OF THE SYMPTOM.
    // The first version of this test asserted only `not.toBe('20%')` — a
    // negative that CANNOT distinguish "renders 40%" from "renders nothing".
    // It passed while the node rendered BLANK: the invalidated string fell
    // through to Pattern 2's non-binary branch, which returns null. Killing the
    // symptom metric while never measuring the outcome metric is exactly the
    // failure this lane exists to stop, and it shipped inside the lane's own
    // suite until an independent review measured the rendered value.
    const out = formatFactorDisplayValue(input)
    expect(out).toBe('40%')
  })

  it('⭐ the recovery renders the COMMITTED value on the 0-1 scale too', () => {
    expect(
      formatFactorDisplayValue({
        label: 'Customer Success Coverage Depth',
        value: 0.4,
        raw_value: null,
        unit: '%',
        display_value: '20%',
      }),
    ).toBe('40%')
  })

  it('⭐ unitless: the invalidated string is replaced by the bare committed number', () => {
    expect(
      formatFactorDisplayValue({
        label: 'Headcount delta',
        value: 40,
        raw_value: null,
        unit: null,
        display_value: '20',
      }),
    ).toBe('40')
  })

  it('DISCLOSED LIMIT: a real-world unit with no raw_value renders NOTHING, not a wrong number', () => {
    // `value` is normalised against `cap` for currency/time/count units, so it
    // is not a real-world magnitude. Rendering "£0.3" for a £30,000 factor
    // would replace one lie with a worse one; reconstructing `value × cap`
    // would be inventing a number. Blank is the honest outcome and this test
    // PINS it so the boundary is visible rather than discovered later.
    expect(
      formatFactorDisplayValue({
        label: 'Annual CRM Licence Cost',
        value: 0.3,
        raw_value: null,
        unit: '£',
        display_value: '£20,000',
      }),
    ).toBeNull()
  })

  it('the recovery fires ONLY where something was suppressed', () => {
    // A node that simply never had a display_value keeps today's behaviour
    // byte-for-byte — this is the breadth guard on the recovery itself.
    expect(
      formatFactorDisplayValue({
        label: 'CS Coverage Depth',
        value: 40,
        raw_value: null,
        unit: '%',
      }),
    ).toBeNull()
  })

  it('POSITIVE CONTROL: an AGREEING display_value is still returned verbatim', () => {
    // Without this the fix could be "never trust display_value", which would
    // destroy every contextual string CEE authors.
    expect(
      formatFactorDisplayValue({
        label: 'Customer Success Coverage Depth',
        value: 40,
        raw_value: null,
        unit: '%',
        display_value: '40%',
      }),
    ).toBe('40%')
  })

  it('POSITIVE CONTROL: contextual text with no number survives a mismatched value', () => {
    expect(
      formatFactorDisplayValue({
        label: 'Acquisition',
        value: 0.9,
        raw_value: null,
        unit: null,
        display_value: 'No acquisition pursued',
      }),
    ).toBe('No acquisition pursued')
  })

  it('Pattern 1 (fresh raw_value + meaningful unit) still outranks display_value', () => {
    // The pre-existing stale-value protection must be untouched.
    expect(
      formatFactorDisplayValue({
        label: 'Cost',
        value: 0.26,
        raw_value: 26000,
        unit: '£',
        display_value: '£20,000',
      }),
    ).toBe('£26,000')
  })
})
