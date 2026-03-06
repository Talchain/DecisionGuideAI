/**
 * Hook-level tests for useConversation
 *
 * Tests timeout progression (10s/20s/30s), input restore on error,
 * and lastFailedInput cleanup on clearHistory/scenario switch.
 *
 * Uses vi.useFakeTimers() + renderHook from @testing-library/react.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock turnService — callOrchestratorTurn returns a controllable promise
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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockCallTurn.mockReset()

  // Minimal store state the hook reads
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
// Timeout progression
// ---------------------------------------------------------------------------

describe('timeout progression (10s / 20s / 30s)', () => {
  it('shows no hint before 10s', async () => {
    // Make the call hang forever (never resolve)
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    expect(result.current.isThinking).toBe(true)
    expect(result.current.longRunningHint).toBeNull()
  })

  it('shows "Running analysis\u2026" at 10s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(result.current.longRunningHint).toBe('Running analysis\u2026')
  })

  it('shows "Still working\u2026" at 20s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(result.current.longRunningHint).toBe('Still working\u2026')
  })

  it('aborts and shows error at 30s', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('test message')
    })

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(result.current.isThinking).toBe(false)
    expect(result.current.longRunningHint).toBeNull()
    // Last message should be a synthetic timeout error
    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.synthetic).toBe(true)
    expect(last.content).toMatch(/taking longer than expected/)
  })
})

// ---------------------------------------------------------------------------
// Input restore on error
// ---------------------------------------------------------------------------

describe('input restore on error (lastFailedInput)', () => {
  it('sets lastFailedInput on network error', async () => {
    mockCallTurn.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('my important question')
    })

    expect(result.current.lastFailedInput).toBe('my important question')
  })

  it('sets lastFailedInput on timeout', async () => {
    mockCallTurn.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      result.current.sendMessage('timeout question')
    })

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(result.current.lastFailedInput).toBe('timeout question')
  })

  it('clears lastFailedInput on next successful send', async () => {
    // First call fails
    mockCallTurn.mockRejectedValueOnce(new Error('fail'))
    // Second call succeeds
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'OK',
      client_turn_id: 'resp-1',
    })

    const { result } = renderHook(() => useConversation())

    // First send — fails
    await act(async () => {
      await result.current.sendMessage('first attempt')
    })
    expect(result.current.lastFailedInput).toBe('first attempt')

    // Second send — succeeds
    await act(async () => {
      await result.current.sendMessage('second attempt')
    })
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('clears lastFailedInput on clearHistory', async () => {
    mockCallTurn.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('failing message')
    })
    expect(result.current.lastFailedInput).toBe('failing message')

    act(() => {
      result.current.clearHistory()
    })
    expect(result.current.lastFailedInput).toBeNull()
  })

  it('clears lastFailedInput on scenario switch', async () => {
    mockCallTurn.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('failing message')
    })
    expect(result.current.lastFailedInput).toBe('failing message')

    // Simulate scenario switch
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'new-scenario' })
    })

    expect(result.current.lastFailedInput).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Envelope stamping: graph_hash_at_proposal
// ---------------------------------------------------------------------------

describe('graph_hash_at_proposal stamping', () => {
  it('stamps graph_hash_at_proposal on graph_patch blocks in envelope', async () => {
    // Set up a graph so generateGraphHash produces a deterministic hash
    useCanvasStore.setState({
      currentScenarioId: 'test-scenario',
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      edges: [] as any,
      results: { status: 'idle' } as any,
      currentScenarioLastResultHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    })

    // Mock envelope with a graph_patch block (no graph_hash_at_proposal initially)
    mockCallTurn.mockResolvedValueOnce({
      assistant_text: 'Here is a patch.',
      client_turn_id: 'resp-patch',
      blocks: [
        {
          type: 'graph_patch',
          patch_id: 'p-stamp-test',
          summary: 'Add a node',
          operations: [{ op: 'add_node', target_id: 'n2', data: {} }],
          target_graph_hash: 'cee-hash',
        },
      ],
    })

    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('stamp test')
    })

    // Find the assistant message with the patch block
    const assistantMsg = result.current.messages.find(
      (m) => m.role === 'assistant' && m.blocks?.some((b) => b.type === 'graph_patch'),
    )
    expect(assistantMsg).toBeDefined()

    const patchBlock = assistantMsg!.blocks!.find((b) => b.type === 'graph_patch') as any
    expect(patchBlock.graph_hash_at_proposal).toBeDefined()
    expect(typeof patchBlock.graph_hash_at_proposal).toBe('string')
    expect(patchBlock.graph_hash_at_proposal.length).toBeGreaterThan(0)
  })
})
