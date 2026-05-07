/**
 * Unit tests for buildV5PatchReceipt — Workstream 1, Journey 3 / Journey 6.
 *
 * Acceptance: receipt MUST NOT contain raw IDs, schema field names,
 * operator codes, or before/after JSON keys. Friendly entity labels
 * resolve from the canvas store; generic fallback derives from id
 * prefix; never the raw target_id.
 */

import { describe, it, expect } from 'vitest'

import type { V5GraphPatchBlock } from '../../../canvas/conversation/types'
import { RAW_ID_PATTERN } from '../../../canvas/conversation/friendlyOperation'
import {
  buildV5PatchReceipt,
  buildV5PatchDeps,
  formatConstraintValue,
} from '../v5GraphPatchDescription'

const FORBIDDEN_TERMS = [
  'target_id',
  'operator',
  'noop',
  'fact_type',
  'graph_hash',
  'set_factor_value',
  'add_constraint',
  'adjust_edge_strength',
]

function expectNoLeak(text: string): void {
  expect(text).not.toMatch(RAW_ID_PATTERN)
  for (const term of FORBIDDEN_TERMS) {
    expect(text.toLowerCase()).not.toContain(term)
  }
}

function makeDeps(
  nodes: Array<{ id: string; label?: string }> = [],
  edges: Array<{ id: string; source: string; target: string }> = [],
) {
  return buildV5PatchDeps(
    nodes.map((n) => ({ id: n.id, data: { label: n.label } })),
    edges,
  )
}

describe('formatConstraintValue', () => {
  it('formats GBP currency code with thousands separator', () => {
    expect(formatConstraintValue(50000, 'GBP')).toBe('£50,000')
  })
  it('formats £ currency symbol with thousands separator (CEE add-constraint emits the symbol)', () => {
    // P1.3 regression guard: CEE add-constraint passes the user-supplied
    // unit symbol verbatim (see add-constraint.ts:239–246). The receipt
    // must render `£50,000`, not `50,000 £`.
    expect(formatConstraintValue(50000, '£')).toBe('£50,000')
  })
  it('formats $ currency symbol with thousands separator', () => {
    expect(formatConstraintValue(1500000, '$')).toBe('$1,500,000')
  })
  it('formats € currency symbol with thousands separator', () => {
    expect(formatConstraintValue(2500, '€')).toBe('€2,500')
  })
  it('formats USD currency code with thousands separator', () => {
    expect(formatConstraintValue(1500000, 'USD')).toBe('$1,500,000')
  })
  it('formats percent unit without space', () => {
    expect(formatConstraintValue(5, '%')).toBe('5%')
  })
  it('formats percent unit case-insensitively (NR2)', () => {
    // CEE currently only emits '%', but the formatter should treat
    // 'percent' / 'Percent' / 'PERCENT' identically so a future CEE
    // refactor that switches to a word form does not silently render
    // `5 Percent` instead of `5%`.
    expect(formatConstraintValue(5, 'percent')).toBe('5%')
    expect(formatConstraintValue(5, 'Percent')).toBe('5%')
    expect(formatConstraintValue(5, 'PERCENT')).toBe('5%')
  })
  it('formats unitless number with thousands separator', () => {
    expect(formatConstraintValue(50000)).toBe('50,000')
  })
  it('formats other units with suffix', () => {
    expect(formatConstraintValue(30, 'FTE')).toBe('30 FTE')
  })
  it('returns em-dash for non-finite values', () => {
    expect(formatConstraintValue(NaN, 'GBP')).toBe('—')
    expect(formatConstraintValue(null)).toBe('—')
  })
})

