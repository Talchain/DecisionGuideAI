/**
 * Tests for sendSystemEvent in useConversation
 *
 * Verifies:
 * - sendSystemEvent sends turn request with '[system]' message and system_event populated
 * - sendSystemEvent does NOT append a user message bubble
 * - sendSystemEvent does append the assistant response
 * - sendSystemEvent is a no-op when flag is OFF
 * - Error handling: failed system event shows error in conversation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation, SYSTEM_MESSAGE_SENTINEL } from '../useConversation'
import { useCanvasStore } from '../../store'

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

let flagValue = true
vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => flagValue,
  isOrchestratorStreamingEnabled: () => false,
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  flagValue = true

  useCanvasStore.setState({
    currentScenarioId: 'test-scenario',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// sendSystemEvent
// ---------------------------------------------------------------------------

describe('sendSystemEvent', () => {
  it('sends turn request with "[system]" message and system_event', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'I see you edited the graph.',
      client_turn_id: 'resp-1',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n1'] },
      })
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const request = mockCallTurn.mock.calls[0][0]
    expect(request.message).toBe(SYSTEM_MESSAGE_SENTINEL)
    // V3 wire format: event_type instead of type, details instead of payload
    expect(request.system_event.event_type).toBe('direct_graph_edit')
    expect(request.system_event.details.changed_node_ids).toEqual(['n1'])
  })

  it('does NOT append a user message bubble', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Acknowledged.',
      client_turn_id: 'resp-2',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n2'] },
      })
    })

    // Only the assistant response should be in messages — no user bubble
    const userMessages = result.current.messages.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(0)
  })

  it('does append the assistant response', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Graph updated.',
      client_turn_id: 'resp-3',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n3'] },
      })
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].content).toBe('Graph updated.')
  })

  it('is a no-op when flag is OFF', async () => {
    flagValue = false

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n1'] },
      })
    })

    expect(mockCallTurn).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('fails silently on system event error (no error message shown)', async () => {
    mockCallTurn.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: {},
      })
    })

    // System events fail silently — no error message added to conversation
    // because the user didn't initiate these and showing errors would be confusing
    expect(result.current.messages).toHaveLength(0)
  })

  it('does not set lastFailedInput on system event failure', async () => {
    mockCallTurn.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_analysis_run',
        payload: { trigger: 'play_button' },
      })
    })

    // System events should NOT restore input
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('processes blocks and stage_indicator from envelope', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Analysis complete.',
      blocks: [{ type: 'fact', label: 'Winner', value: 'Option A' }],
      suggested_actions: [{ id: 'explore', label: 'Explore', intent: 'primary', message: 'explore options' }],
      stage_indicator: 'evaluate',
      client_turn_id: 'resp-4',
    })

    const setCurrentStage = vi.fn()
    useCanvasStore.setState({ setCurrentStage } as any)

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_analysis_run',
        payload: { trigger: 'play_button' },
      })
    })

    const msg = result.current.messages[0]
    expect(msg.blocks).toHaveLength(1)
    expect(msg.blocks![0].type).toBe('fact')
    expect(msg.actionChips).toHaveLength(1)
    expect(setCurrentStage).toHaveBeenCalledWith('evaluate')
  })

  it('request includes client_turn_id at root level', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Acknowledged.',
      client_turn_id: 'resp-corr',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n1'] },
      })
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const request = mockCallTurn.mock.calls[0][0]
    expect(request.client_turn_id).toBeTruthy()
  })

  it('always sends v3 wire format (event_type, timestamp, event_id, details)', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Acknowledged.',
      client_turn_id: 'resp-v3',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: { changed_node_ids: ['n1'] },
      })
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const request = mockCallTurn.mock.calls[0][0]
    // Wire format fields
    expect(request.system_event.event_type).toBe('direct_graph_edit')
    expect(request.system_event.details).toEqual({ changed_node_ids: ['n1'] })
    expect(typeof request.system_event.timestamp).toBe('string')
    expect(typeof request.system_event.event_id).toBe('string')
    // Must NOT have old internal shape fields
    expect(request.system_event.type).toBeUndefined()
    expect(request.system_event.payload).toBeUndefined()
  })

  it('drops unsupported event types entirely (no network turn)', async () => {
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok' })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({ type: 'session_resume', payload: {} })
    })

    // Pre-filter drops session_resume before sendTurn — no network call
    expect(mockCallTurn).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('sends full graph_state (nodes + edges arrays)', async () => {
    mockCallTurn.mockResolvedValue({ assistant_text: 'ok' })
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A', kind: 'decision' } }] as any,
      edges: [],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({ type: 'direct_analysis_run' })
    })

    const request = mockCallTurn.mock.calls[0][0]
    expect(Array.isArray(request.graph_state.nodes)).toBe(true)
    expect(Array.isArray(request.graph_state.edges)).toBe(true)
    expect(request.graph_state.nodes).toHaveLength(1)
  })
})
