import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ResultsPanel } from '../../panels/ResultsPanel'
import { useCanvasStore } from '../../store'
import { LayerProvider } from '../LayerProvider'
import { ToastProvider } from '../../ToastContext'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import * as useResultsRunModule from '../../hooks/useResultsRun'
import * as useEngineLimitsModule from '../../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../../hooks/useEngineLimits'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'
import { useLimitsStore } from '../../../stores/limitsStore'

vi.mock('../../hooks/useResultsRun', () => ({
  useResultsRun: vi.fn(),
}))

vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseResultsRun = vi.mocked(useResultsRunModule.useResultsRun)
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

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ReactFlowProvider>
      <ToastProvider>
        <LayerProvider>{ui}</LayerProvider>
      </ToastProvider>
    </ReactFlowProvider>
  )
}

// Helper to create edge with confidence, mirroring store.validation.spec
const createEdgeWithConfidence = (source: string, target: string, confidence: number) => ({
  source,
  target,
  data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` },
})

describe('ResultsPanel run gating (idle state)', () => {
  beforeEach(() => {
    const state = useCanvasStore.getState()
    if ((state as any).resetCanvas) {
      ;(state as any).resetCanvas()
    }
    useCanvasStore.setState({ graphHealth: null } as any)
    useLimitsStore.setState({ limits: null } as any)
    vi.clearAllMocks()

    mockUseResultsRun.mockReturnValue({
      run: vi.fn(),
      cancel: vi.fn(),
    } as any)
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()
  })

  it('blocks Run Analysis when validation errors exist and shows helper toast', async () => {
    const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

    resetCanvas()
    useCanvasStore.setState({ graphHealth: null } as any)

    // Build a non-empty graph with validation errors (probabilities sum to 110%)
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })
    addNode({ x: 100, y: 100 })

    addEdge(createEdgeWithConfidence('1', '2', 0.6) as any)
    addEdge(createEdgeWithConfidence('1', '3', 0.5) as any)

    const runSpy = vi.fn()
    mockUseResultsRun.mockReturnValue({
      run: runSpy,
      cancel: vi.fn(),
    } as any)

    renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

    const runButton = screen.getByRole('button', { name: 'Run Analysis' })
    fireEvent.click(runButton)

    expect(runSpy).not.toHaveBeenCalled()

    // Message from deriveRunEligibility for validation reason
    await screen.findByText('Fix validation issues before running this decision.')

     const counters = __getTelemetryCounters()
     expect(counters['sandbox.run.blocked']).toBe(1)
     expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('blocks Run Analysis when graph health has errors and shows helper toast', async () => {
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

    const runSpy = vi.fn()
    mockUseResultsRun.mockReturnValue({
      run: runSpy,
      cancel: vi.fn(),
    } as any)

    renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

    const runButton = screen.getByRole('button', { name: 'Run Analysis' })
    fireEvent.click(runButton)

    expect(runSpy).not.toHaveBeenCalled()

    await screen.findByText('Resolve 2 graph errors in the Issues panel before running.')

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('blocks Run Analysis when limits are at capacity and shows helper toast', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    addNode({ x: 0, y: 0 })
    addNode({ x: 100, y: 0 })

    // Configure limits store so nodes are at/over the recommended limit
    useLimitsStore.setState({
      limits: {
        schema: 'limits.v1',
        max_nodes: 1,
        max_edges: 100,
        max_body_kb: 1024,
        rate_limit_rpm: 60,
        engine_p95_ms_budget: 30000,
      } as any,
    } as any)

    mockUseEngineLimits.mockReturnValue(
      createMockLimitsReturn({
        limits: {
          nodes: { max: 1 },
          edges: { max: 100 },
          engine_p95_ms_budget: 30000,
        },
      }),
    )

    const runSpy = vi.fn()
    mockUseResultsRun.mockReturnValue({
      run: runSpy,
      cancel: vi.fn(),
    } as any)

    renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

    const runButton = screen.getByRole('button', { name: 'Run Analysis' })
    fireEvent.click(runButton)

    expect(runSpy).not.toHaveBeenCalled()

    await screen.findByText("Simplify this graph to stay within the engine's limits before running.")

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('emits sandbox.run.clicked when idle CTA is eligible and runs analysis', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()

    resetCanvas()
    useCanvasStore.setState({ graphHealth: null } as any)

    // Minimal non-empty graph with no validation errors and within limits
    addNode({ x: 0, y: 0 })

    const runSpy = vi.fn()
    mockUseResultsRun.mockReturnValue({
      run: runSpy,
      cancel: vi.fn(),
    } as any)

    renderWithProviders(<ResultsPanel isOpen={true} onClose={vi.fn()} />)

    const runButton = screen.getByRole('button', { name: 'Run Analysis' })
    fireEvent.click(runButton)

    // Run should be invoked for eligible graph
    expect(runSpy).toHaveBeenCalledTimes(1)

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.clicked']).toBe(1)
    expect(counters['sandbox.run.blocked']).toBe(0)
  })
})
