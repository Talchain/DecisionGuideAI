/**
 * ORDER-UI-HOVER (DL, 13 Nov; Codex PL-851): on Paul's live scenario the hover said "Value: Not on record" on every core-lane card while the
 * card showed its figure, and a first fix said "Value Paul's idea, from the brief" for a target core marks as Olumi's proposal. Real path: the
 * lane's card (CoreCard) with core's own cards from the live drafts (fixtures/live-target-cards.json: v3 after the target edit;
 * fixtures/live-v4-cards.json: the v4 first draft s_037fa202ee78), in the canvas store as the lane's canvas puts them (canvas.ts
 * drawViewCanvas), hovered as Paul hovers, read from the pop-up BaseNode mounts. Bound by card id; expected words are core's fields.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard } from '../previous/CoreCard'
import { NOT_ON_RECORD } from '../../canvas/components/hoverCard/NodeHoverCard'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../canvas/components/hoverCard/hoverCardPlacement'

const read = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as ViewCard[]
const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = [...read('live-target-cards.json'), ...read('live-v4-cards.json')]
const byId = (id: string) => LIVE.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); vi.useRealTimers(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [] } as never) })

const hover = (card: ViewCard, cards: ViewCard[] = LIVE): HTMLElement | null => {
  vi.useFakeTimers()
  const view = { ...EU, model: { ...EU.model!, cards: [...EU.model!.cards, ...cards] } } as View
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  // The lane's canvas puts each card in the canvas store as canvas.ts drawViewCanvas does ({ card, label }): the live page's pop-up reads it.
  useCanvasStore.setState({ nodes: cards.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [] } as never)
  const c = render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  fireEvent.mouseEnter(c.querySelector('[role="group"]')!)
  act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
  return document.querySelector<HTMLElement>('[data-testid="node-hover-card"]')
}
const valueOf = (pop: HTMLElement | null) => pop?.querySelector('[data-testid="node-hover-card-value"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null

describe('the core-lane hover\'s Value line: core\'s words and core\'s own attribution for THAT value (Codex PL-851)', () => {
  it('H1 a goal whose bound is Olumi\'s proposal (v4 live): core\'s bound words and the bound\'s own Olumi mark; never the aim\'s author', () => {
    const g = byId('secure_funding_within_2_months')
    expect([g.figure, g.bound?.text, g.bound?.olumi?.title, g.author?.text], 'precondition').toEqual([null, 'at most 2 months', 'Olumi’s proposal, for you to vet', 'Paul’s idea, from the brief'])
    const pop = hover(g)
    expect(valueOf(pop)).toBe(`Value${g.bound!.text} · ${g.bound!.olumi!.title}`)
    expect(pop!.textContent).not.toContain(g.author!.text)
  })

  it('H1b (DERIVED from H1: the same goal, its bound with no Olumi mark): core\'s bound words with NO source; the aim\'s author is never borrowed', () => {
    const g0 = byId('secure_funding_within_2_months'), g = { ...g0, bound: { ...g0.bound!, olumi: null } } as ViewCard
    const pop = hover(g, LIVE.map((c) => (c.id === g.id ? g : c)))
    expect(valueOf(pop)).toBe(`Value${g.bound!.text}`)
    expect(pop!.textContent).not.toContain(g.author!.text)
  })

  it('H2 sized quantities: core\'s figure words and whose the figure is (v4 "3 to 9 months · Olumi\'s estimate"; v3 target set by Paul)', () => {
    for (const id of ['time_until_funding_is_secured_now', 'secure_funding_within_2_months_target']) {
      const q = byId(id)
      expect(valueOf(hover(q)), id).toBe(`Value${q.figure!.text} · ${q.author!.text}`.replace(/\s+/g, ' '))
      cleanup(); vi.useRealTimers()
    }
  })

  it('H3 an unsized quantity (empty figure): core\'s own state line for it ("Olumi\'s question, not yet sized")', () => {
    const u = byId('monthly_spending_cut_monthly_spending_to_stretch_the_cash_that_i')
    expect([u.family, u.figure!.text], 'precondition').toEqual(['quantity', ''])
    expect(valueOf(hover(u))).toBe(`Value${u.author!.text}`)
  })

  it('H4 a card with neither value, bound nor state (v4 option): NO Value row; its author line is not a value', () => {
    const o = byId('keep_sending_cold_emails_and_seeking_warm_connections')
    expect([o.figure, o.bound], 'precondition').toEqual([null, null])
    const pop = hover(o)
    expect(pop, 'the hover opened').not.toBeNull()
    expect(pop!.querySelector('[data-testid="node-hover-card-value"]')).toBeNull()
  })

  it('H5 every live card: no hover says "Not on record" (core never says it)', () => {
    for (const c of LIVE) { const pop = hover(c); expect(pop?.textContent ?? '', c.id).not.toContain(NOT_ON_RECORD); cleanup(); vi.useRealTimers() }
  })
})
