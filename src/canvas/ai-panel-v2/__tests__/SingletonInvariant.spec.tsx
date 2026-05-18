import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'

// Verifies the Batch 2 singleton invariant: AIPanelV2Layout calls
// useConversation() EXACTLY ONCE per render across every view (welcome,
// docked, minimised, floating). The embedded OutputsDock should NOT
// call useConversation — its host wrapper branches on the `embedded`
// prop and forwards the layout-owned sendMessage instead.

const { useConversationSpy } = vi.hoisted(() => ({ useConversationSpy: vi.fn() }))

const canvasState = {
  nodes: [] as unknown[],
  edges: [] as unknown[],
  results: { status: 'idle' as 'idle' | 'running' | 'complete' | 'error', hash: null as string | null },
}
const conversationMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }[] = []

vi.mock('../../store', async () => {
  const actual = await vi.importActual<typeof import('../../store')>('../../store')
  return {
    ...actual,
    useCanvasStore: ((selector?: (s: typeof canvasState) => unknown) => {
      if (typeof selector === 'function') return selector(canvasState)
      return canvasState
    }) as unknown,
  }
})

vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => {
      useConversationSpy()
      return {
        messages: [...conversationMessages],
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage: vi.fn(),
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
    },
  }
})

// Stub heavy children so the layout boots without orchestrator / router.
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: () => <div data-testid="stub-outputs-dock" />,
}))
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => <div data-testid="stub-conversation-panel" />,
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

beforeEach(() => {
  canvasState.nodes = []
  canvasState.edges = []
  canvasState.results = { status: 'idle', hash: null }
  conversationMessages.length = 0
  useConversationSpy.mockReset()
})

afterEach(() => cleanup())

describe('Singleton invariant — useConversation called exactly once across every view', () => {
  it('welcome view: 1 call', () => {
    render(<AIPanelV2Layout />)
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
  })

  it('docked (pre-analysis): 1 call', () => {
    canvasState.nodes = [{ id: 'n1' }]
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
  })

  it('docked (post-analysis): 1 call', () => {
    canvasState.nodes = [{ id: 'n1' }]
    canvasState.results = { status: 'complete', hash: 'abc' }
    conversationMessages.push({ id: 'm1', role: 'user', content: 'hi', timestamp: 0 })
    render(<AIPanelV2Layout />)
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
  })
})
