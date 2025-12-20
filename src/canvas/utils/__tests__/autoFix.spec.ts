/**
 * Unit tests for autoFix utility functions
 *
 * Tests verify:
 * 1. Probability normalization only applies to decision→option edges
 * 2. Non-decision nodes and non-option targets return unchanged
 * 3. Immutability is preserved (same array reference when no changes)
 * 4. Object identity is preserved for untouched edges
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeProbabilities,
  addRiskNode,
  addFactorNode,
  connectOrphanNode,
  determineFixType,
  executeAutoFix,
} from '../autoFix'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'

describe('autoFix', () => {
  // ==========================================================================
  // normalizeProbabilities - Decision→Option Scoping
  // ==========================================================================

  describe('normalizeProbabilities', () => {
    describe('positive cases (normalization occurs)', () => {
      it('normalizes decision→option edge confidence to sum to 1', () => {
        const nodes: Node[] = [
          { id: 'n1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'n2', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
          { id: 'n3', data: { label: 'Option B', kind: 'option' }, position: { x: 100, y: 100 } },
          { id: 'n4', data: { label: 'Other', kind: 'outcome' }, position: { x: 200, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.3 } as EdgeData },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.6 } as EdgeData },
          { id: 'e3', source: 'n2', target: 'n4', data: { confidence: 0.5 } as EdgeData }, // different source
        ]

        const result = normalizeProbabilities('n1', nodes, edges)

        expect(result.success).toBe(true)
        expect(result.message).toContain('2 edge')
        expect(result.updatedEdges).toBeDefined()

        const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
        const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')
        const updatedE3 = result.updatedEdges!.find(e => e.id === 'e3')

        // Should normalize confidence: 0.3 / 0.9 ≈ 0.333, 0.6 / 0.9 ≈ 0.667
        expect((updatedE1!.data as EdgeData).confidence).toBeCloseTo(0.333, 2)
        expect((updatedE2!.data as EdgeData).confidence).toBeCloseTo(0.667, 2)
        // Edge with different source should be unchanged
        expect((updatedE3!.data as EdgeData).confidence).toBe(0.5)
      })

      it('distributes evenly when all confidences are zero', () => {
        const nodes: Node[] = [
          { id: 'n1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'n2', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
          { id: 'n3', data: { label: 'Option B', kind: 'option' }, position: { x: 100, y: 100 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0 } as EdgeData },
          { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0 } as EdgeData },
        ]

        const result = normalizeProbabilities('n1', nodes, edges)

        expect(result.success).toBe(true)
        expect(result.message).toContain('50%')

        const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
        const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')

        expect((updatedE1!.data as EdgeData).confidence).toBe(0.5)
        expect((updatedE2!.data as EdgeData).confidence).toBe(0.5)
      })

      it('normalizes single decision→option edge to 1.0', () => {
        const nodes: Node[] = [
          { id: 'n1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'n2', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6 } as EdgeData },
        ]

        const result = normalizeProbabilities('n1', nodes, edges)

        expect(result.success).toBe(true)
        const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
        expect((updatedE1!.data as EdgeData).confidence).toBe(1.0)
      })

      it('only normalizes decision→option edges, ignoring decision→outcome edges', () => {
        const nodes: Node[] = [
          { id: 'd1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'opt1', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
          { id: 'opt2', data: { label: 'Option B', kind: 'option' }, position: { x: 100, y: 100 } },
          { id: 'out1', data: { label: 'Outcome', kind: 'outcome' }, position: { x: 200, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'd1', target: 'opt1', data: { confidence: 0.3 } as EdgeData },
          { id: 'e2', source: 'd1', target: 'opt2', data: { confidence: 0.6 } as EdgeData },
          { id: 'e3', source: 'd1', target: 'out1', data: { confidence: 0.8 } as EdgeData }, // decision→outcome
        ]

        const result = normalizeProbabilities('d1', nodes, edges)

        expect(result.success).toBe(true)
        expect(result.message).toContain('2 edge') // Only 2 option edges

        const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
        const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')
        const updatedE3 = result.updatedEdges!.find(e => e.id === 'e3')

        // Option edges normalized
        expect((updatedE1!.data as EdgeData).confidence).toBeCloseTo(0.333, 2)
        expect((updatedE2!.data as EdgeData).confidence).toBeCloseTo(0.667, 2)
        // Outcome edge unchanged
        expect((updatedE3!.data as EdgeData).confidence).toBe(0.8)
      })
    })

    describe('negative cases (no normalization)', () => {
      it('fails for factor nodes (not decision)', () => {
        const nodes: Node[] = [
          { id: 'f1', data: { label: 'Factor', kind: 'factor' }, position: { x: 0, y: 0 } },
          { id: 'opt1', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
          { id: 'opt2', data: { label: 'Option B', kind: 'option' }, position: { x: 100, y: 100 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'f1', target: 'opt1', data: { confidence: 0.8 } as EdgeData },
          { id: 'e2', source: 'f1', target: 'opt2', data: { confidence: 0.6 } as EdgeData },
        ]

        const result = normalizeProbabilities('f1', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('decision')
      })

      it('fails for action nodes', () => {
        const nodes: Node[] = [
          { id: 'a1', data: { label: 'Action', kind: 'action' }, position: { x: 0, y: 0 } },
          { id: 'r1', data: { label: 'Risk', kind: 'risk' }, position: { x: 100, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'a1', target: 'r1', data: { confidence: 0.5 } as EdgeData },
        ]

        const result = normalizeProbabilities('a1', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('decision')
      })

      it('fails for option nodes', () => {
        const nodes: Node[] = [
          { id: 'opt1', data: { label: 'Option', kind: 'option' }, position: { x: 0, y: 0 } },
          { id: 'out1', data: { label: 'Outcome A', kind: 'outcome' }, position: { x: 100, y: 0 } },
          { id: 'out2', data: { label: 'Outcome B', kind: 'outcome' }, position: { x: 100, y: 100 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'opt1', target: 'out1', data: { confidence: 0.4 } as EdgeData },
          { id: 'e2', source: 'opt1', target: 'out2', data: { confidence: 0.3 } as EdgeData },
        ]

        const result = normalizeProbabilities('opt1', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('decision')
      })

      it('fails for nodes without kind property (legacy nodes)', () => {
        const nodes: Node[] = [
          { id: 'n1', data: { label: 'Legacy Node' }, position: { x: 0, y: 0 } }, // No kind
          { id: 'n2', data: { label: 'Target' }, position: { x: 100, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.5 } as EdgeData },
        ]

        const result = normalizeProbabilities('n1', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('decision')
      })

      it('fails for decision node with no option targets', () => {
        const nodes: Node[] = [
          { id: 'd1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'f1', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
          { id: 'f2', data: { label: 'Factor 2', kind: 'factor' }, position: { x: 100, y: 100 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'd1', target: 'f1', data: { confidence: 0.3 } as EdgeData },
          { id: 'e2', source: 'd1', target: 'f2', data: { confidence: 0.3 } as EdgeData },
        ]

        const result = normalizeProbabilities('d1', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('decision→option')
      })

      it('fails when node not found', () => {
        const nodes: Node[] = []
        const edges: Edge<EdgeData>[] = []

        const result = normalizeProbabilities('nonexistent', nodes, edges)

        expect(result.success).toBe(false)
        expect(result.message).toContain('not found')
      })
    })

    describe('immutability and object identity', () => {
      it('preserves object identity for untouched edges', () => {
        const nodes: Node[] = [
          { id: 'd1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'opt1', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
          { id: 'opt2', data: { label: 'Option B', kind: 'option' }, position: { x: 100, y: 100 } },
          { id: 'other', data: { label: 'Other', kind: 'factor' }, position: { x: 200, y: 0 } },
        ]
        const edge1 = { id: 'e1', source: 'd1', target: 'opt1', data: { confidence: 0.3 } as EdgeData }
        const edge2 = { id: 'e2', source: 'd1', target: 'opt2', data: { confidence: 0.7 } as EdgeData }
        const edge3 = { id: 'e3', source: 'other', target: 'd1', data: { confidence: 0.5 } as EdgeData }
        const edges: Edge<EdgeData>[] = [edge1, edge2, edge3]

        const result = normalizeProbabilities('d1', nodes, edges)

        expect(result.success).toBe(true)
        expect(result.updatedEdges).toBeDefined()

        // Untouched edge should be same reference
        const updatedE3 = result.updatedEdges!.find(e => e.id === 'e3')
        expect(updatedE3).toBe(edge3) // Same reference

        // Modified edges should be new objects
        const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
        const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')
        expect(updatedE1).not.toBe(edge1) // New object
        expect(updatedE2).not.toBe(edge2) // New object
      })

      it('creates new array when changes are made', () => {
        const nodes: Node[] = [
          { id: 'd1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'opt1', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          { id: 'e1', source: 'd1', target: 'opt1', data: { confidence: 0.5 } as EdgeData },
        ]

        const result = normalizeProbabilities('d1', nodes, edges)

        expect(result.success).toBe(true)
        expect(result.updatedEdges).not.toBe(edges) // New array
      })

      it('does not modify other edge properties', () => {
        const nodes: Node[] = [
          { id: 'd1', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
          { id: 'opt1', data: { label: 'Option A', kind: 'option' }, position: { x: 100, y: 0 } },
        ]
        const edges: Edge<EdgeData>[] = [
          {
            id: 'e1',
            source: 'd1',
            target: 'opt1',
            type: 'styled',
            data: {
              confidence: 0.5,
              belief: 0.8,
              provenance: 'template',
              kind: 'decision-probability',
            } as EdgeData,
          },
        ]

        const result = normalizeProbabilities('d1', nodes, edges)

        expect(result.success).toBe(true)
        const updatedE1 = result.updatedEdges![0]

        // Only confidence should change
        expect((updatedE1.data as EdgeData).confidence).toBe(1.0)
        // Other properties unchanged
        expect((updatedE1.data as EdgeData).belief).toBe(0.8)
        expect((updatedE1.data as EdgeData).provenance).toBe('template')
        expect((updatedE1.data as EdgeData).kind).toBe('decision-probability')
        expect(updatedE1.type).toBe('styled')
      })
    })
  })

  describe('addRiskNode', () => {
    it('adds a risk node connected to the goal', () => {
      const nodes: Node[] = [
        { id: 'goal-1', type: 'goal', data: { label: 'My Goal' }, position: { x: 100, y: 100 } },
      ]
      const edges: Edge<EdgeData>[] = []

      const result = addRiskNode('goal-1', nodes, edges)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Risk node')
      expect(result.updatedNodes).toHaveLength(2)
      expect(result.updatedEdges).toHaveLength(1)

      const newRisk = result.updatedNodes!.find(n => n.type === 'risk')
      expect(newRisk).toBeDefined()
      expect(newRisk!.data.label).toBe('New Risk')

      const newEdge = result.updatedEdges![0]
      expect(newEdge.source).toBe(newRisk!.id)
      expect(newEdge.target).toBe('goal-1')
    })

    it('fails when goal node not found', () => {
      const nodes: Node[] = []
      const edges: Edge<EdgeData>[] = []

      const result = addRiskNode('nonexistent', nodes, edges)

      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  describe('addFactorNode', () => {
    it('adds a factor node connected to the target', () => {
      const nodes: Node[] = [
        { id: 'decision-1', type: 'decision', data: { label: 'My Decision' }, position: { x: 200, y: 200 } },
      ]
      const edges: Edge<EdgeData>[] = []

      const result = addFactorNode('decision-1', nodes, edges)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Factor node')

      const newFactor = result.updatedNodes!.find(n => n.type === 'factor')
      expect(newFactor).toBeDefined()
      expect(newFactor!.data.label).toBe('New Factor')
    })
  })

  describe('connectOrphanNode', () => {
    it('connects an orphan to the nearest goal/decision', () => {
      const nodes: Node[] = [
        { id: 'orphan-1', type: 'factor', data: { label: 'Orphan' }, position: { x: 100, y: 100 } },
        { id: 'goal-1', type: 'goal', data: { label: 'Goal' }, position: { x: 150, y: 150 } }, // closer
        { id: 'goal-2', type: 'goal', data: { label: 'Far Goal' }, position: { x: 500, y: 500 } },
      ]
      const edges: Edge<EdgeData>[] = []

      const result = connectOrphanNode('orphan-1', nodes, edges)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Goal')
      expect(result.updatedEdges).toHaveLength(1)
      expect(result.updatedEdges![0].target).toBe('goal-1')
    })

    it('fails when no target nodes available', () => {
      const nodes: Node[] = [
        { id: 'orphan-1', type: 'factor', data: { label: 'Orphan' }, position: { x: 100, y: 100 } },
      ]
      const edges: Edge<EdgeData>[] = []

      const result = connectOrphanNode('orphan-1', nodes, edges)

      expect(result.success).toBe(false)
      expect(result.message).toContain('No target')
    })
  })

  describe('determineFixType', () => {
    it('maps PROBABILITY codes to normalize_probabilities', () => {
      expect(determineFixType('PROBABILITY_SUM')).toBe('normalize_probabilities')
      expect(determineFixType('BELIEF_TOTAL')).toBe('normalize_probabilities')
    })

    it('maps ORPHAN codes to connect_orphan', () => {
      expect(determineFixType('ORPHAN_NODE')).toBe('connect_orphan')
      expect(determineFixType('UNCONNECTED')).toBe('connect_orphan')
      expect(determineFixType('DANGLING_NODE')).toBe('connect_orphan')
    })

    it('maps RISK codes to add_risk', () => {
      expect(determineFixType('NO_RISK')).toBe('add_risk')
      expect(determineFixType('MISSING_RISK')).toBe('add_risk')
    })

    it('maps FACTOR codes to add_factor', () => {
      expect(determineFixType('NO_FACTOR')).toBe('add_factor')
      expect(determineFixType('MISSING_FACTOR')).toBe('add_factor')
    })

    it('returns null for unknown codes', () => {
      expect(determineFixType('UNKNOWN_CODE')).toBeNull()
    })
  })

  describe('executeAutoFix', () => {
    it('dispatches to correct fixer based on fixType', () => {
      const nodes: Node[] = [
        { id: 'd1', type: 'decision', data: { label: 'Decision', kind: 'decision' }, position: { x: 100, y: 100 } },
        { id: 'opt1', type: 'option', data: { label: 'Option A', kind: 'option' }, position: { x: 200, y: 50 } },
        { id: 'opt2', type: 'option', data: { label: 'Option B', kind: 'option' }, position: { x: 200, y: 150 } },
      ]
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'd1', target: 'opt1', data: { confidence: 0.4 } as EdgeData },
        { id: 'e2', source: 'd1', target: 'opt2', data: { confidence: 0.8 } as EdgeData },
      ]

      const result = executeAutoFix(
        { fixType: 'normalize_probabilities', nodeId: 'd1' },
        nodes,
        edges
      )

      expect(result.success).toBe(true)
      expect(result.updatedEdges).toBeDefined()

      // Verify normalization occurred
      const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
      const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')
      expect((updatedE1!.data as EdgeData).confidence).toBeCloseTo(0.333, 2)
      expect((updatedE2!.data as EdgeData).confidence).toBeCloseTo(0.667, 2)
    })

    it('fails gracefully for missing parameters', () => {
      const result = executeAutoFix(
        { fixType: 'normalize_probabilities' },
        [],
        []
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('required')
    })

    it('fails when called on non-decision node', () => {
      const nodes: Node[] = [
        { id: 'f1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 100 } },
        { id: 'opt1', type: 'option', data: { label: 'Option', kind: 'option' }, position: { x: 200, y: 100 } },
      ]
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'f1', target: 'opt1', data: { confidence: 0.5 } as EdgeData },
      ]

      const result = executeAutoFix(
        { fixType: 'normalize_probabilities', nodeId: 'f1' },
        nodes,
        edges
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('decision')
    })
  })
})
