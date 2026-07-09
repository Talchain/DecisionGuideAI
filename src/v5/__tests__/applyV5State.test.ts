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
  setCeeAnalysisReady: ReturnType<typeof vi.fn>
  setGoalConstraints: ReturnType<typeof vi.fn>
  backfillGoalThreshold: ReturnType<typeof vi.fn>
} {
  const setCurrentStage = vi.fn()
  const updateNode = vi.fn()
  const updateEdgeData = vi.fn()
  const setRunMeta = vi.fn()
  const setCeeAnalysisReady = vi.fn()
  const setGoalConstraints = vi.fn()
  const backfillGoalThreshold = vi.fn()
  return {
    store: {
      setCurrentStage,
      updateNode,
      updateEdgeData,
      setRunMeta,
      setCeeAnalysisReady,
      setGoalConstraints,
      backfillGoalThreshold,
      nodes,
      edges,
    },
    setCurrentStage,
    updateNode,
    updateEdgeData,
    setRunMeta,
    setCeeAnalysisReady,
    setGoalConstraints,
    backfillGoalThreshold,
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

describe('applyV5State — analysis_ready', () => {
  const readyOption = {
    id: 'opt-a',
    label: 'Option A',
    status: 'ready',
    interventions: { 'factor-1': { value: 1 } },
  }

  function responseWith(
    analysisReady: Record<string, unknown> | undefined,
    overrides: Partial<OlumiResponse> = {},
  ): OlumiResponse {
    return baseResponse({
      ...overrides,
      // `analysis_ready` is a passthrough optional on OlumiResponseSchema.
      // Cast via `unknown` to avoid re-deriving the z.infer shape in tests.
      ...(analysisReady !== undefined
        ? ({ analysis_ready: analysisReady } as unknown as Partial<OlumiResponse>)
        : {}),
    })
  }

  it('writes ceeAnalysisReady when response carries a valid top-level analysis_ready', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const response = responseWith({
      status: 'ready',
      goal_node_id: 'goal-1',
      options: [readyOption],
    })
    const result = applyV5State(response, store)

    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written).toMatchObject({
      status: 'ready',
      goal_node_id: 'goal-1',
      options: [{ id: 'opt-a', status: 'ready', interventions: { 'factor-1': { value: 1 } } }],
    })
    expect(result.applied).toContain('analysis_ready:set')
  })

  it('does not call setCeeAnalysisReady when analysis_ready is absent from the response', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const result = applyV5State(responseWith(undefined), store)
    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_ready:set')
  })

  it('passes non-ready statuses through unchanged (lenient — not gated on status)', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'needs_encoding',
        goal_node_id: 'goal-1',
        options: [{ ...readyOption, status: 'needs_encoding' }],
      }),
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.status).toBe('needs_encoding')
    expect(written.options[0].status).toBe('needs_encoding')
  })

  it('maps option_id → id when an option uses the legacy identifier field', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [
          {
            option_id: 'opt-legacy',
            label: 'Legacy',
            status: 'ready',
            interventions: {},
          },
        ],
      }),
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.options[0].id).toBe('opt-legacy')
  })

  it('defaults missing interventions to {} (baseline option shape)', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [{ id: 'opt-baseline', label: 'Baseline', status: 'ready' }],
      }),
      store,
    )
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.options[0].interventions).toEqual({})
  })

  it('clears the store and defers when analysis_ready is malformed (missing goal_node_id)', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const result = applyV5State(
      responseWith({ status: 'ready', options: [readyOption] }),
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.applied).not.toContain('analysis_ready:set')
    expect(result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape')).toBe(true)
  })

  it('treats an empty options array as invalid — clears the store', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const result = applyV5State(
      responseWith({ status: 'ready', goal_node_id: 'goal-1', options: [] }),
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape')).toBe(true)
  })

  // ------------------------------------------------------------------
  // Freshness contract — V5 normaliser must mirror useConversation.ts:
  //   - missing freshness → 'unknown'
  //   - invalid freshness → 'unknown'
  //   - valid enum values pass through
  //   - non-string freshness_reason is dropped at the boundary
  // ------------------------------------------------------------------

  it('coerces missing freshness to "unknown" on legacy V5 payloads', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [readyOption],
        // freshness deliberately absent
      }),
      store,
    )
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.freshness).toBe('unknown')
  })

  it('coerces invalid freshness values to "unknown"', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [readyOption],
        freshness: 'bogus',
      }),
      store,
    )
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.freshness).toBe('unknown')
  })

  it.each(['fresh', 'stale', 'unknown', 'none'] as const)(
    'passes valid freshness "%s" through V5 normaliser',
    (value) => {
      const { store, setCeeAnalysisReady } = makeStore()
      applyV5State(
        responseWith({
          status: 'ready',
          goal_node_id: 'goal-1',
          options: [readyOption],
          freshness: value,
          freshness_reason: 'graph hash mismatch',
        }),
        store,
      )
      const written = setCeeAnalysisReady.mock.calls[0][0]
      expect(written.freshness).toBe(value)
      expect(written.freshness_reason).toBe('graph hash mismatch')
    },
  )

  it('drops non-string freshness_reason at the V5 boundary', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [readyOption],
        freshness: 'stale',
        freshness_reason: 42,
      }),
      store,
    )
    const written = setCeeAnalysisReady.mock.calls[0][0]
    expect(written.freshness).toBe('stale')
    expect(written.freshness_reason).toBeUndefined()
  })

  it('drops option entries with neither id nor option_id; rejects payload when none remain', () => {
    const { store, setCeeAnalysisReady } = makeStore()
    const result = applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [{ label: 'no id' }, { label: 'also no id' }],
      }),
      store,
    )
    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.deferred.some((d) => d.reason === 'analysis_ready_invalid_shape')).toBe(true)
  })

  it('skips the setter when the inline-draft_graph path will own the write', () => {
    const { store, setCeeAnalysisReady } = makeStore(
      /* canvas empty */ [],
      [],
    )
    applyV5State(
      responseWith(
        {
          status: 'ready',
          goal_node_id: 'goal-1',
          options: [readyOption],
        },
        {
          draft_graph: {
            nodes: [{}, {}],
            edges: [],
            node_count: 2,
            edge_count: 0,
          },
        },
      ),
      store,
    )
    // Inline path (canvasEmpty + draft_graph nodes present + strict contract passes)
    // will run applyDraftResult in useConversation.ts, which owns this write.
    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
  })

  it('writes when the canvas is already populated, even with a draft_graph present', () => {
    const populatedNode = {
      id: 'pre-existing',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {},
    } as unknown as V5ApplicatorStore['nodes'][number]
    const { store, setCeeAnalysisReady } = makeStore([populatedNode])
    applyV5State(
      responseWith(
        {
          status: 'ready',
          goal_node_id: 'goal-1',
          options: [readyOption],
        },
        {
          draft_graph: {
            nodes: [{}, {}],
            edges: [],
            node_count: 2,
            edge_count: 0,
          },
        },
      ),
      store,
    )
    // Canvas is not empty → inline path gate fails in useConversation,
    // applyDraftResult won't run → this applicator owns the write.
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
  })

  it('writes when the strict attach-contract would reject (non-ready status) — acts as safety net', () => {
    const { store, setCeeAnalysisReady } = makeStore(
      /* canvas empty */ [],
      [],
    )
    applyV5State(
      responseWith(
        {
          status: 'needs_user_mapping',
          goal_node_id: 'goal-1',
          options: [{ ...readyOption, status: 'needs_user_mapping' }],
        },
        {
          draft_graph: {
            nodes: [{}, {}],
            edges: [],
            node_count: 2,
            edge_count: 0,
          },
        },
      ),
      store,
    )
    // Strict contract rejects (status !== 'ready') → applyDraftResult
    // internally skips setCeeAnalysisReady. Applicator must fill the gap.
    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    expect(setCeeAnalysisReady.mock.calls[0][0].status).toBe('needs_user_mapping')
  })
})

