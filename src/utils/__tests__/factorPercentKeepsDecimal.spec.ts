/**
 * ⛔ WebMCP finding #75 5907516955 (scenario `815ae68b`, Paul's MRR brief): the user's 3.7% monthly churn
 * (`raw_value 3.7`, `unit %`, `brief_extraction`) printed "4%" on the factor card — the brief's churn LIMIT — so the
 * card read as if churn were already at the limit. The values are the served read's.
 */
import { describe, it, expect } from 'vitest'
import { factorDisplayText, percentFigure } from '../formatFactorDisplayValue'

describe('a factor percent keeps its decimal', () => {
  it('RED: the served 3.7% churn reads "3.7%", never "4%"', () => {
    expect(factorDisplayText({ label: 'Monthly churn', observedState: { raw_value: 3.7, unit: '%', value: 0.037, source: 'brief_extraction' } })).toBe('3.7%')
  })
  it('the one rule: one decimal when the value has one, none when whole; the 0–1 ratio scaling is unchanged', () => {
    expect(percentFigure(3.7)).toBe('3.7%')
    expect(percentFigure(25)).toBe('25%')
    expect(percentFigure(4)).toBe('4%')
    expect(percentFigure(12.34)).toBe('12.3%')
    expect(percentFigure(0.25 * 100)).toBe('25%')
    expect(factorDisplayText({ label: 'Share', observedState: { raw_value: 0.25, unit: '%' } })).toBe('25%')
  })
})
