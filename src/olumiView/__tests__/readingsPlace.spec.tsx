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
import { isOpen, setOpen } from './reviewRow'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
type Mark = NonNullable<View['proposal']>['marks'][number]
const held = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-452caf7a-cut13-held-marks.json'), 'utf8')) as Mark[]
const PLAIN: Mark = { what: 'Budget', status: 'not yet confirmed', title: 'A figure of Olumi’s' }

// The stubbed layout. Rows are given in the box's scroll coordinates; on screen they sit at the box's top + y - scrollTop.
const BOX_TOP = 248, CAP = 350, SCROLL_H = 1043, SHORT_ROWS: Record<string, [number, number]> = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 121] }
// `panelMax`: the most the dock's column can give the box (the thread squeezed to nothing).
let footH = 116, panelMax = 620, ROWS = SHORT_ROWS, rowH = 0
// What the pinned foot holds above the actions line (the omission list, core's refusal): 0 when nothing is shown there.
let aboveActions = 0
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
  const review = document.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')
  if (open && review !== null) { setOpen(review, true); for (const o of observers) if (o.seen.length > 0) o.fire() }
  return r
}
beforeEach(() => {
  footH = 116; panelMax = 620; ROWS = SHORT_ROWS; rowH = 0; aboveActions = 0; observers = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async () => new Response(JSON.stringify(golden), { status: 200 })) as unknown as typeof fetch)
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const id = this.getAttribute('data-testid') ?? '', b = boxOf()
    if (id === 'view-chat-pinned') return rect(BOX_TOP, boxH(this))
    if (id === 'view-proposal-foot') return rect(0, footH)
    if (id === 'view-proposal-actions') return rect(0, footH - aboveActions)
    if (id === 'view-proposal-row') return rect(BOX_TOP, rowH) // the review's sticky row, held at the box's top
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
  it('CATCH (contract 3): while the review rests closed, the held rows are not placed: the box keeps no height of ours and is not scrolled', () => {
    show(held, false)
    const b = boxOf()!
    expect(isOpen(document.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!)).toBe(false)
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
  it('19 Nov (Paul\'s test, readings under the foot): with an omission list shown in the pinned foot above the actions, the rows rest whole above the WHOLE foot', () => {
    aboveActions = 48; footH = 164 // the foot is the actions line plus the omission list above it
    show(held)
    expect(whole()).toBe(true)
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
    expect(placer().seen).toContain(screen.getByTestId('view-proposal-foot')) // the pinned foot holds the actions (fcab51e6)
    expect(placer().seen).toEqual(expect.arrayContaining([screen.getByTestId('view-reading-0'), screen.getByTestId('view-reading-1')])) // each row is watched
    footH = 168
    expect(whole()).toBe(false)
    expect(resized(screen.getByTestId('view-proposal-foot'))).toBe(1)
    expect(b.style.maxHeight).toBe('458px')
    expect(whole()).toBe(true)
  })
  it('Codex 14:3xZ: a row that grows, and a block ABOVE the rows that grows (the step\'s words), each place the rows again', () => {
    show(held)
    const b = boxOf()!
    ROWS = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 160] } // the second row grew
    expect(whole()).toBe(false)
    expect(resized(screen.getByTestId('view-reading-1'))).toBe(1)
    expect(whole()).toBe(true)
    ROWS = { 'view-reading-0': [340, 143], 'view-reading-1': [491, 160] } // the block above grew by 40 px: the rows moved down
    expect(whole()).toBe(false)
    // CHANGED BY DESIGN (17 Nov, the calm panel): the proposal's heading moved into the actions line at the foot (watched as the actions, the
    // test above). The block above the rows is now the step's own words, a direct child of the open review body.
    const heading = document.querySelector('[data-review-body] > p')!
    expect(heading.textContent).not.toBe('')
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

// CHANGED BY DESIGN (17 Nov, the calm panel): the review's row is no longer a sticky header held at the box's TOP; it is the first item of the actions line at
// the FOOT, so its height is part of the foot (`footH`) and nothing is held above the rows. Was: the rows rested between the row's foot and the actions' top, the box
// grown by the row's height too. Reverting (holding the row at the top again) adds its 44 px back to the box and moves the scroll to 248, failing this row.
describe('the review\'s row sits in the actions line at the foot, so the rows rest from the box\'s top (17 Nov, the calm panel)', () => {
  it('CATCH: the row\'s own height is not added above the rows: the rows rest whole between the box\'s top and the actions\' top', () => {
    rowH = 44
    show(held)
    const b = boxOf()!
    expect(screen.getByTestId('view-proposal-actions').contains(screen.getByTestId('view-proposal-row'))).toBe(true)
    // Needed: rows 300..572 with 8 px either side (288) and the actions (116) = 404 px of inner height; the box gives 348.
    expect(b.style.maxHeight).toBe('406px')
    expect(b.scrollTop).toBe(292) // the first row 8 px under the box's top
    const actionsTop = BOX_TOP + boxH(b) - footH
    for (const [id, [y, h]] of Object.entries(ROWS)) {
      const on = BOX_TOP + y - b.scrollTop
      expect(on, `${id} from the box's top`).toBeGreaterThanOrEqual(BOX_TOP)
      expect(on + h, `${id} above the actions`).toBeLessThanOrEqual(actionsTop)
    }
  })
})

describe('PL-1083 (1): a first row taller than the box can ever be', () => {
  it('15:12Z: both its choices rest just above the actions, its top is cut (a short window: 352 px of row, a panel that can give 420)', () => {
    ROWS = { 'view-reading-0': [300, 352], 'view-reading-1': [660, 215] }; panelMax = 420
    show(held)
    const b = boxOf()!, footTop = BOX_TOP + boxH(b) - footH
    expect(BOX_TOP + 300 + 352 - b.scrollTop).toBe(footTop - 2) // the row's foot at the actions' top (2 px of the box's border in the stub)
    expect(BOX_TOP + 300 - b.scrollTop).toBeLessThan(BOX_TOP)
  })
  it('the same under the review\'s sticky row (Codex 15 Nov round 2): the row\'s foot still rests just above the actions', () => {
    ROWS = { 'view-reading-0': [300, 352], 'view-reading-1': [660, 215] }; panelMax = 420; rowH = 44
    show(held)
    const b = boxOf()!, footTop = BOX_TOP + boxH(b) - footH
    expect(BOX_TOP + 300 + 352 - b.scrollTop).toBe(footTop - 2)
  })
})

// CHANGED BY DESIGN (17 Nov, the calm panel): a heading that wraps now makes the actions LINE taller (the row is in it), so it is the foot that is watched and the
// rows are placed again above the taller foot; was: the sticky row's own foot. Closing and reopening behave as before.
describe('the actions line across a wrapping heading, closing and opening (17 Nov, the calm panel)', () => {
  it('a heading that wraps to two lines makes the foot taller and the rows are placed again above it; closed, the box keeps no height of ours; reopened, the rows are placed again', () => {
    show(held)
    const b = boxOf()!, review = screen.getByTestId('view-proposal-review'), foot = screen.getByTestId('view-proposal-foot')
    expect(b.scrollTop).toBe(292)
    footH = 140 // the heading wraps to a second line, so the line is taller
    expect(resized(foot)).toBeGreaterThan(0)
    expect(BOX_TOP + ROWS['view-reading-1']![0] + ROWS['view-reading-1']![1] - b.scrollTop).toBeLessThanOrEqual(BOX_TOP + boxH(b) - 140)
    setOpen(review, false); for (const o of observers) if (o.seen.length > 0) o.fire()
    expect(isOpen(review)).toBe(false)
    expect(b.style.maxHeight).toBe('')
    b.scrollTop = 0
    setOpen(review, true); for (const o of observers) if (o.seen.length > 0) o.fire()
    expect(BOX_TOP + ROWS['view-reading-0']![0] - b.scrollTop).toBeGreaterThanOrEqual(BOX_TOP)
    expect(BOX_TOP + ROWS['view-reading-1']![0] + ROWS['view-reading-1']![1] - b.scrollTop).toBeLessThanOrEqual(BOX_TOP + boxH(b) - 140)
  })
})

describe('PL-1083 (1): a thread squeezed to nothing is clipped, never drawn over the box', () => {
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  it('while readings are held the thread\'s wrapper has no floor and hides what overflows it', () => {
    // Contract 3: only while the review is open (its body shown), as its rows are only then on screen.
    const sel = "[data-testid='view-chat']:has(.ok-pinned:not([hidden]) [data-foot-source=proposal]:not([hidden]) [data-review-body]:not([hidden]) [data-reading-row]) > [data-thread-wrap] {"
    const i = css.indexOf(sel)
    expect(i).toBeGreaterThanOrEqual(0)
    expect(css.slice(i, css.indexOf('}', i))).toMatch(/min-height: 0;\s*overflow: hidden/)
  })
})