// ROADMAP 1.22 — goal-threshold quad ingestion on the V5 "commit response"
// path (turns that do NOT flow through applyDraftResult, e.g. follow-up
// turns on a populated canvas). CEE sends goal_threshold_raw/unit/cap on
// analysis_ready and goal_constraints at the response root; prior to this
// fix, applyV5State wrote ceeAnalysisReady (so the bare normalised
// goal_threshold synced via the store's own setCeeAnalysisReady reducer)
// but never backfilled goal_threshold_raw/unit/cap onto the goal node's
// data (read by GoalNode + the debug bundle's full_graph export) and never
// ingested goal_constraints at all on this path — both showed up all-null
// in the debug bundle even though CEE persisted real values.
describe('applyV5State — goal-threshold quad ingestion (ROADMAP 1.22)', () => {
  const readyOption = {
    id: 'opt-a',
    label: 'Option A',
    status: 'ready',
    interventions: {},
  }

  const goalNode = {
    id: 'goal-1',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Goal', kind: 'goal' },
  } as unknown as V5ApplicatorStore['nodes'][number]

  function responseWith(
    analysisReady: Record<string, unknown> | undefined,
    extra: Record<string, unknown> = {},
  ): OlumiResponse {
    return baseResponse({
      ...(analysisReady !== undefined
        ? ({ analysis_ready: analysisReady } as unknown as Partial<OlumiResponse>)
        : {}),
      ...(extra as unknown as Partial<OlumiResponse>),
    })
  }

  // The actual node.data write (and its idempotent / field-presence /
  // node-existence guards) lives in the shared backfillGoalThresholdOntoGoalNode
  // helper (applyDraftResult.ts — see applyDraftResult.spec.ts for that
  // coverage) and is wired at the real call site (useConversation.ts) — NOT
  // reimplemented here. applyV5State's own contract is just: call the
  // injected hook with the normalised analysis_ready whenever it sets
  // ceeAnalysisReady via this (non-inline-owned) branch. Delegating via
  // store.backfillGoalThreshold rather than store.updateNode is deliberate:
  // goal_threshold_raw is in ANALYTICAL_NODE_DATA_FIELDS, so updateNode
  // would treat CEE echoing back its own just-received threshold as a user
  // edit and invalidate the very analysis this same turn just set fresh.
  it('calls the injected backfillGoalThreshold hook with the normalised analysis_ready', () => {
    const { store, backfillGoalThreshold } = makeStore([goalNode])
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [readyOption],
        goal_threshold: 0.8,
        goal_threshold_raw: 20,
        goal_threshold_unit: '%',
        goal_threshold_cap: 25,
      }),
      store,
    )

    expect(backfillGoalThreshold).toHaveBeenCalledWith(
      expect.objectContaining({
        goal_node_id: 'goal-1',
        goal_threshold_raw: 20,
        goal_threshold_unit: '%',
        goal_threshold_cap: 25,
      }),
    )
  })

  it('does not call backfillGoalThreshold when analysis_ready is absent', () => {
    const { store, backfillGoalThreshold } = makeStore([goalNode])
    applyV5State(responseWith(undefined), store)
    expect(backfillGoalThreshold).not.toHaveBeenCalled()
  })

  it('does not call backfillGoalThreshold when analysis_ready fails shape validation', () => {
    const { store, backfillGoalThreshold } = makeStore([goalNode])
    applyV5State(
      responseWith({ status: 'ready', options: [readyOption] /* missing goal_node_id */ }),
      store,
    )
    expect(backfillGoalThreshold).not.toHaveBeenCalled()
  })

  it('does not call backfillGoalThreshold when the inline-draft path will own the write', () => {
    const { store, backfillGoalThreshold } = makeStore(/* canvas empty */ [], [])
    applyV5State(
      responseWith(
        { status: 'ready', goal_node_id: 'goal-1', options: [readyOption] },
        { draft_graph: { nodes: [{}, {}], edges: [], node_count: 2, edge_count: 0 } },
      ),
      store,
    )
    expect(backfillGoalThreshold).not.toHaveBeenCalled()
  })

  it('ingests goal_constraints from the response root additively', () => {
    const { store, setGoalConstraints } = makeStore([goalNode])
    const constraints = [
      { constraint_id: 'c1', factor_id: 'f1', label: 'Budget', threshold: 100 },
    ]
    applyV5State(
      responseWith(
        {
          status: 'ready',
          goal_node_id: 'goal-1',
          options: [readyOption],
        },
        { goal_constraints: constraints },
      ),
      store,
    )
    expect(setGoalConstraints).toHaveBeenCalledWith(constraints)
  })

  it('does not call setGoalConstraints when the response carries none (additive only — no clearing)', () => {
    const { store, setGoalConstraints } = makeStore([goalNode])
    applyV5State(
      responseWith({
        status: 'ready',
        goal_node_id: 'goal-1',
        options: [readyOption],
      }),
      store,
    )
    expect(setGoalConstraints).not.toHaveBeenCalled()
  })
})

