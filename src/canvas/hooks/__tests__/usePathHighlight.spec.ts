/**
 * Tests for usePathHighlight hook
 *
 * These tests verify the path highlighting behavior based on node selection.
 * We test the hook's integration with the store rather than mocking everything.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { usePathHighlight } from '../usePathHighlight'
import type { Node, Edge } from '@xyflow/react'

// Helper to create test nodes
function createNode(id: string, type: string, kind?: string): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, kind: kind ?? type },
  }
}

// Helper to create test edges
function createEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
  }
}

describe('usePathHighlight', () => {
  // Store the original state to restore after each test
  let originalState: ReturnType<typeof useCanvasStore.getState>

  beforeEach(() => {
    // Save original state
    originalState = useCanvasStore.getState()

    // Reset relevant store state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      highlightedEdges: new Set(),
      dimmedNodeIds: new Set(),
      ceeAnalysisReady: null,
    })
  })

  afterEach(() => {
    // Restore original state
    useCanvasStore.setState(originalState)
  })

  describe('Factor selection', () => {
    it('should highlight all edges from factor downstream to goal', () => {
      // Setup: Linear graph factor → outcome → goal
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('outcome', 'outcome'),
        createNode('goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'factor_a', 'outcome'),
        createEdge('e2', 'outcome', 'goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.has('e1')).toBe(true)
      expect(state.highlightedEdges.has('e2')).toBe(true)
    })

    it('should highlight multiple paths when factor has multiple downstream routes', () => {
      // Setup: factor → outcome_1 → goal AND factor → outcome_2 → goal
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('outcome_1', 'outcome'),
        createNode('outcome_2', 'outcome'),
        createNode('goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'factor_a', 'outcome_1'),
        createEdge('e2', 'factor_a', 'outcome_2'),
        createEdge('e3', 'outcome_1', 'goal'),
        createEdge('e4', 'outcome_2', 'goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(4)
    })

    it('should dim nodes not on highlighted paths', () => {
      // Setup: factor_a → goal, factor_b (disconnected from selection)
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('factor_b', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [createEdge('e1', 'factor_a', 'goal')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.dimmedNodeIds.has('factor_b')).toBe(true)
      expect(state.dimmedNodeIds.has('factor_a')).toBe(false)
      expect(state.dimmedNodeIds.has('goal')).toBe(false)
    })

    it('should handle factor with no path to goal gracefully', () => {
      // Setup: Orphan factor with no outgoing edges to goal
      const nodes = [
        createNode('orphan', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges: Edge[] = []

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['orphan']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      // Should not throw
      expect(() => renderHook(() => usePathHighlight())).not.toThrow()

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(0)
    })
  })

  describe('Option selection', () => {
    it('should highlight paths from intervention targets to goal', () => {
      // Setup: option_a has interventions: { factor_price: 59 }
      const nodes = [
        createNode('option_a', 'option'),
        createNode('factor_price', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [createEdge('e1', 'factor_price', 'goal')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['option_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: {
          goal_node_id: 'goal',
          options: [{ id: 'option_a', interventions: { factor_price: 59 } }],
        } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.has('e1')).toBe(true)
    })

    it('should highlight paths from all intervention targets to goal', () => {
      // Setup: option_a intervenes on factor_price AND factor_spend
      const nodes = [
        createNode('option_a', 'option'),
        createNode('factor_price', 'factor'),
        createNode('factor_spend', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'factor_price', 'goal'),
        createEdge('e2', 'factor_spend', 'goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['option_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: {
          goal_node_id: 'goal',
          options: [{ id: 'option_a', interventions: { factor_price: 59, factor_spend: 100 } }],
        } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.has('e1')).toBe(true)
      expect(state.highlightedEdges.has('e2')).toBe(true)
    })
  })

  describe('Goal selection', () => {
    it('should highlight all incoming paths from root factors', () => {
      // Setup: factor_a → outcome → goal, factor_b → goal
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('factor_b', 'factor'),
        createNode('outcome', 'outcome'),
        createNode('goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'factor_a', 'outcome'),
        createEdge('e2', 'outcome', 'goal'),
        createEdge('e3', 'factor_b', 'goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['goal']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.has('e1')).toBe(true)
      expect(state.highlightedEdges.has('e2')).toBe(true)
      expect(state.highlightedEdges.has('e3')).toBe(true)
    })
  })

  describe('Highlight clearing', () => {
    it('should clear highlights when clicking empty canvas (no selection)', () => {
      // First set up some highlights
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [createEdge('e1', 'factor_a', 'goal')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      const { rerender } = renderHook(() => usePathHighlight())

      // Verify highlights exist
      let state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBeGreaterThan(0)

      // Clear selection (simulate clicking empty canvas)
      act(() => {
        useCanvasStore.setState({
          selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
        })
      })
      rerender()

      // Verify highlights cleared
      state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(0)
      expect(state.dimmedNodeIds.size).toBe(0)
    })

    it('should NOT auto-clear highlights on timer', async () => {
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [createEdge('e1', 'factor_a', 'goal')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      // Wait 5 seconds
      await vi.waitFor(
        () => {
          const state = useCanvasStore.getState()
          // Highlights should still be present
          expect(state.highlightedEdges.has('e1')).toBe(true)
        },
        { timeout: 100 }
      )
    })
  })

  describe('Multi-select handling', () => {
    it('should clear highlights when going from single to multi-select', () => {
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('factor_b', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'factor_a', 'goal'),
        createEdge('e2', 'factor_b', 'goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'goal', options: [] } as any,
      })

      const { rerender } = renderHook(() => usePathHighlight())

      // Verify single selection has highlights
      let state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBeGreaterThan(0)
      expect(state.dimmedNodeIds.size).toBeGreaterThan(0)

      // Cmd+click to multi-select (2 selected)
      act(() => {
        useCanvasStore.setState({
          selection: {
            nodeIds: new Set(['factor_a', 'factor_b']),
            edgeIds: new Set(),
            anchorPosition: null,
          },
        })
      })
      rerender()

      // Multi-select should clear highlights
      state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(0)
      expect(state.dimmedNodeIds.size).toBe(0)
    })
  })

  describe('No goal node', () => {
    it('should not highlight when no goal node exists in graph', () => {
      // Graph has no goal node - only factors
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('factor_b', 'factor'),
      ]
      const edges = [createEdge('e1', 'factor_a', 'factor_b')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: null, // No analysis ready
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(0)
    })

    it('should highlight using fallback when goal node exists but ceeAnalysisReady is null', () => {
      // Goal node exists but no CEE metadata - should use fallback
      const nodes = [
        createNode('factor_a', 'factor'),
        createNode('goal', 'goal'),
      ]
      const edges = [createEdge('e1', 'factor_a', 'goal')]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['factor_a']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: null, // No analysis ready - fallback should find goal
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      // Fallback finds goal node and highlights the path
      expect(state.highlightedEdges.size).toBe(1)
      expect(state.highlightedEdges.has('e1')).toBe(true)
    })
  })

  describe('Reconverging graphs', () => {
    it('should highlight ALL edges in reconverging graph', () => {
      // A → B → D → Goal AND A → C → D → Goal
      const nodes = [
        createNode('A', 'factor'),
        createNode('B', 'outcome'),
        createNode('C', 'outcome'),
        createNode('D', 'outcome'),
        createNode('Goal', 'goal'),
      ]
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'A', 'C'),
        createEdge('e3', 'B', 'D'),
        createEdge('e4', 'C', 'D'), // This was being missed with naive DFS
        createEdge('e5', 'D', 'Goal'),
      ]

      useCanvasStore.setState({
        nodes,
        edges,
        selection: { nodeIds: new Set(['A']), edgeIds: new Set(), anchorPosition: null },
        ceeAnalysisReady: { goal_node_id: 'Goal', options: [] } as any,
      })

      renderHook(() => usePathHighlight())

      const state = useCanvasStore.getState()
      expect(state.highlightedEdges.size).toBe(5)
      expect(state.highlightedEdges.has('e1')).toBe(true)
      expect(state.highlightedEdges.has('e2')).toBe(true)
      expect(state.highlightedEdges.has('e3')).toBe(true)
      expect(state.highlightedEdges.has('e4')).toBe(true) // Must not be missed
      expect(state.highlightedEdges.has('e5')).toBe(true)
    })
  })
})
