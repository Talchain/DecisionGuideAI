/**
 * ChatMessage — visual category tests
 *
 * Verifies message category derivation from message metadata:
 * - graph_patch blocks → action
 * - evidence/fact blocks → research
 * - synthetic with retry chip → error
 * - plain text → answer (no decoration)
 *
 * Left border accents have been removed — all categories now have
 * no border-l class. Category data attributes are still set for
 * test/automation selectors.
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

describe('ChatMessage — category derivation', () => {
  it('graph_patch block → action category', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'graph_patch', patch_id: 'p1', summary: 'Add node', operations: [], target_graph_hash: 'h1' } as any],
    })
    const el = container.querySelector('[data-message-category="action"]')
    expect(el).not.toBeNull()
    // No left border decoration
    expect(el!.className).not.toContain('border-l-')
  })

  it('evidence block → research category', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'evidence', findings: [], query: 'test' } as any],
    })
    const el = container.querySelector('[data-message-category="research"]')
    expect(el).not.toBeNull()
    expect(el!.className).not.toContain('border-l-')
  })

  it('fact block → research category', () => {
    const { container } = renderMessage({
      blocks: [{ type: 'fact', label: 'ROI', value: '42%' } as any],
    })
    const el = container.querySelector('[data-message-category="research"]')
    expect(el).not.toBeNull()
    expect(el!.className).not.toContain('border-l-')
  })

  it('synthetic error with retry chip → error category', () => {
    const { container } = renderMessage({
      synthetic: true,
      actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
    })
    const el = container.querySelector('[data-message-category="error"]')
    expect(el).not.toBeNull()
    expect(el!.className).not.toContain('border-l-')
  })

  it('plain text message → answer category (no data attribute)', () => {
    const { container } = renderMessage({
      content: 'Just a normal response',
    })
    // answer category has no data attribute
    expect(container.querySelector('[data-message-category]')).toBeNull()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).not.toContain('border-l-')
  })

  it('user message → answer category (no data attribute)', () => {
    const { container } = renderMessage({
      role: 'user',
      content: 'User question',
    })
    expect(container.querySelector('[data-message-category]')).toBeNull()
  })
})
