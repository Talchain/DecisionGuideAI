/**
 * ChatThread — the dialogue stays put while a turn is in flight (Paul, 7 Oct 2026).
 *
 * SPEC, in Paul's words: "the text doesn't move. You can still look at your
 * dialogue while it's loading. It shouldn't go blank or do anything weird."
 * Nothing on the thread changes during a pending turn except the existing
 * thinking indicator, and when the reply lands the messages already on screen
 * are the SAME elements they were — appended to, never rebuilt.
 *
 * Every assertion binds by IDENTITY: the DOM node of a message found by its
 * `data-message-id`, compared with `toBe` across renders. A value predicate
 * ("some assistant message is present") would be satisfied by a remounted
 * copy, which is exactly the defect.
 *
 * ⚠ What jsdom cannot prove: pixels. A remount is the mechanism behind a
 * flash, a lost "show more" state and a re-run of entry animations; whether a
 * given remount is VISIBLE is a real-browser question, recorded in the PR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ChatThread, THREAD_TESTID_DOCKED, THREAD_SCROLL_SENTINEL_TESTID } from '../zones/ChatThread'
import { WAITING_LINE_MS } from '../zones/ThinkingDots'
import { MESSAGE_ID_ATTRIBUTE } from '../hooks/useSmartScroll'
import type { ConversationMessage, ActionChip } from '../types'

// `ChatThread` reaches `src/lib/supabase.ts`, which throws at module scope
// without env (sibling spec ChatThread.contentGrowthScroll.spec.tsx) — a
// collection-time failure would make every row below vanish silently.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector({ nodes: [], edges: [] }),
    { getState: () => ({ nodes: [], edges: [] }), setState: vi.fn(), subscribe: vi.fn() },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => any) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))

// Each scroll is recorded with its target, so a row can say WHICH element was
// scrolled to (the thread's end sentinel), never just "something scrolled".
const scrollTargets: unknown[] = []
beforeEach(() => {
  scrollTargets.length = 0
  Element.prototype.scrollIntoView = vi.fn(function (this: unknown) {
    scrollTargets.push(this)
  })
})

/** Let the thread's MutationObserver callbacks and effects run. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

/** Make the thread a reader has scrolled well up from the bottom of (reading history). */
async function scrollReaderUp(thread: HTMLElement) {
  Object.defineProperties(thread, {
    scrollTop: { value: 100, writable: true, configurable: true },
    clientHeight: { value: 400, configurable: true },
    scrollHeight: { value: 4000, configurable: true },
  })
  await act(async () => {
    thread.dispatchEvent(new Event('scroll'))
  })
}

function scrollsToEnd(): number {
  const sentinel = screen.getByTestId(THREAD_SCROLL_SENTINEL_TESTID)
  return scrollTargets.filter((t) => t === sentinel).length
}

