/**
 * The CONCURRENT path for inspector value edits (ROADMAP 1.346, review HIGH).
 *
 * THE DEFECT THIS PINS. `sendTurn`'s in-flight lock used to answer a blocked
 * system-mode send with a bare `return`: a DEV-only `console.warn`, a promise
 * that RESOLVES, no `SystemEventSendError`, and nothing whatsoever in
 * production. Because the lock is held for an entire analysis round trip, an
 * inspector edit made while an analysis was running was ALWAYS dropped — and
 * then the completing run's own `analysis_ready` verdict cleared the dirty
 * overlay, so the strip affirmed "reflects the current model" over a value the
 * server had never seen. Alarm → futile action → false reassurance: the exact
 * sequence this whole roadmap item exists to kill, reintroduced one path over.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE PANEL SPEC. The panel spec mocks
 * `ConversationContext`, which sits ABOVE the dispatcher — so it cannot see the
 * lock at all, and was structurally blind to this. These tests drive the REAL
 * `useConversation` dispatcher and assert on the payload that reaches the
 * transport (`callV5Turn`), which is the only place the truth is visible.
 *
 * The typo-correction case is the one that matters most: commit 20000, correct
 * to 25000 before the in-flight turn returns. Under the defect BOTH were
 * dropped; a naive queue that appends would persist 20000 LAST and leave the
 * server on the wrong number. The user's FINAL value must be the one that
 * lands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'
import {
  __resetEdgeStrengthCoordinatorForTests,
  beginEdgeStrengthHydration,
  finishEdgeStrengthHydration,
  getEdgeStrengthEndpointStatus,
  requestEdgeStrengthConfirmation,
  setOpenEdgeStrengthScenario,
} from '../../edge-strength/edgeStrengthCoordinator'
import { useGraphEditEvents } from '../useGraphEditEvents'

// Mock the TRANSPORT, not the context — `importOriginal` spread so the module's
// other exports (getV5Endpoint et al.) stay real (CLAUDE.md trap 12: a hand
// listed vi.mock factory REPLACES the module and silently drops what it omits).
const dispatched: Array<Record<string, unknown>> = []
let resolveInFlight: ((v: unknown) => void) | null = null
/** When set, every dispatch AFTER the first (the lock-holder) rejects. */
let failFlushDispatch = false
/** Fail the first held request when it is released (direct-writer mutant). */
let failHeldDispatch = false
let edgeConfirmFreshness: 'fresh' | 'stale' | 'none' | 'unknown' = 'fresh'
/** Keep analysis_ready valid while making the composite writer receipt invalid. */
let invalidateEdgeReceiptGraph = false

