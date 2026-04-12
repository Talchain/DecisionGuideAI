/**
 * I.2b regression test: cancel behavior for useV2Run hook.
 *
 * Verifies that cancelRun() aborts the in-flight request and calls
 * resultsCancelled() (not resultsError()). This prevents a future refactor
 * from breaking abort semantics while UI-level tests still pass.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useV2Run } from '../useV2Run'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useResultsStore } from '../../stores/resultsStore'

// Mock the V2 adapter module — only executeV2RunWithAnalysisReady is called by the hook
vi.mock('../../../adapters/plot/v2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/plot/v2')>()
  return {
    ...actual,
    executeV2RunWithAnalysisReady: vi.fn(),
  }
})

// Suppress telemetry/instrumentation side-effects
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
  generateRequestId: vi.fn(() => 'req-test-cancel'),
}))

// Import mocked adapter function
import { executeV2RunWithAnalysisReady } from '../../../adapters/plot/v2'
const mockExecute = executeV2RunWithAnalysisReady as Mock

// Minimal canvas state needed for runV2Analysis to proceed
function setupMinimalCanvasState() {
  const baseResults = useCanvasStore.getState().results
  useCanvasStore.setState({
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal' }, position: { x: 0, y: 0 } },
      { id: 'fac-1', type: 'factor', data: { label: 'Factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'goal-1', target: 'fac-1' }],
    outcomeNodeId: 'goal-1',
    ceeAnalysisReady: null,
    ceeAnalysisReadyNodeIds: null,
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

function makeSuccessfulV2Response(overrides: Record<string, unknown> = {}) {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [0.3, 0.7],
        win_probability: 0.65,
        expected_outcome: 1.2,
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [0.2, 0.6],
        win_probability: 0.35,
        expected_outcome: 0.8,
      },
    ],
    critiques: [],
    drivers: [
      { node_id: 'fac-1', label: 'Revenue growth', contribution: 0.45, direction: 'positive' },
    ],
    robustness: {
      fragile_edges: [],
      robust_edges: ['e1'],
      recommendation_stability: 0.82,
    },
    response_hash: 'hash-success',
    meta: {
      seed_used: '42',
      n_samples: 10000,
      detail_level: 'deep',
      latency_ms: 1200,
    },
    ...overrides,
  } as any
}

describe('useV2Run cancel behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMinimalCanvasState()
    useResultsStore.setState({
      results: {
        status: 'idle',
        progress: 0,
        analysisSummary: { stale: true } as any,
        lastSnapshotId: undefined,
      },
    } as any)
  })

  it('calls resultsCancelled (not resultsError) when cancelRun() is invoked', async () => {
    // Track store actions via spying on the state changes
    const stateSnapshots: string[] = []
    const unsubscribe = useCanvasStore.subscribe((state) => {
      stateSnapshots.push(state.results.status)
    })

    // Make executeV2RunWithAnalysisReady hang until aborted, then reject with AbortError.
    // Use plain Error (not DOMException) because jsdom's DOMException may not extend Error.
    function makeAbortError(): Error {
      const err = new Error('The operation was aborted.')
      err.name = 'AbortError'
      return err
    }

    mockExecute.mockImplementation(
      (config: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = config.signal
          if (signal) {
            if (signal.aborted) {
              reject(makeAbortError())
              return
            }
            signal.addEventListener('abort', () => reject(makeAbortError()), { once: true })
          }
        })
    )

    const { result } = renderHook(() => useV2Run())

    // Start the analysis
    let runPromise: Promise<void>
    await act(async () => {
      runPromise = result.current.runV2Analysis()
    })

    // Verify run started
    expect(useCanvasStore.getState().results.status).toBe('preparing')

    // Cancel the run
    await act(async () => {
      result.current.cancelRun()
      // Wait for the abort to propagate and the hook to settle
      await runPromise!
    })

    // Verify: status should be 'cancelled', NOT 'error'
    const finalStatus = useCanvasStore.getState().results.status
    expect(finalStatus).toBe('cancelled')

    // Verify: resultsError was NOT called (no 'error' status in snapshots after 'preparing')
    const statusesAfterPreparing = stateSnapshots.slice(
      stateSnapshots.indexOf('preparing') + 1
    )
    expect(statusesAfterPreparing).not.toContain('error')

    unsubscribe()
  })

  it('does NOT call resultsCancelled on non-abort errors', async () => {
    // Make adapter reject with a regular error (not AbortError)
    mockExecute.mockRejectedValue(new Error('Server exploded'))

    const { result } = renderHook(() => useV2Run())

    await act(async () => {
      await result.current.runV2Analysis()
    })

    // Should be 'error', not 'cancelled'
    expect(useCanvasStore.getState().results.status).toBe('error')
    expect(useCanvasStore.getState().results.error?.code).toBeDefined()
  })

  it('calls persistence.resetAnalysisStatus on cancel (not persistAnalysisFailure)', async () => {
    const mockSetAnalysisRunning = vi.fn().mockResolvedValue(undefined)
    const mockResetAnalysisStatus = vi.fn().mockResolvedValue(undefined)
    const mockPersistAnalysisSuccess = vi.fn().mockResolvedValue(undefined)
    const mockPersistAnalysisFailure = vi.fn().mockResolvedValue(undefined)

    const persistence = {
      setAnalysisRunning: mockSetAnalysisRunning,
      resetAnalysisStatus: mockResetAnalysisStatus,
      persistAnalysisSuccess: mockPersistAnalysisSuccess,
      persistAnalysisFailure: mockPersistAnalysisFailure,
    }

    function makeAbortError(): Error {
      const err = new Error('The operation was aborted.')
      err.name = 'AbortError'
      return err
    }

    mockExecute.mockImplementation(
      (config: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = config.signal
          if (signal) {
            if (signal.aborted) {
              reject(makeAbortError())
              return
            }
            signal.addEventListener('abort', () => reject(makeAbortError()), { once: true })
          }
        })
    )

    const { result } = renderHook(() => useV2Run(persistence))

    // Start analysis — should call setAnalysisRunning
    let runPromise: Promise<void>
    await act(async () => {
      runPromise = result.current.runV2Analysis()
    })

    expect(mockSetAnalysisRunning).toHaveBeenCalledTimes(1)

    // Cancel the run
    await act(async () => {
      result.current.cancelRun()
      await runPromise!
    })

    // Verify: resetAnalysisStatus was called (Supabase cleanup)
    expect(mockResetAnalysisStatus).toHaveBeenCalledTimes(1)

    // Verify: persistAnalysisFailure was NOT called (cancel is not a failure)
    expect(mockPersistAnalysisFailure).not.toHaveBeenCalled()

    // Verify: persistAnalysisSuccess was NOT called (cancel produced no result)
    expect(mockPersistAnalysisSuccess).not.toHaveBeenCalled()
  })

  it('swallows resetAnalysisStatus rejection without destabilising the hook', async () => {
    const mockResetAnalysisStatus = vi.fn().mockRejectedValue(new Error('Supabase unreachable'))

    const persistence = {
      setAnalysisRunning: vi.fn().mockResolvedValue(undefined),
      resetAnalysisStatus: mockResetAnalysisStatus,
      persistAnalysisSuccess: vi.fn().mockResolvedValue(undefined),
      persistAnalysisFailure: vi.fn().mockResolvedValue(undefined),
    }

    function makeAbortError(): Error {
      const err = new Error('The operation was aborted.')
      err.name = 'AbortError'
      return err
    }

    mockExecute.mockImplementation(
      (config: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = config.signal
          if (signal) {
            if (signal.aborted) {
              reject(makeAbortError())
              return
            }
            signal.addEventListener('abort', () => reject(makeAbortError()), { once: true })
          }
        })
    )

    const { result } = renderHook(() => useV2Run(persistence))

    let runPromise: Promise<void>
    await act(async () => {
      runPromise = result.current.runV2Analysis()
    })

    // Cancel — resetAnalysisStatus will reject, but hook should not throw
    await act(async () => {
      result.current.cancelRun()
      await runPromise!
    })

    // Hook settled without error; resetAnalysisStatus was attempted
    expect(mockResetAnalysisStatus).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().results.status).toBe('cancelled')
  })

  it('clears stale summary on start and refreshes it on successful V2 completion', async () => {
    mockExecute.mockResolvedValue(makeSuccessfulV2Response())

    const { result } = renderHook(() => useV2Run())

    await act(async () => {
      await result.current.runV2Analysis()
    })

    const summary = useResultsStore.getState().results.analysisSummary
    expect(summary).not.toBeNull()
    expect(summary?.recommendation.option_id).toBe('opt_a')
    expect(summary?.run_metadata.seed).toBe('42')
  })
})
