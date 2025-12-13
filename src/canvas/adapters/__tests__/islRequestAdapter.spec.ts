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
} from '../islRequestAdapter'
import type {
  UIRobustnessRequest,
  UIFormRequest,
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
})
