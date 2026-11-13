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
import { CoreCard } from '../previous/CoreCard'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const LIVE = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-cards.json'), 'utf8')) as ViewCard[]
const VIEW = { ...EU, model: { ...EU.model!, cards: LIVE } } as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [], lodRung: undefined } as never) })
const far = (id: string) => {
  const card = LIVE.find((c) => c.id === id)!
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: VIEW.id, view: VIEW, status: 'ready', error: null, stale: false, at: null } as never)
  useCanvasStore.setState({ nodes: LIVE.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [], lodRung: 'line' } as never)
  const c = render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  return { card, line: within(c).getByTestId('node-lod-line') }
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

  it('"No chance yet" is drawn whole as core sends it, with no mark', () => {
    const { card, line } = far('cut_monthly_spending_to_stretch_the_runway')
    expect(card.headline!.text).toBe('No chance yet')
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe('No chance yet')
    expect(line.querySelector(`[data-view="${card.id}.far.olumi.glyph"]`)).toBeNull()
  })
})
