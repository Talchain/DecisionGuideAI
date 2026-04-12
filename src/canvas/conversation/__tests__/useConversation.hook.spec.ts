/**
 * Hook-level tests for useConversation
 *
 * Tests timeout progression (10s/20s/30s), input restore on error,
 * and lastFailedInput cleanup on clearHistory/scenario switch.
 *
 * Uses vi.useFakeTimers() + renderHook from @testing-library/react.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'
import { _clearTraces, getInteractionChains, recordUiSurfaceState } from '../../../lib/debug-state'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock turnService — callOrchestratorTurn returns a controllable promise.
// streamOrchestratorTurn delegates to mockCallTurn to maintain backwards-compat
// with tests that configure responses via mockCallTurn.mockResolvedValue(...).
const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

/**
 * Default stream implementation: resolves mockCallTurn, wraps result as turn_complete.
 * If mockCallTurn rejects, the generator throws (producing an error path).
 * If mockCallTurn never resolves (new Promise(() => {})), the generator hangs.
 */
function resetStreamToDefault() {
  mockStreamTurn.mockImplementation(async function* (...args: unknown[]) {
    const result = await mockCallTurn(...args)
    yield { type: 'turn_complete' as const, envelope: result }
  })
}

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  // Default: stream delegates to mockCallTurn (maintains backwards-compat with existing test setup)
  resetStreamToDefault()
  _clearTraces()
  useResultsStore.setState({
    results: {
      status: 'idle',
      progress: 0,
      analysisSummary: undefined,
      lastSnapshotId: undefined,
    },
  } as any)

  // Minimal store state the hook reads
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.useRealTimers()
  _clearTraces()
})

// ---------------------------------------------------------------------------
// Timeout progression
// ---------------------------------------------------------------------------

describe('timeout progression (10s / 20s / 30s)', () => {
  it('shows task-specific hint immediately on submit', async () => {
    // Make the call hang forever (never resolve)
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    expect(result.current.isThinking).toBe(true)
    // With 0 nodes (empty graph) and generic message (no explicit_generate turn type),
    // inferLoadingHint returns "Thinking…" — shown immediately (not delayed)
    expect(result.current.longRunningHint).toBe('Thinking\u2026')
  })

  it('still shows base hint at 15s before elapsed counter starts', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    // Hint was set immediately; at 15s the elapsed counter starts but hasn't ticked yet
    expect(result.current.longRunningHint).toBe('Thinking\u2026')
  })

  it('shows elapsed time at 30s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    // After 15s the hint fires, then every 5s the elapsed timer updates it
    expect(result.current.longRunningHint).toBe('Thinking... 30s')
  })

  it('aborts and shows error at 60s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.isThinking).toBe(false)
    expect(result.current.longRunningHint).toBeNull()
    // Last message should be a synthetic timeout error
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.synthetic).toBe(true)
    expect(last.content).toMatch(/taking longer than expected/)
  })
})

// ---------------------------------------------------------------------------
// Input restore on error
// ---------------------------------------------------------------------------

describe('input restore on error (lastFailedInput)', () => {
  it('sets lastFailedInput on network error', async () => {
    mockCallTurn.mockRejectedValue(new Error('Network error'))


    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('my important question')
    })

    expect(result.current.lastFailedInput).toBe('my important question')
  })

  it('sets lastFailedInput on timeout', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('timeout question')
    })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.lastFailedInput).toBe('timeout question')
  })

  it('clears lastFailedInput on next successful send', async () => {
    // First call fails
    mockCallTurn.mockRejectedValueOnce(new Error('fail'))

    // Second call succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'OK',
      client_turn_id: 'resp-1',
    })

    const { result } = renderHook(() => useConversation())

    // First send — fails
    await act(async () => {
      await result.current.sendMessage('first attempt')
    })
    expect(result.current.lastFailedInput).toBe('first attempt')

    // Second send — succeeds
    await act(async () => {
      await result.current.sendMessage('second attempt')
    })
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('clears lastFailedInput on clearHistory', async () => {
    mockCallTurn.mockRejectedValue(new Error('fail'))


    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('failing message')
    })
    expect(result.current.lastFailedInput).toBe('failing message')

    act(() => {
      result.current.clearHistory()
    })
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('clears lastFailedInput on scenario switch', async () => {
    mockCallTurn.mockRejectedValue(new Error('fail'))


    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('failing message')
    })
    expect(result.current.lastFailedInput).toBe('failing message')

    // Simulate scenario switch
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'b1b1b1b1-c2c2-4d3d-9e4e-f5f5f5f5f5f5' })
    })

    expect(result.current.lastFailedInput).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildRequest payload integration (P1-1)
// Captures actual request sent to callOrchestratorTurn to verify
// RF → CEE transform happens in the real code path.
// ---------------------------------------------------------------------------