function edgeStrengthReceipt(event: Record<string, unknown>) {
  const expected = event.expected as {
    mean: number
    effect_direction: 'positive' | 'negative'
  }
  const direction = event.direction_intent === 'preserve'
    ? expected.effect_direction
    : event.direction_intent as 'positive' | 'negative'
  const magnitude = event.magnitude as number
  const mean = magnitude === 0 ? 0 : direction === 'negative' ? -magnitude : magnitude
  const confirm = event.intent === 'confirm_current'
  const graphHash = confirm ? 'old-hash' : 'new-hash'
  const freshness = confirm ? edgeConfirmFreshness : 'stale'
  const graphHashAtRun = freshness === 'fresh'
    ? graphHash
    : freshness === 'stale' ? 'prior-analysis-hash' : null

  return {
    response_version: 2,
    assistant_text: '',
    stage_indicator: 'analyse',
    suggested_actions: [],
    insights: [],
    blocks: [{
      type: 'graph_patch',
      status: confirm ? 'noop' : 'applied',
      operation: 'adjust_edge_strength',
      target_id: `${String(event.from)}→${String(event.to)}`,
      before: {
        from: event.from,
        to: event.to,
        strength: { mean: expected.mean, std: 0.1 },
        effect_direction: expected.effect_direction,
      },
      after: {
        from: event.from,
        to: event.to,
        strength: { mean, std: 0.1 },
        effect_direction: direction,
      },
    }],
    graph_hash: graphHash,
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
        from: event.from,
        to: event.to,
        strength: { mean, std: 0.1 },
        exists_probability: 0.9,
        effect_direction: direction,
        provenance: { source: 'user_specified', reasoning: 'User judgement' },
        provenance_display: 'user_set',
      }],
      node_count: 3,
      edge_count: 1,
    },
  }
}

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  },
  getSessionIdentity: () => Promise.resolve({ userId: 'test-user', accessToken: null }),
  getUserId: () => Promise.resolve('test-user'),
}))

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      // The FIRST turn is held open so later sends genuinely collide with the
      // in-flight lock — this is the concurrency the defect lived in.
      if (dispatched.length === 1) {
        await new Promise((res) => { resolveInFlight = res })
        if (failHeldDispatch) throw new TypeError('Failed to fetch')
      } else if (failFlushDispatch) {
        throw new TypeError('Failed to fetch')
      }
      const event = payload.event as Record<string, unknown> | undefined
      if (event?.kind === 'edge_strength_edit') {
        const response = edgeStrengthReceipt(event)
        if (invalidateEdgeReceiptGraph) response.draft_graph.node_count = 99
        return { ok: true, response }
      }
      const factorReceipt = event?.kind === 'factor_value_edit'
        ? [{
            type: 'graph_patch',
            status: 'applied',
            operation: 'set_factor_value',
            target_id: event.target_id,
            before: { value: 0.2, raw_value: 10_000, unit: event.unit },
            after: { value: event.value, raw_value: event.raw_value, unit: event.unit },
          }]
        : []
      return { ok: true, response: { assistant_text: factorReceipt.length > 0 ? '' : 'ok', blocks: factorReceipt } }
    }),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
    isV5CanonicalAnalysisEnabled: () => true,
  }
})

import { SEND_BLOCKED, SEND_DEFERRED, useConversation } from '../useConversation'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const edit = (target: string, value: number, raw: number): WireSystemEvent => ({
  type: 'factor_value_edit',
  payload: { target_id: target, value, raw_value: raw, unit: '£', field: 'value' },
})

/** Every factor_value_edit that actually reached the transport, in order. */
function dispatchedEdits() {
  return dispatched
    .filter((p) => (p as { event?: { kind?: string } }).event?.kind === 'factor_value_edit')
    .map((p) => (p as { event: Record<string, unknown> }).event)
}

function dispatchedRuns() {
  return dispatched.filter((payload) => (
    payload.kind === 'message' && payload.message === 'Run analysis'
  ))
}

const flush = async () => {
  // Drain microtasks AND macrotasks. The buffer flushes on a microtask from the
  // releasing turn's finally, each dispatch re-enters the drain, and the
  // response-processing path in between contains real awaits — so a fixed
  // microtask count is not enough. Loop on timers until it settles.
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function seedCanonicalEdgeGraph(): void {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'goal_profit',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { label: 'Sustainable profit' },
      },
      {
        id: 'fac_demand',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Demand',
          observedState: { value: 0.55, source: 'cee_inference', cap: 1 },
        },
      },
      {
        id: 'opt_plan_a',
        type: 'option',
        position: { x: 0, y: 0 },
        data: { label: 'Plan A' },
      },
    ] as never,
    edges: [{
      id: 'opaque-rf-edge-id',
      source: 'fac_demand',
      target: 'goal_profit',
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
    _externalMutationActive: 0,
  } as never)
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  __resetEdgeStrengthCoordinatorForTests()
  dispatched.length = 0
  resolveInFlight = null
  failFlushDispatch = false
  failHeldDispatch = false
  edgeConfirmFreshness = 'fresh'
  invalidateEdgeReceiptGraph = false
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    ceeAnalysisReady: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  setOpenEdgeStrengthScenario(SCENARIO)
  const hydrationRevision = beginEdgeStrengthHydration(SCENARIO)
  finishEdgeStrengthHydration({
    scenarioId: SCENARIO,
    startedAtRevision: hydrationRevision,
    usable: true,
  })
})
afterEach(() => {
  __resetEdgeStrengthCoordinatorForTests()
  vi.unstubAllEnvs()
})

