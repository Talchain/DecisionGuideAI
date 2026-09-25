/**
 * GAP 14 (value half) — contract §02: the card value is a FIGURE with its unit
 * as a separate, quieter span. `formatFactorDisplayParts` returns that split
 * ONLY for a value composed from a raw number plus a known unit, and `null`
 * for everything else — above all a producer `display_value`, which is CEE's
 * own text and is never parsed for a unit.
 *
 * ⭐ BOUND BY IDENTITY TO THE FORMATTER'S OWN STRING: every split below is
 * checked to join back to `formatFactorDisplayValue(input)` byte for byte, and
 * the formatter's own output for each input is asserted too, so a split can
 * never be green while the visible text changed.
 */
import { describe, it, expect } from 'vitest'
import {
  factorDisplayParts,
  factorDisplayText,
  formatFactorDisplayParts,
  formatFactorDisplayValue,
  joinFactorDisplayParts,
  type FactorDisplayInput,
} from '../formatFactorDisplayValue'

const split = (input: FactorDisplayInput) => {
  const parts = formatFactorDisplayParts(input)
  const text = formatFactorDisplayValue(input)
  if (parts !== null) {
    expect(joinFactorDisplayParts(parts), 'a split must read exactly as the unsplit string').toBe(text)
  }
  return { parts, text }
}

describe('formatFactorDisplayParts — a raw number plus a known unit is split', () => {
  it('a unit WORD is split off: "1,200 customers" → figure "1,200", unit "customers"', () => {
    const { parts, text } = split({ label: 'Customers', value: 0.6, raw_value: 1200, cap: 2000, unit: 'customers' })
    expect(text).toBe('1,200 customers')
    expect(parts).toEqual({ figure: '1,200', unit: 'customers' })
  })

  it('the unit word is the one Pattern 1 prints (canonicalised, trimmed), never invented', () => {
    const { parts, text } = split({ label: 'Lead time', value: 0.4, raw_value: 42, unit: ' days ' })
    expect(text).toBe('42 days')
    expect(parts).toEqual({ figure: '42', unit: 'days' })
  })

  it('a currency SYMBOL is part of the figure: "£49" is one figure, no unit span', () => {
    const { parts, text } = split({ label: 'Monthly price', value: 0.245, raw_value: 49, cap: 200, unit: '£' })
    expect(text).toBe('£49')
    expect(parts).toEqual({ figure: '£49', unit: null })
  })

  it('an ISO currency code keeps the formatter\'s spacing inside the figure: "CHF 500"', () => {
    const { parts, text } = split({ label: 'Fee', value: 0.5, raw_value: 500, unit: 'chf' })
    expect(text).toBe('CHF 500')
    expect(parts).toEqual({ figure: 'CHF 500', unit: null })
  })

  it('a percent is part of the figure, on both of Pattern 1\'s scales: 0.45 and 45 → "45%"', () => {
    expect(split({ label: 'Churn', value: 0.45, raw_value: 0.45, unit: '%' }).parts).toEqual({ figure: '45%', unit: null })
    expect(split({ label: 'Churn', value: 0.45, raw_value: 45, unit: '%' }).parts).toEqual({ figure: '45%', unit: null })
  })

  it('a stale display_value does not stop the split where Pattern 1 outranks it', () => {
    const { parts, text } = split({
      label: 'Customers', value: 0.65, raw_value: 1300, unit: 'customers', display_value: '1,200 customers',
    })
    expect(text).toBe('1,300 customers')
    expect(parts).toEqual({ figure: '1,300', unit: 'customers' })
  })
})

describe('formatFactorDisplayParts — everything else stays ONE string (null)', () => {
  it('⛔ CONTRAST: a producer display_value is never split, and the formatter still returns it verbatim', () => {
    const { parts, text } = split({ label: 'Demand', value: 0.5, display_value: '1,200 enterprise customers' })
    expect(text).toBe('1,200 enterprise customers')
    expect(parts).toBeNull()
  })

  it('⛔ CONTRAST: a producer currency display string is not split either', () => {
    const { parts, text } = split({ label: 'Budget', value: 0.2, display_value: '£20,000 per year' })
    expect(text).toBe('£20,000 per year')
    expect(parts).toBeNull()
  })

  it('the cost-at-zero sentence is not a figure', () => {
    const { parts, text } = split({ label: 'Cost', value: 0, raw_value: 0, unit: '£', factor_type: 'cost' })
    expect(text).toBe('No cost allocated')
    expect(parts).toBeNull()
  })

  it('a placeholder unit is not a known unit: the person\'s own "4" stays one string', () => {
    const { parts, text } = split({ label: 'Oversubscription', value: 4, raw_value: 4, unit: 'scale', value_source: 'user' })
    expect(text).toBe('4')
    expect(parts).toBeNull()
  })

  it('a non-numeric raw_value string is the producer\'s text, not a raw number', () => {
    const { parts, text } = split({ label: 'Price', raw_value: '£49', unit: 'per month' })
    expect(text).toBe('£49 per month')
    expect(parts).toBeNull()
  })

  it('a unitless raw number has no unit to split', () => {
    const { parts, text } = split({ label: 'Count', raw_value: 1200, unit: null })
    expect(text).toBe('1,200')
    expect(parts).toBeNull()
  })

  it('the binary "No X in place" heuristic is words, not a figure', () => {
    const { parts, text } = split({ label: 'Tech Lead Presence', value: 0, unit: null, factor_type: 'binary' })
    expect(text).toBe('No tech lead in place')
    expect(parts).toBeNull()
  })
})

describe('factorDisplayParts — the same node-data read as factorDisplayText', () => {
  it('splits a node whose observed state is a raw number plus a unit word, and joins to factorDisplayText', () => {
    const data = { label: 'Customers', observedState: { value: 0.6, raw_value: 1200, cap: 2000, unit: 'customers' } }
    const parts = factorDisplayParts(data)
    expect(parts).toEqual({ figure: '1,200', unit: 'customers' })
    expect(joinFactorDisplayParts(parts!)).toBe(factorDisplayText(data))
  })

  it('⛔ CONTRAST: a node carrying only CEE\'s display_value (top level) stays one string', () => {
    const data = { label: 'Demand', display_value: '1,200 customers', observedState: { value: 0.5 } }
    expect(factorDisplayText(data)).toBe('1,200 customers')
    expect(factorDisplayParts(data)).toBeNull()
  })

  it('null data is null, like factorDisplayText', () => {
    expect(factorDisplayParts(null)).toBeNull()
    expect(factorDisplayText(null)).toBeNull()
  })
})
