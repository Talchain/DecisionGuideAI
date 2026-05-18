import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelView } from '../hooks/usePanelView'
import type { UseConversationReturn } from '../../conversation/useConversation'

// Builds a deterministic canvas-store mock by overriding the selector
// reader directly. `useCanvasStore(selector)` is called with arrow
// selectors in usePanelView; we satisfy each call by returning a value
// from a state-like object.
const canvasState = {
  nodes: [] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}

vi.mock('../../store', () => ({
  useCanvasStore: (selector: (state: typeof canvasState) => unknown) => selector(canvasState),
}))

function makeConversation(messageCount = 0): UseConversationReturn {
  return {
    messages: Array.from({ length: messageCount }, (_, i) => ({
      id: `m${i}`,
      role: 'user' as const,
      content: 'hi',
      timestamp: 0,
    })),
    isThinking: false,
    longRunningHint: null,
    lastFailedInput: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    dispatchAction: vi.fn(),
    clearHistory: vi.fn(),
    retryLast: vi.fn(),
    cancelTurn: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }
}

beforeEach(() => {
  canvasState.nodes = []
  canvasState.edges = []
  canvasState.results = { status: 'idle', hash: null }
})

describe('usePanelView — state-led derivation', () => {
  it('returns welcome when no messages AND no canvas nodes', () => {
    const { result } = renderHook(() => usePanelView({ conversation: makeConversation(0) }))
    expect(result.current.state).toBe('welcome')
    expect(result.current.view.kind).toBe('welcome')
  })

  it('returns pre-analysis when nodes exist but no analysis result', () => {
    canvasState.nodes = [{ id: 'n1' }]
    const { result } = renderHook(() => usePanelView({ conversation: makeConversation(1) }))
    expect(result.current.state).toBe('pre-analysis')
    expect(result.current.view).toEqual({ kind: 'docked', state: 'pre-analysis' })
  })

  it('returns post-analysis when results.status is complete + hash is set', () => {
    canvasState.nodes = [{ id: 'n1' }]
    canvasState.results = { status: 'complete', hash: 'abc' }
    const { result } = renderHook(() => usePanelView({ conversation: makeConversation(1) }))
    expect(result.current.state).toBe('post-analysis')
    expect(result.current.view).toEqual({ kind: 'docked', state: 'post-analysis' })
  })

  it('returns post-analysis even when messages are empty (user could clear chat mid-flow)', () => {
    canvasState.nodes = [{ id: 'n1' }]
    canvasState.results = { status: 'complete', hash: 'abc' }
    const { result } = renderHook(() => usePanelView({ conversation: makeConversation(0) }))
    expect(result.current.state).toBe('post-analysis')
  })

  it('escalates display state to minimised + floating, falling back to docked on welcome', () => {
    canvasState.nodes = [{ id: 'n1' }]
    const { result } = renderHook(() => usePanelView({ conversation: makeConversation(1) }))
    act(() => result.current.setDisplay('minimised'))
    expect(result.current.view).toEqual({ kind: 'minimised', previousState: 'pre-analysis' })
    act(() => result.current.setDisplay('floating'))
    expect(result.current.view).toEqual({ kind: 'floating', previousState: 'pre-analysis' })
    act(() => result.current.setDisplay('docked'))
    expect(result.current.view).toEqual({ kind: 'docked', state: 'pre-analysis' })
  })

  it('minimised/floating displays collapse back to welcome when state regresses', () => {
    canvasState.nodes = [{ id: 'n1' }]
    const { result, rerender } = renderHook(({ conv }) => usePanelView({ conversation: conv }), {
      initialProps: { conv: makeConversation(1) },
    })
    act(() => result.current.setDisplay('minimised'))
    expect(result.current.view.kind).toBe('minimised')
    // Regress: clear messages AND nodes — state should drop to welcome
    // and the view kind should follow regardless of the display flag.
    canvasState.nodes = []
    rerender({ conv: makeConversation(0) })
    expect(result.current.view.kind).toBe('welcome')
  })
})
