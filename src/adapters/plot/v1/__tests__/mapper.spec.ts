/**
 * Unit tests for new clean mapper API (toApiGraph, isApiGraph)
 *
 * Tests the strict UI ⇄ API shape separation rules
 */

import { describe, it, expect } from 'vitest'
import { toApiGraph, isApiGraph } from '../mapper'
import type { UiGraph, ApiGraph } from '../../../../types/plot'

describe('mapper (new clean API)', () => {
  describe('isApiGraph', () => {
    it('should identify API graph (has from/to edges)', () => {
      const apiGraph: ApiGraph = {
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ from: 'a', to: 'b' }],
      }

      expect(isApiGraph(apiGraph)).toBe(true)
    })

    it('should reject UI graph (has source/target edges)', () => {
      const uiGraph: UiGraph = {
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }

      expect(isApiGraph(uiGraph)).toBe(false)
    })

    it('should handle empty edges array (assume API shape)', () => {
      const graph = {
        nodes: [{ id: 'a' }],
        edges: [],
      }

      expect(isApiGraph(graph)).toBe(true)
    })

    it('should reject invalid graph structures', () => {
      expect(isApiGraph(null)).toBe(false)
      expect(isApiGraph(undefined)).toBe(false)
      expect(isApiGraph({})).toBe(false)
      expect(isApiGraph({ nodes: [] })).toBe(false)
      expect(isApiGraph({ edges: [] })).toBe(false)
    })
  })

  describe('toApiGraph', () => {
    describe('node mapping', () => {
      it('should extract id and label from node.label', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a', label: 'Node A' }],
          edges: [],
        }

        const api = toApiGraph(ui)

        expect(api.nodes).toEqual([{ id: 'a', label: 'Node A' }])
      })

      it('should fall back to node.data.label when node.label missing', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a', data: { label: 'Node A' } }],
          edges: [],
        }

        const api = toApiGraph(ui)

        expect(api.nodes).toEqual([{ id: 'a', label: 'Node A' }])
      })

      it('should prefer node.label over node.data.label', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a', label: 'Primary', data: { label: 'Secondary' } }],
          edges: [],
        }

        const api = toApiGraph(ui)

        expect(api.nodes).toEqual([{ id: 'a', label: 'Primary' }])
      })

      it('should omit label field when not present', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }],
          edges: [],
        }

        const api = toApiGraph(ui)

        expect(api.nodes).toEqual([{ id: 'a' }])
        expect('label' in api.nodes[0]).toBe(false)
      })
    })

    describe('edge mapping - shape correctness', () => {
      it('should convert source/target to from/to', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b' }],
        }

        const api = toApiGraph(ui)

        expect(api.edges).toEqual([{ from: 'a', to: 'b' }])
      })

      it('should never include id field in API edges', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b' }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0]).not.toHaveProperty('id')
        expect(api.edges[0]).not.toHaveProperty('source')
        expect(api.edges[0]).not.toHaveProperty('target')
      })

      it('should never include data.confidence in API edges', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { confidence: 0.8 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0]).not.toHaveProperty('confidence')
        expect(api.edges[0]).not.toHaveProperty('data')
        // Confidence should map to weight
        expect(api.edges[0]).toHaveProperty('weight', 0.8)
      })

      it('should include label when present', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { label: 'causes' } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges).toEqual([{ from: 'a', to: 'b', label: 'causes' }])
      })

      it('should omit optional fields when not present', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b' }],
        }

        const api = toApiGraph(ui)

        expect(api.edges).toEqual([{ from: 'a', to: 'b' }])
        expect('label' in api.edges[0]).toBe(false)
        expect('weight' in api.edges[0]).toBe(false)
      })
    })

    describe('weight normalization - positive values', () => {
      it('should keep weight 1 as-is', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 1 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(1)
      })

      it('should keep weight 0.6 as-is (already normalized)', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 0.6 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(0.6)
      })

      it('should normalize weight 75 to 0.75', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 75 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(0.75)
      })

      it('should normalize weight 100 to 1', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: 100 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(1)
      })
    })

    describe('weight normalization - negative values (inhibitory)', () => {
      it('should preserve negative weight -0.4', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: -0.4 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(-0.4)
      })

      it('should normalize negative weight -25 to -0.25', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: -25 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(-0.25)
      })

      it('should normalize negative weight -100 to -1', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { weight: -100 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(-1)
      })
    })

    describe('confidence fallback (always non-negative)', () => {
      it('should map confidence 0.6 to weight 0.6', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { confidence: 0.6 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(0.6)
      })

      it('should normalize confidence 60 to weight 0.6', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [{ id: 'e1', source: 'a', target: 'b', data: { confidence: 60 } }],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(0.6)
      })

      it('should prefer weight over confidence when both present', () => {
        const ui: UiGraph = {
          nodes: [{ id: 'a' }, { id: 'b' }],
          edges: [
            {
              id: 'e1',
              source: 'a',
              target: 'b',
              data: { weight: 0.8, confidence: 0.6 },
            },
          ],
        }

        const api = toApiGraph(ui)

        expect(api.edges[0].weight).toBe(0.8)
      })
    })

    describe('complex graphs', () => {
      it('should handle multiple nodes and edges correctly', () => {
        const ui: UiGraph = {
          nodes: [
            { id: 'a', label: 'Node A' },
            { id: 'b', data: { label: 'Node B' } },
            { id: 'c' },
          ],
          edges: [
            { id: 'e1', source: 'a', target: 'b', data: { weight: 0.8, label: 'causes' } },
            { id: 'e2', source: 'b', target: 'c', data: { confidence: 60 } },
            { id: 'e3', source: 'a', target: 'c', data: { weight: -50 } },
          ],
        }

        const api = toApiGraph(ui)

        expect(api.nodes).toEqual([
          { id: 'a', label: 'Node A' },
          { id: 'b', label: 'Node B' },
          { id: 'c' },
        ])

        expect(api.edges).toEqual([
          { from: 'a', to: 'b', label: 'causes', weight: 0.8 },
          { from: 'b', to: 'c', weight: 0.6 },
          { from: 'a', to: 'c', weight: -0.5 },
        ])
      })

      it('should not leak any UI-specific fields', () => {
        const ui: UiGraph = {
          nodes: [
            {
              id: 'a',
              type: 'custom',
              data: { label: 'A', custom: 'field', body: 'description' },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'a',
              target: 'a',
              data: {
                confidence: 0.7,
                custom: 'field',
                animated: true,
              },
            },
          ],
        }

        const api = toApiGraph(ui)

        // Nodes should only have id and label
        expect(api.nodes[0]).toEqual({ id: 'a', label: 'A' })
        expect(api.nodes[0]).not.toHaveProperty('type')
        expect(api.nodes[0]).not.toHaveProperty('data')

        // Edges should only have from, to, and weight
        expect(api.edges[0]).toEqual({ from: 'a', to: 'a', weight: 0.7 })
        expect(api.edges[0]).not.toHaveProperty('id')
        expect(api.edges[0]).not.toHaveProperty('source')
        expect(api.edges[0]).not.toHaveProperty('target')
        expect(api.edges[0]).not.toHaveProperty('data')
        expect(api.edges[0]).not.toHaveProperty('confidence')
        expect(api.edges[0]).not.toHaveProperty('custom')
        expect(api.edges[0]).not.toHaveProperty('animated')
      })
    })
  })
})
