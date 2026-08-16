import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoundaryError, OlumiResponse } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import {
  __resetEdgeStrengthCoordinatorForTests,
  beginEdgeStrengthHydration,
  edgeStrengthRunBarrierState,
  finishEdgeStrengthHydration,
  flushEdgeStrengthEditsBeforeRun,
  getEdgeStrengthEndpointStatus,
  getEdgeStrengthRecoverySummary,
  openEdgeStrengthRecoveryRelationship,
  recordEdgeStrengthMutation,
  recordUnconfirmedEdgeStructure,
  recordUnsupportedEdgeMutation,
  registerEdgeStrengthSender,
  requestEdgeStrengthConfirmation,
  setOpenEdgeStrengthScenario,
  settleEdgeStrengthResponse,
  type EdgeStrengthObservation,
} from '../edgeStrengthCoordinator'
import { canvasAnalyticallyMatchesCanonicalGraph } from '../graphAuthority'
import type { WireSystemEvent } from '../../conversation/types'

const SCENARIO_A = '22222222-2222-4222-8222-222222222222'
const SCENARIO_B = '33333333-3333-4333-8333-333333333333'

function observation(mean: number, direction: 'positive' | 'negative'): EdgeStrengthObservation {
  return {
    edgeId: 'rf-opaque-77',
    from: 'fac_demand',
    to: 'goal_profit',
    tuple: { mean, effectDirection: direction, std: 0.1 },
    data: {
      weight: Math.abs(mean),
      direction,
      strengthStd: 0.1,
      strengthStdSource: 'cee',
    },
  }
}

function setVisibleTuple(mean: number, direction: 'positive' | 'negative'): void {
  useCanvasStore.setState((state) => ({
    edges: state.edges.map((edge) => edge.id !== 'rf-opaque-77' ? edge : {
      ...edge,
      data: {
        ...edge.data,
        weight: Math.abs(mean),
        direction,
        strengthStd: 0.1,
        strengthStdSource: 'cee',
        weightSource: 'user',
        directionSource: 'user',
      },
    }) as never,
  }))
}

function eventPayload(event: WireSystemEvent): Record<string, any> {
  return event.payload as Record<string, any>
}

function receiptFor(
  event: WireSystemEvent,
  confirmFreshness: 'fresh' | 'stale' | 'none' | 'unknown' = 'fresh',
): OlumiResponse {
  const payload = eventPayload(event)
  const expected = payload.expected as { mean: number; effect_direction: 'positive' | 'negative' }
  const direction = payload.direction_intent === 'preserve'
    ? expected.effect_direction
    : payload.direction_intent as 'positive' | 'negative'
  const mean = payload.magnitude === 0
    ? 0
    : direction === 'negative' ? -payload.magnitude : payload.magnitude
  const confirm = payload.intent === 'confirm_current'
  const graphHash = confirm ? 'old-hash' : `hash-${direction}-${payload.magnitude}`
  const freshness = confirm ? confirmFreshness : 'stale'
  const graphHashAtRun = freshness === 'fresh'
    ? graphHash
    : freshness === 'stale' ? 'prior-analysis-hash' : null
  return {
    response_version: 2,
    assistant_text: confirm ? 'Confirmed.' : 'Adjusted.',
    stage_indicator: 'analyse',
    suggested_actions: [],
    insights: [],
    blocks: [{
      type: 'graph_patch',
      status: confirm ? 'noop' : 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'fac_demand→goal_profit',
      before: {
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean: expected.mean, std: 0.1 },
        effect_direction: expected.effect_direction,
      },
      after: {
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean, std: 0.1 },
        effect_direction: direction,
      },
    }],
    graph_hash: graphHash,
    analysis_ready: {
      options: [{
        option_id: 'opt_plan_a', label: 'Plan A', status: 'needs_user_mapping',
        interventions: {}, is_baseline: false,
      }],
      goal_node_id: 'goal_profit',
      status: 'needs_user_input',
      computed_at: '2026-08-15T14:00:39.168Z',
      freshness,
      freshness_reason: freshness === 'fresh'
        ? 'graph_hash_match'
        : freshness === 'stale'
          ? 'graph_hash_diverged'
          : freshness === 'none'
            ? 'no_successful_run_analysis_fact'
            : 'derivation_failed',
      ...(graphHashAtRun ? { graph_hash_at_run: graphHashAtRun } : {}),
      current_graph_hash: graphHash,
      canonical_graph_hash_analysis_state: {
        projection_version: 'analysis-affecting.v1',
        options: [{
          id: 'opt_plan_a', label: 'Plan A', status: 'needs_user_mapping',
          interventions: {}, is_baseline: false,
        }],
        goal_node_id: 'goal_profit',
        goal_constraints: [],
      },
    },
    draft_graph: {
      nodes: [
        { id: 'goal_profit', kind: 'goal', label: 'Sustainable profit' },
        {
          id: 'fac_demand', kind: 'factor', label: 'Demand',
          observed_state: { value: 0.55, source: 'cee_inference', cap: 1 },
        },
        { id: 'opt_plan_a', kind: 'option', label: 'Plan A' },
      ],
      edges: [{
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean, std: 0.1 },
        exists_probability: 0.9,
        effect_direction: direction,
        provenance: { source: 'user_specified', reasoning: 'User judgement' },
        provenance_display: 'user_set',
      }],
      node_count: 3,
      edge_count: 1,
    },
  } as OlumiResponse
}