describe('canonical Run waits for the complete value-writer transaction', () => {
  it('forces a debounced relationship edit onto the wire before Run and awaits its exact receipt', async () => {
    useCanvasStore.setState({
      nodes: [
        {
          id: 'goal_profit',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Sustainable profit' },
        },
        {
          id: 'fac_demand',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Demand',
            observedState: { value: 0.55, source: 'cee_inference', cap: 1 },
          },
        },
        {
          id: 'opt_plan_a',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Plan A' },
        },
      ] as never,
      edges: [{
        id: 'opaque-rf-edge-id',
        source: 'fac_demand',
        target: 'goal_profit',
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
      _externalMutationActive: 0,
    } as never)

    const { result } = renderHook(() => {
      const conversation = useConversation()
      useGraphEditEvents(conversation.sendSystemEvent, { isThinking: conversation.isThinking })
      return conversation
    })

    // This local write is still inside the coordinator's 1.5 s debounce when
    // Run is clicked. The dispatch-time barrier must force it immediately.
    act(() => {
      useCanvasStore.setState((state) => ({
        edges: state.edges.map((edge) => edge.id !== 'opaque-rf-edge-id' ? edge : {
          ...edge,
          data: {
            ...edge.data,
            weight: 0.7,
            weightSource: 'user',
            directionSource: 'user',
            provenanceDisplay: 'user_set',
            userReviewedStrength: true,
          },
        }) as never,
      }))
    })

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()

    expect(dispatched).toHaveLength(1)
    expect(dispatchedRuns(), 'Run must not overtake the relationship receipt').toHaveLength(0)
    expect(dispatched[0]).toMatchObject({
      kind: 'system_event',
      event: {
        kind: 'edge_strength_edit',
        from: 'fac_demand',
        to: 'goal_profit',
        magnitude: 0.7,
        direction_intent: 'preserve',
        expected: { mean: -0.4, effect_direction: 'negative' },
        intent: 'set',
      },
    })

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(dispatched).toHaveLength(2)
    expect(dispatched[1]).toMatchObject({ kind: 'message', message: 'Run analysis' })
    expect(useCanvasStore.getState().edgeStrengthSync).toMatchObject({
      queued: 0,
      inFlight: 0,
      issue: null,
    })
    expect(useCanvasStore.getState().ceeAnalysisReady).toMatchObject({
      goal_node_id: 'goal_profit',
      status: 'needs_user_input',
    })
    expect(useCanvasStore.getState().analysisFreshness).toMatchObject({
      freshness: 'stale',
      currentGraphHash: 'new-hash',
      graphHashAtRun: 'prior-analysis-hash',
    })
  })

  it('an invalid composite receipt cannot leak valid readiness or freshness through generic state apply', async () => {
    seedCanonicalEdgeGraph()
    const priorAnalysisReady = {
      options: [{
        id: 'opt_plan_a',
        label: 'Plan A',
        status: 'ready',
        interventions: {},
      }],
      goal_node_id: 'goal_profit',
      status: 'ready',
      computed_at: '2026-08-15T13:00:00.000Z',
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
      graph_hash_at_run: 'old-hash',
      current_graph_hash: 'old-hash',
    }
    useCanvasStore.setState({ ceeAnalysisReady: priorAnalysisReady } as never)
    const priorFreshness = structuredClone(useCanvasStore.getState().analysisFreshness)
    invalidateEdgeReceiptGraph = true

    const { result } = renderHook(() => {
      const conversation = useConversation()
      useGraphEditEvents(conversation.sendSystemEvent, { isThinking: conversation.isThinking })
      return conversation
    })

    act(() => {
      useCanvasStore.setState((state) => ({
        edges: state.edges.map((edge) => edge.id !== 'opaque-rf-edge-id' ? edge : {
          ...edge,
          data: { ...edge.data, weight: 0.7, weightSource: 'user' },
        }) as never,
      }))
    })

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()
    expect(dispatchedRuns()).toHaveLength(0)

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(dispatchedRuns(), 'Run must remain behind the rejected writer receipt').toHaveLength(0)
    expect(getEdgeStrengthEndpointStatus(SCENARIO, 'fac_demand', 'goal_profit').kind)
      .toBe('unconfirmed')
    expect(useCanvasStore.getState().edgeStrengthSync.issue).toBe('unconfirmed')
    expect(useCanvasStore.getState().ceeAnalysisReady).toEqual(priorAnalysisReady)
    expect(useCanvasStore.getState().analysisFreshness).toEqual(priorFreshness)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('mounts a first-run none confirmation, settles it, then dispatches Run after the noop receipt', async () => {
    seedCanonicalEdgeGraph()
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    edgeConfirmFreshness = 'none'
    const { result } = renderHook(() => {
      const conversation = useConversation()
      useGraphEditEvents(conversation.sendSystemEvent, { isThinking: conversation.isThinking })
      return conversation
    })

    act(() => {
      expect(requestEdgeStrengthConfirmation(SCENARIO, 'opaque-rf-edge-id')).toBe(true)
    })
    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({
      kind: 'system_event',
      event: { kind: 'edge_strength_edit', intent: 'confirm_current' },
    })
    expect(dispatchedRuns()).toHaveLength(0)

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('none')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().edgeStrengthSync.issue).toBeNull()
    expect(dispatchedRuns()).toHaveLength(1)
    const transcript = result.current.messages.map((message) => String(message.content))
    expect(transcript).not.toContain('')
    expect(transcript.join(' ')).not.toMatch(/I received your message/i)
  })

  it('does not preempt an active factor writer and dispatches Run only after it settles', async () => {
    const { result } = renderHook(() => useConversation())

    let factorDone: Promise<unknown> | undefined
    act(() => {
      factorDone = result.current.sendSystemEvent(edit('fac_a', 0.4, 20_000))
    })
    await flush()
    expect(dispatchedEdits()).toHaveLength(1)
    expect(useCanvasStore.getState().activeEmittedEdits).toBe(1)

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()

    expect(dispatched, 'Run must remain behind the writer receipt').toHaveLength(1)
    expect(useCanvasStore.getState().activeEmittedEdits).toBe(1)

    await act(async () => {
      resolveInFlight?.(undefined)
      await factorDone
      await runDone
      await flush()
    })

    expect(dispatched).toHaveLength(2)
    expect((dispatched[0] as { event?: { kind?: string } }).event?.kind).toBe('factor_value_edit')
    expect(dispatched[1]).toMatchObject({ kind: 'message', message: 'Run analysis' })
    expect(useCanvasStore.getState().activeEmittedEdits).toBe(0)
  })

  it('drains a factor edit queued while the edge barrier is awaiting its receipt', async () => {
    seedCanonicalEdgeGraph()
    const { result } = renderHook(() => {
      const conversation = useConversation()
      useGraphEditEvents(conversation.sendSystemEvent, { isThinking: conversation.isThinking })
      return conversation
    })

    act(() => {
      useCanvasStore.setState((state) => ({
        edges: state.edges.map((edge) => edge.id !== 'opaque-rf-edge-id' ? edge : {
          ...edge,
          data: { ...edge.data, weight: 0.7, weightSource: 'user' },
        }) as never,
      }))
    })

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()
    expect((dispatched[0] as { event?: { kind?: string } }).event?.kind).toBe('edge_strength_edit')

    act(() => {
      useCanvasStore.setState((state) => ({
        nodes: state.nodes.map((node) => node.id !== 'fac_demand' ? node : {
          ...node,
          data: {
            ...node.data,
            observedState: { value: 0.75, raw_value: 25_000, unit: '£' },
          },
        }) as never,
      }))
    })
    await act(async () => {
      expect(await result.current.sendSystemEvent(edit('fac_demand', 0.75, 25_000))).toBe(SEND_DEFERRED)
    })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(dispatched.map((payload) => (
      (payload as { event?: { kind?: string } }).event?.kind ?? payload.kind
    ))).toEqual(['edge_strength_edit', 'factor_value_edit', 'message'])
    expect(dispatchedRuns()).toHaveLength(1)
    expect(useCanvasStore.getState().nodes.find((node) => node.id === 'fac_demand')?.data)
      .toMatchObject({ observedState: { value: 0.75, raw_value: 25_000, unit: '£' } })
    expect(useCanvasStore.getState()).toMatchObject({
      pendingEmittedEdits: 0,
      activeEmittedEdits: 0,
      unconfirmedEmittedEdits: 0,
    })
  })

  it('blocks Run when an active factor writer loses its receipt', async () => {
    const { result } = renderHook(() => useConversation())

    let factorFailure: unknown = null
    let factorDone: Promise<unknown> | undefined
    act(() => {
      factorDone = result.current
        .sendSystemEvent(edit('fac_a', 0.4, 20_000))
        .catch((error) => { factorFailure = error })
    })
    await flush()
    expect(dispatchedEdits()).toHaveLength(1)

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()
    expect(dispatchedRuns()).toHaveLength(0)

    failHeldDispatch = true
    await act(async () => {
      resolveInFlight?.(undefined)
      await factorDone
      await runDone
      await flush()
    })

    expect(factorFailure).toMatchObject({ name: 'SystemEventSendError' })
    expect(dispatchedRuns(), 'Run must not analyse the pre-edit server graph').toHaveLength(0)
    expect(useCanvasStore.getState().activeEmittedEdits).toBe(0)
    expect(useCanvasStore.getState().unconfirmedEmittedEdits).toBeGreaterThan(0)
  })

  it('drains a queued factor writer before Run, preserving chat → writer → Run ordering', async () => {
    const { result } = renderHook(() => useConversation())

    act(() => { void result.current.sendMessage('Help me frame this') })
    await flush()
    expect(dispatched).toHaveLength(1)

    await act(async () => {
      expect(await result.current.sendSystemEvent(edit('fac_a', 0.5, 25_000))).toBe(SEND_DEFERRED)
    })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })
    await flush()
    expect(dispatched, 'Run cannot overtake the queued writer').toHaveLength(1)

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(dispatched).toHaveLength(3)
    expect((dispatched[1] as { event?: { kind?: string } }).event?.kind).toBe('factor_value_edit')
    expect(dispatched[2]).toMatchObject({ kind: 'message', message: 'Run analysis' })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })

  it('never dispatches Run when the queued writer delivery becomes ambiguous', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('Help me frame this') })
    await flush()

    await act(async () => {
      await result.current.sendSystemEvent(edit('fac_a', 0.5, 25_000))
    })
    failFlushDispatch = true
    let runDone: Promise<void> | undefined
    act(() => {
      runDone = result.current.sendMessage('Run analysis', {
        turnType: 'run_analysis',
        debugSource: 'analysis_run',
      })
    })

    await act(async () => {
      resolveInFlight?.(undefined)
      await runDone
      await flush()
    })

    expect(dispatched).toHaveLength(2)
    expect((dispatched[1] as { event?: { kind?: string } }).event?.kind).toBe('factor_value_edit')
    expect(dispatchedRuns()).toHaveLength(0)
    expect(useCanvasStore.getState().unconfirmedEmittedEdits).toBeGreaterThan(0)
  })
})

