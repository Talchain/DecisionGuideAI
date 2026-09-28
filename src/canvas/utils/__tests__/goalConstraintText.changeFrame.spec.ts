/**
 * ⭐ R1 S4-core — A LIMIT STATED AS A CHANGE FROM TODAY IS SAID AS THE CHANGE (CEE #2261, `@talchain/schemas` 0.61.0
 * `GoalConstraint.value_frame`; merge condition 1 "reader first", #72 5879833520; Canvas claim 5879898641).
 *
 * CEE now writes "total monthly cloud cost must not rise more than 10% above today" as `{operator: '<=', value: 0.1,
 * value_frame: 'change_rel'}` — a FRACTION of today's level, with no unit. Before this reader the UI read no
 * `value_frame` anywhere, so every limit surface printed that row as a level: "≤ 0.1".
 *
 * The corpus is the PRODUCER'S, not ours: the constraint shape is CEE's own S4L fixture and the expected words are
 * CEE's `sayLimitInFrame` S4D-1 rows (`r1-s4-change-frame-limits.test.ts` @ `ec88e3a3`), so the card and the chat say
 * one sentence. Only the figure differs where the UI has its own money formatter ("£5,000" for CEE's "5000 GBP").
 */
import { describe, it, expect } from 'vitest'
import { goalConstraintShortText, goalConstraintText, limitChangeFrameOf } from '../goalConstraintText'
import { selectStatedLimits } from '../../../components/results/decision-overview/statedLimits'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const nodes = [
  { id: 'fac_cost', type: 'factor', data: { label: 'Total monthly cloud cost', kind: 'factor' } },
  { id: 'fac_churn', type: 'factor', data: { label: 'Monthly churn', kind: 'factor' } },
]

// CEE #2261 S4L fixture, verbatim: `{ constraint_id: 'c1', node_id: 'fac_cost', operator: '<=', value: 0.1, value_frame: 'change_rel' }`.
const rel = (operator: CEEGoalConstraint['operator'], value: number): CEEGoalConstraint =>
  ({ constraint_id: 'c1', node_id: 'fac_cost', operator, value, value_frame: 'change_rel' })
const abs = (operator: CEEGoalConstraint['operator'], value: number, unit: string, node_id = 'fac_cost'): CEEGoalConstraint =>
  ({ constraint_id: 'c2', node_id, operator, value, unit, value_frame: 'change_abs' })

describe('a change-framed limit is said as the change, in CEE\'s words (S4D-1 parity)', () => {
  it('RED: change_rel 0.1 under "<=" → "no more than 10% above today", never "≤ 0.1"', () => {
    const text = goalConstraintText(rel('<=', 0.1), nodes, { omitLabel: true })
    expect(text).toBe('no more than 10% above today')
    expect(text).not.toContain('0.1')
    expect(goalConstraintText(rel('<=', 0.1), nodes)).toBe('Total monthly cloud cost no more than 10% above today')
  })

  it('RED: a fall reads the comparator the other way round — "<=" −0.15 is "at least 15% below today"', () => {
    expect(goalConstraintText(rel('<=', -0.15), nodes, { omitLabel: true })).toBe('at least 15% below today')
  })

  it('RED: a floor on a rise — ">=" 0.05 → "at least 5% above today"', () => {
    expect(goalConstraintText(rel('>=', 0.05), nodes, { omitLabel: true })).toBe('at least 5% above today')
  })

  it('RED: change_abs keeps the quantity\'s unit through the UI\'s own figure formatter — "no more than £5,000 above today"', () => {
    expect(goalConstraintText(abs('<=', 5000, 'GBP'), nodes, { omitLabel: true })).toBe('no more than £5,000 above today')
  })

  it('RED: change_abs ">=" −2 points → "no more than 2 points below today"', () => {
    expect(goalConstraintText(abs('>=', -2, 'points', 'fac_churn'), nodes, { omitLabel: true })).toBe('no more than 2 points below today')
  })

  it('RED: the strict comparators keep their own words ("<" 0.1 → "less than 10% above today")', () => {
    expect(goalConstraintText({ ...rel('<=', 0.1), operator: '<' as never }, nodes, { omitLabel: true })).toBe('less than 10% above today')
    expect(goalConstraintText({ ...rel('<=', -0.2), operator: '>' as never }, nodes, { omitLabel: true })).toBe('less than 20% below today')
  })

  it('RED: provenance is never dropped — an inferred change limit still says so', () => {
    expect(goalConstraintText({ ...rel('<=', 0.1), provenance: 'inferred' }, nodes, { omitLabel: true }))
      .toBe('no more than 10% above today · Inferred limit')
  })

  it('RED: a label that already states a level is NOT shown alone for a change (it would read as the level)', () => {
    const labelled = { ...rel('<=', 0.1), label: 'Cloud cost <= 0.1' }
    expect(goalConstraintText(labelled, nodes)).toBe('Cloud cost <= 0.1 no more than 10% above today')
  })
})

