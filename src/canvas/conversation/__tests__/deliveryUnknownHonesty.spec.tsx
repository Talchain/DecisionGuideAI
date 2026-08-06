/**
 * ROADMAP 2.665 — the UI never states non-delivery it has not verified.
 *
 * The witnessed defect was one sentence in one timeout handler, but the
 * INVARIANT is wider than that handler, and this file pins the wider thing:
 * wherever the UI stops hearing from CEE, it must not convert that silence into
 * a claim about what the server did. CEE completes and commits turns the
 * browser stopped listening for — measured 2026-08-07 at 118.5s and 123.1s,
 * both 200, both committed, while the client had already given up at 60.0s.
 *
 * The tests come in DISCRIMINATING PAIRS wherever a claim was narrowed, because
 * "we stopped saying it" and "we stopped saying it only where it was false" are
 * different results and only the second one is correct. A network throw still
 * says the message didn't reach the server, and it must: that is the one
 * transport shape where non-delivery IS verified.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../Conversation.module.css', () => ({
  default: {
    messageBubbleUser: 'messageBubbleUser',
    messageBubbleUserFailed: 'messageBubbleUserFailed',
    messageBubbleAssistant: 'messageBubbleAssistant',
    markdownContent: 'markdownContent',
    streamingThinking: 'streamingThinking',
    streamingDot: 'streamingDot',
    sendFailedRow: 'sendFailedRow',
    sendFailedRetryButton: 'sendFailedRetryButton',
    chipActionIndicator: 'chipActionIndicator',
  },
}))

vi.mock('../../../styles/typography', () => ({
  typography: { bodySmall: 'bodySmall', panelMeta: 'panelMeta', caption: 'caption', body: 'body', chatProse: 'chatProse', panelBody: 'panelBody' },
}))

vi.mock('../InlineBlocks', () => ({ InlineBlocks: () => null }))
vi.mock('../FeedbackRow', () => ({ FeedbackRow: () => null }))
vi.mock('../useConversation', () => ({
  SYSTEM_MESSAGE_SENTINEL: '[system]',
  isNonConversationalContent: () => false,
  normaliseAnalysisReady: (x: unknown) => x,
}))

import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import {
  NON_DELIVERY_CLAIM_PATTERNS,
  assertsNonDelivery,
  assertsDeliveryUnknown,
  WAIT_EXPIRY_UNKNOWN_COPY,
  PROXY_TIMEOUT_UNKNOWN_COPY,
} from '../deliveryUnknown'
import { buildTransportFailureCopy, isUnverifiedDelivery } from '../transportFailure'
import { latestRealMessageIsFailedTurn } from '../../components/collapsedResponseSignal'

const noopChip = async () => {}

function makeUserMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'u1',
    role: 'user',
    content: 'add three options and a risk for each',
    timestamp: new Date(),
    ...overrides,
  } as ConversationMessage
}

// ---------------------------------------------------------------------------
// The copy constants themselves
// ---------------------------------------------------------------------------

describe('wait-expiry copy', () => {
  const WAIT_EXPIRY_COPIES: ReadonlyArray<[string, string]> = [
    ['WAIT_EXPIRY_UNKNOWN_COPY', WAIT_EXPIRY_UNKNOWN_COPY],
    ['PROXY_TIMEOUT_UNKNOWN_COPY', PROXY_TIMEOUT_UNKNOWN_COPY],
  ]

  it.each(WAIT_EXPIRY_COPIES)('%s asserts no non-delivery', (_name, copy) => {
    expect(assertsNonDelivery(copy)).toBe(false)
  })

  it.each(WAIT_EXPIRY_COPIES)('%s states the outcome is unknown', (_name, copy) => {
    expect(assertsDeliveryUnknown(copy)).toBe(true)
  })

  it.each(WAIT_EXPIRY_COPIES)('%s still reassures that nothing was lost', (_name, copy) => {
    expect(copy).toMatch(/nothing you typed was lost/i)
  })

  it.each(WAIT_EXPIRY_COPIES)('%s warns that sending again asks twice', (_name, copy) => {
    // I-B's copy half: no retry button is offered, so the copy must carry the
    // duplicate consequence — CEE does not dedupe (its commit key is its own
    // per-request id, not payload.turn_id).
    expect(copy).toMatch(/second time/i)
  })

  it('the sweep vocabulary itself can still see a real non-delivery claim', () => {
    // Positive control (trap 13): an absence assertion is worthless unless it
    // can detect a presence. This is the exact sentence the witness captured.
    expect(
      assertsNonDelivery(
        'This is taking longer than expected. We stopped waiting, so your message has not gone through.',
      ),
    ).toBe(true)
    expect(NON_DELIVERY_CLAIM_PATTERNS.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// transportFailure — the discriminating pair
// ---------------------------------------------------------------------------

describe('transport-failure copy discriminates verified from unverified', () => {
  const recovery = {} as never

  it('a proxy/edge timeout (network:false) never claims non-delivery', () => {
    const copy = buildTransportFailureCopy({ network: false }, true)
    expect(assertsNonDelivery(copy)).toBe(false)
    expect(assertsDeliveryUnknown(copy)).toBe(true)
  })

  it('a network throw (network:true) STILL claims non-delivery — it is verified', () => {
    // The other half of the pair. If this went green-by-softening too, the fix
    // would have removed a TRUE statement, which is its own honesty defect.
    const copy = buildTransportFailureCopy({ network: true }, true)
    expect(copy).toMatch(/didn['’]t reach the server/i)
    expect(assertsNonDelivery(copy)).toBe(true)
  })

  it('isUnverifiedDelivery is true for a proxy timeout body', () => {
    expect(
      isUnverifiedDelivery({
        hasBoundaryError: false,
        transportMeta: { network: false },
        recovery,
        rawBody: { code: 'PROXY_UPSTREAM_TIMEOUT' },
      }),
    ).toBe(true)
  })

  it('isUnverifiedDelivery is false for a network throw', () => {
    expect(
      isUnverifiedDelivery({
        hasBoundaryError: false,
        transportMeta: { network: true },
        recovery,
        rawBody: undefined,
      }),
    ).toBe(false)
  })

  it('isUnverifiedDelivery is false for a CEE-class failure', () => {
    // A CEE envelope means the server received the turn and returned its own
    // verdict — nothing unverified about it.
    expect(
      isUnverifiedDelivery({
        hasBoundaryError: true,
        transportMeta: { network: false },
        recovery,
        rawBody: { error: 'INTERNAL_ERROR' },
      }),
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MessageBubble — the marker
// ---------------------------------------------------------------------------

describe('MessageBubble — unconfirmed marker', () => {
  it('an unconfirmed send renders an outcome-unknown marker, not "Not delivered"', () => {
    render(
      <MessageBubble message={makeUserMsg({ deliveryState: 'unconfirmed' })} onChipClick={noopChip} />,
    )
    const marker = screen.getByTestId('send-unconfirmed-indicator')
    expect(assertsNonDelivery(marker.textContent ?? '')).toBe(false)
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
  })

  it('an unconfirmed send offers no retry button even when the handler is wired', () => {
    // I-B at the bubble: ChatThread only wires onRetryFailedSend for the last
    // user message, and a retry duplicates while the outcome is unknown.
    const onRetry = vi.fn()
    render(
      <MessageBubble
        message={makeUserMsg({ deliveryState: 'unconfirmed' })}
        onChipClick={noopChip}
        onRetryFailedSend={onRetry}
      />,
    )
    expect(screen.queryByRole('button', { name: /retry|try again/i })).toBeNull()
  })

  it('a genuinely failed send still renders "Not delivered" — the pair', () => {
    render(
      <MessageBubble message={makeUserMsg({ deliveryState: 'failed' })} onChipClick={noopChip} />,
    )
    expect(screen.getByTestId('send-failed-indicator').textContent).toContain('Not delivered')
    expect(screen.queryByTestId('send-unconfirmed-indicator')).toBeNull()
  })

  it('a delivered send renders neither marker', () => {
    render(
      <MessageBubble message={makeUserMsg({ deliveryState: 'sent' })} onChipClick={noopChip} />,
    )
    expect(screen.queryByTestId('send-failed-indicator')).toBeNull()
    expect(screen.queryByTestId('send-unconfirmed-indicator')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// collapsedResponseSignal — the notice must not be stranded
// ---------------------------------------------------------------------------

describe('collapsed-panel signal covers the unknown outcome', () => {
  const userMsg = (deliveryState: ConversationMessage['deliveryState']) => [
    makeUserMsg({ deliveryState }),
    { id: 's1', role: 'assistant', synthetic: true, content: WAIT_EXPIRY_UNKNOWN_COPY, timestamp: new Date() } as ConversationMessage,
  ]

  it('fires for an unconfirmed send (otherwise the notice is invisible when collapsed)', () => {
    expect(latestRealMessageIsFailedTurn(userMsg('unconfirmed'))).toBe(true)
  })

  it('still fires for a failed send — the pair', () => {
    expect(latestRealMessageIsFailedTurn(userMsg('failed'))).toBe(true)
  })

  it('does not fire for a delivered send', () => {
    expect(latestRealMessageIsFailedTurn(userMsg('sent'))).toBe(false)
  })

  it('does not fire for a still-pending send', () => {
    expect(latestRealMessageIsFailedTurn(userMsg('pending'))).toBe(false)
  })
})
