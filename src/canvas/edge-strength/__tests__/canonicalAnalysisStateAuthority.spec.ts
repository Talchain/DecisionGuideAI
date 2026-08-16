import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { CANONICAL_GRAPH_HASH_ANALYSIS_STATE_FIELDS } from '@talchain/schemas/boundary'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCanvasStore } from '../../store'
import {
  CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD,
  CEE_ANALYSIS_EDGE_CLIENT_FIELDS,
  CEE_ANALYSIS_NODE_CLIENT_FIELDS,
  SERVING_CEE_ANALYSIS_HASH_CONTRACT,
  prepareCanonicalAnalysisReadyFromReceipt,
  storedAnalysisStateMatchesAttestation,
} from '../canonicalAnalysisStateAuthority'

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

function exactReceipt() {
  const option = {
    id: 'opt_plan_a',
    option_id: 'opt_plan_a',
    label: 'Plan A',
    status: 'needs_encoding',
    is_baseline: false,
    interventions: { fac_demand: nestedIntervention },
    raw_interventions: { fac_demand: { raw_value: 'medium', unit: 'tier' } },
  }
  return {
    options: [option],
    goal_node_id: 'goal_profit',
    status: 'needs_encoding',
    freshness: 'stale',
    computed_at: '2026-08-16T01:00:00.000Z',
    [CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD]: {
      projection_version: 'analysis-affecting.v1',
      // Keep the attested preimage structurally independent from the outer
      // readiness transport so nested mismatch mutants cannot alias both.
      options: [structuredClone(option)],
      goal_node_id: 'goal_profit',
      goal_constraints: [{
        constraint_id: 'constraint_min_profit',
        node_id: 'goal_profit',
        operator: '>=',
        value: 0.7,
      }],
    },
  }
}

beforeEach(() => {
  useCanvasStore.setState({
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
    goalConstraints: [{
      constraint_id: 'constraint_min_profit',
      node_id: 'goal_profit',
      operator: '>=',
      value: 0.7,
    }],
  })
})

describe('canonical analysis-state authority', () => {
  it('pins every schema-declared top-level field and the exact client spellings', () => {
    expect(SERVING_CEE_ANALYSIS_HASH_CONTRACT.topLevelFields)
      .toEqual(CANONICAL_GRAPH_HASH_ANALYSIS_STATE_FIELDS)
    expect(CEE_ANALYSIS_NODE_CLIENT_FIELDS).toEqual([
      'kind', 'category', 'factor_type', 'is_baseline', 'observedState',
      'goal_threshold', 'goal_threshold_raw', 'goal_threshold_cap',
      'intercept', 'prior', 'encoding_map', 'interventions',
    ])
    expect(CEE_ANALYSIS_EDGE_CLIENT_FIELDS).toEqual([
      'weight', 'direction', 'strengthStd', 'beliefExists',
      'exists_probability', 'edge_type',
    ])
    expect(SERVING_CEE_ANALYSIS_HASH_CONTRACT.option).toEqual({
      scalarFields: ['status', 'is_baseline'],
      conditionalFields: ['raw_interventions'],
    })
    expect(SERVING_CEE_ANALYSIS_HASH_CONTRACT.intervention).toEqual({
      scalarFields: ['value', 'value_type', 'encoding_map'],
      targetMatchFields: ['node_id'],
    })
  })

  const ceeRepo = resolve(process.cwd(), '..', 'cee-edge-writer-reference-20260815')
  it.runIf(existsSync(ceeRepo))(
    'matches the exact serving CEE projection source bytes',
    () => {
      const source = execFileSync('git', [
        'show',
        `${SERVING_CEE_ANALYSIS_HASH_CONTRACT.sourceCommit}:${SERVING_CEE_ANALYSIS_HASH_CONTRACT.sourcePath}`,
      ], { cwd: ceeRepo })
      expect(createHash('sha256').update(source).digest('hex'))
        .toBe(SERVING_CEE_ANALYSIS_HASH_CONTRACT.sourceSha256)
    },
  )

  it('preserves and proves every hash-bearing option/goal/constraint field', () => {
    const prepared = prepareCanonicalAnalysisReadyFromReceipt(exactReceipt())
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    useCanvasStore.setState({ ceeAnalysisReady: prepared.analysisReady })

    expect(storedAnalysisStateMatchesAttestation(prepared.attestation)).toBe(true)
    expect(prepared.analysisReady.options[0]).toMatchObject({
      id: 'opt_plan_a',
      status: 'needs_encoding',
      is_baseline: false,
      interventions: { fac_demand: nestedIntervention },
      raw_interventions: { fac_demand: { raw_value: 'medium', unit: 'tier' } },
    })
  })

  it.each([
    ['goal identity', (r: any) => { r.goal_node_id = 'goal_other' }],
    ['option status', (r: any) => { r.options[0].status = 'ready' }],
    ['baseline identity', (r: any) => { r.options[0].is_baseline = true }],
    ['intervention value_type', (r: any) => {
      r.options[0].interventions.fac_demand.value_type = 'categorical'
    }],
    ['intervention encoding_map', (r: any) => {
      r.options[0].interventions.fac_demand.encoding_map.high = 2
    }],
    ['intervention target node', (r: any) => {
      r.options[0].interventions.fac_demand.target_match.node_id = 'fac_other'
    }],
    ['raw intervention', (r: any) => {
      r.options[0].raw_interventions.fac_demand.raw_value = 'high'
    }],
  ])('rejects an outer readiness / canonical attestation %s mismatch', (_label, mutate) => {
    const receipt = structuredClone(exactReceipt())
    mutate(receipt)
    expect(prepareCanonicalAnalysisReadyFromReceipt(receipt)).toEqual({
      ok: false,
      reason: 'canonical_analysis_state_receipt_mismatch',
    })
  })

  it.each([
    ['missing', (r: any) => { delete r[CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD] },
      'canonical_analysis_state_attestation_missing'],
    ['wrong projection version', (r: any) => {
      r[CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD].projection_version = 'other'
    }, 'canonical_analysis_state_attestation_invalid'],
    ['dropped option', (r: any) => {
      r[CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD].options = []
    }, 'canonical_analysis_state_not_runnable'],
    ['absent goal', (r: any) => {
      r[CANONICAL_ANALYSIS_STATE_ATTESTATION_FIELD].goal_node_id = null
    }, 'canonical_analysis_state_not_runnable'],
  ])('fails closed on a %s attestation', (_label, mutate, reason) => {
    const receipt = structuredClone(exactReceipt())
    mutate(receipt)
    expect(prepareCanonicalAnalysisReadyFromReceipt(receipt)).toEqual({ ok: false, reason })
  })
})
