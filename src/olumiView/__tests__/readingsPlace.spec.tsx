/**
 * PL-1083 (1), old look, Codex 13:33Z (the tests must bind the placing, not only the helper): the thread's resting scroll while a proposal
 * holds Olumi's readings, driven through the real ViewChat with the layout stubbed (jsdom has none). Boxes are the 12:15Z measurement of
 * 452caf7a's held cut13 proposal at 1232 in this look: the thread 473 px tall, the proposal's sticky actions 117 px, two reading rows 143
 * and 121 px. Bound here: at rest both rows are whole above the actions; a proposal with no reading rests as it did before.
 *
 * Contract 3 (15 Nov) supersedes this as an AT-REST rule: Olumi's waiting proposal is ONE row (a <details data-testid="view-next-step">, closed at
 * rest), and the readings rule applies only while that row is OPEN; and the thread never rests past the newest reply's first line
 * (top = min(top, newest.offsetTop - 16)). jsdom has no layout, so the newest reply's offsetTop is stubbed (NEWEST); the golden proposal View's
 * newest chat turn is `view-chat-latest`. The reply sits ABOVE the proposal's readings on the page, so there the cap decides and the rule can
 * only bring the thread back UP to the first row (its `high`); a layout whose reply starts below the readings (NEWEST 3000) is the one where
 * the rule, not the cap, decides, and the rows bind it there.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
// The newest reply's offsetTop (null: jsdom's 0). Its first line is at NEWEST - 16, the most the thread rests at (Contract 3).
let NEWEST: number | null = null
const row = () => document.querySelector<HTMLDetailsElement>('[data-testid="view-next-step"]')!
// Opening the one row grows the thread's content: the browser reports it, the thread rests again.
const openRow = () => { row().open = true; expect(resized(thread().firstElementChild!)).toBeGreaterThan(0) }
const thread = () => document.querySelector<HTMLElement>('[data-testid="view-chat-scroll"]')!
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
let observers: Array<{ fire: (e: Element) => void; seen: Element[] }> = []
// A size change of ONE element, as the browser reports it: only the observers watching that element hear of it.
const resized = (e: Element) => { const heard = observers.filter((o) => o.seen.includes(e)); for (const o of heard) o.fire(e); return heard.length }

const show = (marks: Mark[]) => {
  const view: View = { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks } }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />)
}
beforeEach(() => {
  ROWS = SHORT_ROWS; H = 473; NEWEST = null; observers = []
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-latest' && NEWEST !== null ? NEWEST : 0 })
  globalThis.ResizeObserver = class { private o: { fire: (e: Element) => void; seen: Element[] }; constructor(cb: ResizeObserverCallback) { this.o = { fire: (e) => cb([{ target: e } as ResizeObserverEntry], this as unknown as ResizeObserver), seen: [] }; observers.push(this.o) } observe(e: Element) { this.o.seen.push(e) } unobserve() {} disconnect() { this.o.seen = [] } } as unknown as typeof ResizeObserver
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
  cleanup(); setTeamFetch(null); vi.restoreAllMocks()
  HTMLElement.prototype.getBoundingClientRect = real.rect
  if (real.ch) Object.defineProperty(Element.prototype, 'clientHeight', real.ch)
  if (real.sh) Object.defineProperty(Element.prototype, 'scrollHeight', real.sh)
  globalThis.ResizeObserver = real.ro
  useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null })
})
const wholeRow = (id: string) => { const st = thread().scrollTop, foot = TOP + H - FOOT, [y, h] = ROWS[id]!; return TOP + y - st >= TOP && TOP + y + h - st <= foot }
const whole = () => Object.keys(ROWS).every(wholeRow)

describe('PL-1083 (1), old look, under Contract 3: where the thread rests while a proposal holds readings', () => {
  it('CATCH (closed row): the proposal is one closed row and the readings rule moves nothing: the thread rests at the newest reply\'s first line', () => {
    NEWEST = 2000
    show(held)
    expect(row().tagName).toBe('DETAILS')
    expect(row().open).toBe(false)
    // Before this change the readings rule ran with the proposal closed or not and rested at 2424 (rows whole above the actions); now 2000 - 16.
    expect(thread().scrollTop).toBe(1984)
    expect(whole()).toBe(false)
  })
  it('open row, the rule decides (the reply starts below the readings, so the cap does not bind): both reading rows are whole above the actions, the first row\'s top just inside the thread', () => {
    NEWEST = 3000
    show(held)
    expect(thread().scrollTop).toBe(2984) // closed: the reply's first line; the readings rule has not run (before this change it had: 2492)
    openRow()
    // Range for the held rows: low 2772 + 8 + 117 - 473 = 2424, high 2500 - 8 = 2492; from 2984 the least move into it is its high.
    expect(thread().scrollTop).toBe(2492)
    expect(whole()).toBe(true)
  })
  it('open row, capped: where the rule would rest below the newest reply\'s first line it does not go past it (the rows are then NOT whole: the reply\'s first line wins)', () => {
    NEWEST = 2300
    show(held)
    openRow()
    // The rule alone would rest at 2424 (the old row's value, rows whole); the cap is 2300 - 16. Unreachable under the new rule, so the capped value is bound.
    expect(thread().scrollTop).toBe(2284)
    expect(whole()).toBe(false)
  })
  it('open row, the reply\'s first line exactly where the rule rests: the old row\'s value 2424 is reached and both rows are whole', () => {
    NEWEST = 2440
    show(held)
    openRow()
    // The last row ends at 2772; 8 px clear, then 117 px of actions, in a 473 px thread: scrollTop 2772 + 8 + 117 - 473; the cap is 2440 - 16, equal.
    expect(thread().scrollTop).toBe(2424)
    expect(whole()).toBe(true)
  })
  it('CATCH (scrolled): someone who has scrolled on since the last rest is never moved up by the cap when the row opens', () => {
    NEWEST = 2000
    show(held)
    expect(thread().scrollTop).toBe(1984)
    thread().scrollTop = 3719 // 4242 - 473 - 3719 = 50 px from the foot: still following, but the automatic rest is no longer theirs to keep
    fireEvent.scroll(thread())
    openRow()
    // Before this change the rest rule ran from the reply's first line (1984) and moved the thread to the range's low (2424), not leaving them where they read.
    expect(thread().scrollTop).toBe(3719)
    // CATCH (Codex 15 Nov): and on the NEXT rest too (the content grows again), never back up to the reply's first line (1984).
    expect(resized(thread().firstElementChild!)).toBeGreaterThan(0)
    expect(thread().scrollTop).toBe(3719)
  })
  it('CONTRAST: a proposal with no reading rests where it did before (the readings rule moves nothing)', () => {
    show([PLAIN])
    expect(thread().scrollTop).toBe(0)
  })
  it('13:50Z on 7163b55b, long words (rows of 352 and 215 px; 356 px of thread above the actions), row open: the first row rests whole, giving up its gap (its top at the thread\'s top); the second is reached by scrolling', () => {
    ROWS = { 'view-reading-0': [2500, 352], 'view-reading-1': [2860, 215] }
    NEWEST = 3000
    show(held)
    openRow()
    // Range: low 2496 (the row's foot just above the actions), high 2500 (its top at the thread's top); from the reply's line 2984 the least move is 2500.
    // Not a catch: the product before this change gives the same value from this start; it binds the rule for an open row.
    expect(thread().scrollTop).toBe(2500)
    expect(wholeRow('view-reading-0')).toBe(true)
    expect(wholeRow('view-reading-1')).toBe(false)
  })
  it('Codex 14:1xZ: when the thread\'s content changes size (the words grow), the open row\'s thread rests again by the same rule', () => {
    NEWEST = 3000
    show(held)
    openRow()
    expect(thread().scrollTop).toBe(2492)
    ROWS = { 'view-reading-0': [2500, 352], 'view-reading-1': [2860, 215] }
    expect(wholeRow('view-reading-0')).toBe(false)
    expect(resized(thread().firstElementChild!)).toBeGreaterThan(0) // the thread's content, the element the browser reports
    expect(thread().scrollTop).toBe(2500) // as in the long-words row; not a catch (the same before this change from this start)
    expect(wholeRow('view-reading-0')).toBe(true)
  })
  it('Codex 14:3xZ: when the thread itself gets shorter (the composer grows) with its content unchanged, it rests again; the cap keeps it at the reply\'s first line even though the rows are then not whole', () => {
    NEWEST = 2440
    show(held)
    openRow()
    expect(thread().scrollTop).toBe(2424)
    H = 420 // 53 px less thread
    expect(whole()).toBe(false)
    expect(resized(thread())).toBe(1)
    // The rule alone would now rest at 2772 + 8 + FOOT - 420 = 2477 (rows whole); that is past the reply's first line (2440 - 16), which the thread never passes.
    expect(thread().scrollTop).toBe(2424)
    expect(whole()).toBe(false)
  })
  it('CONTRAST: with no reading held, a change of the thread\'s own height moves nothing (exactly as before)', () => {
    show([PLAIN])
    thread().scrollTop = 77
    H = 420
    resized(thread())
    expect(thread().scrollTop).toBe(77)
  })
  it('15:12Z on 7163b55b at 1128: a first row taller than the room (374 px in 359), row open: both its choices rest just above the actions, its top is cut', () => {
    H = 476; ROWS = { 'view-reading-0': [2500, 374], 'view-reading-1': [2882, 238] }
    NEWEST = 3000 // the cap (2984) does not bind here: the range is the single value 2515
    show(held)
    openRow()
    const st = thread().scrollTop, footTop = TOP + H - FOOT
    expect(st).toBe(2500 + 374 + FOOT - 476)
    expect(TOP + 2500 + 374 - st).toBe(footTop) // the row's foot, where its two choices are, sits exactly on the actions' top
    expect(TOP + 2500 - st).toBeLessThan(TOP)   // and its first lines are above the thread's top
  })
  it('CATCH (closed, taller than the room): the same layout with the row closed rests at the reply\'s first line and moves nothing for the readings', () => {
    H = 476; ROWS = { 'view-reading-0': [2500, 374], 'view-reading-1': [2882, 238] }
    NEWEST = 3000
    show(held)
    expect(thread().scrollTop).toBe(2984) // before this change: 2515
  })
})
