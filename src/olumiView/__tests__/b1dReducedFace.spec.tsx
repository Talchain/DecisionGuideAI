/**
 * DL 10 Nov, second screen look at hiring, 1232 x 704 (faults 1-3). jsdom has no layout, so the widths the browser would measure are given
 * to it (the chance words' width, and the card's line width); what is asserted is what the face does with them, bound by card id and exact
 * words:
 * 1. an option's reduced face always shows its NAME (one line, "…" when long) and its CHANCE; when the engine's words do not fit one line,
 *    the percentage part as the engine words it, without the trailing word "chance", and the whole words on the element's title;
 * 2. the question is never clamped, and what it needs below fits the free space above the options row;
 * 3. every reduced face starts with the heading's own words exactly as the full face shows them;
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
import { withoutChanceWord } from '../../canvas/nodes/ReducedFace'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', n), 'utf8'))
/** The board of the screen the DL looked at ("Hiring for productivity before launch"), and the earlier real hiring board. */
const screen = fixture('hiring-unchecked-first.view3.json'), earlier = fixture('hiring.view3.json')
const card = (id: string) => screen.model!.cards.find((c) => c.id === id)!
const px = 27 // zoom 0.449: 12 px as drawn

// The browser's widths, given: the chance words' width at this size (offsetWidth of the hidden measurer) and the width of the line it must fit.
let need = 0, have = 0
const desc = (k: 'offsetWidth' | 'clientWidth') => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)
const saved = { offsetWidth: desc('offsetWidth'), clientWidth: desc('clientWidth') }
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-reduced-measure') ? need : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-reduced-chance') ? have : 0 } })
})
afterEach(() => {
  cleanup()
  for (const k of ['offsetWidth', 'clientWidth'] as const) { if (saved[k]) Object.defineProperty(HTMLElement.prototype, k, saved[k]!); else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k] }
})
const face = (c: Parameters<typeof ViewCard>[0]['card']) => render(<ViewCard card={c} reducedPx={px} />).container.querySelector<HTMLElement>('[data-view-card] [data-reduced-face]')!

describe('1. an option\'s reduced face: its name and its chance, neither clipped', () => {
  const o = card('hire_a_tech_lead')
  it('precondition: the engine words the headline "about 23% chance" and the card\'s own name is "Hire a Tech lead"', () => {
    expect([o.headline?.text, o.heading]).toEqual(['about 23% chance', 'Hire a Tech lead'])
  })
  it('too narrow for the words: line 1 the name on one line, line 2 "about 23%" (no "chance"), the whole words on the title', () => {
    need = 120; have = 80
    const f = face(o), name = f.querySelector<HTMLElement>(`[data-view-reduced-title="${o.id}"]`)!, chance = f.querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(name.textContent).toBe('Hire a Tech lead')
    expect(name.style.webkitLineClamp, 'one line, ending "…" when long').toBe('1')
    expect(name.className, 'the name never collapses to nothing under the chance').toContain('flex-none')
    expect(name.className).not.toContain('min-h-0')
    expect(chance.querySelector(`[data-view-reduced-headline="${o.id}"]`)!.textContent).toBe('about 23%')
    expect(chance.getAttribute('title')).toBe('about 23% chance')
    expect(chance.className, 'one line').toContain('whitespace-nowrap')
    expect(f.className, 'grows downward to hold both lines; it does not clip them').toContain('min-h-full')
    expect(f.className).not.toContain('overflow-hidden')
  })
  it('CONTRAST: with room for the words, the engine\'s whole words, no title', () => {
    need = 80; have = 120
    const chance = face(o).querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(chance.querySelector(`[data-view-reduced-headline="${o.id}"]`)!.textContent).toBe('about 23% chance')
    expect(chance.hasAttribute('title')).toBe(false)
  })
  it('an option with no headline: its lead chance row, the same rule (the qualifier and the value as the engine words them)', () => {
    need = 120; have = 80
    const bare = { ...card('hire_two_developers'), headline: null }
    const chance = face(bare).querySelector<HTMLElement>('[data-reduced-chance]')!
    expect(chance.textContent).toBe('about 9%')
    expect(chance.getAttribute('title')).toBe('about 9% chance')
  })
  it('never invents or reformats: words that do not end in "chance" are left as they are', () => {
    expect([withoutChanceWord('about 23% chance'), withoutChanceWord('under 1%'), withoutChanceWord('about 4% chance of meeting it'), withoutChanceWord('chance')]).toEqual(['about 23%', null, null, null])
    need = 120; have = 80
    const odd = { ...o, headline: { ...o.headline!, text: 'under 1%' } }
    expect(face(odd).querySelector('[data-reduced-chance]')!.textContent).toBe('under 1%')
  })
  it('a card with no chance keeps the box-clamped face (a heading to the box, "…" when cut)', () => {
    const f = face(card('increase_productivity'))
    expect(f.className).toContain('inset-0')
    expect(f.className).toContain('overflow-hidden')
    expect(f.querySelector('[data-reduced-chance]')).toBeNull()
  })
})

