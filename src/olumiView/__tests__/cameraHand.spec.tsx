/**
 * The camera is the person's (Codex, pairing read 15 Nov, blocking 1 and 2), on the old look's mounted canvas:
 * - "Zoom in for detail" and "N more cards below" are the person's own moves, as Fit is: each, pressed on the REAL canvas, raises movedAt by
 *   one and stamps the activity (no drag), so a reply's pending pan and pulse stand down (what those refs cancel: replyInView.spec.tsx).
 * - A new reply's camera never zooms IN: below the try's floor the cards are centred at the person's own zoom.
 * Refs are read through a wrapper that calls the real useReplyInView, as fitHandler.spec.tsx does.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { currentModel, useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import { drawViewCanvas } from '../canvas'
import { causalPlaces } from '../layout'
import { replyViewTarget } from '../replyInView'
import { CANVAS_LOD_NOTICE_TESTID } from '../../canvas/components/CanvasLodNotice'
import { noteLanded, returnFromLanded } from '../revealReturn'

const refs = vi.hoisted(() => ({ moved: null as { current: number } | null, activity: null as { current: { at: number; active: boolean } } | null }))
vi.mock('../replyInView', async (orig) => {
  const real = await orig<typeof import('../replyInView')>()
  return { ...real, useReplyInView: (...a: Parameters<typeof real.useReplyInView>) => { refs.moved = a[0]; refs.activity = a[1]; return real.useReplyInView(...a) } }
})
vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
beforeEach(() => {
  refs.moved = null; refs.activity = null
  useViewStore.setState({ uuid: 'u', sid: golden.id, view: golden, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: golden.you_id, name: golden.you }, status: 'ready' })
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full' } as never)
})
afterEach(() => {
  cleanup(); vi.useRealTimers()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full' } as never)
})
const mount = () => render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)

describe('the person\'s own camera controls on the real canvas', () => {
  it('CH1 catch: "Zoom in for detail" counts as the person\'s move (movedAt rises by one) and stamps the activity as no drag', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-15T01:00:00Z'))
    mount()
    act(() => { useCanvasStore.setState({ lodRung: 'line' } as never) })
    const action = screen.getByTestId(`${CANVAS_LOD_NOTICE_TESTID}-action`)
    const moves = refs.moved!.current
    fireEvent.click(action)
    expect(refs.moved!.current).toBe(moves + 1)
    expect(refs.activity!.current).toEqual({ at: Date.now(), active: false })
  })
  it('CH2 catch: "N more cards below" counts as the person\'s move (movedAt rises by one) and stamps the activity as no drag', async () => {
    const model = currentModel({ view: golden, error: null, stale: false })!
    const places = await causalPlaces(model, new Map())
    act(() => { drawViewCanvas(model, places) })
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-15T01:00:00Z'))
    mount()
    const cue = screen.getByTestId('view-below-cue').querySelector('button')!
    expect(cue.textContent, 'the cue counts cards below the window\'s foot').toMatch(/more cards? below/)
    const moves = refs.moved!.current
    fireEvent.click(cue)
    expect(refs.moved!.current).toBe(moves + 1)
    expect(refs.activity!.current).toEqual({ at: Date.now(), active: false })
  })
})

describe('the zoom buttons and the reveal panel\'s return are the person\'s moves too (Codex delta read 15 Nov, blocking 1 and 2)', () => {
  it('CH3 catch: the canvas\'s "Zoom in" button raises movedAt by one (so a pending reveal, open or try pan stands down) and stamps the activity', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-15T01:00:00Z'))
    mount()
    const moves = refs.moved!.current
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(refs.moved!.current).toBe(moves + 1)
    expect(refs.activity!.current).toEqual({ at: Date.now(), active: false })
  })
  it('CH4 catch: closing a landed reveal panel returns the camera as the person\'s own move (movedAt rises by one)', () => {
    mount()
    act(() => { noteLanded('chip-1', 'olumi') })
    const moves = refs.moved!.current
    act(() => { expect(returnFromLanded('chip-1')).toBe(true) })
    expect(refs.moved!.current).toBe(moves + 1)
  })
  it('CH4 contrast: a panel that did not land returns nothing and moves nothing', () => {
    mount()
    const moves = refs.moved!.current
    act(() => { expect(returnFromLanded('never-landed')).toBe(false) })
    expect(refs.moved!.current).toBe(moves)
  })
})

describe('a new reply\'s camera never zooms in', () => {
  const pane = { w: 1232, h: 704 }, inset = { left: 64, top: 120, right: 347, bottom: 64 }
  it('RZ1 catch: held at 0.3 (below the try\'s floor of 0.5), cards out of view are centred at 0.3, never raised to 0.5', () => {
    const t = replyViewTarget({ x: 4000, y: 3000, w: 600, h: 300 }, pane, inset, { x: 0, y: 0, zoom: 0.3 })
    expect(t).not.toBeNull()
    expect(t!.zoom).toBe(0.3)
    const fw = pane.w - inset.left - inset.right
    expect(t!.x).toBeCloseTo(inset.left + fw / 2 - (4000 + 300) * 0.3, 6)
  })
  it('RZ2 contrast: at full size a group wider than the free canvas is zoomed OUT to fit (never below the floor), as before', () => {
    const t = replyViewTarget({ x: 4000, y: 3000, w: 1600, h: 300 }, pane, inset, { x: 0, y: 0, zoom: 1 })
    expect(t!.zoom).toBeLessThan(1)
    expect(t!.zoom).toBeGreaterThanOrEqual(0.5)
  })
  it('RZ3 must not change: cards already in view move nothing', () => {
    expect(replyViewTarget({ x: 100, y: 200, w: 200, h: 100 }, pane, inset, { x: 0, y: 0, zoom: 1 })).toBeNull()
  })
})
