/**
 * DL 10 Nov (evening), after the second screen look at hiring: the zoomed-out face follows the PREVIOUS product's treatment, which REVERSES the
 * earlier 12 px rule ("the whole model in view at first open, as the previous product did"). The card's whole name, wrapped, at the previous
 * product's own zoomed-out size (CanvasLabelScaleSync's labelCounterScale, capped at LABEL_COUNTER_SCALE_CAP: imported here, never restated),
 * and ONE line beneath it: an option's chance in the engine's full words, or the card's value or range. jsdom has no layout, so the box heights
 * a browser would measure are given to it; what is asserted is what the face does with them, bound by card id and exact words.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi, type Node, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { causalPlaces, CARD_WIDTH, QUESTION, questionPlace } from '../layout'
import { reducedFaceSize } from '../camera'
import { frameFor } from '../ViewCanvas'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewQuestionNode } from '../../canvas/nodes/ViewQuestionNode'
import { headingLines, REDUCED_LINE_PX, REDUCED_NAME_PX } from '../../canvas/nodes/ReducedFace'
import { LABEL_COUNTER_SCALE_CAP } from '../../canvas/utils/zoomLegibility'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', n), 'utf8'))
/** The board of the screen the DL looked at ("Hiring for productivity before launch"). */
const screen = fixture('hiring-unchecked-first.view3.json')
const card = (id: string) => screen.model!.cards.find((c) => c.id === id)!
const zoom0 = 0.449 // hiring's first fit at 1232 x 704
const scale = reducedFaceSize(zoom0)
const px = REDUCED_NAME_PX * scale, linePx = REDUCED_LINE_PX * scale

// The browser's box heights, given: the card's box (its core height) and the one line's own height.
const heightOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'), tailOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
let faceH = 0
const stub = (boxH: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-view-card') ? boxH : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-reduced-chance') ? linePx * 1.15 : this.hasAttribute('data-reduced-face') ? faceH : 0 } })
}
afterEach(() => {
  cleanup(); faceH = 0
  if (heightOf) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightOf); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight
  if (tailOf) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', tailOf); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight
})
const cardOf = (c: Parameters<typeof ViewCard>[0]['card']) => render(<ViewCard card={c} reducedPx={scale} />).container.querySelector<HTMLElement>('[data-view-card]')!
const face = (c: Parameters<typeof ViewCard>[0]['card']) => cardOf(c).querySelector<HTMLElement>('[data-reduced-face]')!

describe('1. the face: the whole name wrapped at the previous product\'s size, one line beneath', () => {
  const o = card('hire_a_tech_lead')
  it('the size is the previous product\'s rule: at the overview zoom the label scale is its ceiling, the name 14 and the line 11 px declared times it', () => {
    expect(scale, 'imported, not restated').toBe(LABEL_COUNTER_SCALE_CAP)
    const f = face(o), name = f.querySelector<HTMLElement>('[data-reduced-heading]')!, line = f.querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(f.style.getPropertyValue('--canvas-label-scale')).toBe(String(scale))
    expect(name.style.fontSize).toBe(`calc(${REDUCED_NAME_PX}px*var(--canvas-label-scale,1))`)
    expect(line.style.fontSize).toBe(`calc(${REDUCED_LINE_PX}px*var(--canvas-label-scale,1))`)
  })
  it('an option: its whole name wraps over every line its box holds (not one line), and the engine\'s FULL chance words sit beneath, unshortened', () => {
    stub(o.h)
    const f = face(o), name = f.querySelector<HTMLElement>(`[data-view-reduced-title="${o.id}"]`)!, line = f.querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(o.headline?.text, 'precondition').toBe('about 23% chance')
    expect(name.textContent).toBe('Hire a Tech lead')
    const fits = headingLines(o.h, px, linePx * 1.15)
    expect(fits, 'precondition: the box holds several lines at this size').toBeGreaterThan(1)
    expect(Number(name.style.webkitLineClamp), 'ellipsis only when the name cannot fit the box').toBe(fits)
    expect(line.textContent).toBe('about 23% chance')
    expect(line.querySelector('[data-view-reduced-headline]')!.getAttribute('data-view')).toBe(`${o.id}.headline.text`)
    expect(f.querySelector('[data-reduced-measure], [data-short]')).toBeNull()
  })
  it('an option with no headline: its lead chance row, in full words', () => {
    const bare = { ...card('hire_two_developers'), headline: null }
    expect(face(bare).querySelector('[data-reduced-chance]')!.textContent).toBe('about 9% chance')
  })
  it.each([['weekly_churn', '12 tickets/week', 'figure.text'], ['increase_productivity', 'a rise of at least 10%', 'bound.text'], ['onboarding_absorbs_existing_deve', 'New hires can temporarily slow the existing team.', 'face.line.text']])(
    'another card: %s has the one line its full face leads with (%s)', (id, words, path) => {
      const c = screen.model!.cards.find((x) => x.id === id || (id.endsWith('_deve') && x.id.startsWith(id)))!
      const line = face(c).querySelector<HTMLElement>('[data-reduced-chance]')!
      expect(line.textContent).toBe(words)
      expect(line.querySelector(`[data-view="${c.id}.${path}"]`)).not.toBeNull()
    })
  it('a card with a figure per option has no squeezed line beneath its name', () => {
    expect(face(card('team_delivery_throughput_change')).querySelector('[data-reduced-chance]')).toBeNull()
  })
  it('a tall card is not drawn mostly empty: the face is its content\'s height and the rest of its box is not drawn (the box keeps its height)', () => {
    stub(o.h); faceH = 70
    const box = cardOf(o)
    expect(box.hasAttribute('data-reduced-clip')).toBe(true)
    expect(box.style.getPropertyValue('--reduced-clip-bottom')).toBe(`${o.h - 70}px`)
    expect(box.style.minHeight, 'no card changes height').toBe('')
    cleanup(); faceH = o.h
    expect(cardOf(o).hasAttribute('data-reduced-clip'), 'CONTRAST: a face as tall as its box clips nothing').toBe(false)
  })
})

