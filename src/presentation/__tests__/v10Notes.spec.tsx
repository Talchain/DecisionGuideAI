/**
 * v10 (#/canvas2): Olumi's coaching note is pinned beside the record it concerns, and a note about nothing never sits outside
 * the visible canvas (design QA 8, 1 Nov 2026: the note floated at the bottom while the focus ring sat on the card, and at 1280
 * it was clipped on the left and under the zoom controls). #/canvas is unchanged.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PresentationProvider, type Presentation } from '../v10'
import { clampIntoBounds, connectorBetween, placeNoteBeside, useKeepInView, type Bounds } from '../v10Note'
import { V10FocusNote, V10_FOCUS_NOTE_TESTID } from '../V10FocusNote'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID } from '../../canvas/components/OlumiAttentionCard'
import { activateAssistantFocus, dismissAssistantFocus } from '../../canvas/stores/assistantFocusStore'
import { useCanvasStore } from '../../canvas/store'

const camera = vi.hoisted(() => ({ transform: [0, 0, 1] as [number, number, number] }))
vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: camera.transform }),
}))
vi.mock('../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: () => undefined }))
vi.mock('../../canvas/conversation/askAi', () => ({ askAi: () => 'sent' }))
vi.mock('../../canvas/conversation/revealOlumi', () => ({ revealOlumiSurface: () => undefined }))
vi.mock('../../canvas/components/FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))

type R = { left: number; top: number; right: number; bottom: number; width: number; height: number }
const CANVAS: R = { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }
const ZOOM_CONTROLS: R = { left: 8, top: 612, right: 60, bottom: 772, width: 52, height: 160 }
const NOTE_H = 110

function setRect(el: Element, r: R) {
  el.getBoundingClientRect = () => ({ ...r, x: r.left, y: r.top, toJSON: () => r }) as DOMRect
}
/** A ResizeObserver jsdom lacks: it records what is watched, and a test fires it. */
const watchers: Array<{ cb: () => void; seen: Element[] }> = []
class FakeResizeObserver {
  private w = { cb: () => undefined as void, seen: [] as Element[] }
  constructor(cb: () => void) { this.w.cb = cb; watchers.push(this.w) }
  observe(el: Element) { this.w.seen.push(el) }
  unobserve() { /* unused */ }
  disconnect() { watchers.splice(watchers.indexOf(this.w), 1) }
}
let frame: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  // jsdom has no layout: the canvas frame is 1280x800, a note is 110px tall, the zoom controls sit at the lower left.
  frame = document.createElement('div')
  setRect(frame, CANVAS)
  document.body.appendChild(frame)
  const controls = document.createElement('nav')
  controls.setAttribute('aria-label', 'Viewport controls')
  setRect(controls, ZOOM_CONTROLS)
  document.body.appendChild(controls)
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(() => frame)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => NOTE_H)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => 260)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  watchers.length = 0
  vi.restoreAllMocks()
  document.body.replaceChildren()
  camera.transform = [0, 0, 1]
  dismissAssistantFocus()
  useCanvasStore.setState({ olumiAttention: null, nodes: [], edges: [] })
})

const inPresentation = (value: Presentation, ui: ReactNode) => (
  <MemoryRouter><PresentationProvider value={value}>{ui}</PresentationProvider></MemoryRouter>
)
const node = (id: string, x: number, y: number, w = 200, h = 80) =>
  ({ id, type: 'factor', position: { x, y }, measured: { width: w, height: h }, data: { label: 'Per specialist' } }) as never
const leftOf = (el: HTMLElement) => parseFloat(el.style.left)
const topOf = (el: HTMLElement) => parseFloat(el.style.top)
/** The visible canvas at 1280x800 clear of the zoom controls (right edge 60) with a 14px margin: what the notes must stay inside. */
const VISIBLE: Bounds = { left: 60 + 14, top: 14, right: 1280 - 14, bottom: 800 - 14 }

