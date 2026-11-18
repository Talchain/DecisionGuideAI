/**
 * ORDER-UI-HOVER (DL, 13 Nov; Codex PL-851): on Paul's live scenario the hover said "Value: Not on record" on every core-lane card while the
 * card showed its figure, and a first fix said "Value Paul's idea, from the brief" for a target core marks as Olumi's proposal. Real path: the
 * lane's card (CoreCard) with core's own cards from the live drafts (fixtures/live-target-cards.json: v3 after the target edit;
 * fixtures/live-v4-cards.json: the v4 first draft s_037fa202ee78), in the canvas store as the lane's canvas puts them (canvas.ts
 * drawViewCanvas), hovered as Paul hovers. Bound by card id; expected words are core's fields.
 * SURFACES STEP A (18 Nov): on the lane the hover is the card's ONE BOX previewing (v12/edit/LaneInspector `lane-peek`), so these rows read its Value
 * row; the same rules hold in it (the value's OWN attribution, never the aim's author borrowed for it). The last row keeps the older look's pop-up.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { ToastProvider } from '../../canvas/ToastContext'
import { CoreCard } from '../previous/CoreCard'
import { LaneInspector } from '../v12/edit/LaneInspector'
import { useLaneInspector } from '../v12/edit/inspectorStore'
import { NOT_ON_RECORD } from '../../canvas/components/hoverCard/NodeHoverCard'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../canvas/components/hoverCard/hoverCardPlacement'

const read = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as ViewCard[]
const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = [...read('live-target-cards.json'), ...read('live-v4-cards.json')]
const byId = (id: string) => LIVE.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, peek: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [] } as never) })

/** Hover the card as Paul hovers it, with the lane's one box mounted beside it. `sel`: what to read (the lane's preview, or the older look's pop-up). */
const hover = (card: ViewCard, cards: ViewCard[] = LIVE, sel = '[data-testid="lane-peek"]'): HTMLElement | null => {
  vi.useFakeTimers()
  const view = { ...EU, model: { ...EU.model!, cards: [...EU.model!.cards, ...cards] } } as View
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  // The lane's canvas puts each card in the canvas store as canvas.ts drawViewCanvas does ({ card, label }).
  useCanvasStore.setState({ nodes: cards.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [] } as never)
  const c = render(<ToastProvider><ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider><LaneInspector /></ToastProvider>).container
  fireEvent.mouseEnter(c.querySelector('[role="group"]')!)
  act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
  return document.querySelector<HTMLElement>(sel)
}
const part = (box: HTMLElement | null, id: string) => box?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null
const valueOf = (box: HTMLElement | null) => part(box, 'lane-inspector-value')?.textContent?.replace(/\s+/g, ' ').trim() ?? null

describe('surfaces step 1 (18 Nov): no grey browser tip on a card; its sentences are in its one box', () => {
  it('the face and the name carry no title=; core\'s status is in the preview and its detail in the pinned box, each once. CONTRAST: a card with nothing to say has neither', () => {
    const base = LIVE.find((c) => c.family === 'option') ?? LIVE[0]!
    const card = { ...base, detail: 'Core says this route was set aside in the last version.', status: 'ruled out' } as ViewCard
    const peek = hover(card, LIVE.map((c) => (c.id === card.id ? card : c)))
    const face = document.querySelector('[data-core-card]')!
    expect([face.getAttribute('title'), document.querySelector('[data-testid="node-title"]')?.getAttribute('title') ?? null]).toEqual([null, null])
    expect(part(peek, 'lane-inspector-status')?.textContent).toBe('ruled out')
    expect(peek!.textContent, 'the preview is short: the detail waits for the pinned box').not.toContain('Core says this route was set aside in the last version.')
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: card.id }) })
    const pinned = document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')
    expect(part(pinned, 'lane-inspector-detail')?.textContent).toBe('Core says this route was set aside in the last version.')
    expect(pinned!.textContent!.split('Core says this route was set aside in the last version.').length - 1, 'said once').toBe(1)
    cleanup(); useLaneInspector.setState({ current: null, peek: null })
    const quiet = { ...base, detail: '', status: null, reason: null, author: null, face: null } as unknown as ViewCard
    const q = hover(quiet, LIVE.map((c) => (c.id === quiet.id ? quiet : c)))
    expect(q, 'the preview opened').not.toBeNull()
    expect([part(q, 'lane-inspector-status'), part(q, 'lane-inspector-author')]).toEqual([null, null])
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: quiet.id }) })
    expect(document.querySelector('[data-testid="lane-inspector-detail"]')).toBeNull()
  })
})

