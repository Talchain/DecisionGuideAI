/**
 * Tests for intervention reconciliation on the conversational turn-request path.
 *
 * The conversational turn path (useConversation.buildRequest) must call
 * reconcileOptionsWithCanvasNodes when assembling analysis_inputs, mirroring
 * the PLoT /v2/run path (useV2Run.ts:334, adapter.ts:1092). Without this,
 * CEE receives stale ceeAnalysisReady.options after add_option, draft_graph,
 * or manual canvas edits and downstream analysis fails with MISSING_INTERVENTIONS.
 *
 * Verified behaviours:
 * - After add_option (canvas-only option): analysis_inputs includes the new
 *   option with non-empty interventions backfilled from node.data.interventions.
 * - After draft_graph where ceeAnalysisReady options have needs_encoding /
 *   empty interventions but canvas nodes are populated: analysis_inputs
 *   carries the canvas interventions, not the empty draft state.
 * - When ceeAnalysisReady is null but canvas has option nodes: gracefully
 *   omits analysis_inputs (no goal_node_id ⇒ partial context, omit per the
 *   existing rule).
 * - When ceeAnalysisReady is null and canvas has no option nodes: no crash.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// IMPORTANT: do NOT add a `vi.mock('../../../adapters/plot/v2', ...)` block to
// this file. These tests deliberately exercise the *real* implementation of
// `reconcileOptionsWithCanvasNodes` to verify the behaviour useConversation
// inherits from the v2 adapter. A module-wide mock would stub out the
// reconciler and silently neuter every assertion below.
//
// Two sibling tests already learned this the hard way:
//   - envelopeAnalysisWiring.spec.ts
//   - handleEnvelopeArbitration.spec.ts
// Both broke (1417 → 1411 passing) the moment useConversation grew its
// reconcileOptionsWithCanvasNodes import, because their existing module-wide
// mocks did not export the new symbol. They were patched with a pass-through
// stub. Don't repeat that mistake here — keep this file unmocked at the v2
// level.

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
  isThreadHydrateEnabled: () => false,
  isThreadPersistEnabled: () => false,
  isOrchestratorRenderingV2Enabled: () => false,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/** A canvas option node with interventions populated on node.data. */
function makeOptionNode(
  id: string,
  label: string,
  interventions: Record<string, { value: number }>,
) {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: {
      kind: 'option',
      label,
      interventions,
    },
  } as any
}

/** A canvas factor node — used as intervention target so validNodeIds accepts it. */
function makeFactorNode(id: string) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', label: id },
  } as any
}