describe('system-mode sends blocked by the in-flight lock', () => {
  it('a blocked send is DETECTABLE — it returns a sentinel, never a silent resolve', async () => {
    const { result } = renderHook(() => useConversation())

    // Occupy the lock with a turn that does not resolve.
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    expect(dispatched.length, 'first turn dispatched and is holding the lock').toBe(1)

    let outcome: unknown = 'not-set'
    await act(async () => { outcome = await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })

    // THE assertion that was RED: the old code resolved with `undefined`,
    // indistinguishable from a dispatched turn.
    expect(outcome).toBe(SEND_DEFERRED)
    expect(dispatchedEdits(), 'not on the wire yet — the lock is still held').toHaveLength(0)
  })

  it('a durable caller can keep retry ownership instead of creating a hidden queued copy', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    let outcome: unknown = 'not-set'
    await act(async () => {
      outcome = await result.current.sendSystemEvent(
        edit('fac_a', 0.4, 20000),
        { deferIfBusy: false },
      )
    })

    expect(outcome).toBe(SEND_BLOCKED)
    expect(dispatchedEdits()).toHaveLength(0)

    // Releasing the lock must not flush a second copy behind the caller's
    // durable pending record; the caller alone decides when to retry.
    await act(async () => { resolveInFlight?.(undefined); await flush() })
    expect(dispatchedEdits()).toHaveLength(0)
  })

  it('a deferred edit is NOT LOST — it reaches the wire once the lock clears', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    expect(dispatchedEdits()).toHaveLength(0)

    // Let the in-flight analysis finish — this is what releases the lock.
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    expect(edits, 'the deferred edit was flushed').toHaveLength(1)
    expect(edits[0].target_id).toBe('fac_a')
    expect(edits[0].raw_value).toBe(20000)
  })

  it('TYPO CORRECTION: commit A then B during one in-flight turn → B is what persists', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    // The user commits 20000, then notices the typo and commits 25000 — both
    // while the analysis is still running.
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    // Exactly one turn for the factor — and it carries the FINAL value. An
    // append-only queue would send 20000 after 25000 and leave the server on
    // the superseded number.
    expect(edits, 'superseded value collapsed, not replayed').toHaveLength(1)
    expect(edits[0].raw_value).toBe(25000)
    expect(edits[0].value).toBe(0.5)
  })

  it('preserves ORDER across DISTINCT targets (last-write-wins is per factor only)', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_b', 0.2, 200)) })
    // Supersede A — it must keep A's ORIGINAL position, not jump to the tail.
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    await act(async () => { resolveInFlight?.(undefined); await flush() })

    const edits = dispatchedEdits()
    expect(edits).toHaveLength(2)
    expect(edits.map((e) => e.target_id)).toEqual(['fac_a', 'fac_b'])
    expect(edits[0].raw_value).toBe(25000)
  })

  it('the freshness strip may NOT affirm freshness while an edit is undispatched', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    // A local edit dirties the overlay (the store's own edit chokepoint does
    // this; set it directly here so the test is about the CLEAR, not the set).
    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: true } as never) })
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.4, 20000)) })

    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The in-flight run's verdict lands. It was computed WITHOUT the queued
    // edit, so it must not un-dirty the overlay.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness?.({
        freshness: 'fresh', freshness_reason: 'graph_hash_match', computed_at: new Date().toISOString(),
      })
    })
    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      'overlay must stay dirty — the server has not seen this edit',
    ).toBe(true)

    // Once it flushes, the count clears and the overlay is free to resolve.
    await act(async () => { resolveInFlight?.(undefined); await flush() })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })

  it('clearAnalysisFreshnessDirty is also held while an edit is undispatched', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true, pendingEmittedEdits: 1 } as never)
    act(() => { useCanvasStore.getState().clearAnalysisFreshnessDirty?.() })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)

    useCanvasStore.setState({ pendingEmittedEdits: 0 } as never)
    act(() => { useCanvasStore.getState().clearAnalysisFreshnessDirty?.() })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

