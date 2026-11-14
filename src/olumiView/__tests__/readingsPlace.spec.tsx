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
const BOX_TOP = 248, CAP = 350, SCROLL_H = 1043, SHORT_ROWS: Record<string, [number, number]> = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 121] }
// `panelMax`: the most the dock's column can give the box (the thread squeezed to nothing).
let footH = 116, panelMax = 620, ROWS = SHORT_ROWS
const boxOf = () => document.querySelector<HTMLElement>('[data-testid="view-chat-pinned"]')
const boxH = (b: HTMLElement) => (b.style.maxHeight === '' ? CAP : Math.min(parseFloat(b.style.maxHeight), panelMax))
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
let observers: Array<{ fire: () => void; seen: Element[] }> = []

const show = (marks: Mark[]) => {
  const view: View = { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks } }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />)
}
beforeEach(() => {
  footH = 116; panelMax = 620; ROWS = SHORT_ROWS; observers = []
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
// A size change of ONE element, as the browser reports it: only the observers watching that element hear of it (Codex 14:3xZ).
const resized = (e: Element) => { const heard = observers.filter((o) => o.seen.includes(e)); for (const o of heard) o.fire(); return heard.length }
const wholeRow = (id: string) => { const b = boxOf()!, foot = BOX_TOP + boxH(b) - footH, [y, h] = ROWS[id]!; return BOX_TOP + y - b.scrollTop >= BOX_TOP && BOX_TOP + y + h - b.scrollTop <= foot }
const whole = () => Object.keys(ROWS).every(wholeRow)

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
  it('THE RULE: whatever moved the box (the browser clamping it, or the person), the next change of layout puts the rows back whole above the actions', () => {
    for (const how of [(b: HTMLElement) => { b.scrollTop = 120; fireEvent.scroll(b) }, (b: HTMLElement) => { fireEvent.wheel(b); b.scrollTop = 40; fireEvent.scroll(b) }, (b: HTMLElement) => { fireEvent.keyDown(b, { key: 'PageDown' }); b.scrollTop = 900; fireEvent.scroll(b) }]) {
      const r = show(held)
      const b = boxOf()!
      how(b)
      expect(whole()).toBe(false)
      placer().fire()
      expect(b.scrollTop).toBe(292)
      expect(whole()).toBe(true)
      r.unmount(); observers = []
    }
  })
  it('THE RULE, the other half: with no change of layout nothing is moved; what the person scrolls to stands', () => {
    show(held)
    const b = boxOf()!
    fireEvent.wheel(b); b.scrollTop = 40; fireEvent.scroll(b)
    fireEvent.pointerDown(b); fireEvent.pointerUp(b); fireEvent.keyDown(b, { key: 'ArrowDown' })
    expect(b.scrollTop).toBe(40) // no listener of ours answers their input: only a size change places
  })
  it('a change of layout that leaves the rows whole moves nothing (the least move is none)', () => {
    show(held)
    const b = boxOf()!
    placer().fire(); placer().fire()
    expect(b.scrollTop).toBe(292)
    expect(b.style.maxHeight).toBe('406px')
  })
  it('Codex (2): the actions are watched; when they grow (a label wraps to another row) the rows are placed again, still whole above them', () => {
    show(held)
    const b = boxOf()!
    expect(placer().seen).toContain(screen.getByTestId('view-proposal-actions'))
    expect(placer().seen).toEqual(expect.arrayContaining([screen.getByTestId('view-reading-0'), screen.getByTestId('view-reading-1')])) // each row is watched
    footH = 168
    expect(whole()).toBe(false)
    expect(resized(screen.getByTestId('view-proposal-actions'))).toBe(1)
    expect(b.style.maxHeight).toBe('458px')
    expect(whole()).toBe(true)
  })
  it('Codex 14:3xZ: a row that grows, and a block ABOVE the rows that grows (the proposal\'s heading), each place the rows again', () => {
    show(held)
    const b = boxOf()!
    ROWS = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 160] } // the second row grew
    expect(whole()).toBe(false)
    expect(resized(screen.getByTestId('view-reading-1'))).toBe(1)
    expect(whole()).toBe(true)
    ROWS = { 'view-reading-0': [340, 143], 'view-reading-1': [491, 160] } // the heading above grew by 40 px: the rows moved down
    expect(whole()).toBe(false)
    const heading = document.querySelector('[data-view="proposal.heading"]')!.parentElement!
    expect(resized(heading)).toBe(1)
    expect(whole()).toBe(true)
    expect(b.scrollTop).toBe(332)
  })
  it('Codex 14:3xZ: the least move is from where the box IS: a place inside the range is left exactly where it is', () => {
    panelMax = 700; footH = 60 // room to spare: the range has an inside
    show(held)
    const b = boxOf()!
    const low = b.scrollTop
    b.scrollTop = low + 0; expect(whole()).toBe(true)
    ROWS = { 'view-reading-0': [300, 100], 'view-reading-1': [408, 90] } // the rows shrank: now any scrollTop from 218 to 292 shows both whole
    b.scrollTop = 250
    resized(b)
    expect(b.scrollTop).toBe(250)
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
  it('Codex 13:50Z: rows that are replaced (the marks shift, the same reading ids) are watched again', () => {
    const r = show(held)
    useViewStore.setState({ view: { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks: [PLAIN, ...held] } } })
    r.rerender(<ViewChat />)
    expect(placer().seen).toEqual(expect.arrayContaining([screen.getByTestId('view-reading-1'), screen.getByTestId('view-reading-2')]))
  })
  it('13:50Z on 7163b55b, long words (rows of 352 and 215 px) in a panel that can give 505 px: the box takes what there is, the first row rests whole above the actions, the second is reached by scrolling', () => {
    ROWS = { 'view-reading-0': [300, 352], 'view-reading-1': [660, 215] }; panelMax = 505
    show(held)
    const b = boxOf()!
    expect(boxH(b)).toBe(505)
    expect(wholeRow('view-reading-0')).toBe(true)
    expect(wholeRow('view-reading-1')).toBe(false)
    expect(b.scrollTop).toBe(652 + 8 + 116 - 503) // the first row's foot just clear of the actions
  })
})

describe('PL-1083 (1): a thread squeezed to nothing is clipped, never drawn over the box', () => {
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  it('while readings are held the thread\'s wrapper has no floor and hides what overflows it', () => {
    const sel = "[data-testid='view-chat']:has(.ok-pinned [data-reading-row]) > [data-thread-wrap] {"
    const i = css.indexOf(sel)
    expect(i).toBeGreaterThanOrEqual(0)
    expect(css.slice(i, css.indexOf('}', i))).toMatch(/min-height: 0;\s*overflow: hidden/)
  })
})
