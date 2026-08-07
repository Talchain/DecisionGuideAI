/**
 * MessageBubble failed-send marker — dress-rehearsal trust item #3.
 *
 * A user message whose turn failed (deliveryState 'failed') must LOOK failed
 * in the transcript: a visible "Not delivered" marker plus, when the caller
 * wires it (ChatThread does so only for the message retryLast would actually
 * resend), a retry affordance ON the message itself. Delivered and pending
 * messages render no marker — the failed state must never leak onto normal
 * history.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../Conversation.module.css', () => ({
  default: {
    messageBubbleUser: 'messageBubbleUser',
    messageBubbleUserFailed: 'messageBubbleUserFailed',
    messageBubbleAssistant: 'messageBubbleAssistant',
    markdownContent: 'markdownContent',
    streamingThinking: 'streamingThinking',
    streamingDot: 'streamingDot',
    sendFailedRow: 'sendFailedRow',
    sendFailedRetryButton: 'sendFailedRetryButton',
    chipActionIndicator: 'chipActionIndicator',
  },
}))

vi.mock('../../../styles/typography', () => ({
  typography: { bodySmall: 'bodySmall', panelMeta: 'panelMeta', caption: 'caption', body: 'body', chatProse: 'chatProse', panelBody: 'panelBody' },
}))

vi.mock('../InlineBlocks', () => ({
  InlineBlocks: () => null,
}))

vi.mock('../FeedbackRow', () => ({
  FeedbackRow: () => null,
}))

vi.mock('../useConversation', () => ({
  SYSTEM_MESSAGE_SENTINEL: '[system]',
  isNonConversationalContent: () => false,
  normaliseAnalysisReady: (x: unknown) => x,
}))

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

function makeUserMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'u1',
    role: 'user',
    content: 'my brief',
    timestamp: new Date(),
    ...overrides,
  } as ConversationMessage
}

const noopChip = async () => {}

describe('MessageBubble — failed-send marker', () => {
  it('renders "Not delivered" marker on a failed user message', () => {
    render(
      <MessageBubble
        message={makeUserMsg({ deliveryState: 'failed' })}
        onChipClick={noopChip}
      />,
    )
    const marker = screen.getByTestId('send-failed-indicator')
    expect(marker.textContent).toContain('Not delivered')
  })

  it('renders a retry affordance on the failed message when wired, and clicking it fires the handler', async () => {
    const onRetry = vi.fn()
    render(
      <MessageBubble
        message={makeUserMsg({ deliveryState: 'failed' })}
        onChipClick={noopChip}
        onRetryFailedSend={onRetry}
      />,
    )
    const btn = screen.getByTestId('send-failed-retry')
    await userEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('no retry affordance when the caller does not wire one (older failed attempts)', () => {
    render(
      <MessageBubble
        message={makeUserMsg({ deliveryState: 'failed' })}
        onChipClick={noopChip}
      />,
    )
    expect(screen.getByTestId('send-failed-indicator')).toBeTruthy()
    expect(screen.queryByTestId('send-failed-retry')).toBeNull()
  })

  it('no marker on delivered, pending, or unmarked user messages', () => {
    const { rerender } = render(
      <MessageBubble message={makeUserMsg({ deliveryState: 'sent' })} onChipClick={noopChip} />,
    )
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
    rerender(
      <MessageBubble message={makeUserMsg({ deliveryState: 'pending' })} onChipClick={noopChip} />,
    )
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
    rerender(<MessageBubble message={makeUserMsg()} onChipClick={noopChip} />)
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
  })

  it('no marker on assistant messages regardless of field value', () => {
    render(
      <MessageBubble
        message={{
          id: 'a1',
          role: 'assistant',
          content: 'reply',
          timestamp: new Date(),
          deliveryState: 'failed',
        } as ConversationMessage}
        onChipClick={noopChip}
      />,
    )
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
  })

  it('failed marker also renders on chip-initiated compact user pills', () => {
    render(
      <MessageBubble
        message={makeUserMsg({ chipInitiated: true, deliveryState: 'failed' })}
        onChipClick={noopChip}
      />,
    )
    expect(screen.getByTestId('send-failed-indicator')).toBeTruthy()
  })
})
