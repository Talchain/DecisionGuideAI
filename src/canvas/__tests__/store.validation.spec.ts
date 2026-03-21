/**
 * Canvas Store - Validation Selectors Tests
 * Tests getInvalidNodes, hasValidationErrors, and getNextInvalidNode
 *
 * Validation rules (from validateOutgoing.ts):
 * - ONLY validates decision→option edges (probability distribution semantics)
 * - A decision node is invalid if it has ≥2 outgoing edges to options with non-zero confidence
 *   and the sum of those non-zero confidences ≠ 100% ± tolerance
 * - Pristine nodes (all zeros, never edited) are NOT invalid
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore, getInvalidNodes, hasValidationErrors, getNextInvalidNode } from '../store'

/**
 * Helper: add a node with a specific kind (decision/option/factor/etc.)
 * Uses addNode (which defaults to type='decision') then updateNode to set data.kind
 */
function addTypedNode(kind: string, pos = { x: 0, y: 0 }): string {
  const store = useCanvasStore.getState()
  store.addNode(pos, kind as any)
  // addNode sets data: { label: `Node ${id}` } but NOT data.kind
  // We need to patch data.kind for the validation to recognise it
  const nodes = useCanvasStore.getState().nodes
  const lastNode = nodes[nodes.length - 1]
  store.updateNode(lastNode.id, { data: { kind } })
  return lastNode.id
}

/**
 * Helper: add an edge from source→target with a given confidence probability
 */
function addEdgeWithConfidence(source: string, target: string, confidence: number) {
  const store = useCanvasStore.getState()
  store.addEdge({
    source,
    target,
    data: {
      weight: 0.5,
      style: 'solid' as const,
      curvature: 0.15,
      pathType: 'bezier' as const,
      kind: 'decision-probability' as const,
      functionType: 'linear' as const,
      beliefExists: 0.7,
      beliefStrength: 0.5,
      schemaVersion: 4 as const,
      confidence,
      label: `${Math.round(confidence * 100)}%`,
    },
  })
}