describe('F1 — a GENUINE failure at flush time must not silently lose the edit', () => {
  it('re-dirties, re-holds the count, and keeps the edit queued', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()

    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The network dies exactly when the queue drains. Under the old code the
    // entry was already removed and the count already published 0, and the
    // rejection had NO listener — the panel's promise resolved SEND_DEFERRED
    // long ago and a system turn renders no bubble. The edit vanished and the
    // next verdict blessed the stale numbers.
    failFlushDispatch = true
    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: false } as never) })
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    expect(
      useCanvasStore.getState().pendingEmittedEdits,
      'the hold must survive a failed flush — the server still has not seen this edit',
    ).toBeGreaterThan(0)
    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      're-dirtied: the strip may not affirm freshness over an edit that failed to send',
    ).toBe(true)
  })

  it('a verdict arriving after the failed flush still cannot clear the overlay', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    failFlushDispatch = true
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    act(() => {
      useCanvasStore.getState().setAnalysisFreshness?.({
        freshness: 'fresh', freshness_reason: 'graph_hash_match', computed_at: new Date().toISOString(),
      })
    })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('stops retrying after the cap but KEEPS the hold (the edit is genuinely unsent)', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    failFlushDispatch = true
    await act(async () => { resolveInFlight?.(undefined); await flush() })
    for (let i = 0; i < 4; i++) await act(async () => { await flush() })

    // Bounded: a failing flush takes and releases the lock, re-entering the
    // drain, so an uncapped retry would spin forever.
    const attempts = dispatched.length - 1
    expect(attempts).toBeLessThanOrEqual(4)
    // ...but the hold stays: the edit really has not reached the server.
    expect(useCanvasStore.getState().pendingEmittedEdits).toBeGreaterThan(0)
  })
})