describe('2. the question is never clamped, and reserves the room it needs', () => {
  const Zoom = ({ z }: { z: number }) => { const api = useStoreApi(); api.setState({ transform: [0, 0, z] }); return null }
  it('its whole text at the previous product label scale, no line clamp, no clipping box', () => {
    const { container } = render(<ReactFlowProvider><Zoom z={0.449} /><ViewQuestionNode {...({ id: QUESTION, data: { question: screen.model!.question, width: 600 } } as unknown as NodeProps)} /></ReactFlowProvider>)
    const p = container.querySelector<HTMLElement>('[data-view-reduced-question]')!, f = container.querySelector<HTMLElement>('[data-reduced-face]')!
    expect(p.textContent).toBe(screen.model!.question.text)
    expect(p.style.webkitLineClamp).toBe('')
    expect(p.style.overflow).not.toBe('hidden')
    expect(f.className).toContain('min-h-full')
    expect(f.className).not.toContain('overflow-hidden')
    expect(parseFloat(f.style.getPropertyValue('--canvas-label-scale'))).toBe(scale)
  })
  // DL 10 Nov, Codex at 900 x 704: the grown question face ended 5.5 px inside the option faces below it, since the layout knew only the full
  // face's 85 px. The face now reserves the height it really needs in its card's box, the canvas lays the next row out from that, and the
  // row below starts under it at every width from 900 to 1232. jsdom has no layout: the face's content height is the character-width estimate
  // (a deliberately wide 0.6 em a character, semibold) given as the face's offsetHeight; what is asserted is that the reservation and the layout
  // carry it. At 900 the question needs more than its 85 px box, so reserving nothing (b733) leaves the options inside it.
  it.each([900, 1000, 1100, 1232])('hiring at %i x 704, dock open: the question\'s whole face is reserved, and the options row starts below it', async (width) => {
    const model = screen.model!, places0 = await causalPlaces(model, new Map()), q = questionPlace(model)
    const pane = { width, height: 704 }, free = { top: 104, right: width - (width - 308), bottom: 26, left: 45 }
    const boxes = [{ id: QUESTION, ...places0.get(QUESTION)!, w: q.width, h: 85 }, ...model.cards.map((c) => ({ id: c.id, ...places0.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    const zoom = frameFor(boxes.map((b): Node => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } })), pane, free)!.zoom
    const sc = reducedFaceSize(zoom), declared = REDUCED_NAME_PX * sc
    expect(sc, 'precondition: the first fit is zoomed out').toBeGreaterThan(0)
    const lines = Math.ceil((model.question.text.length * 0.6 * declared) / (q.width - 18))
    const need = lines * declared * 1.15 + 12 + 2
    if (width === 900) expect(need, 'precondition: at 900 the whole question needs more than the 85 px it was given').toBeGreaterThan(85)
    // 1. the face reserves its own height in the question's box.
    const heightOf = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-reduced-face') ? need : 0 } })
    try {
      const Zoom2 = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, zoom] }); return null }
      const { container } = render(<ReactFlowProvider><Zoom2 /><ViewQuestionNode {...({ id: QUESTION, data: { question: model.question, width: q.width } } as unknown as NodeProps)} /></ReactFlowProvider>)
      expect(container.querySelector<HTMLElement>('[data-view-question]')!.style.minHeight).toBe(`${need}px`)
      cleanup()
      expect(container.querySelector('[data-view-question]'), 'unmounted: its reservation is not left behind').toBeNull()
    } finally { if (heightOf) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightOf); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight }
    // 2. the layout, given the question's real height, puts every option row below it.
    const optionIds = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
    const rowTop = (p: Map<string, { x: number; y: number }>) => Math.min(...optionIds.map((id) => p.get(id)!.y))
    const reserved = await causalPlaces(model, new Map([[QUESTION, { width: q.width, height: Math.max(85, need) }]]))
    expect(rowTop(reserved), `options start at ${rowTop(reserved)}; the question needs ${Math.max(85, need)} from ${reserved.get(QUESTION)!.y}`).toBeGreaterThanOrEqual(reserved.get(QUESTION)!.y + Math.max(85, need))
  })
})

describe('3. every reduced face starts with the heading\'s own words, as the full face shows them', () => {
  it('each card of the board: reduced title text === the full face\'s title text (the same field)', () => {
    for (const c of screen.model!.cards) {
      const box = render(<><ViewCard card={c} /><ViewCard card={c} reducedPx={scale} /></>).container
      const full = box.querySelector<HTMLElement>(`[data-view-card] [data-view="${c.id}.face.title.text"], [data-view-card] [data-view="${c.id}.heading"]:not(.sr-only)`)!
      const reduced = box.querySelector<HTMLElement>(`[data-view-reduced-title="${c.id}"]`)!
      expect(reduced.textContent, c.id).toBe(full.textContent)
      cleanup()
    }
  })
  it('the lower-case card is core\'s own words: the target of "increase productivity", its title in the person\'s words ("theirs")', () => {
    const t = card('increase_productivity_target')
    expect([t.heading, t.face?.title?.text, t.face?.title?.words]).toEqual(["The target for 'increase productivity'", 'increase productivity by at least 10%', 'theirs'])
    expect(face(t).querySelector(`[data-view-reduced-title="${t.id}"]`)!.textContent).toBe('increase productivity by at least 10%')
  })
})