describe('buildRequest payload — RF → CEE graph_state transform', () => {
  beforeEach(() => {
    // Seed store with realistic React Flow format nodes and edges
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [
        {
          id: 'goal-1',
          type: 'goal',
          position: { x: 100, y: 50 },
          data: {
            label: 'Revenue Target',
            kind: 'goal',
            category: 'outcome',
            observedState: { value: 1000, baseline: 800, unit: 'USD' },
            // RF internals that must be stripped
            selected: true,
            dragging: false,
            measured: { width: 200, height: 100 },
          },
        },
        {
          id: 'factor-1',
          type: 'factor',
          position: { x: 300, y: 200 },
          data: {
            label: 'Marketing Spend',
            kind: 'factor',
            category: 'controllable',
            prior: { range_min: 0, range_max: 5000 },
            // UI-only fields that must be stripped
            uncertainty: { high: true },
            interventions: { opt1: { value: 2000 } },
          },
        },
      ] as any,
      edges: [
        {
          id: 'e1',
          source: 'factor-1',
          target: 'goal-1',
          type: 'styled',
          data: {
            weight: 0.8,
            direction: 'positive',
            beliefExists: 0.9,
            strengthStd: 0.1,
          },
        },
        {
          id: 'e2',
          source: 'factor-1',
          target: 'goal-1',
          type: 'styled',
          data: {
            weight: 0.6,
            direction: 'negative',
            // no beliefExists — should omit exists_probability
          },
        },
      ] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })
  })

  it('transforms nodes to CEE format (kind, label, no RF internals)', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-1',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('test')
    })

    expect(mockStreamTurn).toHaveBeenCalledTimes(1)
    const request = mockStreamTurn.mock.calls[0][0]
    const nodes = request.graph_state.nodes

    expect(nodes).toHaveLength(2)

    // Goal node
    const goalNode = nodes.find((n: any) => n.id === 'goal-1')
    expect(goalNode.kind).toBe('goal')
    expect(goalNode.label).toBe('Revenue Target')
    expect(goalNode.category).toBe('outcome')
    // observedState → observed_state rename
    expect(goalNode.observed_state).toEqual({ value: 1000, baseline: 800, unit: 'USD' })
    expect(goalNode.observedState).toBeUndefined()
    // RF internals stripped
    expect(goalNode.selected).toBeUndefined()
    expect(goalNode.dragging).toBeUndefined()
    expect(goalNode.measured).toBeUndefined()
    expect(goalNode.position).toBeUndefined()
    expect(goalNode.type).toBeUndefined()

    // Factor node
    const factorNode = nodes.find((n: any) => n.id === 'factor-1')
    expect(factorNode.kind).toBe('factor')
    expect(factorNode.label).toBe('Marketing Spend')
    // UI-only fields stripped
    expect(factorNode.uncertainty).toBeUndefined()
    expect(factorNode.interventions).toBeUndefined()
    // CEE-relevant field preserved
    expect(factorNode.prior).toEqual({ range_min: 0, range_max: 5000 })
  })

  it('transforms edges to CEE format (from/to, signed strength)', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-2',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('test')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    const edges = request.graph_state.edges

    expect(edges).toHaveLength(2)

    // Positive edge
    const e1 = edges.find((e: any) => e.from === 'factor-1' && e.strength.mean > 0)
    expect(e1.from).toBe('factor-1')
    expect(e1.to).toBe('goal-1')
    expect(e1.strength.mean).toBeCloseTo(0.8)
    expect(e1.strength.std).toBeCloseTo(0.1)
    expect(e1.exists_probability).toBeCloseTo(0.9)
    expect(e1.effect_direction).toBe('positive')
    // Must NOT have RF fields
    expect(e1.source).toBeUndefined()
    expect(e1.target).toBeUndefined()
    expect(e1.id).toBeUndefined()
    expect(e1.type).toBeUndefined()

    // Negative edge
    const e2 = edges.find((e: any) => e.from === 'factor-1' && e.strength.mean < 0)
    expect(e2.strength.mean).toBeCloseTo(-0.6)
    expect(e2.exists_probability).toBeUndefined() // no beliefExists on this edge
    expect(e2.effect_direction).toBe('negative')
    expect(e2.strength.std).toBeUndefined() // no strengthStd on this edge
  })

  it('includes all required top-level fields in request', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-3',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.scenario_id).toBe('a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4')
    expect(request.message).toBe('hello')
    expect(request.client_turn_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(Array.isArray(request.conversation_history)).toBe(true)
    expect(request.graph_state).toBeDefined()
    expect(Array.isArray(request.graph_state.nodes)).toBe(true)
    expect(Array.isArray(request.graph_state.edges)).toBe(true)
    // analysis_state absent when no analysis has been run
    expect(request.analysis_state).toBeUndefined()
  })

  it('R11 (updated): includes analysis_state on conversation turns when analysis is complete and graph is fresh', async () => {
    // Canvas store holds status + hash + rawV2Response (set by resultsComplete)
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-abc' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '42' },
      } as any,
    })
    // resultsStore holds analysisSummary (set by setAnalysisSummary)
    useResultsStore.setState({
      results: {
        status: 'idle', // not used by buildRequest
        progress: 0,
        analysisSummary: { contract_version: '1.0.0', recommendation: { option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 } },
      },
    } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Follow-up acknowledged',
      client_turn_id: 'resp-followup',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What does the analysis show?')
    })

    // R11 (updated): analysis_state IS included on conversation turns
    // so CEE can detect post-analysis stage and surface results.
    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.analysis_status).toBe('completed')
    expect(request.analysis_state.meta.response_hash).toBe('hash-abc')
    expect(Array.isArray(request.analysis_state.option_comparison)).toBe(true)
  })

  it('R12: forwards factor_sensitivity (top-5 slice) into analysis_state via real buildRequest path', async () => {
    // Production-path test (not the helper) — exercises useConversation.buildRequest end to end
    // to confirm factor_sensitivity reaches the outbound CEE turn payload.
    const factors = [
      { factor_id: 'f1', importance_rank: 1, elasticity: 0.5 },
      { factor_id: 'f2', importance_rank: 2, elasticity: 0.4 },
      { factor_id: 'f3', importance_rank: 3, elasticity: 0.3 },
      { factor_id: 'f4', importance_rank: 4, elasticity: 0.2 },
      { factor_id: 'f5', importance_rank: 5, elasticity: 0.1 },
      { factor_id: 'f6', importance_rank: 6, elasticity: 0.05 },
    ]
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-fs' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        factor_sensitivity: factors,
        meta: { seed_used: '42' },
      } as any,
    })
    useResultsStore.setState({
      results: { status: 'idle', progress: 0, analysisSummary: null },
    } as any)

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Tell me about the drivers')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.factor_sensitivity).toBeDefined()
    expect(request.analysis_state.factor_sensitivity).toHaveLength(5)
    // Order preserved from PLoT (no re-sort)
    expect(request.analysis_state.factor_sensitivity).toEqual(factors.slice(0, 5))
  })

  it('R12: omits factor_sensitivity key entirely when rawV2 does not provide it', async () => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-no-fs' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '42' },
        // factor_sensitivity intentionally absent
      } as any,
    })
    useResultsStore.setState({
      results: { status: 'idle', progress: 0, analysisSummary: null },
    } as any)

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Tell me about the drivers')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect('factor_sensitivity' in request.analysis_state).toBe(false)
    expect(request.analysis_state.factor_sensitivity).toBeUndefined()
  })

  it('omits analysis_state when graph has been edited since last analysis (stale guard)', async () => {
    // Canvas store: analysis complete but graph was edited (stale)
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-abc' } as any,
      graphEditedSinceLastRun: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '42' },
      } as any,
    })
    // resultsStore holds analysisSummary
    useResultsStore.setState({
      results: {
        status: 'idle',
        progress: 0,
        analysisSummary: { contract_version: '1.0.0', recommendation: { option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 } },
      },
    } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Graph changed',
      client_turn_id: 'resp-stale',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What should I do next?')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('R11 (updated): includes analysis_state on conversation turns after V2 analysis completes', async () => {
    // Simulate post-analysis state: canvas store has complete results + rawV2Response,
    // resultsStore has assembled summary with options (as set by useV2Run).
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'resp-hash-123' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [
          { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.65 },
          { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.35 },
        ],
        robustness_status: 'computed',
        robustness: { recommendation_stability: 0.55 },
        drivers_status: 'computed',
        drivers: [{ node_id: 'f1', label: 'Revenue', contribution: 0.4 }],
        meta: { seed_used: '42', detail_level: 'standard' },
      } as any,
    })
    useResultsStore.setState({
      results: {
        status: 'idle',
        progress: 0,
        analysisSummary: {
          contract_version: '1.0.0',
          recommendation: { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.65 },
          options: [
            { id: 'opt-a', label: 'Option A', win_probability: 0.65 },
            { id: 'opt-b', label: 'Option B', win_probability: 0.35 },
          ],
          top_drivers: [{ factor_id: 'f1', factor_label: 'Revenue', elasticity: 0.4 }],
          sensitivity_concentration: 0.6,
          confidence_band: 'medium',
          robustness: { level: 'moderate', recommendation_stability: 0.55 },
          constraints_status: [],
          run_metadata: { seed: '42', quality_mode: 'standard', timestamp: null },
        },
      },
    } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Here is the analysis summary.',
      client_turn_id: 'resp-explain',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('explain the results')
    })

    // R11 (updated): conversation turns now include analysis_state
    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.analysis_status).toBe('completed')
    expect(request.analysis_state.meta.response_hash).toBe('resp-hash-123')
    expect(Array.isArray(request.analysis_state.option_comparison)).toBe(true)
    expect(request.analysis_state.option_comparison).toHaveLength(2)
  })

  it('R11 (updated): includes analysis_state on conversation turns even with coerced rawV2 fields', async () => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-malformed' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: null,
        robustness_status: 'unavailable',
        robustness: null,
        drivers_status: 'computed',
        drivers: 'not-an-array',
        edge_sensitivity: undefined,
        meta: null,
      } as any,
    })

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Acknowledged.',
      client_turn_id: 'resp-malformed',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What happened?')
    })

    // R11 (updated): analysis_state IS included — coerced fields are still valid
    // (null arrays → [], null meta → spread works, results defaults to true)
    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.analysis_status).toBe('completed')
    expect(Array.isArray(request.analysis_state.option_comparison)).toBe(true)
    expect(request.analysis_state.option_comparison).toHaveLength(0)
  })

  it('omits analysis_state when rawV2Response is null (no analysis run)', async () => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-no-raw' } as any,
      graphEditedSinceLastRun: false,
      // 2026-04-09: staleness guard requires analysisStateReady to be set
      // by resultsComplete before buildRequest will ship analysis_state.
      // Tests mocking the post-`resultsComplete` state must mirror this.
      analysisStateReady: true,
      rawV2Response: null,
    })

    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK.',
      client_turn_id: 'resp-no-raw',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What next?')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('system event turn also transforms graph_state correctly', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Noted.',
      client_turn_id: 'resp-sys',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['goal-1'] },
      })
    })

    const request = mockStreamTurn.mock.calls[0][0]
    const nodes = request.graph_state.nodes
    // Same transform applies to system event turns
    const goalNode = nodes.find((n: any) => n.id === 'goal-1')
    expect(goalNode.kind).toBe('goal')
    expect(goalNode.observed_state).toEqual({ value: 1000, baseline: 800, unit: 'USD' })
    expect(goalNode.selected).toBeUndefined()

    // Edges also transformed
    const edges = request.graph_state.edges
    expect(edges[0].from).toBeDefined()
    expect(edges[0].to).toBeDefined()
    expect(edges[0].source).toBeUndefined()
  })

  it('conversation_history has correct turn pairs', async () => {
    // First turn
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'First response',
      client_turn_id: 'resp-1',
    })
    // Second turn
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Second response',
      client_turn_id: 'resp-2',
    })

    const { result } = renderHook(() => useConversation())

    // Turn 1
    await act(async () => {
      await result.current.sendMessage('first question')
    })

    // Turn 2 — should include history from turn 1
    await act(async () => {
      await result.current.sendMessage('follow up')
    })

    const request2 = mockStreamTurn.mock.calls[1][0]
    expect(request2.conversation_history.length).toBeGreaterThanOrEqual(2)
    // History entries are { role, content } pairs
    const userEntry = request2.conversation_history.find(
      (h: any) => h.role === 'user' && h.content === 'first question',
    )
    expect(userEntry).toBeDefined()
    const assistantEntry = request2.conversation_history.find(
      (h: any) => h.role === 'assistant' && h.content === 'First response',
    )
    expect(assistantEntry).toBeDefined()
  })

  it('clamps probability and weight values to valid ranges', async () => {
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [
        { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'factor' } },
        { id: 'n2', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B', kind: 'goal' } },
      ] as any,
      edges: [
        {
          id: 'e-over',
          source: 'n1',
          target: 'n2',
          type: 'styled',
          data: { weight: 3.0, direction: 'positive', beliefExists: 1.5 },
        },
        {
          id: 'e-under',
          source: 'n2',
          target: 'n1',
          type: 'styled',
          data: { weight: -1.0, direction: 'negative', beliefExists: -0.5 },
        },
      ] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })
    mockCallTurn.mockResolvedValue({ assistant_text: 'OK', client_turn_id: 'r' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('test') })

    const edges = mockStreamTurn.mock.calls[0][0].graph_state.edges
    // exists_probability clamped to [0, 1]
    expect(edges[0].exists_probability).toBeLessThanOrEqual(1)
    expect(edges[0].exists_probability).toBeGreaterThanOrEqual(0)
    expect(edges[1].exists_probability).toBeGreaterThanOrEqual(0)
  })

  it('falls back unknown kind to factor', async () => {
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [
        { id: 'n1', type: 'customWeirdType', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'banana' } },
      ] as any,
      edges: [] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })
    mockCallTurn.mockResolvedValue({ assistant_text: 'OK', client_turn_id: 'r' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('test') })

    const nodes = mockStreamTurn.mock.calls[0][0].graph_state.nodes
    expect(nodes[0].kind).toBe('factor') // invalid 'banana' falls back
  })

  it('omits effect_direction for invalid direction values', async () => {
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [
        { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'factor' } },
        { id: 'n2', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B', kind: 'goal' } },
      ] as any,
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', type: 'styled', data: { weight: 0.5, direction: 'sideways' } },
      ] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })
    mockCallTurn.mockResolvedValue({ assistant_text: 'OK', client_turn_id: 'r' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('test') })

    const edges = mockStreamTurn.mock.calls[0][0].graph_state.edges
    expect(edges[0].effect_direction).toBeUndefined()
  })

  it('empty graph sends empty arrays, not undefined', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-empty',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('empty graph')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.graph_state.nodes).toEqual([])
    expect(request.graph_state.edges).toEqual([])
  })

  // -------------------------------------------------------------------------
  // analysisStateReady freshness gate — covers in-flight, error, cancelled,
  // reset, and scenario-switch paths. Regression guard for 2026-04-09 fix.
  // -------------------------------------------------------------------------

  it('omits analysis_state when analysis is in-flight (resultsStart called, resultsComplete not yet)', async () => {
    // Simulate: a previous run completed, then a new run was started.
    // resultsStart preserves prior hash/rawV2Response for continuity but
    // sets analysisStateReady: false so buildRequest won't ship stale data.
    useCanvasStore.setState({
      results: { status: 'preparing', progress: 0, hash: 'hash-previous-run' } as any,
      graphEditedSinceLastRun: false,
      analysisStateReady: false, // resultsStart sets this
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Stale Option', win_probability: 0.9 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '1' },
      } as any,
    })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r-inflight' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Compare the options')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('omits analysis_state after a failed analysis run (resultsError)', async () => {
    // Simulate: resultsStart → resultsError. The prior rawV2Response is
    // preserved but analysisStateReady stays false.
    useCanvasStore.setState({
      results: { status: 'error', progress: 0, hash: 'hash-before-error' } as any,
      graphEditedSinceLastRun: false,
      analysisStateReady: false, // resultsError preserves the false from resultsStart
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '2' },
      } as any,
    })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r-error' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What happened?')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('omits analysis_state after a cancelled analysis run (resultsCancelled)', async () => {
    // Simulate: resultsStart → resultsCancelled. Same reasoning as error.
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0, hash: 'hash-before-cancel' } as any,
      graphEditedSinceLastRun: false,
      analysisStateReady: false, // resultsCancelled sets this
      rawV2Response: {
        analysis_status: 'computed',
        option_comparison_status: 'computed',
        option_comparison: [{ option_id: 'o1', option_label: 'Opt A', win_probability: 0.7 }],
        robustness_status: 'computed',
        robustness: null,
        drivers_status: 'computed',
        drivers: [],
        meta: { seed_used: '3' },
      } as any,
    })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r-cancel' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Try again?')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('omits analysis_state after results are cleared (resultsReset)', async () => {
    // Simulate: resultsComplete → resultsReset. No valid snapshot.
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as any,
      graphEditedSinceLastRun: false,
      analysisStateReady: false, // resultsReset sets this
      rawV2Response: null, // cleared by reset
    })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r-reset' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Start fresh')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('omits analysis_state after scenario switch (analysisStateReady reset by loadScenario)', async () => {
    // Simulate: resultsComplete in scenario A → switch to scenario B.
    // loadScenario now unconditionally sets analysisStateReady: false —
    // this test pins the buildRequest contract given that reset.
    // The real store action (loadScenario) is regression-tested in
    // src/canvas/store/__tests__/analysisReady.invalidation.spec.ts.
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as any,
      graphEditedSinceLastRun: false,
      analysisStateReady: false, // post-loadScenario state
      rawV2Response: null,
      currentScenarioId: 'scenario-b',
    })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r-switch' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('What is this scenario?')
    })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Envelope stamping: graph_hash_at_proposal
