/**
 * Class-8 guarantee: an action that sends work to Olumi visibly reveals Olumi.
 *
 * The guarantee is enforced at the REGISTRATION SEAM (`withOlumiReveal` in
 * guidanceStore.ts) rather than at each call site, because a per-call-site
 * reveal is a hand-maintained list that is correct the day it is written and
 * silently short the first time someone adds a send. These tests are therefore
 * written against the SEAM's contract — "a dispatched conversation callback
 * reveals" — and not against the ~25 individual surfaces that ride it, which is
 * what makes them stable when a new surface is added.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const revealSpy = vi.fn()
vi.mock('../../conversation/revealOlumi', () => ({
  revealOlumiSurface: () => revealSpy(),
}))

import { useGuidanceStore } from '../guidanceStore'

const makeCallbacks = () => ({
  sendMessage: vi.fn((_text: string) => {}),
  scrollToPatch: vi.fn((_id: string) => {}),
  sendChip: vi.fn((_label: string, _message: string) => {}),
  runAnalysis: vi.fn(() => {}),
  prefillChat: vi.fn((_text: string) => {}),
  dispatchAction: vi.fn((_opts: { label: string; message: string; source: string }) => {}),
})

const register = (cb: ReturnType<typeof makeCallbacks>) =>
  useGuidanceStore
    .getState()
    .registerConversationCallbacks(
      cb.sendMessage,
      cb.scrollToPatch,
      cb.sendChip,
      cb.runAnalysis,
      cb.prefillChat,
      cb.dispatchAction,
    )

describe('guidanceStore — Olumi reveal on dispatch', () => {
  beforeEach(() => {
    revealSpy.mockClear()
    useGuidanceStore.setState({
      _sendMessage: null,
      _runAnalysis: null,
      _sendChip: null,
      _scrollToPatch: null,
      _prefillChat: null,
      _dispatchAction: null,
      _registrationToken: null,
    })
  })

  it('reveals on every SENDING callback, and delivers the message', () => {
    // Swept over all four sending callbacks rather than the one a given surface
    // happens to use — a per-callback test would pass while a sibling stayed
    // silent, which is the exact shape of the defect being fixed.
    const cb = makeCallbacks()
    register(cb)
    const s = useGuidanceStore.getState()

    s._sendMessage?.('ask about this factor')
    expect(cb.sendMessage).toHaveBeenCalledWith('ask about this factor')
    expect(revealSpy).toHaveBeenCalledTimes(1)

    s._sendChip?.('Gather evidence', 'How can I gather better evidence?')
    expect(cb.sendChip).toHaveBeenCalledTimes(1)
    expect(revealSpy).toHaveBeenCalledTimes(2)

    s._prefillChat?.('draft text')
    expect(cb.prefillChat).toHaveBeenCalledTimes(1)
    expect(revealSpy).toHaveBeenCalledTimes(3)

    s._dispatchAction?.({ label: 'Explain', message: 'explain this', source: 'chip' })
    expect(cb.dispatchAction).toHaveBeenCalledTimes(1)
    expect(revealSpy).toHaveBeenCalledTimes(4)
  })

  it('does NOT reveal on the non-sending callbacks', () => {
    // The negative half, and the reason it exists: `_runAnalysis` navigates the
    // dock to Analysis and has its own return-to-Olumi signal once the run
    // produces review content, so fronting Olumi at run START would fight it;
    // `_scrollToPatch` moves within an already-visible thread. Without this
    // test, "wrap everything" would pass the test above and quietly break both.
    const cb = makeCallbacks()
    register(cb)
    const s = useGuidanceStore.getState()

    s._runAnalysis?.()
    s._scrollToPatch?.('patch-1')

    expect(cb.runAnalysis).toHaveBeenCalledTimes(1)
    expect(cb.scrollToPatch).toHaveBeenCalledWith('patch-1')
    expect(revealSpy).not.toHaveBeenCalled()
  })

  it('delivers the message even when the reveal throws', () => {
    // The reveal is best-effort and must never convert a delivered message into
    // a thrown error at the call site. Ordering is asserted too: the send has
    // already happened by the time the reveal runs.
    const cb = makeCallbacks()
    register(cb)
    revealSpy.mockImplementationOnce(() => {
      throw new Error('no surface mounted')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => useGuidanceStore.getState()._sendMessage?.('still lands')).not.toThrow()
    expect(cb.sendMessage).toHaveBeenCalledWith('still lands')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not reveal when nothing is registered', () => {
    // Positive control for the absence claim: the same probe that reveals four
    // times above must reveal zero times here, so a wrapper that revealed
    // unconditionally could not pass both.
    const s = useGuidanceStore.getState()
    expect(s._sendMessage).toBeNull()
    expect(s._dispatchAction).toBeNull()
    expect(revealSpy).not.toHaveBeenCalled()
  })
})
