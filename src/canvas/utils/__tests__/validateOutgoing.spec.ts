/**
 * Tests for shared validation utility
 * Validates outgoing probability sums with zero-filtering and touched tracking
 *
 * Key rule: only decision→option edges are validated (probability distribution semantics).
 * Other edge types (factor→option, risk→outcome) are NOT validated here.
 */

import { describe, it, expect } from 'vitest'
import { isNodeProbabilitiesValid, getInvalidNodes, getNextInvalidNode } from '../validateOutgoing'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../domain/nodes'
import type { EdgeData } from '../../domain/edges'

// ---------- helpers ----------

function createDecisionNode(id: string, label: string): Node<NodeData> {
  return {
    id,
    type: 'decision',
    position: { x: 0, y: 0 },
    data: { label, kind: 'decision' } as NodeData,
  }
}

function createOptionNode(id: string, label: string): Node<NodeData> {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, kind: 'option' } as NodeData,
  }
}

function createFactorNode(id: string, label: string): Node<NodeData> {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label, kind: 'factor' } as NodeData,
  }
}

function createEdge(source: string, target: string, confidence: number): Edge<EdgeData> {
  return {
    id: `${source}-${target}`,
    source,
    target,
    data: { confidence } as EdgeData,
  }
}

// ---------- tests ----------

