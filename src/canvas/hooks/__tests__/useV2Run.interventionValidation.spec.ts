/**
 * Pre-run intervention validation in useV2Run.
 *
 * Verifies:
 * - Analysis is blocked when options have empty interventions
 * - Error message names the offending option(s)
 * - Error is surfaced via resultsError store action
 * - executeV2RunWithAnalysisReady is NEVER called when validation fails
 * - Analysis proceeds when all options have interventions
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useV2Run } from '../useV2Run'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useResultsStore } from '../../stores/resultsStore'

// Mock the V2 adapter module
vi.mock('../../../adapters/plot/v2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/plot/v2')>()
  return {
    ...actual,
    executeV2RunWithAnalysisReady: vi.fn(),
  }
})

// Suppress telemetry
vi.mock('../../../lib/resultsInstrumentation', () => ({
  trackRunCompleted: vi.fn(),
  trackRunFailed: vi.fn(),
  trackEmptyComputedResults: vi.fn(),
}))
vi.mock('../../../lib/telemetry', () => ({
  trackTypedError: vi.fn(),
}))
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
  updateRobustnessGate: vi.fn(),
  updateRobustnessGateFromV2: vi.fn(),
}))
vi.mock('../../../utils/payloadRedaction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/payloadRedaction')>()
  return {
    ...actual,
    buildRawErrorData: vi.fn(() => null),
    hashStackTrace: vi.fn(() => ''),
  }
})
vi.mock('../../../types/requestId', () => ({
  generateRequestId: vi.fn(() => 'req-test-interventions'),
}))

import { executeV2RunWithAnalysisReady } from '../../../adapters/plot/v2'
import { trackRunFailed } from '../../../lib/resultsInstrumentation'
const mockExecute = executeV2RunWithAnalysisReady as Mock
const mockTrackRunFailed = trackRunFailed as Mock

function setupCanvasWithOptions(options: {
  analysisReady?: any
  optionNodes?: any[]
}) {
  const baseResults = useCanvasStore.getState().results

  // Auto-create canvas option nodes from analysisReady options so
  // isAnalysisReadyStale doesn't clear effectiveAnalysisReady
  const arOptionNodes = (options.analysisReady?.options || []).map((o: any, i: number) => ({
    id: o.id,
    type: 'option',
    data: { label: o.label, kind: 'option', interventions: o.interventions },
    position: { x: 200 + i * 100, y: 0 },
  }))

  const nodes: any[] = [
    { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
    { id: 'fac-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ...arOptionNodes,
    ...(options.optionNodes || []),
  ]

  useCanvasStore.setState({
    nodes,
    edges: [{ id: 'e1', source: 'goal-1', target: 'fac-1' }],
    outcomeNodeId: 'goal-1',
    ceeAnalysisReady: options.analysisReady ?? null,
    ceeAnalysisReadyNodeIds: options.analysisReady
      ? nodes.map((n) => n.id)
      : null,
    goalConstraints: null,
    goalThreshold: null,
    currentScenarioFraming: null,
    results: {
      ...baseResults,
      status: 'idle',
    },
  } as any)
  // lastDraftDescription lives in useDraftStore as of C3-5
  useDraftStore.getState().setLastDraftDescription('')
}

beforeEach(() => {
  vi.clearAllMocks()
  useResultsStore.setState({ analysisSummary: null })
})

describe('Pre-run intervention validation', () => {
  it('blocks run when analysisReady option has empty interventions', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Empty Option', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.error).toContain('Empty Option')
    expect(result.current.error).toContain('intervention values')
    expect(result.current.isRunning).toBe(false)

    // Check resultsError was called via store
    const resultsState = useCanvasStore.getState().results
    expect(resultsState.status).toBe('error')
  })

  it('blocks run when fallback path has options without interventions', async () => {
    setupCanvasWithOptions({
      analysisReady: null,
      optionNodes: [
        {
          id: 'opt-1',
          type: 'option',
          data: { label: 'No Interventions', kind: 'option' },
          position: { x: 200, y: 0 },
        },
      ],
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.error).toContain('No Interventions')
  })

  it('allows run when all options have valid interventions', async () => {
    mockExecute.mockResolvedValue({
      analysis_status: 'computed',
      option_comparison: [],
      response_hash: 'test-hash',
    })

    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          {
            id: 'opt-1',
            label: 'Good Option',
            status: 'ready',
            interventions: { 'fac-1': { value: 10, source: 'cee_hypothesis' } },
          },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('reports multiple options in error message', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: {} },
          { id: 'opt-2', label: 'Option B', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockExecute).not.toHaveBeenCalled()
    expect(result.current.error).toContain('Option A')
    expect(result.current.error).toContain('Option B')
  })

  it('tracks failure with MISSING_INTERVENTIONS code', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Bad Option', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockTrackRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        error_code: 'MISSING_INTERVENTIONS',
      }),
    )
  })

  it('attaches affectedOptions to the store error so the UI can render coached recovery', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: {} },
          { id: 'opt-2', label: 'Option B', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('MISSING_INTERVENTIONS')
    expect(storeError?.affectedOptions).toBeDefined()
    const ids = (storeError?.affectedOptions ?? []).map((o) => o.id).sort()
    const labels = (storeError?.affectedOptions ?? []).map((o) => o.label).sort()
    expect(ids).toEqual(['opt-1', 'opt-2'])
    expect(labels).toEqual(['Option A', 'Option B'])
  })

  it('promotes PLoT 422 EMPTY_INTERVENTIONS critique to the error code with affectedOptions', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          // Both options have interventions so the pre-run gate passes; PLoT
          // is the one rejecting (simulated by the mock below).
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: { 'fac-1': 0.5 } },
          { id: 'opt-2', label: 'Option B', status: 'ready', interventions: { 'fac-1': 0.3 } },
        ],
      },
    })

    mockExecute.mockResolvedValueOnce({
      analysis_status: 'blocked',
      status_reason: 'Options missing intervention values',
      critiques: [
        {
          code: 'EMPTY_INTERVENTIONS',
          severity: 'blocker',
          message: 'opt-1 has no interventions',
          affected_nodes: ['opt-1'],
        },
      ],
      request_id: 'req-test-interventions',
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('EMPTY_INTERVENTIONS')
    expect(storeError?.affectedOptions).toEqual([
      { id: 'opt-1', label: 'Option A' },
    ])
  })

  it('still renders the coached state when PLoT critique references stale option ids (id fallback)', async () => {
    // Simulate: PLoT critique points at "opt-deleted" which is no longer on the
    // canvas (e.g. user deleted the option between request build and response).
    // Coached UI must still render — using the id as the visible label —
    // because that is more honest and more actionable than "Something went wrong".
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: { 'fac-1': 0.5 } },
          { id: 'opt-2', label: 'Option B', status: 'ready', interventions: { 'fac-1': 0.3 } },
        ],
      },
    })

    mockExecute.mockResolvedValueOnce({
      analysis_status: 'blocked',
      status_reason: 'Options missing intervention values',
      critiques: [
        {
          code: 'EMPTY_INTERVENTIONS',
          severity: 'blocker',
          message: 'opt-deleted has no interventions',
          affected_nodes: ['opt-deleted'],
        },
      ],
      request_id: 'req-test-interventions',
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('EMPTY_INTERVENTIONS')
    // Stale id falls through as both id and label so the coached banner can render.
    expect(storeError?.affectedOptions).toEqual([
      { id: 'opt-deleted', label: 'opt-deleted' },
    ])
  })

  it('preserves duplicate-label options as distinct entries (keyed by id)', async () => {
    // Two options with the same display label must NOT collapse — the user
    // needs to see both entries so they can configure each one independently.
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: {} },
          { id: 'opt-2', label: 'Option A', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.affectedOptions).toHaveLength(2)
    const ids = (storeError?.affectedOptions ?? []).map((o) => o.id).sort()
    expect(ids).toEqual(['opt-1', 'opt-2'])
  })

  it('leaves the generic VALIDATION_BLOCKED code in place for unrelated 422 critiques', async () => {
    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Option A', status: 'ready', interventions: { 'fac-1': 0.5 } },
          { id: 'opt-2', label: 'Option B', status: 'ready', interventions: { 'fac-1': 0.3 } },
        ],
      },
    })

    mockExecute.mockResolvedValueOnce({
      analysis_status: 'blocked',
      status_reason: 'Graph contains a cycle',
      critiques: [
        {
          code: 'GRAPH_HAS_CYCLE',
          severity: 'blocker',
          message: 'cycle detected',
        },
      ],
      request_id: 'req-test-interventions',
    })

    const { result } = renderHook(() => useV2Run())
    await act(async () => {
      await result.current.runV2Analysis()
    })

    const storeError = useCanvasStore.getState().results.error
    expect(storeError?.code).toBe('VALIDATION_BLOCKED')
    expect(storeError?.affectedOptions).toBeUndefined()
  })

  it('persists failure to Supabase when persistence is provided', async () => {
    const mockPersistFailure = vi.fn().mockResolvedValue(undefined)
    const mockPersistence = {
      setAnalysisRunning: vi.fn().mockResolvedValue(undefined),
      persistAnalysisSuccess: vi.fn().mockResolvedValue(undefined),
      persistAnalysisFailure: mockPersistFailure,
    }

    setupCanvasWithOptions({
      analysisReady: {
        goal_node_id: 'goal-1',
        status: 'ready',
        options: [
          { id: 'opt-1', label: 'Bad Option', status: 'ready', interventions: {} },
        ],
      },
    })

    const { result } = renderHook(() => useV2Run(mockPersistence))
    await act(async () => {
      await result.current.runV2Analysis()
    })

    expect(mockPersistFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_INTERVENTIONS' }),
    )
  })
})
