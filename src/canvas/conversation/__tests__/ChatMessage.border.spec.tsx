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

// ---------------------------------------------------------------------------
// The reclaimed action gutter — an INVERTED assertion, kept rather than deleted
// ---------------------------------------------------------------------------

describe('no space is reserved for an action bar that no longer floats', () => {
  /*
   * ⛔ THIS INVERTS `MessageActions.controls.spec`'s "ChatMessage reserves
   * exactly that gutter above the bubble" (32px), and the inversion is the
   * point. That spec was RIGHT for its surface: an absolutely-positioned hover
   * bar would otherwise sit on the message's first line, and opening the band
   * only on hover would reflow the thread under the pointer — so the band was
   * reserved unconditionally, on EVERY message.
   *
   * `MessageMenu` is inline, so there is nothing to keep off the text and no
   * band to reserve. A thread of N messages gets back 32·N px. This assertion
   * exists so that saving cannot be silently undone: any future reintroduction
   * of a top gutter on the message wrapper REDs here and has to argue for
   * itself.
   */
  it('reserves no top gutter on the message wrapper', () => {
    const { container } = renderMessage({ content: 'A normal answer' })
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.paddingTop).toBe('')
    expect(wrapper.getAttribute('data-actions-gutter-px')).toBeNull()
  })

  it('CONTROL — the wrapper is still the element that carries message spacing', () => {
    // Without this, the assertion above could pass by querying the wrong node.
    const { container } = renderMessage({ content: 'A normal answer' })
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.marginBottom).toBe('12px')
  })

  it('still offers every act, through the one inline control', () => {
    const { container } = renderMessage({ content: 'A normal answer' })
    expect(container.querySelector('[data-testid="message-menu-trigger"]')).not.toBeNull()
  })
})
