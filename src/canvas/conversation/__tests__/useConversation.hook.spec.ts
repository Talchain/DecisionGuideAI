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

// Mock turnService — callOrchestratorTurn returns a controllable promise
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
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
  it('shows no hint before 10s', async () => {
    // Make the call hang forever (never resolve)
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    expect(result.current.isThinking).toBe(true)
    expect(result.current.longRunningHint).toBeNull()
  })

  it('shows task-specific hint at 15s (inferred from message + graph state)', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    // With 0 nodes (empty graph) and generic message (no explicit_generate turn type),
    // inferLoadingHint returns "Thinking…" — "Building…" only for explicit_generate or keyword match
    expect(result.current.longRunningHint).toBe('Thinking\u2026')
  })

  it('shows "Still working\u2026" at 30s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(result.current.longRunningHint).toBe('Still working\u2026')
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

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const request = mockCallTurn.mock.calls[0][0]
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

    const request = mockCallTurn.mock.calls[0][0]
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

    const request = mockCallTurn.mock.calls[0][0]
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

  it('includes analysis_state on conversation turns when analysis is complete and graph is fresh', async () => {
    // Canvas store holds status + hash (set by resultsComplete)
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-abc' } as any,
      graphEditedSinceLastRun: false,
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

    const request = mockCallTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.analysis_status).toBe('complete')
    expect(request.analysis_state.meta.response_hash).toBe('hash-abc')
    expect(request.analysis_state.results).toBeDefined()
  })

  it('omits analysis_state when graph has been edited since last analysis (stale guard)', async () => {
    // Canvas store: analysis complete but graph was edited (stale)
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'hash-abc' } as any,
      graphEditedSinceLastRun: true,
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

    const request = mockCallTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeUndefined()
  })

  it('includes analysis_state with computed status and non-empty option_comparison after V2 analysis completes', async () => {
    // Simulate post-analysis state: canvas store has complete results,
    // resultsStore has assembled summary with options (as set by useV2Run).
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, hash: 'resp-hash-123' } as any,
      graphEditedSinceLastRun: false,
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

    const request = mockCallTurn.mock.calls[0][0]
    expect(request.analysis_state).toBeDefined()
    expect(request.analysis_state.analysis_status).toBe('complete')
    expect(request.analysis_state.meta.response_hash).toBe('resp-hash-123')
    // results contains the full AnalysisInputsSummary with options
    const summary = request.analysis_state.results as any
    expect(summary.contract_version).toBe('1.0.0')
    expect(summary.options).toHaveLength(2)
    expect(summary.options[0].win_probability).toBe(0.65)
    expect(summary.robustness.level).toBe('moderate')
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

    const request = mockCallTurn.mock.calls[0][0]
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

    const request2 = mockCallTurn.mock.calls[1][0]
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

    const edges = mockCallTurn.mock.calls[0][0].graph_state.edges
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

    const nodes = mockCallTurn.mock.calls[0][0].graph_state.nodes
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

    const edges = mockCallTurn.mock.calls[0][0].graph_state.edges
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

    const request = mockCallTurn.mock.calls[0][0]
    expect(request.graph_state.nodes).toEqual([])
    expect(request.graph_state.edges).toEqual([])
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
    const firstCallRequest = mockCallTurn.mock.calls[0][0]
    const originalTurnId = firstCallRequest.client_turn_id
    expect(originalTurnId).toBeTruthy()

    // Retry
    await act(async () => {
      await result.current.retryLast()
    })

    // Second call should reuse the same client_turn_id
    const retryRequest = mockCallTurn.mock.calls[1][0]
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

  it('does not set lastFailedInput on hidden send error', async () => {
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
    const lastCall = mockCallTurn.mock.calls[mockCallTurn.mock.calls.length - 1]
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

    const callCountBefore = mockCallTurn.mock.calls.length

    await act(async () => {
      await result.current.retryLast()
    })

    // No additional call should have been made
    expect(mockCallTurn.mock.calls.length).toBe(callCountBefore)
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

    const request = mockCallTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.scenario_id)).toBe(true)
    expect(UUID_RE.test(useCanvasStore.getState().currentScenarioId)).toBe(true)
  })

  it('reuses the same scenario_id across multiple sends after lazy allocation', async () => {
    useCanvasStore.setState({ currentScenarioId: null as any })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'resp-multi' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('first') })
    await act(async () => { await result.current.sendMessage('second') })

    const first = mockCallTurn.mock.calls[0][0].scenario_id
    const second = mockCallTurn.mock.calls[1][0].scenario_id
    expect(first).toBe(second)
    expect(UUID_RE.test(first)).toBe(true)
  })

  it('replaces legacy non-UUID scenario_id with a fresh UUID', async () => {
    useCanvasStore.setState({ currentScenarioId: 'scenario-1709827200000-abc' as any })
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'ok', client_turn_id: 'resp-legacy' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })

    const request = mockCallTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.scenario_id)).toBe(true)
    expect(request.scenario_id).not.toBe('scenario-1709827200000-abc')
  })

  it('always sends a UUID client_turn_id even when pendingContext has non-UUID chainId', async () => {
    mockCallTurn.mockResolvedValueOnce({ assistant_text: 'ok', client_turn_id: 'resp-chain' })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await result.current.sendMessage('hello') })

    const request = mockCallTurn.mock.calls[0][0]
    expect(UUID_RE.test(request.client_turn_id)).toBe(true)
  })
})