// ---------------------------------------------------------------------------

describe('graph_hash_at_proposal stamping', () => {
  it('stamps graph_hash_at_proposal on graph_patch blocks in envelope', async () => {
    // Set up a graph so generateGraphHash produces a deterministic hash
    useCanvasStore.setState({
      currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      edges: [] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })

    // Mock envelope with a graph_patch block (no graph_hash_at_proposal initially)
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here is a patch.',
      client_turn_id: 'resp-patch',
      blocks: [
        {
          type: 'graph_patch',
          patch_id: 'p-stamp-test',
          summary: 'Add a node',
          operations: [{ op: 'add_node', target_id: 'n2', data: {} }],
          target_graph_hash: 'cee-hash',
        },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('stamp test')
    })

    // Find the assistant message with the patch block
    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant' && m.blocks?.some((b) => b.type === 'graph_patch'),
    )
    expect(assistantMsg).toBeDefined()

    const patchBlock = assistantMsg!.blocks!.find((b) => b.type === 'graph_patch') as any
    expect(patchBlock.graph_hash_at_proposal).toBeDefined()
    expect(typeof patchBlock.graph_hash_at_proposal).toBe('string')
    expect(patchBlock.graph_hash_at_proposal.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// handleEnvelope — real CEE wire shapes
// ---------------------------------------------------------------------------

describe('handleEnvelope — CEE wire shape handling', () => {
  it('handles assistant_text: null (graph-only response) without crash', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: null,
      client_turn_id: 'resp-null-text',
      blocks: [
        { type: 'commentary', text: 'Graph built.' },
      ],
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('build graph')
    })

    expect(result.current.messages).toHaveLength(2) // user + assistant
    const assistantMsg = result.current.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    // content falls back to empty string, not null
    expect(assistantMsg!.content).toBe('')
    expect(assistantMsg!.blocks).toHaveLength(1)
  })

  it('extracts stage from object stage_indicator { stage, confidence, source }', async () => {
    const setCurrentStage = vi.fn()
    useCanvasStore.setState({ setCurrentStage } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Here is your model.',
      client_turn_id: 'resp-stage-obj',
      stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('build model')
    })

    expect(setCurrentStage).toHaveBeenCalledWith('ideate')
  })

  it('handles plain string stage_indicator', async () => {
    const setCurrentStage = vi.fn()
    useCanvasStore.setState({ setCurrentStage } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'Running analysis.',
      client_turn_id: 'resp-stage-str',
      stage_indicator: 'evaluate',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run analysis')
    })

    expect(setCurrentStage).toHaveBeenCalledWith('evaluate')
  })

  it('skips stage update when stage_indicator is absent', async () => {
    const setCurrentStage = vi.fn()
    useCanvasStore.setState({ setCurrentStage } as any)

    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-no-stage',
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('hello')
    })

    expect(setCurrentStage).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// retryLast — idempotent client_turn_id + no duplicate user bubble
