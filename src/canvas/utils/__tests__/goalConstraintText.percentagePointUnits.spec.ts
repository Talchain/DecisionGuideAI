/**
 * Served 29 Sep 2026 (UI 020c0af4 × CEE 4caa358, brief "churn 3% today… must not rise by more than 1 percentage
 * point"): the goal pill read "Monthly churn ≤+1% points vs today" and the inspector "no more than 1% points above
 * today". The probe of the INPUT CLASS (every spelling of the unit) also printed "1 percentage_points" — snake_case
 * on the card. A change in percentage points is said in points; a level in percentage points is a percent.
 */
import { describe, expect, it } from 'vitest'
import { goalConstraintShortText, goalConstraintText, limitChangeSentence } from '../goalConstraintText'

const limit = (unit: string | null, value = 1, frame = 'change_abs', operator = '<=') =>
  ({ id: 'c', node_id: 'monthly_churn', label: 'Monthly churn', operator, value, value_frame: frame, unit }) as never

const PP_SPELLINGS = ['percentage points', 'percentage_points', 'percentage_point', 'percentage-points', 'Percentage Points', 'pp', 'PP', 'ppt', '% points', '%points']

describe('a CHANGE in percentage points, every spelling', () => {
  it.each(PP_SPELLINGS)('%s → "1 percentage point" / pill "+1pp"', (unit) => {
    expect(limitChangeSentence(limit(unit))).toBe('no more than 1 percentage point above today')
    expect(goalConstraintText(limit(unit))).toBe('Monthly churn no more than 1 percentage point above today')
    expect(goalConstraintShortText(limit(unit))).toBe('Monthly churn ≤+1pp vs today')
  })

  it('plural and falling: 2 points below today', () => {
    expect(limitChangeSentence(limit('percentage points', -2, 'change_abs', '>='))).toBe('no more than 2 percentage points below today')
    expect(goalConstraintShortText(limit('percentage points', -2, 'change_abs', '>='))).toBe('Monthly churn ≥−2pp vs today')
  })
})

describe('CONTRASTS — not a percentage-point unit', () => {
  it('a percent change stays a percent', () => {
    expect(limitChangeSentence(limit('%'))).toBe('no more than 1% above today')
    expect(goalConstraintShortText(limit('%'))).toBe('Monthly churn ≤+1% vs today')
  })
  it('bare "points" may be a score, so it is not rewritten', () => {
    expect(limitChangeSentence(limit('points'))).not.toContain('percentage point')
  })
  it('a relative change is untouched by the unit', () => {
    expect(limitChangeSentence(limit('percentage points', 0.1, 'change_rel'))).toBe('no more than 10% above today')
  })
})

describe('a LEVEL in percentage points reads as a percent', () => {
  it.each(['percentage points', 'percentage_points', 'pp'])('%s level 4 → "4%"', (unit) => {
    const text = goalConstraintShortText(limit(unit, 4, 'level'))
    expect(text).toContain('4%')
    expect(text).not.toMatch(/percentage|_|pp/)
  })
})

/**
 * Served 29 Sep 2026 (UI 947dded7 × CEE 0b7d254, brief "…without hurting service reliability"): CEE stored a
 * zero change, and the pill read "Service reliability ≥+0pp vs today" / "at least 0 percentage points above today".
 * A change of exactly zero is said against today.
 */
describe('a ZERO change is said against today, never "+0"', () => {
  it.each([
    ['>=', 'no lower than today', '≥ today'],
    ['<=', 'no higher than today', '≤ today'],
    ['>', 'higher than today', '> today'],
    ['<', 'lower than today', '< today'],
  ])('%s 0 → "%s" / pill "%s"', (operator, sentence, pill) => {
    for (const unit of ['percentage points', '%', 'GBP', null]) {
      expect(limitChangeSentence(limit(unit, 0, 'change_abs', operator))).toBe(sentence)
      expect(goalConstraintShortText(limit(unit, 0, 'change_abs', operator))).toBe(`Monthly churn ${pill}`)
    }
    expect(limitChangeSentence(limit(null, 0, 'change_rel', operator))).toBe(sentence)
  })

  it('CONTRAST: a non-zero change keeps its figure', () => {
    expect(goalConstraintShortText(limit('percentage points', 0.5, 'change_abs', '>='))).toBe('Monthly churn ≥+0.5pp vs today')
  })
})
