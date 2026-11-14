/**
 * PL-1083 (1), old look, Codex 13:33Z (the tests must bind the placing, not only the helper): the thread's resting scroll while a proposal
 * holds Olumi's readings, driven through the real ViewChat with the layout stubbed (jsdom has none). Boxes are the 12:15Z measurement of
 * 452caf7a's held cut13 proposal at 1232 in this look: the thread 473 px tall, the proposal's sticky actions 117 px, two reading rows 143
 * and 121 px. Bound here: at rest both rows are whole above the actions; a proposal with no reading rests as it did before.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
type Mark = NonNullable<View['proposal']>['marks'][number]
const held = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-452caf7a-cut13-held-marks.json'), 'utf8')) as Mark[]
const PLAIN: Mark = { what: 'Budget', status: 'not yet confirmed', title: 'A figure of Olumi’s' }

// Rows are given in the thread's scroll coordinates; on screen they sit at the thread's top + y - scrollTop.
const TOP = 121, SCROLL_H = 4242, FOOT = 117, SHORT_ROWS: Record<string, [number, number]> = { 'view-reading-0': [2500, 143], 'view-reading-1': [2651, 121] }
let ROWS = SHORT_ROWS, H = 473
const thread = () => document.querySelector<HTMLElement>('[data-testid="view-chat-scroll"]')!
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
let observers: Array<{ fire: () => void; seen: Element[] }> = []
// A size change of ONE element, as the browser reports it: only the observers watching that element hear of it.
const resized = (e: Element) => { const heard = observers.filter((o) => o.seen.includes(e)); for (const o of heard) o.fire(); return heard.length }

const show = (marks: Mark[]) => {
  const view: View = { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks } }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />)
}
beforeEach(() => {
  ROWS = SHORT_ROWS; H = 473; observers = []
  globalThis.ResizeObserver = class { private o: { fire: () => void; seen: Element[] }; constructor(cb: ResizeObserverCallback) { this.o = { fire: () => cb([], this as unknown as ResizeObserver), seen: [] }; observers.push(this.o) } observe(e: Element) { this.o.seen.push(e) } unobserve() {} disconnect() { this.o.seen = [] } } as unknown as typeof ResizeObserver
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async () => new Response(JSON.stringify(golden), { status: 200 })) as unknown as typeof fetch)
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const id = this.getAttribute('data-testid') ?? ''
    if (id === 'view-chat-scroll') return rect(TOP, H)
    if (id === 'view-proposal-actions') return rect(0, FOOT)
    if (ROWS[id] !== undefined) return rect(TOP + ROWS[id]![0] - (document.querySelector('[data-testid="view-chat-scroll"]')?.scrollTop ?? 0), ROWS[id]![1])
    return rect(0, 0)
  }
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-scroll' ? H : 0 } })
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-scroll' ? SCROLL_H : 0 } })
})
afterEach(() => {
  cleanup(); setTeamFetch(null)
  HTMLElement.prototype.getBoundingClientRect = real.rect
  if (real.ch) Object.defineProperty(Element.prototype, 'clientHeight', real.ch)
  if (real.sh) Object.defineProperty(Element.prototype, 'scrollHeight', real.sh)
  globalThis.ResizeObserver = real.ro
  useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null })
})
const wholeRow = (id: string) => { const st = thread().scrollTop, foot = TOP + H - FOOT, [y, h] = ROWS[id]!; return TOP + y - st >= TOP && TOP + y + h - st <= foot }
const whole = () => Object.keys(ROWS).every(wholeRow)

describe('PL-1083 (1), old look: where the thread rests while a proposal holds readings', () => {
  it('at rest both reading rows are whole above the proposal\'s actions: the last row just clear of them', () => {
    show(held)
    // The last row ends at 2772; 8 px clear, then 117 px of actions, in a 473 px thread: scrollTop 2772 + 8 + 117 - 473.
    expect(thread().scrollTop).toBe(2424)
    expect(whole()).toBe(true)
  })
  it('CONTRAST: a proposal with no reading rests where it did before (the readings rule moves nothing)', () => {
    show([PLAIN])
    expect(thread().scrollTop).toBe(0)
  })
  it('13:50Z on 7163b55b, long words (rows of 352 and 215 px; 356 px of thread above the actions): the first row rests whole, giving up its gap; the second is reached by scrolling', () => {
    ROWS = { 'view-reading-0': [2500, 352], 'view-reading-1': [2860, 215] }
    show(held)
    expect(thread().scrollTop).toBe(2500 + 352 + FOOT - H)
    expect(wholeRow('view-reading-0')).toBe(true)
    expect(wholeRow('view-reading-1')).toBe(false)
  })
  it('Codex 14:1xZ: when the thread\'s content changes size (the words grow), the thread rests again by the same rule', () => {
    show(held)
    expect(thread().scrollTop).toBe(2424)
    ROWS = { 'view-reading-0': [2500, 352], 'view-reading-1': [2860, 215] }
    expect(wholeRow('view-reading-0')).toBe(false)
    expect(resized(thread().firstElementChild!)).toBeGreaterThan(0) // the thread's content, the element the browser reports
    expect(thread().scrollTop).toBe(2500 + 352 + FOOT - H)
    expect(wholeRow('view-reading-0')).toBe(true)
  })
  it('Codex 14:3xZ: when the thread itself gets shorter (the composer grows) with its content unchanged, it rests again and the rows stay whole above the actions', () => {
    show(held)
    expect(thread().scrollTop).toBe(2424)
    H = 420 // 53 px less thread
    expect(whole()).toBe(false)
    expect(resized(thread())).toBe(1)
    expect(thread().scrollTop).toBe(2772 + 8 + FOOT - 420)
    expect(whole()).toBe(true)
  })
  it('CONTRAST: with no reading held, a change of the thread\'s own height moves nothing (exactly as before)', () => {
    show([PLAIN])
    thread().scrollTop = 77
    H = 420
    resized(thread())
    expect(thread().scrollTop).toBe(77)
  })
})
