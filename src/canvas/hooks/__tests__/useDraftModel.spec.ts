import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDraftModel, type DraftModelState } from '../useDraftModel'
import * as httpModule from '../../../adapters/assistants/http'
import { __getTelemetryCounters, __resetTelemetryCounters } from '../../../lib/telemetry'

vi.mock('../../../adapters/assistants/http', () => ({
  draftGraph: vi.fn(),
  draftGraphStream: vi.fn(),
}))

const mockDraftGraph = vi.mocked(httpModule.draftGraph)
const mockDraftGraphStream = vi.mocked(httpModule.draftGraphStream)

const createInitialState = (): DraftModelState => ({
  status: 'idle',
  description: '',
  draft: null,
  events: [],
  error: null,
})

describe('useDraftModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      localStorage.removeItem('feature.telemetry')
    } catch {
      // ignore
    }
    __resetTelemetryCounters()
  })

  it('returns idle initial state', () => {
    const { result } = renderHook(() => useDraftModel({ streaming: false }))
    expect(result.current.state).toEqual(createInitialState())
  })

  it('sets error when prompt is empty', async () => {
    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: '   ' } as any)
    })

    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toMatch(/describe your decision/i)
  })

  it('performs sync draft via draftGraph and reaches ready state', async () => {
    const mockResponse = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'Decision A' }],
        edges: [],
      },
    } as any

    mockDraftGraph.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Test decision' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })

    expect(mockDraftGraph).toHaveBeenCalledTimes(1)
    expect(result.current.state.draft).toEqual(mockResponse)
    expect(result.current.state.description).toBe('Test decision')
    expect(result.current.state.events).toEqual([])
  })

  it('handles sync errors from draftGraph', async () => {
    mockDraftGraph.mockRejectedValueOnce({
      code: 'SERVER_ERROR',
      message: 'Backend failed',
    })

    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Something' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })

    expect(result.current.state.error).toMatch(/Backend failed/)
  })

  it('streams events via draftGraphStream and resolves with complete draft', async () => {
    const completeDraft = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'Node 1' }],
        edges: [{ id: 'e1', from: 'n1', to: 'n1' }],
      },
    } as any

    const streamImpl = async function* () {
      yield { type: 'node', data: { id: 'n1', label: 'Node 1' } } as any
      yield { type: 'edge', data: { id: 'e1', from: 'n1', to: 'n1' } } as any
      yield { type: 'complete', data: completeDraft } as any
    }

    mockDraftGraphStream.mockImplementation(streamImpl as any)

    const { result } = renderHook(() => useDraftModel({ streaming: true }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Streamed decision' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })

    expect(mockDraftGraphStream).toHaveBeenCalledTimes(1)
    expect(result.current.state.draft).toEqual(completeDraft)
    expect(result.current.state.events.length).toBeGreaterThanOrEqual(2)
    expect(result.current.state.description).toBe('Streamed decision')
  })

  it('transitions to error state when streaming yields error event', async () => {
    const streamImpl = async function* () {
      yield { type: 'node', data: { id: 'n1', label: 'Node 1' } } as any
      yield { type: 'error', data: { message: 'Stream failed' } } as any
    }

    mockDraftGraphStream.mockImplementation(streamImpl as any)

    const { result } = renderHook(() => useDraftModel({ streaming: true }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Bad stream' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })

    expect(result.current.state.error).toMatch(/Stream failed/)
  })

  it('reset returns state to idle', async () => {
    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: '   ' } as any)
    })

    expect(result.current.state.status).toBe('error')

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual(createInitialState())
  })

  const enableTelemetry = () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {
      // ignore
    }
    __resetTelemetryCounters()
  }

  it('emits telemetry for sync draft success', async () => {
    enableTelemetry()

    const mockResponse = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'Decision A' }],
        edges: [],
      },
    } as any

    mockDraftGraph.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Test decision' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.request']).toBe(1)
    expect(counters['draft.success']).toBe(1)
    expect(counters['draft.error']).toBe(0)
    expect(counters['draft.stream.start']).toBe(0)
    expect(counters['draft.stream.done']).toBe(0)
  })

  it('emits telemetry for sync draft error', async () => {
    enableTelemetry()

    mockDraftGraph.mockRejectedValueOnce({
      code: 'SERVER_ERROR',
      message: 'Backend failed',
    })

    const { result } = renderHook(() => useDraftModel({ streaming: false }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Something' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.request']).toBe(1)
    expect(counters['draft.success']).toBe(0)
    expect(counters['draft.error']).toBe(1)
  })

  it('emits telemetry for streaming draft success', async () => {
    enableTelemetry()

    const completeDraft = {
      schema: 'draft.v1',
      graph: {
        nodes: [{ id: 'n1', label: 'Node 1' }],
        edges: [{ id: 'e1', from: 'n1', to: 'n1' }],
      },
    } as any

    const streamImpl = async function* () {
      yield { type: 'node', data: { id: 'n1', label: 'Node 1' } } as any
      yield { type: 'edge', data: { id: 'e1', from: 'n1', to: 'n1' } } as any
      yield { type: 'complete', data: completeDraft } as any
    }

    mockDraftGraphStream.mockImplementation(streamImpl as any)

    const { result } = renderHook(() => useDraftModel({ streaming: true }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Streamed decision' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('ready')
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.request']).toBe(1)
    expect(counters['draft.stream.start']).toBe(1)
    expect(counters['draft.stream.done']).toBe(1)
    expect(counters['draft.success']).toBe(1)
    expect(counters['draft.error']).toBe(0)
  })

  it('emits telemetry for streaming draft error event', async () => {
    enableTelemetry()

    const streamImpl = async function* () {
      yield { type: 'node', data: { id: 'n1', label: 'Node 1' } } as any
      yield { type: 'error', data: { message: 'Stream failed' } } as any
    }

    mockDraftGraphStream.mockImplementation(streamImpl as any)

    const { result } = renderHook(() => useDraftModel({ streaming: true }))

    await act(async () => {
      await result.current.requestDraft({ prompt: 'Bad stream' } as any)
    })

    await waitFor(() => {
      expect(result.current.state.status).toBe('error')
    })

    const counters = __getTelemetryCounters()
    expect(counters['draft.request']).toBe(1)
    expect(counters['draft.stream.start']).toBe(1)
    expect(counters['draft.success']).toBe(0)
    expect(counters['draft.stream.done']).toBe(0)
    expect(counters['draft.error']).toBe(1)
  })
})
