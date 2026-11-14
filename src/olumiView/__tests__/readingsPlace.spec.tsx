/**
 * PL-1083 (1), Codex 13:33Z: the PLACING of a held proposal's reading rows, driven through the real ViewChat and Proposal with the layout
 * stubbed (jsdom has none). Boxes are the 12:15Z measurement of 452caf7a's held cut13 proposal at 1232 in this look: the pinned box 350 px
 * at the stylesheet's cap, the actions 116 px, two reading rows 143 and 121 px starting 300 px down the box's scroll. What is bound here:
 * the box is grown and scrolled so both rows rest above the actions; a scroll the browser makes itself is put right; the person's own
 * scroll is left alone; the actions are watched, so a wrapped label places the rows again.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
type Mark = NonNullable<View['proposal']>['marks'][number]
const held = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-452caf7a-cut13-held-marks.json'), 'utf8')) as Mark[]
const PLAIN: Mark = { what: 'Budget', status: 'not yet confirmed', title: 'A figure of Olumi’s' }

// The stubbed layout. Rows are given in the box's scroll coordinates; on screen they sit at the box's top + y - scrollTop.
const BOX_TOP = 248, CAP = 350, SCROLL_H = 1043, ROWS: Record<string, [number, number]> = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 121] }
let footH = 116
const boxOf = () => document.querySelector<HTMLElement>('[data-testid="view-chat-pinned"]')
const boxH = (b: HTMLElement) => (b.style.maxHeight === '' ? CAP : Math.min(parseFloat(b.style.maxHeight), 620))
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
let observers: Array<{ fire: () => void; seen: Element[] }> = []

const show = (marks: Mark[]) => {
  const view: View = { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks } }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />)
}
beforeEach(() => {
  footH = 116; observers = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async () => new Response(JSON.stringify(golden), { status: 200 })) as unknown as typeof fetch)
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const id = this.getAttribute('data-testid') ?? '', b = boxOf()
    if (id === 'view-chat-pinned') return rect(BOX_TOP, boxH(this))
    if (id === 'view-proposal-actions') return rect(0, footH)
    if (ROWS[id] !== undefined && b !== null) return rect(BOX_TOP + ROWS[id]![0] - b.scrollTop, ROWS[id]![1])
    return rect(0, 0)
  }
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? boxH(this) - 2 : 0 } })
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? SCROLL_H : 0 } })
  globalThis.ResizeObserver = class { private o: { fire: () => void; seen: Element[] }; constructor(cb: ResizeObserverCallback) { this.o = { fire: () => cb([], this as unknown as ResizeObserver), seen: [] }; observers.push(this.o) } observe(e: Element) { this.o.seen.push(e) } unobserve() {} disconnect() { this.o.seen = [] } } as unknown as typeof ResizeObserver
})
afterEach(() => {
  cleanup(); setTeamFetch(null)
  HTMLElement.prototype.getBoundingClientRect = real.rect
  if (real.ch) Object.defineProperty(Element.prototype, 'clientHeight', real.ch)
  if (real.sh) Object.defineProperty(Element.prototype, 'scrollHeight', real.sh)
  globalThis.ResizeObserver = real.ro
  useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null })
})
// The one observer that watches the pinned box (the proposal's), and whether both rows are whole above the actions as the stub lays them out.
const placer = () => observers.find((o) => o.seen.includes(boxOf()!))!
const whole = () => { const b = boxOf()!, top = BOX_TOP, foot = BOX_TOP + boxH(b) - footH; return Object.values(ROWS).every(([y, h]) => BOX_TOP + y - b.scrollTop >= top && BOX_TOP + y + h - b.scrollTop <= foot) }

describe('PL-1083 (1): placing the held reading rows', () => {
  it('on arrival the box is grown by what the rows lack and scrolled so both rows rest whole above the actions', () => {
    show(held)
    const b = boxOf()!
    // Needed: rows 300..572, 8 px either side, 116 px of actions = 396 px of the box's inner height; it has 348, so 56 more than the cap.
    expect(b.style.maxHeight).toBe('406px')
    expect(b.scrollTop).toBe(292)
    expect(whole()).toBe(true)
  })
  it('CONTRAST: a proposal with no reading is not touched: no height set, no scroll, nothing watched for it', () => {
    show([PLAIN])
    const b = boxOf()!
    expect(b.style.maxHeight).toBe('')
    expect(b.scrollTop).toBe(0)
    expect(observers.some((o) => o.seen.includes(b))).toBe(false)
  })
  it('Codex (1): a scroll the browser made itself (the box resized, its scrollTop clamped) is put right at the next resize', () => {
    show(held)
    const b = boxOf()!
    b.scrollTop = 120 // not the person: no wheel, touch, key or scrollbar press
    expect(whole()).toBe(false)
    placer().fire()
    expect(b.scrollTop).toBe(292)
    expect(whole()).toBe(true)
  })
  it('Codex (1) CONTRAST: once the person scrolls the box themselves (a wheel), a later resize leaves it where they put it', () => {
    show(held)
    const b = boxOf()!
    fireEvent.wheel(b); b.scrollTop = 40
    placer().fire()
    expect(b.scrollTop).toBe(40)
  })
  it('choosing a reading with the keyboard or the pointer is not a scroll: the rows are still placed afterwards', () => {
    show(held)
    const b = boxOf()!, use = screen.getByTestId('view-reading-0-use')
    fireEvent.pointerDown(use); fireEvent.click(use); fireEvent.keyDown(use, { key: 'ArrowDown' })
    b.scrollTop = 120
    placer().fire()
    expect(b.scrollTop).toBe(292)
  })
  it('Codex (2): the actions are watched; when they grow (a label wraps to another row) the rows are placed again, still whole above them', () => {
    show(held)
    const b = boxOf()!
    expect(placer().seen).toContain(screen.getByTestId('view-proposal-actions'))
    footH = 168
    expect(whole()).toBe(false)
    placer().fire()
    expect(b.style.maxHeight).toBe('458px')
    expect(whole()).toBe(true)
  })
  it('the height is measured afresh each time: when the actions shrink back, the box gives the room back', () => {
    show(held)
    const b = boxOf()!
    footH = 168; placer().fire(); expect(b.style.maxHeight).toBe('458px')
    footH = 116; placer().fire(); expect(b.style.maxHeight).toBe('406px')
    expect(whole()).toBe(true)
  })
  it('when the proposal goes, the box keeps no height of ours', () => {
    const r = show(held)
    const b = boxOf()!
    expect(b.style.maxHeight).toBe('406px')
    useViewStore.setState({ view: { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks: [PLAIN] } } })
    r.rerender(<ViewChat />)
    expect(boxOf()!.style.maxHeight).toBe('')
  })
})
