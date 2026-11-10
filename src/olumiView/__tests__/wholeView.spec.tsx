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
import { ReactFlowProvider, useStoreApi, type Node, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { causalPlaces, CARD_WIDTH, QUESTION, questionPlace } from '../layout'
import { MIN_CARD_TEXT_PX, READABLE_WHOLE_ZOOM, reducedFaceSize } from '../camera'
import { frameFor } from '../ViewCanvas'
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
  it('reducedFaceSize: none from the readable zoom up; below it a size that draws at 11 px or more', () => {
    expect([reducedFaceSize(1), reducedFaceSize(READABLE_WHOLE_ZOOM), reducedFaceSize(NaN)]).toEqual([0, 0, 0])
    for (const z of [0.9, 0.7, 0.5, 0.4, 0.25]) expect(reducedFaceSize(z) * z, String(z)).toBeGreaterThanOrEqual(MIN_CARD_TEXT_PX)
  })
  const option = model.cards.find((c) => c.id === 'hire_tech_lead')!
  it('an option: its heading and its chance (the headline, else its lead chance), core words, at 22 px declared (11 px drawn at 0.5); the full face is hidden, not removed', () => {
    const px = reducedFaceSize(0.5)
    const box = render(<ViewCard card={option} reducedPx={px} />).container.querySelector<HTMLElement>('[data-view-card]')!
    const face = box.querySelector<HTMLElement>(`[data-reduced-face="${option.id}"]`)!
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
  it('on the canvas: zoom 0.5 draws the reduced face; zoom 1 the full face; an opened card is always the full face', () => {
    expect(draw(0.5, false).querySelector('[data-reduced-face]')).not.toBeNull()
    cleanup()
    expect(draw(1, false).querySelector('[data-reduced-face]')).toBeNull()
    cleanup()
    expect(draw(0.5, true).querySelector('[data-reduced-face]')).toBeNull()
  })
  it('the question: its text alone, at least 18 px and drawn at 11 px or more', () => {
    const Zoom = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, 0.4] }); return null }
    const { container } = render(<ReactFlowProvider><Zoom /><ViewQuestionNode {...({ id: QUESTION, data: { question: model.question, width: 600 } } as unknown as NodeProps)} /></ReactFlowProvider>)
    const p = container.querySelector<HTMLElement>('[data-view-reduced-question]')!
    expect(p.textContent).toBe(model.question.text)
    expect(parseFloat(p.style.fontSize) * 0.4).toBeGreaterThanOrEqual(MIN_CARD_TEXT_PX)
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
