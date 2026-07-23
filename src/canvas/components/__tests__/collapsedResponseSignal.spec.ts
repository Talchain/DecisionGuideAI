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
  latestRealMessageIsFailedTurn,
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
  hasFailedTurn: false,
}

// The failed-turn-while-collapsed scenario: all context gates satisfied, but the
// turn produced NO assistant reply — its send failed (deliveryState 'failed')
// and the "Not delivered" + Retry + recovery guidance are stranded in the
// collapsed dock.
const FAILED_COLLAPSED: CollapsedResponseSignalInput = {
  aiPanelV2On: true,
  thinkingSettled: true,
  dockCollapsed: true,
  hasGraphContent: false,
  floatingTranscriptVisible: false,
  hasAssistantReply: false,
  hasFailedTurn: true,
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

describe('latestRealMessageIsFailedTurn', () => {
  it('true when the latest real message is a failed user send behind a synthetic error bubble', () => {
    // The live failure shape: the user bubble is patched deliveryState 'failed'
    // in place (so it keeps its position) and a SYNTHETIC assistant error bubble
    // — "Not delivered" copy + Retry chip — is appended after it.
    expect(
      latestRealMessageIsFailedTurn([
        msg({ id: 'u1', role: 'user', content: 'should I switch jobs?', deliveryState: 'failed' }),
        msg({
          id: 'err',
          role: 'assistant',
          synthetic: true,
          content: 'This is taking longer than expected. We stopped waiting…',
          actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
        }),
      ]),
    ).toBe(true)
  })

  it('true when the failed user send is the only message', () => {
    expect(
      latestRealMessageIsFailedTurn([
        msg({ id: 'u1', role: 'user', content: 'help', deliveryState: 'failed' }),
      ]),
    ).toBe(true)
  })

  it('false for a delivered send (deliveryState "sent" — e.g. blank-response turn)', () => {
    // Delivered-but-empty leaves the user bubble 'sent'; that is the #446
    // blank-response case, not a failure — neither predicate fires for it.
    expect(
      latestRealMessageIsFailedTurn([
        msg({ id: 'u1', role: 'user', content: 'help', deliveryState: 'sent' }),
        msg({ id: 'blank', role: 'assistant', synthetic: true, content: "I couldn't generate a response." }),
      ]),
    ).toBe(false)
  })

  it('false while the send is still in flight (deliveryState "pending")', () => {
    expect(
      latestRealMessageIsFailedTurn([
        msg({ id: 'u1', role: 'user', content: 'help', deliveryState: 'pending' }),
      ]),
    ).toBe(false)
  })

  it('false for a legacy/hydrated user send with no deliveryState', () => {
    expect(
      latestRealMessageIsFailedTurn([
        msg({ id: 'u1', role: 'user', content: 'help' }),
      ]),
    ).toBe(false)
  })

  it('false when the latest real message is a successful assistant reply (mutually exclusive with the reply scan)', () => {
    const messages = [
      msg({ id: 'u1', role: 'user', content: 'help', deliveryState: 'sent' }),
      msg({ id: 'a1', role: 'assistant', content: "What's your timeframe?" }),
    ]
    expect(latestRealMessageIsFailedTurn(messages)).toBe(false)
    expect(latestRealMessageIsAssistantReply(messages)).toBe(true)
  })

  it('false for an empty / missing transcript', () => {
    expect(latestRealMessageIsFailedTurn([])).toBe(false)
    expect(latestRealMessageIsFailedTurn(undefined)).toBe(false)
    expect(latestRealMessageIsFailedTurn(null)).toBe(false)
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

  it('stands down when the settled turn produced neither a reply nor a failure', () => {
    expect(
      shouldAutoExpandDockForResponse({
        ...CLARIFY_COLLAPSED,
        hasAssistantReply: false,
        hasFailedTurn: false,
      }),
    ).toBe(false)
  })

  it('THE ERROR DEFECT: a failed turn settles while the dock is collapsed → auto-expand', () => {
    // The residual gap #446 left: the user typed, waited ~90s, the send failed,
    // and the "Not delivered" + Retry + recovery guidance stayed invisible in the
    // collapsed dock. A failure surfaces the same as a reply — no assistant reply
    // required (hasAssistantReply is false here).
    expect(shouldAutoExpandDockForResponse(FAILED_COLLAPSED)).toBe(true)
  })

  it('failed turn stands down when no live turn settled (background/hydration failure — no isThinking edge)', () => {
    // The thinking-edge guard must still gate: a failure that surfaces without a
    // user's own composer send (page load, background/system turn) must NOT move
    // the dock.
    expect(
      shouldAutoExpandDockForResponse({ ...FAILED_COLLAPSED, thinkingSettled: false }),
    ).toBe(false)
  })

  it('failed turn stands down when a graph already exists (draft path owns that surface)', () => {
    expect(
      shouldAutoExpandDockForResponse({ ...FAILED_COLLAPSED, hasGraphContent: true }),
    ).toBe(false)
  })

  it('failed turn stands down when aiPanelV2 is off (legacy DraftChat path)', () => {
    expect(
      shouldAutoExpandDockForResponse({ ...FAILED_COLLAPSED, aiPanelV2On: false }),
    ).toBe(false)
  })
})
