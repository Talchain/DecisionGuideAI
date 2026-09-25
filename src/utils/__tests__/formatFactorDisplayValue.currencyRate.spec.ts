/**
 * Prototype (Paul, 25 Sep 2026): a salary carried as `unit: "GBP/year"` reads
 * `£39,000/year` on the factor card, not `39,000 GBP/year`.
 *
 * ⛔ FORMATTING OF THE CARRIED UNIT, NEVER A SUBSTITUTION: the split re-spells
 * ONLY the formatter's own `<amount> <unit>` string, carries it as `restates`,
 * and `formatFactorDisplayValue` itself — every other surface's string — is
 * asserted unchanged on every case below.
 */
import { describe, it, expect } from 'vitest'
import {
  formatFactorDisplayParts,
  formatFactorDisplayValue,
  joinFactorDisplayParts,
  type FactorDisplayInput,
} from '../formatFactorDisplayValue'

const salary = (unit: string, raw_value: number = 39000): FactorDisplayInput =>
  ({ label: 'Annual PA salary', value: 0.39, raw_value, cap: 100000, unit })

describe('formatFactorDisplayParts — currency rate', () => {
  it.each([
    ['GBP/year', '£39,000', '/year'],
    ['USD/month', '$39,000', '/month'],
    ['eur / year', '€39,000', '/year'],
  ])('%s → %s + attached %s, restating the unchanged formatter string', (unit, figure, suffix) => {
    const input = salary(unit)
    const text = formatFactorDisplayValue(input)
    expect(text).toBe(`39,000 ${unit.trim()}`)
    const parts = formatFactorDisplayParts(input)
    expect(parts).toEqual({ figure, unit: suffix, attached: true, restates: text })
    expect(joinFactorDisplayParts(parts!)).toBe(`${figure}${suffix}`)
  })

  it('zero is a valid amount: `0 GBP/year` → `£0/year`', () => {
    const parts = formatFactorDisplayParts(salary('GBP/year', 0))
    expect(formatFactorDisplayValue(salary('GBP/year', 0))).toBe('0 GBP/year')
    expect(parts && joinFactorDisplayParts(parts)).toBe('£0/year')
  })

  it.each([
    ['CHF/year', 'no glyph mapping'],
    ['GBP per year', 'not a /rate suffix'],
    ['GBP/full year', 'multi-word rate'],
    ['hours/week', 'not a currency'],
  ])('CONTRAST — %s (%s) keeps the ordinary word split, byte-identical', (unit) => {
    const input = salary(unit)
    const text = formatFactorDisplayValue(input)
    const parts = formatFactorDisplayParts(input)
    expect(parts).toEqual({ figure: '39,000', unit: unit.trim() })
    expect(joinFactorDisplayParts(parts!)).toBe(text)
  })

  it('CONTRAST — the formatter’s cost-at-zero SENTENCE is never re-spelt as an amount', () => {
    // Pattern 1 prints `No cost allocated` for a zero-valued cost factor. The
    // re-spelling is bound to the formatter's own `<amount> <unit>` string, so
    // it cannot turn that sentence into `£0/year`.
    const input: FactorDisplayInput = { ...salary('GBP/year', 0), factor_type: 'cost' }
    expect(formatFactorDisplayValue(input)).toBe('No cost allocated')
    expect(formatFactorDisplayParts(input)).toBeNull()
  })

  it('CONTRAST — a negative amount is not re-spelt', () => {
    const input = salary('GBP/year', -500)
    const parts = formatFactorDisplayParts(input)
    expect(parts?.restates).toBeUndefined()
    if (parts) expect(joinFactorDisplayParts(parts)).toBe(formatFactorDisplayValue(input))
  })

  it('CONTRAST — a producer display_value is never re-spelt (the split declines)', () => {
    const input = { ...salary('GBP/year'), raw_value: '£39k a year' }
    expect(formatFactorDisplayParts(input)?.restates).toBeUndefined()
  })

  it('CONTRAST — a bare ISO code keeps today’s `GBP 39,000`', () => {
    const input = salary('GBP')
    expect(formatFactorDisplayValue(input)).toBe('GBP 39,000')
    expect(formatFactorDisplayParts(input)).toEqual({ figure: 'GBP 39,000', unit: null })
  })
})