describe('the resting pill\'s short form names the change and today', () => {
  it('RED: "Total monthly cloud cost ≤+10% vs today" — the level pill\'s shape with the change marked', () => {
    expect(goalConstraintShortText(rel('<=', 0.1), nodes)).toBe('Total monthly cloud cost ≤+10% vs today')
    expect(goalConstraintShortText(rel('<=', -0.15), nodes)).toBe('Total monthly cloud cost ≤−15% vs today')
    expect(goalConstraintShortText(abs('<=', 5000, 'GBP'), nodes)).toBe('Total monthly cloud cost ≤+£5,000 vs today')
  })
})

describe('the Analysis tab\'s stated limits stand down to the same sayer', () => {
  it('RED: selectStatedLimits never prints a change as "≤ 0.1"', () => {
    const [limit] = selectStatedLimits([{ ...rel('<=', 0.1), label: 'Total monthly cloud cost' }])
    expect(limit.text).toBe('Total monthly cloud cost ≤+10% vs today')
    expect(limit.text).not.toMatch(/≤ 0\.1\b/)
  })
})

describe('⛔ CONTRAST — a level is byte-identical, and so are an absent frame and legacy delta', () => {
  const level: CEEGoalConstraint = { constraint_id: 'c3', node_id: 'fac_cost', operator: '<=', value: 250000, unit: 'GBP' }
  const before = goalConstraintText(level, nodes)

  it('no frame, "level" and legacy "delta" print exactly what an unframed limit prints', () => {
    expect(before).toBe('Total monthly cloud cost ≤ £250,000')
    expect(goalConstraintText({ ...level, value_frame: 'level' }, nodes)).toBe(before)
    expect(goalConstraintText({ ...level, value_frame: 'delta' }, nodes)).toBe(before)
    expect(goalConstraintShortText({ ...level, value_frame: 'level' }, nodes)).toBe(goalConstraintShortText(level, nodes))
    expect(selectStatedLimits([{ ...level, value_frame: 'delta', label: 'Cost' }])[0].text).toBe('Cost ≤ £250,000')
  })

  it('limitChangeFrameOf answers only the two change frames; anything else is a level', () => {
    expect(limitChangeFrameOf(rel('<=', 0.1))).toBe('change_rel')
    expect(limitChangeFrameOf(abs('<=', 1, 'GBP'))).toBe('change_abs')
    for (const f of [undefined, 'level', 'delta', 'change', 'CHANGE_REL', 42]) {
      expect(limitChangeFrameOf({ ...level, value_frame: f as never }), String(f)).toBeNull()
    }
  })

  it('a change with no usable value or operator still says "limit not captured", never a direction', () => {
    expect(goalConstraintText({ ...rel('<=', 0.1), value: Number.NaN }, nodes, { omitLabel: true })).toBe('Limit not captured')
  })
})
