import { describe, it, expect } from 'vitest'
import { validateOutgoingProbabilities, getOutgoingEdgesWithProbabilities } from '../../../src/canvas/utils/probabilityValidation'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../../../src/canvas/domain/edges'

describe('probabilityValidation', () => {
  const createEdge = (id: string, source: string, target: string, confidence?: number): Edge<EdgeData> => ({
    id,
    source,
    target,
    data: {
      weight: 1.0,
      style: 'solid' as const,
      curvature: 0.15,
      schemaVersion: 2,
      confidence
    }
  })

  describe('validateOutgoingProbabilities', () => {
    it('returns valid when probabilities sum to 1.0', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2', 0.6),
        createEdge('e2', 'n1', 'n3', 0.4)
      ]
      
      const result = validateOutgoingProbabilities('n1', edges)
      
      expect(result.valid).toBe(true)
      expect(result.sum).toBe(1.0)
      expect(result.message).toBeUndefined()
    })

    it('returns invalid when probabilities do not sum to 1.0', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2', 0.5),
        createEdge('e2', 'n1', 'n3', 0.3)
      ]
      
      const result = validateOutgoingProbabilities('n1', edges)
      
      expect(result.valid).toBe(false)
      expect(result.sum).toBe(0.8)
      expect(result.message).toContain('80%')
    })

    it('returns valid when no outgoing edges', () => {
      const edges = [
        createEdge('e1', 'n2', 'n3', 0.5)
      ]
      
      const result = validateOutgoingProbabilities('n1', edges)
      
      expect(result.valid).toBe(true)
      expect(result.sum).toBe(0)
    })

    it('returns valid when no probabilities set', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2'),
        createEdge('e2', 'n1', 'n3')
      ]
      
      const result = validateOutgoingProbabilities('n1', edges)
      
      expect(result.valid).toBe(true)
      expect(result.sum).toBe(0)
    })

    it('accepts probabilities within tolerance', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2', 0.6),
        createEdge('e2', 'n1', 'n3', 0.405) // 1.005 total
      ]
      
      const result = validateOutgoingProbabilities('n1', edges, 0.01)
      
      expect(result.valid).toBe(true)
    })

    it('rejects probabilities outside tolerance', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2', 0.6),
        createEdge('e2', 'n1', 'n3', 0.42) // 1.02 total
      ]
      
      const result = validateOutgoingProbabilities('n1', edges, 0.01)
      
      expect(result.valid).toBe(false)
    })
  })

  describe('getOutgoingEdgesWithProbabilities', () => {
    it('returns outgoing edges with probabilities', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2', 0.6),
        createEdge('e2', 'n1', 'n3', 0.4),
        createEdge('e3', 'n2', 'n4', 0.5)
      ]
      
      const result = getOutgoingEdgesWithProbabilities('n1', edges)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ edgeId: 'e1', targetId: 'n2', probability: 0.6 })
      expect(result[1]).toEqual({ edgeId: 'e2', targetId: 'n3', probability: 0.4 })
    })

    it('returns empty array when no outgoing edges', () => {
      const edges = [
        createEdge('e1', 'n2', 'n3', 0.5)
      ]
      
      const result = getOutgoingEdgesWithProbabilities('n1', edges)
      
      expect(result).toHaveLength(0)
    })

    it('handles edges without probabilities', () => {
      const edges = [
        createEdge('e1', 'n1', 'n2'),
        createEdge('e2', 'n1', 'n3')
      ]
      
      const result = getOutgoingEdgesWithProbabilities('n1', edges)
      
      expect(result).toHaveLength(2)
      expect(result[0].probability).toBe(0)
      expect(result[1].probability).toBe(0)
    })
  })
})
