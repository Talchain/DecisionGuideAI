/**
 * MessageBubble streaming rendering tests
 *
 * Verifies: streaming cursor, provisional opacity, tool loading state,
 * empty streaming state (thinking dots), and finalised appearance.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the CSS module
vi.mock('../Conversation.module.css', () => ({
  default: {
    messageBubbleUser: 'messageBubbleUser',
    messageBubbleAssistant: 'messageBubbleAssistant',
    markdownContent: 'markdownContent',
    markdownContentClamped: 'markdownContentClamped',
    showMoreTextToggle: 'showMoreTextToggle',
    provisionalText: 'provisionalText',
    streamingThinking: 'streamingThinking',
    streamingDot: 'streamingDot',
    toolLoadingState: 'toolLoadingState',
    toolLoadingDot: 'toolLoadingDot',
  },
}))

// Mock dependencies
vi.mock('../../styles/typography', () => ({
  typography: { bodySmall: 'bodySmall', panelMeta: 'panelMeta', caption: 'caption', body: 'body' },
}))

vi.mock('../utils/markdown', () => ({
  sanitizeMarkdown: (s: string) => s, // passthrough for testing
}))

vi.mock('./InlineBlocks', () => ({
  InlineBlocks: () => null,
}))

vi.mock('./ActionChipRow', () => ({
  ActionChipRow: () => null,
}))

vi.mock('./FeedbackRow', () => ({
  FeedbackRow: () => null,
}))

vi.mock('./useConversation', () => ({
  SYSTEM_MESSAGE_SENTINEL: '[system]',
}))

import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    ...overrides,
  }
}

const noop = async () => {}

describe('MessageBubble — streaming', () => {
  it('shows thinking dots when streaming with empty content', () => {
    render(<MessageBubble message={makeMsg({ isStreaming: true, content: '' })} onChipClick={noop} />)
    expect(screen.getByTestId('streaming-thinking')).toBeTruthy()
  })

  it('shows streaming cursor when streaming with content', () => {
    render(<MessageBubble message={makeMsg({ isStreaming: true, content: 'Hello world' })} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.innerHTML).toContain('streaming-cursor')
    expect(bubble.innerHTML).toContain('Hello world')
  })

  it('does not show cursor when not streaming', () => {
    render(<MessageBubble message={makeMsg({ isStreaming: false, content: 'Hello world' })} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.innerHTML).not.toContain('streaming-cursor')
  })

  it('applies provisional opacity class when isProvisional is true', () => {
    render(<MessageBubble message={makeMsg({ isProvisional: true, content: 'Draft text' })} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    const contentDiv = bubble.querySelector('[class*="provisionalText"]')
    expect(contentDiv).toBeTruthy()
  })

  it('does not apply provisional class when isProvisional is false', () => {
    render(<MessageBubble message={makeMsg({ isProvisional: false, content: 'Final text' })} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    const contentDiv = bubble.querySelector('[class*="provisionalText"]')
    expect(contentDiv).toBeFalsy()
  })

  it('shows tool loading state', () => {
    render(
      <MessageBubble
        message={makeMsg({ isStreaming: true, content: 'Thinking...', toolLoadingState: 'Running simulations\u2026' })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('tool-loading-state')).toBeTruthy()
    expect(screen.getByTestId('tool-loading-state').textContent).toContain('Running simulations')
  })

  it('does not show tool loading when toolLoadingState is null', () => {
    render(
      <MessageBubble
        message={makeMsg({ isStreaming: true, content: 'Hello', toolLoadingState: null })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('tool-loading-state')).toBeNull()
  })

  it('does not clamp text during streaming (even if > threshold)', () => {
    const longText = 'A'.repeat(500)
    render(<MessageBubble message={makeMsg({ isStreaming: true, content: longText })} onChipClick={noop} />)
    expect(screen.queryByTestId('message-show-more')).toBeNull()
  })

  it('final message looks identical to non-streaming (no streaming artifacts)', () => {
    const msg = makeMsg({
      isStreaming: false,
      isProvisional: false,
      toolLoadingState: null,
      content: 'Final response text',
    })
    render(<MessageBubble message={msg} onChipClick={noop} />)
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.innerHTML).not.toContain('streaming-cursor')
    expect(bubble.innerHTML).not.toContain('streaming-thinking')
    expect(bubble.querySelector('[class*="provisionalText"]')).toBeFalsy()
    expect(screen.queryByTestId('tool-loading-state')).toBeNull()
  })

  it('renders blocks during streaming', () => {
    // Blocks are rendered by InlineBlocks (mocked) — just verify no crash
    const msg = makeMsg({
      isStreaming: true,
      content: 'Text so far',
      blocks: [{ type: 'commentary', text: 'insight' } as any],
    })
    render(<MessageBubble message={msg} onChipClick={noop} />)
    expect(screen.getByTestId('message-assistant')).toBeTruthy()
  })
})

// ============================================================================
// T6 — stoppedByUser indicator (Stop button persistence)
// ============================================================================

describe('MessageBubble — stoppedByUser indicator (T6)', () => {
  it('renders "Response stopped." when stoppedByUser is true', () => {
    render(
      <MessageBubble
        message={makeMsg({ stoppedByUser: true, content: 'Partial text', isStreaming: false })}
        onChipClick={noop}
      />,
    )
    const indicator = screen.getByTestId('response-stopped-indicator')
    expect(indicator).toBeTruthy()
    expect(indicator.textContent).toBe('Response stopped.')
  })

  it('does NOT render the indicator on a normal completed message', () => {
    render(
      <MessageBubble
        message={makeMsg({ stoppedByUser: false, content: 'Hello', isStreaming: false })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('response-stopped-indicator')).toBeNull()
  })

  it('preserves prior partial content alongside the indicator', () => {
    render(
      <MessageBubble
        message={makeMsg({
          stoppedByUser: true,
          isStreaming: false,
          content: 'I was about to say something important',
        })}
        onChipClick={noop}
      />,
    )
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.innerHTML).toContain('I was about to say something important')
    expect(screen.getByTestId('response-stopped-indicator')).toBeTruthy()
  })

  it('late chunks (simulated by re-render with extra fields) do NOT clear stoppedByUser', () => {
    // Simulates the merge semantics in updateMessage(): a subsequent patch
    // that does NOT include stoppedByUser must leave it set. Re-rendering the
    // component with an updated message that still has stoppedByUser proves
    // the indicator persists. This is the front-line guarantee — the merge
    // happens upstream in setMessages, but the renderer must respect the field.
    const { rerender } = render(
      <MessageBubble
        message={makeMsg({ stoppedByUser: true, content: 'Initial partial', isStreaming: false })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('response-stopped-indicator')).toBeTruthy()

    // A late chunk arrives — the message gets updated with new content but
    // stoppedByUser is preserved by the shallow merge in updateMessage().
    rerender(
      <MessageBubble
        message={makeMsg({ stoppedByUser: true, content: 'Initial partial plus late chunk', isStreaming: false })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('response-stopped-indicator')).toBeTruthy()
    expect(screen.getByTestId('message-assistant').innerHTML).toContain('plus late chunk')
  })
})
