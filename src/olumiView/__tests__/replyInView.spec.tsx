/**
 * AI and canvas as one partner (Paul, 14 Nov: "it should manipulate the UI and work with the user to showcase elements within the canvas"):
 * a NEW reply that points at cards brings them into view and pulses their ring once. Real path: the View store, core's s_ce285b3617bb golden
 * (turn 14 names reported_cash_and_spend_basis, opening_cash and monthly_burn; turn 12 names records that are not cards), the hook the canvas
 * mounts (replyInView.ts) with React Flow's camera stood in for by a recorder, and the real tryInViewTarget. Every expectation is bound by
 * card id: where the camera goes is checked against where each NAMED card sits, never a count alone.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const rf = vi.hoisted(() => ({ vp: { x: 0, y: 0, zoom: 1 }, at: new Map<string, { x: number; y: number }>(), set: null as unknown as (v: unknown, o?: unknown) => void }))
vi.mock('@xyflow/react', async (orig) => {
  // One object for every render, as React Flow's own hook gives stable functions: an effect must not restart on a re-render.
  const api = {
    getViewport: () => rf.vp,
    setViewport: (v: { x: number; y: number; zoom: number }, o?: unknown) => { rf.set(v, o); rf.vp = v; return Promise.resolve(true) },
    getInternalNode: (id: string) => (rf.at.has(id) ? { measured: { width: 260, height: 150 }, internals: { positionAbsolute: rf.at.get(id)! } } : undefined),
    // The reveal camera (F4) reads the board's bounds; with no nodes it centres without a whole-board clamp, as in v11Centre.spec.
    getNodes: (): unknown[] => [], getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  }
  return { ...(await orig<typeof import('@xyflow/react')>()), useReactFlow: () => api }
})
const PANE = { w: 1232, h: 704 }, INSET = { left: 0, top: 56, right: 420, bottom: 0 }
vi.mock('../revealCamera', async (orig) => ({ ...(await orig<typeof import('../revealCamera')>()), freePane: () => ({ size: PANE, inset: INSET }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { act, cleanup, renderHook } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useRevealInView } from '../revealCamera'
import { useReplyInView, newestReplyOf, replyArrival, QUIET_MS, type Activity } from '../replyInView'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
const NAMED = ['reported_cash_and_spend_basis', 'opening_cash', 'monthly_burn'] as const
const OTHER = 'horizon'
const before: View = { ...golden, chat: golden.chat.slice(0, 1) } // turn 12 only: the reply already on screen
const after: View = golden // turn 14 arrives
const FAR = { x: 24, y: 2400 }
const store = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, error: null, status: 'ready' } as never)
const nodeEl = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
const pulsing = () => Array.from(document.querySelectorAll('.react-flow__node.v10-pulse'), (e) => e.getAttribute('data-id') ?? '').sort()
const tick = (n = 4) => { for (let i = 0; i < n; i++) act(() => { vi.advanceTimersByTime(260) }) }
/** The screen rectangle of a card under a camera. */
const screenOf = (id: string, v = rf.vp) => { const p = rf.at.get(id)!; return { x0: p.x * v.zoom + v.x, y0: p.y * v.zoom + v.y, x1: (p.x + 260) * v.zoom + v.x, y1: (p.y + 150) * v.zoom + v.y } }
const inFree = (id: string, v = rf.vp) => { const r = screenOf(id, v); return r.x0 >= INSET.left && r.y0 >= INSET.top && r.x1 <= PANE.w - INSET.right && r.y1 <= PANE.h - INSET.bottom }

let activity: { current: Activity }, moved: { current: number }, set: ReturnType<typeof vi.fn>
const mount = () => renderHook(() => useReplyInView(moved, activity))
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'))
  set = vi.fn(); rf.set = set; rf.vp = { x: 0, y: 0, zoom: 1 }
  rf.at = new Map([[OTHER, { x: 0, y: 0 }], ...NAMED.map((id, i) => [id, { x: FAR.x + i * 250, y: FAR.y }] as const)])
  activity = { current: { at: 0, active: false } }; moved = { current: 0 }
  document.body.innerHTML = '<div class="react-flow"></div>' + [OTHER, ...NAMED].map((id) => `<div class="react-flow__node" data-id="${id}"></div>`).join('')
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never
})
afterEach(() => { cleanup(); vi.useRealTimers(); useViewStore.setState(useViewStore.getInitialState(), true); document.body.innerHTML = '' })

