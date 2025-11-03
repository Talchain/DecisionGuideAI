import { describe, it, expect } from 'vitest'
import {
  validateGraphLimits,
  graphToV1Request,
  computeClientHash,
  toApiGraph,
  isApiGraph,
  type ReactFlowGraph,
} from '../mapper'
import type { UiGraph, ApiGraph } from '../../../../types/plot'
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

    it('should include node body in hash', () => {
      const graph1: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A', body: 'Body 1' } }],
        edges: [],
      }
      const graph2: ReactFlowGraph = {
        nodes: [{ id: 'a', data: { label: 'A', body: 'Body 2' } }],
        edges: [],
      }

      const hash1 = computeClientHash(graph1, 42)
      const hash2 = computeClientHash(graph2, 42)

      expect(hash1).not.toBe(hash2)
    })

    it('should include edge weight in hash', () => {
      const graph1: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }, { id: 'b', data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 1 } }],
      }
      const graph2: ReactFlowGraph = {
        nodes: [{ id: 'a', data: {} }, { id: 'b', data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 2 } }],
      }

      const hash1 = computeClientHash(graph1, 42)
      const hash2 = computeClientHash(graph2, 42)

      expect(hash1).not.toBe(hash2)
    })
  })

  // ========================================================================
  // New Clean API Tests
  // ========================================================================

  describe('toApiGraph', () => {
    it('converts UI graph to API graph', () => {
      const uiGraph: UiGraph = {
        nodes: [
          { id: 'n1', data: { label: 'Decision' } },
          { id: 'n2', data: { label: 'Outcome' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: { weight: 0.8 },
          },
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      expect(apiGraph).toEqual({
        nodes: [
          { id: 'n1', label: 'Decision' },
          { id: 'n2', label: 'Outcome' },
        ],
        edges: [
          { from: 'n1', to: 'n2', weight: 0.8 },
        ],
      })
    })

    it('normalizes percentage weights to ratio', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: 80 } },
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      expect(apiGraph.edges[0].weight).toBe(0.8)
    })

    it('preserves negative weights', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: -0.5 } },
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      expect(apiGraph.edges[0].weight).toBe(-0.5)
    })

    it('throws BAD_INPUT for NaN weight', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: NaN } },
        ],
      }

      expect(() => toApiGraph(uiGraph)).toThrow()
      try {
        toApiGraph(uiGraph)
      } catch (err: any) {
        expect(err.code).toBe('BAD_INPUT')
        expect(err.message).toContain('finite number')
      }
    })

    it('throws BAD_INPUT for weight out of range', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: 150 } },
        ],
      }

      expect(() => toApiGraph(uiGraph)).toThrow()
      try {
        toApiGraph(uiGraph)
      } catch (err: any) {
        expect(err.code).toBe('BAD_INPUT')
        expect(err.message).toContain('out of range')
        expect(err.field).toBe('edges[0].weight')
      }
    })

    it('throws BAD_INPUT for missing node id', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: '' }],
        edges: [],
      }

      expect(() => toApiGraph(uiGraph)).toThrow()
      try {
        toApiGraph(uiGraph)
      } catch (err: any) {
        expect(err.code).toBe('BAD_INPUT')
        expect(err.message).toContain('missing or empty id')
      }
    })

    it('throws BAD_INPUT for missing edge source', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1', source: '', target: 'n1' }],
      }

      expect(() => toApiGraph(uiGraph)).toThrow()
      try {
        toApiGraph(uiGraph)
      } catch (err: any) {
        expect(err.code).toBe('BAD_INPUT')
        expect(err.message).toContain('missing or empty source')
      }
    })
  })

  describe('isApiGraph', () => {
    it('returns true for API graph with from/to edges', () => {
      const apiGraph: ApiGraph = {
        nodes: [{ id: 'n1' }],
        edges: [{ from: 'n1', to: 'n2' }],
      }

      expect(isApiGraph(apiGraph)).toBe(true)
    })

    it('returns false for UI graph with source/target edges', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      }

      expect(isApiGraph(uiGraph)).toBe(false)
    })

    it('returns false for invalid input', () => {
      expect(isApiGraph(null)).toBe(false)
      expect(isApiGraph(undefined)).toBe(false)
      expect(isApiGraph('string')).toBe(false)
    })

    it('returns true for empty API graph', () => {
      const apiGraph: ApiGraph = {
        nodes: [],
        edges: [],
      }

      expect(isApiGraph(apiGraph)).toBe(true)
    })
  })

  // ========================================================================
  // Shape Validation Tests (DEV-only, but tested in all envs)
  // ========================================================================

  describe('toApiGraph - shape validation', () => {
    it('accepts clean API-shape output', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1', data: { label: 'Node' } }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5 } }],
      }

      // Should not throw
      const apiGraph = toApiGraph(uiGraph)

      // Verify clean output (no UI-only fields)
      expect(apiGraph.nodes[0]).not.toHaveProperty('data')
      expect(apiGraph.nodes[0]).not.toHaveProperty('position')
      expect(apiGraph.nodes[0]).not.toHaveProperty('type')
      expect(apiGraph.edges[0]).not.toHaveProperty('id')
      expect(apiGraph.edges[0]).not.toHaveProperty('source')
      expect(apiGraph.edges[0]).not.toHaveProperty('target')
      expect(apiGraph.edges[0]).not.toHaveProperty('data')
    })

    it('ensures nodes do not leak UI-only fields', () => {
      // This test verifies the conversion strips UI fields correctly
      const uiGraph: UiGraph = {
        nodes: [
          {
            id: 'n1',
            data: { label: 'Test' },
            // These UI-only fields should NOT appear in API output:
            position: { x: 100, y: 200 },
            type: 'decision',
            selected: true,
          } as any,
        ],
        edges: [],
      }

      const apiGraph = toApiGraph(uiGraph)

      // Verify toApiGraph strips these correctly
      expect(apiGraph.nodes[0]).toEqual({ id: 'n1', label: 'Test' })
      expect(apiGraph.nodes[0]).not.toHaveProperty('position')
      expect(apiGraph.nodes[0]).not.toHaveProperty('type')
      expect(apiGraph.nodes[0]).not.toHaveProperty('selected')
      expect(apiGraph.nodes[0]).not.toHaveProperty('data')
    })

    it('ensures edges do not leak UI-only fields', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: { weight: 0.8 },
            // These UI-only fields should NOT appear in API output:
            selected: true,
          } as any,
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      // Verify toApiGraph converts correctly
      expect(apiGraph.edges[0]).toEqual({ from: 'n1', to: 'n2', weight: 0.8 })
      expect(apiGraph.edges[0]).not.toHaveProperty('id')
      expect(apiGraph.edges[0]).not.toHaveProperty('source')
      expect(apiGraph.edges[0]).not.toHaveProperty('target')
      expect(apiGraph.edges[0]).not.toHaveProperty('data')
      expect(apiGraph.edges[0]).not.toHaveProperty('selected')
    })

    it('validates weight is finite', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: Infinity } },
        ],
      }

      expect(() => toApiGraph(uiGraph)).toThrow('finite number')
    })

    it('validates weight is in -1..1 range', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { weight: 200 } },
        ],
      }

      // Should throw because 200/100 = 2.0 which is > 1
      expect(() => toApiGraph(uiGraph)).toThrow('out of range')
    })

    it('accepts weights in valid range', () => {
      const testCases = [
        { weight: 0, expected: 0 },
        { weight: 0.5, expected: 0.5 },
        { weight: 1, expected: 1 },
        { weight: -0.5, expected: -0.5 },
        { weight: -1, expected: -1 },
        { weight: 50, expected: 0.5 }, // percentage
        { weight: -50, expected: -0.5 }, // negative percentage
      ]

      testCases.forEach(({ weight, expected }) => {
        const uiGraph: UiGraph = {
          nodes: [{ id: 'n1' }, { id: 'n2' }],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight } }],
        }

        const apiGraph = toApiGraph(uiGraph)
        expect(apiGraph.edges[0].weight).toBe(expected)
      })
    })

    it('strips confidence and only sends weight', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: { confidence: 0.9, weight: 0.8 },
          },
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      // Should use weight, not confidence
      expect(apiGraph.edges[0]).toEqual({ from: 'n1', to: 'n2', weight: 0.8 })
      expect(apiGraph.edges[0]).not.toHaveProperty('confidence')
    })

    it('falls back to confidence if weight not present', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            data: { confidence: 0.7 },
          },
        ],
      }

      const apiGraph = toApiGraph(uiGraph)

      expect(apiGraph.edges[0]).toEqual({ from: 'n1', to: 'n2', weight: 0.7 })
    })
  })
})
