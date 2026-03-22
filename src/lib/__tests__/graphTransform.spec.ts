import { describe, it, expect } from 'vitest'
import {
  prepareGraphSnapshot,
  ensureSchemaV22,
  hasMinimumStructure,
  type Graph,
} from '../graphTransform'
import type { Node, Edge } from '@xyflow/react'

describe('graphTransform', () => {
  // Mock canvas nodes
  const mockNodes: Node[] = [
    {
      id: 'node_1',
      type: 'factor',
      position: { x: 100, y: 200 },
      data: { label: 'Market Size', kind: 'factor', body: 'Test body' },
    },
    {
      id: 'node_2',
      type: 'outcome',
      position: { x: 300, y: 200 },
      data: { label: 'Revenue', kind: 'outcome' },
    },
    {
      id: 'node_3',
      type: 'factor',
      position: { x: 200, y: 100 },
      data: { label: 'Competition' },
    },
  ]

  // Mock canvas edges
  const mockEdges: Edge[] = [
    {
      id: 'edge_1',
      source: 'node_1',
      target: 'node_2',
      data: { confidence: 0.8, effect_direction: 'positive' },
    },
    {
      id: 'edge_2',
      source: 'node_3',
      target: 'node_2',
      data: { weight: 0.6 },
    },
  ]

  describe('prepareGraphSnapshot', () => {
    it('transforms nodes to GraphNode format', () => {
      const result = prepareGraphSnapshot(mockNodes, mockEdges)

      expect(result.nodes).toHaveLength(3)

      const node1 = result.nodes.find(n => n.id === 'node_1')
      expect(node1).toMatchObject({
        id: 'node_1',
        kind: 'factor',
        label: 'Market Size',
        body: 'Test body',
      })

      const node2 = result.nodes.find(n => n.id === 'node_2')
      expect(node2).toMatchObject({
        id: 'node_2',
        kind: 'outcome',
        label: 'Revenue',
      })
    })

    it('transforms edges to GraphEdge format', () => {
      const result = prepareGraphSnapshot(mockNodes, mockEdges)

      expect(result.edges).toHaveLength(2)

      const edge1 = result.edges.find(e => e.from === 'node_1')
      expect(edge1).toMatchObject({
        from: 'node_1',
        to: 'node_2',
        belief: 0.8,
        effect_direction: 'positive',
      })

      // Edge with weight should map to belief
      const edge2 = result.edges.find(e => e.from === 'node_3')
      expect(edge2).toMatchObject({
        from: 'node_3',
        to: 'node_2',
        belief: 0.6,
      })
    })

    it('sets graph version and metadata', () => {
      const result = prepareGraphSnapshot(mockNodes, mockEdges)

      expect(result.version).toBe('1')
      expect(result.default_seed).toBe(42)
      expect(result.meta.source).toBe('ui')
    })

    it('computes topology (roots and leaves)', () => {
      const result = prepareGraphSnapshot(mockNodes, mockEdges)

      // node_1 and node_3 have no incoming edges (roots)
      expect(result.meta.roots).toContain('node_1')
      expect(result.meta.roots).toContain('node_3')

      // node_2 has no outgoing edges (leaf)
      expect(result.meta.leaves).toContain('node_2')
    })

    it('includes suggested positions from canvas', () => {
      const result = prepareGraphSnapshot(mockNodes, mockEdges)

      expect(result.meta.suggested_positions['node_1']).toEqual({ x: 100, y: 200 })
      expect(result.meta.suggested_positions['node_2']).toEqual({ x: 300, y: 200 })
    })

    it('defaults to factor kind when missing', () => {
      const nodesWithMissingKind: Node[] = [
        { id: 'test', position: { x: 0, y: 0 }, data: { label: 'Test' } },
      ]

      const result = prepareGraphSnapshot(nodesWithMissingKind, [])
      expect(result.nodes[0].kind).toBe('factor')
    })

    it('defaults belief to 0.5 when missing confidence/weight', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node_1', target: 'node_2', data: {} },
      ]

      const result = prepareGraphSnapshot(mockNodes, edges)
      expect(result.edges[0].belief).toBe(0.5)
    })

    it('defaults edge_type to "directed" when absent', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node_1', target: 'node_2', data: { confidence: 0.8 } },
      ]

      const result = prepareGraphSnapshot(mockNodes, edges)
      expect(result.edges[0].edge_type).toBe('directed')
    })

    it('preserves edge_type when present in data', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node_1', target: 'node_2', data: { confidence: 0.8, edge_type: 'bidirected' } },
      ]

      const result = prepareGraphSnapshot(mockNodes, edges)
      expect(result.edges[0].edge_type).toBe('bidirected')
    })

    it('defaults edge_type to "directed" for non-string values', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'node_1', target: 'node_2', data: { confidence: 0.8, edge_type: 42 } },
      ]

      const result = prepareGraphSnapshot(mockNodes, edges)
      expect(result.edges[0].edge_type).toBe('directed')
    })

    it('truncates body to 200 chars', () => {
      const longBody = 'x'.repeat(300)
      const nodesWithLongBody: Node[] = [
        { id: 'test', position: { x: 0, y: 0 }, data: { label: 'Test', body: longBody } },
      ]

      const result = prepareGraphSnapshot(nodesWithLongBody, [])
      expect(result.nodes[0].body).toHaveLength(200)
    })

    it('handles empty graph', () => {
      const result = prepareGraphSnapshot([], [])

      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
      expect(result.meta.roots).toHaveLength(0)
      expect(result.meta.leaves).toHaveLength(0)
    })
  })

  describe('ensureSchemaV22', () => {
    it('returns graph unchanged (identity transform)', () => {
      const graph = prepareGraphSnapshot(mockNodes, mockEdges)
      const result = ensureSchemaV22(graph)

      expect(result).toEqual(graph)
    })
  })

  describe('hasMinimumStructure', () => {
    it('returns true for graph with nodes', () => {
      const graph = prepareGraphSnapshot(mockNodes, mockEdges)
      expect(hasMinimumStructure(graph)).toBe(true)
    })

    it('returns false for empty graph', () => {
      const graph = prepareGraphSnapshot([], [])
      expect(hasMinimumStructure(graph)).toBe(false)
    })

    it('returns true for graph with nodes but no edges', () => {
      const graph = prepareGraphSnapshot(mockNodes, [])
      expect(hasMinimumStructure(graph)).toBe(true)
    })
  })
})
