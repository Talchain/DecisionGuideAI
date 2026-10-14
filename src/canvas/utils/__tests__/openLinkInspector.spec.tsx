import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { OPEN_FULL_INSPECTOR_EVENT, openLinkInspector } from '../openEdgeStrengthEditor'
import { GraphLink } from '../../../components/results/GraphLink'
import { focusEdgeByEndpoints, focusEdgeById } from '../focusHelpers'

// `focusEdgeByEndpoints` calls `focusEdgeById` inside its own module, which a module mock cannot intercept,
// so GraphLink's focus-only path is observed at the export GraphLink imports.
vi.mock('../focusHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('../focusHelpers')>()),
  focusEdgeById: vi.fn(),
  focusNodeById: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

const EDGE = { id: 'e_ab', source: 'a', target: 'b', data: { ...DEFAULT_EDGE_DATA } }
const NODES = [
  { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'b', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'B' } },
]

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({
    nodes: NODES as never, edges: [EDGE] as never, showResultsPanel: true,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

function witness(action: () => void) {
  const seen = vi.fn()
  window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, seen)
  try { action() } finally { window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, seen) }
  return seen
}

describe('openLinkInspector — live directed endpoints', () => {
  it('opens exactly the live a→b edge and dispatches one inspector event', () => {
    const seen = witness(() => expect(openLinkInspector('a', 'b')).toBe(true))
    expect(seen).toHaveBeenCalledTimes(1)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_ab'])
    expect(useCanvasStore.getState().edges.find(edge => edge.id === 'e_ab')?.selected).toBe(true)
  })

  it('CONTRAST: reversed endpoints do nothing and preserve the selected edge', () => {
    useCanvasStore.getState().selectEdgeWithoutHistory('e_ab')
    const selection = useCanvasStore.getState().selection
    const seen = witness(() => expect(openLinkInspector('b', 'a')).toBe(false))
    expect(seen).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().selection).toBe(selection)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_ab'])
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    expect(focusEdgeById).not.toHaveBeenCalled()
  })

  it('forwards centre:false without moving the camera', () => {
    expect(openLinkInspector('a', 'b', { centre: false })).toBe(true)
    expect(focusEdgeById).not.toHaveBeenCalled()
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_ab'])
  })

  it('GraphLink Size it opens the inspector when opted in', () => {
    const { getByRole } = render(<GraphLink edgeRef={{ fromId: 'a', toId: 'b' }} opensInspector label="Size it" />)
    const button = getByRole('button', { name: 'Focus on Size it in model' })
    expect(button.textContent).toBe('Size it')
    const seen = witness(() => fireEvent.click(button))
    expect(seen).toHaveBeenCalledTimes(1)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_ab'])
    expect(focusEdgeByEndpoints).not.toHaveBeenCalled()
  })

  it('CONTRAST: the same GraphLink without opensInspector only focuses the same edge', () => {
    const { getByRole } = render(<GraphLink edgeRef={{ fromId: 'a', toId: 'b' }} label="Size it" />)
    const seen = witness(() => fireEvent.click(getByRole('button', { name: 'Focus on Size it in model' })))
    expect(seen).not.toHaveBeenCalled()
    expect(focusEdgeByEndpoints).toHaveBeenCalledTimes(1)
    expect(focusEdgeByEndpoints).toHaveBeenCalledWith('a', 'b', 'a')
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([])
  })

  it('onFocus wins even when opensInspector is set', () => {
    const onFocus = vi.fn()
    const { getByRole } = render(<GraphLink edgeRef={{ fromId: 'a', toId: 'b' }} opensInspector onFocus={onFocus} label="Size it" />)
    const seen = witness(() => fireEvent.click(getByRole('button', { name: 'Focus on Size it in model' })))
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledWith('a')
    expect(seen).not.toHaveBeenCalled()
    expect(focusEdgeById).not.toHaveBeenCalled()
    expect(focusEdgeByEndpoints).not.toHaveBeenCalled()
  })

  it('a missing endpoint pair retains GraphLink fallback focus', () => {
    const { getByRole } = render(<GraphLink edgeRef={{ fromId: 'b', toId: 'a' }} opensInspector fallbackNodeId="b" label="Size it" />)
    const seen = witness(() => fireEvent.click(getByRole('button', { name: 'Focus on Size it in model' })))
    expect(seen).not.toHaveBeenCalled()
    expect(focusEdgeByEndpoints).toHaveBeenCalledTimes(1)
    expect(focusEdgeByEndpoints).toHaveBeenCalledWith('b', 'a', 'b')
  })
})
