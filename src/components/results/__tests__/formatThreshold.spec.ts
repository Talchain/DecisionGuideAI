/**
 * formatThreshold — percent-unit scale honesty.
 *
 * Root cause regression (staging trust review): outcome values denormalised
 * into user units (×goal_threshold_cap) are legitimately small percentages
 * (−0.37% expected shift). The legacy probability-form auto-detect
 * (|v| ≤ 2 → ×100) inflated them 100× ("-37%") while OptionCards'
 * formatRangeValue showed the honest "-0.37" on the same screen.
 *
 * Contract after the fix:
 *  - isNormalised === false → the value IS a user-unit percentage; render
 *    as-is with OptionCards' magnitude-based precision (scale parity).
 *  - isNormalised === undefined → legacy auto-detect preserved (UI-SEM-059).
 *  - isNormalised === true → normalised shift form unchanged ("+13%").
 */
import { describe, it, expect } from 'vitest'
import { formatThreshold } from '../RangeVisualization'

describe('formatThreshold percent unit (denormalised user units)', () => {
  it('renders small user-unit percentages as-is — never ×100', () => {
    // Staging run values (mean × cap 25):
    expect(formatThreshold(-0.367, 'percent', undefined, false)).toBe('-0.37%')
    expect(formatThreshold(0.404, 'percent', undefined, false)).toBe('0.4%')
    expect(formatThreshold(-0.018, 'percent', undefined, false)).toBe('-0.02%')
    expect(formatThreshold(0.084, 'percent', undefined, false)).toBe('0.08%')
  })

  it('renders the raw goal threshold in user units (20 → "20%", never "2000%")', () => {
    expect(formatThreshold(20, 'percent', undefined, false)).toBe('20%')
  })

  it('uses OptionCards formatRangeValue precision tiers (scale parity, check A)', () => {
    // abs > 100 → 0 dp; abs > 10 → 1 dp; else 2 dp — identical tiers to
    // OptionCards.formatRangeValue so hero readouts and card range labels
    // agree in scale AND precision.
    expect(formatThreshold(123.46, 'percent', undefined, false)).toBe('123%')
    expect(formatThreshold(15.67, 'percent', undefined, false)).toBe('15.7%')
    expect(formatThreshold(6.39, 'percent', undefined, false)).toBe('6.39%')
    expect(formatThreshold(-6.93, 'percent', undefined, false)).toBe('-6.93%')
  })

  it('boundary values no longer flip scale across rows (1.9 vs 2.1)', () => {
    expect(formatThreshold(1.9, 'percent', undefined, false)).toBe('1.9%')
    expect(formatThreshold(2.1, 'percent', undefined, false)).toBe('2.1%')
  })

  it('legacy auto-detect preserved when isNormalised is not asserted (UI-SEM-059)', () => {
    expect(formatThreshold(0.8, 'percent', undefined, undefined)).toBe('80%')
    expect(formatThreshold(45, 'percent', undefined, undefined)).toBe('45%')
  })

  it('normalised shift form unchanged (isNormalised === true)', () => {
    expect(formatThreshold(0.13, 'percent', undefined, true)).toBe('+13%')
    expect(formatThreshold(-0.17, 'percent', undefined, true)).toBe('-17%')
  })

  it('currency and count paths unchanged', () => {
    expect(formatThreshold(800000, 'currency', '£', false)).toBe('£800,000')
    expect(formatThreshold(6.4, 'count', undefined, false)).toBe('6.4')
    expect(formatThreshold(1200, 'count', undefined, false)).toBe('1,200')
  })
})
