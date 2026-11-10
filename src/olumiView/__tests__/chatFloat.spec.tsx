import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useChatFloat } from '../port/ChatFloat'
import { useUIStore } from '../../stores/uiStore'

const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const failed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), 'utf8'))
const show = () => useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: fixture.id, view: fixture, error: null, status: 'ready', stale: false, at: null })
const scene = () => render(<><ViewChat /><ViewComposer /></>)

beforeEach(() => {
  // Pointer coordinates are real event fields in the browser (A2 stop/float, DL 10 Nov).
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
  })
  vi.stubGlobal('innerWidth', 1232)
  vi.stubGlobal('innerHeight', 704)
  useChatFloat.setState({ floating: false, position: { x: 52, y: 78 } })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  setTeamFetch((async () => new Response(JSON.stringify(fixture), { status: 200 })) as typeof fetch)
  show()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setTeamFetch(null)
  useChatFloat.setState({ floating: false, position: { x: 52, y: 78 } })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
})

describe('A2 stop/float, DL 10 Nov', () => {
  it('CF1 moves the one thread and composer to a body portal and back, keeping typed words and thread state', () => {
    const { container, getByTestId, queryByTestId, getAllByTestId, getByRole } = scene()
    const thread = getByTestId('view-chat-turns')
    fireEvent.change(getByRole('textbox'), { target: { value: 'Keep this thought' } })
    const popout = getByTestId('view-chat-popout')
    expect(popout).toHaveAccessibleName('Open Olumi in floating panel')
    expect(popout).toHaveAttribute('title', 'Open in floating window')
    expect(popout).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    fireEvent.click(popout)
    const panel = getByTestId('view-chat-float')
    expect(panel.parentElement).toBe(document.body)
    expect(container.contains(panel)).toBe(false)
    expect(container.querySelector('[data-testid="view-chat"]')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toBe('')
    expect(getByTestId('view-chat-return')).toHaveAccessibleName('Dock to panel')
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getByTestId('view-chat-turns')).toBe(thread)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
    expect(within(panel).getByRole('textbox')).toHaveValue('Keep this thought')
    expect(within(panel).getByRole('textbox')).toHaveFocus()
    fireEvent.click(getByTestId('view-chat-dockback'))
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getByTestId('view-chat-turns')).toBe(thread)
    expect(container.contains(thread)).toBe(true)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
    expect(getByRole('textbox')).toHaveValue('Keep this thought')
    expect(getByTestId('view-chat-popout')).toHaveFocus()
  })

  it('CF2 Escape docks, activates Olumi and keeps exactly one thread', () => {
    const { getByTestId, queryByTestId, getAllByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    act(() => useUIStore.setState({ activeOutputTab: 'diagnostics' }))
    fireEvent.keyDown(within(getByTestId('view-chat-float')).getByRole('textbox'), { key: 'Escape' })
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(useChatFloat.getState().floating).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
  })

  it('CF3 a drag past every edge stays within 1232×704, and the position survives docking', () => {
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const panel = getByTestId('view-chat-float'), header = getByTestId('view-chat-float-header')
    expect(panel.style.width).toBe('380px')
    expect(panel.style.height).toBe('520px')
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 70, clientY: 90 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 4000, clientY: 4000 })
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBe(1232)
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.height)).toBe(704)
    fireEvent.pointerMove(window, { pointerId: 1, clientX: -4000, clientY: -4000 })
    expect(panel.style.left).toBe('0px')
    expect(panel.style.top).toBe('0px')
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 4000, clientY: 4000 })
    expect(useChatFloat.getState().position).toEqual({ x: 0, y: 0 })
    fireEvent.click(getByTestId('view-chat-dockback'))
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(getByTestId('view-chat-float').style.left).toBe('0px')
    expect(getByTestId('view-chat-float').style.top).toBe('0px')
  })

  it('CF4 resizing a viewport smaller than the window keeps the whole float visible', () => {
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    vi.stubGlobal('innerWidth', 320)
    vi.stubGlobal('innerHeight', 400)
    fireEvent(window, new Event('resize'))
    const panel = getByTestId('view-chat-float')
    expect(panel.style.width).toBe('320px')
    expect(panel.style.height).toBe('400px')
    expect(panel.style.left).toBe('0px')
    expect(panel.style.top).toBe('0px')
  })

  it('CF5 the tab return control docks without starting a drag', () => {
    const { getByTestId, queryByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const dock = getByTestId('view-chat-dockback')
    expect(dock).toHaveAccessibleName('Dock to panel')
    expect(dock).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    fireEvent.pointerDown(dock, { button: 0, pointerId: 1, clientX: 400, clientY: 90 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 1000, clientY: 600 })
    expect(useChatFloat.getState().position).toEqual({ x: 52, y: 78 })
    fireEvent.click(getByTestId('view-chat-return'))
    expect(queryByTestId('view-chat-float')).toBeNull()
  })

  it('CF6 floating sends through the same core composer once', async () => {
    const posts: { url: string; body: unknown }[] = []
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify(init?.method === 'POST' ? {} : fixture), { status: 200 })
    }) as typeof fetch)
    const { getByTestId, getByRole } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    fireEvent.change(getByRole('textbox'), { target: { value: 'What evidence would change this?' } })
    await act(async () => { fireEvent.click(getByTestId('view-composer-send')) })
    expect(posts).toEqual([{ url: `/api/scenarios/${fixture.id}/messages`, body: { text: 'What evidence would change this?', op: expect.any(String) } }])
    expect(getByRole('textbox')).toHaveValue('')
  })

  it('CF7 a running turn has no false stop control: core only offers draft cancellation', () => {
    useViewStore.setState({ view: { ...fixture, turn: { ...failed.turn!, status: 'answering' } } })
    const { getByTestId, queryByTestId } = scene()
    expect(queryByTestId('view-composer-stop')).toBeNull()
    expect(getByTestId('view-composer-send')).toBeDisabled()
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(queryByTestId('view-composer-stop')).toBeNull()
    expect(getByTestId('view-composer-send')).toBeDisabled()
  })
})