const t0 = new Date('2026-10-07T09:00:00Z')
const chip: ActionChip = { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', intent: 'secondary', message: 'Run a pre-mortem' }

const reply1: ConversationMessage = {
  id: 'a1', role: 'assistant', content: 'First reply about hiring a tech lead.', timestamp: t0, actionChips: [chip],
}
const ask1: ConversationMessage = { id: 'u1', role: 'user', content: 'Suggest risks I have not considered.', timestamp: t0 }
const reply2: ConversationMessage = {
  id: 'a2', role: 'assistant', content: 'Four more risks to test.', timestamp: t0, actionChips: [chip],
}
const reply1NoChips: ConversationMessage = { ...reply1, actionChips: undefined }

function props(messages: ConversationMessage[], isThinking: boolean) {
  return {
    messages,
    isThinking,
    longRunningHint: null,
    nodeCount: 3,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: vi.fn().mockResolvedValue(undefined),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
  }
}

/** The message's root element, found by its id: the identity every row binds to. */
function messageNode(id: string): HTMLElement {
  const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
  const el = thread.querySelector<HTMLElement>(`[${MESSAGE_ID_ATTRIBUTE}="${id}"]`)
  if (!el) throw new Error(`message ${id} is not in the thread`)
  return el
}

describe('ChatThread: the dialogue is stable while a turn is in flight', () => {
  it('pending: every message already on screen stays the SAME element, with its text, and the only addition is the thinking indicator', () => {
    const { rerender } = render(<ChatThread {...props([reply1], false)} />)
    const a1 = messageNode('a1')
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    expect(screen.queryByTestId('thinking-indicator')).toBeNull()

    // The user sends: their message is appended and the turn goes pending.
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    const u1 = messageNode('u1')
    expect(messageNode('a1'), 'the previous reply was rebuilt when the turn went pending').toBe(a1)
    expect(a1.isConnected).toBe(true)
    expect(a1.textContent).toContain('First reply about hiring a tech lead.')
    expect(screen.getByTestId(THREAD_TESTID_DOCKED), 'the thread container itself was rebuilt').toBe(thread)
    expect(screen.getByTestId('thinking-indicator')).toBeInTheDocument()

    // Still pending on a later commit (e.g. the waiting line rotates): nothing moves.
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    expect(messageNode('a1')).toBe(a1)
    expect(messageNode('u1')).toBe(u1)
  })

  it('pending → complete: the reply is APPENDED; the previous reply and the user message are the same elements as before', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    const a1 = messageNode('a1')
    const u1 = messageNode('u1')

    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    expect(messageNode('a1'), 'the previous reply was rebuilt when the new reply landed').toBe(a1)
    expect(messageNode('u1')).toBe(u1)
    expect(a1.isConnected).toBe(true)
    expect(messageNode('a2').textContent).toContain('Four more risks to test.')
    expect(screen.queryByTestId('thinking-indicator')).toBeNull()
  })

  it('control: a previous reply that carried NO chips was never wrapped, and also stays the same element', () => {
    // Contrast for the row above: a reply with no chip group had no wrapper to
    // lose, so it must pass on base and after the fix alike.
    const { rerender } = render(<ChatThread {...props([reply1NoChips, ask1], true)} />)
    const a1 = messageNode('a1')
    rerender(<ChatThread {...props([reply1NoChips, ask1, reply2], false)} />)
    expect(messageNode('a1')).toBe(a1)
  })

  it('the reader\'s scroll position is not reset through pending → complete', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], false)} />)
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    thread.scrollTop = 140
    rerender(<ChatThread {...props([reply1, ask1], true)} />)
    expect(screen.getByTestId(THREAD_TESTID_DOCKED)).toBe(thread)
    expect(thread.scrollTop).toBe(140)
    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    expect(screen.getByTestId(THREAD_TESTID_DOCKED)).toBe(thread)
    expect(thread.scrollTop).toBe(140)
  })

  it('the chip group still wraps ONLY the latest reply after the reply lands (existing contract kept)', () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    const groups = screen.getAllByTestId('response-chip-group')
    expect(groups).toHaveLength(1)
    expect(groups[0].contains(messageNode('a2'))).toBe(true)
    expect(groups[0].contains(messageNode('a1'))).toBe(false)
  })

  it('a reader scrolled up to read is not moved, and is not told "New messages", while only the waiting line changes', async () => {
    // The waiting line is the one thing allowed to change during a pending
    // turn. On base it counted as new content: the thread's content sensor
    // raised the "New messages" pill over the text the reader was reading
    // (or snapped a near-bottom reader down) every 5 s.
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    await flush()
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    await scrollReaderUp(thread)
    const scrollsBefore = scrollsToEnd()

    // (1) the elapsed-time hint is rewritten ("…20s"), as useConversation does every 5 s after 15 s
    rerender(<ChatThread {...{ ...props([reply1, ask1], true), longRunningHint: 'Thinking... 20s' }} />)
    await flush()
    expect(screen.getByTestId('thinking-indicator').textContent).toContain('20s')
    expect(screen.queryByTestId('new-messages-pill'), 'the waiting line raised a false "New messages" pill').toBeNull()
    expect(scrollsToEnd(), 'the waiting line moved the reader').toBe(scrollsBefore)
    expect(thread.scrollTop).toBe(100)
  })

  it('a reader scrolled up is not moved while the run\'s coaching line rotates', async () => {
    vi.useFakeTimers()
    try {
      render(<ChatThread {...{ ...props([reply1, ask1], true), analysisRunning: true }} />)
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
      await scrollReaderUp(thread)
      const line = screen.getByTestId('thinking-coaching-line').textContent
      const scrollsBefore = scrollsToEnd()
      await act(async () => { await vi.advanceTimersByTimeAsync(WAITING_LINE_MS) })
      expect(screen.getByTestId('thinking-coaching-line').textContent, 'precondition: the line rotated').not.toBe(line)
      expect(screen.queryByTestId('new-messages-pill'), 'the rotating line raised a false "New messages" pill').toBeNull()
      expect(scrollsToEnd()).toBe(scrollsBefore)
      expect(thread.scrollTop).toBe(100)
    } finally {
      vi.useRealTimers()
    }
  })

  it('control: when the REPLY lands, a scrolled-up reader still gets the "New messages" pill and is not moved', async () => {
    const { rerender } = render(<ChatThread {...props([reply1, ask1], true)} />)
    await flush()
    const thread = screen.getByTestId(THREAD_TESTID_DOCKED)
    await scrollReaderUp(thread)
    const scrollsBefore = scrollsToEnd()
    rerender(<ChatThread {...props([reply1, ask1, reply2], false)} />)
    await flush()
    expect(screen.queryByTestId('new-messages-pill'), 'new content arrived and the reader was not told').not.toBeNull()
    expect(scrollsToEnd()).toBe(scrollsBefore)
    expect(thread.scrollTop).toBe(100)
  })
})
