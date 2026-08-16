import {
  CANONICAL_COMMITTED_RECEIPT_FIELD_CLASSIFICATION,
  CANONICAL_GRAPH_HASH_NESTED_PROJECTION,
} from '@talchain/schemas/boundary'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCanvasStore } from '../../store'
import {
  canonicalAnalysisReadyAllowsRun,
  canonicalCommittedGraphReceiptFromGraph,
  canonicalReceiptEdgeCanvasFields,
  canonicalReceiptNodeCanvasFields,
  parseCanonicalCommittedGraphReceipt,
  prepareCanonicalAnalysisReadyFromReceipt,
  reconcileStoredAnalysisStateFromCanonicalGraph,
  storedAnalysisStateMatchesCanonicalReceipt,
} from '../canonicalAnalysisStateAuthority'

const constraint = {
  constraint_id: 'constraint_min_profit',
  node_id: 'goal_profit',
  operator: '>=' as const,
  value: 0.7,
}

const nestedIntervention = {
  value: 0.4,
  value_type: 'continuous',
  encoding_map: { low: 0, high: 1 },
  target_match: {
    node_id: 'fac_demand',
    match_type: 'semantic',
    confidence: 'high',
  },
  source: 'user_specified',
}

function option(status = 'ready') {
  return {
    id: 'opt_plan_a',
    label: 'Plan A',
    status,
    is_baseline: false,
    interventions: { fac_demand: structuredClone(nestedIntervention) },
    raw_interventions: { fac_demand: 'medium' },
  }
}

function receipt(overrides: Record<string, unknown> = {}) {
  const nodes = [
    { id: 'goal_profit', kind: 'goal', label: 'Sustainable profit' },
    { id: 'fac_demand', kind: 'factor', label: 'Demand' },
    { id: 'opt_plan_a', kind: 'option', label: 'Plan A' },
  ]
  const edges = [{
    from: 'fac_demand',
    to: 'goal_profit',
    strength: { mean: 0.5, std: 0.1 },
    exists_probability: 0.9,
    effect_direction: 'positive',
  }]
  return {
    nodes,
    edges,
    options: [option()],
    goal_node_id: 'goal_profit',
    goal_constraints: [constraint],
    node_count: nodes.length,
    edge_count: edges.length,
    ...overrides,
  }
}

function readiness(overrides: Record<string, unknown> = {}) {
  const canonicalOption = option()
  return {
    options: [{
      option_id: canonicalOption.id,
      label: canonicalOption.label,
      status: canonicalOption.status,
      is_baseline: canonicalOption.is_baseline,
      // Canonical #983 intentionally compacts full receipt interventions to
      // their numeric values on the readiness wire.
      interventions: { fac_demand: nestedIntervention.value },
    }],
    goal_node_id: 'goal_profit',
    status: 'ready',
    freshness: 'fresh',
    freshness_reason: 'graph_hash_match',
    computed_at: '2026-08-16T01:00:00.000Z',
    current_graph_hash: 'canonical-hash',
    graph_hash_at_run: 'canonical-hash',
    ...overrides,
  }
}

beforeEach(() => {
  useCanvasStore.setState({
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
    goalConstraints: [constraint],
  })
})

