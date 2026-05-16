import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Stub ConversationPanel so the test boots without the full conversation
// pipeline. We call the prefill callback directly via the prop so the
// guidanceStore wiring stays exercised end-to-end at the prop boundary.
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: ({ prefillChat }: { prefillChat?: (text: string) => void }) => (
    <button
      type="button"
      data-testid="fake-prefill-trigger"
      onClick={() => prefillChat?.('Why is this fragile?')}
    >
      trigger
    </button>
  ),
}))

// Stub useConversation so AIZone mounts without the orchestrator.
vi.mock('../../conversation/useConversation', () => ({
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
}))

import { AIZone } from '../AIZone'

afterEach(() => cleanup())

describe('Prefill — inspector / hero prefill populates the visible AIInputBar', () => {
  it('prefillChat callback writes text into the AIInputBar textarea', async () => {
    render(<AIZone />)
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    // External flows call guidanceStore._prefillChat, which AIZone
    // registers via ConversationPanel.prefillChat. Our stubbed
    // ConversationPanel forwards the prop call directly so we observe
    // the effect on the visible textarea.
    await act(async () => {
      screen.getByTestId('fake-prefill-trigger').click()
    })
    expect(textarea.value).toBe('Why is this fragile?')
  })
})
