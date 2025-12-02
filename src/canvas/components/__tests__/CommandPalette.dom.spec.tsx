import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CommandPalette } from '../CommandPalette'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitView: vi.fn(),
  }),
}))

const mockAddNode = vi.fn()
const mockSelectAll = vi.fn()
const mockSaveSnapshot = vi.fn()
const mockApplyLayout = vi.fn().mockResolvedValue(undefined)

const { mockRunLayoutWithProgress } = vi.hoisted(() => ({
  mockRunLayoutWithProgress: vi.fn<[], Promise<boolean>>(),
}))

const baseState: any = {
  addNode: mockAddNode,
  selectAll: mockSelectAll,
  saveSnapshot: mockSaveSnapshot,
  applyLayout: mockApplyLayout,
  nodes: [],
  edges: [],
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector?: any) => (selector ? selector(baseState) : baseState)),
}))

vi.mock('../../layout/runLayoutWithProgress', () => ({
  runLayoutWithProgress: mockRunLayoutWithProgress,
}))

vi.mock('../../hooks/useResultsRun', () => ({
  useResultsRun: () => ({
    run: vi.fn(),
  }),
}))

vi.mock('../../hooks/useValidationFeedback', () => ({
  useValidationFeedback: () => ({
    formatErrors: (errors: any) => errors,
    focusError: vi.fn(),
  }),
}))

vi.mock('../../adapters/plot', () => ({
  plot: {
    validate: vi.fn(() => Promise.resolve({ valid: true, errors: [], violations: [] })),
  },
}))

describe('CommandPalette DOM - Rich Node Types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseState.nodes = []
    baseState.edges = []
  })

  afterEach(() => {
    cleanup()
  })

  it('exposes a Factor node creation action and executes it', async () => {
    const onClose = vi.fn()

    render(<CommandPalette isOpen onClose={onClose} />)

    const input = screen.getByPlaceholderText('Search actions...')
    fireEvent.change(input, { target: { value: 'factor' } })

    const actionButton = await screen.findByText('Add Factor Node')
    fireEvent.click(actionButton)

    expect(mockAddNode).toHaveBeenCalledTimes(1)
    expect(mockAddNode).toHaveBeenCalledWith(undefined, 'factor')
  })

  it('uses runLayoutWithProgress for the Tidy Layout action', async () => {
    const onClose = vi.fn()
    mockRunLayoutWithProgress.mockResolvedValueOnce(true)

    render(<CommandPalette isOpen onClose={onClose} />)

    const tidyButton = await screen.findByRole('button', { name: 'Tidy Layout' })
    fireEvent.click(tidyButton)

    await waitFor(() => {
      expect(mockRunLayoutWithProgress).toHaveBeenCalledTimes(1)
    })
  })

  it('tracks sandbox.run.blocked when Run Analysis is executed on an empty graph', async () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()

    const onClose = vi.fn()

    render(<CommandPalette isOpen onClose={onClose} />)

    const runButton = await screen.findByRole('button', { name: /Run Analysis/ })
    fireEvent.click(runButton)

    await screen.findByText('Cannot run analysis: Graph is empty. Add at least one node.')

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.blocked']).toBe(1)
    expect(counters['sandbox.run.clicked']).toBe(0)
  })

  it('tracks sandbox.run.clicked when Run Analysis is executed on a valid non-empty graph', async () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()

    // Make graph non-empty
    baseState.nodes = [{ id: '1' }]
    baseState.edges = []

    const onClose = vi.fn()

    render(<CommandPalette isOpen onClose={onClose} />)

    const runButton = await screen.findByRole('button', { name: /Run Analysis/ })
    fireEvent.click(runButton)

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.run.clicked']).toBe(1)
    expect(counters['sandbox.run.blocked']).toBe(0)
  })
})
