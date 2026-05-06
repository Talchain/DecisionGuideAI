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
  it('formats GBP currency with thousands separator', () => {
    expect(formatConstraintValue(50000, 'GBP')).toBe('£50,000')
  })
  it('formats USD currency with thousands separator', () => {
    expect(formatConstraintValue(1500000, 'USD')).toBe('$1,500,000')
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
    expect(r.changeSummary).toBe('≤ £50,000')
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
    expect(r.changeSummary).toBe('≤ £30,000 → ≤ £50,000')
    expectNoLeak(r.changeSummary)
  })

  it('handles non-currency unit', () => {
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'team size', value: 30, unit: 'FTE', operator: 'gte' },
      }),
      makeDeps(),
    )
    expect(r.changeSummary).toBe('≥ 30 FTE')
  })

  it('handles symbolic operator', () => {
    const r = buildV5PatchReceipt(
      block({
        after: { label: 'budget', value: 50000, unit: 'GBP', operator: '<=' },
      }),
      makeDeps(),
    )
    expect(r.changeSummary).toBe('≤ £50,000')
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
