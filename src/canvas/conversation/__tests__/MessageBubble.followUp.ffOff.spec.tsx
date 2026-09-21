/**
 * MessageBubble — legacy-path parity for the follow-up actions.
 *
 * MessageBubble is shared between AI Panel v2 surfaces (floating + docked
 * Olumi) and the FF-off legacy DraftChat surface. The Explain more +
 * Summarise affordances must NEVER reach the legacy surface — adding them
 * silently would change legacy conversation parity.
 *
 * ⭐ THE GUARANTEE GOT STRONGER, WHICH IS WHY THIS FILE CHANGED. It used to
 * rest on a RUNTIME FLAG CHECK — `isAiPanelV2Enabled()` inside MessageBubble —
 * and proved the guard held by flipping `feature.aiPanelV2` and re-rendering.
 * Both affordances have since moved OUT of MessageBubble into `MessageMenu`,
 * which only `zones/ChatMessage` renders. The legacy DraftChat surface does not
 * mount ChatMessage at all (it references neither it nor MessageBubble), so
 * parity now holds BY CONSTRUCTION: there is no code path on which the legacy
 * surface could acquire these controls, flag or no flag.
 *
 * ⛔ THE FLAG-ON "sanity check" ARM IS RETIRED, not quietly deleted. It
 * asserted that flipping the flag to true made MessageBubble render the two
 * buttons — a true statement about a component that no longer owns them. Its
 * real subject, "the affordances exist somewhere and are wired", is asserted
 * properly in `zones/__tests__/MessageMenu.spec.tsx` (21 arms), against the
 * component that now renders them.
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

describe('Follow-up actions — legacy-path parity (DraftChat)', () => {
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

  it('MessageBubble renders no follow-up affordance EVEN WITH the flag on', () => {
    /*
     * The inversion of the retired arm, and the point of the change: the flag
     * is no longer what keeps these controls off the legacy surface — the
     * component simply does not own them any more. Flipping the flag on must
     * therefore change nothing here. If a future edit re-adds a follow-up
     * button to MessageBubble, this REDs and the legacy path is protected
     * before anyone has to notice it in a screenshot.
     */
    try { window.localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    render(
      <MessageBubble
        message={ASSISTANT_MESSAGE}
        onChipClick={async () => undefined}
        onArtefactMessage={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('message-action-explain-more')).toBeNull()
    expect(screen.queryByTestId('message-action-summarise')).toBeNull()
    expect(screen.queryByTestId('message-menu-trigger')).toBeNull()
  })

})
