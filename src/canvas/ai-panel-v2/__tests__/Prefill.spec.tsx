import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// We exercise the REAL guidanceStore registration path: AIZone mounts the
// real ConversationPanel, which calls
// `useGuidanceStore.getState().registerConversationCallbacks(...)`, with
// the `prefillChat` prop AIZone passes pointing at the visible AIInputBar.
// We then invoke `useGuidanceStore.getState()._prefillChat(text)` exactly
// as inspector "Ask about this" / analysis hero prefill flows do.
//
// ConversationPanel pulls in several heavy hooks (useV2Run, useGraphReadiness,
// useThreadPersistence, the plot adapter, etc.) — stub them so the test
// can focus on the registration plumbing without booting the orchestrator.

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn(), isRunning: false }),
}))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: null }),
}))
vi.mock('../../conversation/hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }),
}))
vi.mock('../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

// useConversation drives ConversationPanel; minimal shape is enough.
vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => ({
      messages: [],
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
    }),
  }
})

// ChatThread + ChatComposer pull more dependencies than the prefill path
// needs; stub to empty markers.
vi.mock('../../conversation/zones/ChatThread', () => ({
  ChatThread: () => <div data-testid="stub-chat-thread" />,
}))
vi.mock('../../conversation/zones/ChatComposer', () => ({
  ChatComposer: () => null,
}))

import { AIZone } from '../AIZone'
import { useGuidanceStore } from '../../stores/guidanceStore'

afterEach(() => {
  cleanup()
  // Reset registered callbacks so each test starts clean.
  useGuidanceStore.setState({
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
    _prefillChat: null,
    _dispatchAction: null,
  })
})

describe('Prefill — guidanceStore._prefillChat populates the visible AIInputBar', () => {
  it('registers _prefillChat on mount and it writes to the textarea when called', async () => {
    render(<AIZone />)
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    // ConversationPanel's registration effect runs after mount; wait one
    // microtask so it's wired up.
    await act(async () => { await Promise.resolve() })

    const prefill = useGuidanceStore.getState()._prefillChat
    expect(typeof prefill).toBe('function')

    // Invoke the registered callback exactly like inspector "Ask about
    // this" does. The visible AIInputBar must reflect the new value.
    await act(async () => {
      prefill?.('Why does this matter?')
    })
    expect(textarea.value).toBe('Why does this matter?')
  })

  it('un-registers _prefillChat on unmount so stale refs do not silently no-op', async () => {
    const { unmount } = render(<AIZone />)
    await act(async () => { await Promise.resolve() })
    expect(useGuidanceStore.getState()._prefillChat).toBeTypeOf('function')

    unmount()
    expect(useGuidanceStore.getState()._prefillChat).toBeNull()
  })
})
