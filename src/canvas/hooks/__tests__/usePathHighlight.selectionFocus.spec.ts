/**
 * 6A selection focus — the NEIGHBOURHOOD fallback and EDGE selection.
 *
 * Separate from usePathHighlight.spec.ts (which pins the causal-path behaviour)
 * because these cases are about what happens when there is NO usable path:
 * before this change the hook either did nothing at all (no goal node) or
 * dimmed the entire graph including the selected node's own neighbours.
 *
 * Every assertion binds to node/edge ids BY IDENTITY, never to a set size —
 * a count assertion passes just as happily when the wrong element is dimmed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { usePathHighlight } from '../usePathHighlight'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'

function createNode(id: string, type: string, kind?: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, kind: kind ?? type } }
}
// Typed as the store's own edge element (Edge<EdgeData>), not a bare Edge —
// `nodes`/`edges` on the canvas store are Edge<EdgeData>[], and a bare Edge is
// not assignable to it. The hook under test only ever reads id/source/target,
// so an empty data payload is sufficient and honest here.
function createEdge(id: string, source: string, target: string): Edge<EdgeData> {
  return { id, source, target, data: {} as EdgeData }
}

/** dimmedNodeIds as a plain sorted array, for identity-level assertions. */
const dimmedNodes = () => [...useCanvasStore.getState().dimmedNodeIds].sort()
const dimmedEdges = () => [...useCanvasStore.getState().dimmedEdgeIds].sort()
const highlightedEdges = () => [...useCanvasStore.getState().highlightedEdges].sort()

