/**
 * DL-424 (13 Nov): at 1128x707 the whole board opens on the far (one-line) face, and the chance line was cut mid-word ("about 3% chance, on Ol…",
 * the served 9687fe63 at zoom 0.416). The far line is core's chance words whole ("about 3% chance"), with core's Olumi mark for the figure it
 * rests on, titled with core's full sentence; a withheld chance draws core's why, else title, else text (contract 3, 15 Nov). Real path: the lane's card (CoreCard) with the v4 live draft's
 * cards (fixtures/live-v4-cards.json, s_037fa202ee78), on the far rung as the canvas sets it, read from BaseNode's far line. Bound by card id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { cleanup, render, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard } from '../previous/CoreCard'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-cards.json'), 'utf8')) as ViewCard[]
const VIEW = { ...EU, model: { ...EU.model!, cards: LIVE } } as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [], lodRung: undefined } as never) })
const far = (id: string, headline?: Partial<NonNullable<ViewCard['headline']>>, rung: 'line' | 'full' = 'line') => {
  const base = LIVE.find((c) => c.id === id)!
  const card = headline === undefined ? base : ({ ...base, headline: { ...base.headline!, ...headline } } as ViewCard)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: VIEW.id, view: VIEW, status: 'ready', error: null, stale: false, at: null } as never)
  useCanvasStore.setState({ nodes: LIVE.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [], lodRung: rung } as never)
  const c = render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  return { card, c, line: rung === 'line' ? within(c).getByTestId('node-lod-line') : c }
}

describe('the far face draws a chance whole (DL-424)', () => {
  it('a chance resting on Olumi\'s assumption: core\'s chance words whole, then core\'s Olumi mark titled with core\'s full sentence', () => {
    const { card, line } = far('keep_sending_cold_emails_and_seeking_warm_connections')
    expect(card.headline!.text, 'precondition: core\'s face line carries the assumption clause').toBe("about 3% chance, on Olumi's assumption for 'Time until funding is secured now'")
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe('about 3% chance')
    const rested = LIVE.find((c) => c.id === 'time_until_funding_is_secured_now')!
    const mark = line.querySelector<HTMLElement>(`[data-view="${card.id}.far.olumi.glyph"]`)!
    expect([mark.textContent, mark.title]).toEqual([rested.olumi!.glyph, card.headline!.title])
  })

  // Contract 3 (15 Nov): where core withholds the chance (headline.state 'none') the face draws core's `why`, else its `title`, else `text`; picked by
  // field, whole, with no mark. CATCH: before this change leadLineOf returned headline.text ('No chance yet'), so the first two rows fail there;
  // the third (neither why nor title) is the must-not-change row. In the live fixture core's title and why are the same sentence, so the first
  // row gives the title other words to bind the order (why before title) by field.
  it('a withheld chance draws core\'s why whole (not its title, not "No chance yet"), with no mark', () => {
    const { card, line } = far('cut_monthly_spending_to_stretch_the_runway', { title: 'A title apart from the why' })
    expect(card.headline!.state).toBe('none')
    expect(card.headline!.title).not.toBe(card.headline!.why)
    expect(card.headline!.text, 'precondition: core still sends the bare text').toBe('No chance yet')
    expect(card.headline!.why, 'precondition: core sends this option\'s own reason').toContain("cannot be worked out yet: needs")
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe(card.headline!.why)
    expect(within(line).getByTestId('node-lod-line-text').textContent).not.toBe(card.headline!.title)
    expect(within(line).getByTestId('node-lod-line-text').textContent).not.toBe('No chance yet')
    expect(line.querySelector(`[data-view="${card.id}.far.olumi.glyph"]`)).toBeNull()
  })

  it('a withheld chance with no why draws core\'s title whole', () => {
    const { card, line } = far('cut_monthly_spending_to_stretch_the_runway', { why: null })
    expect(card.headline!.title).not.toBe('')
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe(card.headline!.title)
    expect(line.querySelector(`[data-view="${card.id}.far.olumi.glyph"]`)).toBeNull()
  })

  it('a withheld chance where core sends neither why nor title keeps core\'s text, "No chance yet", whole, with no mark', () => {
    const { card, line } = far('cut_monthly_spending_to_stretch_the_runway', { why: null, title: '' })
    expect(card.headline!.text).toBe('No chance yet')
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe('No chance yet')
    expect(line.querySelector(`[data-view="${card.id}.far.olumi.glyph"]`)).toBeNull()
  })

  // The reading face's hover says each of core's sentences once: in the live fixture the why and the title are the same sentence, and with no why
  // the line IS the title. CATCH: before this change the hover joined them, "<sentence> · <sentence>".
  it('the reading face\'s hover for a withheld chance says core\'s sentence once', () => {
    for (const h of [undefined, { why: null }] as const) {
      const { card, c } = far('cut_monthly_spending_to_stretch_the_runway', h, 'full')
      const lead = c.querySelector<HTMLElement>(`[data-core-lead="${card.id}"]`)!
      expect(lead.getAttribute('title'), JSON.stringify(h)).toBe(card.headline!.title)
      // DL 15 Nov polish (supersedes the three-line clamp and its press-to-open): the reason is drawn whole, never cut, nothing clamped above it.
      const words = lead.querySelector<HTMLElement>(`[data-core-lead-clamp="${card.id}"]`)!
      for (let a: Element | null = words; a !== null && a !== lead.parentElement; a = a.parentElement) expect(a.className, JSON.stringify(h)).not.toMatch(/line-clamp|truncate/)
      cleanup()
    }
  })

  it('CONTRAST: a served chance\'s lead is not clamped', () => {
    const { card, c } = far('keep_sending_cold_emails_and_seeking_warm_connections', undefined, 'full')
    const clamp = c.querySelector(`[data-core-lead="${card.id}"] [data-core-lead-clamp="${card.id}"]`)
    expect(clamp, 'precondition: the reading face draws the lead').not.toBeNull()
    expect(clamp!.classList.contains('line-clamp-3')).toBe(false)
  })

  // CONTRAST: a chance that IS served (state 'chance') keeps core's chance words whole even though core also sends a title.
  it('a served chance still draws core\'s chance words, never its title', () => {
    const { card, line } = far('keep_sending_cold_emails_and_seeking_warm_connections')
    expect(card.headline!.state).toBe('chance')
    // Bound by its start: the far line's whole-words rule for this card is the row above, red before this change too (inherited, 50020e59).
    expect(within(line).getByTestId('node-lod-line-text').textContent).toMatch(/^about 3% chance/)
    expect(within(line).getByTestId('node-lod-line-text').textContent).not.toBe(card.headline!.title)
  })
})
