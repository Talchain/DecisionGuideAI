/**
 * Tests for analysis_inputs inclusion in OrchestratorTurnRequest
 *
 * Verifies:
 * - When ceeAnalysisReady has options + truthy goal_node_id, turn request includes
 *   analysis_inputs with options[] (id + option_id + label + interventions) and goal_node_id
 * - When ceeAnalysisReady is null, turn request omits analysis_inputs
 * - When ceeAnalysisReady has an empty options array, turn request omits analysis_inputs
 * - When options exist but goal_node_id is falsy, turn request omits analysis_inputs
 *   (partial context is worse than none)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
// Test data
// ---------------------------------------------------------------------------

const mockCeeAnalysisReady: CEEAnalysisReady = {
  goal_node_id: 'node-goal-1',
  options: [
    {
      id: 'option-a',
      label: 'Option A',
      status: 'ready',
      interventions: {
        'node-1': { value: 0.8, source: 'cee_hypothesis' },
        'node-2': { value: 0.5, source: 'user_specified' },
      },
    },
    {
      id: 'option-b',
      label: 'Option B',
      status: 'ready',
      interventions: {
        'node-1': { value: 0.3, source: 'brief_extraction' },
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()

  useCanvasStore.setState({
    currentScenarioId: 'test-scenario',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ceeAnalysisReady: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analysis_inputs in turn request', () => {
  it('includes analysis_inputs when ceeAnalysisReady has options', async () => {
    useCanvasStore.setState({ ceeAnalysisReady: mockCeeAnalysisReady })

    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run the analysis')
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const [request] = mockCallTurn.mock.calls[0] as [any]

    expect(request.analysis_inputs).toBeDefined()
    expect(request.analysis_inputs.goal_node_id).toBe('node-goal-1')
    expect(request.analysis_inputs.options).toHaveLength(2)
  })

  it('maps both id and option_id on each option', async () => {
    useCanvasStore.setState({ ceeAnalysisReady: mockCeeAnalysisReady })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('analyse')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    const opts = request.analysis_inputs.options

    expect(opts[0].id).toBe('option-a')
    expect(opts[0].option_id).toBe('option-a')
    expect(opts[0].label).toBe('Option A')
    expect(opts[0].interventions).toEqual(mockCeeAnalysisReady.options[0].interventions)

    expect(opts[1].id).toBe('option-b')
    expect(opts[1].option_id).toBe('option-b')
    expect(opts[1].label).toBe('Option B')
  })

  it('omits analysis_inputs when ceeAnalysisReady is null', async () => {
    useCanvasStore.setState({ ceeAnalysisReady: null })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('what should I do?')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeUndefined()
  })

  it('omits analysis_inputs when ceeAnalysisReady has empty options array', async () => {
    useCanvasStore.setState({
      ceeAnalysisReady: {
        goal_node_id: 'node-goal-1',
        options: [],
      } as CEEAnalysisReady,
    })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('anything')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeUndefined()
  })

  it('uses ceeAnalysisReady.goal_node_id as primary goal source', async () => {
    useCanvasStore.setState({ ceeAnalysisReady: mockCeeAnalysisReady })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('go')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs.goal_node_id).toBe('node-goal-1')
  })

  it('omits analysis_inputs when options are present but goal_node_id is falsy (empty string)', async () => {
    // Partial context is worse than none: valid options + empty goal → omit entirely
    useCanvasStore.setState({
      ceeAnalysisReady: {
        goal_node_id: '',
        options: mockCeeAnalysisReady.options,
      } as CEEAnalysisReady,
    })
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok', client_turn_id: 'r1' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run it')
    })

    const [request] = mockCallTurn.mock.calls[0] as [any]
    expect(request.analysis_inputs).toBeUndefined()
  })
})
