/**
 * ChatThread — a new assistant reply taller than the thread lands at its START.
 *
 * THE DEFECT (served evidence, `witness/ai-conversation-local`,
 * `e2e/ai-conversation/evidence/09-prb-run-reply-1280x800-as-arrived.png`): a
 * long Run reply arrived and the thread pinned to its BOTTOM, so the reply's
 * first sentence — its conclusion — was above the fold. The product brief is
 * "After a Run, show the useful conclusion … immediately."
 *
 * ⚠ WHAT THIS SPEC CAN AND CANNOT PROVE. jsdom has no layout (CLAUDE.md trap
 * 3). This file supplies a small, explicit layout model — the thread's
 * `clientHeight` / `scrollHeight` / box, each message's content offset, and a
 * `scrollIntoView` that pins the thread to its bottom the way a browser does —
 * and proves the DECISION made against that geometry: which `scrollTop` the
 * thread is given, and whether the end sentinel is scrolled to. That the first
 * sentence is really on screen in a real browser is claimed only by the served
 * witness (`e2e/ai-conversation/prbRunReply.witness.measure.ts`, "reply start
 * in view").
 *
 * The browser fires `scroll` after a programmatic scroll; jsdom does not. Where
 * a case depends on the thread seeing its own scroll event, it dispatches one,
 * and says so.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { ChatThread, THREAD_SCROLL_SENTINEL_TESTID, THREAD_TESTID_DOCKED } from '../zones/ChatThread'
import { MESSAGE_ID_ATTRIBUTE } from '../hooks/useSmartScroll'
import type { ConversationMessage } from '../types'

/** `ChatThread` reaches `lib/supabase`, which throws at collect without env (see the sibling specs). */
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

// ── The layout model ────────────────────────────────────────────────────────

/** Viewport y of the thread's top edge. Any value works; it must cancel out. */
const THREAD_TOP = 137
/** `REPLY_START_GAP_PX` in the hook: the reply's first line sits this far below the thread's top. */
const GAP = 12

interface Layout {
  /** The thread's visible height. 0 = hidden (`display: none`). */
  clientHeight: number
  /** The thread's full content height. */
  contentHeight: number
  /** Each message's top, in content coordinates (0 = top of the scrolled content). */
  offsets: Record<string, number>
}
let layout: Layout

const threadOf = (el: Element): HTMLElement | null =>
  el.closest(`[data-testid="${THREAD_TESTID_DOCKED}"]`) as HTMLElement | null
const isThread = (el: Element) => el.getAttribute('data-testid') === THREAD_TESTID_DOCKED
const bottomTop = () => Math.max(0, layout.contentHeight - layout.clientHeight)
const box = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON() {} }) as DOMRect

/** Every scroll aimed at an element, with its options — bound by identity, never counted globally (trap 19). */
let scrollCalls: Array<{ target: Element; opts: unknown }> = []

const saved = {
  scrollIntoView: Element.prototype.scrollIntoView,
  getBoundingClientRect: Element.prototype.getBoundingClientRect,
  ResizeObserver: global.ResizeObserver,
}

function installLayout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (isThread(this)) return box(THREAD_TOP, layout.clientHeight)
    const id = this.getAttribute(MESSAGE_ID_ATTRIBUTE)
    const thread = threadOf(this)
    if (id !== null && thread && id in layout.offsets && layout.clientHeight > 0) {
      return box(THREAD_TOP + layout.offsets[id] - thread.scrollTop, 40)
    }
    return box(0, 0)
  }
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isThread(this) ? layout.clientHeight : 0
    },
  })
  // A hidden thread (`display: none`) has no layout: its scrollHeight is 0 too.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isThread(this) && layout.clientHeight > 0 ? layout.contentHeight : 0
    },
  })
  // The browser's pin: the zero-height end sentinel, scrolled into view, takes
  // the thread to its bottom. A hidden thread has no box and does not move.
  Element.prototype.scrollIntoView = function (this: Element, opts?: unknown) {
    scrollCalls.push({ target: this, opts })
    const thread = threadOf(this)
    if (this.getAttribute('data-testid') === THREAD_SCROLL_SENTINEL_TESTID && thread && layout.clientHeight > 0) {
      thread.scrollTop = bottomTop()
    }
  }
}

function uninstallLayout() {
  Element.prototype.scrollIntoView = saved.scrollIntoView
  Element.prototype.getBoundingClientRect = saved.getBoundingClientRect
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
  global.ResizeObserver = saved.ResizeObserver
}

