/**
 * ROADMAP 2.580 member 4 — unit coverage for the downside unit formatter.
 *
 * The load-bearing property is NOT "a unit appears". It is that the MAGNITUDE
 * is byte-identical to what `formatRangeValue` produced before 2.580, so a
 * units fix cannot smuggle in a precision change. Every case below asserts
 * against `formatRangeValue` itself rather than against a literal, which makes
 * that a derived claim rather than a copied one (CLAUDE.md trap 12).
 */

import { describe, it, expect } from 'vitest'
import { formatDownsideValue } from '../formatDownsideValue'
import { formatRangeValue } from '../formatRangeValue'

/** The magnitudes the reviewer's session and the existing specs actually use. */
const VALUES = [0.29, 0.21, -0.37, 9.8, 12.4, 800, 1200, -1200, 0]

describe('formatDownsideValue — magnitude parity with formatRangeValue', () => {
  it.each(VALUES)('%p with no unit is EXACTLY formatRangeValue(v)', (v) => {
    expect(formatDownsideValue(v)).toBe(formatRangeValue(v))
    expect(formatDownsideValue(v, {})).toBe(formatRangeValue(v))
  })

  it.each(VALUES)('%p normalised is EXACTLY formatRangeValue(v), unit ignored', (v) => {
    // The unit is deliberately supplied AND deliberately not used: a
    // normalised score is not in the goal's unit.
    expect(
      formatDownsideValue(v, { unit: 'count', unitSymbol: 'hours', isNormalised: true }),
    ).toBe(formatRangeValue(v))
  })

  it.each(VALUES)('%p as a count keeps the magnitude and appends the unit word', (v) => {
    expect(formatDownsideValue(v, { unit: 'count', unitSymbol: 'hours' })).toBe(
      `${formatRangeValue(v)} hours`,
    )
  })

  it.each(VALUES)('%p as a percent keeps the magnitude and appends %%', (v) => {
    expect(formatDownsideValue(v, { unit: 'percent' })).toBe(`${formatRangeValue(v)}%`)
  })
})

describe('formatDownsideValue — currency sign placement', () => {
  it('prefixes the symbol on a non-negative value', () => {
    expect(formatDownsideValue(1200, { unit: 'currency', unitSymbol: '£' })).toBe(
      `£${formatRangeValue(1200)}`,
    )
    expect(formatDownsideValue(0, { unit: 'currency', unitSymbol: '£' })).toBe(
      `£${formatRangeValue(0)}`,
    )
  })

  it('puts the minus OUTSIDE the symbol on a negative value', () => {
    const out = formatDownsideValue(-1200, { unit: 'currency', unitSymbol: '£' })
    expect(out).toBe(`-£${formatRangeValue(1200)}`)
    expect(out).not.toContain('£-')
  })
})

describe('formatDownsideValue — fails closed rather than inventing a unit', () => {
  it('renders a bare magnitude when a count unit has no symbol to print', () => {
    expect(formatDownsideValue(12.4, { unit: 'count' })).toBe(formatRangeValue(12.4))
  })

  it('renders a bare magnitude when a currency unit has no symbol to print', () => {
    expect(formatDownsideValue(1200, { unit: 'currency' })).toBe(formatRangeValue(1200))
  })

  it('treats isNormalised === false as "user units", not as "unknown"', () => {
    expect(
      formatDownsideValue(12.4, { unit: 'count', unitSymbol: 'hours', isNormalised: false }),
    ).toBe(`${formatRangeValue(12.4)} hours`)
  })
})