describe('the placement is pure geometry', () => {
  const size = { w: 290, h: NOTE_H }
  it('stands on the side with the most room, and a short connector meets the record', () => {
    const anchor = { x: 800, y: 300, w: 200, h: 80 }
    const spot = placeNoteBeside(anchor, size, [], VISIBLE)
    expect(spot.side, 'more room on its left than its right').toBe('left')
    const line = connectorBetween(anchor, { x: spot.left, y: spot.top, w: size.w, h: size.h })
    expect(line).not.toBeNull()
    expect(line!.x1).toBe(anchor.x)
    expect(Math.hypot(line!.x2 - line!.x1, line!.y2 - line!.y1)).toBeLessThanOrEqual(14 + 1)
  })

  it('a record at the left edge is never answered by a note under the zoom controls', () => {
    const spot = placeNoteBeside({ x: 0, y: 650, w: 200, h: 80 }, size, [], VISIBLE)
    expect(spot.left).toBeGreaterThanOrEqual(VISIBLE.left)
    expect(spot.left + size.w).toBeLessThanOrEqual(VISIBLE.right)
    expect(spot.top).toBeGreaterThanOrEqual(VISIBLE.top)
    expect(spot.top + size.h).toBeLessThanOrEqual(VISIBLE.bottom)
  })

  it('a note about nothing, clamped, is moved off the controls and the edge; one already inside does not move', () => {
    expect(clampIntoBounds({ x: 20, y: 700, w: 260, h: 60 }, VISIBLE)).toEqual({ left: 74, top: 700 })
    expect(clampIntoBounds({ x: 1100, y: 770, w: 260, h: 60 }, VISIBLE)).toEqual({ left: 1006, top: 726 })
    expect(clampIntoBounds({ x: 400, y: 400, w: 260, h: 60 }, VISIBLE)).toEqual({ left: 400, top: 400 })
  })
})

describe('Olumi’s coaching note in v10', () => {
  const hold = (x: number, y = 300) => useCanvasStore.setState({
    nodes: [node('per', x, y)], edges: [],
    olumiAttention: { nodeIds: ['per'], edgeIds: [], note: { title: 'Check this', body: 'Most of the chance rests on it.' }, caveat: null, turnId: null, modelVersion: null },
  })
  const card = () => screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)

  it('is pinned beside the record and follows it: the card moves, the camera zooms, the note goes with them', () => {
    hold(400)
    const view = render(inPresentation('v10', <OlumiAttentionCard />))
    expect(card().getAttribute('data-v10-note')).toBe('anchored')
    expect(card().className).toContain('border-info')
    expect(screen.getByTestId('v10-note-connector')).toBeTruthy()
    const first = leftOf(card())
    expect(first, 'beside the record (right of it: 400 + 200 + gap)').toBe(614)
    useCanvasStore.setState({ nodes: [node('per', 450, 300)] })
    view.rerender(inPresentation('v10', <OlumiAttentionCard />))
    expect(leftOf(card()), 'the record moved 50px right; so did the note').toBe(first + 50)
    camera.transform = [0, 0, 0.5]
    view.rerender(inPresentation('v10', <OlumiAttentionCard />))
    expect(leftOf(card()), 'zoomed to 0.5: 450 * 0.5 + 200 * 0.5 + gap').toBe(339)
  })

  it('hemmed in at the lower left, it stays inside the visible canvas: not under the zoom controls, off the edge or over a neighbour', () => {
    // The record is at the lower left with a neighbour to its right, so the left side (x -4) and the right are both closed.
    useCanvasStore.setState({
      nodes: [node('per', 300, 650), node('next', 514, 560, 700, 240)], edges: [],
      olumiAttention: { nodeIds: ['per'], edgeIds: [], note: { title: 'Check this', body: 'Most of the chance rests on it.' }, caveat: null, turnId: null, modelVersion: null },
    })
    render(inPresentation('v10', <OlumiAttentionCard />))
    const [l, t] = [leftOf(card()), topOf(card())]
    expect(l, 'not under the zoom controls (right edge 60)').toBeGreaterThanOrEqual(VISIBLE.left)
    expect(t, 'not above the canvas').toBeGreaterThanOrEqual(VISIBLE.top)
    expect(t + NOTE_H, 'not below it').toBeLessThanOrEqual(VISIBLE.bottom)
    expect(l + 290, 'not past its right edge').toBeLessThanOrEqual(VISIBLE.right)
    const overNeighbour = l < 514 + 700 && l + 290 > 514 && t < 560 + 240 && t + NOTE_H > 560
    expect(overNeighbour, 'not over the next card').toBe(false)
  })

  it('CONTRAST: #/canvas keeps its own placement and look', () => {
    hold(400)
    render(inPresentation('current', <OlumiAttentionCard />))
    expect(card().hasAttribute('data-v10-note')).toBe(false)
    expect(card().className).toContain('border-panel-border')
    expect(card().querySelector('[data-testid="v10-note-connector"]')).toBeNull()
    expect(card().style.width).toBe('268px')
  })
})

