import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoundaryError, OlumiResponse } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import {
  __resetEdgeStrengthCoordinatorForTests,
  beginEdgeStrengthHydration,
  finishEdgeStrengthHydration,
  flushEdgeStrengthEditsBeforeRun,
  getEdgeStrengthEndpointStatus,
  recordEdgeStrengthMutation,
  registerEdgeStrengthSender,
  setOpenEdgeStrengthScenario,
  settleEdgeStrengthResponse,
  type EdgeStrengthObservation,
} from '../edgeStrengthCoordinator'
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

function receiptFor(event: WireSystemEvent): OlumiResponse {
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
      freshness: confirm ? 'fresh' : 'stale',
      freshness_reason: confirm ? 'graph_hash_match' : 'graph_hash_diverged',
      graph_hash_at_run: 'old-hash',
      current_graph_hash: graphHash,
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
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

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
})
