import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('Canvas Store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.getState().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('initializes with 4 demo nodes', () => {
    const { nodes } = useCanvasStore.getState()
    expect(nodes).toHaveLength(4)
  })

  it('adds node with stable ID', () => {
    const { addNode } = useCanvasStore.getState()
    addNode()
    const newNodes = useCanvasStore.getState().nodes
    expect(newNodes).toHaveLength(5)
    expect(newNodes[4].id).toBe('5')
  })

  it('generates monotonic node IDs', () => {
    const { createNodeId } = useCanvasStore.getState()
    const id1 = createNodeId()
    const id2 = createNodeId()
    expect(parseInt(id2)).toBeGreaterThan(parseInt(id1))
  })

  it('generates monotonic edge IDs', () => {
    const { createEdgeId } = useCanvasStore.getState()
    const id1 = createEdgeId()
    const id2 = createEdgeId()
    expect(id1).toBe('e5')
    expect(id2).toBe('e6')
  })

  it('supports multiple edges between same nodes', () => {
    const { addEdge } = useCanvasStore.getState()
    addEdge({ source: '1', target: '2' })
    addEdge({ source: '1', target: '2' })
    const { edges } = useCanvasStore.getState()
    const between1and2 = edges.filter(e => e.source === '1' && e.target === '2')
    expect(between1and2.length).toBeGreaterThanOrEqual(2)
  })

  it('reseeds IDs on hydrate', () => {
    const { reseedIds } = useCanvasStore.getState()
    const nodes = [
      { id: '1', type: 'decision', position: { x: 0, y: 0 }, data: {} },
      { id: '2', type: 'decision', position: { x: 0, y: 0 }, data: {} },
      { id: '7', type: 'decision', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges = [{ id: 'e10', source: '1', target: '2' }]
    reseedIds(nodes, edges)
    const { nextNodeId, nextEdgeId } = useCanvasStore.getState()
    expect(nextNodeId).toBe(8)
    expect(nextEdgeId).toBe(11)
  })

  it('pushes history on add', () => {
    const { addNode, history } = useCanvasStore.getState()
    expect(history.past).toHaveLength(0)
    addNode()
    const newHistory = useCanvasStore.getState().history
    expect(newHistory.past).toHaveLength(1)
  })

  it('caps history at 50 entries', () => {
    const { addNode } = useCanvasStore.getState()
    for (let i = 0; i < 60; i++) {
      addNode()
    }
    const { history } = useCanvasStore.getState()
    expect(history.past.length).toBeLessThanOrEqual(50)
  })

  it('debounces history push on drag', () => {
    const { onNodesChange } = useCanvasStore.getState()
    onNodesChange([{ id: '1', type: 'position', dragging: true, position: { x: 10, y: 10 } }])
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
    vi.advanceTimersByTime(200)
    expect(useCanvasStore.getState().history.past).toHaveLength(1)
  })

  it('clears timer on reset', () => {
    const { onNodesChange, reset } = useCanvasStore.getState()
    onNodesChange([{ id: '1', type: 'position', dragging: true, position: { x: 10, y: 10 } }])
    reset()
    vi.advanceTimersByTime(300)
    // History should still be empty because reset cleared the timer
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })

  it('undo restores previous state', () => {
    const { addNode, undo, nodes } = useCanvasStore.getState()
    const initialCount = nodes.length
    addNode()
    expect(useCanvasStore.getState().nodes).toHaveLength(initialCount + 1)
    undo()
    expect(useCanvasStore.getState().nodes).toHaveLength(initialCount)
  })

  it('redo restores undone state', () => {
    const { addNode, undo, redo, nodes } = useCanvasStore.getState()
    const initialCount = nodes.length
    addNode()
    undo()
    redo()
    expect(useCanvasStore.getState().nodes).toHaveLength(initialCount + 1)
  })

  it('purges future on new change after undo', () => {
    const { addNode, undo } = useCanvasStore.getState()
    addNode()
    addNode()
    undo()
    expect(useCanvasStore.getState().history.future).toHaveLength(1)
    addNode()
    expect(useCanvasStore.getState().history.future).toHaveLength(0)
  })

  it('tracks selection', () => {
    const { onSelectionChange, nodes } = useCanvasStore.getState()
    onSelectionChange({ nodes: [nodes[0]], edges: [] })
    const newSelection = useCanvasStore.getState().selection
    expect(newSelection.nodeIds.has(nodes[0].id)).toBe(true)
  })

  it('deletes selected nodes and connected edges', () => {
    const { onSelectionChange, deleteSelected, nodes, edges } = useCanvasStore.getState()
    const initialEdges = edges.length
    onSelectionChange({ nodes: [nodes[0]], edges: [] })
    deleteSelected()
    const state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(3)
    expect(state.edges.length).toBeLessThan(initialEdges)
  })

  it('updates node label', () => {
    const { updateNodeLabel } = useCanvasStore.getState()
    updateNodeLabel('1', 'New Label')
    const updated = useCanvasStore.getState().nodes.find(n => n.id === '1')
    expect(updated?.data.label).toBe('New Label')
  })

  it('reset clears history and restores demo', () => {
    const { addNode, reset } = useCanvasStore.getState()
    addNode()
    addNode()
    reset()
    const { nodes, history } = useCanvasStore.getState()
    expect(nodes).toHaveLength(4)
    expect(history.past).toHaveLength(0)
    expect(history.future).toHaveLength(0)
  })

  it('cleanup clears pending timers', () => {
    const { onNodesChange, cleanup } = useCanvasStore.getState()
    onNodesChange([{ id: '1', type: 'position', dragging: true, position: { x: 10, y: 10 } }])
    cleanup()
    vi.advanceTimersByTime(300)
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })

  // Authoring feature tests
  it('duplicates selected nodes with offset', () => {
    const { nodes, duplicateSelected } = useCanvasStore.getState()
    
    // Select first node
    useCanvasStore.setState({ 
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() } 
    })
    
    duplicateSelected()
    
    const newNodes = useCanvasStore.getState().nodes
    expect(newNodes).toHaveLength(5)
    
    // New node should be offset
    const original = nodes[0]
    const duplicate = newNodes[4]
    expect(duplicate.position.x).toBe(original.position.x + 50)
    expect(duplicate.position.y).toBe(original.position.y + 50)
  })

  it('copies selected nodes to clipboard', () => {
    const { copySelected } = useCanvasStore.getState()
    
    useCanvasStore.setState({ 
      selection: { nodeIds: new Set(['1', '2']), edgeIds: new Set() } 
    })
    
    copySelected()
    
    const { clipboard } = useCanvasStore.getState()
    expect(clipboard?.nodes).toHaveLength(2)
  })

  it('pastes from clipboard with offset', () => {
    const { copySelected, pasteClipboard } = useCanvasStore.getState()
    
    useCanvasStore.setState({ 
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() } 
    })
    
    copySelected()
    pasteClipboard()
    
    const { nodes } = useCanvasStore.getState()
    expect(nodes).toHaveLength(5)
  })

  it('cuts selected nodes', () => {
    const { cutSelected } = useCanvasStore.getState()
    
    useCanvasStore.setState({ 
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() } 
    })
    
    cutSelected()
    
    const { nodes, clipboard } = useCanvasStore.getState()
    expect(nodes).toHaveLength(3)
    expect(clipboard?.nodes).toHaveLength(1)
  })

  it('selects all nodes and edges', () => {
    const { selectAll, nodes, edges } = useCanvasStore.getState()

    selectAll()

    const state = useCanvasStore.getState()
    // Verify selection store is updated
    expect(state.selection.nodeIds.size).toBe(4)
    expect(state.selection.edgeIds.size).toBe(4)
    // Verify nodes/edges have selected: true for React Flow
    expect(state.nodes.every(n => n.selected)).toBe(true)
    expect(state.edges.every(e => e.selected)).toBe(true)
  })

  it('select all → unselect some → delete removes only selected items', () => {
    const { selectAll } = useCanvasStore.getState()

    // Step 1: Select all
    selectAll()
    let state = useCanvasStore.getState()
    expect(state.nodes.length).toBe(4)
    expect(state.edges.length).toBe(4)

    // Step 2: Manually unselect node '1' and edge 'e1' (simulating user clicking with modifier key)
    useCanvasStore.setState(s => ({
      nodes: s.nodes.map(n => n.id === '1' ? { ...n, selected: false } : n),
      edges: s.edges.map(e => e.id === 'e1' ? { ...e, selected: false } : e),
      selection: {
        nodeIds: new Set(['2', '3', '4']),
        edgeIds: new Set(['e2', 'e3', 'e4'])
      }
    }))

    // Step 3: Delete selected
    const { deleteSelected } = useCanvasStore.getState()
    deleteSelected()

    // Verify: Only node '1' should remain
    state = useCanvasStore.getState()
    expect(state.nodes.map(n => n.id)).toEqual(['1'])
    // Verify: All edges removed (e1 was unselected but connects to deleted nodes, others were selected)
    expect(state.edges.length).toBe(0)
  })

  it('select all → delete removes everything', () => {
    const { selectAll, deleteSelected } = useCanvasStore.getState()

    selectAll()
    deleteSelected()

    const state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(0)
    expect(state.edges).toHaveLength(0)
  })

  it('select all → delete → undo restores all nodes and edges', () => {
    const { selectAll, deleteSelected, undo, canUndo } = useCanvasStore.getState()

    // Initial state
    const initialState = useCanvasStore.getState()
    expect(initialState.nodes).toHaveLength(4)
    expect(initialState.edges).toHaveLength(4)

    // Select all and delete
    selectAll()
    deleteSelected()

    let state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(0)
    expect(state.edges).toHaveLength(0)
    expect(canUndo()).toBe(true)

    // Undo should restore everything
    undo()

    state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(4)
    expect(state.edges).toHaveLength(4)
    // Nodes should NOT have selected: true after undo
    expect(state.nodes.some(n => n.selected)).toBe(false)
  })

  it('nudges selected nodes', () => {
    const { nodes, nudgeSelected } = useCanvasStore.getState()
    const originalX = nodes[0].position.x
    
    useCanvasStore.setState({ 
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() } 
    })
    
    nudgeSelected(10, 0)
    
    const { nodes: newNodes } = useCanvasStore.getState()
    expect(newNodes[0].position.x).toBe(originalX + 10)
  })

  it('saves snapshot to localStorage', () => {
    const { saveSnapshot } = useCanvasStore.getState()
    
    const mockSetItem = vi.fn()
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = mockSetItem
    
    saveSnapshot()
    
    // Snapshot key includes timestamp: 'canvas-snapshot-{timestamp}'
    expect(mockSetItem).toHaveBeenCalledWith(
      expect.stringMatching(/^canvas-snapshot-\d+$/),
      expect.stringContaining('"nodes"')
    )
    
    Storage.prototype.setItem = originalSetItem
  })

  // Selection stability tests (prevent render loops)
  describe('onSelectionChange stability', () => {
    it('keeps same selection reference when IDs unchanged', () => {
      const { nodes, onSelectionChange } = useCanvasStore.getState()
      
      // Set initial selection
      onSelectionChange({ nodes: [nodes[0], nodes[1]], edges: [] })
      const selection1 = useCanvasStore.getState().selection
      
      // Call again with same IDs
      onSelectionChange({ nodes: [nodes[0], nodes[1]], edges: [] })
      const selection2 = useCanvasStore.getState().selection
      
      // Should be the exact same reference (no update occurred)
      expect(selection2).toBe(selection1)
    })

    it('creates new selection reference when node IDs change', () => {
      const { nodes, onSelectionChange } = useCanvasStore.getState()
      
      // Set initial selection
      onSelectionChange({ nodes: [nodes[0]], edges: [] })
      const selection1 = useCanvasStore.getState().selection
      
      // Change selection
      onSelectionChange({ nodes: [nodes[1]], edges: [] })
      const selection2 = useCanvasStore.getState().selection
      
      // Should be different reference (update occurred)
      expect(selection2).not.toBe(selection1)
      
      // Verify correct IDs
      expect(selection2.nodeIds.has(nodes[1].id)).toBe(true)
      expect(selection2.nodeIds.has(nodes[0].id)).toBe(false)
    })

    it('creates new selection reference when edge IDs change', () => {
      const { edges, onSelectionChange } = useCanvasStore.getState()
      
      // Set initial selection with edge
      onSelectionChange({ nodes: [], edges: [edges[0]] })
      const selection1 = useCanvasStore.getState().selection
      
      // Change edge selection
      onSelectionChange({ nodes: [], edges: [edges[1]] })
      const selection2 = useCanvasStore.getState().selection
      
      // Should be different reference
      expect(selection2).not.toBe(selection1)
      
      // Verify correct IDs
      expect(selection2.edgeIds.has(edges[1].id)).toBe(true)
      expect(selection2.edgeIds.has(edges[0].id)).toBe(false)
    })

    it('keeps same reference when clearing empty selection', () => {
      const { onSelectionChange } = useCanvasStore.getState()
      
      // Set empty selection
      onSelectionChange({ nodes: [], edges: [] })
      const selection1 = useCanvasStore.getState().selection
      
      // Call again with empty selection
      onSelectionChange({ nodes: [], edges: [] })
      const selection2 = useCanvasStore.getState().selection
      
      // Should be the same reference (both empty)
      expect(selection2).toBe(selection1)
    })

    it('handles rapid identical selection changes without updates', () => {
      const { nodes, onSelectionChange } = useCanvasStore.getState()
      
      // Set initial selection
      onSelectionChange({ nodes: [nodes[0]], edges: [] })
      const selection1 = useCanvasStore.getState().selection
      
      // Simulate rapid identical calls (like ReactFlow might do)
      for (let i = 0; i < 10; i++) {
        onSelectionChange({ nodes: [nodes[0]], edges: [] })
      }
      
      const selection2 = useCanvasStore.getState().selection
      
      // Should still be the same reference (no churn)
      expect(selection2).toBe(selection1)
    })
  })

  describe('Type Validation', () => {
    it('rejects invalid node type in updateNode', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { nodes, updateNode } = useCanvasStore.getState()
      const initialNode = nodes[0]
      const initialNodeCount = nodes.length
      
      // Attempt to update with invalid type
      updateNode(initialNode.id, { type: 'invalid-type' as any })
      
      const updatedNodes = useCanvasStore.getState().nodes
      const updatedNode = updatedNodes.find(n => n.id === initialNode.id)
      
      // State should be unchanged
      expect(updatedNodes).toHaveLength(initialNodeCount)
      expect(updatedNode?.type).toBe(initialNode.type)
      
      // Should log warning once
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Canvas] Invalid node type: invalid-type')
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      
      consoleWarnSpy.mockRestore()
    })

    it('allows valid node type updates', () => {
      const { nodes, updateNode } = useCanvasStore.getState()
      const initialNode = nodes[0]

      // Update with valid type
      updateNode(initialNode.id, { type: 'goal' })

      const updatedNode = useCanvasStore.getState().nodes.find(n => n.id === initialNode.id)
      expect(updatedNode?.type).toBe('goal')
    })
  })

  describe('Templates Panel', () => {
    it('opens panel and stores invoker reference', () => {
      const mockButton = document.createElement('button')
      const { openTemplatesPanel } = useCanvasStore.getState()

      openTemplatesPanel(mockButton)

      const state = useCanvasStore.getState()
      expect(state.showTemplatesPanel).toBe(true)
      expect(state.templatesPanelInvoker).toBe(mockButton)
    })

    it('opens panel without invoker', () => {
      const { openTemplatesPanel } = useCanvasStore.getState()

      openTemplatesPanel()

      const state = useCanvasStore.getState()
      expect(state.showTemplatesPanel).toBe(true)
      expect(state.templatesPanelInvoker).toBeNull()
    })

    it('closes panel and clears invoker', () => {
      const mockButton = document.createElement('button')
      const { openTemplatesPanel, closeTemplatesPanel } = useCanvasStore.getState()

      // Open panel
      openTemplatesPanel(mockButton)
      expect(useCanvasStore.getState().showTemplatesPanel).toBe(true)

      // Close panel
      closeTemplatesPanel()

      const state = useCanvasStore.getState()
      expect(state.showTemplatesPanel).toBe(false)
      expect(state.templatesPanelInvoker).toBeNull()
    })

    it('restores focus to invoker on close', async () => {
      const mockButton = document.createElement('button')
      mockButton.focus = vi.fn()
      document.body.appendChild(mockButton)

      const { openTemplatesPanel, closeTemplatesPanel } = useCanvasStore.getState()

      // Open panel with invoker
      openTemplatesPanel(mockButton)

      // Close panel
      closeTemplatesPanel()

      // Focus restoration happens after 100ms timeout
      await vi.advanceTimersByTimeAsync(100)

      expect(mockButton.focus).toHaveBeenCalledTimes(1)

      // Cleanup
      document.body.removeChild(mockButton)
    })

    it('handles missing invoker on close gracefully', () => {
      const { openTemplatesPanel, closeTemplatesPanel } = useCanvasStore.getState()

      // Open without invoker
      openTemplatesPanel()

      // Should not throw when closing without invoker
      expect(() => closeTemplatesPanel()).not.toThrow()

      const state = useCanvasStore.getState()
      expect(state.showTemplatesPanel).toBe(false)
    })

    it('handles invoker without focus method gracefully', async () => {
      const mockElement = document.createElement('div')
      document.body.appendChild(mockElement)

      const { openTemplatesPanel, closeTemplatesPanel } = useCanvasStore.getState()

      // Open with element that doesn't have focus method
      openTemplatesPanel(mockElement as any)

      // Should not throw even if element lacks focus method
      expect(() => closeTemplatesPanel()).not.toThrow()

      await vi.advanceTimersByTimeAsync(100)

      // Cleanup
      document.body.removeChild(mockElement)
    })

    it('handles removed invoker on close gracefully', async () => {
      const mockButton = document.createElement('button')
      mockButton.focus = vi.fn()
      document.body.appendChild(mockButton)

      const { openTemplatesPanel, closeTemplatesPanel } = useCanvasStore.getState()

      // Open panel
      openTemplatesPanel(mockButton)

      // Remove button from DOM before closing
      document.body.removeChild(mockButton)

      // Should not throw even if button was removed
      expect(() => closeTemplatesPanel()).not.toThrow()

      await vi.advanceTimersByTimeAsync(100)

      // focus() should have been called but may fail silently
      // We just verify no error was thrown
    })
  })
})
