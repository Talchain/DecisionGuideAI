/**
 * L-83 — the reveal re-pin (ISSUE-LEDGER, feedback-2026-08-16).
 *
 * THE WITNESSED DEFECT: "Post-timeout Retry button 100% unclickable — 0/121
 * hit-test points reach it (fully occluded by the chat composer)". Derived at
 * this tip, the mechanism is NOT z-order: a notice added while the thread is
 * HIDDEN (minimised floating panel `display:none`; collapsed dock tab) cannot
 * be scrolled to — `scrollIntoView` on a box-less container is a silent no-op
 * — and nothing re-pinned when the surface was revealed, so the newest
 * message and its controls laid out below the visible band, where every
 * hit-test point resolves to the composer strip that sits under the thread.
 *
 * THE FIX under test: `useSmartScroll` observes the scroll container with a
 * ResizeObserver; a 0 → >0 height transition (hidden boxes have zero size) is
 * the reveal, and it re-pins to the bottom INSTANTLY unless the user had
 * deliberately scrolled up.
 *
 * TRAP 3 HONESTY: jsdom cannot prove visibility or perform real hit-testing.
 * These tests pin the MECHANISM — the observer is attached to the real scroll
 * container (identity-bound via its testid), the reveal transition triggers
 * an instant bottom pin, and the user's deliberate scroll position is never
 * stolen. The occlusion itself needs the real-browser witness flagged in the
 * PR body.
 *
 * MUTANT PAIR (rider obligation): removing the reveal re-pin must RED the
 * first test; removing the scrolled-up guard must RED the second. Neither
 * alone shows binding — the pair does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

type ROCallback = (entries: Array<{ contentRect: { height: number } }>) => void

/** Capturing ResizeObserver: records observed elements, lets tests drive it. */
class CapturingResizeObserver {
  static instances: CapturingResizeObserver[] = []
  observed: Element[] = []
  callback: ROCallback
  constructor(cb: ROCallback) {
    this.callback = cb
    CapturingResizeObserver.instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve() {}
  disconnect() {}
}

const savedResizeObserver = global.ResizeObserver

function makeMessages(): ConversationMessage[] {
  return [
    {
      id: 'u1',
      role: 'user',
      content: 'Should we build or buy?',
      timestamp: new Date(),
    },
    {
      id: 'a1',
      role: 'assistant',
      synthetic: true,
      content: 'Drafting ended before your model values arrived.',
      timestamp: new Date(),
    },
  ] as ConversationMessage[]
}

function renderThread() {
  return render(
    <ChatThread
      messages={makeMessages()}
      isThinking={false}
      longRunningHint={null}
      nodeCount={5}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={async () => {}}
      onPatchAccept={() => {}}
      onPatchDismiss={() => {}}
      onFeedback={() => {}}
      onRetry={() => {}}
    />,
  )
}

/** The observer bound to the thread's scroll container — identity, not index. */
function observerForThread(threadEl: Element): CapturingResizeObserver {
  const bound = CapturingResizeObserver.instances.filter((i) =>
    i.observed.includes(threadEl),
  )
  // Exactly one owner: a second observer on the same container would mean a
  // second scroll authority.
  expect(bound).toHaveLength(1)
  return bound[0]
}

beforeEach(() => {
  CapturingResizeObserver.instances = []
  global.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  global.ResizeObserver = savedResizeObserver
})

describe('the reveal re-pin (L-83 mechanism)', () => {
  it('attaches a ResizeObserver to the scroll container and re-pins INSTANTLY on the hidden→visible transition', () => {
    renderThread()
    const threadEl = screen.getByTestId('chat-thread')
    const observer = observerForThread(threadEl)

    // Mount scrolling has happened (smooth, from the message effect); the
    // reveal pin must be a NEW, instant call. Reset to isolate it.
    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()

    // jsdom boxes are zero-height, which is exactly the hidden state:
    // lastHeight initialised to 0. Drive the reveal.
    act(() => {
      observer.callback([{ contentRect: { height: 420 } }])
    })

    const calls = (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(1)
    // Instant, never smooth: an animated flight on reveal is surprise motion.
    expect(calls[0][0]).toEqual({ behavior: 'auto' })

    // A later ordinary resize (visible → visible) must NOT re-pin — the pin
    // is licensed by the reveal transition only.
    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()
    act(() => {
      observer.callback([{ contentRect: { height: 500 } }])
    })
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('never steals the position of a user who deliberately scrolled up (the opposite-direction twin)', () => {
    renderThread()
    const threadEl = screen.getByTestId('chat-thread')
    const observer = observerForThread(threadEl)

    // Make the container report "scrolled up": far from the bottom.
    Object.defineProperty(threadEl, 'scrollTop', { value: 0, configurable: true })
    Object.defineProperty(threadEl, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(threadEl, 'clientHeight', { value: 100, configurable: true })
    fireEvent.scroll(threadEl)

    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()
    act(() => {
      observer.callback([{ contentRect: { height: 420 } }])
    })

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('positive control: without the scrolled-up state the same drive DOES pin — the twin above is not vacuous', () => {
    renderThread()
    const threadEl = screen.getByTestId('chat-thread')
    const observer = observerForThread(threadEl)

    // Same geometry, but NEAR the bottom (within the 60px threshold), so the
    // scroll event records "not scrolled up".
    Object.defineProperty(threadEl, 'scrollTop', { value: 940, configurable: true })
    Object.defineProperty(threadEl, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(threadEl, 'clientHeight', { value: 100, configurable: true })
    fireEvent.scroll(threadEl)

    ;(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear()
    act(() => {
      observer.callback([{ contentRect: { height: 420 } }])
    })

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
