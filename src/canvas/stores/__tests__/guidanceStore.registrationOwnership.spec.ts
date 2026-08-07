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
import { describe, it, expect, beforeEach } from 'vitest'
import { useGuidanceStore } from '../guidanceStore'

const makeCallbacks = () => ({
  sendMessage: (_text: string) => {},
  scrollToPatch: (_id: string) => {},
  sendChip: (_label: string, _message: string) => {},
  runAnalysis: () => {},
  prefillChat: (_text: string) => {},
  dispatchAction: (_opts: { label: string; message: string; source: string }) => {},
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
    expect(useGuidanceStore.getState()._dispatchAction).toBe(cb.dispatchAction)
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
    expect(useGuidanceStore.getState()._dispatchAction).toBe(shared.dispatchAction)
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
    expect(s._dispatchAction).toBe(second.dispatchAction)
    expect(s._sendMessage).toBe(second.sendMessage)
    expect(s._runAnalysis).toBe(second.runAnalysis)
  })
})
