import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('Edge Operations', () => {
  beforeEach(() => { useCanvasStore.getState().reset() })

  it('deleteEdge removes edge', () => {
    const { edges, deleteEdge } = useCanvasStore.getState()
    const id = edges[0].id
    deleteEdge(id)
    expect(useCanvasStore.getState().edges.find(e => e.id === id)).toBeUndefined()
  })

  it('updateEdgeEndpoints changes endpoints', () => {
    const { edges, updateEdgeEndpoints } = useCanvasStore.getState()
    const edge = edges[0] // e1: 1→2
    updateEdgeEndpoints(edge.id, { target: '4' }) // Change to 1→4
    const updated = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    expect(updated?.target).toBe('4')
    expect(updated?.source).toBe(edge.source) // Source unchanged
  })

  it('blocks self-loops', () => {
    const { edges, updateEdgeEndpoints } = useCanvasStore.getState()
    const edge = edges[0]
    const before = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    updateEdgeEndpoints(edge.id, { target: edge.source })
    const after = useCanvasStore.getState().edges.find(e => e.id === edge.id)
    expect(after).toEqual(before)
  })

  it('reconnect flow works', () => {
    const { edges, beginReconnect, completeReconnect } = useCanvasStore.getState()
    const edge = edges[0]
    beginReconnect(edge.id, 'target')
    expect(useCanvasStore.getState().reconnecting).toEqual({ edgeId: edge.id, end: 'target' })
    completeReconnect('4')
    expect(useCanvasStore.getState().reconnecting).toBeNull()
  })
})