describe('usePathHighlight — 6A selection focus', () => {
  let originalState: ReturnType<typeof useCanvasStore.getState>

  beforeEach(() => {
    originalState = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      highlightedEdges: new Set(),
      dimmedNodeIds: new Set(),
      dimmedEdgeIds: new Set(),
      focusDimSourceId: null,
      ceeAnalysisReady: null,
    })
  })

  afterEach(() => {
    useCanvasStore.setState(originalState)
  })

  // ── The graph used by most cases ────────────────────────────────────────
  //
  //   far_a ── far_e1 ──> far_b            (an unrelated pair, must dim)
  //
  //   nbr_in ──e_in──> SUBJECT ──e_out──> nbr_out
  //
  const neighbourhoodGraph = () => ({
    nodes: [
      createNode('subject', 'factor'),
      createNode('nbr_in', 'factor'),
      createNode('nbr_out', 'outcome'),
      createNode('far_a', 'factor'),
      createNode('far_b', 'factor'),
    ],
    edges: [
      createEdge('e_in', 'nbr_in', 'subject'),
      createEdge('e_out', 'subject', 'nbr_out'),
      createEdge('far_e1', 'far_a', 'far_b'),
    ],
  })

  describe('no goal node (drafts, imported graphs)', () => {
    it('dims unrelated nodes while keeping the selection and its direct neighbours prominent', () => {
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        // No goal node anywhere and no ceeAnalysisReady — the pre-6A hook bailed
        // out here and dimmed NOTHING, so the user got no focus at all.
        selection: { nodeIds: new Set(['subject']), edgeIds: new Set(), anchorPosition: null },
      })

      renderHook(() => usePathHighlight())

      // The subject and BOTH direct neighbours stay prominent; only the
      // unrelated pair dims.
      expect(dimmedNodes()).toEqual(['far_a', 'far_b'])
    })

    it('dims unrelated edges but not the selection\'s own connections', () => {
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['subject']), edgeIds: new Set(), anchorPosition: null },
      })

      renderHook(() => usePathHighlight())

      expect(dimmedEdges()).toEqual(['far_e1'])
    })

    it('does NOT claim a path: highlightedEdges stays empty so the "paths to goal" chip cannot appear', () => {
      // FocusModeChip renders "Showing paths from X to goal" purely on
      // highlightedEdges.size > 0. A neighbourhood focus involves no goal and
      // no path, so writing that set here would put a false claim on screen.
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['subject']), edgeIds: new Set(), anchorPosition: null },
      })

      renderHook(() => usePathHighlight())

      expect(highlightedEdges()).toEqual([])
    })
  })

  describe('a kind with no causal-path branch (decision / action)', () => {
    it('keeps a selected decision node\'s direct neighbours prominent', () => {
      // Pre-6A this was the worst case: `decision` matched no path branch, so
      // pathEdgeIds stayed empty, nodesOnPath was just the selected node, and
      // EVERY other node dimmed — including the decision's own options.
      const nodes = [
        createNode('decision', 'decision'),
        createNode('option_a', 'option'),
        createNode('option_b', 'option'),
        createNode('goal', 'goal'),
        createNode('unrelated', 'factor'),
      ]
      const edges = [
        createEdge('d_a', 'decision', 'option_a'),
        createEdge('d_b', 'decision', 'option_b'),
        createEdge('u_g', 'unrelated', 'goal'),
      ]
      useCanvasStore.setState({
        nodes,
        edges,
        // A goal EXISTS here — so this is not the no-goal case; it is purely
        // "this kind has no path branch".
        selection: { nodeIds: new Set(['decision']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as never,
      })

      renderHook(() => usePathHighlight())

      // Both options stay prominent. Only the genuinely unrelated pair dims.
      expect(dimmedNodes()).toEqual(['goal', 'unrelated'])
      expect(dimmedEdges()).toEqual(['u_g'])
    })
  })

  describe('edge selection', () => {
    it('keeps the selected connection and its two endpoints prominent, dimming everything else', () => {
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        // Pre-6A the hook watched only selection.nodeIds, so selecting an edge
        // did nothing whatsoever.
        selection: { nodeIds: new Set(), edgeIds: new Set(['e_in']), anchorPosition: null },
      })

      renderHook(() => usePathHighlight())

      // e_in runs nbr_in -> subject, so those two stay; the rest dim.
      expect(dimmedNodes()).toEqual(['far_a', 'far_b', 'nbr_out'])
      // The selected edge itself must never be dimmed.
      expect(dimmedEdges()).toEqual(['e_out', 'far_e1'])
      expect(dimmedEdges()).not.toContain('e_in')
    })

    it('gives no focus to a mixed node+edge selection (same rule as multi-select)', () => {
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        selection: {
          nodeIds: new Set(['subject']),
          edgeIds: new Set(['far_e1']),
          anchorPosition: null,
        },
      })

      renderHook(() => usePathHighlight())

      expect(dimmedNodes()).toEqual([])
      expect(dimmedEdges()).toEqual([])
    })
  })

  describe('path mode still owns the chip, and now dims off-path edges', () => {
    it('highlights the causal path AND dims the edges off it', () => {
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('outcome', 'outcome'),
        createNode('goal', 'goal'),
        createNode('side', 'factor'),
      ]
      const edges = [
        createEdge('e1', 'factor_a', 'outcome'),
        createEdge('e2', 'outcome', 'goal'),
        createEdge('e_side', 'side', 'outcome'),
      ]
      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as never,
      })

      renderHook(() => usePathHighlight())

      // Unchanged path behaviour — the chip's claim stays true.
      expect(highlightedEdges()).toEqual(['e1', 'e2'])
      // New: the off-path edge dims so the route reads as a route.
      expect(dimmedEdges()).toEqual(['e_side'])
    })
  })

  describe('deselect restores', () => {
    it('clears node dim, edge dim and highlights when the selection is emptied', () => {
      const { nodes, edges } = neighbourhoodGraph()
      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['subject']), edgeIds: new Set(), anchorPosition: null },
      })
      const { rerender } = renderHook(() => usePathHighlight())
      // Precondition: the focus really did apply, so the clear below is
      // evidence about clearing rather than about nothing having happened.
      expect(dimmedNodes()).toEqual(['far_a', 'far_b'])

      useCanvasStore.setState({
        selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      })
      rerender()

      expect(dimmedNodes()).toEqual([])
      expect(dimmedEdges()).toEqual([])
      expect(highlightedEdges()).toEqual([])
    })
  })
})