describe('Olumi’s focus in v10', () => {
  const focus = () => act(() => activateAssistantFocus({ id: 'per', kind: 'node', label: 'per specialist' }))

  it('is a note beside the card the focus ring is on, and follows it', () => {
    useCanvasStore.setState({ nodes: [node('per', 400, 300)] })
    const view = render(inPresentation('v10', <V10FocusNote />))
    focus()
    const note = screen.getByTestId(V10_FOCUS_NOTE_TESTID)
    expect(note.textContent).toContain('Olumi is looking at Per specialist')
    expect(note.className).toContain('border-info')
    const first = leftOf(note)
    expect(first).toBeGreaterThan(400 + 200)
    useCanvasStore.setState({ nodes: [node('per', 300, 300)] })
    view.rerender(inPresentation('v10', <V10FocusNote />))
    expect(leftOf(screen.getByTestId(V10_FOCUS_NOTE_TESTID)), 'the card moved 100px left; the note went with it').toBe(first - 100)
  })

  it('a link is anchored on its drawn path, not on the middle of its two cards (which can fall inside a card it is routed around)', () => {
    // A -> B routed below C: the centres' midpoint (500, 340) is inside C; the drawn path's midpoint is (400, 560).
    useCanvasStore.setState({
      nodes: [node('a', 0, 300, 200, 80), node('b', 800, 300, 200, 80), node('c', 300, 280, 400, 120)],
      edges: [{ id: 'e', source: 'a', target: 'b' } as never],
    })
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'react-flow__edge')
    g.setAttribute('data-id', 'e')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'react-flow__edge-path')
    Object.assign(path, { getTotalLength: () => 100, getPointAtLength: () => ({ x: 400, y: 560 }) })
    g.appendChild(path)
    document.body.appendChild(g)
    render(inPresentation('v10', <V10FocusNote />))
    act(() => activateAssistantFocus({ id: 'e', kind: 'edge', label: 'a to b' }))
    const note = screen.getByTestId(V10_FOCUS_NOTE_TESTID)
    const line = screen.getByTestId('v10-note-connector').querySelector('line')!
    const at = { x: leftOf(note) + Number(line.getAttribute('x1')), y: topOf(note) + Number(line.getAttribute('y1')) }
    expect(at, 'the connector starts on the drawn path').toEqual({ x: 400, y: 560 })
  })

  describe('when the room changes size', () => {
    const dockAt = (left: number) => {
      const dock = document.createElement('aside')
      dock.setAttribute('aria-label', 'Outputs dock')
      setRect(dock, { left, top: 0, right: 1280, bottom: 800, width: 1280 - left, height: 800 })
      document.body.appendChild(dock)
    }
    const fire = () => act(() => { window.dispatchEvent(new Event('resize')) })

    it('the window resizing re-places the note: a dock that widens after the note is up does not leave it underneath', () => {
      useCanvasStore.setState({ nodes: [node('per', 400, 300)] })
      render(inPresentation('v10', <V10FocusNote />))
      focus()
      expect(leftOf(screen.getByTestId(V10_FOCUS_NOTE_TESTID)), 'room on the right: beside the card, to its right').toBe(614)
      dockAt(700)
      fire()
      const note = screen.getByTestId(V10_FOCUS_NOTE_TESTID)
      expect(leftOf(note) + 260, 'wholly left of the dock (700) less the margin').toBeLessThanOrEqual(700 - 14)
    })

    it('the canvas frame or the dock changing size, seen by the resize observer, re-places it too', () => {
      useCanvasStore.setState({ nodes: [node('per', 400, 300)] })
      render(inPresentation('v10', <V10FocusNote />))
      focus()
      expect(watchers.length, 'it is watching').toBeGreaterThan(0)
      expect(watchers.some((w) => w.seen.includes(frame)), 'the canvas frame is watched').toBe(true)
      setRect(frame, { ...CANVAS, right: 900, width: 900 })
      act(() => { watchers.forEach((w) => w.cb()) })
      expect(leftOf(screen.getByTestId(V10_FOCUS_NOTE_TESTID)) + 260, 'inside the narrower canvas').toBeLessThanOrEqual(900 - 14)
    })
  })

  it('one note at a time: while Olumi’s coaching note is open, the focus note steps aside', () => {
    useCanvasStore.setState({
      nodes: [node('per', 400, 300)],
      olumiAttention: { nodeIds: ['per'], edgeIds: [], note: { body: 'Most of the chance rests on it.' }, caveat: null, turnId: null, modelVersion: null },
    })
    render(inPresentation('v10', <V10FocusNote />))
    focus()
    expect(screen.queryByTestId(V10_FOCUS_NOTE_TESTID)).toBeNull()
  })

  it('CONTRAST: #/canvas draws no focus note (its pill stays in the band)', () => {
    useCanvasStore.setState({ nodes: [node('per', 400, 300)] })
    render(inPresentation('current', <V10FocusNote />))
    focus()
    expect(screen.queryByTestId(V10_FOCUS_NOTE_TESTID)).toBeNull()
  })
})

