/**
 * Typed chip-parameter builders — unit pins.
 *
 * The producer's half of the S2 typed-mutation contract: these builders MUST
 * emit the exact `chip.parameters` shape CEE's readers accept (field names +
 * genuinely-typed finite numbers), and MUST refuse (never coerce/default) a bad
 * value. Field names are matched against the CEE-side shape authorities at
 * staging tip `e7f312d`:
 *   set_factor_value / adjust_edge_strength / add_constraint
 *     → routing/typed-chip-mutation-proposal.ts
 *   add_option → routing/add-option-transaction.ts
 */
import { describe, it, expect } from 'vitest'
import {
  buildSetFactorValueParameters,
  buildAdjustEdgeStrengthParameters,
  buildAddConstraintParameters,
  buildAddOptionParameters,
  MAX_ADD_OPTION_INTERVENTIONS,
  ADD_OPTION_INTENT,
  type ChipParametersResult,
} from '../chipParameters'

/** Narrow the result union to its failure reason (or a sentinel on ok). */
function reasonOf(r: ChipParametersResult<unknown>): string {
  return r.ok ? '<<ok>>' : r.reason
}

describe('buildSetFactorValueParameters', () => {
  it('emits the CEE field names with a genuine finite number', () => {
    const r = buildSetFactorValueParameters({ targetId: 'factor_price', value: 140 })
    expect(r).toEqual({ ok: true, parameters: { target_id: 'factor_price', value: 140 } })
    // The value is a real number on the emitted object — never a string.
    if (r.ok) expect(typeof r.parameters.value).toBe('number')
  })

  it('carries unit + operator only when provided', () => {
    const r = buildSetFactorValueParameters({
      targetId: 'factor_price',
      value: 12.5,
      unit: '£',
      operator: 'increase',
    })
    expect(r).toEqual({
      ok: true,
      parameters: { target_id: 'factor_price', value: 12.5, unit: '£', operator: 'increase' },
    })
  })

  it('refuses NaN / Infinity (never a silent commit)', () => {
    expect(reasonOf(buildSetFactorValueParameters({ targetId: 'f', value: NaN }))).toBe(
      'value_not_finite',
    )
    expect(reasonOf(buildSetFactorValueParameters({ targetId: 'f', value: Infinity }))).toBe(
      'value_not_finite',
    )
    expect(buildSetFactorValueParameters({ targetId: 'f', value: -Infinity })).toEqual({
      ok: false,
      reason: 'value_not_finite',
    })
  })

  it('refuses an empty target id and an unknown operator', () => {
    expect(reasonOf(buildSetFactorValueParameters({ targetId: '', value: 1 }))).toBe(
      'target_id_required',
    )
    expect(
      reasonOf(
        // @ts-expect-error — an off-vocabulary operator must not typecheck OR pass
        buildSetFactorValueParameters({ targetId: 'f', value: 1, operator: 'toggle' }),
      ),
    ).toBe('operator_invalid')
  })
})

describe('buildAdjustEdgeStrengthParameters', () => {
  it('accepts a composed edge id and a finite strength in range', () => {
    const r = buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 0.4 })
    expect(r).toEqual({ ok: true, parameters: { target_id: 'a→b', value: 0.4 } })
  })

  it('accepts an explicit endpoint pair and never emits both target_id and from/to', () => {
    const r = buildAdjustEdgeStrengthParameters({ from: 'a', to: 'b', value: -0.2, std: 0.1 })
    expect(r).toEqual({ ok: true, parameters: { from: 'a', to: 'b', value: -0.2, std: 0.1 } })
    if (r.ok) expect('target_id' in r.parameters).toBe(false)
  })

  it('refuses when no target is identified', () => {
    expect(reasonOf(buildAdjustEdgeStrengthParameters({ value: 0.5 }))).toBe('edge_target_required')
    expect(reasonOf(buildAdjustEdgeStrengthParameters({ from: 'a', value: 0.5 }))).toBe(
      'edge_target_required',
    )
  })

  it('enforces the CEE ranges: value ∈ [-1,1], std ∈ (0,0.5]', () => {
    expect(reasonOf(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 1.5 }))).toBe(
      'value_out_of_range',
    )
    expect(
      reasonOf(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 0.5, std: 0 })),
    ).toBe('std_out_of_range')
    expect(
      reasonOf(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 0.5, std: 0.6 })),
    ).toBe('std_out_of_range')
    // Boundaries: value ±1 allowed, std 0.5 allowed.
    expect(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 1, std: 0.5 }).ok).toBe(true)
    expect(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: -1 }).ok).toBe(true)
  })

  it('refuses non-finite value / std', () => {
    expect(reasonOf(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: NaN }))).toBe(
      'value_not_finite',
    )
    expect(
      reasonOf(buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 0.5, std: Infinity })),
    ).toBe('std_not_finite')
  })
})

