/**
 * Tests for MessageBubble [system] sentinel guard
 *
 * Verifies that the '[system]' sentinel message content never renders as
 * a user bubble, even if it somehow ends up in the message list.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { SYSTEM_MESSAGE_SENTINEL } from '../useConversation'
import type { ConversationMessage } from '../types'

describe('MessageBubble [system] sentinel guard', () => {
  it('does not render a user bubble with [system] content', () => {
    const message: ConversationMessage = {
      id: 'msg-1',
      role: 'user',
      content: SYSTEM_MESSAGE_SENTINEL,
      timestamp: new Date(),
    }

    const { container } = render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    // Should render nothing
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('message-user')).not.toBeInTheDocument()
  })

  it('renders normal user messages', () => {
    const message: ConversationMessage = {
      id: 'msg-2',
      role: 'user',
      content: 'Hello world',
      timestamp: new Date(),
    }

    render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    expect(screen.getByTestId('message-user')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders assistant messages normally (even with [system] content)', () => {
    const message: ConversationMessage = {
      id: 'msg-3',
      role: 'assistant',
      content: SYSTEM_MESSAGE_SENTINEL,
      timestamp: new Date(),
    }

    render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    // Assistant messages should still render (guard only applies to user messages)
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
  })
})