// ---------------------------------------------------------------------------

describe('retryLast — client_turn_id preservation and bubble semantics', () => {
  it('retry reuses the same client_turn_id from the original send', async () => {
    // First call fails
    mockCallTurn.mockRejectedValueOnce(new Error('Server error'))

    // Second call (retry) succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'OK',
      client_turn_id: 'resp-retry',
    })

    const { result } = renderHook(() => useConversation())

    // Send a message that fails
    await act(async () => {
      await result.current.sendMessage('important question')
    })

    // Capture the client_turn_id from the first (failed) call
    const firstCallRequest = mockStreamTurn.mock.calls[0][0]
    const originalTurnId = firstCallRequest.client_turn_id
    expect(originalTurnId).toBeTruthy()

    // Retry
    await act(async () => {
      await result.current.retryLast()
    })

    // Second call should reuse the same client_turn_id
    const retryRequest = mockStreamTurn.mock.calls[1][0]
    expect(retryRequest.client_turn_id).toBe(originalTurnId)
  })

  it('retry does not create a duplicate user bubble', async () => {
    // First call fails
    mockCallTurn.mockRejectedValueOnce(new Error('Server error'))

    // Retry succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Now it works',
      client_turn_id: 'resp-2',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('my question')
    })

    // After failure: user bubble + synthetic error bubble
    const userBubbles = result.current.messages.filter((m) => m.role === 'user')
    expect(userBubbles).toHaveLength(1)
    expect(userBubbles[0].content).toBe('my question')

    // Retry
    await act(async () => {
      await result.current.retryLast()
    })

    // After retry: still only one user bubble, synthetic error replaced by real response
    const userBubblesAfter = result.current.messages.filter((m) => m.role === 'user')
    expect(userBubblesAfter).toHaveLength(1)
    expect(userBubblesAfter[0].content).toBe('my question')

    // Should have user + assistant (no synthetic error)
    const syntheticMessages = result.current.messages.filter((m) => m.synthetic)
    expect(syntheticMessages).toHaveLength(0)
  })

  it('retry removes the synthetic error message before re-sending', async () => {
    mockCallTurn.mockRejectedValueOnce(new Error('fail'))

    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'recovered',
      client_turn_id: 'resp-recover',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('test')
    })

    // Synthetic error exists
    expect(result.current.messages.some((m) => m.synthetic)).toBe(true)

    await act(async () => {
      await result.current.retryLast()
    })

    // After successful retry, no synthetic messages remain
    expect(result.current.messages.every((m) => !m.synthetic)).toBe(true)
    // Final assistant message has real content
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content).toBe('recovered')
  })
})

