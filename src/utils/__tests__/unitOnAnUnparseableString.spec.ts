/**
 * A UNIT SUFFIX IS A CLAIM. IT MAY NOT BE BOLTED ONTO A STRING NOBODY PARSED.
 *
 * ⭐ THE DEFECT. `formatFactorDisplayValue`'s Pattern 1 ended with
 * `return \`${raw_value} ${unit}\``, reached whenever `Number(raw_value)` is
 * NaN. `Number('0.35 to 1')` is NaN — so a NORMALISED PRIOR RANGE arriving as
 * a string rendered **"0.35 to 1 people"**: two model-scale endpoints in [0,1]
 * presented to a reader as a count of people.
 *
 * It is the `provenance_unit_normalised.original_value` defect one field over —
 * a normalised number reaching a surface that labels it with the user's own
 * unit — and that is exactly what makes the output plausible rather than
 * obviously broken. Nobody reading "0.35 to 1 people" sees a bug; they see a
 * strange forecast.
 *
 * ⛔ AND THE SIBLING SURFACE HAD ALREADY RULED ON IT. `factorPriorRange.ts`
 * meets a real unit with no usable cap and refuses: *"prefixing a normalised
 * 0–1 endpoint with '£' fakes calibration exactly like a placeholder unit
 * would"* — it renders the range unitless. Two surfaces, one question, and this
 * one was answering it differently and louder (trap 21).
 *
 * ⚠ PROVENANCE OF THIS CLAIM, STATED RATHER THAN BLURRED:
 *   · the CODE PATH is derived at the bytes and is exercised below;
 *   · the RENDERED OUTPUT was witnessed by Core in 3 of 14 renderings across
 *     30 staging captures;
 *   · this repo's committed captures carry NO string `raw_value` (0 of 3), so
 *     it is NOT reproducible from a local fixture, and these tests drive the
 *     formatter directly rather than pretending otherwise.
 */
import { describe, it, expect } from 'vitest'
import { formatFactorDisplayValue } from '../formatFactorDisplayValue'

const base = { label: 'Headcount', value: null, factor_type: null, cap: null, category: null, display_value: null }

describe('an unparseable value never earns a unit', () => {
  /** THE WITNESSED CASE. */
  it('does not present a normalised range as a count of people', () => {
    const out = formatFactorDisplayValue({ ...base, raw_value: '0.35 to 1', unit: 'people' })
    expect(out).not.toContain('people')
    expect(out).toBe('0.35 to 1')
  })

  it('and the same for a duration', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '0.3 to 0.9', unit: 'months' }))
      .toBe('0.3 to 0.9')
  })

  /**
   * ⚠ "caveat, never hide" — this module's standing ruling. The producer's own
   * string still reaches the reader; only the fabricated unit is withheld.
   * Suppressing entirely would hide a real state.
   */
  it('still shows what the model actually said', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '0.35 to 1', unit: 'people' }))
      .toBe('0.35 to 1')
  })

  /** A second unit claim is not reconciled here — it is simply not added. */
  it('does not append a unit beside a unit already in the string', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '£49', unit: '£' })).toBe('£49')
  })
})

describe('⛔ but a real number keeps its unit — the fix must not trade one defect for another', () => {
  /**
   * ⭐ THE CASE THAT CONSTRAINS THE IMPLEMENTATION. `Number('1,200')` is NaN,
   * so a grouped figure hits the same branch as the range. A naive fix that
   * just dropped the unit for every NaN would silently strip the unit from a
   * legitimately formatted number — a new defect, in the opposite direction,
   * on a value that IS a measurement.
   */
  it('parses grouping separators rather than dropping the unit', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '1,200', unit: 'people' }))
      .toBe('1,200 people')
  })

  it('keeps symbol units prefixed on a grouped figure', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '20,000', unit: '£' })).toBe('£20,000')
  })

  it('an ordinary numeric string is unaffected', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: '12', unit: 'people' })).toBe('12 people')
  })

  /** CONTRAST CONTROL: the numeric path is untouched by this change. */
  it('CONTRAST: a real number still formats exactly as before', () => {
    expect(formatFactorDisplayValue({ ...base, raw_value: 20000, unit: '£' })).toBe('£20,000')
    expect(formatFactorDisplayValue({ ...base, raw_value: 0.25, unit: '%' })).toBe('25%')
  })
})
