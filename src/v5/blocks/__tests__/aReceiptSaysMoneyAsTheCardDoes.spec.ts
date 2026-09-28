/**
 * Served f0c8814f (fresh guest, £ price brief, price edited 49 → 58.8): the change receipt in the Olumi
 * tab read "49 GBP/month → 58.8 GBP/month", while the factor card prints the same node as "£49 / month".
 * `formatConstraintValue` knew a bare currency code only; a currency RATE fell through to
 * "<value> <unit>". It now reads the rate with the estate's own `compactUnitParts`.
 *
 * The table is the input class, not the served example. Shapes the shared reader declines (a
 * per-subscriber rate, a negative amount, "per 12 months") keep today's text on purpose: this receipt
 * does not invent a reading the factor card does not give.
 */
import { describe, expect, it } from 'vitest'
import { buildV5PatchDeps, buildV5PatchReceipt, formatConstraintValue } from '../v5GraphPatchDescription'

const TABLE: ReadonlyArray<[number, string, string]> = [
  // ⭐ currency rates: the glyph leads, the period follows — as the card prints them
  [49, 'GBP/month', '£49 / month'],
  [58.8, 'GBP/month', '£58.80 / month'],
  [0.5, 'GBP/month', '£0.50 / month'],
  [49, 'GBP per month', '£49 / month'],
  [49, '£/month', '£49 / month'],
  [49, '£ per month', '£49 / month'],
  [1200, 'USD/year', '$1,200 / year'],
  [10, 'EUR per week', '€10 / week'],
  // unchanged: bare currency, percent, counts, non-money rates
  [50000, 'GBP', '£50,000'],
  [5, '%', '5%'],
  [1500, 'subscribers', '1,500 subscribers'],
  [12, 'months', '12 months'],
  [3, 'hours/week', '3 hours/week'],
  // declined by the shared reader: today's text, deliberately
  [9800, 'GBP/subscriber/month', '9,800 GBP/subscriber/month'],
  [-5, 'GBP/month', '-5 GBP/month'],
  [1500, 'GBP per 12 months', '1,500 GBP per 12 months'],
]

describe('a receipt says money the way the factor card does', () => {
  it.each(TABLE)('%s %s → %s', (value, unit, expected) => {
    expect(formatConstraintValue(value, unit)).toBe(expected)
  })

  it('⭐ the served price edit: "£49 / month → £58.80 / month", no raw GBP', () => {
    const receipt = buildV5PatchReceipt(
      {
        type: 'v5_graph_patch',
        operation: 'set_factor_value',
        target_id: 'fac_pro_price',
        status: 'applied',
        before: { value: 0.49, raw_value: 49, unit: 'GBP/month' },
        after: { value: 0.588, raw_value: 58.8, unit: 'GBP/month' },
      } as never,
      buildV5PatchDeps([{ id: 'fac_pro_price', data: { label: 'Pro plan monthly price' } }], []),
    )
    expect(receipt.changeSummary).toBe('£49 / month → £58.80 / month')
    expect(receipt.changeSummary).not.toMatch(/GBP/)
  })
})
