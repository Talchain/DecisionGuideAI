/**
 * Served 28 Sep 2026 (UI `ac2def0f`): "Pro plan price would have to rise from 58.8 GBP per month to
 * 59 GBP per month". One rule (`formatThresholdFigure`) now serves both threshold sites; it only
 * moves a CURRENCY to its glyph (the factor card's own reader), never converts or rescales.
 */
import { describe, expect, it } from 'vitest'

import { formatThresholdFigure } from '../thresholdFigure'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const fmt = (v: number, unit: string) =>
  formatThresholdFigure(v.toLocaleString('en-GB', { maximumFractionDigits: 2 }), v, unit)

describe('a threshold figure reads in the reader’s money — probe table', () => {
  it.each([
    // served shape
    [58.8, 'GBP per month', '£58.80 / month'],
    [59, 'GBP per month', '£59 / month'],
    // other money shapes
    [59, '£/month', '£59 / month'],
    [1500000, 'GBP', '£1,500,000'],
    [49.5, '£', '£49.50'],
    [12, 'USD per month', '$12 / month'],
    // NOT money: unchanged from applyUnitPlacement
    [3.5, '%', '3.5%'],
    [250, 'subscribers', '250 subscribers'],
    [250, 'subscribers per month', '250 subscribers per month'],
    [0.9, '', '0.9'],
    [58.8, 'GBP per subscriber per month', '58.8 GBP per subscriber per month'],
  ])('%s %s → %s', (v, unit, expected) => {
    expect(fmt(v as number, unit as string)).toBe(expected)
  })
})

describe('the Challenge row’s sentence, end to end', () => {
  it('⭐ the served row reads in pounds', () => {
    expect(COPY.disclosure.tippingPoint('Pro plan price', 58.8, 59, 'Keep £49 price', 'GBP per month')).toBe(
      'Pro plan price would have to rise from £58.80 / month to £59 / month before Keep £49 price leads in this model.',
    )
  })
})
