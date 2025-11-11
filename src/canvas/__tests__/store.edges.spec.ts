import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

describe('Edge Operations', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()

    // Add test fixture data: 4 nodes and 1 edge connecting 1→2
    const store = useCanvasStore.getState()

    // Create 4 nodes (IDs will be '1', '2', '3', '4')
    store.addNode({ x: 0, y: 0 })
    store.addNode({ x: 100, y: 0 })
    store.addNode({ x: 0, y: 100 })
    store.addNode({ x: 100, y: 100 })

    // Create edge connecting node 1 → node 2
    store.addEdge({
      source: '1',
      target: '2',
      type: 'step',
      data: { confidence: 0.5 }
    })
  })

  it('fixture setup creates nodes and edges', () => {
    const { nodes, edges } = useCanvasStore.getState()
    expect(nodes.length).toBe(4)
    expect(edges.length).toBe(1)
    expect(nodes.map(n => n.id)).toEqual(['1', '2', '3', '4'])
    expect(edges[0].source).toBe('1')
    expect(edges[0].target).toBe('2')
  })

  it('deleteEdge removes edge', () => {
    const { edges, deleteEdge } = useCanvasStore.getState()
    expect(edges.length).toBe(1) // Verify fixture setup
    const id = edges[0].id
    deleteEdge(id)
    expect(useCanvasStore.getState().edges.find(e => e.id === id)).toBeUndefined()
  })

  it('updateEdgeEndpoints changes endpoints', () => {
    const { edges, updateEdgeEndpoints } = useCanvasStore.getState()
    const edge = edges[0] // e1: 1→2
    expect(edge.source).toBe('1')
    expect(edge.target).toBe('2')

    // Change target to node 4: 1→4
    updateEdgeEndpoints(edge.id, { target: '4' })
    const updated = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    expect(updated?.target).toBe('4')
    expect(updated?.source).toBe('1') // Source unchanged
  })

  it('blocks self-loops', () => {
    const { edges, updateEdgeEndpoints } = useCanvasStore.getState()
    const edge = edges[0]
    const before = useCanvasStore.getState().edges.find(e => e.id === edge.id)

    // Try to create self-loop: 1→1 (should be blocked)
    updateEdgeEndpoints(edge.id, { target: edge.source })
    const after = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    expect(after).toEqual(before) // Edge should remain unchanged
  })

  it('reconnect flow works', () => {
    const { edges, beginReconnect, completeReconnect } = useCanvasStore.getState()
    const edge = edges[0]

    // Begin reconnecting the target end
    beginReconnect(edge.id, 'target')
    expect(useCanvasStore.getState().reconnecting).toEqual({ edgeId: edge.id, end: 'target' })

    // Complete reconnection to node 4
    completeReconnect('4')
    expect(useCanvasStore.getState().reconnecting).toBeNull()

    // Verify edge was updated
    const updated = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    expect(updated?.target).toBe('4')
  })
})