describe('F2 — the buffer and the hold are SCENARIO-SCOPED', () => {
  const OTHER = 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5'

  it('never dispatches an edit from one scenario into another', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The user switches decision while the edit is still queued.
    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    // Dispatch resolves the scenario FRESH, so without scoping this edit would
    // have mutated the newly-opened decision's graph.
    expect(dispatchedEdits(), 'no cross-scenario dispatch').toHaveLength(0)
  })

  it('does not leak the hold into the new scenario (it would fabricate "model changed")', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { await flush() })

    // noteRunCompletedWithoutVerdict assigns dirty straight from this count, so
    // a leaked value is a FABRICATED verdict in a decision the user never edited.
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })

  it('SURFACES the discard rather than dropping it silently', async () => {
    const { result } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })

    act(() => { useCanvasStore.setState({ currentScenarioId: OTHER } as never) })
    await act(async () => { await flush() })

    // Assert on the WHOLE transcript, not on a slice from a remembered index:
    // switching scenario clears `messages` first (that effect is declared
    // earlier in the hook and React runs effects in declaration order), so an
    // index captured beforehand points past the end afterwards. What matters is
    // that the user can see it, not where it sits.
    const shown = result.current.messages.map((m) => String(m.content)).join(' ')
    expect(shown, 'the user is told the edit was discarded').toMatch(/discarded/i)
    expect(shown, 'and which edit it was').toMatch(/fac_a|25000/)
  })

  it('unmount clears the hold — a stranded count is a permanent false "model changed"', async () => {
    const { result, unmount } = renderHook(() => useConversation())
    act(() => { void result.current.sendMessage('run the analysis') })
    await flush()
    await act(async () => { await result.current.sendSystemEvent(edit('fac_a', 0.5, 25000)) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // The buffer dies with the hook but the count lives in the STORE — leaving
    // it set strands a hold nothing can ever clear. That is the INVERSE defect:
    // no edit is pending at all, yet the strip insists the model changed.
    act(() => { unmount() })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })
})
