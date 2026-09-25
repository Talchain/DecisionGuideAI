/**
 * ⭐ ONE "…" AT REST, NOT ONE PER MESSAGE (Paul's manual test, #69 5832347190 §C).
 *
 * The per-message overflow menu showed its "…" trigger under every message:
 * four in one viewport. Now only the latest reply shows it at rest. Every other
 * message keeps its trigger rendered and focusable, revealed on hover, on
 * keyboard focus and always on a no-hover (touch) device, so the MessageMenu
 * header's three reasons against hover-only still hold.
 *
 * CLAIM TYPE: jsdom DOM + class contract. jsdom cannot evaluate :hover or media
 * queries, so the reveal is pinned by the exact utility classes that carry it,
 * and reachability by the trigger being present, enabled and tabbable.
 */
import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import { ChatMessage, MENU_QUIET_AT_REST } from '../zones/ChatMessage'
import type { ConversationMessage } from '../types'

const noop = () => {}
const noopAsync = async () => {}

function renderMessage(msg: Partial<ConversationMessage>, isLatestAssistantTurn: boolean) {
  const full: ConversationMessage = { id: 'm', role: 'assistant', content: 'A reply.', timestamp: new Date(), ...msg }
  return render(
    <ChatMessage message={full} onChipClick={noopAsync} onRetry={noop} isLatestAssistantTurn={isLatestAssistantTurn} />,
  )
}
const slot = (c: HTMLElement) => c.querySelector('[data-testid="message-menu-slot"]') as HTMLElement

describe('the message menu at rest', () => {
  it('the LATEST reply shows its "…" at rest', () => {
    const { container } = renderMessage({}, true)
    expect(slot(container).getAttribute('data-menu-at-rest')).toBe('shown')
    expect(slot(container).className).not.toContain('opacity-0')
  })

  it.each([
    ['an earlier assistant reply', { role: 'assistant' as const }],
    ['a user message', { role: 'user' as const }],
  ])('%s is quiet at rest, and reveals on hover, keyboard focus and touch', (_name, msg) => {
    const { container } = renderMessage(msg, false)
    const cls = slot(container).className
    expect(slot(container).getAttribute('data-menu-at-rest')).toBe('on-hover-or-focus')
    for (const c of MENU_QUIET_AT_REST.split(' ')) expect(cls, `carries ${c}`).toContain(c)
    expect(cls).toContain('opacity-0')
    expect(cls).toContain('group-hover:opacity-100')
    expect(cls).toContain('focus-within:opacity-100')
    expect(cls).toContain('[@media(hover:none)]:opacity-100')
  })

  it('a quiet trigger is still rendered, enabled and in the tab order (keyboard reachable)', () => {
    const { container } = renderMessage({}, false)
    const trigger = within(slot(container)).getByTestId('message-menu-trigger') as HTMLButtonElement
    expect(trigger.disabled).toBe(false)
    expect(trigger.tabIndex).toBe(0)
    expect(trigger.getAttribute('aria-label')).toBe('Message actions')
    // Opacity only: never display:none / visibility:hidden, which would drop it from focus.
    expect(slot(container).className).not.toMatch(/\b(hidden|invisible)\b/)
  })

  it('the row that reveals it is the message itself (`group`)', () => {
    const { container } = renderMessage({}, false)
    expect(slot(container).closest('.group')).not.toBeNull()
  })
})