describe('the reading of a reply (pure)', () => {
  it('R0 precondition: turn 14 names three cards that are on the board; turn 12 names none that are', () => {
    expect(newestReplyOf(after)).toEqual({ id: 14, cards: [...NAMED] })
    expect(newestReplyOf(before)).toEqual({ id: 12, cards: [] })
  })
  it('R1 the first View for a scenario is only a baseline; a higher turn id after it is new; another scenario starts over', () => {
    const a = replyArrival(null, golden.id, after)
    expect(a).toEqual({ seen: { sid: golden.id, id: 14 }, cards: [] })
    expect(replyArrival(a.seen, golden.id, after).cards).toEqual([])
    const b = replyArrival(replyArrival(null, golden.id, before).seen, golden.id, after)
    expect(b.cards).toEqual([...NAMED])
    expect(replyArrival(b.seen, 'another', after).cards).toEqual([])
  })
})

describe('a new reply brings the cards it points at into view and pulses their ring once', () => {
  it('P1 catch: the named cards, below the fold, are brought wholly into the free canvas; only they pulse', () => {
    store(before); mount(); tick(1)
    expect(NAMED.some((id) => inFree(id)), 'precondition: the named cards start off screen').toBe(false)
    act(() => { store(after) })
    tick(2); expect(set).toHaveBeenCalledTimes(1)
    for (const id of NAMED) expect(inFree(id), `${id} in view`).toBe(true)
    expect(rf.vp.zoom).toBe(1) // all three fit at the person's zoom: panned, not zoomed
    expect(set.mock.calls[0]![1]).toEqual({ duration: 300 })
    act(() => { vi.advanceTimersByTime(330) }); expect(pulsing()).toEqual([...NAMED].sort())
    expect(nodeEl(OTHER).classList.contains('v10-pulse')).toBe(false)
  })
  it('P2 catch: cards too far apart for the zoom are brought in by zooming out only as far as needed, never in', () => {
    rf.at.set('opening_cash', { x: 300, y: 3000 })
    store(before); mount(); act(() => { store(after) }); tick()
    for (const id of NAMED) expect(inFree(id), id).toBe(true)
    expect(rf.vp.zoom).toBeLessThan(1); expect(rf.vp.zoom).toBeGreaterThanOrEqual(0.5)
  })
  it('P3 catch: next.at counts where it is a card; a record that is not a card is left out', () => {
    const v: View = structuredClone(after); v.chat[1]!.answer!.next.about = ['monthly_burn']; v.chat[1]!.answer!.next.at = 'opening_cash'
    expect(newestReplyOf(v)!.cards).toEqual(['monthly_burn', 'opening_cash'])
    v.chat[1]!.answer!.next.at = 'not_a_card'
    expect(newestReplyOf(v)!.cards).toEqual(['monthly_burn'])
  })
  it('P4 must not change: the cards already in view are not moved, and their ring still pulses', () => {
    rf.at = new Map([[OTHER, { x: 0, y: 0 }], ...NAMED.map((id, i) => [id, { x: 20 + i * 262, y: 300 }] as const)])
    store(before); mount(); act(() => { store(after) }); tick(5)
    expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([...NAMED].sort())
  })
  it('P5 must not change: a poll on every tick (the View replaced, no new reply) neither cancels the move in progress nor moves the board again', () => {
    store(before); mount(); act(() => { store(after) })
    for (let i = 0; i < 5; i++) { act(() => { store({ ...after, chat: [...after.chat] }) }); tick(1) }
    expect(set).toHaveBeenCalledTimes(1)
    for (const id of NAMED) expect(inFree(id), id).toBe(true)
    for (let i = 0; i < 4; i++) { act(() => { store({ ...after, chat: [...after.chat] }) }); tick(1) }
    expect(set).toHaveBeenCalledTimes(1)
  })
})

