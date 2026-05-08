/**
 * Tests for friendlyOperation.ts — the 4-tier label resolution chain and
 * describeOperation markdown rendering. Pins the existing behaviour so
 * Task 3 of the 2026-04-09 fix brief is regression-guarded.
 *
 * Priority chain (per resolveNodeLabel):
 *   1. proposalItem.elementLabel  (CEE-provided payload label)
 *   2. op.data.label              (label carried on add_node operation data)
 *   3. relatedElements lookup     (CEE-provided related_elements array)
 *   4. deps.nodeLabels            (memoised canvas store read)
 *   5. GENERIC_BY_OP fallback     (human text — never the raw ID)
 *
 * Load-bearing guarantee: raw entity IDs (fac_..., opt_..., goal_...)
 * must NEVER appear in the rendered output. Every tier check rejects
 * labels that match RAW_ID_PATTERN.
 */

import { describe, it, expect } from 'vitest'
import { describeOperation, RAW_ID_PATTERN, friendlyFieldName, firstChangedKey } from '../friendlyOperation'
import type { PatchOperation } from '../types'
import type { DescribeOpDeps } from '../friendlyOperation'

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<DescribeOpDeps> = {}): DescribeOpDeps {
  return {
    proposalItem: undefined,
    relatedElements: undefined,
    nodeLabels: new Map(),
    edgeEndpoints: new Map(),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Label resolution — priority chain
// ─────────────────────────────────────────────────────────────────────────

describe('describeOperation — add_node label resolution (4-tier chain)', () => {
  const op: PatchOperation = {
    op: 'add_node',
    target_id: 'fac_market_growth',
    data: { kind: 'factor', label: 'Market Growth' },
  }

  it('tier 1: uses proposalItem.elementLabel when present', () => {
    const deps = makeDeps({
      proposalItem: { description: '', elementLabel: 'CEE-label' },
    })
    // Tier 1 wins over tier 2 (op.data.label).
    expect(describeOperation(op, deps)).toBe('Add **CEE-label** (factor)')
  })

  it('tier 2: falls back to op.data.label when proposalItem has no elementLabel', () => {
    // This is the Task 3 critical path: a NEW node added by a pending
    // patch isn't on the canvas yet (tier 4 has no entry) and the CEE
    // payload may omit elementLabel — op.data.label must resolve the name.
    const deps = makeDeps()
    expect(describeOperation(op, deps)).toBe('Add **Market Growth** (factor)')
  })

  it('tier 3: falls back to relatedElements lookup', () => {
    // op with no data.label
    const opNoLabel: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_market_growth',
      data: { kind: 'factor' },
    }
    const deps = makeDeps({
      relatedElements: [{ node_id: 'fac_market_growth', label: 'Related-label' }],
    })
    expect(describeOperation(opNoLabel, deps)).toBe('Add **Related-label** (factor)')
  })

  it('tier 4: falls back to canvas store nodeLabels', () => {
    const opNoLabel: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_market_growth',
      data: { kind: 'factor' },
    }
    const deps = makeDeps({
      nodeLabels: new Map([['fac_market_growth', 'Store-label']]),
    })
    expect(describeOperation(opNoLabel, deps)).toBe('Add **Store-label** (factor)')
  })

  it('tier 5: generic fallback when no label anywhere — never emits raw ID', () => {
    const opNoLabel: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_market_growth',
      data: { kind: 'factor' },
    }
    const deps = makeDeps()
    const result = describeOperation(opNoLabel, deps)
    expect(result).toBe('Add factor')
    expect(result).not.toMatch(RAW_ID_PATTERN)
  })
})