/**
 * Build 2 UI (10 Nov): the floated chat opened at the top left, over the question card, and left the dock open on an empty panel. Its
 * default place is the canvas's lower right; the dock shows its next tab; the Olumi tab chosen again brings the chat back.
 *
 * jsdom lays nothing out, so the page's boxes are stand-ins placed by hand: the board (`view-canvas`), the dock's column, the question
 * card (React Flow's node class) and the Model · Explore · Team row, each answering `getBoundingClientRect` with the box given. The
 * numbers are not measured from the product: the real window is the integrator's check in a browser.
 */
describe('Build 2 UI: the floated chat\'s place, and the dock it leaves', () => {
  type B = { left: number; top: number; right: number; bottom: number }
  const placed: HTMLElement[] = []
  const stand = (tag: string, attrs: Record<string, string>, b: B, into: HTMLElement = document.body) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    el.getBoundingClientRect = () => ({ ...b, x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top, toJSON: () => b }) as DOMRect
    into.appendChild(el); placed.push(el)
    return el
  }
  /** The window at `w` x `h`: the board across it, the dock's 440 px column on its right, the row and the question card at the top of the free canvas. */
  const page = (w: number, h: number, question: B, tabs = ['olumi', 'results', 'diagnostics', 'team']) => {
    vi.stubGlobal('innerWidth', w); vi.stubGlobal('innerHeight', h)
    stand('div', { 'data-testid': 'view-canvas' }, { left: 0, top: 0, right: w, bottom: h })
    const dock = stand('aside', { 'aria-label': 'Outputs dock' }, { left: w - 440, top: 0, right: w, bottom: h })
    for (const id of tabs) stand('button', { role: 'tab', 'data-testid': `outputs-dock-tab-${id}` }, { left: 0, top: 0, right: 10, bottom: 10 }, dock)
    stand('div', { 'data-testid': 'lens-bar' }, { left: 16, top: 12, right: 300, bottom: 48 })
    stand('div', { class: 'react-flow__node react-flow__node-viewQuestion' }, question)
    return { free: { left: 0, top: 0, right: w - 440, bottom: h } }
  }
  const boxOf = (el: HTMLElement): B => { const left = Number.parseFloat(el.style.left), top = Number.parseFloat(el.style.top); return { left, top, right: left + Number.parseFloat(el.style.width), bottom: top + Number.parseFloat(el.style.height) } }
  const overlaps = (a: B, b: B) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const inside = (a: B, b: B) => a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom
  const ROW: B = { left: 16, top: 12, right: 300, bottom: 48 }
  beforeEach(() => { useChatFloat.setState({ floating: false, position: null, height: null }); useUIStore.setState({ activeOutputTab: 'olumi' }) })
  afterEach(() => { for (const el of placed.splice(0)) el.remove(); useChatFloat.setState({ height: null }) })

  it('B2-1 at 1232×704 the default rectangle is the canvas\'s lower right, wholly inside the free canvas, clear of the question card and the Model · Explore · Team row', () => {
    const question: B = { left: 260, top: 64, right: 532, bottom: 156 }
    const { free } = page(1232, 704, question)
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const float = boxOf(getByTestId('view-chat-float'))
    expect(float).toEqual({ left: 400, top: 172, right: 780, bottom: 692 }) // 380×520, 12 px in from the dock's edge and the canvas's foot
    expect(inside(float, free)).toBe(true)
    expect(overlaps(float, question)).toBe(false)
    expect(overlaps(float, ROW)).toBe(false)
    // CONTRAST: the place it used to open at (52, 78) is over that question card.
    expect(overlaps({ left: 52, top: 78, right: 432, bottom: 598 }, question)).toBe(true)
  })

  it('B2-2 a question card that reaches lower: the window starts below it, shorter, its foot where it was', () => {
    const question: B = { left: 260, top: 64, right: 532, bottom: 230 }
    const { free } = page(1232, 704, question)
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const float = boxOf(getByTestId('view-chat-float'))
    expect(float).toEqual({ left: 400, top: 242, right: 780, bottom: 692 })
    expect(overlaps(float, question)).toBe(false)
    expect(inside(float, free)).toBe(true)
    // A drag moves it and never makes it taller: one pixel across leaves it clear of the card, at the same height.
    fireEvent.pointerDown(getByTestId('view-chat-float-header'), { button: 0, pointerId: 1, clientX: 500, clientY: 250 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 499, clientY: 250 })
    expect(boxOf(getByTestId('view-chat-float'))).toEqual({ left: 399, top: 242, right: 779, bottom: 692 })
    fireEvent.pointerUp(window, { pointerId: 1 })
  })

  it('B2-2b a card\'s ask that fronts Olumi while the chat floats is answered in the window: it keeps its place and takes focus, and the dock goes back to its next tab', () => {
    page(1232, 704, { left: 260, top: 64, right: 532, bottom: 156 })
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    ;(document.activeElement as HTMLElement | null)?.blur()
    act(() => useUIStore.getState().forceActivateOutputTab('olumi')) // revealOlumiSurface's route (a canvas ask)
    expect(getByTestId('view-chat-float')).toBeTruthy()
    expect(useChatFloat.getState().floating).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(within(getByTestId('view-chat-float')).getByRole('textbox')).toHaveFocus()
  })

  it('B2-3 the dock shows no empty panel while the chat floats: it moves to its next tab; docking the chat again restores the Olumi tab; the draft survives both ways', () => {
    page(1232, 704, { left: 260, top: 64, right: 532, bottom: 168 })
    const { getByTestId, queryByTestId, getByRole, getAllByTestId } = scene()
    fireEvent.change(getByRole('textbox'), { target: { value: 'Half a thought' } })
    const before = useUIStore.getState().activeOutputTabVersion
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(useUIStore.getState().activeOutputTab).toBe('results') // the tab after Olumi in the dock's own row
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before + 1) // by forced activation, the route the dock follows
    expect(within(getByTestId('view-chat-float')).getByRole('textbox')).toHaveValue('Half a thought')
    expect(getAllByTestId('view-composer')).toHaveLength(1)
    fireEvent.click(getByTestId('view-chat-dockback'))
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(getByRole('textbox')).toHaveValue('Half a thought')
    expect(getAllByTestId('view-composer')).toHaveLength(1)
  })

  it('B2-4 the Olumi tab chosen again while the chat floats brings the chat back to the dock, never an empty panel; Olumi last in the row gives the tab before it', () => {
    page(1232, 704, { left: 260, top: 64, right: 532, bottom: 168 }, ['results', 'team', 'olumi'])
    const { getByTestId, queryByTestId, getByRole } = scene()
    fireEvent.change(getByRole('textbox'), { target: { value: 'Still here' } })
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    expect(getByTestId('view-chat-float')).toBeTruthy()
    act(() => useUIStore.getState().setActiveOutputTab('olumi')) // a press on the dock's Olumi tab (OutputsDock handleTabClick)
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(useChatFloat.getState().floating).toBe(false)
    expect(getByRole('textbox')).toHaveValue('Still here')
  })

  it('B2-5 at 1024×640 the window is clamped inside the canvas: the default, a drag past every edge, and a window made smaller', () => {
    const { free } = page(1024, 640, { left: 150, top: 64, right: 422, bottom: 168 })
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const panel = getByTestId('view-chat-float')
    expect(inside(boxOf(panel), free)).toBe(true)
    expect(boxOf(panel).right).toBe(1024 - 440 - 12)
    fireEvent.pointerDown(getByTestId('view-chat-float-header'), { button: 0, pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 4000, clientY: 4000 })
    expect(boxOf(panel)).toEqual({ left: 204, top: 192, right: 584, bottom: 640 }) // never over the dock's column; the height it opened at (448, below the card) is kept
    fireEvent.pointerMove(window, { pointerId: 1, clientX: -4000, clientY: -4000 })
    expect(boxOf(panel)).toEqual({ left: 0, top: 0, right: 380, bottom: 448 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    vi.stubGlobal('innerWidth', 760); vi.stubGlobal('innerHeight', 480)
    for (const el of placed.splice(0)) el.remove()
    const small = page(760, 480, { left: 20, top: 64, right: 292, bottom: 168 })
    fireEvent(window, new Event('resize'))
    expect(inside(boxOf(getByTestId('view-chat-float')), small.free)).toBe(true)
    expect(boxOf(getByTestId('view-chat-float'))).toEqual({ left: 0, top: 0, right: 320, bottom: 448 })
  })

  it('must not change: with no board on the page the window is clamped to the browser window, and a place the person gave it is kept', () => {
    useChatFloat.setState({ position: { x: 52, y: 78 } })
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(boxOf(getByTestId('view-chat-float'))).toEqual({ left: 52, top: 78, right: 432, bottom: 598 })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi') // no dock row on the page: nothing to move to
  })
})
