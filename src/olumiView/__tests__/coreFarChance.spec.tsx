/**
 * DL-424 (13 Nov): at 1128x707 the whole board opens on the far (one-line) face, and the chance line was cut mid-word ("about 3% chance, on Ol…",
 * the served 9687fe63 at zoom 0.416). The far line is core's chance words whole ("about 3% chance"), with core's Olumi mark for the figure it
 * rests on, titled with core's full sentence; "No chance yet" is whole as it was. Real path: the lane's card (CoreCard) with the v4 live draft's
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
import { CoreCard, leadLineOf, withheldField, withheldWords } from '../previous/CoreCard'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-cards.json'), 'utf8')) as ViewCard[]
const VIEW = { ...EU, model: { ...EU.model!, cards: LIVE } } as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [], lodRung: undefined } as never) })
const mount = (id: string, rung: 'line' | 'full') => {
  const card = LIVE.find((c) => c.id === id)!
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: VIEW.id, view: VIEW, status: 'ready', error: null, stale: false, at: null } as never)
  useCanvasStore.setState({ nodes: LIVE.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [], lodRung: rung } as never)
  const c = render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  return { card, c }
}
const far = (id: string) => { const { card, c } = mount(id, 'line'); return { card, line: within(c).getByTestId('node-lod-line') } }

describe('the far face draws a chance whole (DL-424)', () => {
  it('a chance resting on Olumi\'s assumption: core\'s chance words whole, then core\'s Olumi mark titled with core\'s full sentence', () => {
    const { card, line } = far('keep_sending_cold_emails_and_seeking_warm_connections')
    expect(card.headline!.text, 'precondition: core\'s face line carries the assumption clause').toBe("about 3% chance, on Olumi's assumption for 'Time until funding is secured now'")
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe('about 3% chance')
    const rested = LIVE.find((c) => c.id === 'time_until_funding_is_secured_now')!
    const mark = line.querySelector<HTMLElement>(`[data-view="${card.id}.far.olumi.glyph"]`)!
    expect([mark.textContent, mark.title]).toEqual([rested.olumi!.glyph, card.headline!.title])
  })

  // Contract 3 (15 Nov): a withheld chance shows core's own reason, never the bare "No chance yet". The far line is leadLineOf's words.
  it('a withheld chance is drawn whole as core\'s `why` (its own reason), with no mark', () => {
    const { card, line } = far('cut_monthly_spending_to_stretch_the_runway')
    expect(card.headline!.state).toBe('none')
    expect(card.headline!.text, 'precondition: core still sends the bare words').toBe('No chance yet')
    expect(card.headline!.why, 'precondition: core sends a reason').toBe("The chance for 'Cut monthly spending to stretch the runway' cannot be worked out yet: needs \"Monthly spending removed: Cut monthly spending to stretch the runway\"; rests on \"Effect of each GBP/month removed on Time until funding is secured\", which is unknown: Cutting spending stretches the runway but does not itself bring funding in sooner, so it has little direct effect on how long funding takes to arrive. It may only ease the pressure to accept poor terms; it waits on the answers to: 'Monthly spending removed: Cut monthly spending to stretch the runway'.")
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe(card.headline!.why)
    expect(within(line).getByTestId('node-lod-line-text').textContent).not.toBe('No chance yet')
    expect(line.querySelector(`[data-view="${card.id}.far.olumi.glyph"]`)).toBeNull()
  })

  // CATCH (fails on the product before contract 3, where leadLineOf returned card.headline.text = "No chance yet" for every option card).
  it('withheldWords picks core\'s why, else title, else text, by field; null for a chance', () => {
    const none = LIVE.find((c) => c.id === 'cut_monthly_spending_to_stretch_the_runway')!.headline!
    const chance = LIVE.find((c) => c.id === 'keep_sending_cold_emails_and_seeking_warm_connections')!
    expect(withheldWords(none)).toBe(none.why)
    // In the live fixture why and title are the same sentence; distinct words bind the order (why before title) and the field named.
    const apart = { ...none, why: 'W', title: 'T' }
    expect([withheldWords(apart), withheldField(apart)]).toEqual(['W', 'why'])
    expect([withheldWords({ ...apart, why: null }), withheldField({ ...apart, why: null })]).toEqual(['T', 'title'])
    expect([withheldWords({ ...apart, why: null, title: '' }), withheldField({ ...apart, why: null, title: '' })]).toEqual(['No chance yet', 'text'])
    expect([withheldWords({ ...none, state: 'fixed' }), withheldField({ ...none, state: 'fixed' })]).toEqual([null, null])
    expect(withheldWords({ ...none, why: null })).toBe(none.title)
    expect(withheldWords({ ...none, why: '' })).toBe(none.title)
    expect(withheldWords({ ...none, why: null, title: '' })).toBe('No chance yet')
    expect(withheldWords(chance.headline!)).toBeNull()
    // CONTRAST: a chance keeps core's chance words as the lead line.
    expect(leadLineOf(chance)).toBe(chance.headline!.text)
  })

  // CATCH (fails before: the pill drew headline.text "No chance yet" and the reason sat behind a closed "Why not" details).
  it('the full face of a withheld chance is one "Why not" press (DL 15 Nov: the face carries less); it opens core\'s why, named by its data-view path, and its next step, whole', () => {
    const { card, c } = mount('cut_monthly_spending_to_stretch_the_runway', 'full')
    const face = c.querySelector<HTMLElement>(`[data-core-lead="${card.id}"][data-ok-face="none"]`)!
    const press = face.querySelector<HTMLDetailsElement>('details.ok-why')!
    expect(press.querySelector('summary')!.textContent).toBe('Why not')
    const words = press.querySelector<HTMLElement>(`[data-core-lead-clamp="${card.id}"]`)!
    expect(words.textContent).toBe(card.headline!.why)
    expect(words.getAttribute('data-view')).toBe(`${card.id}.headline.why`)
    // CATCH: no reason, next step or "No chance yet" on the face itself; nothing on the face clamps.
    expect(face.querySelector('.ok-pill')).toBeNull()
    for (const e of face.querySelectorAll('*')) expect(e.className.toString()).not.toMatch(/line-clamp|truncate/)
    expect(face.textContent).not.toContain('No chance yet')
    expect(press.querySelector(`[data-view="${card.id}.headline.add"]`)!.textContent).toBe(card.headline!.add)
  })
})
