/**
 * `openNodeInspector` — THE TWIN THAT WAS NOT A TWIN.
 *
 * The file called itself "the node twin of `openEdgeStrengthEditor`" and
 * "deliberately built the same way" while performing TWO of its FOUR steps. The
 * two it omitted were the two that make the edge twin work from a dock surface:
 *
 *   · `setShowResultsPanel(false)` — `ReactFlowGraph.tsx:531-535` closes the
 *     inspector when the dock dispatches `outputs-dock-opened`. The arbitration
 *     was ONE-WAY, so raising the inspector from the dock opened it underneath
 *     the dock and the user saw nothing move.
 *   · `focusNodeById` — the inspector opened onto a node that could be
 *     off-screen.
 *
 * ⚠ WHY THE ASSERTIONS BELOW ARE NOT "the helper calls two more functions":
 * a spec that mocked the store and asserted two extra calls would pin the shape
 * of this implementation, not the property. These run against the REAL store and
 * assert the OBSERVABLE POSTCONDITIONS — the dock flag is down, the camera
 * helper was aimed at the node it was asked for BY IDENTITY — so the file is
 * free to change how it achieves them.
 *
 * ⚠ AND THE SYMMETRY IS ASSERTED AS A PAIR, not as two independent facts. The
 * defect was never "a missing line"; it was two helpers documented as twins that
 * had silently diverged. A test naming only the node side would go green again
 * the next time the EDGE side gains a step.
 *
 * `focusNodeById` / `focusEdgeById` are mocked because camera work is a jsdom
 * impossibility — the same and only mock the edge twin's spec takes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCanvasStore } from '../../../store'
import { openNodeInspector } from '../openNodeInspector'
import {
  openEdgeStrengthEditor,
  OPEN_FULL_INSPECTOR_EVENT,
} from '../../../utils/openEdgeStrengthEditor'
import { DEFAULT_EDGE_DATA } from '../../../domain/edges'
import { focusNodeById, focusEdgeById } from '../../../utils/focusHelpers'

vi.mock('../../../utils/focusHelpers', async () => {
  const actual =
    await vi.importActual<typeof import('../../../utils/focusHelpers')>(
      '../../../utils/focusHelpers',
    )
  return { ...actual, focusNodeById: vi.fn(), focusEdgeById: vi.fn() }
})

const NODES = [
  { id: 'n_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Customer demand' } },
  { id: 'n_rev', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue growth' } },
]

const EDGE = {
  id: 'e_demand_rev',
  source: 'n_demand',
  target: 'n_rev',
  data: { ...DEFAULT_EDGE_DATA },
}

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({
    nodes: NODES as never,
    edges: [EDGE] as never,
    showResultsPanel: true,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } as never,
  })
})

describe('openNodeInspector — the four steps its own header claims', () => {
  it('selects the named node in the real store, BY IDENTITY', () => {
    expect(openNodeInspector('n_demand')).toBe(true)
    const s = useCanvasStore.getState()
    // Bound to the object by id, never by "some node is selected" — the other
    // node in the fixture exists precisely so a wrong-object pass is visible.
    expect(s.nodes.find(n => n.id === 'n_demand')?.selected).toBe(true)
    expect(s.nodes.find(n => n.id === 'n_rev')?.selected).toBeFalsy()
    expect([...s.selection.nodeIds]).toEqual(['n_demand'])
  })

  it('⭐ STANDS THE DOCK DOWN — the half of the one-surface rule it was missing', () => {
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    openNodeInspector('n_demand')
    // Before this lane the flag stayed TRUE and the inspector opened under the
    // dock. This is the assertion the whole fix exists for.
    expect(useCanvasStore.getState().showResultsPanel).toBe(false)
  })

  it('⭐ CENTRES THE NODE it is about to show — aimed at the id it was given', () => {
    openNodeInspector('n_demand')
    expect(vi.mocked(focusNodeById)).toHaveBeenCalledTimes(1)
    // The argument matters: a helper that centred on something else would
    // satisfy a bare call-count assertion.
    expect(vi.mocked(focusNodeById)).toHaveBeenCalledWith('n_demand')
  })

  it('dispatches the event the canvas listens for, to RAISE the inspector', () => {
    const seen: string[] = []
    const h = () => seen.push(OPEN_FULL_INSPECTOR_EVENT)
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    openNodeInspector('n_demand')
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    expect(seen).toEqual([OPEN_FULL_INSPECTOR_EVENT])
  })

  it('is FAIL-CLOSED on a stale id — no selection, no dock change, no camera, no event', () => {
    const seen: string[] = []
    const h = () => seen.push('fired')
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    expect(openNodeInspector('n_does_not_exist')).toBe(false)
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    expect(seen).toEqual([])
    // The new steps must be inside the guard too — a stand-down that happened
    // on a stale id would close the user's dock for nothing.
    expect(useCanvasStore.getState().showResultsPanel).toBe(true)
    expect(vi.mocked(focusNodeById)).not.toHaveBeenCalled()
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([])
  })
})

describe('⭐ the two openers are ACTUALLY twins — asserted as a pair', () => {
  /**
   * Both helpers are driven over the same fixture and their observable effects
   * compared. A future change that adds a step to one side and not the other
   * REDs here, which is the regression this lane is closing — the node side did
   * not "lose" a line, it never had one, and nothing noticed for as long as the
   * two files were only claimed to match in prose.
   */
  const drive = (run: () => boolean, centre: { mock: { calls: unknown[] } }) => {
    const events: string[] = []
    const h = () => events.push('raised')
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    const returned = run()
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, h)
    return {
      returned,
      dockStoodDown: useCanvasStore.getState().showResultsPanel === false,
      centredOnce: centre.mock.calls.length === 1,
      inspectorRaised: events.length === 1,
    }
  }

  it('produce the SAME four observable effects on a valid target', () => {
    const node = drive(() => openNodeInspector('n_demand'), vi.mocked(focusNodeById))

    vi.clearAllMocks()
    useCanvasStore.setState({ showResultsPanel: true })

    const edge = drive(() => openEdgeStrengthEditor('e_demand_rev'), vi.mocked(focusEdgeById))

    const expected = {
      returned: true,
      dockStoodDown: true,
      centredOnce: true,
      inspectorRaised: true,
    }
    // Asserted against a LITERAL, not against each other: `toEqual(edge)` would
    // pass if both regressed identically — two blind instruments agreeing.
    expect(node).toEqual(expected)
    expect(edge).toEqual(expected)
  })

  it('are BOTH fail-closed on a stale id — same contract, same direction', () => {
    const node = drive(() => openNodeInspector('nope'), vi.mocked(focusNodeById))
    vi.clearAllMocks()
    useCanvasStore.setState({ showResultsPanel: true })
    const edge = drive(() => openEdgeStrengthEditor('nope'), vi.mocked(focusEdgeById))

    const expected = {
      returned: false,
      dockStoodDown: false,
      centredOnce: false,
      inspectorRaised: false,
    }
    expect(node).toEqual(expected)
    expect(edge).toEqual(expected)
  })
})