describe('Canvas Store - Validation Selectors', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    // resetCanvas is a no-op if canvas is already empty, so force clean state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1,
    })
  })

  describe('getInvalidNodes', () => {
    it('returns empty array when all nodes valid', () => {
      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('returns empty array when decision has 0-1 outgoing edges to options', () => {
      // Single decision → single option edge: no validation needed
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const optId = addTypedNode('option', { x: 100, y: 100 })
      addEdgeWithConfidence(decId, optId, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('returns empty array for non-decision source nodes', () => {
      // Factor→option edges are NOT subject to probability validation
      const factorId = addTypedNode('factor', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      addEdgeWithConfidence(factorId, opt1, 0.4)
      addEdgeWithConfidence(factorId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('returns empty array for decision→non-option edges', () => {
      // Decision→factor edges don't have probability distribution semantics
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const f1 = addTypedNode('factor', { x: 100, y: 0 })
      const f2 = addTypedNode('factor', { x: 100, y: 100 })

      addEdgeWithConfidence(decId, f1, 0.4)
      addEdgeWithConfidence(decId, f2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('detects decision with 2+ option edges summing to less than 100%', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      // 40% + 50% = 90% (invalid)
      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].nodeId).toBe(decId)
      expect(invalidNodes[0].sum).toBeCloseTo(0.9, 2)
      expect(invalidNodes[0].edgeCount).toBe(2)
    })

    it('detects decision with 2+ option edges summing to more than 100%', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      // 60% + 50% = 110% (invalid)
      addEdgeWithConfidence(decId, opt1, 0.6)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].nodeId).toBe(decId)
      expect(invalidNodes[0].sum).toBeCloseTo(1.1, 2)
    })

    it('accepts decision with option probabilities within ±1% tolerance', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      // 49.5% + 50.5% = 100% (valid, within tolerance)
      addEdgeWithConfidence(decId, opt1, 0.495)
      addEdgeWithConfidence(decId, opt2, 0.505)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })

    it('detects multiple invalid decision nodes', () => {
      // Decision 1 with 2 options (invalid)
      const dec1 = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 200, y: 0 })

      // Decision 2 with 2 options (invalid)
      const dec2 = addTypedNode('decision', { x: 0, y: 100 })
      const opt3 = addTypedNode('option', { x: 100, y: 100 })
      const opt4 = addTypedNode('option', { x: 200, y: 100 })

      // dec1 -> opt1, opt2 (40% + 50% = 90%, invalid)
      addEdgeWithConfidence(dec1, opt1, 0.4)
      addEdgeWithConfidence(dec1, opt2, 0.5)

      // dec2 -> opt3, opt4 (40% + 50% = 90%, invalid)
      addEdgeWithConfidence(dec2, opt3, 0.4)
      addEdgeWithConfidence(dec2, opt4, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(2)
      expect(invalidNodes.map(n => n.nodeId)).toContain(dec1)
      expect(invalidNodes.map(n => n.nodeId)).toContain(dec2)
    })

    it('includes node label in invalid node result', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      useCanvasStore.getState().updateNodeLabel(decId, 'My Decision')

      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes[0].nodeLabel).toBe('My Decision')
    })

    it('validates decision nodes with 3+ outgoing option edges', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })
      const opt3 = addTypedNode('option', { x: 100, y: 200 })

      // 30% + 30% + 30% = 90% (invalid)
      addEdgeWithConfidence(decId, opt1, 0.3)
      addEdgeWithConfidence(decId, opt2, 0.3)
      addEdgeWithConfidence(decId, opt3, 0.3)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toHaveLength(1)
      expect(invalidNodes[0].edgeCount).toBe(3)
      expect(invalidNodes[0].sum).toBeCloseTo(0.9, 2)
    })

    it('returns nonZeroEdgeCount in result', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes[0].nonZeroEdgeCount).toBe(2)
    })

    it('does not flag pristine decision nodes with zero-confidence edges', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      // Zero-confidence edges on a pristine (untouched) node
      addEdgeWithConfidence(decId, opt1, 0)
      addEdgeWithConfidence(decId, opt2, 0)

      const state = useCanvasStore.getState()
      const invalidNodes = getInvalidNodes(state)

      expect(invalidNodes).toEqual([])
    })
  })

  describe('hasValidationErrors', () => {
    it('returns false when no validation errors', () => {
      const state = useCanvasStore.getState()

      expect(hasValidationErrors(state)).toBe(false)
    })

    it('returns true when validation errors exist', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

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
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()
      const next = getNextInvalidNode(state)

      expect(next).not.toBeNull()
      expect(next?.nodeId).toBe(decId)
    })

    it('returns next invalid node after currentNodeId', () => {
      // Two invalid decision nodes
      const dec1 = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 200, y: 0 })

      const dec2 = addTypedNode('decision', { x: 0, y: 100 })
      const opt3 = addTypedNode('option', { x: 100, y: 100 })
      const opt4 = addTypedNode('option', { x: 200, y: 100 })

      // dec1 -> opt1, opt2 (invalid: 40% + 50%)
      addEdgeWithConfidence(dec1, opt1, 0.4)
      addEdgeWithConfidence(dec1, opt2, 0.5)

      // dec2 -> opt3, opt4 (invalid: 40% + 50%)
      addEdgeWithConfidence(dec2, opt3, 0.4)
      addEdgeWithConfidence(dec2, opt4, 0.5)

      const state = useCanvasStore.getState()

      // Get next after dec1 (should be dec2)
      const next = getNextInvalidNode(state, dec1)

      expect(next?.nodeId).toBe(dec2)
    })

    it('wraps around to first invalid node when at end of list', () => {
      // Two invalid decision nodes
      const dec1 = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 200, y: 0 })

      const dec2 = addTypedNode('decision', { x: 0, y: 100 })
      const opt3 = addTypedNode('option', { x: 100, y: 100 })
      const opt4 = addTypedNode('option', { x: 200, y: 100 })

      addEdgeWithConfidence(dec1, opt1, 0.4)
      addEdgeWithConfidence(dec1, opt2, 0.5)
      addEdgeWithConfidence(dec2, opt3, 0.4)
      addEdgeWithConfidence(dec2, opt4, 0.5)

      const state = useCanvasStore.getState()

      // Get next after dec2 (last invalid) -> should wrap to dec1 (first)
      const next = getNextInvalidNode(state, dec2)

      expect(next?.nodeId).toBe(dec1)
    })

    it('returns first invalid node when currentNodeId not in invalid list', () => {
      const decId = addTypedNode('decision', { x: 0, y: 0 })
      const opt1 = addTypedNode('option', { x: 100, y: 0 })
      const opt2 = addTypedNode('option', { x: 100, y: 100 })

      addEdgeWithConfidence(decId, opt1, 0.4)
      addEdgeWithConfidence(decId, opt2, 0.5)

      const state = useCanvasStore.getState()

      // Query with an option node ID (not in the invalid list)
      const next = getNextInvalidNode(state, opt1)

      expect(next?.nodeId).toBe(decId)
    })
  })
})
