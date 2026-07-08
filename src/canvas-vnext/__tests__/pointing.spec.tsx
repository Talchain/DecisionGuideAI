// Pointing — useVNextFocus registers into the app-wide focus singleton:
// pan-only (zoom preserved), fail-closed on stale ids, ownership-guarded
// unregister on unmount (A3: no leak into the default graph's registration).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

const setCenter = vi.fn()
const getViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 0.75 }))
const flowToScreenPosition = vi.fn(() => ({ x: -10_000, y: -10_000 })) // off-screen by default
const fakeNodes: Record<string, { id: string; position: { x: number; y: number } }> = {
  n1: { id: 'n1', position: { x: 100, y: 200 } },
  n2: { id: 'n2', position: { x: 300, y: 400 } },
}
const fakeEdges = [{ id: 'e1', source: 'n1', target: 'n2' }]

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    useReactFlow: () => ({
      getNode: (id: string) => fakeNodes[id],
      getEdges: () => fakeEdges,
      setCenter,
      getViewport,
      flowToScreenPosition,
    }),
  }
})

import { focusNodeById, focusEdgeById, registerFocusHelpers } from '../../canvas/utils/focusHelpers'
import { VNextSelectionProvider, useVNextSelection } from '../mode/contexts'
import { useVNextFocus } from '../hooks/useVNextFocus'

let lastSelection: ReturnType<typeof useVNextSelection> | null = null

function Host() {
  useVNextFocus()
  lastSelection = useVNextSelection()
  return null
}

function renderHost() {
  return render(
    <VNextSelectionProvider>
      <Host />
    </VNextSelectionProvider>,
  )
}

beforeEach(() => {
  setCenter.mockClear()
  flowToScreenPosition.mockReturnValue({ x: -10_000, y: -10_000 })
  lastSelection = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('focusNode via the singleton', () => {
  it('pans to the node PRESERVING the current zoom and selects locally', () => {
    renderHost()
    act(() => focusNodeById('n1'))
    expect(setCenter).toHaveBeenCalledWith(100, 200, { zoom: 0.75, duration: 300 })
    expect(lastSelection?.selectedNodeId).toBe('n1')
  })

  it('fails closed on unknown node ids — no pan, no selection', () => {
    renderHost()
    act(() => focusNodeById('ghost'))
    expect(setCenter).not.toHaveBeenCalled()
    expect(lastSelection?.selectedNodeId).toBeNull()
  })

  it('in-viewport targets pulse without panning', () => {
    // Fake an on-screen hit: flow position maps inside the pane rect.
    const pane = document.createElement('div')
    pane.className = 'react-flow'
    pane.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) })
    document.body.appendChild(pane)
    flowToScreenPosition.mockReturnValue({ x: 400, y: 300 })

    renderHost()
    act(() => focusNodeById('n1'))
    expect(setCenter).not.toHaveBeenCalled()
    expect(lastSelection?.selectedNodeId).toBe('n1')
    pane.remove()
  })
})

describe('focusEdge via the singleton', () => {
  it('pans to the edge midpoint (zoom preserved) and pins the card', () => {
    renderHost()
    act(() => focusEdgeById('e1'))
    expect(setCenter).toHaveBeenCalledWith(200, 300, { zoom: 0.75, duration: 300 })
    expect(lastSelection?.pinnedEdgeId).toBe('e1')
  })

  it('fails closed on unknown edge ids', () => {
    renderHost()
    act(() => focusEdgeById('ghost-edge'))
    expect(setCenter).not.toHaveBeenCalled()
  })
})

describe('unregistration (A3 exit round-trip)', () => {
  it('unmount unregisters: subsequent focus calls no-op', () => {
    const { unmount } = renderHost()
    unmount()
    focusNodeById('n1')
    expect(setCenter).not.toHaveBeenCalled()
  })

  it("a stale cleanup never clears a NEWER registration (RFG's re-registration survives)", () => {
    const { unmount } = renderHost()
    // Simulate the default graph re-registering after the swap…
    const rfgFocusNode = vi.fn()
    registerFocusHelpers(rfgFocusNode, vi.fn())
    // …then the old vNext cleanup running late.
    unmount()
    focusNodeById('n1')
    expect(rfgFocusNode).toHaveBeenCalledWith('n1')
  })
})
