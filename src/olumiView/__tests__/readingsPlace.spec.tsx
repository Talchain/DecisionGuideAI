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

// Contract 3 (15 Nov): the held proposal is ONE row (a <details>), closed at rest, and its rows are placed only once it is opened. So that
// every row below binds the placing of an OPEN review exactly as before, show() opens it as the person would and reports the change of size
// the browser would (each observer fires). `open = false` draws it as it rests.
const show = (marks: Mark[], open = true) => {
  const view: View = { ...golden, you: 'Paul', proposal: { ...golden.proposal!, marks } }
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  const r = render(<ViewChat />)
  const review = document.querySelector<HTMLDetailsElement>('[data-testid="view-proposal-review"]')
  if (open && review !== null) { review.open = true; for (const o of observers) if (o.seen.length > 0) o.fire() }
  return r
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
  it('CATCH (contract 3): while the review rests closed, the held rows are not placed: the box keeps no height of ours and is not scrolled', () => {
    show(held, false)
    const b = boxOf()!
    expect(document.querySelector<HTMLDetailsElement>('[data-testid="view-proposal-review"]')!.open).toBe(false)
    for (const o of observers) if (o.seen.length > 0) o.fire()
    expect(b.style.maxHeight).toBe('')
    expect(b.scrollTop).toBe(0)
  })
  it('CONTRAST: a proposal with no reading is not touched: no height set, no scroll, nothing watched for it', () => {
    show([PLAIN])
    const b = boxOf()!
    expect(b.style.maxHeight).toBe('')
    expect(b.scrollTop).toBe(0)
    expect(observers.some((o) => o.seen.includes(b))).toBe(false)
  })
  it('Codex (1): a scroll the browser made itself (the box resized, its scrollTop clamped: a scroll event with no input) is put right at the next resize', () => {
    show(held)
    const b = boxOf()!
    b.scrollTop = 120; fireEvent.scroll(b) // not the person: no wheel, touch, key or scrollbar press before it
    expect(whole()).toBe(false)
    placer().fire()
    expect(b.scrollTop).toBe(292)
    expect(whole()).toBe(true)
  })
  it('Codex (1) CONTRAST: once the person scrolls the box themselves (a wheel, then the box scrolls), a later resize leaves it where they put it', () => {
    show(held)
    const b = boxOf()!
    fireEvent.wheel(b); b.scrollTop = 40; fireEvent.scroll(b)
    placer().fire()
    expect(b.scrollTop).toBe(40)
  })
  it('the same for a scroll key and for a press held on the box\'s own scrollbar', () => {
    for (const input of [(b: HTMLElement) => fireEvent.keyDown(b, { key: 'PageDown' }), (b: HTMLElement) => fireEvent.pointerDown(b)]) {
      const r = show(held)
      const b = boxOf()!
      input(b); b.scrollTop = 60; fireEvent.scroll(b)
      placer().fire()
      expect(b.scrollTop).toBe(60)
      r.unmount(); observers = []
    }
  })
  it('Codex 13:50Z: input that scrolls nothing never stops the placing (a wheel the list takes, a sideways wheel, a press on the padding)', () => {
    show(held)
    const b = boxOf()!
    fireEvent.wheel(b); fireEvent.wheel(b, { deltaX: 40 }); fireEvent.pointerDown(b); fireEvent.pointerUp(b) // no scroll of the box follows
    footH = 168
    placer().fire()
    expect(b.style.maxHeight).toBe('458px')
    expect(whole()).toBe(true)
  })
  it('our own placing is not taken for the person\'s: the scroll event it causes, even just after their wheel, stops nothing', () => {
    show(held)
    const b = boxOf()!
    fireEvent.wheel(b); fireEvent.scroll(b) // the event for the position we set (292): ours
    b.scrollTop = 120; placer().fire()
    expect(b.scrollTop).toBe(292)
  })
  it('choosing a reading with the pointer or the keyboard is not a scroll: the rows are still placed afterwards', () => {
    show(held)
    const b = boxOf()!, use = screen.getByTestId('view-reading-0-use')
    fireEvent.pointerDown(use); fireEvent.pointerUp(use); fireEvent.click(use)
    b.scrollTop = 120
    placer().fire()
    expect(b.scrollTop).toBe(292)
  })
  it('Codex (2): the actions are watched; when they grow (a label wraps to another row) the rows are placed again, still whole above them', () => {
    show(held)
    const b = boxOf()!
    expect(placer().seen).toContain(screen.getByTestId('view-proposal-actions'))
    expect(placer().seen).toEqual(expect.arrayContaining([screen.getByTestId('view-reading-0'), screen.getByTestId('view-reading-1')])) // each row is watched
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
