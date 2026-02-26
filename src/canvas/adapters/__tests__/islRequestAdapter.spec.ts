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
  buildISLConformalRequest,
  computeSignedMean,
  computeDefaultStd,
  transformEdgesToISLv2,
  extractParameterUncertainties,
  extractValueFromProvenance,
  transformNodesToISLGraph,
  extractISLOptions,
} from '../islRequestAdapter'
import { STD_FLOOR } from '../../../adapters/plot/v2/types'
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
      // std = max(STD_FLOOR, 0.13 * 0.8) = max(0.001, 0.104) = 0.104
      const result = computeDefaultStd({ weight: 0.8, beliefExists: 0.9 })
      expect(result).toBeCloseTo(0.104, 2)
    })

    it('falls back to confidence for belief', () => {
      const result = computeDefaultStd({ weight: 0.8, confidence: 0.9 })
      expect(result).toBeCloseTo(0.104, 2)
    })

    it('uses STD_FLOOR, not hardcoded 0.05', () => {
      // cv = 0.3 * (1 - 1.0) + 0.1 = 0.1
      // std = max(STD_FLOOR, 0.1 * 0.1) = max(0.001, 0.01) = 0.01
      // PLoT applies its own internal floor of 0.05; UI's job is to prevent literal zero
      const result = computeDefaultStd({ weight: 0.1, beliefExists: 1.0 })
      expect(result).toBeCloseTo(0.01, 5)
      expect(result).toBeGreaterThan(STD_FLOOR)  // above STD_FLOOR
      expect(result).toBeLessThan(0.05)           // below old hardcoded floor
    })

    it('defaults belief to 0.8 (DEFAULT_EXISTS_PROBABILITY) when no belief fields provided', () => {
      // cv = 0.3 * (1 - 0.8) + 0.1 = 0.16
      // std = max(STD_FLOOR, 0.16 * 0.5) = max(0.001, 0.08) = 0.08
      const result = computeDefaultStd({ weight: 0.5 })
      expect(result).toBeCloseTo(0.08, 2)
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

    it('ISL adapter: edge with no belief fields omits exists_probability', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.6,
          direction: 'positive',
          // No beliefExists, confidence, or belief
        }
      }]

      const result = transformEdgesToISLv2(edges)

      // Field omitted — ISL defaults to 0.8 internally
      expect(result[0]).not.toHaveProperty('exists_probability')
    })

    it('ISL adapter: edge with explicit beliefExists forwards the value', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.6,
          direction: 'positive',
          beliefExists: 0.7,
        }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0].exists_probability).toBe(0.7)
    })

    it('ISL adapter: edge with confidence (no beliefExists) forwards via fallback chain', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.6,
          direction: 'positive',
          confidence: 0.65,
        }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0].exists_probability).toBe(0.65)
    })

    it('ISL adapter: edge with belief (no beliefExists/confidence) forwards via fallback chain', () => {
      const edges: UIEdge[] = [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: {
          weight: 0.6,
          direction: 'positive',
          belief: 0.55,
        }
      }]

      const result = transformEdgesToISLv2(edges)

      expect(result[0].exists_probability).toBe(0.55)
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

      // Minimum floor aligned with V2 adapter STD_FLOOR
      expect(result.factor.std).toBe(STD_FLOOR)
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

  // P0 Fix: Tests for intervention node ID validation
  describe('extractISLOptions', () => {
    it('returns baseline option when no option nodes exist', () => {
      const nodes: UINode[] = [
        { id: 'factor1', type: 'factor', data: { label: 'Factor 1' } },
      ]

      const result = extractISLOptions(nodes)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'baseline',
        label: 'Baseline',
        interventions: {},
        is_baseline: true,
      })
    })

    it('extracts options from option nodes', () => {
      const nodes: UINode[] = [
        { id: 'factor1', type: 'factor', data: { label: 'Factor 1' } },
        { id: 'option1', type: 'option', data: { label: 'Option A', value: 0.8 } },
        { id: 'option2', type: 'option', data: { label: 'Option B', value: 0.5 } },
      ]

      const result = extractISLOptions(nodes)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('option1')
      expect(result[0].label).toBe('Option A')
      expect(result[0].is_baseline).toBe(true)
      expect(result[1].is_baseline).toBe(false)
    })

    it('filters stale intervention keys that reference deleted nodes', () => {
      const nodes: UINode[] = [
        { id: 'factor1', type: 'factor', data: { label: 'Current Factor' } },
        {
          id: 'option1',
          type: 'option',
          data: {
            label: 'Option A',
            interventions: {
              'factor1': 0.8,        // Valid - node exists
              'deleted_node': 0.5,   // Invalid - node was deleted
              'another_deleted': 0.3 // Invalid - node was deleted
            }
          }
        },
      ]

      const result = extractISLOptions(nodes)

      expect(result).toHaveLength(1)
      // Should only include the valid intervention
      expect(result[0].interventions).toEqual({ 'factor1': 0.8 })
      // Stale keys should be filtered out
      expect(result[0].interventions).not.toHaveProperty('deleted_node')
      expect(result[0].interventions).not.toHaveProperty('another_deleted')
    })

    it('keeps all interventions when all node IDs are valid', () => {
      const nodes: UINode[] = [
        { id: 'factor1', type: 'factor', data: { label: 'Factor 1' } },
        { id: 'factor2', type: 'factor', data: { label: 'Factor 2' } },
        {
          id: 'option1',
          type: 'option',
          data: {
            label: 'Option A',
            interventions: {
              'factor1': 0.8,
              'factor2': 0.6
            }
          }
        },
      ]

      const result = extractISLOptions(nodes)

      expect(result[0].interventions).toEqual({
        'factor1': 0.8,
        'factor2': 0.6
      })
    })

    it('falls back to node value when no explicit interventions', () => {
      const nodes: UINode[] = [
        { id: 'option1', type: 'option', data: { label: 'Option A', value: 0.75 } },
      ]

      const result = extractISLOptions(nodes)

      expect(result[0].interventions).toEqual({ 'option1': 0.75 })
    })

    it('returns empty interventions when all are stale', () => {
      const nodes: UINode[] = [
        { id: 'factor1', type: 'factor', data: { label: 'Factor 1' } },
        {
          id: 'option1',
          type: 'option',
          data: {
            label: 'Option A',
            interventions: {
              'deleted1': 0.8,
              'deleted2': 0.5
            }
          }
        },
      ]

      const result = extractISLOptions(nodes)

      // All intervention keys were stale, so interventions should be empty
      expect(result[0].interventions).toEqual({})
    })
  })

  // P0 Fix: Tests for option node filtering in conformal requests
  describe('buildISLConformalRequest', () => {
    it('filters option nodes from variables array', () => {
      const nodes: UINode[] = [
        { id: 'fac_price', type: 'factor', data: { label: 'Price' } },
        { id: 'fac_demand', type: 'factor', data: { label: 'Demand' } },
        { id: 'opt_high', type: 'option', data: { label: 'High Price' } },
        { id: 'opt_low', type: 'option', data: { label: 'Low Price' } },
        { id: 'out_revenue', type: 'outcome', data: { label: 'Revenue' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'fac_price', target: 'out_revenue', data: { weight: 0.8 } },
        { id: 'e2', source: 'opt_high', target: 'fac_price', data: { weight: 0.5 } },
      ]
      const intervention = { fac_price: 100, fac_demand: 50 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      // Variables should NOT include option nodes
      expect(result.model.variables).toContain('fac_price')
      expect(result.model.variables).toContain('fac_demand')
      expect(result.model.variables).toContain('out_revenue')
      expect(result.model.variables).not.toContain('opt_high')
      expect(result.model.variables).not.toContain('opt_low')
    })

    it('filters decision nodes from variables array', () => {
      const nodes: UINode[] = [
        { id: 'dec_pricing', type: 'decision', data: { label: 'Pricing Decision' } },
        { id: 'fac_price', type: 'factor', data: { label: 'Price' } },
        { id: 'goal_profit', type: 'goal', data: { label: 'Maximize Profit' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'fac_price', target: 'goal_profit', data: { weight: 0.7 } },
      ]
      const intervention = { fac_price: 100 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      expect(result.model.variables).not.toContain('dec_pricing')
      expect(result.model.variables).toContain('fac_price')
      expect(result.model.variables).toContain('goal_profit')
    })

    it('filters edges where source is an option/decision node', () => {
      const nodes: UINode[] = [
        { id: 'opt_a', type: 'option', data: { label: 'Option A' } },
        { id: 'fac_x', type: 'factor', data: { label: 'Factor X' } },
        { id: 'out_y', type: 'outcome', data: { label: 'Outcome Y' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'opt_a', target: 'fac_x', data: { weight: 0.5 } }, // Should be filtered
        { id: 'e2', source: 'fac_x', target: 'out_y', data: { weight: 0.8 } }, // Should remain
      ]
      const intervention = { fac_x: 10 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      // Equation for fac_x should NOT reference opt_a
      expect(result.model.equations.fac_x).toBeUndefined()
      // Equation for out_y should reference fac_x
      expect(result.model.equations.out_y).toBe('0.8*fac_x')
    })

    it('filters edges where target is an option/decision node', () => {
      const nodes: UINode[] = [
        { id: 'dec_main', type: 'decision', data: { label: 'Main Decision' } },
        { id: 'opt_a', type: 'option', data: { label: 'Option A' } },
        { id: 'fac_x', type: 'factor', data: { label: 'Factor X' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'dec_main', target: 'opt_a', data: { weight: 0.5 } }, // Should be filtered
        { id: 'e2', source: 'fac_x', target: 'dec_main', data: { weight: 0.3 } }, // Should be filtered
      ]
      const intervention = { fac_x: 10 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      // No equations should reference option or decision nodes
      expect(result.model.equations.opt_a).toBeUndefined()
      expect(result.model.equations.dec_main).toBeUndefined()
    })

    it('handles nodes with kind in data property', () => {
      // Some graph formats use data.kind instead of node.type
      const nodes: UINode[] = [
        { id: 'fac_price', data: { kind: 'factor', label: 'Price' } },
        { id: 'opt_high', data: { kind: 'option', label: 'High Price' } },
        { id: 'out_revenue', data: { kind: 'outcome', label: 'Revenue' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'fac_price', target: 'out_revenue', data: { weight: 0.8 } },
        { id: 'e2', source: 'opt_high', target: 'fac_price', data: { weight: 0.5 } },
      ]
      const intervention = { fac_price: 100 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      expect(result.model.variables).toContain('fac_price')
      expect(result.model.variables).toContain('out_revenue')
      expect(result.model.variables).not.toContain('opt_high')
    })

    it('preserves intervention even though it only targets factors', () => {
      const nodes: UINode[] = [
        { id: 'fac_price', type: 'factor', data: { label: 'Price' } },
        { id: 'opt_high', type: 'option', data: { label: 'High Price' } },
      ]
      const edges: UIEdge[] = []
      const intervention = { fac_price: 100 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      // Intervention should be passed through unchanged
      expect(result.intervention).toEqual({ fac_price: 100 })
    })

    it('includes proper model structure with distributions', () => {
      const nodes: UINode[] = [
        { id: 'fac_a', type: 'factor', data: { label: 'Factor A' } },
      ]
      const edges: UIEdge[] = []
      const intervention = { fac_a: 50 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      expect(result.model.distributions).toEqual({
        noise: { type: 'normal', parameters: { mean: 0, std: 0.1 } }
      })
      expect(result.confidence_level).toBe(0.95)
      expect(result.calibration_data).toEqual([])
    })

    it('handles graph with no option/decision nodes (no filtering needed)', () => {
      const nodes: UINode[] = [
        { id: 'fac_a', type: 'factor', data: { label: 'Factor A' } },
        { id: 'fac_b', type: 'factor', data: { label: 'Factor B' } },
        { id: 'out_c', type: 'outcome', data: { label: 'Outcome C' } },
      ]
      const edges: UIEdge[] = [
        { id: 'e1', source: 'fac_a', target: 'out_c', data: { weight: 0.6 } },
        { id: 'e2', source: 'fac_b', target: 'out_c', data: { weight: 0.4 } },
      ]
      const intervention = { fac_a: 10, fac_b: 20 }

      const result = buildISLConformalRequest(nodes, edges, intervention)

      expect(result.model.variables).toEqual(['fac_a', 'fac_b', 'out_c'])
      expect(result.model.equations.out_c).toBe('0.6*fac_a + 0.4*fac_b')
    })
  })
})
