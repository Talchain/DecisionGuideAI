/**
 * Pre-Run Validation Tests
 *
 * Tests for usePreRunValidation hook and validateBeforeRun function.
 * Covers:
 * - ceeAnalysisReady takes priority over canvas nodes
 * - Stale guard invalidation on graph mutations
 * - Fallback to canvas nodes when ceeAnalysisReady is cleared
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateBeforeRun } from '../usePreRunValidation'
import type { Node, Edge } from '@xyflow/react'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { DEV: false } } })

// =============================================================================
// Test Helpers
// =============================================================================

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    // Include kind in data to match what validateGoalNode checks
    data: { label: `Node ${id}`, kind: type, ...data },
  }
}

function makeEdge(id: string, from: string, to: string): Edge {
  return {
    id,
    source: from,
    target: to,
  }
}

function makeCEEAnalysisReady(
  options: Array<{
    id: string
    label: string
    status: 'ready' | 'needs_user_mapping'
    interventions: Record<string, { value: number }>
  }>,
  goalNodeId: string
): CEEAnalysisReady {
  return {
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      status: o.status,
      interventions: Object.fromEntries(
        Object.entries(o.interventions).map(([k, v]) => [
          k,
          { value: v.value, source: 'brief_extraction' as const },
        ])
      ),
    })),
    goal_node_id: goalNodeId,
  }
}

// =============================================================================
// Tests: ceeAnalysisReady Priority
// =============================================================================

describe('validateBeforeRun', () => {
  describe('ceeAnalysisReady priority', () => {
    it('uses ceeAnalysisReady options when present (no blockers for ready options)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'), // Canvas node has NO interventions
        makeNode('option_b', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } },
          { id: 'option_b', label: 'Option B', status: 'ready', interventions: { factor_price: { value: 200 } } },
        ],
        'goal_revenue'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // Should NOT have OPTIONS_NEED_MAPPING blocker because ceeAnalysisReady has ready options
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(0)
      expect(result.canRun).toBe(true)
    })

    it('shows blocker when ceeAnalysisReady options need mapping', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'needs_user_mapping', interventions: {} },
        ],
        'goal_revenue'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(1)
      expect(result.canRun).toBe(false)
    })

    it('falls back to canvas nodes when ceeAnalysisReady is null', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        // Option node WITHOUT interventions → should trigger blocker
        makeNode('option_a', 'option'),
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], null)

      // Should have OPTIONS_NEED_MAPPING blocker from canvas node extraction
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(1)
      expect(result.canRun).toBe(false)
    })

    it('falls back to canvas nodes when ceeAnalysisReady has empty options', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady: CEEAnalysisReady = {
        options: [], // Empty options array
        goal_node_id: 'goal_revenue',
      }

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // Should fall back to canvas nodes and find the option without interventions
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(1)
    })
  })

  describe('stale guard behavior', () => {
    it('uses canvas nodes after ceeAnalysisReady is cleared (simulating graph mutation)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'), // No interventions on canvas node
      ]

      // First call WITH ceeAnalysisReady - should pass
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue'
      )
      const resultWithCEE = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)
      expect(resultWithCEE.canRun).toBe(true)

      // Second call WITHOUT ceeAnalysisReady (simulates invalidation after graph edit)
      const resultWithoutCEE = validateBeforeRun('goal_revenue', nodes, [], null)
      expect(resultWithoutCEE.canRun).toBe(false)
      expect(resultWithoutCEE.blockers.some((b) => b.code === 'OPTIONS_NEED_MAPPING')).toBe(true)
    })

    it('correctly counts affected nodes from canvas when falling back', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('option_b', 'option'),
        makeNode('decision_main', 'decision'), // Also counted as option type
      ]

      // Without ceeAnalysisReady, all option/decision nodes are extracted
      const result = validateBeforeRun('goal_revenue', nodes, [], null)

      // Should find 3 nodes needing mapping (option_a, option_b, decision_main)
      const blocker = result.blockers.find((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(blocker).toBeDefined()
      expect(blocker?.affectedIds).toHaveLength(3)
    })
  })

  describe('goal node validation', () => {
    it('blocks when no goal node selected', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('option_a', 'option'),
      ]

      const result = validateBeforeRun(null, nodes, [], null)

      expect(result.blockers.some((b) => b.code === 'MISSING_GOAL_NODE')).toBe(true)
      expect(result.canRun).toBe(false)
    })

    it('blocks when goal node no longer exists', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('option_a', 'option'),
      ]

      const result = validateBeforeRun('deleted_goal', nodes, [], null)

      expect(result.blockers.some((b) => b.code === 'GOAL_NODE_NOT_FOUND')).toBe(true)
      expect(result.recommendedFixes?.some((f) => f.type === 'clear_stale_goal')).toBe(true)
    })
  })
})
