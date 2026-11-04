/**
 * Canvas A, slice S6 (canvas-A-gaps.md B5, B8, C7, D4): what the olumi-core lane cannot honour is not offered, and the canvas lets go
 * of a model core no longer holds. Tidy would re-lay core's columns with ELK (B5); the legend explains marks a View card never draws
 * (B8: each mark has core's own hover); the legacy Summary reads the adapter's saved model, so it told a person with one "no saved model
 * yet" (C7): on the lane the Summary is the View's own instead (viewBrief.spec.tsx). Off the lane each is as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, renderHook, screen, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))
import type { View } from '../client'
import { CanvasViewportControls } from '../../components/layout/CanvasViewportControls'
import { TopBar } from '../../components/layout/TopBar'
import { ToastProvider } from '../../canvas/ToastContext'
import { useCanvasStore } from '../../canvas/store'
import { runCanvasUndo } from '../../canvas/undo/undoCommand'
import { CORE_LANE_USE_THE_CHAT } from '../../olumiCore/lane'
import { layViewCanvas, placeViewCards, useViewCanvas, withdrawViewCanvas } from '../canvas'
import { useViewStore } from '../store'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

const menuItems = () => {
  render(<ReactFlowProvider><CanvasViewportControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} onZoomReset={vi.fn()} onFitView={vi.fn()} onAutoArrange={vi.fn()} /></ReactFlowProvider>)
  fireEvent.click(screen.getByTestId('viewport-more'))
  return within(screen.getByRole('menu', { name: 'More view options' })).queryAllByRole('menuitem').map((b) => b.getAttribute('data-testid'))
}

describe('B8 the view menu offers no legend on the lane', () => {
  it('on the lane: no legend; Auto-arrange stays (B5: it puts the cards where core places them)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const items = menuItems()
    expect(items).not.toContain('viewport-legend')
    expect(items).toEqual(expect.arrayContaining(['viewport-zoom-reset', 'viewport-auto-arrange']))
  })
  it('off the lane: both, as before', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(menuItems()).toEqual(expect.arrayContaining(['viewport-auto-arrange', 'viewport-legend']))
  })
})

const bar = () => (useCanvasStore.setState({ currentScenarioId: '6f37ea65-964e-4176-bcca-d68a5cc1bf06' }), render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="Pricing" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} /></ToastProvider></MemoryRouter>))

describe('C7 the top bar offers no saved-model Summary on the lane', () => {
  it('on the lane: no saved-model Summary button (the View\'s own Summary is viewBrief.spec.tsx)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    bar()
    expect(screen.queryByTestId('decision-brief-trigger')).toBeNull()
  })
  it('off the lane: the Summary button, as before', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    bar()
    expect(screen.getByTestId('decision-brief-trigger')).toBeTruthy()
  })
})

describe('D4 a View with no model takes the View\'s cards off the canvas', () => {
  const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
  it('the cards, the question and the links go; a canvas with no View cards is left as it is', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    await layViewCanvas(view.model!)
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
    expect(withdrawViewCanvas()).toBe(true)
    expect([useCanvasStore.getState().nodes, useCanvasStore.getState().edges]).toEqual([[], []])
    const other = [{ id: 'x', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'x' } }]
    useCanvasStore.setState({ nodes: other as never, edges: [] })
    expect(withdrawViewCanvas()).toBe(false)
    expect(useCanvasStore.getState().nodes).toBe(other)
  })

  it('on the lane, a View that lands with no model withdraws the canvas it drew', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    useViewStore.setState({ view })
    const { rerender } = renderHook(() => useViewCanvas(true))
    await vi.waitFor(() => expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0))
    useViewStore.setState({ view: { ...view, model: null } })
    rerender()
    expect(useCanvasStore.getState().nodes).toEqual([])
    useViewStore.setState({ view: null })
  })
})

describe('B5 Auto-arrange on the lane puts every View card back in its causal place, and asks the legacy canvas for no layout', () => {
  const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
  it('a card the person moved goes back; no layout is asked for', async () => {
    useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: false })
    await layViewCanvas(view.model!)
    const [q, first, ...rest] = useCanvasStore.getState().nodes
    const home = first!.position
    useCanvasStore.setState({ nodes: [q!, { ...first!, position: { x: 999, y: 999 } }, ...rest] })
    expect(await placeViewCards(view.model!)).toBe(true)
    expect(useCanvasStore.getState().nodes[1]!.position).toEqual(home)
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })
})

describe('lane audit 7.5 and 2.8: no local Versions, and undo says what the lane does instead', () => {
  it('the top bar offers no Versions on the lane (they snapshot View cards core never sees), and does off it', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    bar()
    expect(screen.queryByTestId('topbar-versions-trigger')).toBeNull()
    cleanup()
    vi.stubEnv('VITE_OLUMI_CORE', '')
    bar()
    expect(screen.getByTestId('topbar-versions-trigger')).toBeTruthy()
  })

  it('undo on the lane says to tell Olumi in the chat, never to sign in', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const said: string[] = []
    const hear = (e: Event) => said.push((e as CustomEvent<{ message: string }>).detail.message)
    window.addEventListener('topbar:show-toast', hear)
    await runCanvasUndo('undo')
    await runCanvasUndo('redo')
    window.removeEventListener('topbar:show-toast', hear)
    expect(said).toEqual([CORE_LANE_USE_THE_CHAT, CORE_LANE_USE_THE_CHAT])
  })
})
