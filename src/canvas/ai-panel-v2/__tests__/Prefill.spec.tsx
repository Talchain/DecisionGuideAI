import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Exercises the cross-surface registration AIZone owns under FF on:
//   • _prefillChat — inspector "Ask about this" + analysis hero prefill
//   • _sendMessage — context-menu "Ask AI", inspector send actions
//
// Both must work end-to-end in BOTH zone states:
//   • welcome  (no messages yet — ConversationPanel not mounted; AIZone
//               registers directly so external flows still work)
//   • standard (≥1 message — ConversationPanel handles registration via
//               its `prefillChat` prop pointing at the visible AIInputBar)
//
// The conversation instance is supplied by AIPanelV2Layout in
// production; the test builds a fake conversation directly so we can
// trigger the welcome→standard transition by mutating its messages.

// Stub heavy peripheral hooks/components so the test boots without the
// full orchestrator. ConversationPanel + its registration effect still
// run.
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
vi.mock('../../conversation/zones/ChatThread', () => ({
  ChatThread: () => <div data-testid="stub-chat-thread" />,
}))
vi.mock('../../conversation/zones/ChatComposer', () => ({
  ChatComposer: () => null,
}))

import { AIZone } from '../AIZone'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../../conversation/useConversation'
import type { ConversationMessage } from '../../conversation/types'

function makeConversation(overrides: Partial<UseConversationReturn> = {}): UseConversationReturn {
  return {
    messages: [],
    isThinking: false,
    longRunningHint: null,
    lastFailedInput: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined),
    sendChip: vi.fn().mockResolvedValue(undefined),
    dispatchAction: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    cancelTurn: vi.fn(),
    patchBlockStates: new Map<string, PatchBlockState>(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map<string, PatchRejectionInfo>(),
    setPatchRejection: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
    _prefillChat: null,
    _dispatchAction: null,
  })
})

describe('AIZone — welcome state cross-surface registration (P0.2)', () => {
  it('registers _prefillChat in welcome state and it writes to the visible AIInputBar', async () => {
    const conversation = makeConversation()
    render(<AIZone conversation={conversation} />)
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    await act(async () => { await Promise.resolve() })

    const prefill = useGuidanceStore.getState()._prefillChat
    expect(typeof prefill).toBe('function')
    await act(async () => { prefill?.('Why does this matter?') })
    expect(textarea.value).toBe('Why does this matter?')
  })

  it('registers _sendMessage in welcome state so context-menu Ask AI works before the first message', async () => {
    const conversation = makeConversation()
    render(<AIZone conversation={conversation} />)
    await act(async () => { await Promise.resolve() })

    const send = useGuidanceStore.getState()._sendMessage
    expect(typeof send).toBe('function')

    // Simulate context-menu Ask AI: invoke the registered callback.
    await act(async () => { send?.('Tell me about this node') })
    expect(conversation.sendMessage).toHaveBeenCalledWith(
      'Tell me about this node',
      expect.objectContaining({ debugSource: 'ai_panel_v2_welcome_external' }),
    )
  })

  it('un-registers both callbacks on unmount so stale refs do not silently no-op', async () => {
    const { unmount } = render(<AIZone conversation={makeConversation()} />)
    await act(async () => { await Promise.resolve() })
    expect(useGuidanceStore.getState()._prefillChat).toBeTypeOf('function')
    expect(useGuidanceStore.getState()._sendMessage).toBeTypeOf('function')

    unmount()
    expect(useGuidanceStore.getState()._prefillChat).toBeNull()
    expect(useGuidanceStore.getState()._sendMessage).toBeNull()
  })
})

describe('AIZone — standard state registers via ConversationPanel', () => {
  it('renders the standard variant when messages.length ≥ 1 and ConversationPanel registers _prefillChat', async () => {
    const conversation = makeConversation({
      messages: [
        // Minimal valid ConversationMessage so the welcome state
        // transitions to standard. ChatThread + ChatComposer are
        // mocked, so this stub only needs the required fields.
        {
          id: 'm1',
          role: 'user',
          content: 'Hi',
          timestamp: new Date(),
        } satisfies ConversationMessage,
      ],
    })
    render(<AIZone conversation={conversation} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('ai-panel-v2-zone').getAttribute('data-state')).toBe('standard')
    // Standard variant: AIZone's prefill bridge still ensures the input
    // bar receives prefill text. (ConversationPanel's effect overwrites
    // this with the same callback once mounted.)
    expect(useGuidanceStore.getState()._prefillChat).toBeTypeOf('function')
  })
})