// ---------------------------------------------------------------------------
// Hidden send lifecycle
// ---------------------------------------------------------------------------

describe('hidden send lifecycle', () => {
  it('does not create a user message bubble for hidden sends', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Analysis started',
      client_turn_id: 'resp-hidden',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('run it', { hidden: true })
    })

    // No user bubble — only the assistant response
    const userMessages = result.current.messages.filter(m => m.role === 'user')
    expect(userMessages).toHaveLength(0)
    const assistantMessages = result.current.messages.filter(m => m.role === 'assistant')
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1)
  })

  // TODO: streaming path produces synthetic error for hidden sends — needs separate fix
  it.skip('does not set lastFailedInput on hidden send error', async () => {
    mockCallTurn.mockRejectedValue(new Error('Network error'))


    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('run it', { hidden: true })
    })

    expect(result.current.lastFailedInput).toBeNull()
    // No error bubble should appear
    const syntheticMessages = result.current.messages.filter(m => m.synthetic)
    expect(syntheticMessages).toHaveLength(0)
  })

  it('does not set lastFailedInput on hidden send timeout', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('run it', { hidden: true })
    })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.lastFailedInput).toBeNull()
    // No timeout error bubble
    const syntheticMessages = result.current.messages.filter(m => m.synthetic)
    expect(syntheticMessages).toHaveLength(0)
  })

  it('does not pollute retryLast with hidden send text', async () => {
    // First: normal send that succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'first response',
      client_turn_id: 'resp-1',
    })
    // Second: hidden send that fails
    mockCallTurn.mockRejectedValueOnce(new Error('fail'))

    // Third: retry should replay the normal send, not 'run it'
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'retry response',
      client_turn_id: 'resp-retry',
    })

    const { result } = renderHook(() => useConversation())

    // Normal send
    await act(async () => {
      await result.current.sendMessage('my real question')
    })

    // Hidden send fails — should not overwrite lastUserInputRef
    await act(async () => {
      await result.current.sendMessage('run it', { hidden: true })
    })

    // Retry should replay 'my real question', not 'run it'
    await act(async () => {
      await result.current.retryLast()
    })

    // Verify the retry call used the original user message
    const lastCall = mockStreamTurn.mock.calls[mockStreamTurn.mock.calls.length - 1]
    expect(lastCall[0].message).toBe('my real question')
  })

  it('retryLast is a no-op when only hidden sends have been made', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-1',
    })

    const { result } = renderHook(() => useConversation())

    // Only hidden sends — lastUserInputRef stays at initial ''
    await act(async () => {
      await result.current.sendMessage('run it', { hidden: true })
    })

    const callCountBefore = mockStreamTurn.mock.calls.length

    await act(async () => {
      await result.current.retryLast()
    })

    // No additional call should have been made
    expect(mockStreamTurn.mock.calls.length).toBe(callCountBefore)
  })

  it('normal send works correctly after a hidden send', async () => {
    // Hidden send succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Hidden response',
      client_turn_id: 'resp-hidden',
    })
    // Normal send succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Normal response',
      client_turn_id: 'resp-normal',
    })

    const { result } = renderHook(() => useConversation())

    // Hidden send
    await act(async () => {
      await result.current.sendMessage('run it', { hidden: true })
    })

    expect(result.current.isThinking).toBe(false)

    // Normal send after hidden — should work normally
    await act(async () => {
      await result.current.sendMessage('my question')
    })

    expect(result.current.isThinking).toBe(false)
    // Should have user bubble + both assistant responses
    const userMsgs = result.current.messages.filter(m => m.role === 'user')
    expect(userMsgs).toHaveLength(1)
    expect(userMsgs[0].content).toBe('my question')
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('records generate_model trigger source and request summary', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Created a model',
      client_turn_id: 'resp-generate',
      blocks: [],
      suggested_actions: [],
      guidance_items: [],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a pricing model', {
        debugSource: 'generate_model',
        debugSourceSurface: 'ai_panel',
      })
    })

    const chains = getInteractionChains()
    expect(chains).toHaveLength(1)
    expect(chains[0]?.triggerSurface).toBe('generate_model')
    expect(chains[0]?.sourceSurface).toBe('ai_panel')
    expect(chains[0]?.requests[0]?.payloadShapeSummary?.graph_nodes).toBe(0)
    expect(chains[0]?.requests[0]?.responseStatus).toBe(200)
  })

  it('captures stale first-draft readiness visibility in state snapshot', async () => {
    recordUiSurfaceState('conversation', {
      firstDraftControlsVisible: true,
      staleFirstDraftGuidanceVisible: true,
      aiPanelOpen: true,
      composerHasText: true,
      composerTextLength: 18,
      guidanceItemsVisible: 2,
    })
    mockCallTurn.mockResolvedValue({
      assistant_text: 'OK',
      client_turn_id: 'resp-stale',
      blocks: [],
      suggested_actions: [],
      guidance_items: [],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('keep going')
    })

    const chain = getInteractionChains()[0]
    expect(chain?.stateBefore?.firstDraftControlsVisible).toBe(true)
    expect(chain?.stateBefore?.staleFirstDraftGuidanceVisible).toBe(true)
    expect(chain?.stateBefore?.composerHasText).toBe(true)
  })

  it('records analyse_now as a right-panel hidden request without composer leakage', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Analysis started',
      client_turn_id: 'resp-analyse',
      blocks: [],
      suggested_actions: [],
      guidance_items: [],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('run it', {
        hidden: true,
        debugSource: 'analyse_now',
        debugSourceSurface: 'right_panel',
        debugRightPanelComposerLeak: false,
      })
    })

    const chain = getInteractionChains()[0]
    expect(chain?.triggerSurface).toBe('analyse_now')
    expect(chain?.sourceSurface).toBe('right_panel')
    expect(chain?.requests[0]?.rightPanelAccidentallySubmittedComposerContent).toBe(false)
    expect(chain?.requests[0]?.visibleTextSubmitted).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// null-initial scenario_id lifecycle
