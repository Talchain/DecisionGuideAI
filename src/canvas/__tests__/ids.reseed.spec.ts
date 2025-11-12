/**
 * ID Reseed Tests (P0 Hotfix)
 *
 * Verifies that reseedIds() correctly sets ID counters above existing IDs
 * to prevent collisions after hydration from localStorage/autosave/import.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'

describe('ID Reseed', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      nextNodeId: 1,
      nextEdgeId: 1
    })
  })

  describe('reseedIds', () => {
    it('should set counters above existing numeric node IDs', () => {
      const nodes: Node[] = [
        { id: '5', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 5' } },
        { id: '3', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 3' } },
        { id: '10', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 10' } }
      ]
      const edges: Edge[] = []

      useCanvasStore.getState().reseedIds(nodes, edges)

      const { nextNodeId } = useCanvasStore.getState()
      expect(nextNodeId).toBeGreaterThan(10)
      expect(nextNodeId).toBe(11) // max(10) + 1
    })

    it('should set counters above existing numeric edge IDs', () => {
      const nodes: Node[] = []
      const edges: Edge[] = [
        { id: 'e5', source: 'a', target: 'b' },
        { id: 'e12', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'd' }
      ]

      useCanvasStore.getState().reseedIds(nodes, edges)

      const { nextEdgeId } = useCanvasStore.getState()
      expect(nextEdgeId).toBeGreaterThan(12)
      expect(nextEdgeId).toBe(13) // max(12) + 1
    })

    it('should handle mixed numeric and non-numeric IDs', () => {
      const nodes: Node[] = [
        { id: '7', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 7' } },
        { id: 'custom-node', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Custom' } },
        { id: '15', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 15' } }
      ]
      const edges: Edge[] = [
        { id: 'e8', source: 'a', target: 'b' },
        { id: 'custom-edge', source: 'b', target: 'c' }
      ]

      useCanvasStore.getState().reseedIds(nodes, edges)

      const { nextNodeId, nextEdgeId } = useCanvasStore.getState()
      expect(nextNodeId).toBe(16) // max numeric(15) + 1
      expect(nextEdgeId).toBe(9) // max numeric(8) + 1
    })

    it('should use minimum of 5 when no numeric IDs exist', () => {
      const nodes: Node[] = [
        { id: 'custom-a', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }
      ]
      const edges: Edge[] = [
        { id: 'custom-edge', source: 'a', target: 'b' }
      ]

      useCanvasStore.getState().reseedIds(nodes, edges)

      const { nextNodeId, nextEdgeId } = useCanvasStore.getState()
      expect(nextNodeId).toBe(5)
      expect(nextEdgeId).toBe(5)
    })

    it('should prevent collisions when adding nodes after hydration', () => {
      // Simulate hydrated state with existing nodes
      const nodes: Node[] = [
        { id: '8', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Node 8' } }
      ]
      const edges: Edge[] = []

      useCanvasStore.getState().reseedIds(nodes, edges)

      // Add new node - should get ID > 8
      const newNodeId = useCanvasStore.getState().createNodeId()
      expect(parseInt(newNodeId, 10)).toBeGreaterThan(8)
      expect(newNodeId).toBe('9')

      // Add another - should increment
      const newNodeId2 = useCanvasStore.getState().createNodeId()
      expect(newNodeId2).toBe('10')
    })

    it('should prevent collisions when adding edges after hydration', () => {
      // Simulate hydrated state with existing edges
      const nodes: Node[] = []
      const edges: Edge[] = [
        { id: 'e6', source: 'a', target: 'b' }
      ]

      useCanvasStore.getState().reseedIds(nodes, edges)

      // Add new edge - should get ID > e6
      const newEdgeId = useCanvasStore.getState().createEdgeId()
      expect(newEdgeId).toBe('e7')

      // Add another - should increment
      const newEdgeId2 = useCanvasStore.getState().createEdgeId()
      expect(newEdgeId2).toBe('e8')
    })

    it('should handle empty graphs gracefully', () => {
      const nodes: Node[] = []
      const edges: Edge[] = []

      useCanvasStore.getState().reseedIds(nodes, edges)

      const { nextNodeId, nextEdgeId } = useCanvasStore.getState()
      expect(nextNodeId).toBe(5) // Min watermark
      expect(nextEdgeId).toBe(5)
    })

    it('should preserve existing IDs unchanged', () => {
      const nodes: Node[] = [
        { id: 'preserve-me', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Keep' } }
      ]
      const edges: Edge[] = [
        { id: 'keep-edge', source: 'a', target: 'b' }
      ]

      useCanvasStore.getState().reseedIds(nodes, edges)

      // IDs should remain unchanged
      expect(nodes[0].id).toBe('preserve-me')
      expect(edges[0].id).toBe('keep-edge')
    })
  })
})
