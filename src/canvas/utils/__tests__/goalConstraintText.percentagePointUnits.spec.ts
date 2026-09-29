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
