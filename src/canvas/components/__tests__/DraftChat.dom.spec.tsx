import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DraftChat } from '../DraftChat'
import { LayerProvider } from '../LayerProvider'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import type { DraftModelState } from '../../hooks/useDraftModel'
import * as draftHookModule from '../../hooks/useDraftModel'
import { __getTelemetryCounters, __resetTelemetryCounters } from '../../../lib/telemetry'

vi.mock('../../hooks/useDraftModel', () => ({
  useDraftModel: vi.fn(),
}))

const mockUseDraftModel = vi.mocked(draftHookModule.useDraftModel)

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <LayerProvider>{ui}</LayerProvider>
    </ToastProvider>
  )
}

const createState = (overrides?: Partial<DraftModelState>): DraftModelState => ({
  status: 'idle',
  description: '',
  draft: null,
  events: [],
  error: null,
  ...overrides,
})

describe('DraftChat DOM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof useCanvasStore.getState().reset === 'function') {
      useCanvasStore.getState().reset()
    }
    try {
      localStorage.removeItem('feature.telemetry')
    } catch {
      // ignore
    }
    __resetTelemetryCounters()
  })

  const enableTelemetry = () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {
      // ignore
    }
  }

  it('renders Draft my model header when open', () => {
    mockUseDraftModel.mockReturnValue({
      state: createState(),
      requestDraft: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    const draftLabels = screen.getAllByText('Draft my model')
    expect(draftLabels.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('Collapse Draft my model')).toBeInTheDocument()
  })

  it('collapses to a compact chip when closed', () => {
    mockUseDraftModel.mockReturnValue({
      state: createState(),
      requestDraft: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    const collapseButton = screen.getByLabelText('Collapse Draft my model')
    fireEvent.click(collapseButton)

    expect(
      screen.getByRole('button', { name: 'Open Draft my model chat' }),
    ).toBeInTheDocument()
  })

  it('submits DraftForm and calls requestDraft', async () => {
    const requestDraft = vi.fn().mockResolvedValue(undefined)

    mockUseDraftModel.mockReturnValue({
      state: createState(),
      requestDraft,
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    const promptInput = screen.getByLabelText(/what decision are you making/i)
    fireEvent.change(promptInput, { target: { value: 'Launch decision' } })

    const submitButton = screen.getByRole('button', { name: 'Draft my model' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(requestDraft).toHaveBeenCalledTimes(1)
    })
  })

  it('shows streaming panel when status is streaming', () => {
    mockUseDraftModel.mockReturnValue({
      state: createState({ status: 'streaming', events: [] }),
      requestDraft: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    expect(screen.getByText(/Drafting your model/i)).toBeInTheDocument()
  })

  it('renders DiffViewer when draft is ready and applies changes', async () => {
    enableTelemetry()

    const reset = vi.fn()
    const draft = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'New node' }],
        edges: [],
      },
    } as any

    mockUseDraftModel.mockReturnValue({
      state: createState({ status: 'ready', draft }),
      requestDraft: vi.fn(),
      reset,
      setError: vi.fn(),
    })

    const pushHistorySpy = vi.spyOn(useCanvasStore.getState(), 'pushHistory')

    renderWithProviders(<DraftChat />)

    const applyButton = screen.getByRole('button', { name: /Apply Changes/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(pushHistorySpy).toHaveBeenCalled()
      expect(reset).toHaveBeenCalled()
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.apply']).toBe(1)
    expect(counters['draft.reject']).toBe(0)
  })

  it('renders ClarifierPanel when draft includes clarifier questions', () => {
    const draft = {
      schema: 'draft.v1',
      graph: {
        nodes: [],
        edges: [],
      },
      clarifier: {
        round: 1,
        questions: [
          { id: 'q1', text: 'Question 1', type: 'text', required: true },
        ],
      },
    } as any

    mockUseDraftModel.mockReturnValue({
      state: createState({ status: 'ready', draft }),
      requestDraft: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    // Clarifier header from ClarifierPanel
    expect(screen.getByText('Help us clarify your model')).toBeInTheDocument()
    // DiffViewer header should not be shown yet
    expect(screen.queryByText('Review Draft Changes')).not.toBeInTheDocument()
  })

  it('shows DiffViewer after skipping clarifier', async () => {
    enableTelemetry()

    const draft = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'New node' }],
        edges: [],
      },
      clarifier: {
        round: 1,
        questions: [
          { id: 'q1', text: 'Question 1', type: 'text', required: false },
        ],
      },
    } as any

    mockUseDraftModel.mockReturnValue({
      state: createState({ status: 'ready', draft }),
      requestDraft: vi.fn(),
      reset: vi.fn(),
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    expect(screen.getByText('Help us clarify your model')).toBeInTheDocument()

    const skipButton = screen.getByRole('button', { name: 'Skip and continue' })
    fireEvent.click(skipButton)

    await waitFor(() => {
      expect(screen.queryByText('Help us clarify your model')).not.toBeInTheDocument()
      expect(screen.getByText('Review Draft Changes')).toBeInTheDocument()
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.clarifier.skip']).toBe(1)
  })

  it('emits telemetry when rejecting draft', async () => {
    enableTelemetry()

    const reset = vi.fn()
    const draft = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'New node' }],
        edges: [],
      },
    } as any

    mockUseDraftModel.mockReturnValue({
      state: createState({ status: 'ready', draft }),
      requestDraft: vi.fn(),
      reset,
      setError: vi.fn(),
    })

    renderWithProviders(<DraftChat />)

    const rejectButton = screen.getByRole('button', { name: /Reject/i })
    fireEvent.click(rejectButton)

    await waitFor(() => {
      expect(reset).toHaveBeenCalled()
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.reject']).toBe(1)
    expect(counters['draft.apply']).toBe(0)
  })

  it('emits telemetry when submitting clarifier answers', async () => {
    enableTelemetry()

    const draftWithClarifier = {
      schema: 'draft.v1',
      graph: {
        nodes: [],
        edges: [],
      },
      clarifier: {
        round: 1,
        questions: [
          { id: 'q1', text: 'Question 1', type: 'text', required: true },
        ],
      },
    } as any

    let hookState: DraftModelState = createState()
    const reset = vi.fn()

    const requestDraft = vi.fn(async (req: any) => {
      if (hookState.status === 'idle') {
        hookState = createState({ status: 'ready', draft: draftWithClarifier, description: req.prompt })
      }
    })

    mockUseDraftModel.mockImplementation(() => ({
      state: hookState,
      requestDraft,
      reset,
      setError: vi.fn(),
    }))

    renderWithProviders(<DraftChat />)

    const promptInput = screen.getByLabelText(/what decision are you making/i)
    fireEvent.change(promptInput, { target: { value: 'Clarifier test' } })

    const submitButton = screen.getByRole('button', { name: 'Draft my model' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Help us clarify your model')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Type your answer here...')
    fireEvent.change(textarea, { target: { value: 'Some answer' } })

    const clarifierSubmit = screen.getByText('Submit Answers')
    fireEvent.click(clarifierSubmit)

    await waitFor(() => {
      expect(requestDraft).toHaveBeenCalledTimes(2)
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.clarifier.submit']).toBe(1)
  })
})