function installSecondRelationship(): void {
  useCanvasStore.setState((state) => ({
    nodes: [...state.nodes, {
      id: 'fac_supply',
      type: 'factor',
      position: { x: 100, y: 100 },
      data: {
        label: 'Supply',
        observedState: { value: 0.4, source: 'cee_inference', cap: 1 },
        prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.8 },
        factor_type: 'continuous',
        intercept: 0.25,
        encoding_map: { low: 0, high: 1 },
        goal_threshold_frame: 'level',
      },
    }] as never,
    edges: [...state.edges, {
      id: 'rf-second-edge',
      source: 'fac_supply',
      target: 'goal_profit',
      data: {
        weight: 0.7,
        direction: 'negative',
        strengthStd: 0.2,
        beliefExists: 0.8,
        confidence: 0.6,
        belief: 0.4,
        strength_mean: -0.91,
        effect_direction: 'negative',
        edge_type: 'bidirected',
      },
    }] as never,
  }))
}

function addCanonicalSecondRelationship(response: OlumiResponse): Record<string, unknown> {
  const graph = response.draft_graph as Record<string, any>
  graph.nodes.push({
    id: 'fac_supply',
    kind: 'factor',
    label: 'Supply',
    observed_state: { value: 0.4, source: 'cee_inference', cap: 1 },
  })
  graph.edges.push({
    from: 'fac_supply',
    to: 'goal_profit',
    strength: { mean: 0.5, std: 0.2 },
    exists_probability: 0.8,
    effect_direction: 'positive',
    provenance: { source: 'cee_hypothesis', reasoning: 'Shared model' },
    provenance_display: 'ai_inferred',
  })
  graph.node_count = graph.nodes.length
  graph.edge_count = graph.edges.length
  return graph
}

function makeHydrationUsable(scenarioId: string): void {
  const revision = beginEdgeStrengthHydration(scenarioId)
  finishEdgeStrengthHydration({ scenarioId, startedAtRevision: revision, usable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  __resetEdgeStrengthCoordinatorForTests()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_A,
    nodes: [
      { id: 'goal_profit', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Sustainable profit' } },
      { id: 'fac_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Demand', observedState: { value: 0.55, source: 'cee_inference', cap: 1 } } },
      { id: 'opt_plan_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Plan A' } },
    ] as never,
    edges: [{
      id: 'rf-opaque-77', source: 'fac_demand', target: 'goal_profit',
      data: {
        weight: 0.4,
        direction: 'negative',
        strengthStd: 0.1,
        strengthStdSource: 'cee',
        beliefExists: 0.9,
        beliefExistsSource: 'cee',
      },
    }] as never,
    analysisFreshness: {
      freshness: 'fresh',
      freshnessReason: 'graph_hash_match',
      currentGraphHash: 'old-hash',
      graphHashAtRun: 'old-hash',
      computedAt: '2026-08-15T13:00:00.000Z',
    },
    analysisFreshnessDirty: false,
  })
  setOpenEdgeStrengthScenario(SCENARIO_A)
  makeHydrationUsable(SCENARIO_A)
})

