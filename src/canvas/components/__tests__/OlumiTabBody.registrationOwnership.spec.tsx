/**
 * OlumiTabBody's fallback registration OWNS ONLY WHAT IT WROTE — by identity.
 *
 * ── WHY (integration review of #1931, 24 Sep 2026) ──────────────────────────
 * The #1931 takeover filled NULL slots only, but the effect's own first write
 * was still an unconditional `setState` that ran on mount AND on every
 * dependency change. So a dependency change (a new `realMessageCount`, a new
 * provider callback) replaced whatever a fuller host had registered — a
 * `ConversationPanel` with a token and reveal-wrapped callbacks — with the tab
 * body's bare ones. Every later send/prefill then went out without the reveal.
 *
 * The rule pinned here: a slot may be written only when it is NULL, or when it
 * holds a callback THIS fallback wrote (or a departed tab body left behind —
 * see the last block). A callback any other host wrote is never replaced, and
 * no token is ever minted.
 *
 * ── HOW IT BINDS ────────────────────────────────────────────────────────────
 * Every recipient is a distinct spy and every assertion names WHICH spy
 * received the call, with the exact text: a value predicate ("a function is
 * registered") passes whichever host won. Fuller hosts register through the
 * REAL `registerConversationCallbacks` (token + `withOlumiReveal`), and asks go
 * through the REAL `requestAsk`. Only the conversation context and
 * `ConversationPanel` are stubbed, so a dependency change can be made without
 * re-registering any other host (the real composition cannot isolate that).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { Context, ReactNode } from 'react'

vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
// A REAL React context behind the mocked hook, so a new value re-renders the
// memo'd `OlumiTabBody` exactly as the provider does in the app.
vi.mock('../../conversation/ConversationContext', async () => {
  const React = await import('react')
  const TestConversationContext = React.createContext<unknown>(null)
  return {
    TestConversationContext,
    useConversationContext: () => React.useContext(TestConversationContext),
  }
})
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => <div data-testid="conv-panel-stub" />,
}))

import * as ConversationContextModule from '../../conversation/ConversationContext'
import { OlumiTabBody } from '../OlumiTabBody'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'

const TestConversationContext = (ConversationContextModule as unknown as {
  TestConversationContext: Context<unknown>
}).TestConversationContext

type Message = { id: string; role: string; content: string; synthetic?: boolean }
function makeConvo(messages: Message[] = []) {
  return {
    messages,
    sendMessage: vi.fn(async () => {}),
    setDraft: vi.fn(),
    dispatchAction: vi.fn(async () => {}),
  }
}
type Convo = ReturnType<typeof makeConvo>
function Mount({ convo, children }: { convo: Convo; children?: ReactNode }) {
  return (
    <TestConversationContext.Provider value={convo}>
      <OlumiTabBody />
      {children}
    </TestConversationContext.Provider>
  )
}

interface Host {
  send: ReturnType<typeof vi.fn>
  prefill: ReturnType<typeof vi.fn>
  dispatch: ReturnType<typeof vi.fn>
}
/** A fuller host, registered exactly as `ConversationPanel` registers. */
function registerHost(opts: { withDispatch?: boolean } = {}): { host: Host; unregister: () => void } {
  const host: Host = { send: vi.fn(), prefill: vi.fn(), dispatch: vi.fn() }
  let unregister: () => void = () => {}
  act(() => {
    unregister = useGuidanceStore.getState().registerConversationCallbacks(
      host.send,
      vi.fn(),
      undefined,
      undefined,
      host.prefill,
      opts.withDispatch === false ? undefined : host.dispatch,
    )
  })
  return { host, unregister }
}

/** Fire every ask channel once, with text that names the round. */
function fireAll(round: string) {
  act(() => {
    expect(requestAsk({ text: `ask ${round}`, label: 'x', source: 'test' })).toBe('composer')
  })
  act(() => {
    useGuidanceStore.getState()._sendMessage!(`send ${round}`)
  })
  act(() => {
    useGuidanceStore.getState()._dispatchAction!({ label: 'l', message: `dispatch ${round}`, source: 'test' })
  })
}
type Spy = { mock: { calls: unknown[][] } }
const texts = (spy: Spy) => spy.mock.calls.map((c) => c[0])
const dispatched = (spy: Spy) => spy.mock.calls.map((c) => (c[0] as { message: string }).message)

function slots() {
  const s = useGuidanceStore.getState()
  return {
    _sendMessage: s._sendMessage,
    _prefillChat: s._prefillChat,
    _dispatchAction: s._dispatchAction,
    _registrationToken: s._registrationToken,
  }
}

beforeEach(() => {
  useGuidanceStore.setState({
    _sendMessage: null, _runAnalysis: null, _sendChip: null, _scrollToPatch: null,
    _prefillChat: null, _dispatchAction: null, _registrationToken: null,
  })
})

