/**
 * Ownership guard for conversation-callback registration.
 *
 * Live audit finding (2026-07-05): two ConversationPanel hosts can mount
 * (floating panel + dock Olumi tab). The old cleanup nulled the shared
 * callbacks unconditionally, so whichever host unmounted LAST killed the
 * survivor's registration — silently breaking "Analyse first pass",
 * "Try Again" and every other cross-surface run/ask CTA until a chat panel
 * was reopened.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGuidanceStore } from '../guidanceStore'

// Spies rather than bare stubs: since the store wraps callbacks (see the note
// above `expectDelegatesTo`), ownership is asserted by WHICH callback runs, and
// that needs a call record. Each `makeCallbacks()` returns fresh spies so two
// hosts are distinguishable.
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

/**
 * ⚠ IDENTITY vs DELEGATION (16 Aug 2026). `registerConversationCallbacks` now
 * stores `withOlumiReveal(cb)` — a wrapper that invokes the registered callback
 * and then reveals the Olumi surface (the class-8 guarantee: an action that
 * sends work to Olumi must visibly reveal Olumi). The stored value is therefore
 * a NEW function object, and `toBe(cb.dispatchAction)` can no longer hold.
 *
 * These assertions were rewritten to test what they were always ABOUT — which
 * host's registration is active — via DELEGATION rather than object identity.
 * That is also the more honest test: this suite's own subject is that ownership
 * is decided by `_registrationToken`, precisely BECAUSE callback identity
 * cannot discriminate hosts (both hosts share the singleton conversation's
 * function objects). An identity assertion was the one thing the file argues
 * against everywhere else.
 */
function expectDelegatesTo(
  stored: unknown,
  spy: { mockClear: () => void; mock: { calls: unknown[][] } },
) {
  expect(stored).toBeTypeOf('function')
  spy.mockClear()
  ;(stored as (arg: unknown) => void)({ probe: true })
  expect(spy.mock.calls).toEqual([[{ probe: true }]])
}

describe('guidanceStore registration ownership', () => {
  beforeEach(() => {
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

  it('registers all callbacks and returns an unregister function', () => {
    const cb = makeCallbacks()
    const unregister = register(cb)
    expectDelegatesTo(useGuidanceStore.getState()._dispatchAction, cb.dispatchAction)
    expect(typeof unregister).toBe('function')
  })

  it('own unregister clears the callbacks', () => {
    const cb = makeCallbacks()
    const unregister = register(cb)
    unregister()
    const s = useGuidanceStore.getState()
    expect(s._sendMessage).toBeNull()
    expect(s._dispatchAction).toBeNull()
    expect(s._runAnalysis).toBeNull()
  })

  it('discriminates hosts by registration token even when callback identities are SHARED (singleton conversation)', () => {
    // Both panel hosts destructure the SAME function objects from the
    // conversation singleton — callback identity cannot tell them apart.
    const shared = makeCallbacks()
    const unregisterFirst = register(shared)
    register(shared) // second host, identical callback identities
    unregisterFirst() // first host unmounts AFTER the second registered
    // The second host's registration must survive.
    expectDelegatesTo(useGuidanceStore.getState()._dispatchAction, shared.dispatchAction)
    expect(useGuidanceStore.getState()._registrationToken).not.toBeNull()
  })

  it('clearing the active registration sets the token null (survivor-takeover signal)', () => {
    const cb = makeCallbacks()
    const unregister = register(cb)
    unregister()
    expect(useGuidanceStore.getState()._registrationToken).toBeNull()
  })

  it("a stale host's unregister does NOT clobber the newer host's registration", () => {
    const first = makeCallbacks()
    const second = makeCallbacks()
    const unregisterFirst = register(first)
    register(second)
    // Remount ordering: the first host's cleanup fires after the second host
    // registered (e.g. dock tab unmounts while the floating panel stays up).
    unregisterFirst()
    const s = useGuidanceStore.getState()
    // Discriminating: the SECOND host's spies must fire and the FIRST host's
    // must not — which is the claim, and one that survives the wrapper.
    expectDelegatesTo(s._dispatchAction, second.dispatchAction)
    expect(first.dispatchAction).not.toHaveBeenCalled()
    expectDelegatesTo(s._sendMessage, second.sendMessage)
    expect(first.sendMessage).not.toHaveBeenCalled()
    // `_runAnalysis` is stored UNWRAPPED by design (a run navigates to Analysis
    // and has its own return-to-Olumi signal), so identity still holds here —
    // and asserting it pins that deliberate asymmetry.
    expect(s._runAnalysis).toBe(second.runAnalysis)
  })
})