describe('buildV5PatchReceipt — set_factor_value', () => {
  function block(
    overrides: Partial<V5GraphPatchBlock> = {},
  ): V5GraphPatchBlock {
    return {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_team_morale',
      before: { value: 0.5 },
      after: { value: 0.7 },
      ...overrides,
    }
  }

  it('uses canvas-store label when present and shows numeric diff', () => {
    const deps = makeDeps([{ id: 'fac_team_morale', label: 'team morale' }])
    const r = buildV5PatchReceipt(block(), deps)
    expect(r.actionLabel).toBe('Updated factor')
    expect(r.entityLabel).toBe('team morale')
    expect(r.changeSummary).toBe('0.5 → 0.7')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('falls back to element-type word when canvas store has no label', () => {
    const deps = makeDeps()
    const r = buildV5PatchReceipt(block(), deps)
    expect(r.entityLabel).toBe('factor')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('rejects raw-id-shaped labels at resolution boundary', () => {
    // If the canvas store somehow holds an unfriendly id-shaped label,
    // RAW_ID_PATTERN catches it and the resolver falls back to the
    // generic element type — never leaking the id-shaped string.
    const deps = makeDeps([{ id: 'fac_team_morale', label: 'fac_team_morale' }])
    const r = buildV5PatchReceipt(block(), deps)
    expect(r.entityLabel).toBe('factor')
    expectNoLeak(r.entityLabel)
  })

  it('shows after value alone when before == after', () => {
    const deps = makeDeps([{ id: 'fac_team_morale', label: 'team morale' }])
    const r = buildV5PatchReceipt(
      block({ before: { value: 0.7 }, after: { value: 0.7 } }),
      deps,
    )
    expect(r.changeSummary).toBe('0.7')
  })

  it('noop status shows the no-change action label and no summary', () => {
    const deps = makeDeps([{ id: 'fac_team_morale', label: 'team morale' }])
    const r = buildV5PatchReceipt(
      block({ status: 'noop', before: { value: 0.7 }, after: { value: 0.7 } }),
      deps,
    )
    expect(r.actionLabel).toBe('Factor already at this value')
    expect(r.changeSummary).toBe('')
    expect(r.status).toBe('noop')
  })

  // ── P1.2 regression guard ─────────────────────────────────────────────
  // CEE set_factor_value emits an ObservedSnapshot with both normalised
  // `value` (e.g. 0.05) AND user-facing `raw_value` + `unit` (e.g. 5
  // and '%') — see set-factor-value.ts:263. The receipt MUST render the
  // user-facing pair; falling back to `value` would surface raw
  // normalised decimals like `0.04 → 0.05` instead of `4% → 5%`.
  it('renders raw_value + unit when CEE includes them (percent factor)', () => {
    const deps = makeDeps([{ id: 'f-churn', label: 'Customer churn' }])
    const r = buildV5PatchReceipt(
      {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'f-churn',
        before: { value: 0.04, raw_value: 4, unit: '%', cap: 100 },
        after: { value: 0.05, raw_value: 5, unit: '%', cap: 100 },
      },
      deps,
    )
    expect(r.entityLabel).toBe('Customer churn')
    expect(r.changeSummary).toBe('4% → 5%')
    // Critical: never the normalised decimals.
    expect(r.changeSummary).not.toContain('0.04')
    expect(r.changeSummary).not.toContain('0.05')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('renders raw_value + unit when CEE includes them (currency factor)', () => {
    const deps = makeDeps([{ id: 'f-budget', label: 'Marketing budget' }])
    const r = buildV5PatchReceipt(
      {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'f-budget',
        before: { value: 0.4, raw_value: 40000, unit: '£', cap: 100000 },
        after: { value: 0.5, raw_value: 50000, unit: '£', cap: 100000 },
      },
      deps,
    )
    expect(r.entityLabel).toBe('Marketing budget')
    expect(r.changeSummary).toBe('£40,000 → £50,000')
    // Critical: never the normalised decimals or trailing-symbol form.
    // Trailing-symbol regex: digit-space-pound (the bug we're guarding
    // against). The arrow separator ' → £' must not match — it has a
    // non-digit between.
    expect(r.changeSummary).not.toContain('0.4')
    expect(r.changeSummary).not.toContain('0.5')
    expect(r.changeSummary).not.toMatch(/\d £/)
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('falls back to value when raw_value is absent (legacy / partial blocks)', () => {
    // Defensive: a CEE block missing raw_value should still produce a
    // sensible receipt, not a blank line.
    const deps = makeDeps([{ id: 'fac_team_morale', label: 'team morale' }])
    const r = buildV5PatchReceipt(
      {
        type: 'v5_graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'fac_team_morale',
        before: { value: 0.5 },
        after: { value: 0.7 },
      },
      deps,
    )
    expect(r.changeSummary).toBe('0.5 → 0.7')
  })
})

describe('buildV5PatchReceipt — add_constraint', () => {
  function block(
    overrides: Partial<V5GraphPatchBlock> = {},
  ): V5GraphPatchBlock {
    return {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'add_constraint',
      target_id: 'con_budget',
      before: null,
      after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
      ...overrides,
    }
  }

  it('renders new constraint with currency and operator glyph', () => {
    const r = buildV5PatchReceipt(block(), makeDeps())
    expect(r.actionLabel).toBe('Added constraint')
    expect(r.entityLabel).toBe('budget')
    expect(r.changeSummary).toBe('at most £50,000')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('renders updated constraint with before → after', () => {
    const r = buildV5PatchReceipt(
      block({
        before: { value: 30000, unit: 'GBP', operator: 'lte' },
        after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
      }),
      makeDeps(),
    )
    expect(r.changeSummary).toBe('at most £30,000 → at most £50,000')
    expectNoLeak(r.changeSummary)
  })

  it('handles non-currency unit', () => {
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'team size', value: 30, unit: 'FTE', operator: 'gte' },
      }),
      makeDeps(),
    )
    expect(r.changeSummary).toBe('at least 30 FTE')
  })

  it('handles symbolic operator', () => {
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'budget', value: 50000, unit: 'GBP', operator: '<=' },
      }),
      makeDeps(),
    )
    expect(r.changeSummary).toBe('at most £50,000')
  })

  it('renders symbol-form unit (CEE add-constraint shape) without trailing-symbol leak', () => {
    // P1.3 regression guard at the receipt level. CEE add-constraint
    // forwards user-supplied unit symbols (e.g. '£') verbatim and the
    // operator as the symbol form ('<=' from TYPE_TO_OPERATOR). Prior
    // bug rendered `50,000 £` because formatConstraintValue only knew
    // ISO codes.
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'Marketing budget', value: 50000, unit: '£', operator: '<=' },
      }),
      makeDeps(),
    )
    expect(r.entityLabel).toBe('Marketing budget')
    expect(r.changeSummary).toBe('at most £50,000')
    // Digit-space-pound (the bug). The legitimate '≤ £' is non-digit
    // before the space so does not match.
    expect(r.changeSummary).not.toMatch(/\d £/)
  })

  it('drops unfriendly label that looks like an id', () => {
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'con_budget', value: 50000, unit: 'GBP', operator: 'lte' },
      }),
      makeDeps(),
    )
    expect(r.entityLabel).toBe('')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('noop status shows constraint-already-in-place label', () => {
    const r = buildV5PatchReceipt(
      block({
        status: 'noop',
        before: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
        after: { label: 'budget', value: 50000, unit: 'GBP', operator: 'lte' },
      }),
      makeDeps(),
    )
    expect(r.actionLabel).toBe('Constraint already in place')
    expect(r.status).toBe('noop')
  })
})

