/**
 * Strict receipt corpus for the deployed CEE writer (4775ce61).
 *
 * The two positive shapes are reduced mechanically from the 15 Aug 2026
 * active-set and active-confirm acceptance responses. Mutants pin every byte
 * the UI relies on before it may call a relationship saved or license Run.
 */

import { describe, expect, it } from 'vitest'
import { OlumiResponseSchema, type OlumiResponse } from '@talchain/schemas/boundary'

import {
  evaluateEdgeStrengthReceipt,
  type EdgeStrengthAttempt,
} from '../edgeStrengthCoordinator'

function attempt(overrides: Partial<EdgeStrengthAttempt> = {}): EdgeStrengthAttempt {
  return {
    id: 'attempt-1',
    scenarioId: '22222222-2222-4222-8222-222222222222',
    edgeId: 'opaque-rf-edge-id',
    from: 'fac_demand',
    to: 'goal_profit',
    expected: { mean: -0.4, effectDirection: 'negative', std: 0.1 },
    target: { mean: -0.7, effectDirection: 'negative', std: 0.1 },
    directionIntent: 'preserve',
    intent: 'set',
    localRevision: 1,
    scenarioRevision: 1,
    graphHashBefore: 'ecbec896ec686d3c',
    graphHashAtRunBefore: 'ecbec896ec686d3c',
    freshnessBefore: 'fresh',
    ...overrides,
  }
}

function setResponse(): OlumiResponse {
  return OlumiResponseSchema.parse({
    response_version: 2,
    assistant_text: 'Adjusted the relationship.',
    stage_indicator: 'analyse',
    suggested_actions: [],
    insights: [],
    blocks: [{
      type: 'graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'fac_demand→goal_profit',
      before: {
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean: -0.4, std: 0.1 },
        effect_direction: 'negative',
      },
      after: {
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean: -0.7, std: 0.1 },
        effect_direction: 'negative',
      },
    }],
    graph_hash: '8cf2c68f92c5c20a',
    analysis_ready: {
      options: [{
        option_id: 'opt_plan_a',
        label: 'Plan A',
        status: 'needs_user_mapping',
        interventions: {},
        is_baseline: false,
      }],
      goal_node_id: 'goal_profit',
      status: 'needs_user_input',
      computed_at: '2026-08-15T14:00:39.168Z',
      freshness: 'stale',
      freshness_reason: 'graph_hash_diverged',
      graph_hash_at_run: 'ecbec896ec686d3c',
      current_graph_hash: '8cf2c68f92c5c20a',
    },
    draft_graph: {
      nodes: [
        { id: 'goal_profit', kind: 'goal', label: 'Sustainable profit' },
        {
          id: 'fac_demand',
          kind: 'factor',
          label: 'Demand',
          observed_state: { value: 0.55, source: 'cee_inference', cap: 1 },
        },
        { id: 'opt_plan_a', kind: 'option', label: 'Plan A' },
      ],
      edges: [{
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean: -0.7, std: 0.1 },
        exists_probability: 0.9,
        effect_direction: 'negative',
        provenance: { source: 'user_specified', reasoning: 'User judgement' },
        provenance_display: 'user_set',
      }],
      node_count: 3,
      edge_count: 1,
    },
  })
}

function confirmResponse(): OlumiResponse {
  const response = structuredClone(setResponse()) as unknown as Record<string, any>
  response.blocks[0] = {
    ...response.blocks[0],
    status: 'noop',
    target_id: 'fac_quality→goal_profit',
    before: {
      from: 'fac_quality',
      to: 'goal_profit',
      strength: { mean: 0.25, std: 0.08 },
      effect_direction: 'positive',
    },
    after: {
      from: 'fac_quality',
      to: 'goal_profit',
      strength: { mean: 0.25, std: 0.08 },
      effect_direction: 'positive',
    },
  }
  response.graph_hash = '8cf2c68f92c5c20a'
  response.analysis_ready = {
    ...response.analysis_ready,
    freshness: 'fresh',
    freshness_reason: 'graph_hash_match',
    graph_hash_at_run: '8cf2c68f92c5c20a',
    current_graph_hash: '8cf2c68f92c5c20a',
    computed_at: '2026-08-15T14:00:45.199Z',
  }
  response.draft_graph = {
    ...(response.draft_graph as Record<string, unknown>),
    nodes: [
      { id: 'goal_profit', kind: 'goal', label: 'Sustainable profit' },
      {
        id: 'fac_quality',
        kind: 'factor',
        label: 'Quality',
        observed_state: { value: 0.6, source: 'cee_inference', cap: 1 },
      },
      { id: 'opt_plan_a', kind: 'option', label: 'Plan A' },
    ],
    edges: [{
      from: 'fac_quality',
      to: 'goal_profit',
      strength: { mean: 0.25, std: 0.08 },
      exists_probability: 0.85,
      effect_direction: 'positive',
      provenance: { source: 'user_specified', reasoning: 'User judgement' },
      provenance_display: 'user_set',
    }],
  }
  return OlumiResponseSchema.parse(response)
}

function mutate(
  response: OlumiResponse,
  change: (draft: Record<string, any>) => void,
): OlumiResponse {
  const draft = structuredClone(response) as unknown as Record<string, any>
  change(draft)
  return draft as unknown as OlumiResponse
}