describe('describeOperation — tier rejection of raw-ID labels', () => {
  it('rejects proposalItem.elementLabel that contains a raw ID', () => {
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_x',
      data: { kind: 'factor', label: 'Good Label' },
    }
    const deps = makeDeps({
      proposalItem: { description: '', elementLabel: 'fac_something_raw' },
    })
    // Tier 1 rejected (raw ID), tier 2 wins.
    expect(describeOperation(op, deps)).toBe('Add **Good Label** (factor)')
  })

  it('rejects op.data.label that contains a raw ID', () => {
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_x',
      data: { kind: 'factor', label: 'opt_something' },
    }
    const deps = makeDeps({
      relatedElements: [{ node_id: 'fac_x', label: 'Related' }],
    })
    // Tier 2 rejected (raw ID in label), tier 3 wins.
    expect(describeOperation(op, deps)).toBe('Add **Related** (factor)')
  })

  it('rejects nodeLabels entry that contains a raw ID', () => {
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_x',
      data: { kind: 'factor' },
    }
    const deps = makeDeps({
      nodeLabels: new Map([['fac_x', 'fac_raw_leak']]),
    })
    // Tier 4 rejected (raw ID), falls to generic.
    expect(describeOperation(op, deps)).toBe('Add factor')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// describeOperation — per-op rendering
// ─────────────────────────────────────────────────────────────────────────

describe('describeOperation — add_node', () => {
  it('renders "Add **Label** (kind)" when kind present', () => {
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'opt_contractor',
      data: { kind: 'option', label: 'Hire a Contractor' },
    }
    expect(describeOperation(op, makeDeps())).toBe('Add **Hire a Contractor** (option)')
  })

  it('renders "Add **Label**" without suffix when kind missing', () => {
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'fac_x',
      data: { label: 'Something' },
    }
    expect(describeOperation(op, makeDeps())).toBe('Add **Something**')
  })
})

describe('describeOperation — update_node', () => {
  it('renders "Update **Label**: field" with changed field name', () => {
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_capacity',
      data: { observedState: { value: 42 } },
    }
    const deps = makeDeps({
      nodeLabels: new Map([['fac_capacity', 'Development Capacity']]),
    })
    const result = describeOperation(op, deps)
    expect(result).toContain('Update **Development Capacity**')
    // observedState is in UPDATE_FIELD_PRIORITY
    expect(result.toLowerCase()).toMatch(/observed/)
  })

  it('falls through to generic when label unresolvable', () => {
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_unknown',
      data: { value: 99 },
    }
    expect(describeOperation(op, makeDeps())).toBe('Update factor')
  })
})

describe('describeOperation — remove_node', () => {
  it('renders "Remove **Label**" when resolvable from store', () => {
    const op: PatchOperation = {
      op: 'remove_node',
      target_id: 'fac_cost',
      data: {},
    }
    const deps = makeDeps({
      nodeLabels: new Map([['fac_cost', 'AI Tool Cost']]),
    })
    expect(describeOperation(op, deps)).toBe('Remove **AI Tool Cost**')
  })

  it('falls through to generic when unresolvable', () => {
    const op: PatchOperation = {
      op: 'remove_node',
      target_id: 'fac_ghost',
      data: {},
    }
    expect(describeOperation(op, makeDeps())).toBe('Remove factor')
  })
})

