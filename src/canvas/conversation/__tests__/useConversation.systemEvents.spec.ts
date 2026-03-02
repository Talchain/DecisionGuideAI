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
    expect(request.system_event.type).toBe('direct_graph_edit')
    expect(request.system_event.payload.changed_node_ids).toEqual(['n1'])
  })

  it('does NOT append a user message bubble', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Acknowledged.',
      client_turn_id: 'resp-2',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'session_resume',
        payload: {},
      })
    })

    // Only the assistant response should be in messages
    const userMessages = result.current.messages.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(0)
  })

  it('does append the assistant response', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Welcome back!',
      client_turn_id: 'resp-3',
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'session_resume',
        payload: {},
      })
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('assistant')
    expect(result.current.messages[0].content).toBe('Welcome back!')
  })

  it('is a no-op when flag is OFF', async () => {
    flagValue = false

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'session_resume',
        payload: {},
      })
    })

    expect(mockCallTurn).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('shows error in conversation on failure (without retry chip)', async () => {
    mockCallTurn.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendSystemEvent({
        type: 'direct_graph_edit',
        payload: {},
      })
    })

    // Should show an error message
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.synthetic).toBe(true)
    expect(lastMsg.content).toMatch(/Something went wrong/)
    // System events don't get a retry chip (no user input to restore)
    expect(lastMsg.actionChips).toBeUndefined()
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
      suggested_actions: [{ id: 'explore', label: 'Explore', intent: 'primary' }],
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

  it('includes client_turn_id in system_event.payload for correlation', async () => {
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

    // client_turn_id in request root should match the one embedded in system_event.payload
    expect(request.client_turn_id).toBeTruthy()
    expect(request.system_event.payload.client_turn_id).toBe(request.client_turn_id)
  })
})
