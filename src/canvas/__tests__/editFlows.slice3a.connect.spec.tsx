import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useCanvasStore } from '../store'
import { useConnectGesture } from '../hooks/useConnectGesture'
import * as strengthEditor from '../utils/openEdgeStrengthEditor'
import { USER_EDGE_DEFAULTS } from '../domain/edges'

vi.mock('../conversation/drawnLinkProposal', () => ({ proposeForDrawnLink: vi.fn(), proposeWhenLeftUnsized: vi.fn(() => () => {}) }))
vi.mock('../editNotes/editNoteStore', () => ({ reportManualEdit: vi.fn() }))

const realAddEdge = useCanvasStore.getState().addEdge
const showToast = vi.fn()

function node(id: string, type: string) {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, kind: type } }
}

function causalEdge(id: string) {
  return { id, source: 'fac_demand', target: 'out_revenue', data: { ...USER_EDGE_DEFAULTS } }
}

/** The surface event binds the inspector that opens to the selected edge id. */
let openedIds: string[]
const onInspectorOpen = () => {
  openedIds.push(...useCanvasStore.getState().selection.edgeIds)
}

beforeEach(() => {
  vi.clearAllMocks()
  openedIds = []
  useCanvasStore.setState({
    addEdge: realAddEdge,
    currentScenarioId: null,
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    _externalMutationActive: 0,
    pendingStructuralAddEdges: [],
    engineLimits: null,
    history: { past: [], future: [] },
    nodes: [
      node('fac_demand', 'factor'),
      node('out_revenue', 'outcome'),
      node('dec_pricing', 'decision'),
      node('opt_monthly', 'option'),
    ],
    edges: [],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
  } as never)
  window.addEventListener(strengthEditor.OPEN_FULL_INSPECTOR_EVENT, onInspectorOpen)
})

afterEach(() => {
  window.removeEventListener(strengthEditor.OPEN_FULL_INSPECTOR_EVENT, onInspectorOpen)
  vi.restoreAllMocks()
  useCanvasStore.setState({ addEdge: realAddEdge })
  document.querySelectorAll('[data-slice3a-card]').forEach(el => el.remove())
})

function gesture(enabled = true) {
  return renderHook(() => useConnectGesture({ enabled, showToast })).result.current
}

function bodyDrop(g: ReturnType<typeof gesture>, source: string, target: string) {
  const card = document.createElement('div')
  card.className = 'react-flow__node'
  card.setAttribute('data-id', target)
  card.setAttribute('data-slice3a-card', '')
  const body = document.createElement('p')
  card.appendChild(body)
  document.body.appendChild(card)
  g.onConnectStart(null, { nodeId: source, handleType: 'source' })
  g.onConnectEnd({ target: body } as unknown as MouseEvent)
}

describe('slice 3a — a drawn causal link opens its strength inspector by new identity', () => {
  it('a landed handle connection opens the new id, independently of a capture receipt', () => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')
    vi.spyOn(useCanvasStore.getState(), 'addEdge').mockImplementation(connection => {
      useCanvasStore.setState(state => ({ edges: [...state.edges, { ...connection, id: 'e_new_handle' }] }))
      return { created: true }
    })

    gesture().onConnect({ source: 'fac_demand', target: 'out_revenue', sourceHandle: null, targetHandle: null })

    expect(openedIds).toEqual(['e_new_handle'])
    expect(opener.mock.calls).toEqual([['e_new_handle', { centre: false }]])
  })

  it('a landed card-body connection opens that new id through the same flow', () => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')
    vi.spyOn(useCanvasStore.getState(), 'addEdge').mockImplementation(connection => {
      useCanvasStore.setState(state => ({ edges: [...state.edges, { ...connection, id: 'e_new_body' }] }))
      return { created: true }
    })

    bodyDrop(gesture(), 'fac_demand', 'out_revenue')

    expect(openedIds).toEqual(['e_new_body'])
    expect(opener.mock.calls).toEqual([['e_new_body', { centre: false }]])
  })

  it('the real unsized causal add opens once even when onConnectEnd follows the handle drop', () => {
    const g = gesture()
    g.onConnectStart(null, { nodeId: 'fac_demand', handleType: 'source' })
    g.onConnect({ source: 'fac_demand', target: 'out_revenue', sourceHandle: null, targetHandle: null })
    g.onConnectEnd({ target: document.body } as unknown as MouseEvent)

    const landed = useCanvasStore.getState().edges
    expect(landed).toHaveLength(1)
    expect(landed[0].data?.structuralAddStandDown).toBe('strength_not_stated')
    expect(openedIds).toEqual([landed[0].id])
  })

  it('a refused duplicate opens neither the previous edge nor any other inspector', () => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')
    useCanvasStore.setState({ edges: [causalEdge('e_existing')] })

    gesture().onConnect({ source: 'fac_demand', target: 'out_revenue', sourceHandle: null, targetHandle: null })

    expect(useCanvasStore.getState().edges.map(edge => edge.id)).toEqual(['e_existing'])
    expect(openedIds).toEqual([])
    expect(opener).not.toHaveBeenCalled()
  })

  it('an add result without a new landed edge cannot open an existing edge on the same pair', () => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')
    useCanvasStore.setState({
      edges: [{ ...causalEdge('e_existing'), data: { ...USER_EDGE_DEFAULTS, structuralAddStandDown: 'strength_not_stated' } }],
    })
    vi.spyOn(useCanvasStore.getState(), 'addEdge').mockReturnValue({ created: true })

    gesture().onConnect({ source: 'fac_demand', target: 'out_revenue', sourceHandle: null, targetHandle: null })

    expect(openedIds).toEqual([])
    expect(opener).not.toHaveBeenCalled()
  })

  it.each([
    ['dec_pricing', 'opt_monthly'],
    ['opt_monthly', 'fac_demand'],
  ])('the structural %s → %s link lands without forcing a strength inspector', (source, target) => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')

    gesture().onConnect({ source, target, sourceHandle: null, targetHandle: null })

    expect(useCanvasStore.getState().edges).toHaveLength(1)
    expect(openedIds).toEqual([])
    expect(opener).not.toHaveBeenCalled()
  })

  it('a disabled connection carrier adds nothing and opens nothing', () => {
    const opener = vi.spyOn(strengthEditor, 'openEdgeStrengthEditor')

    gesture(false).onConnect({ source: 'fac_demand', target: 'out_revenue', sourceHandle: null, targetHandle: null })

    expect(useCanvasStore.getState().edges).toEqual([])
    expect(openedIds).toEqual([])
    expect(opener).not.toHaveBeenCalled()
  })
})