// ── The thread ──────────────────────────────────────────────────────────────

const user = (id: string): ConversationMessage =>
  ({ id, role: 'user', content: 'Run the analysis', timestamp: new Date() }) as ConversationMessage
const reply = (id: string, content = 'Here is what the run says.', extra: Partial<ConversationMessage> = {}) =>
  ({ id, role: 'assistant', content, timestamp: new Date(), ...extra }) as ConversationMessage
const divider = (id: string) =>
  ({ id, role: 'assistant', content: '', synthetic: true, sessionDivider: 'Session resumed', timestamp: new Date() }) as ConversationMessage

function props(messages: ConversationMessage[], isThinking = false) {
  return {
    messages,
    isThinking,
    longRunningHint: null,
    nodeCount: 12,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: vi.fn(),
    onPatchAccept: vi.fn(),
    onPatchDismiss: vi.fn(),
    onFeedback: vi.fn(),
    onRetry: vi.fn(),
  } as unknown as React.ComponentProps<typeof ChatThread>
}

/** Let the MutationObserver microtask and every effect run. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
  })
}

function mountThread(messages: ConversationMessage[], isThinking = false) {
  const utils = render(<ChatThread {...props(messages, isThinking)} />)
  const thread = utils.getByTestId(THREAD_TESTID_DOCKED)
  const sentinel = utils.getByTestId(THREAD_SCROLL_SENTINEL_TESTID)
  const sentinelScrolls = () => scrollCalls.filter((c) => c.target === sentinel).length
  const pill = () => utils.queryByTestId('new-messages-pill')
  const update = async (next: ConversationMessage[], thinking = false) => {
    utils.rerender(<ChatThread {...props(next, thinking)} />)
    await flush()
  }
  /** The browser fires `scroll` after any scroll; jsdom does not, so a case that needs it fires it. */
  const browserScrollEvent = async () => {
    await act(async () => {
      fireEvent.scroll(thread)
    })
  }
  const userScrollsTo = async (top: number) => {
    thread.scrollTop = top
    await browserScrollEvent()
  }
  return { ...utils, thread, sentinel, sentinelScrolls, pill, update, browserScrollEvent, userScrollsTo }
}

/**
 * The turn up to the moment the reply lands: an earlier exchange, then the
 * user's "Run the analysis", with the thread following to the bottom.
 * Geometry: a 600 px thread; content 1000 px tall; the reply will start at 1000.
 */
async function beforeTheReply() {
  layout = { clientHeight: 600, contentHeight: 1000, offsets: { u1: 0, a1: 150, u2: 900 } }
  const t = mountThread([user('u1'), reply('a1'), user('u2')], true)
  await flush()
  expect(t.thread.scrollTop, 'precondition: the thread followed the user\'s send to the bottom').toBe(400)
  await t.browserScrollEvent()
  expect(t.pill(), 'precondition: no pill at the bottom').toBeNull()
  return t
}

const LONG_REPLY_START = 1000
/** The scrollTop that puts the long reply's first line at the top of the thread. */
const HELD = LONG_REPLY_START - GAP

/** The long reply lands: 1,400 px of it in a 600 px thread. */
async function longReplyLands(t: Awaited<ReturnType<typeof beforeTheReply>>) {
  layout.offsets.a2 = LONG_REPLY_START
  layout.contentHeight = LONG_REPLY_START + 1400
  await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'This run can’t yet say which path to take…')])
}

