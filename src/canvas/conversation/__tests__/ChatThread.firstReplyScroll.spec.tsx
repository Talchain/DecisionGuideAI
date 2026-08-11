/**
 * ChatThread — the FIRST assistant reply must trigger the auto-scroll.
 *
 * ⚠ WHAT THIS SPEC CAN AND CANNOT PROVE, STATED UP FRONT. jsdom has no layout,
 * so it cannot prove the reply is ON SCREEN (CLAUDE.md trap 3) — that claim is
 * made only by the real-browser witness in `e2e/`, and the numbers live in the
 * PR body. What jsdom CAN prove, and what the defect actually was, is that the
 * scroll is TRIGGERED on the commit that first puts the reply in the DOM. Those
 * are two different claims and this file only makes the second one.
 *
 * THE DEFECT. `useSmartScroll` fired on `messages.length`. During turn one that
 * length does change (0 → 1 user → 2 streaming), so the effect ran twice — but
 * `ChatThread` returns `null` for BOTH roles while `showEmptyState` holds, so
 * both runs scrolled a container holding only `EmptyState`. The commit that
 * finally renders the reply is `isStreaming` flipping false on an EXISTING
 * message object: `messages.length` is IDENTICAL across it, so the old trigger
 * was structurally incapable of observing the one commit that mattered.
 *
 * That is why the case below is a MUTATION of an existing message and not an
 * append — an append-shaped test would have passed at pristine and proved
 * nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

vi.mock('../../../components/results/v7/V7HeldProposalCard', () => ({ V7HeldProposalCard: () => null }))

const scrollIntoView = vi.fn()

function props(messages: ConversationMessage[], nodeCount = 0) {
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    nodeCount,
    patchBlockStates: {},
    patchRejections: {},
    onChipClick: vi.fn(),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
  } as unknown as React.ComponentProps<typeof ChatThread>
}

const userMsg = (id: string): ConversationMessage =>
  ({ id, role: 'user', content: 'Should we replace our CRM?' }) as ConversationMessage

/** The assistant message, in its two states. Same `id` — that is the point. */
const assistantMsg = (id: string, streaming: boolean): ConversationMessage =>
  ({ id, role: 'assistant', content: 'Here is a first read of your decision.', isStreaming: streaming }) as ConversationMessage

describe('ChatThread — the first assistant reply is scrolled to', () => {
  beforeEach(() => {
    scrollIntoView.mockClear()
    Element.prototype.scrollIntoView = scrollIntoView
  })

  it('scrolls on the commit that FINALISES the first reply — the commit where messages.length does not change', () => {
    const messages = [userMsg('u1'), assistantMsg('a1', true)]
    const { rerender } = render(<ChatThread {...props(messages)} />)

    // Everything so far is suppressed by the empty state, so nothing has been
    // scrolled to. Pin that precondition IN-TEST rather than assuming it: if the
    // suppression ever stops happening, this case must stop claiming to cover it
    // (CLAUDE.md trap 13b — a discriminator must pin its own precondition).
    const scrollsBeforeFinalise = scrollIntoView.mock.calls.length

    // THE COMMIT THAT MATTERS: the SAME message id, isStreaming true → false.
    // `messages.length` is 2 both before and after.
    const finalised = [userMsg('u1'), assistantMsg('a1', false)]
    expect(finalised.length).toBe(messages.length) // the defect's whole mechanism, asserted
    rerender(<ChatThread {...props(finalised)} />)

    expect(
      scrollIntoView.mock.calls.length,
      'the first assistant reply became visible on this commit and nothing scrolled to it — ' +
        'the user is left looking at the top of a reply that has already finished',
    ).toBeGreaterThan(scrollsBeforeFinalise)
  })

  it('scrolls when the graph arriving is what reveals the messages (nodeCount 0 → non-zero, same message list)', () => {
    // The other route out of the empty state. Same shape: the message ARRAY is
    // byte-identical across the commit, so only a rendered-count trigger sees it.
    const messages = [userMsg('u1'), assistantMsg('a1', true)]
    const { rerender } = render(<ChatThread {...props(messages, 0)} />)
    const before = scrollIntoView.mock.calls.length

    rerender(<ChatThread {...props(messages, 12)} />)

    expect(
      scrollIntoView.mock.calls.length,
      'the graph landed and unhid the transcript, but the thread did not scroll to it',
    ).toBeGreaterThan(before)
  })

  it('does NOT scroll while every message is still suppressed — the trigger is rendered content, not traffic', () => {
    // The discriminating twin. Without this, a trigger that simply fired on
    // every render would satisfy the two cases above while measuring nothing.
    const { rerender } = render(<ChatThread {...props([userMsg('u1')], 0)} />)
    const afterUserOnly = scrollIntoView.mock.calls.length

    // A second suppressed message arrives: messages.length changes 1 → 2, but
    // NOTHING new reaches the DOM, so nothing should be scrolled to.
    rerender(<ChatThread {...props([userMsg('u1'), assistantMsg('a1', true)], 0)} />)

    expect(
      scrollIntoView.mock.calls.length,
      'the thread scrolled for a message the empty state is suppressing — the trigger is counting traffic, not content',
    ).toBe(afterUserOnly)
  })
})
