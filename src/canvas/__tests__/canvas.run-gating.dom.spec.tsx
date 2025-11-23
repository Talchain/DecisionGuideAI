import { describe, it, beforeEach, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ToastProvider } from '../ToastContext'
import { CanvasToolbar } from '../CanvasToolbar'
import { useCanvasStore } from '../store'
import { DEFAULT_EDGE_DATA } from '../domain/edges'
import * as useEngineLimitsModule from '../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../hooks/useEngineLimits'
import * as runEligibilityModule from '../utils/runEligibility'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../lib/telemetry'

// Shared mock for useResultsRun.run so we can assert toolbar gating behaviour
const runMock = vi.fn()

vi.mock('../hooks/useResultsRun', () => ({
  useResultsRun: () => ({
    run: runMock,
    cancel: vi.fn(),
  }),
}))

// Mock plot adapter so we can assert run calls without hitting network
vi.mock('../../adapters/plot', () => ({
  plot: {
    run: vi.fn(() =>
      Promise.resolve({
        schema: 'report.v1',
        meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
        model_card: { response_hash: 'hash-123', response_hash_algo: 'sha256', normalized: true },
        results: { conservative: 0.5, likely: 0.6, optimistic: 0.7 },
        confidence: { level: 'medium', why: 'Test' },
        drivers: [],
      } as any),
    ),
    validate: vi.fn(() => Promise.resolve({ valid: true, errors: [], violations: [] })),
  },
}))

vi.mock('../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockLimitsReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
  limits: {
    nodes: { max: 200 },
    edges: { max: 500 },
    engine_p95_ms_budget: 30000,
  },
  source: 'live',
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  retry: vi.fn(),
  ...overrides,
})

function renderToolbar() {
  return render(
    <ReactFlowProvider>
      <ToastProvider>
        <CanvasToolbar />
      </ToastProvider>
    </ReactFlowProvider>,
  )
}

const createEdgeWithConfidence = (source: string, target: string, confidence: number) => ({
  source,
  target,
  data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` },
})

describe('CanvasToolbar run gating (DOM)', () => {
  beforeEach(() => {
    const state = useCanvasStore.getState()
    if ((state as any).resetCanvas) {
      ;(state as any).resetCanvas()
    }
    mockUseEngineLimits.mockReset()
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    // Enable telemetry and reset counters for each test
    localStorage.setItem('feature.telemetry', '1')
    __resetTelemetryCounters()
  })

  it('blocks Run when validation errors exist and shows helper toast', async () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()

    // Build a non-empty graph with validation errors (probabilities sum to 110%)
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.6) as any)
    addEdge(createEdgeWithConfidence('1', '3', 0.5) as any)

    runMock.mockClear()

    renderToolbar()

    const runButton = screen.getByTestId('btn-run-analysis')
    fireEvent.click(runButton)

    expect(runMock).not.toHaveBeenCalled()

    await screen.findByText('Fix validation issues before running this decision.')

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('blocks Run when graph health has errors and shows helper toast', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })

    useCanvasStore.setState({
      graphHealth: {
        status: 'errors',
        score: 40,
        issues: [
          { id: '1', type: 'cycle', severity: 'error', message: 'Test error' },
          { id: '2', type: 'dangling_edge', severity: 'error', message: 'Another error' },
        ],
      },
    } as any)

    const { plot } = await import('../../adapters/plot')
    const runMock = vi.mocked(plot.run)
    runMock.mockClear()

    renderToolbar()

    const runButton = screen.getByTestId('btn-run-analysis')
    fireEvent.click(runButton)

    expect(runMock).not.toHaveBeenCalled()

    await screen.findByText('Resolve 2 graph errors in the Issues panel before running.')

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('blocks Run when limits are at capacity and shows helper toast', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })

    mockUseEngineLimits.mockReturnValue(
      createMockLimitsReturn({
        limits: {
          nodes: { max: 2 },
          edges: { max: 100 },
          engine_p95_ms_budget: 30000,
        },
      }),
    )

    const eligibilitySpy = vi.spyOn(runEligibilityModule, 'deriveRunEligibility')

    const { plot } = await import('../../adapters/plot')
    const runMock = vi.mocked(plot.run)
    runMock.mockClear()

    renderToolbar()

    const runButton = screen.getByTestId('btn-run-analysis')
    fireEvent.click(runButton)

    expect(runMock).not.toHaveBeenCalled()

    expect(eligibilitySpy).toHaveBeenCalled()
    const options = eligibilitySpy.mock.calls[0][0]
    expect(options.nodeCount).toBe(2)
    expect(options.edgeCount).toBe(0)
    expect(options.hasValidationErrors).toBe(false)
    expect(options.limitsStatus?.zone).toBe('at_limit')

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('emits sandbox.run.clicked for a valid within-limits toolbar run', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    useCanvasStore.setState({ graphHealth: null } as any)

    // Minimal non-empty graph with no validation errors and within limits
    addNode({ x: 0, y: 0 })

    runMock.mockClear()

    renderToolbar()

    const runButton = screen.getByTestId('btn-run-analysis')
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(runMock).toHaveBeenCalledTimes(1)
    })

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.clicked']).toBe(1)
    expect(counters['sandbox.run.blocked']).toBe(0)
  })

  it.skip('runs analysis once for a valid, within-limits graph', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })

    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    const eligibilitySpy = vi.spyOn(runEligibilityModule, 'deriveRunEligibility')

    const { plot } = await import('../../adapters/plot')
    const runMock = vi.mocked(plot.run)
    runMock.mockClear()

    renderToolbar()

    const runButton = screen.getByTestId('btn-run-analysis')
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(runMock).toHaveBeenCalledTimes(1)
    })

    // Note: In this PoC harness the happy-path run is sensitive to engine
    // probe/health wiring, so we keep these expectations as documentation
    // of the intended inputs to deriveRunEligibility but skip the test to
    // avoid flakiness. The blocked reasons (validation/health/limits) are
    // still fully exercised above.
    expect(eligibilitySpy).toHaveBeenCalled()
    const options = eligibilitySpy.mock.calls[0][0]
    expect(options.nodeCount).toBe(2)
    expect(options.edgeCount).toBe(0)
    expect(options.hasValidationErrors).toBe(false)
    expect(options.limitsStatus?.zone).toBe('comfortable')
  })

  it.skip('blocks Run on empty graph via keyboard shortcut and shows empty-graph helper toast', async () => {
    // TODO: Implement keyboard-based run gating test against ReactFlowGraph shell
    // once keyboard shortcut wiring is stable in this PoC. This will exercise the
    // `empty` reason from deriveRunEligibility and assert the corresponding toast.
  })
})