describe('buildV5PatchReceipt — adjust_edge_strength', () => {
  function block(
    overrides: Partial<V5GraphPatchBlock> = {},
  ): V5GraphPatchBlock {
    return {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'edge_morale_to_outcome',
      before: { strength: 0.3 },
      after: { strength: 0.6 },
      ...overrides,
    }
  }

  it('renders edge as "from → to" when endpoints resolve', () => {
    const deps = makeDeps(
      [
        { id: 'fac_morale', label: 'team morale' },
        { id: 'goal_outcome', label: 'outcome' },
      ],
      [
        {
          id: 'edge_morale_to_outcome',
          source: 'fac_morale',
          target: 'goal_outcome',
        },
      ],
    )
    const r = buildV5PatchReceipt(block(), deps)
    expect(r.actionLabel).toBe('Adjusted connection')
    expect(r.entityLabel).toBe('team morale → outcome')
    expect(r.changeSummary).toBe('0.3 → 0.6')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })

  it('emits empty entityLabel when endpoints unresolved (no leak)', () => {
    const r = buildV5PatchReceipt(block(), makeDeps())
    expect(r.entityLabel).toBe('')
    expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
  })
})

describe('buildV5PatchReceipt — invariants', () => {
  it('never leaks raw target_id for any operation', () => {
    const ops: V5GraphPatchBlock['operation'][] = [
      'set_factor_value',
      'add_constraint',
      'adjust_edge_strength',
    ]
    for (const op of ops) {
      const r = buildV5PatchReceipt(
        {
          type: 'v5_graph_patch',
          status: 'applied',
          operation: op,
          target_id: `${op === 'add_constraint' ? 'con' : op === 'adjust_edge_strength' ? 'edge' : 'fac'}_obvious_leak_target`,
          before: null,
          after: null,
        } as V5GraphPatchBlock,
        makeDeps(),
      )
      expectNoLeak(`${r.actionLabel} ${r.entityLabel} ${r.changeSummary}`)
    }
  })
})
