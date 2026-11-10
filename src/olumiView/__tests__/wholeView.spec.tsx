/**
 * Paul, 10 Nov 2026: "Board at first open: the whole model in view, as the previous product did." Bound to the real hiring board (19 cards,
 * two aims; fixtures/real/hiring.view3.json) at 1232 x 704 with the dock open:
 * - the first fit puts every card and the question inside the free canvas (before: it opened at the readable floor and the person panned);
 * - zoomed out (below READABLE_WHOLE_ZOOM) a card draws its reduced face, its heading (and an option its headline chance) at a size that draws
 *   at 11 px or more, core's words verbatim; from READABLE_WHOLE_ZOOM, or opened, the full face as before;
 * - the notice says so and zooms in; Model · Explore · Team sits clear of the dock and is opaque (row 19); one brief box on a blank scenario (row 22).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi, type Node, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { causalPlaces, CARD_WIDTH, QUESTION, questionPlace } from '../layout'
import { READABLE_WHOLE_ZOOM, REDUCED_TEXT_PX, reducedFaceSize } from '../camera'
import { frameFor } from '../ViewCanvas'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewCardV10 } from '../v10'
import { ViewQuestionNode } from '../../canvas/nodes/ViewQuestionNode'
import { ViewLensBar } from '../ViewLensBar'
import { DockComposer, ViewWelcome } from '../ViewWelcome'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useCanvasStore } from '../../canvas/store'

afterEach(() => { cleanup(); useViewStore.setState({ view: null, sid: null, uuid: null, at: null }); useCanvasStore.setState({ currentScenarioId: undefined } as never) })
const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hiring.view3.json'), 'utf8'))
const model = view.model!

describe('the whole board is in view at first open', () => {
  // 1232 x 704, dock open (it starts at x 869), top bar and Model · Explore · Team row to y 104, left toolbar to x 45.
  const pane = { width: 1232, height: 704 }, free = { top: 104, right: 363, bottom: 26, left: 45 }
  it('hiring (19 cards): every card and the question are inside the free canvas at the first fit', async () => {
    const places = await causalPlaces(model, new Map())
    const q = questionPlace(model)
    const boxes = [{ id: QUESTION, ...places.get(QUESTION)!, w: q.width, h: 85 }, ...model.cards.map((c) => ({ id: c.id, ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    expect(boxes.length, 'precondition: a real tall board').toBeGreaterThanOrEqual(19)
    const nodes: Node[] = boxes.map((b) => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } }))
    const v = frameFor(nodes, pane, free)!
    expect(v.zoom, 'zoomed out: the reduced face is what is drawn').toBeLessThan(READABLE_WHOLE_ZOOM)
    for (const b of boxes) {
      const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y, r = l + b.w * v.zoom, d = t + b.h * v.zoom
      expect([b.id, l >= free.left - 0.5, t >= free.top - 0.5, r <= pane.width - free.right + 0.5, d <= pane.height - free.bottom + 0.5]).toEqual([b.id, true, true, true, true])
    }
  })
})

describe('a card zoomed out draws its reduced face', () => {
  it('reducedFaceSize: none from the readable zoom up; below it a size that draws at 12 px or more', () => {
    expect([reducedFaceSize(1), reducedFaceSize(READABLE_WHOLE_ZOOM), reducedFaceSize(NaN)]).toEqual([0, 0, 0])
    for (const z of [0.9, 0.7, 0.5, 0.4, 0.25]) expect(reducedFaceSize(z) * z, String(z)).toBeGreaterThanOrEqual(REDUCED_TEXT_PX)
  })
  const option = model.cards.find((c) => c.id === 'hire_tech_lead')!
  it('an option: its heading and its chance (the headline, else its lead chance), core words, at 24 px declared (12 px drawn at 0.5); the full face is hidden, not removed', () => {
    const px = reducedFaceSize(0.5)
    const box = render(<ViewCard card={option} reducedPx={px} />).container.querySelector<HTMLElement>('[data-view-card]')!
    const face = box.querySelector<HTMLElement>('[data-reduced-face]')!
    expect(face.style.fontSize).toBe(`${px}px`)
    expect(face.querySelector(`[data-view-reduced-title]`)!.textContent).toBe(option.face?.title?.text ?? option.heading)
    const lead = option.rows.find((r) => r.kind === 'chance') as { approx: string; value: string }
    expect(option.headline?.text ?? null, "precondition: hiring option has no headline; its lead chance is its face").toBeNull()
    expect(face.querySelector(`[data-view-reduced-headline]`)!.textContent).toBe(`${lead.approx}${lead.value}`)
    expect(box.hasAttribute('data-reduced')).toBe(true)
    expect(box.querySelector(`[data-view="${option.id}.rows.0.value"]`)).not.toBeNull()
  })
  it('CONTRAST: at the readable zoom (reducedPx 0) the full face only, as before', () => {
    const box = render(<ViewCard card={option} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(box.querySelector('[data-reduced-face]')).toBeNull()
    expect(box.hasAttribute('data-reduced')).toBe(false)
  })
  const draw = (zoom: number, selected: boolean) => {
    const Zoom = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, zoom] }); return null }
    return render(<ReactFlowProvider><Zoom /><ViewCardV10 {...({ id: option.id, data: { card: option, label: option.heading }, selected, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
  }
  it('on the canvas: zoom 0.5 draws the reduced face; zoom 1 the full face', () => {
    expect(draw(0.5, false).querySelector('[data-reduced-face]')).not.toBeNull()
    cleanup()
    expect(draw(1, false).querySelector('[data-reduced-face]')).toBeNull()
  })
  // DL 10 Nov (seen on Build 1b): selecting a card at the overview swapped it to its full face, drawn at about 5 px. A selected card keeps its
  // reduced face, with the selection outline; no Olumi control (small) is drawn; its details are in the dock.
  it('at zoom 0.449 a selected card keeps its reduced face (12 px as drawn, outlined) and draws no text under 12 px: the full face stays hidden, no controls', () => {
    const c = draw(0.449, true), face = c.querySelector<HTMLElement>('[data-reduced-face]')!
    expect(face, 'reduced while selected').not.toBeNull()
    expect(face.className).toContain('ring-text-header')
    expect(parseFloat(face.style.fontSize) * 0.449).toBeGreaterThanOrEqual(REDUCED_TEXT_PX)
    expect(c.querySelector('[data-view-card]')!.hasAttribute('data-reduced'), 'the CSS rule hides every other child').toBe(true)
    expect(c.querySelector('[data-olumi-controls]')).toBeNull()
    cleanup()
    expect(draw(0.449, false).querySelector('[data-reduced-face]')!.className, 'CONTRAST: unselected has no outline').not.toContain('ring-text-header')
  })
  it('the question: its text alone, drawn at 12 px or more', () => {
    const Zoom = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, 0.4] }); return null }
    const { container } = render(<ReactFlowProvider><Zoom /><ViewQuestionNode {...({ id: QUESTION, data: { question: model.question, width: 600 } } as unknown as NodeProps)} /></ReactFlowProvider>)
    const p = container.querySelector<HTMLElement>('[data-view-reduced-question]')!
    expect(p.textContent).toBe(model.question.text)
    expect(parseFloat(container.querySelector<HTMLElement>('[data-reduced-face]')!.style.fontSize) * 0.4).toBeGreaterThanOrEqual(REDUCED_TEXT_PX)
  })
})

describe('the top controls are opaque and clear of the dock (rows 2 and 19)', () => {
  it('Model · Explore · Team: the unpressed chips have an opaque fill (card text never shows through), all three drawn at the pill\'s left, clear of the dock at 1232', () => {
    window.innerWidth = 1232
    const pill = document.createElement('div'); pill.setAttribute('role', 'banner')
    pill.getBoundingClientRect = () => ({ left: 12, right: 908, top: 12, bottom: 57, width: 896, height: 45, x: 12, y: 12, toJSON: () => ({}) })
    const dock = document.createElement('aside'); dock.setAttribute('aria-label', 'Outputs dock')
    dock.getBoundingClientRect = () => ({ left: 869, right: 1232, top: 0, bottom: 704, width: 363, height: 704, x: 869, y: 0, toJSON: () => ({}) })
    document.body.append(pill, dock)
    useViewStore.setState({ view })
    render(<ViewLensBar nav />)
    const bar = screen.getByTestId('lens-bar')
    expect([bar.style.left, bar.style.top, bar.style.visibility]).toEqual(['12px', '65px', 'visible'])
    for (const id of ['explore', 'team']) { const b = screen.getByTestId(`lens-bar-${id}`); expect(b.className, id).toContain('bg-canvas'); expect(b.className, id).not.toContain('bg-transparent') }
    const team = screen.getByTestId('lens-bar-team')
    expect(team.hasAttribute('disabled')).toBe(false)
    fireEvent.click(team)
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    pill.remove(); dock.remove()
  })
})

describe('a blank scenario shows one brief box (row 22)', () => {
  it('while the welcome composer is shown the dock draws no composer; once a model exists the dock draws its own', () => {
    useCanvasStore.setState({ currentScenarioId: 'scn-1' } as never)
    useViewStore.setState({ view: null, sid: null, uuid: 'scn-1', at: null })
    const both = render(<><ViewWelcome /><DockComposer /></>).container
    expect(both.querySelectorAll('textarea').length).toBe(1)
    cleanup()
    useViewStore.setState({ view, sid: 's1', uuid: 'scn-1', at: null })
    const dockOnly = render(<><ViewWelcome /><DockComposer /></>).container
    expect(dockOnly.querySelector('[data-testid="view-welcome"]')).toBeNull()
    expect(dockOnly.querySelectorAll('textarea').length).toBe(1)
  })
})

// DL ruling 10 Nov (first screen look at hiring: reduced faces grew past their boxes and were covered by neighbours): a reduced face never
// leaves its own card's box; the chance is always whole on its own line, and the heading gives way first. jsdom has no layout, so the box
// height and the chance line's height are given to it (the card's own height from core, the chance at its worst: two lines); what is
// asserted is what the face does with them.
describe('a reduced face stays inside its own card (hiring, 1232 x 704, dock open)', () => {
  const heightOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'), tailOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  const px = 27 // hiring's first fit is zoom 0.449 (the first row above); 12 px as drawn
  const stub = (h: Map<string, number>) => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return h.get(this.getAttribute('data-view-card') ?? '') ?? 0 } })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-reduced-chance') ? 2 * px * 1.15 : 0 } })
  }
  afterEach(() => {
    if (heightOf) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightOf); else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
    if (tailOf) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', tailOf); else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
  })
  it('every card: the face fills only its box (no growth), and its whole heading lines plus its chance line fit the box height', () => {
    stub(new Map(model.cards.map((c) => [c.id, c.h])))
    for (const c of model.cards) {
      const box = render(<ViewCard card={c} reducedPx={px} />).container.querySelector<HTMLElement>('[data-view-card]')!
      const face = box.querySelector<HTMLElement>('[data-reduced-face]')!, heading = face.querySelector<HTMLElement>('[data-reduced-heading]')!
      expect(face.className, c.id).toContain('inset-0')
      expect(face.className, c.id).toContain('overflow-hidden')
      expect(face.className, c.id).not.toMatch(/min-h/)
      const lines = Number(heading.style.webkitLineClamp), chance = face.querySelector('[data-reduced-chance]') === null ? 0 : 2 * px * 1.15
      expect(lines, c.id).toBeGreaterThanOrEqual(1)
      expect(lines * px * 1.15 + chance + 12 <= c.h || lines === 1, `${c.id}: ${lines} lines of ${px}px + chance ${chance} in ${c.h}`).toBe(true)
      cleanup()
    }
  })
  it('no two cards\' boxes overlap on the board the fit frames (the layout\'s places, at the drawn card width)', async () => {
    const places = await causalPlaces(model, new Map()), bs = model.cards.map((c) => ({ id: c.id, ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))
    for (const a of bs) for (const b of bs) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} / ${b.id}`).toBe(false)
  })
  it('an option whose label is clamped still shows its chance whole, outside the clamped label', () => {
    stub(new Map([['hire_tech_lead', 158]]))
    const o = { ...model.cards.find((c) => c.id === 'hire_tech_lead')!, heading: 'A very long label that cannot fit in the box. '.repeat(12), face: undefined }
    const box = render(<ViewCard card={o as never} reducedPx={px} />).container.querySelector<HTMLElement>('[data-view-card]')!
    const heading = box.querySelector<HTMLElement>('[data-reduced-heading]')!, chance = box.querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(Number(heading.style.webkitLineClamp), 'the label is clamped to whole lines').toBeGreaterThanOrEqual(1)
    expect(heading.style.overflow).toBe('hidden')
    expect(heading.contains(chance)).toBe(false)
    expect(chance.textContent).toBe('about 26% chance')
  })
})

// DL 10 Nov (seen on Build 1b): link labels ("-16 to 46%") were drawn at about 4 px at the overview. Below the readable zoom they are not
// drawn; at full size they are unchanged.
describe('link words at the overview', () => {
  const bakery = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
  const i = bakery.links.findIndex((l) => l.effect != null)
  const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
  const draw = (zoom: number) => {
    const Zoom = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, zoom] }); return null }
    return render(<ReactFlowProvider><Zoom /><EdgeLabelLayer><svg><Edge id={`l${i}`} source={bakery.links[i]!.from} target={bakery.links[i]!.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
      sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: bakery.links[i]!, i }} selected /></svg></EdgeLabelLayer></ReactFlowProvider>).container
  }
  it('zoom 0.449: no link words are drawn; CONTRAST: zoom 1 draws them as before', () => {
    expect(i, 'precondition: a link with core\'s effect words').toBeGreaterThanOrEqual(0)
    expect(draw(0.449).querySelector(`[data-view="links.${i}.effect.text"]`)).toBeNull()
    cleanup()
    expect(draw(1).querySelector(`[data-view="links.${i}.effect.text"]`)?.textContent).toBe(bakery.links[i]!.effect!.text)
  })
})
