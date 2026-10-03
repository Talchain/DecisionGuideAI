/**
 * ⭐ A MONEY LIMIT SAYS ITS MONEY — the one money-figure rule, closed at the limit formatter.
 *
 * Served UI `d3a476b6` (28 Sep 2026, a fresh hiring journey): the brief said "must not go above £700k"; CEE
 * stored `{ value: 700000, unit: "GBP per year" }`, and the Reasoning tab's limit row read
 * "Annual engineering budget ≤ 700,000. Checked on this run." — the unit gone. `formatStatedLimitValue`
 * recognised a currency only as a bare glyph ('£'), so every compound money unit fell to a bare number.
 * The money-figure guard could not see it: it catches files that COMPOSE a glyph, not ones that drop one.
 *
 * Both limit formatters now ask the rule first (`formatMoneyFigure`, `src/utils/unitClassifier.ts`), so the
 * row, the Model tab's limit list and the goal pill say what the factor card says.
 */
import { describe, expect, it } from 'vitest'
import { formatStatedLimitValue, selectStatedLimits } from '../statedLimits'
import { goalConstraintShortText, goalConstraintText } from '../../../../canvas/utils/goalConstraintText'
import { formatMoneyFigure } from '../../../../utils/unitClassifier'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'

const SERVED_BUDGET = {
  constraint_id: 'agent-lane:annual_engineering_budget:<=',
  node_id: 'annual_engineering_budget',
  operator: '<=',
  value: 700000,
  label: 'Annual engineering budget',
  unit: 'GBP per year',
  provenance: 'explicit',
  value_frame: 'level',
} as unknown as CEEGoalConstraint

describe('a money limit says its money, as the rule says it', () => {
  it('PRECONDITION: the rule itself reads the served unit as "£700,000 / year"', () => {
    expect(formatMoneyFigure(700000, 'GBP per year')).toBe('£700,000 / year')
  })

  it('⭐ the Reasoning tab\'s limit row (selectStatedLimits) — was "≤ 700,000"', () => {
    expect(selectStatedLimits([SERVED_BUDGET])).toEqual([
      { id: 'agent-lane:annual_engineering_budget:<=', text: 'Annual engineering budget ≤ £700,000 / year' },
    ])
  })

  it('the value formatter, every money spelling', () => {
    for (const [unit, want] of [
      ['GBP per year', '£700,000 / year'],
      ['GBP', '£700,000'],
      ['£', '£700,000'],
      ['GBP/month', '£700,000 / month'],
      ['USD', '$700,000'],
    ] as const) {
      expect(formatStatedLimitValue(700000, unit), unit).toBe(want)
    }
  })

  it('the goal pill and the full sentence carry the same figure', () => {
    expect(goalConstraintShortText(SERVED_BUDGET)).toContain('£700,000 / year')
    expect(goalConstraintText(SERVED_BUDGET)).toContain('£700,000 / year')
  })

  it('CONTRAST: not money keeps its own path — % and a bare count are unchanged', () => {
    expect(formatStatedLimitValue(5, '%')).toBe('5%')
    expect(formatStatedLimitValue(12, 'headcount')).toBe('12')
  })
})