describe('validateOutgoing', () => {
  describe('isNodeProbabilitiesValid', () => {
    it('returns true for decision node with 0-1 outgoing edges to options', () => {
      const nodes = [createDecisionNode('d1', 'Decision 1'), createOptionNode('o1', 'Option 1')]
      const edges = [createEdge('d1', 'o1', 1.0)]
      const touched = new Set<string>()

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for non-decision node regardless of edges', () => {
      // Factor nodes should always pass — only decision nodes are validated
      const nodes = [
        createFactorNode('f1', 'Factor 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('f1', 'o1', 0.6),
        createEdge('f1', 'o2', 0.3), // sum !== 1.0 but irrelevant — source is not a decision
      ]
      const touched = new Set(['f1'])

      expect(isNodeProbabilitiesValid('f1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for pristine decision node with all zero edges (untouched)', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0),
        createEdge('d1', 'o2', 0),
      ]
      const touched = new Set<string>()

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for decision node with valid probabilities (60/40)', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.4),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('returns false for decision node with invalid probabilities (60/30)', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(false)
    })

    it('respects default ±1% tolerance', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      // Sum = 1.005, within 1% tolerance
      const edges = [
        createEdge('d1', 'o1', 0.505),
        createEdge('d1', 'o2', 0.5),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('rejects sums outside the tolerance', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      // Sum = 1.02, exceeds default 1% tolerance
      const edges = [
        createEdge('d1', 'o1', 0.52),
        createEdge('d1', 'o2', 0.5),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(false)
    })

    it('accepts a custom tolerance via options', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      // Sum = 0.85, within 20% custom tolerance
      const edges = [
        createEdge('d1', 'o1', 0.5),
        createEdge('d1', 'o2', 0.35),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched, { tolerance: 0.2 })).toBe(true)
      // But fails with default tolerance
      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(false)
    })

    it('filters out zero-confidence edges when validating', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
        createOptionNode('o3', 'Option 3'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.4),
        createEdge('d1', 'o3', 0), // Zero edge ignored — non-zero sum = 1.0
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('ignores edges to non-option nodes', () => {
      // Even though a decision has 2+ outgoing edges, edges to factors don't count
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createFactorNode('f1', 'Factor 1'),
        createFactorNode('f2', 'Factor 2'),
      ]
      const edges = [
        createEdge('d1', 'f1', 0.6),
        createEdge('d1', 'f2', 0.3), // sum !== 1.0 but targets are factors, not options
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('returns true when only 1 non-zero edge exists (user still editing)', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('validates nodes with 3+ outgoing option edges', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option A'),
        createOptionNode('o2', 'Option B'),
        createOptionNode('o3', 'Option C'),
        createOptionNode('o4', 'Option D'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.25),
        createEdge('d1', 'o2', 0.25),
        createEdge('d1', 'o3', 0.25),
        createEdge('d1', 'o4', 0.25),
      ]
      const touched = new Set(['d1'])

      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('skips validation when requireTouched is true and node is untouched with all-zero edges', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0),
        createEdge('d1', 'o2', 0),
      ]
      const touched = new Set<string>() // d1 is NOT touched

      // Default requireTouched=true — untouched + all-zero = valid (pristine)
      expect(isNodeProbabilitiesValid('d1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for unknown node id', () => {
      const nodes = [createDecisionNode('d1', 'Decision 1')]
      const edges: Edge<EdgeData>[] = []
      const touched = new Set<string>()

      // Node not found → not a decision → returns true
      expect(isNodeProbabilitiesValid('nonexistent', nodes, edges, touched)).toBe(true)
    })
  })

  describe('getInvalidNodes', () => {
    it('returns empty array for pristine decision nodes with 0/0 edges', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0),
        createEdge('d1', 'o2', 0),
      ]
      const touched = new Set<string>()

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toEqual([])
    })

    it('detects touched decision node with invalid probabilities', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
      ]
      const touched = new Set(['d1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(1)
      expect(result[0].nodeId).toBe('d1')
      expect(result[0].nodeLabel).toBe('Decision 1')
      expect(result[0].sum).toBeCloseTo(0.9, 5)
      expect(result[0].expected).toBe(1.0)
      expect(result[0].nonZeroEdgeCount).toBe(2)
      expect(result[0].edgeCount).toBe(2) // total outgoing decision→option edges
    })

    it('does not report valid decision nodes', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.5),
        createEdge('d1', 'o2', 0.5),
      ]
      const touched = new Set(['d1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toEqual([])
    })

    it('handles mixed zero and non-zero edges', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
        createOptionNode('o3', 'Option 3'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
        createEdge('d1', 'o3', 0), // Zero edge ignored
      ]
      const touched = new Set(['d1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(1)
      expect(result[0].nonZeroEdgeCount).toBe(2)
      expect(result[0].edgeCount).toBe(3) // all decision→option edges, including zero
    })

    it('detects multiple invalid decision nodes', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createDecisionNode('d2', 'Decision 2'),
        createOptionNode('o1', 'Option A'),
        createOptionNode('o2', 'Option B'),
        createOptionNode('o3', 'Option C'),
        createOptionNode('o4', 'Option D'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3), // d1 invalid: sum 0.9
        createEdge('d2', 'o3', 0.7),
        createEdge('d2', 'o4', 0.2), // d2 invalid: sum 0.9
      ]
      const touched = new Set(['d1', 'd2'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(2)
      expect(result.map(n => n.nodeId)).toContain('d1')
      expect(result.map(n => n.nodeId)).toContain('d2')
    })

    it('ignores non-decision nodes entirely', () => {
      const nodes = [
        createFactorNode('f1', 'Factor 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('f1', 'o1', 0.6),
        createEdge('f1', 'o2', 0.3),
      ]
      const touched = new Set(['f1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toEqual([])
    })

    it('skips decision nodes with fewer than 2 outgoing option edges', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
      ]
      const edges = [createEdge('d1', 'o1', 0.5)]
      const touched = new Set(['d1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toEqual([])
    })
  })

  describe('getNextInvalidNode', () => {
    it('returns null when no invalid nodes', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.4),
      ]
      const touched = new Set(['d1'])

      const result = getNextInvalidNode(nodes, edges, touched)
      expect(result).toBeNull()
    })

    it('returns first invalid node when no currentNodeId is given', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
      ]
      const touched = new Set(['d1'])

      const result = getNextInvalidNode(nodes, edges, touched)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('d1')
    })

    it('returns first invalid node when currentNodeId is not in the invalid list', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createDecisionNode('d2', 'Decision 2'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
      ]
      const touched = new Set(['d1'])

      // d2 is valid (no outgoing option edges) → not in invalid list
      const result = getNextInvalidNode(nodes, edges, touched, 'd2')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('d1')
    })

    it('cycles to next invalid node', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createDecisionNode('d2', 'Decision 2'),
        createOptionNode('o1', 'Option A'),
        createOptionNode('o2', 'Option B'),
        createOptionNode('o3', 'Option C'),
        createOptionNode('o4', 'Option D'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
        createEdge('d2', 'o3', 0.7),
        createEdge('d2', 'o4', 0.2),
      ]
      const touched = new Set(['d1', 'd2'])

      const result = getNextInvalidNode(nodes, edges, touched, 'd1')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('d2')
    })

    it('wraps around to first invalid node when at end of list', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createDecisionNode('d2', 'Decision 2'),
        createOptionNode('o1', 'Option A'),
        createOptionNode('o2', 'Option B'),
        createOptionNode('o3', 'Option C'),
        createOptionNode('o4', 'Option D'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
        createEdge('d2', 'o3', 0.7),
        createEdge('d2', 'o4', 0.2),
      ]
      const touched = new Set(['d1', 'd2'])

      const result = getNextInvalidNode(nodes, edges, touched, 'd2')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('d1') // Wraps around
    })

    it('returns itself when only one invalid node exists', () => {
      const nodes = [
        createDecisionNode('d1', 'Decision 1'),
        createOptionNode('o1', 'Option 1'),
        createOptionNode('o2', 'Option 2'),
      ]
      const edges = [
        createEdge('d1', 'o1', 0.6),
        createEdge('d1', 'o2', 0.3),
      ]
      const touched = new Set(['d1'])

      // Only d1 is invalid, cycling from d1 wraps to d1
      const result = getNextInvalidNode(nodes, edges, touched, 'd1')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('d1')
    })
  })
})