describe('buildAddConstraintParameters', () => {
  it('emits target_id + constraint_type + finite value', () => {
    const r = buildAddConstraintParameters({
      targetId: 'goal_1',
      constraintType: 'at_least',
      value: 0.15,
    })
    expect(r).toEqual({
      ok: true,
      parameters: { target_id: 'goal_1', constraint_type: 'at_least', value: 0.15 },
    })
  })

  it('carries label + unit only when provided', () => {
    const r = buildAddConstraintParameters({
      targetId: 'goal_1',
      constraintType: 'at_most',
      value: 100000,
      label: 'Budget ceiling',
      unit: '£',
    })
    expect(r).toEqual({
      ok: true,
      parameters: {
        target_id: 'goal_1',
        constraint_type: 'at_most',
        value: 100000,
        label: 'Budget ceiling',
        unit: '£',
      },
    })
  })

  it('refuses non-finite value and an invalid direction', () => {
    expect(
      reasonOf(buildAddConstraintParameters({ targetId: 'g', constraintType: 'at_least', value: NaN })),
    ).toBe('value_not_finite')
    expect(
      reasonOf(
        buildAddConstraintParameters({
          targetId: 'g',
          // @ts-expect-error — only at_least / at_most are valid
          constraintType: 'exactly',
          value: 1,
        }),
      ),
    ).toBe('constraint_type_invalid')
  })
})

describe('buildAddOptionParameters', () => {
  it('emits parent + label + typed interventions with CEE field names', () => {
    const r = buildAddOptionParameters({
      parentDecisionId: 'decision_1',
      label: 'Hybrid plan',
      interventions: [
        { factorId: 'factor_price', value: 49 },
        { factorId: 'factor_support', value: 2, unit: 'FTE', rawValue: 'two' },
      ],
    })
    expect(r).toEqual({
      ok: true,
      parameters: {
        parent_decision_id: 'decision_1',
        label: 'Hybrid plan',
        interventions: [
          { factor_id: 'factor_price', value: 49 },
          { factor_id: 'factor_support', value: 2, unit: 'FTE', raw_value: 'two' },
        ],
      },
    })
  })

  it('rides intent add_option (not an action_type)', () => {
    expect(ADD_OPTION_INTENT).toBe('add_option')
  })

  it('carries option_id only when provided and defaults interventions to empty', () => {
    const r = buildAddOptionParameters({
      parentDecisionId: 'decision_1',
      label: 'Bare option',
      optionId: 'opt_bare',
      interventions: [],
    })
    expect(r).toEqual({
      ok: true,
      parameters: {
        parent_decision_id: 'decision_1',
        label: 'Bare option',
        option_id: 'opt_bare',
        interventions: [],
      },
    })
  })

  it('caps at 6 interventions (PROPOSAL_CAP=8, ops = N+2)', () => {
    const iv = (i: number) => ({ factorId: `f${i}`, value: i })
    const ok6 = buildAddOptionParameters({
      parentDecisionId: 'd',
      label: 'L',
      interventions: [0, 1, 2, 3, 4, 5].map(iv),
    })
    expect(ok6.ok).toBe(true)
    expect(MAX_ADD_OPTION_INTERVENTIONS).toBe(6)
    const over = buildAddOptionParameters({
      parentDecisionId: 'd',
      label: 'L',
      interventions: [0, 1, 2, 3, 4, 5, 6].map(iv),
    })
    expect(over).toEqual({ ok: false, reason: 'too_many_interventions' })
  })

  it('refuses a duplicate factor and a non-finite intervention value', () => {
    expect(
      reasonOf(
        buildAddOptionParameters({
          parentDecisionId: 'd',
          label: 'L',
          interventions: [
            { factorId: 'f1', value: 1 },
            { factorId: 'f1', value: 2 },
          ],
        }),
      ),
    ).toBe('duplicate_factor')
    expect(
      reasonOf(
        buildAddOptionParameters({
          parentDecisionId: 'd',
          label: 'L',
          interventions: [{ factorId: 'f1', value: NaN }],
        }),
      ),
    ).toBe('value_not_finite')
  })
})