describe('describeOperation — add_edge / update_edge / remove_edge', () => {
  const edgeOp = (op: PatchOperation['op']): PatchOperation => ({
    op,
    target_id: 'edge_1',
    data: { source: 'fac_a', target: 'fac_b' },
  })

  it('add_edge renders "Connect **From** → **To**" when both labels resolve', () => {
    const deps = makeDeps({
      nodeLabels: new Map([
        ['fac_a', 'Factor A'],
        ['fac_b', 'Factor B'],
      ]),
    })
    expect(describeOperation(edgeOp('add_edge'), deps)).toBe('Connect **Factor A** → **Factor B**')
  })

  it('update_edge with changed field renders the field name', () => {
    const deps = makeDeps({
      nodeLabels: new Map([
        ['fac_a', 'A'],
        ['fac_b', 'B'],
      ]),
      edgeEndpoints: new Map([['edge_1', { from: 'fac_a', to: 'fac_b' }]]),
    })
    const op: PatchOperation = {
      op: 'update_edge',
      target_id: 'edge_1',
      data: { strength: { mean: 0.8 } },
    }
    const result = describeOperation(op, deps)
    expect(result).toContain('Update connection **A** → **B**')
    expect(result.toLowerCase()).toMatch(/strength/)
  })

  it('remove_edge renders "Disconnect **From** → **To**"', () => {
    const deps = makeDeps({
      edgeEndpoints: new Map([['edge_1', { from: 'fac_a', to: 'fac_b' }]]),
      nodeLabels: new Map([
        ['fac_a', 'A'],
        ['fac_b', 'B'],
      ]),
    })
    expect(describeOperation(edgeOp('remove_edge'), deps)).toBe('Disconnect **A** → **B**')
  })

  it('edge op falls through to generic when neither endpoint resolves', () => {
    const op: PatchOperation = {
      op: 'add_edge',
      target_id: 'edge_ghost',
      data: {},
    }
    expect(describeOperation(op, makeDeps())).toBe('Add connection')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Invariant: output never contains raw IDs
// ─────────────────────────────────────────────────────────────────────────

describe('describeOperation — raw-ID invariant across all op types', () => {
  const deps = makeDeps()
  const ops: PatchOperation[] = [
    { op: 'add_node', target_id: 'fac_x', data: {} },
    { op: 'update_node', target_id: 'opt_y', data: {} },
    { op: 'remove_node', target_id: 'goal_z', data: {} },
    { op: 'add_edge', target_id: 'edge_1', data: {} },
    { op: 'update_edge', target_id: 'edge_2', data: {} },
    { op: 'remove_edge', target_id: 'edge_3', data: {} },
    // Full-word prefixes emitted by CEE deterministic action handlers
    // (add-option.ts → option_*, add-factor.ts → factor_*). The short-
    // prefix regex alone doesn't match these, so prior to the 2026-04-09
    // regex widening a raw `factor_team_morale` or `option_hire_tech_lead`
    // string in any label field would slip past every tier of
    // resolveNodeLabel.
    { op: 'add_node', target_id: 'factor_team_morale', data: {} },
    { op: 'update_node', target_id: 'option_hire_tech_lead', data: {} },
    { op: 'remove_node', target_id: 'decision_rebuild_checkout', data: {} },
    { op: 'add_node', target_id: 'outcome_happy_user', data: {} },
    { op: 'update_node', target_id: 'constraint_budget_cap', data: {} },
  ]

  for (const op of ops) {
    it(`${op.op}(${op.target_id}) with unresolvable label never emits raw IDs`, () => {
      const result = describeOperation(op, deps)
      expect(result).not.toMatch(RAW_ID_PATTERN)
      expect(result).not.toContain(op.target_id)
    })
  }
})

describe('RAW_ID_PATTERN — long-prefix coverage (2026-04-09)', () => {
  // Regression test: the original pattern only covered short prefixes
  // (fac|opt|goal|dec|out|risk|con). CEE's deterministic action handlers
  // generate full-word prefixes (factor_, option_, decision_, outcome_,
  // constraint_) which must also be caught for defence-in-depth.
  it.each([
    // Short-prefix IDs — pre-existing coverage, must still match.
    'fac_x',
    'opt_hire',
    'goal_ship',
    'dec_rebuild',
    'out_happy',
    'risk_churn',
    'con_budget',
    // Long-prefix IDs — new coverage.
    'factor_team_morale',
    'option_hire_tech_lead',
    'decision_rebuild_checkout',
    'outcome_happy_user',
    'constraint_budget_cap',
    // Case-insensitive (regex has /i flag).
    'Factor_Team_Morale',
    'OPTION_HIRE',
  ])('matches %s', (id) => {
    expect(id).toMatch(RAW_ID_PATTERN)
  })

  it.each([
    // Non-ID strings that should NOT match.
    'Market Growth',
    'Hire a Contractor',
    'factor',           // no underscore + body
    'option model',     // no underscore pattern
    'factorised risk',  // no underscore following prefix
    'my_custom_key',    // not one of the known prefixes
  ])('does NOT match %s', (s) => {
    expect(s).not.toMatch(RAW_ID_PATTERN)
  })

  it('resolveNodeLabel rejects a tier-1 elementLabel that is a long-prefix raw ID', () => {
    // Brief's scenario: CEE puts `option_hire_tech_lead` into
    // proposalItem.elementLabel. Prior to the widening, this would slip
    // through tier 1 and render verbatim as the node label.
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'option_hire_tech_lead',
      data: { kind: 'option', label: 'Hire a Tech Lead' },
    }
    const deps = makeDeps({
      proposalItem: { description: '', elementLabel: 'option_hire_tech_lead' },
    })
    // Tier 1 rejected by widened regex → tier 2 (op.data.label) wins.
    const result = describeOperation(op, deps)
    expect(result).toBe('Add **Hire a Tech Lead** (option)')
    expect(result).not.toMatch(RAW_ID_PATTERN)
  })

  it('resolveNodeLabel rejects a tier-2 op.data.label that is a long-prefix raw ID', () => {
    // Pathological case: CEE somehow emits op.data.label = 'factor_xyz'.
    // Prior to the widening, this would render as `Add **factor_xyz** (factor)`.
    const op: PatchOperation = {
      op: 'add_node',
      target_id: 'factor_team_morale',
      data: { kind: 'factor', label: 'factor_team_morale' },
    }
    const deps = makeDeps({
      relatedElements: [{ node_id: 'factor_team_morale', label: 'Team Morale' }],
    })
    // Tier 2 rejected → tier 3 (relatedElements) wins.
    expect(describeOperation(op, deps)).toBe('Add **Team Morale** (factor)')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Helper exports regression coverage
// ─────────────────────────────────────────────────────────────────────────

describe('friendlyFieldName', () => {
  it('humanises camelCase keys', () => {
    // Falls through to basic humanisation when not in FIELD_LABELS
    const result = friendlyFieldName('someCamelKey')
    expect(result).not.toBe('someCamelKey')
    expect(result[0]).toBe(result[0].toUpperCase())
  })
})

describe('firstChangedKey', () => {
  it('returns a prioritised key when present', () => {
    expect(firstChangedKey({ label: 'x', value: 1 })).toBe('label')
    expect(firstChangedKey({ strength: 0.5, prior: 1 })).toBe('strength')
  })

  it('returns the first sorted non-id key when no prioritised key', () => {
    expect(firstChangedKey({ zeta: 1, alpha: 2, id: 'x' })).toBe('alpha')
  })

  it('returns undefined for empty/missing data', () => {
    expect(firstChangedKey(undefined)).toBeUndefined()
    expect(firstChangedKey({})).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Fix 1: add_edge resolves labels from same-patch add_node operations
// ─────────────────────────────────────────────────────────────────────────

describe('describeOperation — add_edge with same-patch node labels (Fix 1)', () => {
  it('resolves edge labels from add_node ops in the same patch via pre-indexed nodeLabels', () => {
    // Simulates the GraphPatchBlockRenderer pre-indexing behaviour:
    // add_node operations inject their labels into nodeLabels so that
    // add_edge operations in the same patch can resolve them.
    const nodeLabels = new Map<string, string>()
    const ops: PatchOperation[] = [
      { op: 'add_node', target_id: 'fac_pricing', data: { kind: 'factor', label: 'Pricing Strategy' } },
      { op: 'add_node', target_id: 'fac_revenue', data: { kind: 'factor', label: 'Revenue' } },
      { op: 'add_edge', target_id: 'edge_1', data: { source: 'fac_pricing', target: 'fac_revenue' } },
    ]
    // Pre-index add_node labels (mirrors GraphPatchBlockRenderer useMemo)
    for (const op of ops) {
      if (op.op === 'add_node' && !nodeLabels.has(op.target_id)) {
        const label = typeof op.data?.label === 'string' ? op.data.label : ''
        if (label) nodeLabels.set(op.target_id, label)
      }
    }
    const deps = makeDeps({ nodeLabels })
    const edgeOp = ops[2]
    expect(describeOperation(edgeOp, deps)).toBe('Connect **Pricing Strategy** → **Revenue**')
  })

  it('without pre-indexing, the same edge falls through to generic "Add connection"', () => {
    const deps = makeDeps() // empty nodeLabels
    const op: PatchOperation = {
      op: 'add_edge',
      target_id: 'edge_1',
      data: { source: 'fac_pricing', target: 'fac_revenue' },
    }
    expect(describeOperation(op, deps)).toBe('Add connection')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Receipt field-suffix allowlist gate (RECEIPT_FIELD_ALLOWLIST)
//
// `describeOperation` only renders a `: <FieldLabel>` suffix when the
// changed key is on the receipt allowlist. The allowlist is the union
// of `UPDATE_FIELD_PRIORITY` (priority order) and `Object.keys(FIELD_LABELS)`
// (curated friendly labels). Foreign / drifted / malformed keys must
// suppress the suffix and fall back to the bare label. Without the
// gate, `friendlyFieldName` would convert arbitrary camelCase like
// `weirdInternalKey` into "Weird internal key" — a friendly-looking
// leak of an internal field name.
// ─────────────────────────────────────────────────────────────────────────

describe('describeOperation — receipt field-suffix allowlist gate', () => {
  it('update_node with a known UPDATE_FIELD_PRIORITY key renders the friendly suffix', () => {
    // Using `kind` rather than `label` because `label` is also tier-2 of
    // resolveNodeLabel and would shadow the store-resolved entity label
    // — that interaction belongs to the label-resolution suite, not here.
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_morale',
      data: { kind: 'risk' },
    }
    const deps = makeDeps({ nodeLabels: new Map([['fac_morale', 'team morale']]) })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update **team morale**: Kind')
  })

  it('update_node with a curated FIELD_LABELS-only key (not in priority list) renders the friendly suffix', () => {
    // `baseline` is in FIELD_LABELS ("Baseline") but NOT in
    // UPDATE_FIELD_PRIORITY. The gate must allow it through —
    // priority order and display safety are different concepts.
    // Same property holds for `exists_probability`, `strength_std`,
    // `range_min`, `range_max`.
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_morale',
      data: { baseline: 0.5 },
    }
    const deps = makeDeps({ nodeLabels: new Map([['fac_morale', 'team morale']]) })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update **team morale**: Baseline')
  })

  it('update_node with an unknown key suppresses the suffix and renders the bare label', () => {
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_morale',
      // Cast: deliberate wire-shape simulation (foreign key) — NOT an
      // endorsed schema example. This is the leakage class the gate
      // exists to block.
      data: { weirdInternalKey: 'should-not-leak' } as unknown as Record<string, unknown>,
    }
    const deps = makeDeps({ nodeLabels: new Map([['fac_morale', 'team morale']]) })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update **team morale**')
    // Humanised form of the unknown key must not appear.
    expect(result.toLowerCase()).not.toContain('weird internal key')
    // Raw key must not appear either.
    expect(result).not.toContain('weirdInternalKey')
  })

  it('update_edge with a curated FIELD_LABELS-only key (exists_probability) renders the friendly suffix', () => {
    // Real-world edges carry `exists_probability` as a wire field —
    // this is the regression case from the third-round review.
    const op: PatchOperation = {
      op: 'update_edge',
      target_id: 'edge_1',
      data: { exists_probability: 0.8 },
    }
    const deps = makeDeps({
      edgeEndpoints: new Map([['edge_1', { from: 'fac_a', to: 'fac_b' }]]),
      nodeLabels: new Map([['fac_a', 'A'], ['fac_b', 'B']]),
    })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update connection **A** → **B**: Existence probability')
  })

  it('update_edge with another curated FIELD_LABELS-only key (strength_std) renders the friendly suffix', () => {
    const op: PatchOperation = {
      op: 'update_edge',
      target_id: 'edge_1',
      data: { strength_std: 0.1 },
    }
    const deps = makeDeps({
      edgeEndpoints: new Map([['edge_1', { from: 'fac_a', to: 'fac_b' }]]),
      nodeLabels: new Map([['fac_a', 'A'], ['fac_b', 'B']]),
    })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update connection **A** → **B**: Strength uncertainty')
  })

  it('update_edge with an unknown key suppresses the suffix and renders the bare connection', () => {
    const op: PatchOperation = {
      op: 'update_edge',
      target_id: 'edge_1',
      data: { weirdEdgeMeta: { internal: true } } as unknown as Record<string, unknown>,
    }
    const deps = makeDeps({
      edgeEndpoints: new Map([['edge_1', { from: 'fac_a', to: 'fac_b' }]]),
      nodeLabels: new Map([['fac_a', 'A'], ['fac_b', 'B']]),
    })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update connection **A** → **B**')
    expect(result.toLowerCase()).not.toContain('weird edge meta')
    expect(result).not.toContain('weirdEdgeMeta')
  })

  it('update_node with a camelCase variant of a curated key (existsProbability) renders the friendly suffix', () => {
    // CEE may emit a camelCase variant of an otherwise-curated key.
    // The gate's snake-case parity check should accept it.
    const op: PatchOperation = {
      op: 'update_node',
      target_id: 'fac_morale',
      data: { existsProbability: 0.9 } as unknown as Record<string, unknown>,
    }
    const deps = makeDeps({ nodeLabels: new Map([['fac_morale', 'team morale']]) })
    const result = describeOperation(op, deps)
    expect(result).toBe('Update **team morale**: Existence probability')
  })
})
