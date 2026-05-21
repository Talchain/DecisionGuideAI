/**
 * MessageBubble — FF-off parity for the new Follow-up actions.
 *
 * MessageBubble is shared between AI Panel v2 surfaces (floating + docked
 * Olumi) and the FF-off legacy DraftChat surface. The Explain more +
 * Summarise affordances must NEVER render under FF-off — adding them
 * silently would change legacy conversation parity.
 *
 * The flag guard (`isAiPanelV2Enabled()`) inside MessageBubble.tsx is the
 * single source of truth. This spec proves the guard holds end-to-end:
 * with `feature.aiPanelV2` off and the same callbacks that AI Panel v2
 * surfaces use, no follow-up icons appear in the rendered bubble.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

const ASSISTANT_MESSAGE: ConversationMessage = {
  id: 'turn-ff-off',
  role: 'assistant',
  content: 'Legacy DraftChat path — no AI Panel v2 affordances expected.',
  clientTurnId: 'client-turn-ff-off',
} as ConversationMessage

describe('FollowUpActions — FF-off parity (legacy DraftChat path)', () => {
  beforeEach(() => {
    try {
      window.localStorage.setItem('feature.aiPanelV2', 'false')
    } catch {}
  })

  it('does NOT render Explain more / Summarise when aiPanelV2 flag is off', () => {
    // Same callback shape AI Panel v2 surfaces pass through — proves the
    // gate is the FLAG, not the callback presence.
    const onArtefactMessage = vi.fn()
    render(
      <MessageBubble
        message={ASSISTANT_MESSAGE}
        onChipClick={async () => undefined}
        onArtefactMessage={onArtefactMessage}
        onFeedback={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
    expect(screen.queryByTestId('message-action-summarise')).toBeNull()
    expect(screen.queryByTestId('message-follow-up-actions')).toBeNull()
  })

  it('legacy DraftChat surfaces (compact=false) also remain unchanged', () => {
    // compact prop is independent of the flag, but both code paths must
    // suppress the affordances under FF-off.
    render(
      <MessageBubble
        message={ASSISTANT_MESSAGE}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
        onFeedback={vi.fn()}
        compact={false}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
  })

  it('flipping the flag to true re-enables the affordances (sanity check)', () => {
    try { window.localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    render(
      <MessageBubble
        message={ASSISTANT_MESSAGE}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
      />,
    )
    expect(screen.getByTestId('message-action-explain-more')).toBeInTheDocument()
    expect(screen.getByTestId('message-action-summarise')).toBeInTheDocument()
  })
})
