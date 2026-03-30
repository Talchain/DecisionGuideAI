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

describe('CommandPalette DOM - Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseState.nodes = []
    baseState.edges = []
  })

  afterEach(() => {
    cleanup()
  })

  it('renders with dialog role and aria-label', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Command palette')
  })

  it('traps focus within the dialog (Tab wraps to first element)', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search actions...')
    // Input should be focused on open
    expect(document.activeElement).toBe(input)

    // Get all action buttons
    const buttons = screen.getAllByRole('button')
    const lastButton = buttons[buttons.length - 1]

    // Focus the last button, then Tab should wrap to input
    lastButton.focus()
    expect(document.activeElement).toBe(lastButton)
    fireEvent.keyDown(document, { key: 'Tab' })
    // Focus trap should wrap back to input (first focusable)
    expect(document.activeElement).toBe(input)
  })

  it('restores focus to trigger element on close', () => {
    // Create a trigger button and focus it
    const triggerButton = document.createElement('button')
    triggerButton.textContent = 'Open Palette'
    document.body.appendChild(triggerButton)
    triggerButton.focus()
    expect(document.activeElement).toBe(triggerButton)

    const onClose = vi.fn()
    const { rerender } = render(<CommandPalette isOpen onClose={onClose} />)

    // Focus should move to the palette input
    const input = screen.getByPlaceholderText('Search actions...')
    expect(document.activeElement).toBe(input)

    // Close the palette
    rerender(<CommandPalette isOpen={false} onClose={onClose} />)

    // Focus should return to the trigger button
    expect(document.activeElement).toBe(triggerButton)

    // Cleanup
    document.body.removeChild(triggerButton)
  })

  it('sets aria-activedescendant on input based on arrow key selection', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search actions...')

    // Initial state: first item selected
    expect(input.getAttribute('aria-activedescendant')).toBe('cmd-action-run-analysis')

    // Arrow down to select second item
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('cmd-action-add-goal')
  })

  it('keeps dialog open when Run Analysis fails on empty graph (Enter key)', async () => {
    const onClose = vi.fn()
    render(<CommandPalette isOpen onClose={onClose} />)

    // Press Enter on "Run Analysis" (first item, selected by default)
    fireEvent.keyDown(document, { key: 'Enter' })

    // Error should be visible — dialog stays open
    await screen.findByText('Cannot run analysis: Graph is empty. Add at least one node.')
    expect(onClose).not.toHaveBeenCalled()
  })
})

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