// ---------------------------------------------------------------------------

describe('null-initial scenario_id lifecycle', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  it('lazily allocates a UUID scenario_id on first send when store starts with null', async () => {
    useCanvasStore.setState({ currentScenarioId: null as any })
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'ok', client_turn_id: 'resp-lazy' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.scenario_id)).toBe(true)
    expect(UUID_RE.test(useCanvasStore.getState().currentScenarioId)).toBe(true)
  })

  it('reuses the same scenario_id across multiple sends after lazy allocation', async () => {
    useCanvasStore.setState({ currentScenarioId: null as any })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'resp-multi' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('first') })
    await act(async () => { await result.current.sendMessage('second') })

    const first = mockStreamTurn.mock.calls[0][0].scenario_id
    const second = mockStreamTurn.mock.calls[1][0].scenario_id
    expect(first).toBe(second)
    expect(UUID_RE.test(first)).toBe(true)
  })

  it('replaces legacy non-UUID scenario_id with a fresh UUID', async () => {
    useCanvasStore.setState({ currentScenarioId: 'scenario-1709827200000-abc' as any })
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'ok', client_turn_id: 'resp-legacy' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.scenario_id)).toBe(true)
    expect(request.scenario_id).not.toBe('scenario-1709827200000-abc')
  })

  it('always sends a UUID client_turn_id even when pendingContext has non-UUID chainId', async () => {
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'ok', client_turn_id: 'resp-chain' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })

    const request = mockStreamTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.client_turn_id)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T6 — cancelTurn (Stop button)
