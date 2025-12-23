/**
 * ISL Request Adapter Tests
 *
 * Brief 12.5: Tests for request schema transformation
 */

import { describe, it, expect } from 'vitest'
import {
  adaptRobustnessRequest,
  adaptFormRequest,
  buildRobustnessRequest,
  buildFormRequest,
  computeSignedMean,
  computeDefaultStd,
  transformEdgesToISLv2,
  extractParameterUncertainties,
  extractValueFromProvenance,
  transformNodesToISLGraph,
} from '../islRequestAdapter'
import type {
  UIRobustnessRequest,
  UIFormRequest,
  UINode,
  UIEdge,
} from '../islRequestAdapter'

describe('islRequestAdapter', () => {
  describe('adaptRobustnessRequest', () => {
    it('transforms UI request to ISL format with minimal options', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result).toEqual({
        run_id: 'run-123',
        include_sensitivity: true,
        include_voi: true,
        include_pareto: true,
      })
    })

    it('includes response hash when provided', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
        responseHash: 'hash-abc',
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result.response_hash).toBe('hash-abc')
    })

    it('respects include flags', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
        includeSensitivity: false,
        includeVoi: false,
        includePareto: false,
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result.include_sensitivity).toBe(false)
      expect(result.include_voi).toBe(false)
      expect(result.include_pareto).toBe(false)
    })

    it('includes graph context when provided', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
        graphContext: {
          nodes: [{ id: 'n1', label: 'Node 1', kind: 'factor' }],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', weight: 0.5 }],
        },
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result.graph).toEqual({
        nodes: [{ id: 'n1', label: 'Node 1', kind: 'factor' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', weight: 0.5 }],
      })
    })

    it('includes analysis options when provided', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
        analysisOptions: {
          sensitivityDepth: 'deep',
          voiThreshold: 0.1,
          paretoObjectives: ['profit', 'risk'],
        },
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result.options).toEqual({
        sensitivity_depth: 'deep',
        voi_threshold: 0.1,
        pareto_objectives: ['profit', 'risk'],
      })
    })

    it('only includes non-undefined analysis options', () => {
      const uiRequest: UIRobustnessRequest = {
        runId: 'run-123',
        analysisOptions: {
          sensitivityDepth: 'shallow',
          // voiThreshold and paretoObjectives not provided
        },
      }

      const result = adaptRobustnessRequest(uiRequest)

      expect(result.options).toEqual({
        sensitivity_depth: 'shallow',
      })
    })
  })

  describe('adaptFormRequest', () => {
    it('transforms UI form request to CEE format', () => {
      const uiRequest: UIFormRequest = {
        edges: [
          {
            edgeId: 'e1',
            sourceKind: 'factor',
            targetKind: 'outcome',
            currentForm: 'linear',
            context: {
              sourceLabel: 'Cost',
              targetLabel: 'Revenue',
            },
          },
          {
            edgeId: 'e2',
            sourceKind: 'risk',
            targetKind: 'outcome',
            currentForm: 'threshold',
            context: {
              sourceLabel: 'Market Risk',
              targetLabel: 'Success',
            },
          },
        ],
      }

      const result = adaptFormRequest(uiRequest)

      expect(result.edges).toHaveLength(2)
      expect(result.edges[0]).toEqual({
        edge_id: 'e1',
        source_kind: 'factor',
        target_kind: 'outcome',
        current_form: 'linear',
        context: {
          source_label: 'Cost',
          target_label: 'Revenue',
        },
      })
      expect(result.edges[1]).toEqual({
        edge_id: 'e2',
        source_kind: 'risk',
        target_kind: 'outcome',
        current_form: 'threshold',
        context: {
          source_label: 'Market Risk',
          target_label: 'Success',
        },
      })
    })

    it('handles empty edge array', () => {
      const uiRequest: UIFormRequest = { edges: [] }

      const result = adaptFormRequest(uiRequest)

      expect(result.edges).toEqual([])
    })
  })

  describe('buildRobustnessRequest', () => {
    it('builds ISL request from simple parameters', () => {
      const result = buildRobustnessRequest('run-456', 'hash-xyz')

      expect(result).toEqual({
        run_id: 'run-456',
        response_hash: 'hash-xyz',
        include_sensitivity: true,
        include_voi: true,
        include_pareto: true,
      })
    })

    it('handles missing response hash', () => {
      const result = buildRobustnessRequest('run-456')

      expect(result.run_id).toBe('run-456')
      expect(result.response_hash).toBeUndefined()
    })
  })

  describe('buildFormRequest', () => {
    it('builds CEE request from edges and nodes', () => {
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2', data: { functionType: 'linear' } },
        { id: 'e2', source: 'n2', target: 'n3', data: { functionType: 'threshold' } },
      ]
      const nodes = [
        { id: 'n1', type: 'factor', data: { label: 'Cost' } },
        { id: 'n2', type: 'outcome', data: { label: 'Revenue' } },
        { id: 'n3', type: 'goal', data: { label: 'Profit' } },
      ]

      const result = buildFormRequest(edges, nodes)

      expect(result.edges).toHaveLength(2)
      expect(result.edges[0]).toEqual({
        edge_id: 'e1',
        source_kind: 'factor',
        target_kind: 'outcome',
        current_form: 'linear',
        context: {
          source_label: 'Cost',
          target_label: 'Revenue',
        },
      })
      expect(result.edges[1]).toEqual({
        edge_id: 'e2',
        source_kind: 'outcome',
        target_kind: 'goal',
        current_form: 'threshold',
        context: {
          source_label: 'Revenue',
          target_label: 'Profit',
        },
      })
    })

    it('provides defaults for missing node data', () => {
      const edges = [{ id: 'e1', source: 'n1', target: 'n2' }]
      const nodes = [
        { id: 'n1' }, // No type or data
        { id: 'n2', type: 'outcome' }, // No data
      ]

      const result = buildFormRequest(edges, nodes)

      expect(result.edges[0]).toEqual({
        edge_id: 'e1',
        source_kind: 'unknown',
        target_kind: 'outcome',
        current_form: 'linear',
        context: {
          source_label: 'n1', // Falls back to node ID
          target_label: 'n2',
        },
      })
    })

    it('handles missing nodes gracefully', () => {
      const edges = [{ id: 'e1', source: 'n1', target: 'n2' }]
      const nodes: any[] = [] // No nodes

      const result = buildFormRequest(edges, nodes)

      expect(result.edges[0].source_kind).toBe('unknown')
      expect(result.edges[0].target_kind).toBe('unknown')
      expect(result.edges[0].context.source_label).toBe('Unknown')
      expect(result.edges[0].context.target_label).toBe('Unknown')
    })
  })

  // Integration fix: Tests for node type→kind and description→body mapping
  describe('transformNodesToISLGraph', () => {
    it('should map node type to kind for ISL', () => {
      const nodes: UINode[] = [{ id: 'price', type: 'factor', data: { label: 'Price' } }]
      const islNodes = transformNodesToISLGraph(nodes)

      expect(islNodes[0].kind).toBe('factor')
      expect(islNodes[0]).not.toHaveProperty('type')
    })

    it('should map node description to body for ISL', () => {
      const nodes: UINode[] = [{
        id: 'price',
        type: 'factor',
        data: { label: 'Price', description: 'Current price point' }
      }]
      const islNodes = transformNodesToISLGraph(nodes)

      expect(islNodes[0].body).toBe('Current price point')
      expect(islNodes[0]).not.toHaveProperty('description')
    })

    it('should handle missing description gracefully', () => {
      const nodes: UINode[] = [{
        id: 'price',
        type: 'factor',
        data: { label: 'Price' }
      }]
      const islNodes = transformNodesToISLGraph(nodes)

      expect(islNodes[0].body).toBeUndefined()
    })

    it('should use node id as label fallback', () => {
      const nodes: UINode[] = [{ id: 'price_factor', type: 'factor' }]
      const islNodes = transformNodesToISLGraph(nodes)

      expect(islNodes[0].label).toBe('price_factor')
    })

    it('should default kind to factor when type is missing', () => {
      const nodes: UINode[] = [{ id: 'node1', data: { label: 'Unknown' } }]
      const islNodes = transformNodesToISLGraph(nodes)

      expect(islNodes[0].kind).toBe('factor')
    })

    it('should map all standard node types to kinds', () => {
      const types = ['factor', 'option', 'decision', 'outcome', 'goal', 'risk']
      for (const type of types) {
        const nodes: UINode[] = [{ id: 'n1', type, data: { label: 'Test' } }]
        const islNodes = transformNodesToISLGraph(nodes)
        expect(islNodes[0].kind).toBe(type)
      }
    })
  })

  // Brief v2.2: Tests for v2 transformation functions
  describe('computeSignedMean', () => {
    it('returns positive for positive direction', () => {
      const result = computeSignedMean({ weight: 0.8, direction: 'positive' })
      expect(result).toBe(0.8)
    })

    it('returns negative for negative direction', () => {
      const result = computeSignedMean({ weight: 0.8, direction: 'negative' })
      expect(result).toBe(-0.8)
    })

    it('defaults to positive if direction is missing', () => {
      const result = computeSignedMean({ weight: 0.6 })
      expect(result).toBe(0.6)
    })

    it('defaults weight to 0.5 if missing', () => {
      const result = computeSignedMean({ direction: 'negative' })
      expect(result).toBe(-0.5)
    })

    it('handles undefined data', () => {
      const result = computeSignedMean(undefined)
      expect(result).toBe(0.5)
    })
  })

  describe('computeDefaultStd', () => {
    it('computes std from belief', () => {
      // cv = 0.3 * (1 - 0.9) + 0.1 = 0.13
      // std = max(0.05, 0.13 * 0.8) = max(0.05, 0.104) = 0.104
      const result = computeDefaultStd({ weight: 0.8, beliefExists: 0.9 })
      expect(result).toBeCloseTo(0.104, 2)
    })

    it('falls back to confidence for belief', () => {
      const result = computeDefaultStd({ weight: 0.8, confidence: 0.9 })
      expect(result).toBeCloseTo(0.104, 2)
    })

    it('uses minimum floor of 0.05', () => {
      // cv = 0.3 * (1 - 1.0) + 0.1 = 0.1
      // std = max(0.05, 0.1 * 0.1) = max(0.05, 0.01) = 0.05
      const result = computeDefaultStd({ weight: 0.1, beliefExists: 1.0 })
      expect(result).toBe(0.05)
    })
  })

  describe('transformEdgesToISLv2', () => {
    it('transforms edges with all v2 fields', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'price',
        target: 'demand',
        data: {
          weight: 0.8,
          direction: 'negative',
          beliefExists: 0.9,
          strengthStd: 0.15
        }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0]).toEqual({
        from: 'price',
        to: 'demand',
        exists_probability: 0.9,
        strength: {
          mean: -0.8,
          std: 0.15
        }
      })
    })

    it('computes default std when not provided', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.6,
          direction: 'positive',
          beliefExists: 0.8
          // No strengthStd
        }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0].exists_probability).toBe(0.8)
      expect(result[0].strength.mean).toBe(0.6)
      expect(result[0].strength.std).toBeGreaterThan(0)
    })

    it('handles missing direction (defaults to positive)', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { weight: 0.7 }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0].strength.mean).toBe(0.7)
    })
  })

  describe('extractParameterUncertainties with observedState', () => {
    it('extracts from observedState', () => {
      const nodes: UINode[] = [{
        id: 'price',
        type: 'factor',
        data: {
          label: 'Price',
          observedState: { value: 59, baseline: 49, unit: '£' }
        }
      }]

      const result = extractParameterUncertainties(nodes)

      expect(result.price).toBeDefined()
      expect(result.price.mean).toBe(59)
      // std = delta * 0.25 = 10 * 0.25 = 2.5
      expect(result.price.std).toBeCloseTo(2.5, 1)
    })

    it('uses 1% of value when no baseline (Issue 2 fix)', () => {
      const nodes: UINode[] = [{
        id: 'factor',
        type: 'factor',
        data: {
          label: 'Factor',
          observedState: { value: 100 }
        }
      }]

      const result = extractParameterUncertainties(nodes)

      // Issue 2 fix: When value === baseline (no baseline provided), use 1% floor
      // std = max(0.01, value * 0.01) = max(0.01, 1) = 1
      expect(result.factor.std).toBeCloseTo(1, 1)
    })

    it('handles minimum std floor', () => {
      const nodes: UINode[] = [{
        id: 'factor',
        type: 'factor',
        data: {
          label: 'Factor',
          observedState: { value: 0.001 }
        }
      }]

      const result = extractParameterUncertainties(nodes)

      // Minimum floor is 0.01
      expect(result.factor.std).toBe(0.01)
    })

    it('prioritizes observedState over value field', () => {
      const nodes: UINode[] = [{
        id: 'factor',
        type: 'factor',
        data: {
          label: 'Factor',
          value: 100,
          observedState: { value: 50, baseline: 40 }
        }
      }]

      const result = extractParameterUncertainties(nodes)

      // Should use observedState, not value
      expect(result.factor.mean).toBe(50)
    })
  })

  describe('extractValueFromProvenance', () => {
    it('extracts currency values with £ symbol', () => {
      expect(extractValueFromProvenance('Current price is £49')).toBe(49)
      expect(extractValueFromProvenance('hypothesis • New price £59')).toBe(59)
    })

    it('extracts currency values with k/M suffix', () => {
      expect(extractValueFromProvenance('MRR is £15k')).toBe(15000)
      expect(extractValueFromProvenance('Revenue £1.5M')).toBe(1500000)
    })

    it('extracts currency values with $ symbol', () => {
      expect(extractValueFromProvenance('Price $100')).toBe(100)
      expect(extractValueFromProvenance('ARR $2.5M')).toBe(2500000)
    })

    it('extracts percentage values as decimals', () => {
      expect(extractValueFromProvenance('Churn rate 4%')).toBe(0.04)
      expect(extractValueFromProvenance('Growth 20%')).toBe(0.2)
      expect(extractValueFromProvenance('Rate is 0.5%')).toBe(0.005)
    })

    it('extracts numbers with k/M suffix (no currency)', () => {
      expect(extractValueFromProvenance('Users 15k')).toBe(15000)
      expect(extractValueFromProvenance('DAU 1.5M')).toBe(1500000)
    })

    it('extracts from "is X" patterns', () => {
      expect(extractValueFromProvenance('Current value is 49')).toBe(49)
      expect(extractValueFromProvenance('Factor = 100')).toBe(100)
    })

    it('returns null for invalid input', () => {
      expect(extractValueFromProvenance('')).toBeNull()
      expect(extractValueFromProvenance('No numbers here')).toBeNull()
      expect(extractValueFromProvenance(null as any)).toBeNull()
      expect(extractValueFromProvenance(undefined as any)).toBeNull()
    })

    it('handles comma-separated numbers', () => {
      expect(extractValueFromProvenance('Revenue £15,000')).toBe(15000)
      expect(extractValueFromProvenance('Value $1,500,000')).toBe(1500000)
    })
  })

  describe('extractParameterUncertainties with provenance fallback', () => {
    it('extracts from provenance when no other value exists', () => {
      const nodes = [{
        id: 'price',
        type: 'factor',
        data: {
          label: 'Current Price',
          provenance: 'hypothesis • Current price is £49'
        }
      }]

      const result = extractParameterUncertainties(nodes as any)

      expect(result.price).toBeDefined()
      expect(result.price.mean).toBe(49)
      expect(result.price.std).toBeCloseTo(9.8, 1) // 20% of 49
    })

    it('extracts from label when no other source', () => {
      const nodes = [{
        id: 'mrr',
        type: 'factor',
        data: {
          label: 'Current MRR (£15k)'
        }
      }]

      const result = extractParameterUncertainties(nodes as any)

      expect(result.mrr).toBeDefined()
      expect(result.mrr.mean).toBe(15000)
    })

    it('prioritizes observedState over provenance', () => {
      const nodes = [{
        id: 'price',
        type: 'factor',
        data: {
          label: 'Current Price',
          observedState: { value: 59, baseline: 49 },
          provenance: 'hypothesis • Current price is £49'
        }
      }]

      const result = extractParameterUncertainties(nodes as any)

      // Should use observedState value (59), not provenance value (49)
      expect(result.price.mean).toBe(59)
    })
  })
})
