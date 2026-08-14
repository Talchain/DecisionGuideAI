/**
 * F2 — THE BUTTON MUST REACH THE EDITOR, NOT JUST THE EDGE.
 *
 * The first cut of this interaction called `focusModelTarget`, which selects an
 * edge and centres the camera. A review found the obvious defect: a button
 * labelled "Set this strength" panned to the edge and STOPPED — the user still
 * had to find and click it, and `EdgePanel` (the only module that calls
 * `setStrength`) never opened. The old spec asserted `focusModelTarget` had been
 * called against a MOCK, which is why it passed while the capability was absent:
 * it pinned the first hop and inferred the rest.
 *
 * So this file asserts the hop the old one skipped, against the REAL store and
 * the REAL panel: after `openEdgeStrengthEditor`, the strength CONTROL is on
 * screen. Nothing here is mocked except the camera helper, which is a jsdom
 * impossibility rather than a link in the chain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { openEdgeStrengthEditor, OPEN_FULL_INSPECTOR_EVENT } from '../openEdgeStrengthEditor'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { InspectorModal } from '../../components/InspectorModal'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('../focusHelpers', async () => {
  const actual = await vi.importActual<typeof import('../focusHelpers')>('../focusHelpers')
  return { ...actual, focusEdgeById: vi.fn() }
})

const EDGE = {
  id: 'e_demand_rev',
  source: 'n_demand',
  target: 'n_rev',
  data: { ...DEFAULT_EDGE_DATA },
}

const NODES = [
  { id: 'n_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customer demand' } },
  { id: 'n_rev', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue growth' } },
]

beforeEach(() => {
  useCanvasStore.setState({
    nodes: NODES as never,
    edges: [EDGE] as never,
    showResultsPanel: true,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } as never,
  })
})

describe('openEdgeStrengthEditor — the route from the dock to the setter', () => {
  it('selects the named edge in the real store', () => {
    expect(openEdgeStrengthEditor('e_demand_rev')).toBe(true)
    const s = useCanvasStore.getState()
    // Bound by IDENTITY: the edge it selected is the edge it was asked for.
    expect(s.edges.find(e => e.id === 'e_demand_rev')?.selected).toBe(true)
    expect([...s.selection.edgeIds]).toEqual(['e_demand_rev'])
  })

  it('stands the DOCK down — the other half of the one-surface-at-a-time rule', () => {
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    openEdgeStrengthEditor('e_demand_rev')
    // Without this the inspector would open behind/over a dock that the canvas
    // deliberately closes it for, honouring the rule's letter and defeating it.
    expect(useCanvasStore.getState().showResultsPanel).toBe(false)
  })

  it('dispatches the event the canvas listens for, to RAISE the inspector', () => {
    const seen: string[] = []
    const h = () => seen.push(OPEN_FULL_INSPECTOR_EVENT)
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    openEdgeStrengthEditor('e_demand_rev')
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    expect(seen).toEqual([OPEN_FULL_INSPECTOR_EVENT])
  })

  it('is FAIL-CLOSED on a stale id — no selection, no dock change, no event', () => {
    const seen: string[] = []
    const h = () => seen.push('fired')
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    expect(openEdgeStrengthEditor('e_does_not_exist')).toBe(false)
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    // An empty inspector opened on a stale id is worse than no route at all.
    expect(seen).toEqual([])
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([])
  })

  it('THE HOP THE OLD SPEC SKIPPED — the STRENGTH CONTROL itself renders for that edge', () => {
    openEdgeStrengthEditor('e_demand_rev')
    const { selection } = useCanvasStore.getState()
    const edgeId = [...selection.edgeIds][0]

    // This is what `showFullInspector` gates, rendered on the selection the
    // helper just made. If the route selected the wrong edge, or the panel could
    // not build for it, there is no control here and this REDs.
    render(
      <ReactFlowProvider>
        <InspectorModal nodeId={null} edgeId={edgeId} onClose={() => {}} />
      </ReactFlowProvider>,
    )

    // `StrengthBandButtons` — the control whose onChange calls
    // `useEdgeMutations.setStrength`. Reaching THIS is what "Set this strength"
    // promises, and it is the assertion the mock-based version could not make.
    expect(screen.getByRole('group', { name: /strength presets/i })).toBeInTheDocument()
  })
})
