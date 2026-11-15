/**
 * Cold reopen (14 Nov, Sunday visual baseline): a saved scenario reopened cold showed an empty canvas with no words for seconds. The
 * opening line ("Opening this scenario…") left the moment the View was read (ViewCanvas unmounted ViewWelcome on `hasModel`), while the
 * layout engine loaded and the board was laid out and drawn. Bound here on the REAL mounted canvas: the View read, nothing drawn yet, the
 * line is on the canvas; the View's own model drawn by the canvas's own producer (layViewCanvas), the line is gone. Harness as
 * leftToolbar.spec and fitHandler.spec: the dock and the attention card are left out (they need the whole app), so the dock's
 * useViewCanvas does not draw by itself here and the test draws, as that hook does.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import { layViewCanvas } from '../canvas'
import { READING_WORDS } from '../ViewWelcome'

vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const bakery = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
beforeEach(() => {
  // The scenario on screen is the one whose View was read (the route's id, as the cold-load gate sets it before the canvas mounts).
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: 'u' } as never)
  useViewStore.setState({ uuid: 'u', sid: bakery.id, view: bakery, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: bakery.you_id, name: bakery.you }, status: 'ready' })
})
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null } as never)
})
const mount = () => render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)

describe('a saved scenario reopened cold, on the mounted canvas', () => {
  it('catch: its View read and nothing of it drawn yet, the canvas says it is opening; once the model is drawn, the line goes', async () => {
    expect(bakery.model?.cards.length, 'precondition: the View read holds a model').toBeGreaterThan(0)
    mount()
    expect(screen.getByTestId('view-reading-words')).toHaveTextContent(READING_WORDS)
    expect(screen.queryByTestId('view-reading-again'), 'a read that succeeded offers no retry').toBeNull()
    expect(screen.queryByTestId('view-welcome'), 'a scenario with a model is not waiting for its brief').toBeNull()
    await act(async () => { await layViewCanvas(bakery.model!) })
    expect(useCanvasStore.getState().nodes.length, 'precondition: the model is on the canvas').toBeGreaterThan(0)
    expect(screen.queryByTestId('view-reading')).toBeNull()
  })
  it('must not change: a scenario other than the one on screen shows no opening line over this canvas', () => {
    useCanvasStore.setState({ currentScenarioId: 'other' } as never)
    mount()
    expect(screen.queryByTestId('view-reading')).toBeNull()
  })
})
