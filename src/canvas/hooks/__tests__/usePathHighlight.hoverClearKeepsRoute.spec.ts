/**
 * A HOVER THAT ENDS MUST NOT ERASE THE ROUTE A CLICK LIT (Canvas lane, 4 Oct 2026 — DL 0df0e1, beat 6).
 *
 * The Compare/Changes rows light the canvas through `rowCanvasLink`: hover → `highlightEdge`, leave →
 * `clearHighlight`, click → `focusEdgeById` + `{ route: true }` (`routeFocus.ts`). The route to the goal is drawn by
 * THIS hook into the same `highlightedEdges` set, and the hook's effect did not re-run when a clear emptied that set.
 * So the journey "hover a row → click it (route lights) → move the pointer away" wiped the route and the
 * "Showing paths" chip while the selection that asked for it was still standing.
 *
 * The fix restores ONLY a path this hook drew, ONLY while that path focus still holds. The controls pin the rest:
 * with no selection, or a neighbourhood focus (no path; the chip must not claim one), a hover lights and its clear
 * empties, exactly as before. Assertions bind edge ids by identity, never set sizes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { usePathHighlight } from '../usePathHighlight'
import { clearHighlight, highlightEdge } from '../../utils/highlightHelpers'
import type { EdgeData } from '../../domain/edges'

const node = (id: string, kind: string): Node => ({ id, type: kind, position: { x: 0, y: 0 }, data: { label: id, kind } })
const edge = (id: string, source: string, target: string): Edge<EdgeData> => ({ id, source, target, data: {} as EdgeData })
const lit = () => [...useCanvasStore.getState().highlightedEdges].sort()

//   price ──e_pm──> mrr_driver ──e_mg──> goal        decision ──e_do──> option   (no route from a decision)
const GRAPH = {
  nodes: [node('price', 'factor'), node('mrr_driver', 'outcome'), node('goal', 'goal'), node('decision', 'decision'), node('option', 'option')],
  edges: [edge('e_pm', 'price', 'mrr_driver'), edge('e_mg', 'mrr_driver', 'goal'), edge('e_do', 'decision', 'option')],
}
const select = (nodeIds: string[], edgeIds: string[]) =>
  useCanvasStore.setState({ selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds), anchorPosition: null } })

describe('usePathHighlight — a hover-clear never erases a standing route', () => {
  let original: ReturnType<typeof useCanvasStore.getState>
  beforeEach(() => {
    original = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: GRAPH.nodes,
      edges: GRAPH.edges,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      highlightedEdges: new Set(),
      dimmedNodeIds: new Set(),
      dimmedEdgeIds: new Set(),
      focusDimSourceId: null,
      ceeAnalysisReady: null,
      runChangesRouteFocusId: null,
    })
  })
  afterEach(() => {
    useCanvasStore.setState(original)
  })

  it('⭐ the Compare journey: click a row (route lit) → hover another → leave ⇒ the route is lit again', () => {
    renderHook(() => usePathHighlight())
    act(() => {
      select([], ['e_pm'])
      useCanvasStore.getState().setRunChangesRouteFocus('e_pm')
    })
    expect(lit()).toEqual(['e_mg', 'e_pm'])

    act(() => highlightEdge('e_do'))
    expect(lit()).toEqual(['e_do']) // the hover still lights what it points at

    act(() => clearHighlight())
    expect(lit()).toEqual(['e_mg', 'e_pm'])
  })

  it('a selected factor\'s paths to the goal survive a hover-clear too', () => {
    renderHook(() => usePathHighlight())
    act(() => select(['price'], []))
    expect(lit()).toEqual(['e_mg', 'e_pm'])
    act(() => highlightEdge('e_do'))
    act(() => clearHighlight())
    expect(lit()).toEqual(['e_mg', 'e_pm'])
  })

  it('CONTROL — no selection: a hover lights, and its clear empties (nothing is restored)', () => {
    renderHook(() => usePathHighlight())
    act(() => highlightEdge('e_pm'))
    expect(lit()).toEqual(['e_pm'])
    act(() => clearHighlight())
    expect(lit()).toEqual([])
  })

  it('CONTROL — a neighbourhood focus (no route) never gets a path written into the chip\'s set', () => {
    renderHook(() => usePathHighlight())
    act(() => select(['decision'], []))
    expect(lit()).toEqual([])
    act(() => highlightEdge('e_pm'))
    expect(lit()).toEqual(['e_pm'])
    act(() => clearHighlight())
    expect(lit()).toEqual([])
  })

  it('CONTROL — once the selection ends, a later clear does not resurrect the old route', () => {
    renderHook(() => usePathHighlight())
    act(() => select(['price'], []))
    expect(lit()).toEqual(['e_mg', 'e_pm'])
    act(() => select([], []))
    expect(lit()).toEqual([])
    act(() => highlightEdge('e_do'))
    act(() => clearHighlight())
    expect(lit()).toEqual([])
  })
})
