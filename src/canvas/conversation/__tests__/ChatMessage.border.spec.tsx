/**
 * ChatMessage — visual category border tests
 *
 * Verifies the left border accent derivation from message metadata:
 * - graph_patch blocks → action (info border)
 * - evidence/fact blocks → research (success border)
 * - synthetic with retry chip → error (danger border)
 * - plain text → answer (no decoration)
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChatMessage } from '../zones/ChatMessage'
import type { ConversationMessage } from '../types'

const noop = () => {}

function renderMessage(msg: Partial<ConversationMessage>) {
  const full: ConversationMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: 'Test',
    timestamp: new Date(),
    ...msg,
  }
  return render(
    <ChatMessage
      message={full}
      isFirst={false}
      onChipClick={noop}
      onRetry={noop}
    />,
  )
}

describe('ChatMessage — border category', () => {
  it('graph_patch block → action category (info border)', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'graph_patch', patch_id: 'p1', summary: 'Add node', operations: [], target_graph_hash: 'h1' } as any],
    })
    const el = container.querySelector('[data-message-category="action"]')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('border-l-info')
  })

  it('evidence block → research category (success border)', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'evidence', findings: [], query: 'test' } as any],
    })
    const el = container.querySelector('[data-message-category="research"]')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('border-l-success')
  })

  it('fact block → research category (success border)', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'fact', label: 'ROI', value: '42%' } as any],
    })
    const el = container.querySelector('[data-message-category="research"]')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('border-l-success')
  })

  it('synthetic error with retry chip → error category (danger border)', () => {
    const { container } = renderMessage({
      synthetic: true,
      actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
    })
    const el = container.querySelector('[data-message-category="error"]')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('border-l-danger')
  })

  it('plain text message → answer category (no border decoration)', () => {
    const { container } = renderMessage({
      content: 'Just a normal response',
    })
    // answer category has no data attribute
    expect(container.querySelector('[data-message-category]')).toBeNull()
    // No border-l class
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).not.toContain('border-l-')
  })

  it('user message → answer category (no border decoration)', () => {
    const { container } = renderMessage({
      role: 'user',
      content: 'User question',
    })
    expect(container.querySelector('[data-message-category]')).toBeNull()
  })
})
