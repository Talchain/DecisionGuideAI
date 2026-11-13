/**
 * ORDER-UI-HOVER (DL, 13 Nov): on Paul's live scenario the hover said "Value: Not on record" on every core-lane factor card while the card
 * showed its figure. Real path: the lane's card (CoreCard) with core's own cards from the live draft after the target edit
 * (fixtures/live-target-cards.json, read from the copy's View), hovered as Paul hovers, read from the pop-up BaseNode mounts. Bound by card id.
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
import { CoreCard } from '../previous/CoreCard'
import { NOT_ON_RECORD } from '../../canvas/components/hoverCard/NodeHoverCard'
import { HOVER_CARD_OPEN_DELAY_MS } from '../../canvas/components/hoverCard/hoverCardPlacement'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-target-cards.json'), 'utf8')) as ViewCard[]
const VIEW = { ...EU, model: { ...EU.model!, cards: [...EU.model!.cards, ...LIVE] } } as View
const byId = (id: string) => LIVE.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); vi.useRealTimers(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })

const hover = (card: ViewCard): HTMLElement | null => {
  vi.useFakeTimers()
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: VIEW.id, view: VIEW, status: 'ready', error: null, stale: false, at: null } as never)
  const c = render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  fireEvent.mouseEnter(c.querySelector('[role="group"]')!)
  act(() => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
  return document.querySelector<HTMLElement>('[data-testid="node-hover-card"]')
}
const valueOf = (pop: HTMLElement | null) => pop?.querySelector('[data-testid="node-hover-card-value"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null

describe('the core-lane hover says what core says about the card\'s value', () => {
  it('H1 the target card ("2 months"): the hover\'s value is core\'s figure words and whose; never "Not on record"', () => {
    const t = byId('secure_funding_within_2_months_target')
    const pop = hover(t)
    expect(pop, 'the hover opened').not.toBeNull()
    expect(valueOf(pop)).toBe(`Value${t.figure!.text} · ${t.author!.text}`.replace(/\s+/g, ' '))
    expect(pop!.textContent).not.toContain(NOT_ON_RECORD)
  })

  it('H2 an unsized card: the hover\'s value is core\'s own state words for it ("Olumi\'s question, not yet sized"); never "Not on record"', () => {
    const u = byId('monthly_spending_cut_monthly_spending_to_stretch_the_cash_that_i')
    expect(u.figure!.text, 'precondition: core sends no figure words').toBe('')
    const pop = hover(u)
    expect(pop, 'the hover opened').not.toBeNull()
    expect(valueOf(pop)).toBe(`Value${u.author!.text}`)
    expect(pop!.textContent).not.toContain(NOT_ON_RECORD)
  })

  it('H3 every live card: no hover says "Not on record" (core never says it)', () => {
    for (const c of LIVE) { const pop = hover(c); expect(pop?.textContent ?? '', c.id).not.toContain(NOT_ON_RECORD); cleanup(); vi.useRealTimers() }
  })
})
