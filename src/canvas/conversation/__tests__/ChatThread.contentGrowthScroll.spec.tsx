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
import { ChatThread, THREAD_SCROLL_SENTINEL_TESTID } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

/**
 * ⚠ WITHOUT THIS MOCK THIS FILE COLLECTS ZERO TESTS AND THE SUITE STAYS GREEN.
 *
 * `ChatThread` reaches `src/services/threadService.ts`, which imports
 * `src/lib/supabase.ts`, which THROWS at module scope when
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent (`supabase.ts:38`).
 * That is a COLLECTION-time failure, so none of the cases below exist to fail —
 * and in a multi-file run the aggregate total is dominated by files that did
 * collect, so a healthy-looking total and a zero-failure line are both fully
 * consistent with this file's entire scroll evidence never having run
 * (CLAUDE.md trap 2b). Measured on this branch before the mock was added: this
 * file and `threadMountIdentity.spec.tsx` both failed at collect.
 *
 * Mirrors the mock in the sibling `FloatingOlumiPanel.threadIdentity.spec.tsx`.
 * The COLLECTION GUARD below is the second half: the mock stops the file dying,
 * the guard makes a silent shrink impossible.
 */
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

/**
 * The stub is installed on `Element.prototype`, so EVERY element satisfies a
 * bare call-count assertion. Bind to the sentinel BY IDENTITY via the recorded
 * `this` of each call (CLAUDE.md trap 19) — counting calls proves a scroll
 * happened somewhere, never that it was aimed at the thread's end.
 *
 * ⚠ Captured HERE rather than read from `scrollIntoView.mock.contexts`: that
 * field is declared in @vitest/spy's TYPINGS but does not exist in the 1.6.1
 * RUNTIME this repo pins (`node_modules/.pnpm/@vitest+spy@1.6.1`, zero
 * occurrences in `dist/index.js`; the 3.2.4 copy that also sits in the store
 * does have it). Reading the wrong installed copy's `.d.ts` typechecks and
 * then throws at run time — so the context is recorded explicitly and the
 * assertion cannot depend on which copy resolves.
 */
const scrollTargets: unknown[] = []
const scrollIntoView = vi.fn(function (this: unknown) {
  scrollTargets.push(this)
})

function sentinelIn(root: ParentNode): Element {
  const el = root.querySelector(`[data-testid="${THREAD_SCROLL_SENTINEL_TESTID}"]`)
  expect(
    el,
    'precondition: the scroll sentinel is not in the DOM, so every assertion below would be vacuous',
  ).not.toBeNull()
  return el as Element
}

