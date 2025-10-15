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
    const { nodes, selection, duplicateSelected } = useCanvasStore.getState()
    
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

  it('selects all nodes', () => {
    const { selectAll } = useCanvasStore.getState()
    
    selectAll()
    
    const { selection } = useCanvasStore.getState()
    expect(selection.nodeIds.size).toBe(4)
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
    
    expect(mockSetItem).toHaveBeenCalledWith(
      'canvas-snapshot',
      expect.stringContaining('"nodes"')
    )
    
    Storage.prototype.setItem = originalSetItem
  })
})