describe('the core-lane hover\'s Value line: core\'s words and core\'s own attribution for THAT value (Codex PL-851)', () => {
  it('H1 a goal whose bound is Olumi\'s proposal (v4 live): core\'s bound words and the bound\'s own Olumi mark; the aim\'s author is not on the Value row (it is the card\'s, in the header)', () => {
    const g = byId('secure_funding_within_2_months')
    expect([g.figure, g.bound?.text, g.bound?.olumi?.title, g.author?.text], 'precondition').toEqual([null, 'at most 2 months', 'Olumi’s proposal, for you to vet', 'Paul’s idea, from the brief'])
    const box = hover(g)
    expect(valueOf(box)).toBe(`Value${g.bound!.text} ${g.bound!.olumi!.title}`)
    expect(part(box, 'lane-inspector-value')!.textContent).not.toContain(g.author!.text)
    expect(part(box, 'lane-inspector-kind')!.contains(part(box, 'lane-inspector-author')), 'whose the aim is: beside its kind').toBe(true)
  })

  it('H1b (DERIVED from H1: the same goal, its bound with no Olumi mark): core\'s bound words with NO source; the aim\'s author is never borrowed', () => {
    const g0 = byId('secure_funding_within_2_months'), g = { ...g0, bound: { ...g0.bound!, olumi: null } } as ViewCard
    const box = hover(g, LIVE.map((c) => (c.id === g.id ? g : c)))
    expect(valueOf(box)).toBe(`Value${g.bound!.text}`)
    expect(part(box, 'lane-inspector-value')!.textContent).not.toContain(g.author!.text)
  })

  it('H2 sized quantities: core\'s figure words and whose the figure is, said once, beside the figure (v4 "3 to 9 months · Olumi\'s estimate"; v3 target set by Paul)', () => {
    for (const id of ['time_until_funding_is_secured_now', 'secure_funding_within_2_months_target']) {
      const q = byId(id)
      const box = hover(q)
      expect(valueOf(box), id).toBe(`Value${q.figure!.text} ${q.author!.text}`.replace(/\s+/g, ' '))
      expect(box!.querySelectorAll('[data-testid="lane-inspector-author"]').length, `${id}: once`).toBe(1)
      cleanup(); vi.useRealTimers(); useLaneInspector.setState({ current: null, peek: null })
    }
  })

  it('H3 an unsized quantity (empty figure): core\'s own state line for it ("Olumi\'s question, not yet sized"), once, and no figure is made up', () => {
    const u = byId('monthly_spending_cut_monthly_spending_to_stretch_the_cash_that_i')
    expect([u.family, u.figure!.text], 'precondition').toEqual(['quantity', ''])
    const box = hover(u)
    expect(part(box, 'lane-inspector-author')?.textContent).toBe(u.author!.text)
    expect(part(box, 'lane-inspector-kind')!.contains(part(box, 'lane-inspector-author')), 'it is the card\'s state line, beside its kind').toBe(true)
    expect(box!.textContent!.split(u.author!.text).length - 1, 'once').toBe(1)
    expect([part(box, 'lane-inspector-value'), part(box, 'lane-inspector-figure')], 'no Value row is made up for it').toEqual([null, null])
  })

  it('H4 an option (v4, no figure and no bound): its Value is core\'s headline for it, its chance of meeting the goal in this model (`headline.text`), with NO source; whose the option is stays beside its kind, never beside the chance', () => {
    const o = byId('keep_sending_cold_emails_and_seeking_warm_connections')
    expect([o.figure, o.bound, o.headline?.state, o.author?.text], 'precondition').toEqual([null, null, 'chance', 'Paul’s idea, from the brief'])
    expect(o.headline!.text, 'precondition: core\'s own chance words').toMatch(/^about 3% chance/)
    const box = hover(o)
    expect(valueOf(box)).toBe(`Value${o.headline!.text}`)
    expect(part(box, 'lane-inspector-value')!.textContent).not.toContain(o.author!.text)
    expect(part(box, 'lane-inspector-value-source')).toBeNull()
    expect(part(box, 'lane-inspector-kind')!.contains(part(box, 'lane-inspector-author'))).toBe(true)
    // Pinned, a person's author line carries core's account of it (their own words, quoted): drawn in the fold, once.
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: o.id }) })
    const pinned = document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')!
    expect([...pinned.querySelectorAll('[data-testid="lane-inspector-also"]')].map((e) => e.textContent)).toContain(o.author!.title)
    expect(part(pinned, 'lane-inspector-basis')?.textContent, 'the basis sentence is core\'s headline title').toBe(o.headline!.title)
  })

  it('H4b (DERIVED from H4: the same option with its chance withheld and one sentence saying why): that sentence is the Value row and is NOT said a second time as the basis', () => {
    const o0 = byId('keep_sending_cold_emails_and_seeking_warm_connections')
    const WHY = 'No chance yet: the goal has no target to meet.'
    const o = { ...o0, headline: { ...o0.headline!, state: 'none', text: 'No chance yet', title: WHY, why: null } } as unknown as ViewCard
    hover(o, LIVE.map((c) => (c.id === o.id ? o : c)))
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: o.id }) })
    const pinned = document.querySelector<HTMLElement>('[data-testid="lane-inspector"]')!
    expect(part(pinned, 'lane-inspector-figure')?.textContent).toBe(WHY)
    expect(pinned.textContent!.split(WHY).length - 1, 'said once').toBe(1)
  })

  it('H5 every live card: no preview says "Not on record" (core never says it)', () => {
    for (const c of LIVE) { const box = hover(c); expect(box, c.id).not.toBeNull(); expect(box?.textContent ?? '', c.id).not.toContain(NOT_ON_RECORD); cleanup(); vi.useRealTimers(); useLaneInspector.setState({ current: null, peek: null }) }
  })

  it('H6 the older look keeps its pop-up: off the lane the same hover draws the pop-up with core\'s value words, and names no preview', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    const q = byId('time_until_funding_is_secured_now')
    const pop = hover(q, LIVE, '[data-testid="node-hover-card"]')
    expect(pop?.querySelector('[data-testid="node-hover-card-value"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(`Value${q.figure!.text} · ${q.author!.text}`.replace(/\s+/g, ' '))
    expect(useLaneInspector.getState().peek).toBeNull()
    expect(document.querySelector('[data-testid="lane-peek"]')).toBeNull()
  })
})
