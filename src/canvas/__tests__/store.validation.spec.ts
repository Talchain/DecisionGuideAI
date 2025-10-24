/**
 * Canvas Store - Validation Selectors Tests
 * Tests getInvalidNodes, hasValidationErrors, and getNextInvalidNode
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore, getInvalidNodes, hasValidationErrors, getNextInvalidNode } from '../store'
import { DEFAULT_EDGE_DATA } from '../domain/edges'

// Helper to create edge with confidence
function createEdgeWithConfidence(source: string, target: string, confidence: number) {
  return {
    source,
    target,
    data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` }
  }
}

describe('Canvas Store - Validation Selectors', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  describe('getInvalidNodes', () => {
    it('returns empty array when all nodes valid', () => {
      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('returns empty array when nodes have 0-1 outgoing edges', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      // Add nodes with single outgoing edge (no validation needed)
      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 100 })
      addEdge(createEdgeWithConfidence('1', '2', 0.5))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('detects node with 2+ edges summing to less than 100%', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      // Add decision node with 2 outgoing edges
      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      // Add edges with probabilities summing to 90% (invalid)
      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].nodeId).toBe('1')
      expect(invalidNodes[0].sum).toBeCloseTo(0.9, 2)
      expect(invalidNodes[0].edgeCount).toBe(2)
    })

    it('detects node with 2+ edges summing to more than 100%', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      // Set probabilities to 60% + 50% = 110% (invalid)
      addEdge(createEdgeWithConfidence('1', '2', 0.6))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].nodeId).toBe('1')
      expect(invalidNodes[0].sum).toBeCloseTo(1.1, 2)
    })

    it('accepts nodes with probabilities within ±1% tolerance', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      // Set probabilities to 49.5% + 50.5% = 100% (valid, within tolerance)
      addEdge(createEdgeWithConfidence('1', '2', 0.495))
      addEdge(createEdgeWithConfidence('1', '3', 0.505))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('detects multiple invalid nodes', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      // Add two decision nodes, each with 2 outgoing edges
      addNode({ x: 0, y: 0 })    // Node 1
      addNode({ x: 100, y: 0 })  // Node 2
      addNode({ x: 200, y: 0 })  // Node 3
      addNode({ x: 0, y: 100 })  // Node 4
      addNode({ x: 100, y: 100 }) // Node 5

      // Node 1 -> 2, 3 (invalid: 40% + 50% = 90%)
      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      // Node 4 -> 2, 5 (invalid: 40% + 50% = 90%)
      addEdge(createEdgeWithConfidence('4', '2', 0.4))
      addEdge(createEdgeWithConfidence('4', '5', 0.5))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(2)
      expect(invalidNodes.map(n => n.nodeId)).toContain('1')
      expect(invalidNodes.map(n => n.nodeId)).toContain('4')
    })

    it('includes node label in invalid node result', () => {
      const { resetCanvas, addNode, updateNodeLabel, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      updateNodeLabel('1', 'My Decision')

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes[0].nodeLabel).toBe('My Decision')
    })

    it('validates nodes with 3+ outgoing edges', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })
      addNode({ x: 100, y: 200 })

      // Set to 30% + 30% + 30% = 90% (invalid)
      addEdge(createEdgeWithConfidence('1', '2', 0.3))
      addEdge(createEdgeWithConfidence('1', '3', 0.3))
      addEdge(createEdgeWithConfidence('1', '4', 0.3))

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].edgeCount).toBe(3)
      expect(invalidNodes[0].sum).toBeCloseTo(0.9, 2)
    })
  })

  describe('hasValidationErrors', () => {
    it('returns false when no validation errors', () => {
      const state = useCanvasStore.getState()

      expect(hasValidationErrors(state)).toBe(false)
    })

    it('returns true when validation errors exist', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()

      expect(hasValidationErrors(state)).toBe(true)
    })
  })

  describe('getNextInvalidNode', () => {
    it('returns null when no invalid nodes', () => {
      const state = useCanvasStore.getState()

      expect(getNextInvalidNode(state)).toBeNull()
    })

    it('returns first invalid node when currentNodeId not provided', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()
      const next = getNextInvalidNode(state)

      expect(next).not.toBeNull()
      expect(next?.nodeId).toBe('1')
    })

    it('returns next invalid node after currentNodeId', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      // Add two invalid nodes
      addNode({ x: 0, y: 0 })    // Node 1
      addNode({ x: 100, y: 0 })  // Node 2
      addNode({ x: 200, y: 0 })  // Node 3
      addNode({ x: 0, y: 100 })  // Node 4
      addNode({ x: 100, y: 100 }) // Node 5

      // Node 1 -> 2, 3 (invalid)
      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      // Node 4 -> 2, 5 (invalid)
      addEdge(createEdgeWithConfidence('4', '2', 0.4))
      addEdge(createEdgeWithConfidence('4', '5', 0.5))

      const state = useCanvasStore.getState()

      // Get next after node 1 (should be node 4)
      const next = getNextInvalidNode(state, '1')

      expect(next?.nodeId).toBe('4')
    })

    it('wraps around to first invalid node when at end of list', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      // Add two invalid nodes
      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 200, y: 0 })
      addNode({ x: 0, y: 100 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))
      addEdge(createEdgeWithConfidence('4', '2', 0.4))
      addEdge(createEdgeWithConfidence('4', '5', 0.5))

      const state = useCanvasStore.getState()

      // Get next after node 4 (last invalid) -> should wrap to node 1 (first)
      const next = getNextInvalidNode(state, '4')

      expect(next?.nodeId).toBe('1')
    })

    it('returns first invalid node when currentNodeId not in invalid list', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()

      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      const state = useCanvasStore.getState()

      // Query with a valid node ID (node 2) that's not in the invalid list
      const next = getNextInvalidNode(state, '2')

      expect(next?.nodeId).toBe('1')
    })
  })
})
