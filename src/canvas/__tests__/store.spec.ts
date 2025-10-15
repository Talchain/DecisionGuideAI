import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('Canvas Store', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
  })

  it('initializes with 4 demo nodes', () => {
    const { nodes } = useCanvasStore.getState()
    expect(nodes).toHaveLength(4)
  })

  it('adds node with stable ID', () => {
    const { addNode, nodes } = useCanvasStore.getState()
    addNode()
    const newNodes = useCanvasStore.getState().nodes
    expect(newNodes).toHaveLength(5)
    expect(newNodes[4].id).toBe('5')
  })

  it('generates monotonic IDs', () => {
    const { createNodeId } = useCanvasStore.getState()
    const id1 = createNodeId()
    const id2 = createNodeId()
    expect(parseInt(id2)).toBeGreaterThan(parseInt(id1))
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
    const { addNode, undo, history } = useCanvasStore.getState()
    addNode()
    addNode()
    undo()
    expect(useCanvasStore.getState().history.future).toHaveLength(1)
    addNode()
    expect(useCanvasStore.getState().history.future).toHaveLength(0)
  })

  it('tracks selection', () => {
    const { onSelectionChange, selection, nodes } = useCanvasStore.getState()
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
    const { updateNodeLabel, nodes } = useCanvasStore.getState()
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
})
