/**
 * Hydration Hygiene Tests (P2 Hotfix)
 *
 * Verifies that hydrateGraphSlice:
 * - Merges only graph/scenario keys
 * - Ignores unknown keys from loaded data
 * - Leaves panels/results/UI state intact
 * - Resets history/selection/touchedNodeIds
 * - Calls reseedIds to prevent ID collisions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'

describe('Hydration Hygiene', () => {
  beforeEach(() => {
    // Reset store to clean state with some panel/results state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1,
      showResultsPanel: false,
      showInspectorPanel: false,
      results: {
        status: 'idle' as const,
        progress: 0
      },
      currentScenarioId: null
    })
  })

  describe('hydrateGraphSlice', () => {
    it('should merge only nodes and edges from loaded data', () => {
      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]
      const loadedEdges: Edge[] = [
        { id: 'e1', source: '1', target: '2' }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: loadedEdges
      })

      const { nodes, edges } = useCanvasStore.getState()
      expect(nodes).toHaveLength(1)
      expect(edges).toHaveLength(1)
      expect(nodes[0].id).toBe('1')
      expect(edges[0].id).toBe('e1')
    })

    it('should ignore unknown keys from loaded data', () => {
      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]

      const loadedWithUnknown: any = {
        nodes: loadedNodes,
        edges: [],
        unknownKey: 'should be ignored',
        anotherUnknown: { nested: 'data' }
      }

      useCanvasStore.getState().hydrateGraphSlice(loadedWithUnknown)

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(1)
      expect((state as any).unknownKey).toBeUndefined()
      expect((state as any).anotherUnknown).toBeUndefined()
    })

    it('should NOT clobber panel visibility state', () => {
      // Set up initial panel state
      useCanvasStore.setState({
        showResultsPanel: true,
        showInspectorPanel: true
      })

      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: []
      })

      const { showResultsPanel, showInspectorPanel } = useCanvasStore.getState()
      expect(showResultsPanel).toBe(true) // Preserved
      expect(showInspectorPanel).toBe(true) // Preserved
    })

    it('should NOT clobber results state', () => {
      // Set up initial results state
      useCanvasStore.setState({
        results: {
          status: 'success' as const,
          progress: 100,
          report: {
            summary: 'Test summary',
            p10: 0.1,
            p50: 0.5,
            p90: 0.9
          } as any
        }
      })

      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: []
      })

      const { results } = useCanvasStore.getState()
      expect(results.status).toBe('success') // Preserved
      expect(results.progress).toBe(100) // Preserved
      expect(results.report).toBeDefined() // Preserved
    })

    it('should reset history when loading graph', () => {
      // Set up initial history
      useCanvasStore.setState({
        history: {
          past: [
            { nodes: [], edges: [] }
          ],
          future: [
            { nodes: [], edges: [] }
          ]
        }
      })

      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: []
      })

      const { history } = useCanvasStore.getState()
      expect(history.past).toEqual([])
      expect(history.future).toEqual([])
    })

    it('should reset selection when loading graph', () => {
      // Set up initial selection
      useCanvasStore.setState({
        selection: {
          nodeIds: new Set(['1', '2']),
          edgeIds: new Set(['e1'])
        }
      })

      const loadedNodes: Node[] = [
        { id: '3', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 3' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: []
      })

      const { selection } = useCanvasStore.getState()
      expect(selection.nodeIds.size).toBe(0)
      expect(selection.edgeIds.size).toBe(0)
    })

    it('should reset touchedNodeIds when loading graph', () => {
      // Set up initial touched nodes
      useCanvasStore.setState({
        touchedNodeIds: new Set(['1', '2'])
      })

      const loadedNodes: Node[] = [
        { id: '3', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 3' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: []
      })

      const { touchedNodeIds } = useCanvasStore.getState()
      expect(touchedNodeIds.size).toBe(0)
    })

    it('should call reseedIds to prevent ID collisions', () => {
      const loadedNodes: Node[] = [
        { id: '10', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 10' } }
      ]
      const loadedEdges: Edge[] = [
        { id: 'e5', source: '10', target: '11' }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes,
        edges: loadedEdges
      })

      const { nextNodeId, nextEdgeId } = useCanvasStore.getState()
      expect(nextNodeId).toBeGreaterThan(10)
      expect(nextEdgeId).toBeGreaterThan(5)
    })

    it('should handle loading only nodes (edges undefined)', () => {
      const loadedNodes: Node[] = [
        { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loadedNodes
      })

      const { nodes, edges } = useCanvasStore.getState()
      expect(nodes).toHaveLength(1)
      expect(edges).toHaveLength(0) // Should remain unchanged (empty)
    })

    it('should handle loading only edges (nodes undefined)', () => {
      const loadedEdges: Edge[] = [
        { id: 'e1', source: 'a', target: 'b' }
      ]

      useCanvasStore.getState().hydrateGraphSlice({
        edges: loadedEdges
      })

      const { nodes, edges } = useCanvasStore.getState()
      expect(nodes).toHaveLength(0) // Should remain unchanged (empty)
      expect(edges).toHaveLength(1)
    })

    it('should update currentScenarioId when provided', () => {
      useCanvasStore.setState({
        currentScenarioId: 'old-scenario'
      })

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: [],
        edges: [],
        currentScenarioId: 'new-scenario'
      })

      const { currentScenarioId } = useCanvasStore.getState()
      expect(currentScenarioId).toBe('new-scenario')
    })

    it('should clear currentScenarioId when set to null', () => {
      useCanvasStore.setState({
        currentScenarioId: 'existing-scenario'
      })

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: [],
        edges: [],
        currentScenarioId: null
      })

      const { currentScenarioId } = useCanvasStore.getState()
      expect(currentScenarioId).toBeNull()
    })

    it('should handle partial updates (only nodes)', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'old', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Old' } }
        ],
        edges: [
          { id: 'e-old', source: 'a', target: 'b' }
        ]
      })

      useCanvasStore.getState().hydrateGraphSlice({
        nodes: [
          { id: 'new', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'New' } }
        ]
        // edges undefined - should not update
      })

      const { nodes, edges } = useCanvasStore.getState()
      expect(nodes).toHaveLength(1)
      expect(nodes[0].id).toBe('new')
      expect(edges).toHaveLength(1) // Preserved
      expect(edges[0].id).toBe('e-old') // Unchanged
    })
  })
})
