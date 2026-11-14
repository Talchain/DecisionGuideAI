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
  }
  return { ...(await orig<typeof import('@xyflow/react')>()), useReactFlow: () => api }
})
const PANE = { w: 1232, h: 704 }, INSET = { left: 0, top: 56, right: 420, bottom: 0 }
vi.mock('../revealCamera', async (orig) => ({ ...(await orig<typeof import('../revealCamera')>()), freePane: () => ({ size: PANE, inset: INSET }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { act, cleanup, renderHook } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
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