const factorNodes = [
  makeFactorNode('node-1'),
  makeFactorNode('node-2'),
]

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Pin the V5-orchestrator flag OFF for this spec (see envelopeAnalysisWiring
  // .spec.ts / PR #460 for the full rationale). These tests exercise the legacy
  // V4 turn path (`callOrchestratorTurn`, mocked above) to assert that
  // `buildRequest` calls `reconcileOptionsWithCanvasNodes` when assembling
  // `analysis_inputs`. `sendTurn` branches FIRST on
  // `isV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR })`: when the
  // flag is 'true' every turn routes to the V5 exclusive path (`callV5Turn`)
  // which this spec does NOT mock — the real fetch throws, the turn is classed a
  // transport failure, and `callOrchestratorTurn` never fires (mock.calls[0] is
  // undefined). CI leaves the flag undefined (→ V4 → green); a fresh-clone lane
  // that copies `.env.local` (which sets VITE_ENABLE_V5_ORCHESTRATOR=true) gets
  // the V5 path → red. Pinning it here makes the intended V4 path deterministic;
  // afterEach restores via unstubAllEnvs so nothing leaks to siblings.
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'false')
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ceeAnalysisReady: null,
    goalConstraints: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analysis_inputs reconciliation on conversational turn path', () => {
  it('after add_option (canvas-only option appended): analysis_inputs.options includes the new option with reconciled interventions', async () => {
    // Simulate the post-draft state where ceeAnalysisReady has the original
    // option, then the user/AI added a new option directly to the canvas.
    const ceeReady: CEEAnalysisReady = {
      goal_node_id: 'node-goal-1',
      options: [
        {
          id: 'option-a',
          label: 'Option A',
          status: 'ready',
          interventions: {
            'node-1': { value: 0.8, source: 'cee_hypothesis' },
          },
        },
      ],
    }
    useCanvasStore.setState({
      ceeAnalysisReady: ceeReady,
      nodes: [
        ...factorNodes,
        // Original drafted option (also exists on canvas)
        makeOptionNode('option-a', 'Option A', { 'node-1': { value: 0.8 } }),
        // The new add_option that has not yet been folded into ceeAnalysisReady
        makeOptionNode('option-b', 'Option B', { 'node-2': { value: 0.6 } }),
      ],
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run it', { turnType: 'run_analysis' })
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeDefined()
    expect(request.analysis_inputs.goal_node_id).toBe('node-goal-1')

    const opts = request.analysis_inputs.options as Array<{
      id: string
      option_id: string
      interventions: Record<string, unknown>
    }>
    expect(opts).toHaveLength(2)

    const ids = opts.map((o) => o.id)
    expect(ids).toContain('option-a')
    expect(ids).toContain('option-b')

    const newOption = opts.find((o) => o.id === 'option-b')!
    expect(newOption.option_id).toBe('option-b')
    expect(Object.keys(newOption.interventions)).toContain('node-2')
    // Backfilled interventions are tagged as cee_hypothesis (canonical reconcile output)
    expect((newOption.interventions['node-2'] as { value: number }).value).toBe(0.6)
  })

  it('after draft_graph with empty/needs_encoding analysisReady interventions: backfills from node.data.interventions', async () => {
    // ceeAnalysisReady arrived with options that lack interventions (e.g.
    // status: needs_encoding) but the canvas has them populated.
    const ceeReady: CEEAnalysisReady = {
      goal_node_id: 'node-goal-1',
      options: [
        {
          id: 'option-a',
          label: 'Option A',
          status: 'needs_encoding' as any,
          interventions: {},
        },
        {
          id: 'option-b',
          label: 'Option B',
          status: 'needs_encoding' as any,
          interventions: {},
        },
      ],
    }
    useCanvasStore.setState({
      ceeAnalysisReady: ceeReady,
      nodes: [
        ...factorNodes,
        makeOptionNode('option-a', 'Option A', { 'node-1': { value: 0.7 } }),
        makeOptionNode('option-b', 'Option B', { 'node-2': { value: 0.4 } }),
      ],
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('go', { turnType: 'run_analysis' })
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeDefined()

    const opts = request.analysis_inputs.options as Array<{
      id: string
      interventions: Record<string, { value: number }>
    }>
    expect(opts).toHaveLength(2)

    const a = opts.find((o) => o.id === 'option-a')!
    expect(a.interventions['node-1']?.value).toBe(0.7)

    const b = opts.find((o) => o.id === 'option-b')!
    expect(b.interventions['node-2']?.value).toBe(0.4)
  })

  it('manual canvas option add with no ceeAnalysisReady: omits analysis_inputs (no goal_node_id available)', async () => {
    // No ceeAnalysisReady at all — user just dragged options on the canvas.
    // We have nothing to set goal_node_id from, so the run_analysis turn
    // falls back to a conversation turn (preserving existing partial-context-is-worse-than-none rule).
    useCanvasStore.setState({
      ceeAnalysisReady: null,
      nodes: [
        ...factorNodes,
        makeOptionNode('option-a', 'Option A', { 'node-1': { value: 0.9 } }),
      ],
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeUndefined()
  })

  it('null ceeAnalysisReady and no option nodes: graceful, no crash, no analysis_inputs', async () => {
    useCanvasStore.setState({
      ceeAnalysisReady: null,
      nodes: factorNodes,
    })

    const { result } = renderHook(() => useConversation())
    await expect(
      act(async () => {
        await result.current.sendMessage('hello')
      }),
    ).resolves.not.toThrow()

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeUndefined()
  })

  it('analysisReady option with empty interventions and no matching canvas node: passes through (legacy permissive behaviour)', async () => {
    // Edge case: analysisReady references option-x but canvas has no node for it.
    // reconcileOptionsWithCanvasNodes leaves the entry as-is (handled by
    // isAnalysisReadyStale upstream, not here).
    const ceeReady: CEEAnalysisReady = {
      goal_node_id: 'node-goal-1',
      options: [
        {
          id: 'option-x',
          label: 'Option X',
          status: 'ready',
          interventions: {},
        },
      ],
    }
    useCanvasStore.setState({
      ceeAnalysisReady: ceeReady,
      nodes: factorNodes,
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run', { turnType: 'run_analysis' })
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    // Run-analysis turn requires interventions; with empty interventions the
    // request still goes out (gating happens in useV2Run pre-run validation),
    // so we just confirm the option survived reconciliation as-is.
    expect(request.analysis_inputs).toBeDefined()
    expect(request.analysis_inputs.options).toHaveLength(1)
    expect(request.analysis_inputs.options[0].id).toBe('option-x')
    // Lock the legacy permissive contract: when neither analysisReady nor a
    // matching canvas node has interventions, the empty map MUST be preserved
    // verbatim. If reconcile ever started backfilling from an unrelated node
    // by mistake, this assertion catches it.
    expect(request.analysis_inputs.options[0].interventions).toEqual({})
  })
})