describe('the board is left alone when it is not the reply\'s to move', () => {
  it('N1 catch: a reload (the reply is already there when the scenario is first seen) moves nothing and pulses nothing', () => {
    store(after); mount(); tick(6)
    expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('N2 catch: while the person drags, the board stays; so does the pulse', () => {
    activity.current = { at: 0, active: true } // a drag that began long ago and is still held
    store(before); mount(); act(() => { store(after) }); tick(6)
    expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('N2b catch: a drag that begins while the reply settles stops it', () => {
    store(before); mount(); act(() => { store(after) }); tick(1)
    activity.current = { at: Date.now(), active: true }
    tick(6); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('N3 catch: a pan or zoom of the person\'s own a moment ago keeps the board where it is; after the quiet time the next reply moves it', () => {
    activity.current = { at: Date.now() - (QUIET_MS - 1000), active: false }
    store(before); mount(); act(() => { store(after) }); tick(6)
    expect(set).not.toHaveBeenCalled()
    const next: View = structuredClone(after); next.chat.push({ ...structuredClone(after.chat[1]!), id: 16 })
    act(() => { vi.advanceTimersByTime(QUIET_MS) }); act(() => { store(next) }); tick()
    expect(set).toHaveBeenCalledTimes(1)
    for (const id of NAMED) expect(inFree(id), id).toBe(true)
  })
  it('N4 catch: if the person moves the board while the reply settles, the reply does not move it', () => {
    store(before); mount(); act(() => { store(after) }); tick(1)
    moved.current += 1
    tick(6); expect(set).not.toHaveBeenCalled()
  })
  it('N5 must not change: a reply that points at no card moves nothing', () => {
    const v: View = structuredClone(after); v.chat[1]!.answer!.next.about = ['not_a_card']; v.chat[1]!.answer!.next.at = null
    store(before); mount(); act(() => { store(v) }); tick(6)
    expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
})

describe('a pending camera move or pulse is cancelled when it is no longer the reply\'s to make (reviewer 14 Nov)', () => {
  const other: View = { ...before, id: 's_another_scenario' }
  const newerReply = (cards: string[]): View => {
    const v: View = structuredClone(after); const t = { ...structuredClone(after.chat[1]!), id: 16 }
    t.answer!.next.about = cards; t.answer!.next.at = null; v.chat.push(t); return v
  }
  const arrive = () => { store(before); const h = mount(); act(() => { store(after) }); return h }
  it('X1 catch: switching scenario while the reply is still settling moves nothing and pulses nothing', () => {
    arrive(); tick(1)
    act(() => { store(other) })
    tick(6); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('X2 catch: switching scenario between the move and its pulse cancels the pulse', () => {
    arrive(); tick(2); expect(set).toHaveBeenCalledTimes(1)
    act(() => { store(other) })
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('X3 catch: switching scenario while the pulse is on ends it, and its timers do not outlive it', () => {
    arrive(); tick(2); act(() => { vi.advanceTimersByTime(330) }); expect(pulsing()).toEqual([...NAMED].sort())
    act(() => { store(other) })
    expect(pulsing()).toEqual([])
  })
  it('X4 catch: a newer reply that points at no card replaces the one that was settling: the board stays', () => {
    arrive(); tick(1)
    act(() => { store(newerReply(['not_a_card'])) })
    tick(6); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('X5 catch: a newer reply between the move and its pulse cancels the older pulse', () => {
    arrive(); tick(2); expect(set).toHaveBeenCalledTimes(1)
    act(() => { store(newerReply(['not_a_card'])) })
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('X6 catch: a zoom-button press (no drag, no pan event) while the reply settles stops it', () => {
    arrive(); tick(1)
    activity.current = { at: Date.now(), active: false }
    tick(6); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
  it('X7 catch: the person\'s own pan or zoom between the move and its pulse cancels the pulse (the move already made stands)', () => {
    arrive(); tick(2); expect(set).toHaveBeenCalledTimes(1)
    moved.current += 1
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('X7b catch: a drag begun between the move and its pulse cancels the pulse', () => {
    arrive(); tick(2)
    activity.current = { at: Date.now(), active: true }
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('X8 catch: unmounting before the pulse fires leaves no pulse behind', () => {
    const h = arrive(); tick(2); h.unmount()
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('X9 must not change: with no one in the way, the move and its pulse still happen once', () => {
    arrive(); tick(2); act(() => { vi.advanceTimersByTime(330) })
    expect(set).toHaveBeenCalledTimes(1); expect(pulsing()).toEqual([...NAMED].sort())
  })
})

describe('reduced motion', () => {
  it('M1 catch: the board jumps (duration 0) and the pulse class is still put on and taken off', () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never
    store(before); mount(); act(() => { store(after) }); tick()
    expect(set.mock.calls[0]![1]).toEqual({ duration: 0 })
    for (const id of NAMED) expect(inFree(id), id).toBe(true)
    act(() => { vi.advanceTimersByTime(1200) }); expect(pulsing()).toEqual([])
  })
  it('M2 the pulse animation is switched off under prefers-reduced-motion in the stylesheet itself', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.v10-pulse\s*\{\s*animation:\s*none/)
  })
})

describe('Fit is the person\'s own deliberate move: it cancels a pending reply move and pulse, and a pending reveal pan (W5 round 2)', () => {
  /**
   * What the canvas's Fit button does to the two refs these hooks read. This is a stand-in: fitHandler.spec.tsx mounts the real canvas, presses the
   * real Fit button and asserts the same two writes on the real refs (and that the pending timers it arms are released), so the two files together bind
   * the handler to what F1, F2 and F4 rely on.
   */
  const pressFit = () => { moved.current += 1; activity.current = { at: Date.now(), active: false } }
  it('F1 catch: Fit pressed while the reply is settling means the board is not panned and nothing pulses; the settling timer is released', () => {
    store(before); mount()
    const base = vi.getTimerCount() // before the arrival: whatever else is pending is not this hook's
    act(() => { store(after) }); tick(1)
    expect(vi.getTimerCount(), 'precondition: the settling interval is pending').toBeGreaterThan(base)
    pressFit()
    tick(8); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
    expect(vi.getTimerCount(), 'the settling interval has stopped').toBe(base)
  })
  it('F2 catch: Fit pressed inside the 320 ms between the move and its pulse: the pulse timer is still pending, Fit is pressed, and the pulse never comes (asserted on the actual timer)', () => {
    store(before); mount()
    const base = vi.getTimerCount()
    act(() => { store(after) }); tick(2)
    expect(set).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount(), 'precondition: the delayed pulse is pending').toBeGreaterThan(base)
    act(() => { vi.advanceTimersByTime(100) }); expect(pulsing(), 'inside the window: not yet').toEqual([])
    pressFit()
    act(() => { vi.advanceTimersByTime(199) }); expect(pulsing()).toEqual([]) // 319 ms after the move (made at 500 ms, now 819): the window has not closed
    expect(vi.getTimerCount(), 'the pulse timer is still pending until it fires').toBeGreaterThan(base)
    act(() => { vi.advanceTimersByTime(1) }) // 320 ms: the timer fires and finds the camera taken
    expect(pulsing()).toEqual([]); expect(vi.getTimerCount()).toBe(base)
    act(() => { vi.advanceTimersByTime(2000) }); expect(pulsing()).toEqual([])
  })
  it('F2b control: the same sequence with no Fit pulses exactly when the timer fires (320 ms after the move), so F2 cancels something real', () => {
    store(before); mount(); act(() => { store(after) }); tick(2)
    act(() => { vi.advanceTimersByTime(299) }); expect(pulsing()).toEqual([])
    act(() => { vi.advanceTimersByTime(1) }); expect(pulsing()).toEqual([...NAMED].sort())
  })
  describe('F4 a reveal pan that is pending when Fit is pressed does not move the camera after Fit (ViewCanvas.tsx onFitView bumps movedAt: this is deliberate, and it covers the reveal, open-in-view and try-in-view moves too)', () => {
    const chain: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11/consulting-chain.view3.json'), 'utf8'))
    const mark = chain.collab.marks!.find((m) => m.card === 'diagnostic_time_to_contract' && m.kind === 'disagreement')!
    /** A board whose contested card (core's disagreement chip) sits below the fold: the reveal camera will pan to it once the chip has kept its place for one tick. */
    const mountReveal = () => {
      store(chain)
      const pane = document.createElement('div'), node = document.createElement('div'), rail = document.createElement('div'), chip = document.createElement('button')
      pane.className = 'react-flow'; node.className = 'react-flow__node'; node.dataset.id = mark.card
      rail.dataset.testid = `reveal-chips-${mark.card}`; chip.dataset.revealKind = mark.kind
      rail.append(chip); node.append(rail); pane.append(node)
      document.body.replaceChildren(pane)
      pane.getBoundingClientRect = () => new DOMRect(0, 0, PANE.w, PANE.h)
      rail.getBoundingClientRect = () => new DOMRect(300, 800.1, 260, 28)
      chip.getBoundingClientRect = () => new DOMRect(300, 800.1, 260, 28)
      rf.at = new Map([[mark.card, { x: 300, y: 800 }]])
      return renderHook(() => useRevealInView(moved))
    }
    it('F4 control: with no Fit, the settled chip brings its card into view (so F4 cancels something real)', () => {
      mountReveal(); tick(3)
      expect(set).toHaveBeenCalledTimes(1)
    })
    it('F4 catch: Fit pressed after the first tick, before the chip has settled: the camera is never moved and the reveal timer is released', () => {
      const base = vi.getTimerCount()
      mountReveal(); tick(1)
      expect(vi.getTimerCount(), 'precondition: the reveal interval is pending').toBeGreaterThan(base)
      pressFit()
      tick(8); expect(set).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(base)
    })
  })
})

describe('a reply already acted on is not replayed on a reopened scenario (UI-4)', () => {
  it('A1 catch: A\'s reply arrives, the person opens B and returns to A before any View has loaded: nothing moves and nothing pulses; the View then loading changes nothing', () => {
    store(before); mount(); act(() => { store(after) }); tick(1) // arrival for A is held, not yet settled
    act(() => { useViewStore.setState({ sid: 's_b', view: null, status: 'loading' } as never) })
    act(() => { useViewStore.setState({ sid: after.id, view: null, status: 'loading' } as never) })
    tick(8); expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
    act(() => { store(after) }); tick(8)
    expect(set).not.toHaveBeenCalled(); expect(pulsing()).toEqual([])
  })
})
