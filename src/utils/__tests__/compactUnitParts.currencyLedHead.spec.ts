/**
 * ⭐ A CURRENCY-LED COMPOUND UNIT READS LIKE EVERY OTHER RATE — post-run DIFF
 * item 10 (28 Sep 2026). Paul's MRR boards carry `unit: "GBP MRR added per
 * month"` (served `mrr-17d1cd3a` / `mrr-90b8f080`, `other_mrr_growth`), and the
 * one compact-unit owner printed it `1,000 GBP MRR added / month` beside
 * `£49 / month` on the next card. The currency word now becomes its glyph and
 * every other word survives: `£1,000` + `MRR added / month`.
 *
 * ⚠ A PROBE TABLE OVER THE INPUT CLASS, NOT THE SERVED EXAMPLE: the rule is
 * pinned on currency-led heads the producer could plausibly write, and on the
 * neighbouring shapes that must NOT move (the controls keep the pre-change
 * output, byte for byte).
 */
import { describe, it, expect } from 'vitest'
import { compactUnitParts, joinCompactUnitParts } from '../unitClassifier'

const read = (figure: string, unit: string) => {
  const p = compactUnitParts(figure, unit)
  return p === null ? null : joinCompactUnitParts(p)
}

describe('currency-led heads take the glyph; every other word stays', () => {
  it.each([
    ['700', 'GBP MRR added per month', '£700 MRR added / month'],
    ['1,000', 'GBP MRR added per month', '£1,000 MRR added / month'],
    ['12', 'USD ARR per year', '$12 ARR / year'],
    ['5', 'EUR revenue per quarter', '€5 revenue / quarter'],
    ['40', '£ MRR per month', '£40 MRR / month'],
    ['40', 'gbp net new per week', '£40 net new / week'],
  ])('%s %s → %s', (figure, unit, expected) => {
    expect(read(figure, unit)).toBe(expected)
    expect(compactUnitParts(figure, unit)!.figure.startsWith(expected.slice(0, 1))).toBe(true)
  })
})

describe('CONTROLS — the neighbouring shapes keep their earlier reading', () => {
  it.each([
    // A bare currency rate — unchanged.
    ['49', 'GBP per month', '£49 / month'],
    // A word rate — no currency, so no glyph.
    ['75', 'subscribers per month', '75 subscribers / month'],
    // An ISO code with no glyph this product has shown: the words stay as they were.
    ['700', 'CHF MRR per month', '700 CHF MRR / month'],
    // A digit in the remainder may be a magnitude: left as it was.
    ['7', 'GBP 000s per month', '7 GBP 000s / month'],
    // A negative amount: no sign convention is chosen here.
    ['-700', 'GBP MRR added per month', '-700 GBP MRR added / month'],
    // Percent rate — unchanged.
    ['7', 'percent per month', '7% / month'],
  ])('%s %s → %s', (figure, unit, expected) => {
    expect(read(figure, unit)).toBe(expected)
  })

  // ⭐ RE-PINNED 28 Sep 2026: a currency head with ONE per-word is money per
  // that thing per period — the contract board's own spelling, "£49 per
  // subscriber / month". Served (Paul's pricing brief, UI d1ee022d): "Pro plan
  // monthly price would have to rise from 58.8 GBP per subscriber per month…".
  it.each([
    ['9', 'GBP per subscriber per month', { figure: '£9', unit: 'per subscriber / month' }],
    ['49', '£/subscriber/month', { figure: '£49', unit: 'per subscriber / month' }],
    ['49', 'GBP/subscriber/month', { figure: '£49', unit: 'per subscriber / month' }],
    ['12', 'USD per seat per month', { figure: '$12', unit: 'per seat / month' }],
  ])('%s %s → the glyph on the figure, per that thing per period', (figure, unit, expected) => {
    expect(compactUnitParts(figure, unit)).toEqual(expected)
  })

  it.each([
    // Any OTHER compound head is still left (pinned narrowing).
    ['9', 'GBP MRR per seat per month'],
    ['9', 'GBP per 1000 users per month'],
    ['9', 'CHF per seat per month'],
    ['-9', 'GBP per subscriber per month'],
    ['9', 'subscribers per seat per month'],
    ['9', '£k/month'],
  ])('%s %s → null (the caller prints what it printed before)', (figure, unit) => {
    expect(compactUnitParts(figure, unit)).toBeNull()
  })

  // ⭐ RE-PINNED 28 Sep 2026 on integration with #2231 (POM-9, currencyHeadParts):
  // a currency-led unit with NO rate, or with a slashed word rate, now takes its
  // glyph too ("£100,000 MRR", "£700 MRR/month" — the slashed word left as
  // written). Same rule as the rate arm: the code becomes its glyph, every other
  // word survives in order.
  it.each([
    ['100,000', 'GBP MRR', { figure: '£100,000', unit: 'MRR' }],
    ['700', 'GBP MRR/month', { figure: '£700', unit: 'MRR/month' }],
  ])('%s %s → the glyph on the figure (#2231)', (figure, unit, expected) => {
    expect(compactUnitParts(figure, unit)).toEqual(expected)
  })
})