describe('evaluateEdgeStrengthReceipt', () => {
  it('accepts the exact deployed negative preserve SET shape', () => {
    const verdict = evaluateEdgeStrengthReceipt(attempt(), setResponse())
    expect(verdict.kind).toBe('applied')
    if (verdict.kind !== 'applied') return
    expect(verdict.readback).toMatchObject({
      mean: -0.7,
      effectDirection: 'negative',
      std: 0.1,
      existsProbability: 0.9,
      provenanceSource: 'user_specified',
    })
  })

  it('accepts the exact deployed confirm_current noop shape without requiring a warm UI hash cache', () => {
    const confirmAttempt = attempt({
      from: 'fac_quality',
      expected: { mean: 0.25, effectDirection: 'positive', std: 0.08 },
      target: { mean: 0.25, effectDirection: 'positive', std: 0.08 },
      directionIntent: 'preserve',
      intent: 'confirm_current',
      graphHashBefore: null,
      graphHashAtRunBefore: null,
      freshnessBefore: null,
    })
    expect(evaluateEdgeStrengthReceipt(confirmAttempt, confirmResponse()).kind).toBe('applied')
  })

  it('rejects a stale confirm_current receipt even when its hashes are internally coherent', () => {
    const confirmAttempt = attempt({
      from: 'fac_quality',
      expected: { mean: 0.25, effectDirection: 'positive', std: 0.08 },
      target: { mean: 0.25, effectDirection: 'positive', std: 0.08 },
      intent: 'confirm_current',
    })
    const response = mutate(confirmResponse(), (draft) => {
      draft.analysis_ready.freshness = 'stale'
      draft.analysis_ready.freshness_reason = 'graph_hash_diverged'
      draft.analysis_ready.graph_hash_at_run = 'older-hash'
    })
    expect(evaluateEdgeStrengthReceipt(confirmAttempt, response).kind).toBe('invalid')
  })

  it.each([
    ['an extra block', (r: any) => r.blocks.push({ type: 'text', content: 'saved' })],
    ['a prose-only 200', (r: any) => { r.blocks = [] }],
    ['the wrong operation', (r: any) => { r.blocks[0].operation = 'set_factor_value' }],
    ['the opaque RF id as target', (r: any) => { r.blocks[0].target_id = 'opaque-rf-edge-id' }],
    ['a noop for SET', (r: any) => { r.blocks[0].status = 'noop' }],
    ['a wrong before tuple', (r: any) => { r.blocks[0].before.strength.mean = -0.3 }],
    ['a wrong after tuple', (r: any) => { r.blocks[0].after.strength.mean = -0.6 }],
    ['a wrong patch endpoint', (r: any) => { r.blocks[0].after.to = 'other_goal' }],
    ['a mutated std', (r: any) => { r.blocks[0].after.strength.std = 0.2 }],
    ['missing draft graph', (r: any) => { delete r.draft_graph }],
    ['a wrong node count', (r: any) => { r.draft_graph.node_count = 99 }],
    ['a wrong edge count', (r: any) => { r.draft_graph.edge_count = 99 }],
    ['missing existence probability', (r: any) => { delete r.draft_graph.edges[0].exists_probability }],
    ['out-of-range existence probability', (r: any) => { r.draft_graph.edges[0].exists_probability = 2 }],
    ['non-positive std', (r: any) => { r.draft_graph.edges[0].strength.std = -0.1 }],
    ['wrong draft direction', (r: any) => { r.draft_graph.edges[0].effect_direction = 'positive' }],
    ['wrong draft provenance', (r: any) => { r.draft_graph.edges[0].provenance.source = 'cee_hypothesis' }],
    ['wrong provenance display', (r: any) => { r.draft_graph.edges[0].provenance_display = 'ai_inferred' }],
    ['duplicate canonical pair', (r: any) => {
      r.draft_graph.edges.push(structuredClone(r.draft_graph.edges[0]))
      r.draft_graph.edge_count = 2
    }],
    ['a stale current hash', (r: any) => { r.analysis_ready.current_graph_hash = 'wrong' }],
    ['freshness incoherent with graph_hash_at_run', (r: any) => {
      r.analysis_ready.freshness = 'fresh'
      r.analysis_ready.graph_hash_at_run = 'different'
    }],
  ])('rejects %s', (_label, change) => {
    expect(evaluateEdgeStrengthReceipt(attempt(), mutate(setResponse(), change)).kind).toBe('invalid')
  })

  it('accepts explicit direction and a genuine zero without inferring either', () => {
    const response = mutate(setResponse(), (r) => {
      r.blocks[0].before.strength.mean = 0.4
      r.blocks[0].before.effect_direction = 'positive'
      r.blocks[0].after.strength.mean = 0
      r.blocks[0].after.effect_direction = 'negative'
      r.draft_graph.edges[0].strength.mean = 0
      r.draft_graph.edges[0].effect_direction = 'negative'
    })
    const zeroAttempt = attempt({
      expected: { mean: 0.4, effectDirection: 'positive', std: 0.1 },
      target: { mean: 0, effectDirection: 'negative', std: 0.1 },
      directionIntent: 'negative',
    })
    expect(evaluateEdgeStrengthReceipt(zeroAttempt, response).kind).toBe('applied')
  })
})
