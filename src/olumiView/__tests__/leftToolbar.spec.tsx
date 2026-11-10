import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactFlowProps } from '@xyflow/react'
import type { View } from '../client'
import { ViewCanvas } from '../ViewCanvas'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useCanvasStore } from '../../canvas/store'
import { LeftSidebar } from '../../components/layout/LeftSidebar'

const flow = vi.hoisted(() => ({ panOnDrag: undefined as ReactFlowProps['panOnDrag'], selectionOnDrag: undefined as boolean | undefined }))
vi.mock('@xyflow/react', async (original) => {
  const real = await original<typeof import('@xyflow/react')>()
  return { ...real, ReactFlow: (props: ReactFlowProps) => {
    flow.panOnDrag = props.panOnDrag; flow.selectionOnDrag = props.selectionOnDrag
    return <real.ReactFlow {...props} />
  } }
})
// As in v10Canvas: keep the mounted canvas; omit the dock/attention card, which need the whole app.
vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const bakery = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
beforeEach(() => {
  useViewStore.setState({ uuid: 'u', sid: bakery.id, view: bakery, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: bakery.you_id, name: bakery.you }, status: 'ready' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})
const mount = () => render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
const toolbar = () => screen.getByRole('navigation', { name: 'Canvas tools' })
const plus = () => within(toolbar()).getByTestId('canvas-add-to-model')

describe('core lane left toolbar', () => {
  it('draws exactly +, Select and Pan in order, without Undo or the old floating opener', () => {
    mount()
    expect(within(toolbar()).getAllByRole('button').map((b) => b.dataset.testid)).toEqual([
      'canvas-add-to-model', 'canvas-tool-select', 'canvas-tool-hand',
    ])
    expect(within(toolbar()).queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(screen.queryByTestId('view-add-figure-open')).toBeNull()
  })

  it('defaults to Pan; Select enables drag selection with middle-button pan; pressing the active tool keeps it active', () => {
    mount()
    const select = within(toolbar()).getByTestId('canvas-tool-select'), pan = within(toolbar()).getByTestId('canvas-tool-hand')
    const mode = (selecting: boolean) => {
      expect(select).toHaveAttribute('aria-pressed', String(selecting))
      expect(pan).toHaveAttribute('aria-pressed', String(!selecting))
      expect(flow.selectionOnDrag).toBe(selecting)
      expect(flow.panOnDrag).toEqual(selecting ? [1] : [0, 1])
    }
    mode(false)
    fireEvent.click(select); mode(true)
    fireEvent.click(select); mode(true)
    fireEvent.click(pan); mode(false)
    fireEvent.click(pan); mode(false)
  })

  it('+ opens only Add a figure; choosing it shows the existing form beside the toolbar', () => {
    mount()
    fireEvent.click(plus())
    const menu = screen.getByRole('menu', { name: 'Add to model' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveAccessibleName('Add a figure')
    fireEvent.click(items[0]!)
    expect(screen.queryByRole('menu')).toBeNull()
    const form = screen.getByTestId('view-add-figure-form')
    expect(toolbar()).toContainElement(form)
    expect(form).toHaveClass('absolute', 'left-full', 'top-0')
  })

  it.each(['Escape', 'outside press'])('%s closes the add menu and returns focus to +', async (dismiss) => {
    mount()
    fireEvent.click(plus())
    const menu = screen.getByRole('menu')
    if (dismiss === 'Escape') fireEvent.keyDown(menu, { key: 'Escape' })
    else fireEvent.click(document.body)
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
      expect(plus()).toHaveFocus()
    })
  })

  it.each(['no edit_base', 'past version', 'different person'])('%s hides + while keeping Select and Pan operable', (unavailable) => {
    mount()
    // In particular, an already-open menu cannot carry write access to another person's page.
    fireEvent.click(plus())
    act(() => {
      if (unavailable === 'no edit_base') useViewStore.setState({ view: { ...bakery, model: { ...bakery.model!, edit_base: null } } })
      else if (unavailable === 'past version') useViewStore.setState({ at: 1 })
      else useMe.setState({ me: { id: 'someone-else', name: 'Someone else' } })
    })
    expect(within(toolbar()).queryByTestId('canvas-add-to-model')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(within(toolbar()).getAllByRole('button').map((b) => b.dataset.testid)).toEqual(['canvas-tool-select', 'canvas-tool-hand'])
    fireEvent.click(within(toolbar()).getByTestId('canvas-tool-select'))
    expect(within(toolbar()).getByTestId('canvas-tool-select')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the legacy sidebar defaults: Add, Select, Hand and Undo', () => {
    render(<LeftSidebar onAddToModelClick={vi.fn()} />)
    expect(within(toolbar()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add to model', 'Select mode', 'Hand mode', 'Undo',
    ])
  })
})
