/**
 * MessageBubble — Explain more / Summarise follow-up actions.
 *
 * Round-3 UX correction added two subtle icon actions to the assistant
 * message footer (alongside the existing copy/retry/feedback affordances).
 * Each action dispatches a follow-up via the existing send path
 * (`onArtefactMessage` → `sendMessage` with `debugSource: 'artefact_action'`).
 *
 * The brief requires:
 *  - actions render on assistant messages only;
 *  - never on user messages;
 *  - never on streaming/thinking turns;
 *  - never on synthetic messages;
 *  - accessible aria-label + title;
 *  - route through the existing conversation send path;
 *  - single-flight guard so a double-click sends one follow-up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Stub the supabase + markdown chains the MessageBubble import graph touches.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

// AI Panel v2 flag enabled for the whole suite; FF-off parity is asserted
// in a dedicated spec (MessageBubble.followUp.ffOff.spec.tsx).
beforeEach(() => {
  try { window.localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
})

function baseMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'turn-1',
    role: 'assistant',
    content: 'Here is a clear answer to your question.',
    clientTurnId: 'client-turn-1',
    ...overrides,
  } as ConversationMessage
}

describe('FollowUpActions — render gating', () => {
  it('renders Explain more + Summarise on a normal assistant message', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    expect(screen.getByTestId('message-action-explain-more')).toBeInTheDocument()
    expect(screen.getByTestId('message-action-summarise')).toBeInTheDocument()
  })

  it('does NOT render on user messages', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage({ role: 'user', content: 'help me decide' })}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
    expect(screen.queryByTestId('message-action-summarise')).toBeNull()
  })

  it('does NOT render on streaming messages', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage({ isStreaming: true, content: 'partial …' })}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
    expect(screen.queryByTestId('message-action-summarise')).toBeNull()
  })

  it('does NOT render on synthetic messages', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage({ synthetic: true })}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
  })

  it('does NOT render when onArtefactMessage callback is absent', () => {
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
  })
})

describe('FollowUpActions — accessibility', () => {
  it('Explain more has an accessible label and tooltip', () => {
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('message-action-explain-more')
    expect(btn.getAttribute('aria-label')).toBe('Explain in more detail')
    expect(btn.getAttribute('title')).toBe('Explain more')
  })

  it('Summarise has an accessible label and tooltip', () => {
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('message-action-summarise')
    expect(btn.getAttribute('aria-label')).toBe('Summarise this response')
    expect(btn.getAttribute('title')).toBe('Summarise')
  })

  it('action row has an accessible group label', () => {
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
      />,
    )
    const row = screen.getByTestId('message-follow-up-actions')
    expect(row.getAttribute('aria-label')).toBe('Follow up on this response')
  })
})

describe('FollowUpActions — send path wiring', () => {
  it('Explain more sends the British-English follow-up text via onArtefactMessage', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    fireEvent.click(screen.getByTestId('message-action-explain-more'))
    expect(onArtefactMessage).toHaveBeenCalledTimes(1)
    expect(onArtefactMessage).toHaveBeenCalledWith('Please explain that in more detail.')
  })

  it('Summarise sends the British-English follow-up text via onArtefactMessage', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    fireEvent.click(screen.getByTestId('message-action-summarise'))
    expect(onArtefactMessage).toHaveBeenCalledTimes(1)
    expect(onArtefactMessage).toHaveBeenCalledWith('Please summarise that as concise bullets.')
  })

  it('single-flight guard: double-click on Explain more only sends once', () => {
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={baseMessage()}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
      />,
    )
    const btn = screen.getByTestId('message-action-explain-more')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onArtefactMessage).toHaveBeenCalledTimes(1)
  })
})
