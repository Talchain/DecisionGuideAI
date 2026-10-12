/**
 * Recovery Batch C, #2747 Codex round 1: a goal TARGET row (`role: 'goal_target'`) is said through the limit path's own
 * order: the change first, with the comparator the user STATED; then the reader's audited figure; then their quoted
 * words. A change is never said as a level, and a percent figure with no audit is never reconstructed.
 *
 *   B1 a percent change whose source quote answers: never "Target: Cost at least 10%" (the change from today lost);
 *   B2 the shipped NRR row (1.1 for "above 110%"): never "at least 1.1%";
 *   B3 "< −20%" held as `<=`: "more than 20% below today", never "at least".
 * Each is paired with the same row WITHOUT the role (the limit path), which already said it right.
 */
import { describe, it, expect } from 'vitest'
import { goalConstraintText } from '../goalConstraintText'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const NODES = [{ id: 'cost', data: { label: 'Cost' } }, { id: 'out_nrr', data: { label: 'Net revenue retention' } }]
const target = (row: Record<string, unknown>) => ({ ...row, role: 'goal_target' }) as unknown as CEEGoalConstraint
const limit = (row: Record<string, unknown>) => row as unknown as CEEGoalConstraint

/** B1: CHECK-C-ui-r1's reproduction, with the brief's quote (the percent change has no audited figure). */
const COST_CHANGE = { constraint_id: 't:cost', node_id: 'cost', operator: '<=', value: -10, unit: '%', value_frame: 'change_abs', source_quote: 'cut cost by at least 10%' }
/** B2: the shipped `pricing-model` NRR row (goalConstraintText.normalisationAudit.spec.ts), and its audited twin. */
const NRR = { constraint_id: 'constraint_out_nrr_min', node_id: 'out_nrr', label: 'net revenue retention floor', operator: '>=', value: 1.1, unit: '%', source_quote: 'net revenue retention above 110%', provenance: 'explicit' }
const NRR_AUDITED = { ...NRR, provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 110, original_unit: '%' } }
/** B3: "cut cost by more than 20%", held as `<=` with the strict sense kept in `operator_as_stated`. */
const COST_STRICT = { constraint_id: 't:cost2', node_id: 'cost', operator: '<=', operator_as_stated: '<', value: -0.2, value_frame: 'change_rel' }

describe('#2747 r1: a goal target row is said as the limit path says it, as a target', () => {
  it('B1: a percent change whose quote answers keeps the change (the quote), never a level', () => {
    expect(goalConstraintText(target(COST_CHANGE), NODES)).toBe('Target: Cost · “cut cost by at least 10%”')
    expect(goalConstraintText(target(COST_CHANGE), NODES)).not.toMatch(/at least 10%$/)
    // CONTROL (limit path): the same row as a limit already quoted.
    expect(goalConstraintText(limit(COST_CHANGE), NODES)).toContain('“cut cost by at least 10%”')
    // With no quote the change itself is said, from today, in the goal quantity's own frame (C CEE 6e3bce10)...
    const { source_quote: _q, ...noQuote } = COST_CHANGE
    const costAs = (quantity_frame: string) => [{ id: 'cost', data: { label: 'Cost', quantity_frame } }]
    expect(goalConstraintText(target(noQuote), costAs('change'))).toBe('Target: Cost at least 10% below today')
    expect(goalConstraintText(target(noQuote), costAs('level'))).toBe('Target: Cost at least 10 percentage points below today')
    // ...and with no frame its size is not said (never a level, never a default).
    expect(goalConstraintText(target(noQuote), NODES)).toBe('Target not captured')
  })

  it('B2: the NRR row says the reader\'s figure: the audited 110%, else their quote; never 1.1%', () => {
    expect(goalConstraintText(target(NRR_AUDITED), NODES)).toBe('Target: Net revenue retention at least 110%')
    expect(goalConstraintText(target(NRR), NODES)).toBe('Target: Net revenue retention · “net revenue retention above 110%”')
    expect(goalConstraintText(target(NRR), NODES)).not.toContain('1.1%')
    // CONTROL (limit path, unchanged).
    expect(goalConstraintText(limit(NRR_AUDITED), NODES)).toContain('110%')
  })

  it('B3: a strict change keeps its sense: "more than 20% below today", target and limit alike', () => {
    expect(goalConstraintText(target(COST_STRICT), NODES)).toBe('Target: Cost more than 20% below today')
    expect(goalConstraintText(limit(COST_STRICT), NODES)).toBe('Cost more than 20% below today')
    // CONTROL: the inclusive twin still says "at least".
    const { operator_as_stated: _s, ...inclusive } = COST_STRICT
    expect(goalConstraintText(target(inclusive), NODES)).toBe('Target: Cost at least 20% below today')
  })
})