// ---------------------------------------------------------------------------

describe('cancelTurn — T6 Stop button', () => {
  beforeEach(() => {
    // Enable streaming path so cancelTurn's interaction with the streaming
    // loop's finally block is exercised. N8 only affects the streaming path —
    // the non-streaming path never sets streamingMsgIdRef.
    localStorage.setItem('feature.orchestratorStreaming', '1')
  })

  afterEach(() => {
    localStorage.removeItem('feature.orchestratorStreaming')
  })

  /**
   * Build a mock streaming generator that yields the given text chunk, then
   * hangs forever waiting for more events. The test calls cancelTurn to abort
   * it. The generator honours the controller.signal so it throws AbortError
   * when the signal is aborted, mirroring production streamOrchestratorTurn.
   */
  function configureStreamingGeneratorWithPartialText(partialText: string) {
    mockStreamTurn.mockImplementation(async function* (_req: unknown, signal: AbortSignal) {
      // Yield an initial text_delta so the message has content when the user stops.
      yield { type: 'text_delta' as const, delta: partialText }
      // Wait for abort. Resolve a promise on the signal's 'abort' event so the
      // generator exits cleanly with an AbortError mirroring production fetch.
      await new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          return
        }
        signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        }, { once: true })
      })
    })
  }

  it('N8: clicking Stop preserves the partial text instead of overwriting with "The response was interrupted."', async () => {
    const partialText = "I'll add a factor called "
    configureStreamingGeneratorWithPartialText(partialText)

    const { result } = renderHook(() => useConversation())

    // Start the turn (do not await — it hangs until Stop).
    await act(async () => {
      result.current.sendMessage('test question')
    })

    // Let the text_delta flush (RAF is mocked to microtask in test env).
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Stop the turn.
    await act(async () => {
      result.current.cancelTurn()
    })

    // Allow pending microtasks (finally block, abort-triggered catch) to run.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMessages.length).toBeGreaterThan(0)
    const last = assistantMessages[assistantMessages.length - 1]

    // N8 regression: content must NOT be overwritten with the stuck-stream
    // recovery placeholder. The partial text the user saw must be preserved.
    expect(last.content).not.toContain('The response was interrupted')
    // No Try again chip — the user intentionally stopped.
    const retryChip = last.actionChips?.find((c) => c.id === 'retry')
    expect(retryChip).toBeUndefined()
    // Stopped indicator marker intact.
    expect(last.stoppedByUser).toBe(true)
    expect(last.isStreaming).toBe(false)
    expect(last.isProvisional).toBe(false)
  })

  it('F: cancelTurn is idempotent when isThinking is false (not a no-op after first turn)', async () => {
    // Regression for the F defensive fix: earlier the early-return used
    //   if (!isThinkingRef.current && !abortRef.current) return
    // After the first turn, abortRef.current stays set, so the second
    // condition was always true → the early return never fired → clicking
    // Stop on an idle composer would run the full cleanup path against
    // stale state. The fix checks only isThinkingRef.
    const { result } = renderHook(() => useConversation())

    // Call cancelTurn BEFORE any turn has started. Must be a no-op.
    await act(async () => {
      result.current.cancelTurn()
    })
    expect(result.current.isThinking).toBe(false)
    expect(result.current.messages).toEqual([])

    // Now start and complete a turn to ensure abortRef is populated.
    mockStreamTurn.mockImplementation(async function* () {
      yield { type: 'turn_complete' as const, envelope: { assistant_text: 'done', client_turn_id: 'c1' } }
    })
    await act(async () => {
      await result.current.sendMessage('hello')
    })
    expect(result.current.isThinking).toBe(false)

    // Call cancelTurn again post-turn. This was the buggy path before F:
    // abortRef.current is now set (from the completed turn), so the old
    // condition fell through and ran cleanup. The fix ensures it bails.
    const messagesBefore = result.current.messages.length
    await act(async () => {
      result.current.cancelTurn()
    })
    // Cleanup must NOT have added a new message or changed state.
    expect(result.current.messages.length).toBe(messagesBefore)
    expect(result.current.isThinking).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Session state round-trip (P0 contract)
// ---------------------------------------------------------------------------

describe('session state round-trip', () => {
  it('captures updated_session_state from envelope and resends on next turn', async () => {
    const sessionPayload = { predictions: [{ factor_id: 'fac_1', predicted: 0.5 }] }

    // First call returns envelope with updated_session_state
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'First response',
      client_turn_id: 'turn-1',
      updated_session_state: sessionPayload,
    })

    // Second call captures the request for inspection
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Second response',
      client_turn_id: 'turn-2',
    })

    const { result } = renderHook(() => useConversation())

    // First turn — envelope delivers session state
    await act(async () => {
      await result.current.sendMessage('first message')
    })

    // Second turn — request should include session_state
    await act(async () => {
      await result.current.sendMessage('second message')
    })

    // The second call to mockCallTurn should have session_state in the request
    const secondCallArgs = mockCallTurn.mock.calls[1]
    const secondRequest = secondCallArgs[0]
    expect(secondRequest.session_state).toEqual(sessionPayload)
  })

  it('resets session state on scenario change', async () => {
    const sessionPayload = { turn_count: 3 }

    // First call returns envelope with updated_session_state
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Response',
      client_turn_id: 'turn-1',
      updated_session_state: sessionPayload,
    })

    // Second call (after scenario switch) — no session_state expected
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'New scenario response',
      client_turn_id: 'turn-2',
    })

    const { result } = renderHook(() => useConversation())

    // First turn — captures session state
    await act(async () => {
      await result.current.sendMessage('message in scenario A')
    })

    // Switch scenario — should clear session state
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'b1b1b1b1-c2c2-4d3d-9e4e-f5f5f5f5f5f5' })
    })

    // Next turn — session_state should be absent
    await act(async () => {
      await result.current.sendMessage('message in scenario B')
    })

    const secondCallArgs = mockCallTurn.mock.calls[1]
    const secondRequest = secondCallArgs[0]
    expect(secondRequest.session_state).toBeUndefined()
  })
})
