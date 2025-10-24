/**
 * Tests for shared validation utility
 * Validates outgoing probability sums with zero-filtering and touched tracking
 */

import { describe, it, expect } from 'vitest'
import { isNodeProbabilitiesValid, getInvalidNodes, getNextInvalidNode } from '../validateOutgoing'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../domain/nodes'
import type { EdgeData } from '../../domain/edges'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

function createNode(id: string, label: string): Node<NodeData> {
  return {
    id,
    type: 'decision',
    position: { x: 0, y: 0 },
    data: { label, kind: 'decision' }
  }
}

function createEdge(source: string, target: string, confidence: number): Edge<EdgeData> {
  return {
    id: `${source}-${target}`,
    source,
    target,
    data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` }
  }
}

describe('validateOutgoing', () => {
  describe('isNodeProbabilitiesValid', () => {
    it('returns true for node with 0-1 outgoing edges', () => {
      const nodes = [createNode('1', 'Node 1'), createNode('2', 'Node 2')]
      const edges = [createEdge('1', '2', 1.0)]
      const touched = new Set<string>()

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for pristine node with all zero edges (untouched)', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0),
        createEdge('1', '3', 0)
      ]
      const touched = new Set<string>()

      // Pristine node with 0/0 should be valid
      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })

    it('returns true for node with valid probabilities (60/40)', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.4)
      ]
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })

    it('returns false for node with invalid probabilities (60/30)', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3)
      ]
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(false)
    })

    it('respects ±1% tolerance', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.505),
        createEdge('1', '3', 0.495)  // Sum is 1.0, within tolerance
      ]
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })

    it('filters out zero-confidence edges when validating', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.4),
        createEdge('1', '4', 0)  // Zero edge ignored
      ]
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })

    it('marks template-loaded non-zero probabilities as touched', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3)  // Invalid sum
      ]
      // Template loaded with non-zero → marked touched
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(false)
    })

    it('validates nodes with 3+ outgoing edges', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4'),
        createNode('5', 'Node 5')
      ]
      const edges = [
        createEdge('1', '2', 0.25),
        createEdge('1', '3', 0.25),
        createEdge('1', '4', 0.25),
        createEdge('1', '5', 0.25)
      ]
      const touched = new Set(['1'])

      expect(isNodeProbabilitiesValid('1', nodes, edges, touched)).toBe(true)
    })
  })

  describe('getInvalidNodes', () => {
    it('returns empty array for pristine nodes with 0/0 edges', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0),
        createEdge('1', '3', 0)
      ]
      const touched = new Set<string>()

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toEqual([])
    })

    it('detects touched node with invalid probabilities', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3)
      ]
      const touched = new Set(['1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(1)
      expect(result[0].nodeId).toBe('1')
      expect(result[0].sum).toBeCloseTo(0.9, 5)  // Use toBeCloseTo for floating point
      expect(result[0].nonZeroEdgeCount).toBe(2)
    })

    it('handles mixed zero and non-zero edges', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3),
        createEdge('1', '4', 0)  // Zero edge ignored
      ]
      const touched = new Set(['1'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(1)
      expect(result[0].nonZeroEdgeCount).toBe(2)  // Only counts non-zero
    })

    it('detects multiple invalid nodes', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4'),
        createNode('5', 'Node 5')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3),
        createEdge('4', '2', 0.7),
        createEdge('4', '5', 0.2)
      ]
      const touched = new Set(['1', '4'])

      const result = getInvalidNodes(nodes, edges, touched)
      expect(result).toHaveLength(2)
      expect(result.map(n => n.nodeId)).toContain('1')
      expect(result.map(n => n.nodeId)).toContain('4')
    })
  })

  describe('getNextInvalidNode', () => {
    it('returns null when no invalid nodes', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.4)
      ]
      const touched = new Set(['1'])

      const result = getNextInvalidNode(nodes, edges, touched)
      expect(result).toBeNull()
    })

    it('returns first invalid node when no currentNodeId', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3)
      ]
      const touched = new Set(['1'])

      const result = getNextInvalidNode(nodes, edges, touched)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('1')
    })

    it('cycles to next invalid node', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4'),
        createNode('5', 'Node 5')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3),
        createEdge('4', '2', 0.7),
        createEdge('4', '5', 0.2)
      ]
      const touched = new Set(['1', '4'])

      const result = getNextInvalidNode(nodes, edges, touched, '1')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('4')
    })

    it('wraps around to first when at end', () => {
      const nodes = [
        createNode('1', 'Node 1'),
        createNode('2', 'Node 2'),
        createNode('3', 'Node 3'),
        createNode('4', 'Node 4'),
        createNode('5', 'Node 5')
      ]
      const edges = [
        createEdge('1', '2', 0.6),
        createEdge('1', '3', 0.3),
        createEdge('4', '2', 0.7),
        createEdge('4', '5', 0.2)
      ]
      const touched = new Set(['1', '4'])

      const result = getNextInvalidNode(nodes, edges, touched, '4')
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('1')  // Wraps around
    })
  })
})
