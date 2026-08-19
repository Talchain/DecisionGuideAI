/**
 * ChatThread — content that grows ON AN EXISTING MESSAGE must be scrolled to.
 *
 * ⚠ WHAT THIS SPEC CAN AND CANNOT PROVE, STATED UP FRONT. jsdom has no layout,
 * so it CANNOT prove the new content is on screen (CLAUDE.md trap 3) — a 0x0
 * element is "present" and useless, and believing otherwise is precisely what
 * produced the false "dead affordance" finding this lane was sent to explain.
 * The on-screen claim is made only by the real-Chromium instrument
 * (`e2e/geometry/threadAutoScroll.measure.ts`), whose pristine numbers are in
 * the PR body: scrollTop 0 / scrollHeight 1194 / clientHeight 600, with the
 * "Run analysis" chip at y=1126, `inView: false`, `hitTestable: false`.
 * What jsdom CAN prove, and what the defect is, is that the scroll is
 * TRIGGERED on the commit that puts that content in the DOM.
 *
 * THE DEFECT. `useSmartScroll`'s trigger is `{ messageCount, isThinking }` —
 * a PROXY for content, not content. Derived at the producer
 * (`useConversation.ts`): the streaming path creates ONE placeholder assistant
 * message (`isStreaming: true`, :5928) and then grows it by MUTATION —
 * `text_delta` → `scheduleStreamFlush` → content, and `block` →
 * `updateMessage(msgId, { blocks })` (:5962-5985). Across EVERY one of those
 * commits `messages.length` is constant, `renderedMessageCount` is constant and
 * `isThinking` is constant — so the trigger is structurally incapable of
 * observing the arrival of the reply's body, its blocks, or its chips.
 *
 * That is why every case below MUTATES an existing message and keeps the array
 * length identical. An append-shaped test would pass at pristine and prove
 * nothing — the sibling spec `ChatThread.firstReplyScroll.spec.tsx` already
 * covers the append/reveal transitions and passes at pristine.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

const scrollIntoView = vi.fn()

/** Flush the rAF the content sensor coalesces on. */
async function flushFrames() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

function props(messages: ConversationMessage[], nodeCount = 12) {
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    nodeCount,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: vi.fn(),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
  } as unknown as React.ComponentProps<typeof ChatThread>
}

const userMsg = (id: string): ConversationMessage =>
  ({ id, role: 'user', content: 'Should we replace our CRM?' }) as ConversationMessage

/**
 * The assistant reply. `id` is FIXED by the caller and never derived from
 * content — the assertions below bind to the message BY IDENTITY, never by a
 * value predicate another message could satisfy (CLAUDE.md trap 19).
 */
const assistantMsg = (
  id: string,
  content: string,
  chips?: Array<Record<string, unknown>>,
): ConversationMessage =>
  ({
    id,
    role: 'assistant',
    content,
    isStreaming: false,
    ...(chips ? { actionChips: chips } : {}),
  }) as unknown as ConversationMessage

describe('ChatThread — content growing on an existing message is scrolled to', () => {
  beforeEach(() => {
    scrollIntoView.mockClear()
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scrolls when the reply BODY grows on the same message id — messages.length identical', async () => {
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender } = render(<ChatThread {...props(before)} />)
    await flushFrames()
    const scrollsBeforeGrowth = scrollIntoView.mock.calls.length

    // THE COMMIT THAT MATTERS: same id 'a1', body grows the way `text_delta`
    // grows it. Pin the defect's whole mechanism in-test rather than assuming
    // it (CLAUDE.md trap 13b — a discriminator must pin its own precondition).
    const after = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.\n\n' + 'x'.repeat(4000))]
    expect(after.length).toBe(before.length)
    expect(after[1].id).toBe(before[1].id)

    rerender(<ChatThread {...props(after)} />)
    await flushFrames()

    expect(
      scrollIntoView.mock.calls.length,
      'the reply body grew below the fold and nothing scrolled to it — the user is left ' +
        'looking at the top of a reply whose remainder, and whose chips, are off screen',
    ).toBeGreaterThan(scrollsBeforeGrowth)
  })

  it('scrolls when the CHIPS arrive on an already-rendered reply — the affordance the user needs', async () => {
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender } = render(<ChatThread {...props(before)} />)
    await flushFrames()
    const scrollsBeforeChips = scrollIntoView.mock.calls.length

    const after = [
      userMsg('u1'),
      assistantMsg('a1', 'Here is a first read.', [
        { id: 'run_analysis', label: 'Run analysis', intent: 'primary', message: 'Run the analysis' },
      ]),
    ]
    expect(after.length).toBe(before.length)
    expect(after[1].id).toBe(before[1].id)

    rerender(<ChatThread {...props(after)} />)
    await flushFrames()

    // Bind to the chip BY ITS OWN TESTID — never by index or by "the last
    // button", which another element could satisfy (CLAUDE.md trap 19).
    expect(
      document.querySelector('[data-testid="suggested-chip-run_analysis"]'),
      'precondition: the chip must actually be in the DOM, or this case proves nothing',
    ).not.toBeNull()

    expect(
      scrollIntoView.mock.calls.length,
      'the suggested chips landed and nothing scrolled to them — this is the "dead affordance": ' +
        'the chip works, the user simply cannot see it',
    ).toBeGreaterThan(scrollsBeforeChips)
  })

  it('does NOT scroll when the user has deliberately scrolled up — it raises the pill instead', async () => {
    // The courtesy twin, and the discriminating case. Without it, a sensor that
    // simply re-pinned on every mutation would satisfy both cases above while
    // stealing scroll from someone reading history — its own defect.
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender, getByTestId, queryByTestId } = render(<ChatThread {...props(before)} />)
    await flushFrames()

    const thread = getByTestId('chat-thread')
    // A container the user has scrolled well away from the bottom.
    Object.defineProperties(thread, {
      scrollTop: { value: 0, writable: true, configurable: true },
      clientHeight: { value: 400, configurable: true },
      scrollHeight: { value: 4000, configurable: true },
    })
    await act(async () => {
      thread.dispatchEvent(new Event('scroll'))
    })

    const scrollsAfterUserScrolledUp = scrollIntoView.mock.calls.length

    rerender(
      <ChatThread
        {...props([userMsg('u1'), assistantMsg('a1', 'Here is a first read.\n\n' + 'x'.repeat(4000))])}
      />,
    )
    await flushFrames()

    expect(
      scrollIntoView.mock.calls.length,
      'the thread yanked a reader who had deliberately scrolled up back to the bottom',
    ).toBe(scrollsAfterUserScrolledUp)
    expect(
      queryByTestId('new-messages-pill'),
      'nothing told the scrolled-up reader that new content had arrived',
    ).not.toBeNull()
  })
})
