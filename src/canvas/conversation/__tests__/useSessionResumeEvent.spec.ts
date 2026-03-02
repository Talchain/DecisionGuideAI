/**
 * Tests for useSessionResumeEvent — session resume system event
 *
 * Verifies:
 * - Resume fires on scenario load when graph exists
 * - Resume does NOT fire on empty scenario (no graph)
 * - Resume is deduplicated — second load of same scenario does not send another
 * - Resume flag resets on scenario switch
 * - Resume no-op when flag is OFF
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionResumeEvent } from '../useSessionResumeEvent'
import { useCanvasStore } from '../../store'
import type { ConversationMessage } from '../types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let flagValue = true
vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => flagValue,
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockSendSystemEvent = vi.fn().mockResolvedValue(undefined)

function setStoreState(overrides: Record<string, unknown>) {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...overrides,
  })
}

beforeEach(() => {
  mockSendSystemEvent.mockClear()
  flagValue = true
})

afterEach(() => {
  // Reset store
  setStoreState({ currentScenarioId: null, nodes: [] })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSessionResumeEvent', () => {
  it('fires resume on scenario load when graph exists', () => {
    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: {} }],
    })

    const messages: ConversationMessage[] = []
    renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    expect(mockSendSystemEvent).toHaveBeenCalledWith({
      type: 'session_resume',
      payload: {},
    })
  })

  it('does NOT fire on empty scenario (no graph)', () => {
    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [],
    })

    const messages: ConversationMessage[] = []
    renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('is deduplicated — second render of same scenario does not send another', () => {
    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: {} }],
    })

    const messages: ConversationMessage[] = []
    const { rerender } = renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)

    // Rerender (simulating page refresh within same scenario)
    rerender()

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1) // still 1, not 2
  })

  it('resets on scenario switch — new scenario gets its own resume', () => {
    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: {} }],
    })

    const messages: ConversationMessage[] = []
    const { rerender } = renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)

    // Switch to a different scenario with a graph
    act(() => {
      useCanvasStore.setState({
        currentScenarioId: 'scenario-2',
        nodes: [{ id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: {} }],
      } as any)
    })

    rerender()

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(2) // 1 for each scenario
    expect(mockSendSystemEvent.mock.calls[1][0]).toEqual({
      type: 'session_resume',
      payload: {},
    })
  })

  it('is a no-op when flag is OFF', () => {
    flagValue = false

    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: {} }],
    })

    const messages: ConversationMessage[] = []
    renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('skips resume if conversation already has a single assistant message', () => {
    setStoreState({
      currentScenarioId: 'scenario-1',
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: {} }],
    })

    // Simulate existing resume response
    const messages: ConversationMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Welcome back!',
        timestamp: new Date(),
      },
    ]
    renderHook(() => useSessionResumeEvent(mockSendSystemEvent, messages))

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })
})