afterEach(() => {
  __resetEdgeStrengthCoordinatorForTests()
  vi.useRealTimers()
})

describe('edge strength transaction lifecycle', () => {
  it('Run inside the 1.5 s debounce force-sends and awaits the exact receipt', async () => {
    const events: WireSystemEvent[] = []
    registerEdgeStrengthSender(async (event, attemptId) => {
      events.push(event)
      settleEdgeStrengthResponse({ attemptId, response: receiptFor(event) })
      return undefined
    })
    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    const result = await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)

    expect(result).toEqual({ ok: true })
    expect(events).toHaveLength(1)
    expect(eventPayload(events[0])).toEqual({
      from: 'fac_demand',
      to: 'goal_profit',
      magnitude: 0.7,
      direction_intent: 'preserve',
      expected: { mean: -0.4, effect_direction: 'negative' },
      intent: 'set',
    })
    expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind).toBe('saved')
    expect(useCanvasStore.getState().edges[0]?.data).toMatchObject({
      weightSource: 'user',
      directionSource: 'user',
      strengthStdSource: 'shared',
      beliefExistsSource: 'shared',
      provenanceDisplay: 'user_set',
    })
  })

  it('applies default-valued canonical changes on a non-target edge before releasing Run', async () => {
    installSecondRelationship()
    useCanvasStore.setState({
      goalConstraints: [{
        constraint_id: 'stale-local-constraint',
        node_id: 'goal_profit',
        operator: '>=',
        value: 0.8,
      }],
    })
    let canonicalGraph: Record<string, unknown> | null = null
    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event)
      canonicalGraph = addCanonicalSecondRelationship(response)
      // This is the historical under-apply mutant: the target edge already
      // matches, while the other edge still holds local 0.7/negative bytes.
      expect(canvasAnalyticallyMatchesCanonicalGraph(canonicalGraph)).toBe(false)
      settleEdgeStrengthResponse({ attemptId, response })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves.toEqual({ ok: true })
    const secondEdgeData = useCanvasStore.getState().edges
      .find((edge) => edge.id === 'rf-second-edge')?.data
    expect(secondEdgeData).toMatchObject({
        weight: 0.5,
        direction: 'positive',
        strengthStd: 0.2,
        confidence: undefined,
      })
    expect(secondEdgeData).not.toHaveProperty('belief')
    expect(secondEdgeData).not.toHaveProperty('strength_mean')
    expect(secondEdgeData).not.toHaveProperty('effect_direction')
    expect(secondEdgeData).not.toHaveProperty('edge_type')
    const secondNodeData = useCanvasStore.getState().nodes
      .find((node) => node.id === 'fac_supply')?.data
    expect(secondNodeData).not.toHaveProperty('prior')
    expect(secondNodeData).not.toHaveProperty('factor_type')
    expect(secondNodeData).not.toHaveProperty('intercept')
    expect(secondNodeData).not.toHaveProperty('encoding_map')
    expect(secondNodeData).not.toHaveProperty('goal_threshold_frame')
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
    expect(canvasAnalyticallyMatchesCanonicalGraph(canonicalGraph)).toBe(true)
  })

  it('retains a genuinely newer protected field but keeps Run held on the mixed graph', async () => {
    installSecondRelationship()
    let canonicalGraph: Record<string, unknown> | null = null
    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event)
      canonicalGraph = addCanonicalSecondRelationship(response)
      useCanvasStore.setState((state) => ({
        edges: state.edges.map((edge) => edge.id !== 'rf-second-edge'
          ? edge
          : { ...edge, data: { ...edge.data, confidence: 0.77 } }) as never,
      }))
      recordUnsupportedEdgeMutation({
        scenarioId: SCENARIO_A,
        edgeId: 'rf-second-edge',
        from: 'fac_supply',
        to: 'goal_profit',
        field: 'confidence',
        before: 0.6,
        after: 0.77,
      })
      settleEdgeStrengthResponse({ attemptId, response })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    const result = await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)
    expect(result.ok).toBe(false)
    expect(useCanvasStore.getState().edges.find((edge) => edge.id === 'rf-second-edge')?.data)
      .toMatchObject({ weight: 0.5, direction: 'positive', confidence: 0.77 })
    expect(canvasAnalyticallyMatchesCanonicalGraph(canonicalGraph)).toBe(false)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(getEdgeStrengthRecoverySummary(SCENARIO_A).items)
      .toContainEqual(expect.objectContaining({
        from: 'fac_supply',
        to: 'goal_profit',
        kind: 'unsupported_fields',
      }))
  })

  it('rejects a protected mixed projection when no writer or issue owns its Run hold', async () => {
    registerEdgeStrengthSender(async (event, attemptId) => {
      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((node) => node.id !== 'fac_demand'
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                observedState: { value: 0.8, source: 'user', cap: 1 },
              },
            }),
      }))
      settleEdgeStrengthResponse({
        attemptId,
        response: receiptFor(event),
        protectedFactorNodeIds: ['fac_demand'],
      })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves
      .toMatchObject({ ok: false })
    expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind)
      .toBe('unconfirmed')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe('old-hash')
  })

  it('fails closed when a non-target under-apply mutant breaks the receipt projection', async () => {
    installSecondRelationship()
    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event)
      addCanonicalSecondRelationship(response)
      const unsubscribe = useCanvasStore.subscribe((state) => {
        const edge = state.edges.find((candidate) => candidate.id === 'rf-second-edge')
        const data = edge?.data
        if (data?.weight !== 0.5 || data.direction !== 'positive') return
        useCanvasStore.setState((current) => ({
          edges: current.edges.map((candidate) => candidate.id !== 'rf-second-edge'
            ? candidate
            : {
                ...candidate,
                data: { ...candidate.data, weight: 0.7, direction: 'negative' },
              }) as never,
        }))
      })
      settleEdgeStrengthResponse({ attemptId, response })
      unsubscribe()
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    const result = await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)
    expect(result.ok).toBe(false)
    expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind)
      .toBe('unconfirmed')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe('old-hash')
  })

  it('holds Run and preserves readiness byte-for-byte when constraint exactness is sabotaged', async () => {
    const staleConstraint = {
      constraint_id: 'stale-local-constraint',
      node_id: 'goal_profit',
      operator: '>=' as const,
      value: 0.8,
    }
    useCanvasStore.setState({
      goalConstraints: [staleConstraint],
      ceeAnalysisReady: {
        options: [],
        goal_node_id: 'goal_profit',
        status: 'needs_user_input',
        freshness: 'fresh',
        freshness_reason: 'graph_hash_match',
      } as never,
    })
    const readinessBefore = structuredClone(useCanvasStore.getState().ceeAnalysisReady)
    const freshnessBefore = structuredClone(useCanvasStore.getState().analysisFreshness)

    registerEdgeStrengthSender(async (event, attemptId) => {
      let sabotaged = false
      const unsubscribe = useCanvasStore.subscribe((state) => {
        if (sabotaged || state.goalConstraints !== null) return
        sabotaged = true
        useCanvasStore.setState({ goalConstraints: [staleConstraint] })
      })
      settleEdgeStrengthResponse({ attemptId, response: receiptFor(event) })
      unsubscribe()
      expect(sabotaged).toBe(true)
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves
      .toMatchObject({ ok: false })
    expect(useCanvasStore.getState().ceeAnalysisReady).toEqual(readinessBefore)
    expect(useCanvasStore.getState().analysisFreshness).toEqual(freshnessBefore)
    expect(useCanvasStore.getState().goalConstraints).toEqual([staleConstraint])
    expect(edgeStrengthRunBarrierState(SCENARIO_A)).toMatchObject({ ok: false })
    expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind)
      .toBe('unconfirmed')
  })

  it('uses a typed recovery hold when the canonical analysis-state attestation is absent', async () => {
    const priorAnalysisReady = {
      options: [{
        id: 'opt_plan_a',
        label: 'Plan A',
        status: 'ready',
        interventions: {},
      }],
      goal_node_id: 'goal_profit',
      status: 'ready',
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
    }
    useCanvasStore.setState({ ceeAnalysisReady: priorAnalysisReady } as never)
    const readinessBefore = structuredClone(useCanvasStore.getState().ceeAnalysisReady)
    const freshnessBefore = structuredClone(useCanvasStore.getState().analysisFreshness)

    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event) as unknown as Record<string, any>
      delete response.analysis_ready.canonical_graph_hash_analysis_state
      settleEdgeStrengthResponse({ attemptId, response: response as never })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves.toEqual({
      ok: false,
      reason: 'The shared model did not provide a complete analysis-input receipt. Check the shared model before running analysis.',
    })
    expect(useCanvasStore.getState().edgeStrengthSync.issue)
      .toBe('analysis_state_unverified')
    expect(useCanvasStore.getState().ceeAnalysisReady).toEqual(readinessBefore)
    expect(useCanvasStore.getState().analysisFreshness).toEqual(freshnessBefore)
    expect(edgeStrengthRunBarrierState(SCENARIO_A)).toMatchObject({ ok: false })
  })

  it('preserves readiness and freshness byte-for-byte on a valid-shaped but mismatched attestation', async () => {
    const priorAnalysisReady = {
      options: [{
        id: 'opt_prior',
        label: 'Prior option',
        status: 'ready',
        interventions: {},
      }],
      goal_node_id: 'goal_profit',
      status: 'ready',
      freshness: 'fresh',
    }
    useCanvasStore.setState({ ceeAnalysisReady: priorAnalysisReady } as never)
    const readinessBefore = structuredClone(useCanvasStore.getState().ceeAnalysisReady)
    const freshnessBefore = structuredClone(useCanvasStore.getState().analysisFreshness)

    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event) as unknown as Record<string, any>
      // Both objects remain individually valid. Their goal identity differs,
      // so the outer Run payload cannot attest to the hashed state.
      response.analysis_ready.goal_node_id = 'goal_other'
      settleEdgeStrengthResponse({ attemptId, response: response as never })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves
      .toMatchObject({ ok: false })
    expect(useCanvasStore.getState().edgeStrengthSync.issue)
      .toBe('analysis_state_unverified')
    expect(useCanvasStore.getState().ceeAnalysisReady).toEqual(readinessBefore)
    expect(useCanvasStore.getState().analysisFreshness).toEqual(freshnessBefore)
    expect(edgeStrengthRunBarrierState(SCENARIO_A)).toMatchObject({ ok: false })
  })

  it('stores exact encoded/raw option identity before releasing the coordinator Run barrier', async () => {
    const exactOption = {
      id: 'opt_plan_a',
      option_id: 'opt_plan_a',
      label: 'Plan A',
      status: 'needs_encoding',
      is_baseline: false,
      interventions: {
        fac_demand: {
          value: 0.4,
          value_type: 'continuous',
          encoding_map: { low: 0, high: 1 },
          target_match: { node_id: 'fac_demand', match_type: 'semantic' },
          source: 'user_specified',
        },
      },
      raw_interventions: { fac_demand: { raw_value: 'medium' } },
    }
    registerEdgeStrengthSender(async (event, attemptId) => {
      const response = receiptFor(event) as unknown as Record<string, any>
      response.analysis_ready.options = [exactOption]
      response.analysis_ready.status = 'needs_encoding'
      response.analysis_ready.canonical_graph_hash_analysis_state.options = [exactOption]
      settleEdgeStrengthResponse({ attemptId, response: response as never })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves.toEqual({ ok: true })
    expect(useCanvasStore.getState().ceeAnalysisReady?.options[0]).toMatchObject(exactOption)
    expect(edgeStrengthRunBarrierState(SCENARIO_A)).toEqual({ ok: true })
  })

  it('coalesces first-before/latest-after and converts a return to baseline into confirm_current', async () => {
    const events: WireSystemEvent[] = []
    registerEdgeStrengthSender(async (event, attemptId) => {
      events.push(event)
      settleEdgeStrengthResponse({ attemptId, response: receiptFor(event) })
      return undefined
    })

    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })
    setVisibleTuple(-0.4, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.7, 'negative'),
      after: observation(-0.4, 'negative'),
    })

    expect((await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).ok).toBe(true)
    expect(events).toHaveLength(1)
    expect(eventPayload(events[0])).toMatchObject({
      magnitude: 0.4,
      direction_intent: 'preserve',
      expected: { mean: -0.4, effect_direction: 'negative' },
      intent: 'confirm_current',
    })
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

  it.each(['stale', 'none', 'unknown'] as const)(
    'settles a coherent %s confirmation without invoking the fresh-only clear',
    async (freshness) => {
      const clearFreshness = vi.spyOn(
        useCanvasStore.getState(),
        'clearAnalysisFreshnessDirty',
      )
      registerEdgeStrengthSender(async (event, attemptId) => {
        settleEdgeStrengthResponse({ attemptId, response: receiptFor(event, freshness) })
        return undefined
      })
      useCanvasStore.getState().markAnalysisFreshnessDirty()
      expect(requestEdgeStrengthConfirmation(SCENARIO_A, 'rf-opaque-77')).toBe(true)

      await expect(flushEdgeStrengthEditsBeforeRun(SCENARIO_A)).resolves.toEqual({ ok: true })

      expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind)
        .toBe('confirmed')
      expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe(freshness)
      expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
      expect(clearFreshness).not.toHaveBeenCalled()
      clearFreshness.mockRestore()
    },
  )

  it('keeps an ambiguous transport outcome unresolved and blocks Run', async () => {
    registerEdgeStrengthSender(async () => { throw new Error('connection lost') })
    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    const result = await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/could not verify/i)
    expect(getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit').kind).toBe('unconfirmed')
    expect((useCanvasStore.getState().edges[0]?.data as any).weight).toBe(0.7)
    expect(getEdgeStrengthRecoverySummary(SCENARIO_A)).toEqual({
      items: [{
        from: 'fac_demand',
        to: 'goal_profit',
        label: 'Demand → Sustainable profit',
        kind: 'unconfirmed',
        relationshipExists: true,
      }],
      total: 1,
      remaining: 0,
    })
  })

  it('a typed 409 adopts current only when safe, retains dissent, and never retries blindly', async () => {
    const sender = vi.fn(async (_event: WireSystemEvent, attemptId: string) => {
      settleEdgeStrengthResponse({
        attemptId,
        boundaryError: {
          error: 'GRAPH_DIVERGED',
          message: 'Graph diverged',
          retryable: false,
          details: {
            recovery_action: 'refresh_and_reconfirm',
            edge: { current: { mean: -0.5, std: 0.1, effect_direction: 'negative' } },
          },
        } as unknown as BoundaryError,
      })
      throw new Error('typed refusal propagated by system sender')
    })
    registerEdgeStrengthSender(sender)
    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })

    const result = await flushEdgeStrengthEditsBeforeRun(SCENARIO_A)
    expect(result.ok).toBe(false)
    expect(sender).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(sender).toHaveBeenCalledTimes(1)
    const status = getEdgeStrengthEndpointStatus(SCENARIO_A, 'fac_demand', 'goal_profit')
    expect(status.kind).toBe('conflict')
    if (status.kind !== 'conflict') return
    expect(status.recovery.attempted.mean).toBe(-0.7)
    expect(status.recovery.sharedCurrent?.mean).toBe(-0.5)
    expect((useCanvasStore.getState().edges[0]?.data as any).weight).toBe(0.5)
    expect(useCanvasStore.getState().edges[0]?.data).toMatchObject({
      weightSource: 'shared',
      directionSource: 'shared',
      strengthStdSource: 'shared',
      userReviewedStrength: false,
    })
  })

  it('scenario switch resolves an old Run waiter and cannot cross-apply the queued edit', async () => {
    const sender = vi.fn(async () => 'send_blocked' as const)
    registerEdgeStrengthSender(sender)
    setVisibleTuple(-0.7, 'negative')
    recordEdgeStrengthMutation({
      scenarioId: SCENARIO_A,
      before: observation(-0.4, 'negative'),
      after: observation(-0.7, 'negative'),
    })
    const flush = flushEdgeStrengthEditsBeforeRun(SCENARIO_A)
    await vi.advanceTimersByTimeAsync(0)

    useCanvasStore.setState({ currentScenarioId: SCENARIO_B })
    setOpenEdgeStrengthScenario(SCENARIO_B)
    makeHydrationUsable(SCENARIO_B)

    await expect(flush).resolves.toMatchObject({ ok: false })
    expect(sender).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sender).toHaveBeenCalledTimes(1)
  })

  it('summarises removed, reconnected, and unsupported relationships without exposing RF ids', () => {
    useCanvasStore.setState({
      edges: [{
        id: 'rf-reconnected-secret',
        source: 'opt_plan_a',
        target: 'goal_profit',
        data: { weight: 0.4, direction: 'positive' },
      }] as never,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      showInspectorPanel: false,
    })
    recordUnconfirmedEdgeStructure({
      scenarioId: SCENARIO_A,
      edgeId: 'rf-opaque-77',
      from: 'fac_demand',
      to: 'goal_profit',
      operation: 'remove',
    })
    recordUnconfirmedEdgeStructure({
      scenarioId: SCENARIO_A,
      edgeId: 'rf-reconnected-secret',
      from: 'opt_plan_a',
      to: 'goal_profit',
      operation: 'reconnect',
    })
    recordUnsupportedEdgeMutation({
      scenarioId: SCENARIO_A,
      edgeId: 'rf-reconnected-secret',
      from: 'opt_plan_a',
      to: 'goal_profit',
      field: 'confidence',
      before: 0.5,
      after: 0.7,
    })

    const summary = getEdgeStrengthRecoverySummary(SCENARIO_A)
    expect(summary).toMatchObject({ total: 2, remaining: 0 })
    expect(summary.items).toEqual([
      {
        from: 'opt_plan_a',
        to: 'goal_profit',
        label: 'Plan A → Sustainable profit',
        kind: 'unsupported_fields',
        relationshipExists: true,
      },
      {
        from: 'fac_demand',
        to: 'goal_profit',
        label: 'Demand → Sustainable profit',
        kind: 'unconfirmed_structure',
        relationshipExists: false,
      },
    ])
    expect(JSON.stringify(summary)).not.toContain('rf-')
    expect(openEdgeStrengthRecoveryRelationship(
      SCENARIO_A,
      'fac_demand',
      'goal_profit',
    )).toBe(false)
    expect(openEdgeStrengthRecoveryRelationship(
      SCENARIO_A,
      'opt_plan_a',
      'goal_profit',
    )).toBe(true)
    expect(useCanvasStore.getState().selection.edgeIds).toEqual(new Set(['rf-reconnected-secret']))
    expect(useCanvasStore.getState().showInspectorPanel).toBe(true)
  })

  it('bounds a many-relationship recovery list and falls back to canonical endpoint labels', () => {
    useCanvasStore.setState({ edges: [] })
    for (let index = 0; index < 5; index += 1) {
      recordUnconfirmedEdgeStructure({
        scenarioId: SCENARIO_A,
        edgeId: `rf-hidden-${index}`,
        from: `missing_source_${index}`,
        to: `missing_target_${index}`,
        operation: 'remove',
      })
    }

    const summary = getEdgeStrengthRecoverySummary(SCENARIO_A)
    expect(summary).toMatchObject({ total: 5, remaining: 2 })
    expect(summary.items).toHaveLength(3)
    expect(summary.items[0]?.label).toBe('missing_source_0 → missing_target_0')
    expect(JSON.stringify(summary)).not.toContain('rf-hidden')
  })
})