const CASES = {
  c1: 'FULLER HOST AFTER THE FALLBACK — the host, not the fallback, receives every ask, send and dispatch',
  c2: 'OLDER HOST UNREGISTERS — a newer registration survives it and the fallback does not step in',
  c3: 'ACTIVE HOST LEAVES — the fallback recovers every slot with ITS OWN callbacks',
  c4a: 'DEP CHANGE WHILE A FULLER HOST OWNS THE SLOTS — the host is not overwritten (provider callback identities change)',
  c4b: 'DEP CHANGE WHILE A FULLER HOST OWNS THE SLOTS — the host is not overwritten (realMessageCount changes)',
  c4c: 'DEP CHANGE WHILE THE FALLBACK OWNS THE SLOTS — they move to the NEW callbacks, never left stale',
  c4d: 'MIXED OWNERSHIP — a host with no dispatcher: the fallback fills and later updates ONLY _dispatchAction',
  c5a: 'UNMOUNT — a slot another host holds is left exactly as it was',
  c5b: 'UNMOUNT ALONE — the departed tab body leaves its door callable (the dock-collapse path)',
  c5c: 'UNMOUNT THEN A NEW TAB BODY — the new one takes the departed one\'s slots; the old callbacks answer nothing',
} as const

describe('OlumiTabBody fallback registration — ownership by identity', () => {
  it('COLLECTION GUARD — every case in this file was collected and runs, by name', (ctx) => {
    const siblings = ctx.task.suite?.tasks ?? []
    expect(siblings.map((t) => t.name)).toEqual([
      'COLLECTION GUARD — every case in this file was collected and runs, by name',
      ...Object.values(CASES),
    ])
    expect(siblings.filter((t) => t.mode !== 'run').map((t) => t.name)).toEqual([])
  })

  it(CASES.c1, () => {
    const a = makeConvo()
    render(<Mount convo={a} />)
    expect(texts(a.setDraft), 'PRECONDITION: nothing called yet').toEqual([])
    const { host } = registerHost()
    expect(slots()._registrationToken, 'PRECONDITION: the host owns the registration').not.toBeNull()

    fireAll('1')
    // An unrelated store write wakes the takeover subscription; still the host.
    act(() => { useGuidanceStore.getState().setGuidanceItems([]) })
    fireAll('2')

    expect(texts(host.prefill)).toEqual(['ask 1', 'ask 2'])
    expect(texts(host.send)).toEqual(['send 1', 'send 2'])
    expect(dispatched(host.dispatch)).toEqual(['dispatch 1', 'dispatch 2'])
    expect(texts(a.setDraft)).toEqual([])
    expect(texts(a.sendMessage)).toEqual([])
    expect(a.dispatchAction).not.toHaveBeenCalled()
  })

  it(CASES.c2, () => {
    const a = makeConvo()
    render(<Mount convo={a} />)
    const older = registerHost()
    const newer = registerHost()
    const newerSlots = slots()
    act(() => { older.unregister() })

    expect(slots(), 'the older unregister is a no-op on the newer registration').toEqual(newerSlots)
    fireAll('1')
    expect(texts(newer.host.prefill)).toEqual(['ask 1'])
    expect(texts(newer.host.send)).toEqual(['send 1'])
    expect(dispatched(newer.host.dispatch)).toEqual(['dispatch 1'])
    expect(texts(older.host.prefill)).toEqual([])
    expect(texts(a.setDraft)).toEqual([])
    expect(texts(a.sendMessage)).toEqual([])
  })

  it(CASES.c3, () => {
    const a = makeConvo()
    render(<Mount convo={a} />)
    const { host, unregister } = registerHost()
    act(() => { unregister() })

    expect(slots()._registrationToken, 'the host is gone and nothing minted a token').toBeNull()
    fireAll('1')
    expect(texts(a.setDraft)).toEqual(['ask 1'])
    expect(texts(a.sendMessage)).toEqual(['send 1'])
    expect(dispatched(a.dispatchAction)).toEqual(['dispatch 1'])
    expect(texts(host.prefill)).toEqual([])
    expect(texts(host.send)).toEqual([])
  })

  it.each([
    ['provider callback identities change', 'c4a', () => makeConvo()],
    ['realMessageCount changes', 'c4b', null],
  ] as const)('DEP CHANGE WHILE A FULLER HOST OWNS THE SLOTS — the host is not overwritten (%s)', (_label, _key, next) => {
    const a = makeConvo()
    const { rerender } = render(<Mount convo={a} />)
    const { host } = registerHost()
    const hostSlots = slots()

    const b: Convo = next
      ? next()
      : { ...a, messages: [{ id: 'u1', role: 'user', content: 'hi', synthetic: false }] }
    act(() => { rerender(<Mount convo={b} />) })

    expect(slots(), 'the host\'s registration is untouched by the fallback\'s re-run').toEqual(hostSlots)
    fireAll('1')
    expect(texts(host.prefill)).toEqual(['ask 1'])
    expect(texts(host.send)).toEqual(['send 1'])
    expect(dispatched(host.dispatch)).toEqual(['dispatch 1'])
    for (const c of [a, b]) {
      expect(texts(c.setDraft)).toEqual([])
      expect(texts(c.sendMessage)).toEqual([])
    }
  })

  it(CASES.c4c, () => {
    const a = makeConvo()
    const { rerender } = render(<Mount convo={a} />)
    const before = slots()
    const b = makeConvo()
    act(() => { rerender(<Mount convo={b} />) })

    const after = slots()
    expect(after._prefillChat).not.toBe(before._prefillChat)
    expect(after._sendMessage).not.toBe(before._sendMessage)
    expect(after._dispatchAction).not.toBe(before._dispatchAction)
    fireAll('1')
    expect(texts(b.setDraft)).toEqual(['ask 1'])
    expect(texts(b.sendMessage)).toEqual(['send 1'])
    expect(dispatched(b.dispatchAction)).toEqual(['dispatch 1'])
    expect(texts(a.setDraft)).toEqual([])
    expect(texts(a.sendMessage)).toEqual([])
    expect(a.dispatchAction).not.toHaveBeenCalled()
  })

  it(CASES.c4d, () => {
    const a = makeConvo()
    const { rerender } = render(<Mount convo={a} />)
    const { host } = registerHost({ withDispatch: false })
    // The host registered `_dispatchAction: null`; the takeover filled that hole.
    expect(slots()._dispatchAction, 'PRECONDITION: the fallback filled the dispatch hole').not.toBeNull()
    const hostSend = slots()._sendMessage
    const hostPrefill = slots()._prefillChat

    const b = makeConvo()
    act(() => { rerender(<Mount convo={b} />) })

    expect(slots()._sendMessage).toBe(hostSend)
    expect(slots()._prefillChat).toBe(hostPrefill)
    fireAll('1')
    expect(texts(host.prefill)).toEqual(['ask 1'])
    expect(texts(host.send)).toEqual(['send 1'])
    expect(dispatched(b.dispatchAction)).toEqual(['dispatch 1'])
    expect(a.dispatchAction).not.toHaveBeenCalled()
    expect(texts(b.setDraft)).toEqual([])
  })

  it(CASES.c5a, () => {
    const a = makeConvo()
    const { unmount } = render(<Mount convo={a} />)
    const { host } = registerHost()
    const hostSlots = slots()
    act(() => { unmount() })

    expect(slots()).toEqual(hostSlots)
    fireAll('1')
    expect(texts(host.prefill)).toEqual(['ask 1'])
    expect(texts(host.send)).toEqual(['send 1'])
    expect(dispatched(host.dispatch)).toEqual(['dispatch 1'])
  })

  /*
   * ⚠ WHY UNMOUNT DOES NOT CLEAR. `OutputsDock` renders `OlumiTabBody` inside
   * `{effectiveIsOpen && …}`, so COLLAPSING THE DOCK unmounts it while the
   * canvas-level `ConversationProvider` — the session these callbacks close
   * over — stays alive. After an ask from the minimised pill the tab body is the
   * ONLY host left, so clearing here would empty every slot and take every ask
   * door with it. The composition spec measures that path end to end
   * (`askFromMinimisedPillKeepsRegistration.spec.tsx`, DOCK COLLAPSE cases).
   */
  it(CASES.c5b, () => {
    const a = makeConvo()
    const { unmount } = render(<Mount convo={a} />)
    act(() => { unmount() })

    fireAll('1')
    expect(texts(a.setDraft)).toEqual(['ask 1'])
    expect(texts(a.sendMessage)).toEqual(['send 1'])
    expect(dispatched(a.dispatchAction)).toEqual(['dispatch 1'])
  })

  it(CASES.c5c, () => {
    const a = makeConvo()
    const first = render(<Mount convo={a} />)
    const departed = slots()
    act(() => { first.unmount() })

    const b = makeConvo()
    render(<Mount convo={b} />)
    const now = slots()
    expect(now._prefillChat).not.toBe(departed._prefillChat)
    expect(now._sendMessage).not.toBe(departed._sendMessage)
    expect(now._dispatchAction).not.toBe(departed._dispatchAction)
    fireAll('1')
    expect(texts(b.setDraft)).toEqual(['ask 1'])
    expect(texts(b.sendMessage)).toEqual(['send 1'])
    expect(dispatched(b.dispatchAction)).toEqual(['dispatch 1'])
    expect(texts(a.setDraft)).toEqual([])
    expect(texts(a.sendMessage)).toEqual([])
    expect(a.dispatchAction).not.toHaveBeenCalled()
  })
})
