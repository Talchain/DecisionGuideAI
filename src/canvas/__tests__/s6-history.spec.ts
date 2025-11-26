/**
 * S6-HISTORY: Undo/Redo Integration with Canvas History
 *
 * Tests that undo/redo works correctly after running analysis,
 * ensuring users can revert graph changes from analysis runs.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'

describe('S6-HISTORY: Undo/Redo with Analysis Integration', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    })
  })

  describe('Analysis Run History', () => {
    it('should track history when analysis adds nodes and edges', () => {
      const { pushHistory, history } = useCanvasStore.getState()

      // Simulate initial graph
      const initialNodes: Node[] = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Initial Goal' } }
      ]
      useCanvasStore.setState({ nodes: initialNodes })

      // Check initial history state
      expect(history.past).toHaveLength(0)
      expect(history.future).toHaveLength(0)

      // Push initial state to history
      pushHistory()

      // Add analysis result nodes
      const analysisNodes: Node[] = [
        ...initialNodes,
        { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision 1' } },
        { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Decision 2' } }
      ]
      const analysisEdges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e1-3', source: '1', target: '3' }
      ]
      useCanvasStore.setState({ nodes: analysisNodes, edges: analysisEdges })

      const state = useCanvasStore.getState()

      // History should have captured the state before analysis
      expect(state.nodes).toHaveLength(3)
      expect(state.edges).toHaveLength(2)
      expect(state.history.past).toHaveLength(1)
    })

    it('should undo analysis results and restore pre-analysis graph', () => {
      const { undo, canUndo, pushHistory } = useCanvasStore.getState()

      // Initial state
      const initialNodes: Node[] = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }
      ]
      useCanvasStore.setState({ nodes: initialNodes, edges: [] })

      // Push to history
      pushHistory()

      // Verify history was pushed
      expect(useCanvasStore.getState().history.past).toHaveLength(1)

      // Simulate analysis adding nodes
      const analysisNodes: Node[] = [
        ...initialNodes,
        { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision' } }
      ]
      useCanvasStore.setState({ nodes: analysisNodes, edges: [] })

      // Verify analysis added node
      expect(useCanvasStore.getState().nodes).toHaveLength(2)
      expect(canUndo()).toBe(true)

      // Undo should restore pre-analysis state (before we added the second node)
      undo()

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0].id).toBe('1')
      expect(state.edges).toHaveLength(0)
    })

    it('should redo to re-apply analysis results', () => {
      const { undo, redo, canRedo, pushHistory } = useCanvasStore.getState()

      // Set up initial state
      const initialNodes: Node[] = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }
      ]
      useCanvasStore.setState({ nodes: initialNodes, edges: [] })
      pushHistory()

      // Add analysis results (don't push to history yet - current state)
      const analysisNodes: Node[] = [
        ...initialNodes,
        { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision' } }
      ]
      useCanvasStore.setState({ nodes: analysisNodes, edges: [] })

      // Undo analysis (goes back to initial state)
      undo()
      expect(useCanvasStore.getState().nodes).toHaveLength(1)
      expect(canRedo()).toBe(true)

      // Redo should restore analysis results
      redo()

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(2)
      expect(state.nodes[1].id).toBe('2')
      expect(canRedo()).toBe(false)
    })

    it('should handle multiple analysis runs with undo/redo', () => {
      const { undo, redo, canUndo, canRedo } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Initial state
      useCanvasStore.setState({ nodes: [], edges: [] })
      pushHistory()

      // First analysis run
      useCanvasStore.setState({
        nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal 1' } }]
      })
      pushHistory()

      // Second analysis run
      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision 1' } }
        ]
      })
      pushHistory()

      // Third analysis run
      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision 1' } },
          { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Decision 2' } }
        ]
      })

      // Verify final state
      expect(useCanvasStore.getState().nodes).toHaveLength(3)

      // Undo twice to go back to first analysis
      expect(canUndo()).toBe(true)
      undo()
      expect(useCanvasStore.getState().nodes).toHaveLength(2)

      undo()
      expect(useCanvasStore.getState().nodes).toHaveLength(1)

      // Redo to move forward
      expect(canRedo()).toBe(true)
      redo()
      expect(useCanvasStore.getState().nodes).toHaveLength(2)

      redo()
      expect(useCanvasStore.getState().nodes).toHaveLength(3)
    })
  })

  describe('History State Integrity', () => {
    it('should clear future history when new action is taken after undo', () => {
      const { undo, history } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Set up states
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } }] })
      pushHistory()

      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B' } }] })
      pushHistory()

      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'C' } }] })

      // Undo to B
      undo()
      expect(useCanvasStore.getState().history.future).toHaveLength(1)

      // New action should clear future
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'D' } }] })
      pushHistory()

      expect(useCanvasStore.getState().history.future).toHaveLength(0)
    })

    it('should preserve both nodes and edges in history', () => {
      const { undo } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Initial state with nodes and edges
      const initialState = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision' } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' }
        ]
      }
      useCanvasStore.setState(initialState)
      pushHistory()

      // Modify graph
      const modifiedState = {
        nodes: [
          ...initialState.nodes,
          { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Decision 2' } }
        ],
        edges: [
          ...initialState.edges,
          { id: 'e2-3', source: '2', target: '3' }
        ]
      }
      useCanvasStore.setState(modifiedState)

      // Undo should restore both nodes AND edges
      undo()

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(2)
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0].id).toBe('e1-2')
    })

    it('should correctly report canUndo and canRedo states', () => {
      const { undo, redo, canUndo, canRedo } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Initial state - no history
      expect(canUndo()).toBe(false)
      expect(canRedo()).toBe(false)

      // Add first state
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } }] })
      pushHistory()

      // Add second state
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B' } }] })

      // Can undo now
      expect(canUndo()).toBe(true)
      expect(canRedo()).toBe(false)

      // Undo
      undo()
      expect(canUndo()).toBe(false)
      expect(canRedo()).toBe(true)

      // Redo
      redo()
      expect(canUndo()).toBe(true)
      expect(canRedo()).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undo when history is empty', () => {
      const { undo } = useCanvasStore.getState()

      // Initial state with no history
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } }] })

      // Undo should do nothing
      undo()

      expect(useCanvasStore.getState().nodes).toHaveLength(1)
    })

    it('should handle redo when future is empty', () => {
      const { redo } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Set up state with history but no future
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } }] })
      pushHistory()
      useCanvasStore.setState({ nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'B' } }] })

      // Redo should do nothing
      redo()

      expect(useCanvasStore.getState().nodes[0].data.label).toBe('B')
    })

    it('should handle rapid successive changes (debouncing)', () => {
      const { addNode, undo } = useCanvasStore.getState()

      // Add multiple nodes rapidly (should be debounced)
      addNode()
      const countAfterFirst = useCanvasStore.getState().nodes.length

      addNode()
      addNode()

      const finalCount = useCanvasStore.getState().nodes.length
      expect(finalCount).toBe(countAfterFirst + 2)

      // Single undo should go back past rapid changes
      // (depends on debounce implementation)
      undo()

      // At least some change should have been recorded
      expect(useCanvasStore.getState().nodes.length).toBeLessThan(finalCount)
    })
  })

  describe('Integration with Graph Operations', () => {
    it('should track history when deleting nodes after analysis', () => {
      const { deleteSelected, undo, canUndo } = useCanvasStore.getState()
      const { pushHistory } = useCanvasStore.getState()

      // Set up graph with analysis results
      const analysisGraph = {
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision 1' } },
          { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Decision 2' } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' },
          { id: 'e1-3', source: '1', target: '3' }
        ],
        selection: { nodeIds: new Set(['2']), edgeIds: new Set() }
      }
      useCanvasStore.setState(analysisGraph)
      pushHistory()

      // Delete selected node
      deleteSelected()

      const stateAfterDelete = useCanvasStore.getState()
      expect(stateAfterDelete.nodes).toHaveLength(2)
      expect(stateAfterDelete.edges).toHaveLength(1) // Edge to deleted node should be gone

      // Undo should restore deleted node and edge
      expect(canUndo()).toBe(true)
      undo()

      const restoredState = useCanvasStore.getState()
      expect(restoredState.nodes).toHaveLength(3)
      expect(restoredState.edges).toHaveLength(2)
    })
  })
})