describe('ChatThread — a reply taller than the thread lands at its start', () => {
  beforeEach(() => {
    scrollCalls = []
    installLayout()
  })
  afterEach(() => {
    uninstallLayout()
  })

  /** COLLECTION GUARD — this file's own cases, by name, and none skipped (trap 2b / 13b). */
  it('COLLECTION GUARD — every case in this file was collected, by name, and none is skipped', (ctx) => {
    const siblings = ctx.task.suite?.tasks ?? []
    expect(siblings.map((t) => t.name)).toEqual([
      'COLLECTION GUARD — every case in this file was collected, by name, and none is skipped',
      '(a) a long new reply: the thread goes to the reply\'s first line, not to the bottom',
      '(a) timing: rendered the way a browser schedules it (no act), the reply still lands at its start',
      '(a) …and stays there while the same reply grows (chips land), with no "New messages" pill',
      '(b) a short reply that fits: the thread pins to the bottom, as before',
      '(c) the user\'s own send pins to the bottom, even when it is taller than the thread',
      '(c) a send and a reply appended in ONE commit still pin to the bottom — the send decides',
      '(c) …and a send after a held reply releases the hold and goes to the bottom',
      '(d) the user scrolled up: a long reply does not move them, the pill is raised, and the pill still goes to the bottom',
      '(e) restore: mounting with a transcript whose last reply is long pins to the bottom',
      '(e) restore: a transcript loaded into an empty thread pins to the bottom',
      '(e) restore: a transcript that REPLACES the list (scenario switch) pins to the bottom',
      'never fights the reader: a reader a little way into the reply is not pulled back to its start',
      'never fights the reader: a reader in the middle of the reply is not moved, and growth raises the pill as before',
      'the reader scrolls to the bottom of the reply: the hold is released and new content is followed again',
      'hidden when the reply lands: revealing the thread brings the reply\'s start into view',
    ])
    expect(siblings.filter((t) => t.mode !== 'run').map((t) => t.name)).toEqual([])
  })

  it('(a) a long new reply: the thread goes to the reply\'s first line, not to the bottom', async () => {
    const t = await beforeTheReply()
    const pinsBefore = t.sentinelScrolls()

    await longReplyLands(t)

    expect(
      t.thread.scrollTop,
      'the reply\'s first line must sit at the top of the thread — at the bottom, the conclusion is above the fold',
    ).toBe(HELD)
    expect(t.sentinelScrolls(), 'nothing may pin the thread to its bottom when the reply lands').toBe(pinsBefore)
    // The geometry proves the claim, not the arithmetic: the reply's box is at the thread's top.
    const replyEl = t.container.querySelector(`[${MESSAGE_ID_ATTRIBUTE}="a2"]`) as Element
    expect(replyEl, 'precondition: the reply is in the DOM with its id').not.toBeNull()
    expect(replyEl.getBoundingClientRect().top - THREAD_TOP).toBe(GAP)
    expect(t.pill()).toBeNull()
  })

  it('(a) timing: rendered the way a browser schedules it (no act), the reply still lands at its start', async () => {
    // Under RTL's act() React flushes passive effects before the
    // MutationObserver's microtask runs. A browser does not promise that. A
    // reply arrives from the network as a default-priority update; React's
    // scheduler runs its passive effects as a separate task, and once the
    // render has used its 5 ms slice the scheduler yields first — so the
    // microtask pins before any passive effect runs. Reproduce that here:
    // render outside act, with a clock that says every slice is used up.
    let clock = performance.now()
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 6))
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const actEnv = g.IS_REACT_ACT_ENVIRONMENT
    g.IS_REACT_ACT_ENVIRONMENT = false
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const settle = async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 10))
    }
    try {
      layout = { clientHeight: 600, contentHeight: 1000, offsets: { u1: 0, a1: 150, u2: 900 } }
      root.render(<ChatThread {...props([user('u1'), reply('a1'), user('u2')], true)} />)
      await settle()
      const thread = host.querySelector(`[data-testid="${THREAD_TESTID_DOCKED}"]`) as HTMLElement
      expect(thread.scrollTop, 'precondition: at the bottom before the reply').toBe(400)

      layout.offsets.a2 = LONG_REPLY_START
      layout.contentHeight = LONG_REPLY_START + 1400
      root.render(<ChatThread {...props([user('u1'), reply('a1'), user('u2'), reply('a2')], false)} />)
      await settle()

      expect(thread.scrollTop).toBe(HELD)
    } finally {
      root.unmount()
      host.remove()
      g.IS_REACT_ACT_ENVIRONMENT = actEnv
    }
  })

  it('(a) …and stays there while the same reply grows (chips land), with no "New messages" pill', async () => {
    const t = await beforeTheReply()
    await longReplyLands(t)
    // The browser reports the hold's own scroll. It must not read as "scrolled up".
    await t.browserScrollEvent()
    const pinsBefore = t.sentinelScrolls()

    layout.contentHeight += 120
    await t.update([
      user('u1'),
      reply('a1'),
      user('u2'),
      reply('a2', 'This run can’t yet say which path to take…', {
        actionChips: [{ id: 'explain', label: 'Explain the model', intent: 'secondary', message: 'Explain the model' }],
      } as Partial<ConversationMessage>),
    ])

    expect(t.container.querySelector('[data-testid="suggested-chip-explain"]'), 'precondition: the chip rendered').not.toBeNull()
    expect(t.thread.scrollTop, 'growth below the reader must not move them off the reply\'s start').toBe(HELD)
    expect(t.sentinelScrolls()).toBe(pinsBefore)
    expect(t.pill(), 'the reader is where the thread put them; there are no new messages to announce').toBeNull()
  })

  it('(b) a short reply that fits: the thread pins to the bottom, as before', async () => {
    const t = await beforeTheReply()
    const pinsBefore = t.sentinelScrolls()

    // 250 px of reply: from its start to the end of the content is 350 px, inside a 600 px thread.
    layout.offsets.a2 = LONG_REPLY_START
    layout.contentHeight = LONG_REPLY_START + 350
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'Short answer.')])

    expect(t.sentinelScrolls(), 'a reply that fits is pinned to the bottom exactly as before').toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
    // …and the pin did not cut off its first line.
    expect(bottomTop()).toBeLessThanOrEqual(HELD)
  })

  it('(c) the user\'s own send pins to the bottom, even when it is taller than the thread', async () => {
    layout = { clientHeight: 600, contentHeight: 900, offsets: { u1: 0, a1: 150 } }
    const t = mountThread([user('u1'), reply('a1')])
    await flush()
    await t.browserScrollEvent()
    const pinsBefore = t.sentinelScrolls()

    layout.offsets.u2 = 900
    layout.contentHeight = 900 + 1400
    await t.update([user('u1'), reply('a1'), user('u2')], true)

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop, 'the user\'s own message is followed to the bottom').toBe(bottomTop())
  })

  it('(c) a send and a reply appended in ONE commit still pin to the bottom — the send decides', async () => {
    layout = { clientHeight: 600, contentHeight: 900, offsets: { u1: 0, a1: 150 } }
    const t = mountThread([user('u1'), reply('a1')])
    await flush()
    await t.browserScrollEvent()
    const pinsBefore = t.sentinelScrolls()

    layout.offsets.u2 = 900
    layout.offsets.a2 = 980
    layout.contentHeight = 980 + 1400
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'An immediate long answer…')])

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('(c) …and a send after a held reply releases the hold and goes to the bottom', async () => {
    const t = await beforeTheReply()
    await longReplyLands(t)
    await t.browserScrollEvent()
    expect(t.thread.scrollTop, 'precondition: held at the reply start').toBe(HELD)
    const pinsBefore = t.sentinelScrolls()

    layout.offsets.u3 = layout.contentHeight
    layout.contentHeight += 80
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2'), user('u3')], true)

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('(d) the user scrolled up: a long reply does not move them, the pill is raised, and the pill still goes to the bottom', async () => {
    const t = await beforeTheReply()
    await t.userScrollsTo(0)
    const pinsBefore = t.sentinelScrolls()

    await longReplyLands(t)

    expect(t.thread.scrollTop, 'a reader of history is never moved').toBe(0)
    expect(t.sentinelScrolls()).toBe(pinsBefore)
    expect(t.pill(), 'the reader must be told something arrived').not.toBeNull()

    // The pill's own action is unchanged: the user asked for the bottom.
    const callsBeforePill = scrollCalls.length
    await act(async () => {
      fireEvent.click(t.pill() as HTMLElement)
    })
    const pillScrolls = scrollCalls.slice(callsBeforePill).filter((c) => c.target === t.sentinel)
    expect(pillScrolls[0]?.opts, 'the pill scrolls the end sentinel, smoothly, as before').toEqual({ behavior: 'smooth' })
    expect(t.thread.scrollTop).toBe(bottomTop())
    expect(t.pill()).toBeNull()

    // After asking for the bottom, later growth keeps following the bottom —
    // the pill released the hold rather than leaving it to pull them back up.
    // No scroll event is fired first, on purpose: the pill's flight is smooth,
    // and content can land before it ends.
    const pinsAfterPill = t.sentinelScrolls()
    layout.contentHeight += 120
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'This run can’t yet say which path to take… (more)')])
    expect(t.sentinelScrolls()).toBeGreaterThan(pinsAfterPill)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('(e) restore: mounting with a transcript whose last reply is long pins to the bottom', async () => {
    layout = { clientHeight: 600, contentHeight: 3000, offsets: { u1: 0, a1: 400 } }
    const t = mountThread([user('u1'), reply('a1', 'A long restored reply…'), divider('b1')])
    await flush()

    expect(t.sentinelScrolls()).toBeGreaterThan(0)
    expect(t.thread.scrollTop, 'a restored transcript opens at its end, as before').toBe(bottomTop())
  })

  it('(e) restore: a transcript loaded into an empty thread pins to the bottom', async () => {
    layout = { clientHeight: 600, contentHeight: 0, offsets: {} }
    const t = mountThread([])
    await flush()
    const pinsBefore = t.sentinelScrolls()

    layout.offsets = { u1: 0, a1: 400 }
    layout.contentHeight = 3000
    await t.update([user('u1'), reply('a1', 'A long restored reply…'), divider('b1')])

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('(e) restore: a transcript that REPLACES the list (scenario switch) pins to the bottom', async () => {
    layout = { clientHeight: 600, contentHeight: 900, offsets: { x1: 0, y1: 150 } }
    const t = mountThread([user('x1'), reply('y1')])
    await flush()
    await t.browserScrollEvent()
    const pinsBefore = t.sentinelScrolls()

    // The other decision's history: no user message in it, and it opens with a
    // rendered reply (a session divider carries no message id), so only the
    // "the previous newest message is gone" rule can tell it from an arrival.
    layout.offsets = { a8: 0, a9: 60 }
    layout.contentHeight = 3000
    await t.update([reply('a8', 'An earlier note.'), reply('a9', 'A long reply from the other decision…')])

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('never fights the reader: a reader a little way into the reply is not pulled back to its start', async () => {
    const t = await beforeTheReply()
    await longReplyLands(t)
    await t.userScrollsTo(HELD + 40)

    layout.contentHeight += 120
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'This run can’t yet say which path to take… (more)')])

    expect(t.thread.scrollTop, 'the hold moves the reader forward only, never back').toBe(HELD + 40)
    expect(t.pill()).toBeNull()
  })

  it('never fights the reader: a reader in the middle of the reply is not moved, and growth raises the pill as before', async () => {
    const t = await beforeTheReply()
    await longReplyLands(t)
    const middle = HELD + 500
    await t.userScrollsTo(middle)
    const pinsBefore = t.sentinelScrolls()

    layout.contentHeight += 120
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'This run can’t yet say which path to take… (more)')])

    expect(t.thread.scrollTop).toBe(middle)
    expect(t.sentinelScrolls()).toBe(pinsBefore)
    expect(t.pill(), 'away from both the reply start and the bottom, the old courtesy rule applies').not.toBeNull()
  })

  it('the reader scrolls to the bottom of the reply: the hold is released and new content is followed again', async () => {
    const t = await beforeTheReply()
    await longReplyLands(t)
    await t.userScrollsTo(bottomTop())
    const pinsBefore = t.sentinelScrolls()

    layout.contentHeight += 120
    await t.update([user('u1'), reply('a1'), user('u2'), reply('a2', 'This run can’t yet say which path to take… (more)')])

    expect(t.sentinelScrolls()).toBeGreaterThan(pinsBefore)
    expect(t.thread.scrollTop).toBe(bottomTop())
  })

  it('hidden when the reply lands: revealing the thread brings the reply\'s start into view', async () => {
    // The dock can hide the Olumi tab while a Run is in flight. A hidden thread
    // has no box, so nothing can be measured or scrolled when the reply lands;
    // the reveal re-pin (sensor 2) is where the hold must take effect.
    type Entry = { contentRect: { height: number } }
    const observers: Array<{ el: Element | null; cb: (e: Entry[]) => void }> = []
    global.ResizeObserver = class {
      private rec: { el: Element | null; cb: (e: Entry[]) => void }
      constructor(cb: (e: Entry[]) => void) {
        this.rec = { el: null, cb }
        observers.push(this.rec)
      }
      observe(el: Element) {
        this.rec.el = el
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver

    const t = await beforeTheReply()
    const threadObserver = observers.filter((o) => o.el === t.thread)
    expect(threadObserver, 'exactly one observer watches the thread').toHaveLength(1)

    layout.clientHeight = 0 // the tab is hidden
    act(() => {
      threadObserver[0].cb([{ contentRect: { height: 0 } }])
    })
    await longReplyLands(t)
    expect(t.thread.scrollTop, 'precondition: a hidden thread did not move').toBe(400)

    layout.clientHeight = 600 // the tab is shown again
    act(() => {
      threadObserver[0].cb([{ contentRect: { height: 600 } }])
    })

    expect(t.thread.scrollTop, 'the reveal must land on the reply\'s first line, not its end').toBe(HELD)
  })
})