describe('2. the question is never clamped, and grows only into free space', () => {
  const Zoom = ({ z }: { z: number }) => { const api = useStoreApi(); api.setState({ transform: [0, 0, z] }); return null }
  it('its whole text at 12 px as drawn, no line clamp, no clipping box', () => {
    const { container } = render(<ReactFlowProvider><Zoom z={0.449} /><ViewQuestionNode {...({ id: QUESTION, data: { question: screen.model!.question, width: 600 } } as unknown as NodeProps)} /></ReactFlowProvider>)
    const p = container.querySelector<HTMLElement>('[data-view-reduced-question]')!, f = container.querySelector<HTMLElement>('[data-reduced-face]')!
    expect(p.textContent).toBe(screen.model!.question.text)
    expect(p.style.webkitLineClamp).toBe('')
    expect(p.style.overflow).not.toBe('hidden')
    expect(f.className).toContain('min-h-full')
    expect(f.className).not.toContain('overflow-hidden')
    expect(parseFloat(f.style.getPropertyValue('--canvas-label-scale')) * 12 * 0.449).toBeGreaterThanOrEqual(12)
  })
  it.each([['the screen board', screen], ['the earlier board', earlier]])('%s: the whole question at 12 px as drawn ends above the first row of options (hiring, 1232 x 704, dock open)', async (_n, v) => {
    const model = v.model!, places = await causalPlaces(model, new Map()), q = questionPlace(model)
    const pane = { width: 1232, height: 704 }, free = { top: 104, right: 363, bottom: 26, left: 45 }
    const boxes = [{ id: QUESTION, ...places.get(QUESTION)!, w: q.width, h: 85 }, ...model.cards.map((c) => ({ id: c.id, ...places.get(c.id)!, w: CARD_WIDTH, h: c.h }))]
    const zoom = frameFor(boxes.map((b): Node => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } })), pane, free)!.zoom
    const declared = reducedFaceSize(zoom)
    expect(declared, 'precondition: the first fit is zoomed out').toBeGreaterThan(0)
    // The text's lines, estimated at a deliberately wide 0.6 em a character (semibold), plus the face's padding and border.
    const lines = Math.ceil((model.question.text.length * 0.6 * declared) / (q.width - 18))
    const needs = Math.max(85, lines * declared * 1.15 + 12 + 2)
    const options = boxes.filter((b) => model.cards.find((c) => c.id === b.id)?.family === 'option')
    expect(options.length, 'precondition: options on the board').toBeGreaterThanOrEqual(2)
    const top = boxes[0]!.y, firstRow = Math.min(...options.map((b) => b.y))
    expect(top + needs, `question needs ${needs} (${lines} lines of ${declared}px) from ${top}; options start at ${firstRow}`).toBeLessThanOrEqual(firstRow)
  })
})

describe('3. every reduced face starts with the heading\'s own words, as the full face shows them', () => {
  it('each card of the board: reduced title text === the full face\'s title text (the same field)', () => {
    for (const c of screen.model!.cards) {
      const box = render(<><ViewCard card={c} /><ViewCard card={c} reducedPx={px} /></>).container
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