describe('a note about no record keeps its place and is held inside the visible canvas', () => {
  // The occupant's rect moves with the translate the hook applied, as in a browser.
  const translated = (el: HTMLElement, r: R): R => {
    const m = /translate\((-?\d+)px, (-?\d+)px\)/.exec(el.style.transform)
    const [dx, dy] = m ? [Number(m[1]), Number(m[2])] : [0, 0]
    return { ...r, left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy }
  }
  function Occupant({ at, active }: { at: R; active: boolean }) {
    const holder = { current: null as HTMLElement | null }
    const style = useKeepInView(holder, active)
    return <div data-testid="unanchored" ref={(el) => { holder.current = el; if (el) setRect(el, translated(el, at)) }} style={style}>Olumi’s note</div>
  }
  const inBand = (at: R, active = true) => render(<div data-canvas-overlay-band=""><Occupant at={at} active={active} /></div>)
  const shift = () => {
    const m = /translate\((-?\d+)px, (-?\d+)px\)/.exec(screen.getByTestId('unanchored').style.transform)
    return m ? { dx: Number(m[1]), dy: Number(m[2]) } : null
  }

  it('one under the zoom controls and past the left edge is moved wholly inside', () => {
    inBand({ left: -40, top: 700, right: 220, bottom: 760, width: 260, height: 60 })
    const s = shift()
    expect(s, 'nudged').not.toBeNull()
    expect(-40 + s!.dx, 'clear of the controls (their right edge plus the margin)').toBeGreaterThanOrEqual(VISIBLE.left)
  })

  it('the dock widening after it is placed moves it clear of the dock (a real window resize, no re-render by hand)', () => {
    inBand({ left: 900, top: 700, right: 1160, bottom: 760, width: 260, height: 60 })
    expect(shift(), 'inside while nothing is in the way').toBeNull()
    const dock = document.createElement('aside')
    dock.setAttribute('aria-label', 'Outputs dock')
    setRect(dock, { left: 1000, top: 0, right: 1280, bottom: 800, width: 280, height: 800 })
    document.body.appendChild(dock)
    act(() => { window.dispatchEvent(new Event('resize')) })
    const s = shift()
    expect(s, 'moved').not.toBeNull()
    expect(1160 + s!.dx, 'its right edge is left of the dock (1000) less the margin').toBeLessThanOrEqual(1000 - 14)
  })

  it('CONTRAST: one already inside the visible canvas is left where it is', () => {
    inBand({ left: 500, top: 700, right: 760, bottom: 760, width: 260, height: 60 })
    expect(shift()).toBeNull()
  })

  it('CONTRAST: switched off (the current design), nothing is moved', () => {
    inBand({ left: -40, top: 700, right: 220, bottom: 760, width: 260, height: 60 }, false)
    expect(shift()).toBeNull()
  })
})