describe('canonical committed analysis-state authority', () => {
  it('derives the five carriers and nested canvas spellings from schema 0.43', () => {
    expect(CANONICAL_COMMITTED_RECEIPT_FIELD_CLASSIFICATION.hash_carrier).toEqual([
      'nodes', 'edges', 'options', 'goal_node_id', 'goal_constraints',
    ])
    expect(canonicalReceiptNodeCanvasFields()).toEqual(expect.arrayContaining([
      ...CANONICAL_GRAPH_HASH_NESTED_PROJECTION.node.fields.slice(1),
      'observedState',
      'prior',
    ]))
    expect(canonicalReceiptEdgeCanvasFields()).toEqual(expect.arrayContaining([
      'weight', 'strengthStd', 'beliefExists', 'direction', 'edge_type',
    ]))
  })

  it('strictly distinguishes a canonical receipt from legacy omission and count drift', () => {
    const exact = receipt()
    expect(parseCanonicalCommittedGraphReceipt(exact)).not.toBeNull()
    expect(canonicalCommittedGraphReceiptFromGraph(exact)).toEqual(exact)

    const legacy = structuredClone(exact) as Record<string, unknown>
    delete legacy.options
    expect(parseCanonicalCommittedGraphReceipt(legacy)).toBeNull()
    expect(canonicalCommittedGraphReceiptFromGraph(legacy)).toBeNull()

    expect(parseCanonicalCommittedGraphReceipt({ ...exact, node_count: 99 })).toBeNull()
  })

  it('accepts an exact ready receipt, retires the sidecar, and proves stored carriers', () => {
    const prepared = prepareCanonicalAnalysisReadyFromReceipt({
      ...readiness(),
      canonical_graph_hash_analysis_state: { obsolete: true },
    }, receipt())
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.runnable).toBe(true)
    expect(canonicalAnalysisReadyAllowsRun(prepared.analysisReady)).toBe(true)
    expect(prepared.analysisReady).not.toHaveProperty('canonical_graph_hash_analysis_state')
    expect(prepared.analysisReady.options[0]?.interventions).toEqual({
      fac_demand: nestedIntervention,
    })

    useCanvasStore.setState({ ceeAnalysisReady: prepared.analysisReady })
    expect(storedAnalysisStateMatchesCanonicalReceipt(prepared.receipt)).toBe(true)
  })

  it.each([
    ['goal identity', (r: any) => { r.goal_node_id = 'goal_other' }],
    ['option status', (r: any) => { r.options[0].status = 'needs_encoding' }],
    ['baseline identity', (r: any) => { r.options[0].is_baseline = true }],
    ['intervention value', (r: any) => { r.options[0].interventions.fac_demand = 0.7 }],
  ])('rejects a readiness / receipt %s mismatch', (_label, mutate) => {
    const mismatched = structuredClone(readiness())
    mutate(mismatched)
    expect(prepareCanonicalAnalysisReadyFromReceipt(mismatched, receipt())).toEqual({
      ok: false,
      reason: 'canonical_committed_receipt_readiness_mismatch',
    })
  })

  it('compares the manifest-conditional raw_interventions carrier for non-ready options', () => {
    const encoded = option('needs_encoding')
    const raw = readiness({
      status: 'needs_encoding',
      options: [{
        option_id: encoded.id,
        label: encoded.label,
        status: encoded.status,
        is_baseline: encoded.is_baseline,
        interventions: { fac_demand: nestedIntervention.value },
        raw_interventions: structuredClone(encoded.raw_interventions),
      }],
    }) as any
    raw.options[0].raw_interventions.fac_demand = 'high'
    expect(prepareCanonicalAnalysisReadyFromReceipt(
      raw,
      receipt({ options: [encoded] }),
    )).toEqual({
      ok: false,
      reason: 'canonical_committed_receipt_readiness_mismatch',
    })
  })

  it('accepts canonical needs_* readiness but never converts saved into ready', () => {
    const nonReadyOption = option('needs_user_mapping')
    const prepared = prepareCanonicalAnalysisReadyFromReceipt(
      readiness({
        status: 'needs_user_mapping',
        options: [{
          option_id: nonReadyOption.id,
          label: nonReadyOption.label,
          status: nonReadyOption.status,
          is_baseline: nonReadyOption.is_baseline,
          interventions: { fac_demand: nestedIntervention.value },
          raw_interventions: structuredClone(nonReadyOption.raw_interventions),
        }],
      }),
      receipt({ options: [nonReadyOption] }),
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.runnable).toBe(false)
    expect(prepared.analysisReady.status).toBe('needs_user_mapping')
    expect(canonicalAnalysisReadyAllowsRun(prepared.analysisReady)).toBe(false)
  })

  it('accepts canonical NO_OPTIONS as typed blocked state with an exact empty carrier', () => {
    const prepared = prepareCanonicalAnalysisReadyFromReceipt(
      readiness({
        status: 'blocked',
        blocked_reason: 'NO_OPTIONS',
        options: [],
      }),
      receipt({ options: [] }),
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared).toMatchObject({ runnable: false })
    expect(prepared.analysisReady).toMatchObject({
      status: 'blocked',
      goal_node_id: 'goal_profit',
      options: [],
      blocked_reason: 'NO_OPTIONS',
    })
    useCanvasStore.setState({ ceeAnalysisReady: prepared.analysisReady })
    expect(storedAnalysisStateMatchesCanonicalReceipt(prepared.receipt)).toBe(true)
  })

  it('accepts canonical NO_GOAL while preserving the receipt options and explicit-null goal', () => {
    const goalLessReceipt = receipt({ goal_node_id: null })
    const prepared = prepareCanonicalAnalysisReadyFromReceipt(
      readiness({
        status: 'blocked',
        blocked_reason: 'NO_GOAL',
        goal_node_id: '',
        options: [],
      }),
      goalLessReceipt,
    )
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.runnable).toBe(false)
    expect(prepared.analysisReady).toMatchObject({
      status: 'blocked',
      goal_node_id: '',
      options: [{ id: 'opt_plan_a' }],
      blocked_reason: 'NO_GOAL',
    })
    useCanvasStore.setState({ ceeAnalysisReady: prepared.analysisReady })
    expect(storedAnalysisStateMatchesCanonicalReceipt(prepared.receipt)).toBe(true)
  })

  it('rejects ready-without-goal and unknown whole-status contradictions', () => {
    expect(prepareCanonicalAnalysisReadyFromReceipt(
      readiness({ goal_node_id: '', options: [], status: 'ready' }),
      receipt({ goal_node_id: null }),
    )).toEqual({
      ok: false,
      reason: 'canonical_committed_receipt_readiness_mismatch',
    })
    expect(prepareCanonicalAnalysisReadyFromReceipt(
      readiness({ status: 'future_status' }),
      receipt(),
    )).toEqual({
      ok: false,
      reason: 'canonical_committed_receipt_readiness_mismatch',
    })
  })

  it('does not write legacy recovery, but can restore a full non-ready canonical graph exactly', () => {
    const previous = readiness({ status: 'needs_user_input', options: [] }) as never
    useCanvasStore.setState({ ceeAnalysisReady: previous })
    const legacy = receipt() as Record<string, unknown>
    delete legacy.goal_constraints
    expect(reconcileStoredAnalysisStateFromCanonicalGraph(legacy)).toBeNull()
    expect(useCanvasStore.getState().ceeAnalysisReady).toBe(previous)

    const full = receipt({ options: [] })
    const recovered = reconcileStoredAnalysisStateFromCanonicalGraph(full)
    expect(recovered).not.toBeNull()
    expect(useCanvasStore.getState().ceeAnalysisReady).toMatchObject({
      status: 'needs_user_input',
      options: [],
    })
    expect(storedAnalysisStateMatchesCanonicalReceipt(full)).toBe(true)
  })
})
