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

const lane = vi.hoisted(() => ({ on: true }))
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
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
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
  lane.on = true
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useMe.setState({ me: null, status: 'none' })
  useCanvasStore.setState({ nodes: [], edges: [] })
})
const mount = () => render(<div style={{ width: 1232, height: 704 }}><ViewCanvas /></div>)
const toolbar = () => screen.getByRole('toolbar', { name: 'Canvas tools' })
const plus = () => within(toolbar()).getByTestId('canvas-add-to-model')

describe('core lane left toolbar', () => {
  it('draws exactly +, Select, Pan, Undo and Layers in order (V12 tool run), without the old floating opener', () => {
    mount()
    expect(within(toolbar()).getAllByRole('button').map((b) => b.dataset.testid)).toEqual([
      'canvas-add-to-model', 'canvas-tool-select', 'canvas-tool-hand', 'lane-undo', 'v12-layers-button',
    ])
    expect(within(toolbar()).getByTestId('lane-undo')).toBeTruthy()
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

  it('+ opens the five model types and Figure opens the shared draft form', () => {
    mount()
    fireEvent.click(plus())
    const menu = screen.getByRole('menu', { name: 'Add to model' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Figure', 'Option', 'Risk', 'Claim', 'Open question'])
    fireEvent.click(items[0]!)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByTestId('lane-edit-form')).toHaveAttribute('data-kind', 'figure-add')
    expect(screen.getByTestId('lane-edit-label')).toHaveFocus()
  })

  it.each(['Escape', 'outside press'])('%s closes the add menu', async (dismiss) => {
    mount()
    fireEvent.click(plus())
    const menu = screen.getByRole('menu')
    if (dismiss === 'Escape') fireEvent.keyDown(menu, { key: 'Escape' })
    else fireEvent.pointerDown(document.body)
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
      if (dismiss === 'Escape') expect(plus()).toHaveFocus()
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
    // Paul's left menu keeps its + in place (audit F19): with no edit base it is there, disabled, and says why; never on a past version or another's page.
    const held = unavailable === 'no edit_base' ? ['canvas-add-to-model-held'] : []
    expect(within(toolbar()).getAllByRole('button').map((b) => b.dataset.testid)).toEqual([...held, 'canvas-tool-select', 'canvas-tool-hand', 'lane-undo', 'v12-layers-button'])
    if (held.length > 0) {
      const button = within(toolbar()).getByTestId('canvas-add-to-model-held')
      expect(button).toHaveAttribute('aria-disabled', 'true')
      button.focus()
      expect(button).toHaveFocus()
      fireEvent.click(button)
      expect(screen.queryByRole('menu')).toBeNull()
    }
    fireEvent.click(within(toolbar()).getByTestId('canvas-tool-select'))
    expect(within(toolbar()).getByTestId('canvas-tool-select')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the legacy sidebar defaults: Add, Select, Hand and Undo', () => {
    lane.on = false
    render(<LeftSidebar onAddToModelClick={vi.fn()} />)
    const navigation = screen.getByRole('navigation', { name: 'Canvas tools' })
    expect(within(navigation).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add to model', 'Select mode', 'Hand mode', 'Undo',
    ])
  })
})
