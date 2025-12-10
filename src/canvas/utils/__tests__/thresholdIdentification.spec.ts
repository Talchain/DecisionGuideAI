/**
 * Threshold Identification Utility Tests
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { ISLConformalPrediction } from '../../../adapters/isl/types'
import {
  identifyEdgeFunctionThresholds,
  identifySensitivityThresholds,
  mergeThresholds,
  identifyThresholds,
  formatThresholdValue,
} from '../thresholdIdentification'

const mockNodes: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Marketing Spend' } },
  { id: 'n2', position: { x: 0, y: 0 }, data: { label: 'Market Share' } },
  { id: 'n3', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
]

describe('thresholdIdentification', () => {
  describe('identifyEdgeFunctionThresholds', () => {
    it('identifies threshold function edges', () => {
      const edges: Edge[] = [{
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          functionType: 'threshold',
          functionParams: { threshold: 0.7 },
        },
      }]

      const result = identifyEdgeFunctionThresholds(edges, mockNodes)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('edge_function')
      expect(result[0].thresholdValue).toBe(0.7)
      expect(result[0].label).toContain('Marketing Spend')
      expect(result[0].label).toContain('Market Share')
      expect(result[0].confidence).toBe('high')
      expect(result[0].impactMagnitude).toBe('high')
    })

    it('identifies s-curve function edges', () => {
      const edges: Edge[] = [{
        id: 'e2',
        source: 'n2',
        target: 'n3',
        data: {
          functionType: 's_curve',
          functionParams: { midpoint: 0.5, steepness: 10 },
        },
      }]

      const result = identifyEdgeFunctionThresholds(edges, mockNodes)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('edge_function')
      expect(result[0].thresholdValue).toBe(0.5)
      expect(result[0].description).toContain('S-curve')
      expect(result[0].confidence).toBe('high') // High steepness
    })

    it('returns empty for linear edges', () => {
      const edges: Edge[] = [{
        id: 'e3',
        source: 'n1',
        target: 'n2',
        data: { functionType: 'linear' },
      }]

      const result = identifyEdgeFunctionThresholds(edges, mockNodes)
      expect(result).toHaveLength(0)
    })

    it('handles edges without function type', () => {
      const edges: Edge[] = [{
        id: 'e4',
        source: 'n1',
        target: 'n2',
        data: {},
      }]

      const result = identifyEdgeFunctionThresholds(edges, mockNodes)
      expect(result).toHaveLength(0)
    })
  })

  describe('identifySensitivityThresholds', () => {
    it('identifies high-sensitivity nodes', () => {
      const predictions: ISLConformalPrediction[] = [{
        node_id: 'n1',
        predicted_value: 0.65,
        confidence_interval: { lower: 0.6, upper: 0.7 },
        calibration_quality: 'excellent',
      }]

      const result = identifySensitivityThresholds(predictions, mockNodes)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('sensitivity')
      expect(result[0].sourceId).toBe('n1')
      expect(result[0].confidence).toBe('high')
    })

    it('filters out wide confidence intervals', () => {
      const predictions: ISLConformalPrediction[] = [{
        node_id: 'n1',
        predicted_value: 0.5,
        confidence_interval: { lower: 0.2, upper: 0.8 },
        calibration_quality: 'poor',
      }]

      const result = identifySensitivityThresholds(predictions, mockNodes)
      expect(result).toHaveLength(0) // > 30% width
    })

    it('limits to top 3 most sensitive', () => {
      const predictions: ISLConformalPrediction[] = [
        { node_id: 'n1', predicted_value: 0.5, confidence_interval: { lower: 0.45, upper: 0.55 }, calibration_quality: 'excellent' },
        { node_id: 'n2', predicted_value: 0.6, confidence_interval: { lower: 0.55, upper: 0.65 }, calibration_quality: 'good' },
        { node_id: 'n3', predicted_value: 0.7, confidence_interval: { lower: 0.65, upper: 0.75 }, calibration_quality: 'fair' },
        { node_id: 'n4', predicted_value: 0.8, confidence_interval: { lower: 0.75, upper: 0.85 }, calibration_quality: 'fair' },
      ]

      const nodes = [
        ...mockNodes,
        { id: 'n4', position: { x: 0, y: 0 }, data: { label: 'Extra Node' } },
      ]

      const result = identifySensitivityThresholds(predictions, nodes)
      expect(result.length).toBeLessThanOrEqual(3)
    })
  })

  describe('mergeThresholds', () => {
    it('deduplicates by sourceId, keeping higher confidence', () => {
      const source1 = [{
        id: 't1',
        type: 'edge_function' as const,
        label: 'Test',
        description: 'Desc',
        thresholdValue: 0.5,
        belowEffect: 'Below',
        aboveEffect: 'Above',
        confidence: 'low' as const,
        sourceId: 'e1',
        sourceType: 'edge' as const,
        provenance: 'graph_analysis' as const,
      }]

      const source2 = [{
        ...source1[0],
        id: 't2',
        confidence: 'high' as const,
        sourceId: 'e1',
      }]

      const result = mergeThresholds(source1, source2)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe('high')
    })

    it('sorts by impact magnitude then confidence', () => {
      const thresholds = [
        {
          id: 't1',
          type: 'edge_function' as const,
          label: 'Low',
          description: '',
          thresholdValue: 0.5,
          belowEffect: '',
          aboveEffect: '',
          confidence: 'high' as const,
          impactMagnitude: 'low' as const,
          provenance: 'graph_analysis' as const,
        },
        {
          id: 't2',
          type: 'sensitivity' as const,
          label: 'High',
          description: '',
          thresholdValue: 0.7,
          belowEffect: '',
          aboveEffect: '',
          confidence: 'low' as const,
          impactMagnitude: 'high' as const,
          provenance: 'sensitivity_analysis' as const,
        },
      ]

      const result = mergeThresholds(thresholds)
      expect(result[0].label).toBe('High') // High impact first
    })
  })

  describe('identifyThresholds', () => {
    it('combines edge and sensitivity thresholds', () => {
      const edges: Edge[] = [{
        id: 'e1',
        source: 'n1',
        target: 'n2',
        data: {
          functionType: 'threshold',
          functionParams: { threshold: 0.6 },
        },
      }]

      const predictions: ISLConformalPrediction[] = [{
        node_id: 'n3',
        predicted_value: 0.7,
        confidence_interval: { lower: 0.65, upper: 0.75 },
        calibration_quality: 'good',
      }]

      const result = identifyThresholds(mockNodes, edges, predictions)

      expect(result.thresholds.length).toBeGreaterThanOrEqual(1)
      expect(result.summary).toContain('identified')
    })

    it('handles empty inputs gracefully', () => {
      const result = identifyThresholds([], [], [])
      expect(result.thresholds).toHaveLength(0)
      expect(result.summary).toBeTruthy()
    })
  })

  describe('formatThresholdValue', () => {
    it('formats percent values', () => {
      expect(formatThresholdValue(0.75, 'percent')).toBe('75%')
    })

    it('formats values <= 1 as percent by default', () => {
      expect(formatThresholdValue(0.5)).toBe('50%')
    })

    it('formats currency values', () => {
      const result = formatThresholdValue(1000, 'currency')
      expect(result).toContain('1,000')
    })

    it('formats count values', () => {
      expect(formatThresholdValue(1500, 'count')).toBe('1,500')
    })
  })
})
