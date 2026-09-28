/**
 * ⭐ A PERCENT-LED UNIT CARRIES THE SIGN ON THE FIGURE — "3% monthly churn", never "3 % monthly churn".
 *
 * Served a6200164 (28 Sep, Paul's pricing brief), the factor card on the canvas:
 * "Monthly churn rate · 3 % monthly churn est.". The producer's unit is `% monthly churn`.
 * `compactUnitParts` owned `% per month` (the rate arm: "3% / month") but declined a percent
 * token followed by words, so the card fell back to the figure and the whole unit as a word.
 *
 * Input class (360 served exports on disk): `% monthly churn` ×5, `% of Pro customers` ×2,
 * `% of qualified prospects per month` ×2, `% of working time` ×1; `% per month` ×28 and
 * `percent per month` ×11 are the rate arm's and stay as they were.
 *
 * ⛔ NOTATION ONLY: the figure's digits are never scaled (the plain-percent ×100 of UI-SEM-093
 * is not extended to compounds) and every word of the unit survives.
 */
import { describe, it, expect } from 'vitest'
import { compactUnitParts, formatMoneyFigure, joinCompactUnitParts } from '../unitClassifier'
import { factorDisplayParts } from '../formatFactorDisplayValue'

const read = (figure: string, unit: string) => {
  const parts = compactUnitParts(figure, unit)
  return parts === null ? null : joinCompactUnitParts(parts)
}

describe('compactUnitParts — a percent-led unit', () => {
  it.each([
    ['3', '% monthly churn', '3% monthly churn'],
    ['12', '% of Pro customers', '12% of Pro customers'],
    ['4.5', '% of qualified prospects per month', '4.5% of qualified prospects / month'],
    ['30', '% of working time', '30% of working time'],
    ['8', 'percent of revenue', '8% of revenue'],
  ])('%s %s → %s', (figure, unit, expected) => {
    expect(read(figure, unit)).toBe(expected)
  })

  it.each([
    // The rate arm's own shapes — unchanged.
    ['3', '% per month', '3% / month'],
    ['3', 'percent per month', '3% / month'],
    // Bare percent and word units — not compounds, left to their callers.
    ['3', '%', null],
    ['3', 'engineers', null],
    // A compound head after the percent is still left.
    ['3', '% of users per seat per month', null],
  ])('CONTROL %s %s → %s', (figure, unit, expected) => {
    expect(read(figure, unit)).toBe(expected)
  })

  it('CONTROL — a percent figure is never money', () => {
    expect(formatMoneyFigure(3, '% monthly churn')).toBeNull()
  })
})

describe('the factor card reads it the same way (its figure + unit split, FactorNode `valueParts`)', () => {
  const card = (unit: string) => {
    const parts = factorDisplayParts({ label: 'Monthly churn rate', observedState: { raw_value: 3, value: 0.03, unit } })
    return parts === null ? null : { figure: parts.figure, unit: parts.unit }
  }

  it('served: Monthly churn rate, raw 3, unit "% monthly churn" → "3%" + "monthly churn"', () => {
    expect(card('% monthly churn')).toEqual({ figure: '3%', unit: 'monthly churn' })
  })

  it('CONTROL — the rate arm on the card is unchanged ("3%" + "/ month")', () => {
    expect(card('% per month')).toEqual({ figure: '3%', unit: '/ month' })
  })
})
