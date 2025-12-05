/**
 * Unit tests for autoFix utility functions
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
  describe('normalizeProbabilities', () => {
    it('normalizes outgoing edge confidence (branch probability) to sum to 1', () => {
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.3 } as EdgeData },
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.6 } as EdgeData },
        { id: 'e3', source: 'n2', target: 'n4', data: { confidence: 0.5 } as EdgeData }, // different source
      ]

      const result = normalizeProbabilities('n1', edges)

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
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0 } as EdgeData },
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0 } as EdgeData },
      ]

      const result = normalizeProbabilities('n1', edges)

      expect(result.success).toBe(true)
      expect(result.message).toContain('evenly')

      const updatedE1 = result.updatedEdges!.find(e => e.id === 'e1')
      const updatedE2 = result.updatedEdges!.find(e => e.id === 'e2')

      expect((updatedE1!.data as EdgeData).confidence).toBe(0.5)
      expect((updatedE2!.data as EdgeData).confidence).toBe(0.5)
    })

    it('fails when no outgoing edges exist', () => {
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'n2', target: 'n1', data: { confidence: 0.5 } as EdgeData },
      ]

      const result = normalizeProbabilities('n1', edges)

      expect(result.success).toBe(false)
      expect(result.message).toContain('No outgoing')
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
        { id: 'goal-1', type: 'goal', data: { label: 'Goal' }, position: { x: 100, y: 100 } },
      ]
      const edges: Edge<EdgeData>[] = [
        { id: 'e1', source: 'goal-1', target: 'n2', data: { confidence: 0.4 } as EdgeData },
        { id: 'e2', source: 'goal-1', target: 'n3', data: { confidence: 0.8 } as EdgeData },
      ]

      const result = executeAutoFix(
        { fixType: 'normalize_probabilities', nodeId: 'goal-1' },
        nodes,
        edges
      )

      expect(result.success).toBe(true)
      expect(result.updatedEdges).toBeDefined()
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
  })
})
