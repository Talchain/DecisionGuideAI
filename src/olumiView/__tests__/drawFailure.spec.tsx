/**
 * Codex replay of 3e4642b0 (15 Nov): after a successful View read the lazy layout-engine file was refused; the canvas said "Opening this
 * scenario…" with no cards and no retry. Bound on the REAL mounted canvas and the real drawing hook (useViewCanvas): the lay-out
 * (`causalPlaces`, which awaits the lazy engine) rejects once, then works. Harness as coldOpenLine.spec, with the dock's hook mounted
 * beside the canvas. The retry draws the View already held: the View store's read is never called again.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import { useViewCanvas, useViewDrawState } from '../canvas'
import { DRAW_FAILED_WORDS, READING_WORDS } from '../ViewWelcome'

const lay = vi.hoisted(() => ({ refuse: 0, broken: 0 }))
vi.mock('../layout', async (real) => {
  const actual = await real<typeof import('../layout')>()
  return { ...actual, causalPlaces: (...a: Parameters<typeof actual.causalPlaces>) => (lay.broken-- > 0 ? Promise.resolve(null as never) : lay.refuse-- > 0 ? Promise.reject(new Error('Failed to fetch dynamically imported module')) : actual.causalPlaces(...a)) }
})
vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const bakery = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
const refresh = vi.fn()
function Drawn() { useViewCanvas(true); return <ViewCanvas /> }
beforeEach(() => {
  lay.refuse = 0
  lay.broken = 0
  refresh.mockReset()
  useViewDrawState.setState({ failed: false, attempt: 0 })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: 'u' } as never)
  useViewStore.setState({ uuid: 'u', sid: bakery.id, view: bakery, status: 'ready', error: null, stale: false, at: null, refresh } as never)
  useMe.setState({ me: { id: bakery.you_id, name: bakery.you }, status: 'ready' })
})
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null } as never)
})
const mount = () => render(<div style={{ width: 1232, height: 704 }}><Drawn /></div>)

describe('a saved scenario whose drawing fails after a successful read', () => {
  it('catch: a refused lay-out says so with one Try again, not the opening line; pressing it draws the same version, with no new read', async () => {
    lay.refuse = 1
    mount()
    expect(await screen.findByTestId('view-draw-again')).toHaveTextContent('Try again')
    expect(screen.getByTestId('view-reading-words')).toHaveTextContent(DRAW_FAILED_WORDS)
    expect(screen.queryByText(READING_WORDS)).toBeNull()
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    const held = useViewStore.getState().view
    await act(async () => { fireEvent.click(screen.getByTestId('view-draw-again')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(useCanvasStore.getState().nodes.length, 'the cards are drawn').toBeGreaterThan(0)
    expect(screen.queryByTestId('view-reading')).toBeNull()
    expect(screen.queryByTestId('view-draw-again')).toBeNull()
    expect(useViewStore.getState().view, 'the same saved version').toBe(held)
    expect(refresh, 'no new read of the scenario').not.toHaveBeenCalled()
  })
  it('catch: a lay-out that resolves but whose drawing then throws is said too, not left under the opening line', async () => {
    // The place map is unusable, so drawViewCanvas (after the layout succeeded) throws: the handler must cover that step as well.
    lay.broken = 1
    mount()
    expect(await screen.findByTestId('view-draw-again')).toHaveTextContent('Try again')
    expect(screen.queryByText(READING_WORDS)).toBeNull()
  })
  it('catch: another scenario\'s earlier failure is not shown on a View whose own drawing is in flight', async () => {
    useViewDrawState.setState({ failed: true })
    mount()
    expect(screen.queryByTestId('view-draw-again')).toBeNull()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
  })
  it('must not change: a first drawing that works never shows the sentence or the button', async () => {
    mount()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
    expect(screen.queryByTestId('view-draw-again')).toBeNull()
    expect(screen.queryByText(DRAW_FAILED_WORDS)).toBeNull()
  })
})
