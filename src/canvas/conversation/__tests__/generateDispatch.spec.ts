/**
 * Integration tests for Generate model dispatch chain.
 *
 * Verifies:
 * - sendMessage dispatches exactly one user turn for the brief
 * - Double-click suppression via inFlightRef prevents duplicate requests
 * - isThinking transitions correctly during the request lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
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

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const EMPTY_ENVELOPE = {
  assistant_text: 'Model generated.',
  blocks: [],
  suggested_actions: [],
}

beforeEach(() => {
  // Pin V5-orchestrator flag OFF — same root cause as PR #460 and the three
  // named specs in this sweep. This spec mocks the legacy V4 turn path
  // (`callOrchestratorTurn`) but does NOT mock V5; with the fresh-clone
  // `.env.local` setting VITE_ENABLE_V5_ORCHESTRATOR=true, sendTurn routes every
  // turn to the unmocked V5 path (`callV5Turn`) → real fetch throws → the V4
  // spy never fires. Pinning the flag makes the intended V4 path deterministic;
  // afterEach restores via unstubAllEnvs so nothing leaks to siblings.
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'false')
  vi.useFakeTimers()
  mockCallTurn.mockReset()

  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Generate model dispatch
// ---------------------------------------------------------------------------

describe('generate model dispatch', () => {
  it('sendMessage dispatches exactly one user turn with the brief text', async () => {
    mockCallTurn.mockResolvedValue(EMPTY_ENVELOPE)
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('I want to decide between A and B')
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    const request = mockCallTurn.mock.calls[0][0]
    expect(request.message).toBe('I want to decide between A and B')
    // Should NOT have system_event attached (this is a user message, not a system event)
    expect(request.system_event).toBeUndefined()
  })

  it('sets isThinking during the request lifecycle', async () => {
    let resolveCall: (value: typeof EMPTY_ENVELOPE) => void
    mockCallTurn.mockReturnValue(
      new Promise<typeof EMPTY_ENVELOPE>((resolve) => { resolveCall = resolve }),
    )
    const { result } = renderHook(() => useConversation())

    expect(result.current.isThinking).toBe(false)

    // Start send (don't await — we want to observe mid-flight state)
    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('brief text')
    })

    expect(result.current.isThinking).toBe(true)

    // Resolve the request
    await act(async () => {
      resolveCall!(EMPTY_ENVELOPE)
      await sendPromise!
    })

    expect(result.current.isThinking).toBe(false)
  })

  it('double-click suppression: second sendMessage is rejected while first is in-flight', async () => {
    let resolveCall: (value: typeof EMPTY_ENVELOPE) => void
    mockCallTurn.mockReturnValue(
      new Promise<typeof EMPTY_ENVELOPE>((resolve) => { resolveCall = resolve }),
    )
    const { result } = renderHook(() => useConversation())

    // First send
    let firstPromise: Promise<void>
    act(() => {
      firstPromise = result.current.sendMessage('first brief')
    })

    // Second send (should be suppressed by inFlightRef)
    act(() => {
      void result.current.sendMessage('second brief')
    })

    // Resolve first request
    await act(async () => {
      resolveCall!(EMPTY_ENVELOPE)
      await firstPromise!
    })

    // Only one network call should have been made
    expect(mockCallTurn).toHaveBeenCalledTimes(1)
    expect(mockCallTurn.mock.calls[0][0].message).toBe('first brief')

    // Only one user message bubble should exist (not two)
    const userMessages = result.current.messages.filter(m => m.role === 'user')
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].content).toBe('first brief')
  })

  it('allows a new send after the first completes', async () => {
    mockCallTurn.mockResolvedValue(EMPTY_ENVELOPE)
    const { result } = renderHook(() => useConversation())

    // First send
    await act(async () => {
      await result.current.sendMessage('first brief')
    })

    // Second send (should succeed after first completes)
    await act(async () => {
      await result.current.sendMessage('second brief')
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(2)
    expect(mockCallTurn.mock.calls[0][0].message).toBe('first brief')
    expect(mockCallTurn.mock.calls[1][0].message).toBe('second brief')
  })

  it('releases in-flight lock on error so subsequent sends work', async () => {
    mockCallTurn.mockRejectedValueOnce(new Error('Network error'))
    mockCallTurn.mockResolvedValueOnce(EMPTY_ENVELOPE)
    const { result } = renderHook(() => useConversation())

    // First send (will fail)
    await act(async () => {
      await result.current.sendMessage('will fail')
    })

    expect(result.current.isThinking).toBe(false)

    // Second send (should succeed)
    await act(async () => {
      await result.current.sendMessage('will succeed')
    })

    expect(mockCallTurn).toHaveBeenCalledTimes(2)
  })
})
