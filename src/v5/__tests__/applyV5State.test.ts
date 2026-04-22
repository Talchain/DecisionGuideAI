import { describe, it, expect, vi } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore(
  nodes: V5ApplicatorStore['nodes'] = [],
  edges: V5ApplicatorStore['edges'] = [],
): {
  store: V5ApplicatorStore
  setCurrentStage: ReturnType<typeof vi.fn>
  updateNode: ReturnType<typeof vi.fn>
  updateEdgeData: ReturnType<typeof vi.fn>
  setRunMeta: ReturnType<typeof vi.fn>
} {
  const setCurrentStage = vi.fn()
  const updateNode = vi.fn()
  const updateEdgeData = vi.fn()
  const setRunMeta = vi.fn()
  return {
    store: { setCurrentStage, updateNode, updateEdgeData, setRunMeta, nodes, edges },
    setCurrentStage,
    updateNode,
    updateEdgeData,
    setRunMeta,
  }
}

describe('applyV5State — stage tracking', () => {
  it('maps stage_indicator=analyse → ScenarioStage=evaluate and calls setCurrentStage', () => {
    const { store, setCurrentStage } = makeStore()
    const result = applyV5State(baseResponse({ stage_indicator: 'analyse' }), store)
    expect(setCurrentStage).toHaveBeenCalledWith('evaluate')
    expect(result.applied).toContain('stage:analyse')
  })

  it.each([
    ['frame', 'frame'],
    ['analyse', 'evaluate'],
    ['decide', 'decide'],
    ['review', 'optimise'],
  ] as const)('stage %s → scenario %s', (v5, scenario) => {
    const { store, setCurrentStage } = makeStore()
    applyV5State(baseResponse({ stage_indicator: v5 }), store)
    expect(setCurrentStage).toHaveBeenCalledWith(scenario)
  })
})

describe('applyV5State — graph_patch:set_factor_value', () => {
  const targetNode = {
    id: 'node-1',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'F', observedState: { value: 10, baseline: 12 } },
  } as unknown as V5ApplicatorStore['nodes'][number]

  it('merges `after` into node.data.observedState (preserves unchanged fields)', () => {
    const { store, updateNode } = makeStore([targetNode])
    const response = baseResponse({
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: 'node-1',
          before: { value: 10 },
          after: { value: 42 },
        },
      ],
    })
    const result = applyV5State(response, store)
    expect(updateNode).toHaveBeenCalledWith('node-1', {
      data: expect.objectContaining({
        observedState: expect.objectContaining({
          value: 42,
          baseline: 12, // preserved from prior state
        }),
      }),
    })
    expect(result.applied).toContain('graph_patch:set_factor_value:node-1')
  })

  it('defers when target node is missing in canvas', () => {
    const { store, updateNode } = makeStore([])
    const response = baseResponse({
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: 'unknown',
          before: null,
          after: { value: 1 },
        },
      ],
    })
    const result = applyV5State(response, store)
    expect(updateNode).not.toHaveBeenCalled()
    expect(result.deferred[0]?.reason).toBe('set_factor_value_target_not_found')
  })

  it('skips when status is noop', () => {
    const { store, updateNode } = makeStore([targetNode])
    applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'noop',
            operation: 'set_factor_value',
            target_id: 'node-1',
            before: null,
            after: null,
          },
        ],
      }),
      store,
    )
    expect(updateNode).not.toHaveBeenCalled()
  })
})

describe('applyV5State — graph_patch:adjust_edge_strength', () => {
  const edge = {
    id: 'edge-1',
    source: 'a',
    target: 'b',
    data: { weight: 0.5, direction: 'positive' },
  } as unknown as V5ApplicatorStore['edges'][number]

  it('forwards `after` to updateEdgeData', () => {
    const { store, updateEdgeData } = makeStore([], [edge])
    applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'adjust_edge_strength',
            target_id: 'edge-1',
            before: { weight: 0.5 },
            after: { weight: 0.9, direction: 'positive' },
          },
        ],
      }),
      store,
    )
    expect(updateEdgeData).toHaveBeenCalledWith('edge-1', {
      weight: 0.9,
      direction: 'positive',
    })
  })
})

describe('applyV5State — analysis_result: decision_review wiring', () => {
  const validEnrichment = {
    decision_review: {
      intent: 'selection',
      analysis_state: 'ran',
      readiness: {
        level: 'ready',
        headline: 'Good to go',
        factors: [],
      },
      blocks: [],
    },
  }

  it('applies decision_review from block enrichment and calls setRunMeta', () => {
    const { store, setRunMeta } = makeStore()
    const result = applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'analysis_result',
            summary: 'A leads',
            leading_option_id: 'opt-a',
            win_probabilities: { 'opt-a': 0.6 },
            enrichment: validEnrichment,
          },
        ],
      }),
      store,
    )
    expect(setRunMeta).toHaveBeenCalledOnce()
    expect(setRunMeta).toHaveBeenCalledWith(
      expect.objectContaining({ ceeReviewV1: expect.objectContaining({ intent: 'selection' }) }),
    )
    expect(result.applied).toContain('analysis_result:decision_review:block')
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_result:decision_review:block',
    )
  })

  it('clears ceeReviewV1 (null) when analysis_result block has no decision_review', () => {
    const { store, setRunMeta } = makeStore()
    // No top-level enrichment present in schema 0.7.0 — block path clears null.
    // When CEE adds top-level enrichment, inject it via cast and assert
    // applied contains 'decision_review:top-level' instead.
    const result = applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'analysis_result',
            summary: 'A leads',
            leading_option_id: 'opt-a',
            win_probabilities: {},
          },
        ],
      }),
      store,
    )
    // Must write null so stale review from a prior turn is not shown
    expect(setRunMeta).toHaveBeenCalledOnce()
    expect(setRunMeta).toHaveBeenCalledWith({ ceeReviewV1: null })
    expect(result.deferred[0]?.reason).toBe('analysis_result_no_decision_review_in_block')
  })

  it('block-level enrichment takes precedence when block has enrichment', () => {
    const { store, setRunMeta } = makeStore()
    const result = applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'analysis_result',
            summary: 'A leads',
            leading_option_id: 'opt-a',
            win_probabilities: {},
            enrichment: validEnrichment, // intent: 'selection'
          },
        ],
      }),
      store,
    )
    expect(setRunMeta).toHaveBeenCalledOnce()
    expect(setRunMeta).toHaveBeenCalledWith(
      expect.objectContaining({ ceeReviewV1: expect.objectContaining({ intent: 'selection' }) }),
    )
    expect(result.applied).toContain('analysis_result:decision_review:block')
    expect(result.applied).not.toContain('analysis_result:decision_review:top-level')
  })
})

describe('applyV5State — deferred operations', () => {
  it('add_constraint is explicitly deferred as NEEDS_FIX', () => {
    const { store } = makeStore()
    const result = applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'add_constraint',
            target_id: 'goal-1',
            before: null,
            after: { constraint: 'min>0' },
          },
        ],
      }),
      store,
    )
    expect(result.deferred[0]?.reason).toBe('add_constraint_not_wired')
  })

  it('ignores render-only block kinds (text, explanation, comparison, flip_analysis)', () => {
    const { store } = makeStore()
    const result = applyV5State(
      baseResponse({
        blocks: [
          { type: 'text', content: 'hi' },
          { type: 'explanation', narrative: 'x', referenced_option_ids: [] },
        ],
      }),
      store,
    )
    expect(result.deferred).toHaveLength(0)
    expect(result.applied).toEqual(['stage:frame'])
  })
})
