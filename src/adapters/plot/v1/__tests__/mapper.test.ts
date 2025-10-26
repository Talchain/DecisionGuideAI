import { describe, it, expect } from 'vitest'
import {
  validateGraphLimits,
  graphToV1Request,
  computeClientHash,
  type ReactFlowGraph,
} from '../mapper'
import { V1_LIMITS } from '../types'

describe('v1/mapper', () => {
  describe('validateGraphLimits', () => {
    it('should pass validation for valid graph', () => {
      const graph: ReactFlowGraph = {
        nodes: [
          { id: 'a', data: { label: 'Node A', body: 'Description' } },
          { id: 'b', data: { label: 'Node B', body: 'Description' } },
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }

      const error = validateGraphLimits(graph)
      expect(error).toBeNull()
    })

    it('should reject graph exceeding MAX_NODES', () => {
      const nodes = Array.from({ length: V1_LIMITS.MAX_NODES + 1 }, (_, i) => ({
        id: `node-${i}`,
        data: { label: 'Test' },
      }))

      const graph: ReactFlowGraph = { nodes, edges: [] }
      const error = validateGraphLimits(graph)

      expect(error).toEqual({
        code: 'LIMIT_EXCEEDED',
        message: `Graph has ${V1_LIMITS.MAX_NODES + 1} nodes, max is ${V1_LIMITS.MAX_NODES}`,
        field: 'nodes',
        max: V1_LIMITS.MAX_NODES,
      })
    })

    it('should reject graph exceeding MAX_EDGES', () => {
      const nodes = [
        { id: 'a', data: { label: 'A' } },
        { id: 'b', data: { label: 'B' } },
      ]
      const edges = Array.from({ length: V1_LIMITS.MAX_EDGES + 1 }, (_, i) => ({
        id: `e-${i}`,
        source: 'a',
        target: 'b',
      }))

      const graph: ReactFlowGraph = { nodes, edges }
      const error = validateGraphLimits(graph)

      expect(error).toEqual({
        code: 'LIMIT_EXCEEDED',
        message: `Graph has ${V1_LIMITS.MAX_EDGES + 1} edges, max is ${V1_LIMITS.MAX_EDGES}`,
        field: 'edges',
        max: V1_LIMITS.MAX_EDGES,
      })
    })

    it('should reject node with label exceeding MAX_LABEL_LENGTH', () => {
      const longLabel = 'x'.repeat(V1_LIMITS.MAX_LABEL_LENGTH + 1)
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: longLabel } }],
        edges: [],
      }

      const error = validateGraphLimits(graph)

      expect(error).toEqual({
        code: 'BAD_INPUT',
        message: `Node a label exceeds ${V1_LIMITS.MAX_LABEL_LENGTH} characters`,
        field: 'label',
        max: V1_LIMITS.MAX_LABEL_LENGTH,
      })
    })

    it('should reject node with body exceeding MAX_BODY_LENGTH', () => {
      const longBody = 'x'.repeat(V1_LIMITS.MAX_BODY_LENGTH + 1)
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A', body: longBody } }],
        edges: [],
      }

      const error = validateGraphLimits(graph)

      expect(error).toEqual({
        code: 'BAD_INPUT',
        message: `Node a body exceeds ${V1_LIMITS.MAX_BODY_LENGTH} characters`,
        field: 'body',
        max: V1_LIMITS.MAX_BODY_LENGTH,
      })
    })
  })

  describe('graphToV1Request', () => {
    it('should convert valid graph to v1 format', () => {
      const graph: ReactFlowGraph = {
        nodes: [
          { id: 'a', data: { label: 'Node A', body: 'Body A' } },
          { id: 'b', data: { label: 'Node B', body: 'Body B' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b', data: { confidence: 0.8, weight: 5 } },
        ],
      }

      const request = graphToV1Request(graph, 42)

      expect(request).toEqual({
        graph: {
          nodes: [
            { id: 'a', label: 'Node A', body: 'Body A' },
            { id: 'b', label: 'Node B', body: 'Body B' },
          ],
          edges: [{ from: 'a', to: 'b', confidence: 0.8, weight: 5 }],
        },
        seed: 42,
      })
    })

    it('should throw ValidationError for invalid graph', () => {
      const nodes = Array.from({ length: V1_LIMITS.MAX_NODES + 1 }, (_, i) => ({
        id: `node-${i}`,
        data: {},
      }))
      const graph: ReactFlowGraph = { nodes, edges: [] }

      expect(() => graphToV1Request(graph)).toThrow()
    })

    it('should normalize confidence > 1 as percentage', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }, { id: 'b', data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b', data: { confidence: 75 } }],
      }

      const request = graphToV1Request(graph)

      expect(request.graph.edges[0].confidence).toBe(0.75)
    })

    it('should keep confidence <= 1 as-is', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }, { id: 'b', data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b', data: { confidence: 0.75 } }],
      }

      const request = graphToV1Request(graph)

      expect(request.graph.edges[0].confidence).toBe(0.75)
    })

    it('should throw for labels exceeding MAX_LABEL_LENGTH', () => {
      const longLabel = 'x'.repeat(V1_LIMITS.MAX_LABEL_LENGTH + 50)
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: longLabel } }],
        edges: [],
      }

      expect(() => graphToV1Request(graph)).toThrow()
    })

    it('should handle nodes without labels or bodies', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }],
        edges: [],
      }

      const request = graphToV1Request(graph)

      expect(request.graph.nodes[0]).toEqual({ id: 'a', label: undefined, body: undefined })
    })

    it('should handle edges without confidence or weight', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }, { id: 'b', data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b', data: {} }],
      }

      const request = graphToV1Request(graph)

      expect(request.graph.edges[0]).toEqual({ from: 'a', to: 'b' })
    })
  })

  describe('computeClientHash', () => {
    it('should generate consistent hash for same graph', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A' } }],
        edges: [],
      }

      const hash1 = computeClientHash(graph, 42)
      const hash2 = computeClientHash(graph, 42)

      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different graphs', () => {
      const graph1: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A' } }],
        edges: [],
      }
      const graph2: ReactFlowGraph = {
        nodes: [{ id: 'b', data: { label: 'B' } }],
        edges: [],
      }

      const hash1 = computeClientHash(graph1, 42)
      const hash2 = computeClientHash(graph2, 42)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash for different seeds', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A' } }],
        edges: [],
      }

      const hash1 = computeClientHash(graph, 42)
      const hash2 = computeClientHash(graph, 99)

      expect(hash1).not.toBe(hash2)
    })

    it('should be order-independent for nodes', () => {
      const graph1: ReactFlowGraph = {
        nodes: [
          { id: 'a', data: { label: 'A' } },
          { id: 'b', data: { label: 'B' } },
        ],
        edges: [],
      }
      const graph2: ReactFlowGraph = {
        nodes: [
          { id: 'b', data: { label: 'B' } },
          { id: 'a', data: { label: 'A' } },
        ],
        edges: [],
      }

      const hash1 = computeClientHash(graph1, 42)
      const hash2 = computeClientHash(graph2, 42)

      expect(hash1).toBe(hash2)
    })

    it('should return hexadecimal string', () => {
      const graph: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A' } }],
        edges: [],
      }

      const hash = computeClientHash(graph, 42)

      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })
})
