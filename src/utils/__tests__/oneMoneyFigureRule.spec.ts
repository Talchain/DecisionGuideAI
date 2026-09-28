/**
 * ⭐ ONE MONEY-FIGURE RULE, through EVERY call site (DL #72 5870353946, ROOT: Product Experience).
 *
 * Served f0c8814f: one price edit read "£58.8 / month" (factor card), "£58.80 / month" (Reasoning tab) and
 * "49 GBP/month" (Olumi-tab receipt). The table below is the input class, not the served example, and each
 * row is run through the rule AND the three surfaces that call it; a money row must read the same on all.
 * Rows the rule declines (not money, or a shape the compound owner leaves alone) keep each site's old text.
 * The lock against a fifth formatter is `tests/ci-guards/oneMoneyFigureRule.spec.ts`.
 */
import { describe, expect, it } from 'vitest'
import { formatMoneyFigure } from '../unitClassifier'
import { buildV5PatchDeps, buildV5PatchReceipt, formatConstraintValue } from '../../v5/blocks/v5GraphPatchDescription'
import { formatThresholdFigure } from '../../components/results/analysisNew/thresholdFigure'
import { factorCardVisibleText, formatFactorDisplayParts, formatFactorDisplayValue } from '../formatFactorDisplayValue'

const card = (value: number, unit: string) => {
  const input = { label: 'Pro plan price', raw_value: value, value: 0.5, unit }
  return factorCardVisibleText(formatFactorDisplayValue(input), formatFactorDisplayParts(input))
}
const receipt = (value: number, unit: string) => formatConstraintValue(value, unit)
const threshold = (value: number, unit: string) => formatThresholdFigure(value.toLocaleString('en-GB'), value, unit)

/** Money: the rule's reading, identical on every surface. */
const MONEY: ReadonlyArray<[number, string, string]> = [
  [49, 'GBP/month', '£49 / month'],
  [58.8, 'GBP/month', '£58.80 / month'],
  [0.5, 'GBP/month', '£0.50 / month'],
  [49, 'GBP per month', '£49 / month'],
  [49, '£/month', '£49 / month'],
  [49, '£ per month', '£49 / month'],
  [1200, 'USD/year', '$1,200 / year'],
  [10, 'EUR per week', '€10 / week'],
  [1000, 'GBP MRR added per month', '£1,000 MRR added / month'],
  [50000, 'GBP', '£50,000'],
  [75000, '£', '£75,000'],
  [58.8, 'GBP', '£58.80'],
  [-500, 'GBP', '-£500'],
]

/** Declined by the rule: each surface keeps the text it printed before. */
const DECLINED: ReadonlyArray<[number, string, { card: string; receipt: string; threshold: string }]> = [
  [9800, 'GBP/subscriber/month', { card: '9,800 GBP/subscriber/month', receipt: '9,800 GBP/subscriber/month', threshold: '9,800 GBP/subscriber/month' }],
  [-5, 'GBP/month', { card: '-5 GBP/month', receipt: '-5 GBP/month', threshold: '-5 GBP/month' }],
  [1500, 'GBP per 12 months', { card: '1,500 GBP per 12 months', receipt: '1,500 GBP per 12 months', threshold: '1,500 GBP per 12 months' }],
  [1500, 'subscribers', { card: '1,500 subscribers', receipt: '1,500 subscribers', threshold: '1,500 subscribers' }],
  [12, 'months', { card: '12 months', receipt: '12 months', threshold: '12 months' }],
  [5, '%', { card: '5%', receipt: '5%', threshold: '5%' }],
  [3, 'hours/week', { card: '3 hours/week', receipt: '3 hours/week', threshold: '3 hours/week' }],
  [49, 'CHF', { card: 'CHF 49', receipt: '49 CHF', threshold: 'CHF 49' }],
]

describe('one money-figure rule', () => {
  it.each(MONEY)('⭐ %s %s → "%s" on the rule, the formatter\'s own string, the card, the receipt and the threshold', (value, unit, expected) => {
    expect(formatMoneyFigure(value, unit)).toBe(expected)
    // The formatter's OWN string (every consumer: strip, inspector, Model tab, export), not only the card's split.
    expect(formatFactorDisplayValue({ label: 'Pro plan price', raw_value: value, value: 0.5, unit })).toBe(expected)
    expect(card(value, unit)).toBe(expected)
    expect(receipt(value, unit)).toBe(expected)
    expect(threshold(value, unit)).toBe(expected)
  })

  it.each(DECLINED)('%s %s is not money the rule glyphs: every site keeps its text', (value, unit, sites) => {
    expect(formatMoneyFigure(value, unit)).toBeNull()
    expect(card(value, unit)).toBe(sites.card)
    expect(receipt(value, unit)).toBe(sites.receipt)
    expect(threshold(value, unit)).toBe(sites.threshold)
  })

  it('⭐ the served price edit\'s receipt: "£49 / month → £58.80 / month", no raw GBP', () => {
    const r = buildV5PatchReceipt(
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
    expect(r.changeSummary).toBe('£49 / month → £58.80 / month')
    expect(r.changeSummary).not.toMatch(/GBP/)
  })
})
