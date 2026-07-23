/**
 * RED-first pin for the collapsed-dock response-signal defect.
 *
 * Reproduces the live-verified first-touch gap (staging build 0d41f5dc): a guest
 * on an empty canvas sends a brief from the floating composer, CEE replies with a
 * clarify_v2 question + chips (no graph drafted), and the response lands ONLY in
 * the dock's Olumi tab while the dock is collapsed — zero visible signal.
 *
 * `shouldAutoExpandDockForResponse` must return TRUE for exactly that scenario and
 * FALSE for every case where auto-expanding would be wrong or redundant.
 */

import { describe, it, expect } from 'vitest'
import type { ConversationMessage } from '../../conversation/types'
import {
  latestRealMessageIsAssistantReply,
  shouldAutoExpandDockForResponse,
  type CollapsedResponseSignalInput,
} from '../collapsedResponseSignal'

function msg(partial: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: partial.id ?? 'm',
    role: partial.role ?? 'assistant',
    content: partial.content ?? '',
    timestamp: new Date(0),
    ...partial,
  }
}

// The clarify-turn-while-collapsed scenario: all gates satisfied.
const CLARIFY_COLLAPSED: CollapsedResponseSignalInput = {
  aiPanelV2On: true,
  thinkingSettled: true,
  dockCollapsed: true,
  hasGraphContent: false,
  floatingTranscriptVisible: false,
  hasAssistantReply: true,
}

describe('latestRealMessageIsAssistantReply', () => {
  it('true when the latest real message is an assistant reply with prose', () => {
    expect(
      latestRealMessageIsAssistantReply([
        msg({ id: 'u1', role: 'user', content: 'should I switch jobs?' }),
        msg({ id: 'a1', role: 'assistant', content: "What's your timeframe?" }),
      ]),
    ).toBe(true)
  })

  it('true when the assistant reply carries chips but no prose', () => {
    expect(
      latestRealMessageIsAssistantReply([
        msg({ id: 'u1', role: 'user', content: 'help' }),
        msg({
          id: 'a1',
          role: 'assistant',
          content: '',
          actionChips: [{ id: 'c1', label: 'Use sensible defaults', intent: 'primary' }],
        }),
      ]),
    ).toBe(true)
  })

  it('false when the latest real message is the user (no assistant reply landed)', () => {
    expect(
      latestRealMessageIsAssistantReply([
        msg({ id: 'u1', role: 'user', content: 'help' }),
      ]),
    ).toBe(false)
  })

  it('skips a trailing synthetic error bubble (send failure → no signal)', () => {
    expect(
      latestRealMessageIsAssistantReply([
        msg({ id: 'u1', role: 'user', content: 'help' }),
        msg({ id: 'err', role: 'assistant', content: 'Something went wrong', synthetic: true }),
      ]),
    ).toBe(false)
  })

  it('false for an empty / missing transcript', () => {
    expect(latestRealMessageIsAssistantReply([])).toBe(false)
    expect(latestRealMessageIsAssistantReply(undefined)).toBe(false)
    expect(latestRealMessageIsAssistantReply(null)).toBe(false)
  })

  it('false when the assistant reply has neither prose nor chips', () => {
    expect(
      latestRealMessageIsAssistantReply([
        msg({ id: 'a1', role: 'assistant', content: '   ' }),
      ]),
    ).toBe(false)
  })
})

describe('shouldAutoExpandDockForResponse', () => {
  it('THE DEFECT: clarify turn settles while the dock is collapsed → auto-expand', () => {
    // Before the fix nothing surfaced this: the user typed, the spinner ended,
    // and the clarify question + chips stayed invisible in the collapsed dock.
    expect(shouldAutoExpandDockForResponse(CLARIFY_COLLAPSED)).toBe(true)
  })

  it('stands down when aiPanelV2 is off (legacy DraftChat path)', () => {
    expect(shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, aiPanelV2On: false })).toBe(false)
  })

  it('stands down when no live turn settled (page load / hydration — no isThinking edge)', () => {
    expect(shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, thinkingSettled: false })).toBe(false)
  })

  it('stands down when the dock is already visibly expanded', () => {
    expect(shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, dockCollapsed: false })).toBe(false)
  })

  it('stands down for a DRAFT turn (graph populated — the draft path owns that case)', () => {
    expect(shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, hasGraphContent: true })).toBe(false)
  })

  it('stands down when the conversation is already visible in a floating transcript', () => {
    expect(
      shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, floatingTranscriptVisible: true }),
    ).toBe(false)
  })

  it('stands down when the settled turn produced no genuine assistant reply (send failure)', () => {
    expect(shouldAutoExpandDockForResponse({ ...CLARIFY_COLLAPSED, hasAssistantReply: false })).toBe(false)
  })
})
