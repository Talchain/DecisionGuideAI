/**
 * Unit tests for graphPreflight validator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { validateGraph, isWithinLimits, getCurrentLimits } from '../graphPreflight'
import { limitsManager } from '../../../adapters/plot/v1/limitsManager'
import type { UiGraph } from '../../../types/plot'

describe('graphPreflight', () => {
  beforeEach(() => {
    // Reset limits to static fallback
    limitsManager.reset()
  })

  describe('validateGraph()', () => {
    it('should return valid for empty graph', () => {
      const graph: UiGraph = { nodes: [], edges: [] }
      const result = validateGraph(graph)

      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should return valid for well-formed graph', () => {
      const graph: UiGraph = {
        nodes: [
          { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
          { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5 } }],
      }
      const result = validateGraph(graph)

      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    describe('node count limit', () => {
      it('should reject graph with too many nodes', () => {
        const nodes = Array.from({ length: 201 }, (_, i) => ({
          id: `n${i}`,
          label: `Node ${i}`,
          data: { label: `Node ${i}` },
        }))
        const graph: UiGraph = { nodes, edges: [] }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations).toHaveLength(1)
        expect(result.violations[0]).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          field: 'nodes',
          max: 200,
          current: 201,
        })
        expect(result.violations[0].message).toContain('too many nodes')
      })

      it('should accept graph at exact node limit', () => {
        const nodes = Array.from({ length: 200 }, (_, i) => ({
          id: `n${i}`,
          label: `Node ${i}`,
          data: { label: `Node ${i}` },
        }))
        const graph: UiGraph = { nodes, edges: [] }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })
    })

    describe('edge count limit', () => {
      it('should reject graph with too many edges', () => {
        const nodes = [
          { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
          { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
        ]
        const edges = Array.from({ length: 501 }, (_, i) => ({
          id: `e${i}`,
          source: 'n1',
          target: 'n2',
          data: {},
        }))
        const graph: UiGraph = { nodes, edges }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations).toHaveLength(1)
        expect(result.violations[0]).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          field: 'edges',
          max: 500,
          current: 501,
        })
      })

      it('should accept graph at exact edge limit', () => {
        const nodes = [
          { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
          { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
        ]
        const edges = Array.from({ length: 500 }, (_, i) => ({
          id: `e${i}`,
          source: 'n1',
          target: 'n2',
          data: {},
        }))
        const graph: UiGraph = { nodes, edges }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })
    })

    describe('node validation', () => {
      it('should reject node with missing ID', () => {
        const graph: UiGraph = {
          nodes: [{ id: '', label: 'Test', data: { label: 'Test' } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'MISSING_FIELD',
          field: 'nodes[0].id',
        })
        expect(result.violations[0].message).toContain('missing an ID')
      })

      it('should reject node with whitespace-only ID', () => {
        const graph: UiGraph = {
          nodes: [{ id: '   ', label: 'Test', data: { label: 'Test' } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0].code).toBe('MISSING_FIELD')
      })

      it('should reject node with label exceeding limit', () => {
        const longLabel = 'x'.repeat(121)
        const graph: UiGraph = {
          nodes: [{ id: 'n1', label: longLabel, data: { label: longLabel } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          field: 'nodes[0].label',
          max: 120,
          current: 121,
        })
        expect(result.violations[0].message).toContain('label is too long')
      })

      it('should accept node with label at exact limit', () => {
        const label = 'x'.repeat(120)
        const graph: UiGraph = {
          nodes: [{ id: 'n1', label, data: { label } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })

      it('should reject node with body exceeding limit', () => {
        const longBody = 'x'.repeat(2001)
        const graph: UiGraph = {
          nodes: [{ id: 'n1', label: 'Node', data: { label: 'Node', body: longBody } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'LIMIT_EXCEEDED',
          field: 'nodes[0].body',
          max: 2000,
          current: 2001,
        })
        expect(result.violations[0].message).toContain('description is too long')
      })

      it('should check label from node.data.label if node.label missing', () => {
        const longLabel = 'x'.repeat(121)
        const graph: UiGraph = {
          nodes: [{ id: 'n1', data: { label: longLabel } }],
          edges: [],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0].code).toBe('LIMIT_EXCEEDED')
      })
    })

    describe('edge validation', () => {
      it('should reject edge with missing source', () => {
        const graph: UiGraph = {
          nodes: [{ id: 'n1', label: 'Node 1', data: { label: 'Node 1' } }],
          edges: [{ id: 'e1', source: '', target: 'n1', data: {} }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'MISSING_FIELD',
          field: 'edges[0].source',
        })
        expect(result.violations[0].message).toContain('missing a source node')
      })

      it('should reject edge with missing target', () => {
        const graph: UiGraph = {
          nodes: [{ id: 'n1', label: 'Node 1', data: { label: 'Node 1' } }],
          edges: [{ id: 'e1', source: 'n1', target: '', data: {} }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'MISSING_FIELD',
          field: 'edges[0].target',
        })
        expect(result.violations[0].message).toContain('missing a target node')
      })

      it('should reject edge with non-finite weight', () => {
        const graph: UiGraph = {
          nodes: [
            { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: NaN } }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'BAD_INPUT',
          field: 'edges[0].weight',
        })
        expect(result.violations[0].message).toContain('invalid weight')
      })

      it('should reject edge with weight > 100', () => {
        const graph: UiGraph = {
          nodes: [
            { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 101 } }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations[0]).toMatchObject({
          code: 'BAD_INPUT',
          field: 'edges[0].weight',
        })
        expect(result.violations[0].message).toContain('out of range')
        expect(result.violations[0].message).toContain('-100 and 100')
      })

      it('should accept edge with weight = 100', () => {
        const graph: UiGraph = {
          nodes: [
            { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 100 } }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })

      it('should accept edge with weight = -1 (negative allowed)', () => {
        const graph: UiGraph = {
          nodes: [
            { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: -1 } }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })

      it('should accept edge with no weight', () => {
        const graph: UiGraph = {
          nodes: [
            { id: 'n1', label: 'Node 1', data: { label: 'Node 1' } },
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2' } },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', data: {} }],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(true)
      })
    })

    describe('multiple violations', () => {
      it('should return all violations (not just first)', () => {
        const graph: UiGraph = {
          nodes: [
            { id: '', label: 'x'.repeat(121), data: { label: 'Test' } }, // Missing ID + long label
            { id: 'n2', label: 'Node 2', data: { label: 'Node 2', body: 'x'.repeat(2001) } }, // Long body
          ],
          edges: [
            { id: 'e1', source: '', target: '', data: {} }, // Missing source + target
            { id: 'e2', source: 'n1', target: 'n2', data: { weight: NaN } }, // Invalid weight
          ],
        }

        const result = validateGraph(graph)

        expect(result.valid).toBe(false)
        expect(result.violations.length).toBeGreaterThanOrEqual(5)
      })
    })
  })

  describe('isWithinLimits()', () => {
    it('should return true if both counts within limits', () => {
      expect(isWithinLimits(100, 250)).toBe(true)
    })

    it('should return true at exact limits', () => {
      expect(isWithinLimits(200, 500)).toBe(true)
    })

    it('should return false if node count exceeds limit', () => {
      expect(isWithinLimits(201, 250)).toBe(false)
    })

    it('should return false if edge count exceeds limit', () => {
      expect(isWithinLimits(100, 501)).toBe(false)
    })

    it('should return false if both counts exceed limits', () => {
      expect(isWithinLimits(201, 501)).toBe(false)
    })
  })

  describe('getCurrentLimits()', () => {
    it('should return limits from singleton', () => {
      const limits = getCurrentLimits()

      expect(limits).toEqual({
        nodes: { max: 200 },
        edges: { max: 500 },
        label: { max: 120 },
        body: { max: 2000 },
        rateLimit: { rpm: 60 },
      })
    })
  })
})