/** How many times the scroll was aimed at THIS element, not at any element. */
function scrollsTo(el: Element): number {
  return scrollTargets.filter((c) => c === el).length
}

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
    scrollTargets.length = 0
    Element.prototype.scrollIntoView = scrollIntoView
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * ⭐ COLLECTION GUARD — asserts this file's OWN cases by name.
   *
   * A suite total, an exit code and a zero-failure count are all consistent
   * with this file contributing nothing (CLAUDE.md trap 2b). This is a
   * hand-written list on purpose: it cannot be derived from the thing it
   * checks, and it FAILS LOUD if the set grows OR shrinks, which is the
   * sanctioned form of a mirror (trap 12).
   */
  it('COLLECTION GUARD — all four cases in this file were collected, by name', (ctx) => {
    const siblings = ctx.task.suite?.tasks ?? []
    const names = siblings.map((t) => t.name)
    expect(names).toEqual([
      'COLLECTION GUARD — all four cases in this file were collected, by name',
      'scrolls when the reply BODY grows on the same message id — messages.length identical',
      'scrolls when the CHIPS arrive on an already-rendered reply — the affordance the user needs',
      'does NOT scroll when the user has deliberately scrolled up — it raises the pill instead',
    ])
    // A skipped case is still COLLECTED, so the name list alone cannot see
    // one being quietly parked — measured: `it.skip` left the list identical
    // and the guard green. Assert the mode too, or the guard is narrower than
    // its own name (CLAUDE.md trap 13b — a guard agreeing with itself).
    expect(
      siblings.filter((t) => t.mode !== 'run').map((t) => t.name),
      'a case in this file is skipped/todo — it is collected but it is not evidence',
    ).toEqual([])
  })

  it('scrolls when the reply BODY grows on the same message id — messages.length identical', async () => {
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender, container } = render(<ChatThread {...props(before)} />)
    await flushFrames()
    const sentinel = sentinelIn(container)
    const scrollsBeforeGrowth = scrollsTo(sentinel)

    // THE COMMIT THAT MATTERS: same id 'a1', body grows the way `text_delta`
    // grows it. Pin the defect's whole mechanism in-test rather than assuming
    // it (CLAUDE.md trap 13b — a discriminator must pin its own precondition).
    const after = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.\n\n' + 'x'.repeat(4000))]
    expect(after.length).toBe(before.length)
    expect(after[1].id).toBe(before[1].id)

    rerender(<ChatThread {...props(after)} />)
    await flushFrames()

    // The sentinel is the SAME DOM node across the rerender (React reuses it),
    // so this is a before/after count on one identified element.
    expect(sentinelIn(container)).toBe(sentinel)
    expect(
      scrollsTo(sentinel),
      'the reply body grew below the fold and nothing scrolled to the thread end — the user is left ' +
        'looking at the top of a reply whose remainder, and whose chips, are off screen',
    ).toBeGreaterThan(scrollsBeforeGrowth)
  })

  it('scrolls when the CHIPS arrive on an already-rendered reply — the affordance the user needs', async () => {
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender, container } = render(<ChatThread {...props(before)} />)
    await flushFrames()
    const sentinel = sentinelIn(container)
    const scrollsBeforeChips = scrollsTo(sentinel)

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
    // ⚠ Scoped to THIS thread's container, not the document. `suggested-chip-*`
    // testids are built from chip data alone and are NOT split per host (see
    // the mount-identity note in `zones/ChatThread.tsx`), so a document-wide
    // query for one is ambiguous the moment a second thread is mounted.
    expect(
      container.querySelector('[data-testid="suggested-chip-run_analysis"]'),
      'precondition: the chip must actually be in the DOM, or this case proves nothing',
    ).not.toBeNull()

    expect(sentinelIn(container)).toBe(sentinel)
    expect(
      scrollsTo(sentinel),
      'the suggested chips landed and nothing scrolled to the thread end — this is the "dead affordance": ' +
        'the chip works, the user simply cannot see it',
    ).toBeGreaterThan(scrollsBeforeChips)
  })

  it('does NOT scroll when the user has deliberately scrolled up — it raises the pill instead', async () => {
    // The courtesy twin, and the discriminating case. Without it, a sensor that
    // simply re-pinned on every mutation would satisfy both cases above while
    // stealing scroll from someone reading history — its own defect.
    const before = [userMsg('u1'), assistantMsg('a1', 'Here is a first read.')]
    const { rerender, getByTestId, queryByTestId, container } = render(<ChatThread {...props(before)} />)
    await flushFrames()
    const sentinel = sentinelIn(container)

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

    const scrollsAfterUserScrolledUp = scrollsTo(sentinel)

    rerender(
      <ChatThread
        {...props([userMsg('u1'), assistantMsg('a1', 'Here is a first read.\n\n' + 'x'.repeat(4000))])}
      />,
    )
    await flushFrames()

    expect(sentinelIn(container)).toBe(sentinel)
    expect(
      scrollsTo(sentinel),
      'the thread yanked a reader who had deliberately scrolled up back to the bottom',
    ).toBe(scrollsAfterUserScrolledUp)
    expect(
      queryByTestId('new-messages-pill'),
      'nothing told the scrolled-up reader that new content had arrived',
    ).not.toBeNull()
  })
})
