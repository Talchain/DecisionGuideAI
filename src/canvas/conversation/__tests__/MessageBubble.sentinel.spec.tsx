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
import type { ConversationMessage, GraphPatchBlock } from '../types'

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

  it('suppresses assistant messages with [system] sentinel content', () => {
    const message: ConversationMessage = {
      id: 'msg-3',
      role: 'assistant',
      content: SYSTEM_MESSAGE_SENTINEL,
      timestamp: new Date(),
    }

    const { container } = render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    // Non-conversational assistant content (including [system] sentinel) is suppressed
    expect(container.firstChild).toBeNull()
  })

  it('renders graph_patch blocks even when assistant text is empty', () => {
    const block: GraphPatchBlock = {
      type: 'graph_patch',
      patch_id: 'patch-1',
      summary: '1 decision added',
      operations: [{ op: 'add_node', target_id: 'd1', data: { id: 'd1', kind: 'decision', label: 'Test' } }],
      target_graph_hash: 'abc',
      auto_apply: true,
    }
    const message: ConversationMessage = {
      id: 'msg-4',
      role: 'assistant',
      content: '',
      blocks: [block],
      timestamp: new Date(),
    }

    render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    // Blocks must survive even when text is non-conversational (empty)
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
    expect(screen.getByTestId('block-graph-patch-patch-1')).toBeInTheDocument()
  })

  it('renders graph_patch blocks when text is a stock acknowledgement', () => {
    const block: GraphPatchBlock = {
      type: 'graph_patch',
      patch_id: 'patch-2',
      summary: '2 factors added',
      operations: [{ op: 'add_node', target_id: 'f1', data: { id: 'f1', kind: 'factor', label: 'Cost' } }],
      target_graph_hash: 'def',
      auto_apply: true,
    }
    const message: ConversationMessage = {
      id: 'msg-5',
      role: 'assistant',
      content: 'Changes applied.',
      blocks: [block],
      timestamp: new Date(),
    }

    render(
      <MessageBubble message={message} onChipClick={vi.fn()} />,
    )

    // Graph patch block must render; stock ack text is suppressed upstream
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument()
    expect(screen.getByTestId('block-graph-patch-patch-2')).toBeInTheDocument()
  })
})
