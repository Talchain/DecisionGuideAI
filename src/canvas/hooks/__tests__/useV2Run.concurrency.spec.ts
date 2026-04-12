/**
 * Audit F-76/F-77/P0 regression: useV2Run concurrency safety.
 *
 * Verifies:
 * - Rapid consecutive calls abort the previous run (F-77)
 * - Superseded run's abort does not clobber active run state (P0)
 * - Only the latest run updates the store (F-76)
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
  generateRequestId: vi.fn(() => 'req-test-concurrency'),
}))

import { executeV2RunWithAnalysisReady } from '../../../adapters/plot/v2'
const mockExecute = executeV2RunWithAnalysisReady as Mock

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

function makeAbortError(): Error {
  const err = new Error('The operation was aborted.')
  err.name = 'AbortError'
  return err
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMinimalCanvasState()
  useResultsStore.setState({ analysisSummary: null })
})

describe('Audit F-77: double-click aborts previous run', () => {
  it('aborts first run when second run starts', async () => {
    let firstRunSignal: AbortSignal | null = null

    // First call: hang forever, capture signal
    mockExecute.mockImplementationOnce(async (config: any) => {
      firstRunSignal = config.signal
      return new Promise(() => {}) // never resolves
    })

    // Second call: hang too (we only care about signal state)
    mockExecute.mockImplementationOnce(async () => {
      return new Promise(() => {})
    })

    const { result } = renderHook(() => useV2Run())

    // Start first run (don't await — it hangs)
    act(() => {
      void result.current.runV2Analysis()
    })

    // Start second run immediately (double-click)
    act(() => {
      void result.current.runV2Analysis()
    })

    // First run's signal should be aborted
    expect(firstRunSignal?.aborted).toBe(true)

    // isRunning should still be true (second run is in progress)
    expect(result.current.isRunning).toBe(true)
  })
})

describe('Audit P0: superseded run does not clobber active run state', () => {
  it('aborted first run does not set isRunning=false while second run is in progress', async () => {
    // First call: hang then reject with AbortError when aborted
    mockExecute.mockImplementationOnce(async (config: any) => {
      return new Promise((_resolve, reject) => {
        config.signal.addEventListener('abort', () => {
          reject(makeAbortError())
        })
      })
    })

    // Second call: hang forever (we only check state during)
    mockExecute.mockImplementationOnce(async () => {
      return new Promise(() => {})
    })

    const { result } = renderHook(() => useV2Run())

    // Start first run
    act(() => {
      result.current.runV2Analysis()
    })

    // Start second run (aborts first)
    act(() => {
      result.current.runV2Analysis()
    })

    // Let the first run's AbortError propagate through microtasks
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // isRunning must still be true — second run is active
    expect(result.current.isRunning).toBe(true)

    // resultsCancelled should NOT have been called for the superseded run
    const storeState = useCanvasStore.getState()
    expect(storeState.results?.status).not.toBe('cancelled')
  })

  it('only the latest run can set isRunning=false on completion', async () => {
    let resolveSecondRun: ((value: any) => void) | null = null

    const successResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      option_comparison: [],
      response_hash: 'hash-second',
      request_id: 'req-second',
      outcome: { mean: 100, p10: 80, p50: 100, p90: 120 },
    }

    // First call: reject with AbortError immediately when aborted
    mockExecute.mockImplementationOnce(async (config: any) => {
      return new Promise((_resolve, reject) => {
        config.signal.addEventListener('abort', () => {
          reject(makeAbortError())
        })
      })
    })

    // Second call: hang until we resolve it
    mockExecute.mockImplementationOnce(async () => {
      return new Promise((resolve) => {
        resolveSecondRun = resolve
      })
    })

    const { result } = renderHook(() => useV2Run())

    // Start first run, then immediately start second run
    act(() => {
      void result.current.runV2Analysis()
    })
    act(() => {
      void result.current.runV2Analysis()
    })

    // Let first run's abort propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Still running (second run active)
    expect(result.current.isRunning).toBe(true)

    // Resolve second run
    await act(async () => {
      resolveSecondRun?.(successResponse)
      await new Promise((r) => setTimeout(r, 0))
    })

    // Now isRunning should be false
    expect(result.current.isRunning).toBe(false)
  })
})
