/**
 * Tests for ceeAnalysisReady validation logic
 * Ensures restored analysis_ready payloads are compatible with current graph state
 */

import { describe, it, expect } from 'vitest'
import { validateCeeAnalysisReady } from '../ceeAnalysisReadyValidation'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import type { Node } from '@xyflow/react'

describe('validateCeeAnalysisReady', () => {
  const createNode = (id: string): Node => ({
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: id },
  })

  const createValidPayload = (): CEEAnalysisReady => ({
    status: 'analysis_ready',
    goal_node_id: 'goal1',
    options: [
      {
        id: 'opt1',
        label: 'Option 1',
        status: 'ready',
        interventions: { factor1: 1 },
      },
      {
        id: 'opt2',
        label: 'Option 2',
        status: 'ready',
        interventions: { factor1: 0 },
      },
    ],
  })

  describe('valid payload', () => {
    it('accepts valid payload with all nodes present', () => {
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2'), createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('accepts payload with node additions (no removals)', () => {
      const nodes = [
        createNode('goal1'),
        createNode('opt1'),
        createNode('opt2'),
        createNode('factor1'),
        createNode('new_node1'), // Added node
        createNode('new_node2'), // Added node
      ]
      const payload = createValidPayload()
      const nodeIds = ['goal1', 'opt1', 'opt2', 'factor1']

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      expect(result.isValid).toBe(true)
    })

    it('accepts payload with minor node removals (<30%)', () => {
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2'), createNode('factor1')]
      const nodeIds = ['goal1', 'opt1', 'opt2', 'factor1', 'removed1'] // 1/5 = 20% removed
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      expect(result.isValid).toBe(true)
    })
  })

  describe('empty/null payload', () => {
    it('rejects null payload', () => {
      const nodes = [createNode('goal1')]

      const result = validateCeeAnalysisReady(null, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('empty_options')
    })

    it('rejects payload with empty options array', () => {
      const nodes = [createNode('goal1')]
      const payload = { ...createValidPayload(), options: [] }

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('empty_options')
    })

    it('rejects payload with undefined options', () => {
      const nodes = [createNode('goal1')]
      const payload = { ...createValidPayload(), options: undefined as any }

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('empty_options')
    })
  })

  describe('missing goal node', () => {
    it('rejects when goal node does not exist', () => {
      const nodes = [createNode('opt1'), createNode('opt2'), createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_goal')
      expect(result.details).toContain('goal1')
    })
  })

  describe('missing option nodes', () => {
    it('rejects when first option node is missing', () => {
      const nodes = [createNode('goal1'), createNode('opt2'), createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_option_nodes')
      expect(result.details).toContain('opt1')
    })

    it('rejects when second option node is missing', () => {
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_option_nodes')
      expect(result.details).toContain('opt2')
    })

    it('rejects when all option nodes are missing', () => {
      const nodes = [createNode('goal1'), createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_option_nodes')
    })
  })

  describe('structural change detection', () => {
    it('rejects when exactly 30% of nodes removed (boundary)', () => {
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2')]
      // 3 remain, 2 removed from original 5 → 2/5 = 40% removed (should fail)
      const nodeIds = ['goal1', 'opt1', 'opt2', 'removed1', 'removed2']
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('node_ids_changed')
      expect(result.details).toContain('2 nodes removed')
      expect(result.details).toContain('40%')
    })

    it('rejects when >30% of nodes removed', () => {
      // Keep critical nodes (goal + options) but remove many other nodes
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2')]
      // 3 remain, 5 removed from original 8 → 5/8 = 62.5% removed (rounds to 63%)
      const nodeIds = ['goal1', 'opt1', 'opt2', 'removed1', 'removed2', 'removed3', 'removed4', 'removed5']
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('node_ids_changed')
      expect(result.details).toContain('5 nodes removed')
      expect(result.details).toContain('63%')
    })

    it('accepts when exactly 30% of nodes removed (boundary case)', () => {
      const nodes = [
        createNode('goal1'),
        createNode('opt1'),
        createNode('opt2'),
        createNode('factor1'),
        createNode('factor2'),
        createNode('factor3'),
        createNode('factor4'),
      ]
      // 7 remain, 3 removed from original 10 → 3/10 = 30% removed exactly
      const nodeIds = [
        'goal1',
        'opt1',
        'opt2',
        'factor1',
        'factor2',
        'factor3',
        'factor4',
        'removed1',
        'removed2',
        'removed3',
      ]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      // Validation uses >0.3, so exactly 30% should pass
      expect(result.isValid).toBe(true)
    })

    it('skips structural check when nodeIds snapshot not provided', () => {
      // Even if many nodes were potentially removed, we can't detect it without snapshot
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      // Should still pass goal/option checks
      expect(result.isValid).toBe(true)
    })

    it('skips structural check when nodeIds is empty array', () => {
      const nodes = [createNode('goal1'), createNode('opt1'), createNode('opt2')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, [], nodes)

      expect(result.isValid).toBe(true)
    })
  })

  describe('combined failures', () => {
    it('reports goal missing before checking options', () => {
      const nodes = [createNode('factor1')]
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, null, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_goal')
    })

    it('reports option missing before checking structural changes', () => {
      const nodes = [createNode('goal1'), createNode('opt1')]
      const nodeIds = ['goal1', 'opt1', 'opt2', 'removed1', 'removed2']
      const payload = createValidPayload()

      const result = validateCeeAnalysisReady(payload, nodeIds, nodes)

      expect(result.isValid).toBe(false)
      expect(result.reason).toBe('missing_option_nodes')
      expect(result.details).toContain('opt2')
    })
  })
})
