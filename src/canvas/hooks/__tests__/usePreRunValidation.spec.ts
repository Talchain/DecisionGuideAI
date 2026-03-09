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
    status: 'ready' | 'needs_user_mapping' | 'needs_encoding'
    interventions: Record<string, { value: number }>
  }>,
  goalNodeId: string,
  overallStatus?: 'ready' | 'needs_encoding' | 'needs_user_mapping',
  userQuestions?: string[]
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
    status: overallStatus,
    user_questions: userQuestions,
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

    it('falls back to canvas nodes when ceeAnalysisReady is null (no edges → blocker)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        // Option node WITHOUT interventions and NO edges → genuine missing model
        makeNode('option_a', 'option'),
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], null)

      // Should have OPTIONS_NEED_MAPPING blocker with "Generate a model" message
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(1)
      expect(optionBlockers[0].message).toBe('Generate a model to configure options')
      expect(result.canRun).toBe(false)
    })

    it('no blocker when ceeAnalysisReady is null but options have intervention edges', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        // Option node WITHOUT interventions data, but HAS edges to factors
        makeNode('option_a', 'option'),
      ]

      // option_a → factor_price edge exists (CEE model was generated)
      const edges: Edge[] = [makeEdge('e1', 'option_a', 'factor_price')]

      const result = validateBeforeRun('goal_revenue', nodes, edges, null)

      // Should NOT produce OPTIONS_NEED_MAPPING — provisionally ready
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(0)
    })

    it('blocks when some options have edges but others do not (mixed case)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('factor_volume', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'), // Has edge to factor
        makeNode('option_b', 'option'), // NO edge to any factor
      ]

      // Only option_a has an intervention edge; option_b has none
      const edges: Edge[] = [makeEdge('e1', 'option_a', 'factor_price')]

      const result = validateBeforeRun('goal_revenue', nodes, edges, null)

      // option_b lacks edges → model incomplete → should block
      const optionBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
      expect(optionBlockers).toHaveLength(1)
      expect(optionBlockers[0].message).toBe('Generate a model to configure options')
      expect(result.canRun).toBe(false)
    })

    it('blocks when ceeAnalysisReady has options needing mapping (CEE path)', () => {
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

      // CEE path: genuine blocker
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

  describe('overall analysis_ready.status validation', () => {
    it('allows run when status is needs_user_mapping but all options are resolved', () => {
      // LLM omission resilience: if all options have interventions and are ready,
      // needs_user_mapping was likely due to missing category, not a real issue
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'needs_user_mapping',
        ['The factor "Price" doesn\'t have a path to the goal. Is this correct?']
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(true)
      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
      // user_questions still captured regardless
      expect(result.userQuestions).toEqual([
        'The factor "Price" doesn\'t have a path to the goal. Is this correct?',
      ])
    })

    it('blocks when status is needs_user_mapping and options have empty interventions', () => {
      // Genuine structural issue: options don't have interventions
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'needs_user_mapping', interventions: {} }],
        'goal_revenue',
        'needs_user_mapping',
        ['Which factor does Option A affect?']
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(true)
      expect(result.userQuestions).toEqual([
        'Which factor does Option A affect?',
      ])
    })

    it('allows run when status is needs_encoding but all options are resolved', () => {
      // If options already have numeric interventions, encoding is not actually needed
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'needs_encoding'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(true)
      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
    })

    it('blocks for unknown status even when all options are resolved', () => {
      // Unknown/future statuses must always block — soft bypass only applies
      // to known LLM omission statuses (needs_user_mapping, needs_encoding)
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'some_future_status' as any
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(true)
    })

    it('allows run when status is ready', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'  // Overall status is ready
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
      expect(result.canRun).toBe(true)
    })

    it('does not block when status is absent (legacy compatibility)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue'
        // No overall status - legacy compatibility
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.blockers.some((b) => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
      expect(result.canRun).toBe(true)
    })

    it('returns userQuestions when present', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'needs_user_mapping',
        [
          'The factor "Price" has no path to the goal.',
          'Should this decision affect pricing or revenue?',
        ]
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.userQuestions).toHaveLength(2)
      expect(result.userQuestions).toContain('The factor "Price" has no path to the goal.')
    })

    it('returns undefined userQuestions when status is ready', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.userQuestions).toBeUndefined()
    })
  })

  // ===========================================================================
  // V3 Flat Edge Format — Strength Warning
  // ===========================================================================

  describe('V3 edge strength warning (checkDefaultStrengths)', () => {
    /**
     * Canvas edges store strength as `weight` (unsigned magnitude, 0-2).
     * DraftChat maps CEE V3 `strength.mean` / flat `strength_mean` → `weight`.
     * The strength warning fires when >80% of edges use the default weight (0.5).
     */

    function makeEdgeWithWeight(id: string, from: string, to: string, weight: number): Edge {
      return {
        id,
        source: from,
        target: to,
        data: { weight },
      }
    }

    it('fires STRENGTH_DEFAULTS_DOMINANT when >80% of edges use default weight (0.5)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { f1: { value: 1 } } }],
        'goal_revenue',
        'ready'
      )

      // 6 edges needed (>5 threshold), all with default weight 0.5
      const edges: Edge[] = [
        makeEdgeWithWeight('e1', 'f1', 'f2', 0.5),
        makeEdgeWithWeight('e2', 'f2', 'f3', 0.5),
        makeEdgeWithWeight('e3', 'f3', 'f4', 0.5),
        makeEdgeWithWeight('e4', 'f4', 'f5', 0.5),
        makeEdgeWithWeight('e5', 'f5', 'f6', 0.5),
        makeEdgeWithWeight('e6', 'f6', 'goal_revenue', 0.5),
      ]

      const result = validateBeforeRun('goal_revenue', nodes, edges, ceeAnalysisReady)

      const strengthWarning = result.warnings.find(w => w.code === 'STRENGTH_DEFAULTS_DOMINANT')
      expect(strengthWarning).toBeDefined()
      expect(strengthWarning!.message).toContain('6 of 6')
    })

    it('does NOT fire when edges have CEE-provided weight values (mapped from strength_mean)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { f1: { value: 1 } } }],
        'goal_revenue',
        'ready'
      )

      // 6 edges with varied weights (mapped from CEE strength_mean by DraftChat)
      const edges: Edge[] = [
        makeEdgeWithWeight('e1', 'f1', 'f2', 0.3),
        makeEdgeWithWeight('e2', 'f2', 'f3', 0.7),
        makeEdgeWithWeight('e3', 'f3', 'f4', 0.8),
        makeEdgeWithWeight('e4', 'f4', 'f5', 0.2),
        makeEdgeWithWeight('e5', 'f5', 'f6', 0.6),
        makeEdgeWithWeight('e6', 'f6', 'goal_revenue', 0.9),
      ]

      const result = validateBeforeRun('goal_revenue', nodes, edges, ceeAnalysisReady)

      const strengthWarning = result.warnings.find(w => w.code === 'STRENGTH_DEFAULTS_DOMINANT')
      expect(strengthWarning).toBeUndefined()
    })

    it('does NOT fire when <=5 edges (below threshold)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: { f1: { value: 1 } } }],
        'goal_revenue',
        'ready'
      )

      // Only 5 edges — below threshold, should not fire
      const edges: Edge[] = [
        makeEdgeWithWeight('e1', 'f1', 'f2', 0.5),
        makeEdgeWithWeight('e2', 'f2', 'f3', 0.5),
        makeEdgeWithWeight('e3', 'f3', 'f4', 0.5),
        makeEdgeWithWeight('e4', 'f4', 'f5', 0.5),
        makeEdgeWithWeight('e5', 'f5', 'goal_revenue', 0.5),
      ]

      const result = validateBeforeRun('goal_revenue', nodes, edges, ceeAnalysisReady)

      const strengthWarning = result.warnings.find(w => w.code === 'STRENGTH_DEFAULTS_DOMINANT')
      expect(strengthWarning).toBeUndefined()
    })
  })

  // ===========================================================================
  // analysis_ready as Single Source of Truth
  // ===========================================================================

  describe('analysis_ready gating (source of truth)', () => {
    /**
     * Golden fixture: mirrors bundle 9e39e2c5 shape.
     * Top-level options[].status = needs_user_mapping (display only),
     * but analysis_ready.status = ready with resolved options.
     *
     * The store field ceeAnalysisReady is populated from cee_response.analysis_ready,
     * NOT from top-level cee_response.options[]. So we only test analysis_ready here.
     */
    it('allows run when analysis_ready.status=ready and options are resolved (golden fixture)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('option_b', 'option'),
      ]

      // analysis_ready with status=ready and all options resolved
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Expand to Europe', status: 'ready', interventions: { factor_investment: { value: 100000 } } },
          { id: 'option_b', label: 'Status Quo', status: 'ready', interventions: { factor_investment: { value: 0 } } },
        ],
        'goal_revenue',
        'ready'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(true)
      expect(result.blockers).toHaveLength(0)
    })

    it('allows run when status=needs_user_mapping but all options resolved (baseline with empty interventions)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('option_baseline', 'option'),
      ]

      // analysis_ready.status downgraded by LLM, but options are actually resolved.
      // Baseline ("Status Quo") correctly has empty interventions.
      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Expand to Europe', status: 'ready', interventions: { factor_investment: { value: 100000 } } },
          { id: 'option_baseline', label: 'Status Quo', status: 'ready', interventions: {} },
        ],
        'goal_revenue',
        'needs_user_mapping'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // Soft bypass: baseline excluded from intervention requirement
      expect(result.canRun).toBe(true)
      expect(result.blockers.some(b => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
    })

    it('blocks when analysis_ready.status=needs_user_input (hard block)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady: CEEAnalysisReady = {
        options: [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { f1: { value: 1, source: 'brief_extraction' } } },
        ],
        goal_node_id: 'goal_revenue',
        status: 'needs_user_input',
        user_questions: ['Please clarify what revenue metric you want to optimize.'],
      }

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      const blocker = result.blockers.find(b => b.code === 'ANALYSIS_NOT_READY')
      expect(blocker).toBeDefined()
      expect(blocker!.message).toContain('brief needs changes')
      expect(result.userQuestions).toContain('Please clarify what revenue metric you want to optimize.')
    })

    it('blocks when analysis_ready.options is empty', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady: CEEAnalysisReady = {
        options: [], // Empty — invalid shape
        goal_node_id: 'goal_revenue',
        status: 'ready',
      }

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      expect(result.blockers.some(b => b.code === 'ANALYSIS_READY_INVALID')).toBe(true)
    })

    it('blocks when analysis_ready.status is unrecognised', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
      ]

      const ceeAnalysisReady: CEEAnalysisReady = {
        options: [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { f1: { value: 1, source: 'brief_extraction' } } },
        ],
        goal_node_id: 'goal_revenue',
        status: 'some_future_status' as any,
      }

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      const blocker = result.blockers.find(b => b.code === 'ANALYSIS_NOT_READY')
      expect(blocker).toBeDefined()
      expect(blocker!.message).toContain('Unrecognised')
    })

    it('falls back gracefully when analysis_ready is absent (legacy path)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option', {
          interventions: { factor_price: 100 },
          status: 'ready',
        }),
        makeNode('option_b', 'option', {
          interventions: { factor_price: 200 },
          status: 'ready',
        }),
      ]

      // No ceeAnalysisReady — falls back to canvas node extraction
      const result = validateBeforeRun('goal_revenue', nodes, [], null)

      // Legacy path still works for backward compatibility
      expect(result.blockers.some(b => b.code === 'ANALYSIS_READY_INVALID')).toBe(false)
    })
  })

  // ===========================================================================
  // M3: CEE-provided blockers merge with graph-derived blockers
  // ===========================================================================

  describe('CEE blockers merge', () => {
    it('adds CEE blockers to validation result', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_b', reason: 'No causal path to goal', factor_label: 'Factor B' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      const ceeBlocker = result.blockers.find(b => b.code === 'CEE_BLOCKER')
      expect(ceeBlocker).toBeDefined()
      expect(ceeBlocker!.message).toBe('No causal path to goal')
      expect(ceeBlocker!.affectedIds).toEqual(['factor_b'])
    })

    it('CEE blocker replaces graph-derived blocker for same factor_id', () => {
      // Setup: option with id='factor_a' and status='needs_user_mapping' triggers
      // OPTIONS_NEED_MAPPING blocker with affectedIds: ['factor_a'].
      // CEE blocker for factor_id='factor_a' should replace it.
      const nodes: Node[] = [
        makeNode('factor_a', 'factor'),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'factor_a', label: 'Problematic', status: 'needs_user_mapping', interventions: {} },
          { id: 'opt_good', label: 'Good', status: 'ready', interventions: { factor_a: { value: 100 } } },
        ],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_a', reason: 'CEE: richer context', factor_label: 'Factor A' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // Graph-derived OPTIONS_NEED_MAPPING with affectedIds containing 'factor_a' replaced
      const graphBlockersForA = result.blockers.filter(
        b => b.code === 'OPTIONS_NEED_MAPPING' && b.affectedIds?.includes('factor_a')
      )
      expect(graphBlockersForA).toHaveLength(0)

      // CEE blocker present instead
      const ceeBlockers = result.blockers.filter(b => b.code === 'CEE_BLOCKER')
      expect(ceeBlockers).toHaveLength(1)
      expect(ceeBlockers[0].message).toBe('CEE: richer context')
      expect(ceeBlockers[0].affectedIds).toEqual(['factor_a'])
    })

    it('deduplicates CEE blockers by factor_id (keeps first)', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_x', reason: 'First reason' },
        { factor_id: 'factor_x', reason: 'Duplicate (dropped)' },
        { factor_id: 'factor_y', reason: 'Different factor' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      const ceeBlockers = result.blockers.filter(b => b.code === 'CEE_BLOCKER')
      expect(ceeBlockers).toHaveLength(2)
      expect(ceeBlockers.find(b => b.affectedIds?.[0] === 'factor_x')!.message).toBe('First reason')
      expect(ceeBlockers.find(b => b.affectedIds?.[0] === 'factor_y')!.message).toBe('Different factor')
    })

    it('no CEE blockers when analysis_ready.blockers is absent', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor'),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.blockers.filter(b => b.code === 'CEE_BLOCKER')).toHaveLength(0)
    })

    it('excludes CEE blockers for external factors', () => {
      const nodes: Node[] = [
        makeNode('factor_market', 'factor', { category: 'external' }),
        makeNode('factor_price', 'factor', { category: 'controllable' }),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_price: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_market', reason: 'No option targets this factor', factor_label: 'Market Conditions' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // External factor blocker should be excluded
      expect(result.blockers.filter(b => b.code === 'CEE_BLOCKER')).toHaveLength(0)
      expect(result.canRun).toBe(true)
    })

    it('keeps CEE blockers for controllable factors', () => {
      const nodes: Node[] = [
        makeNode('factor_price', 'factor', { category: 'controllable' }),
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_other: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_price', reason: 'No option targets this factor', factor_label: 'Price' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.blockers.filter(b => b.code === 'CEE_BLOCKER')).toHaveLength(1)
      expect(result.canRun).toBe(false)
    })

    it('keeps CEE blockers for factors with undefined category (safe default)', () => {
      const nodes: Node[] = [
        makeNode('factor_unknown', 'factor'), // No category field
        makeNode('goal_revenue', 'goal'),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [{ id: 'opt1', label: 'Opt 1', status: 'ready', interventions: { factor_other: { value: 100 } } }],
        'goal_revenue',
        'ready'
      )
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_unknown', reason: 'No option targets this factor' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // Undefined category defaults to the stricter check — blocker kept
      expect(result.blockers.filter(b => b.code === 'CEE_BLOCKER')).toHaveLength(1)
      expect(result.canRun).toBe(false)
    })
  })

  // ===========================================================================
  // Readiness contract alignment
  // ===========================================================================

  describe('readiness contract alignment', () => {
    it('all factors reachable → analysis_ready=ready AND canRun=true', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('factor_price', 'factor', { category: 'controllable' }),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } },
          { id: 'option_b', label: 'Status Quo', status: 'ready', interventions: { factor_price: { value: 0 } } },
        ],
        'goal_revenue',
        'ready'
      )
      // No blockers — all factors reachable
      ceeAnalysisReady.blockers = []

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(ceeAnalysisReady.status).toBe('ready')
      expect(result.canRun).toBe(true)
      expect(result.blockers).toHaveLength(0)
    })

    it('unreachable external factor → canRun=true (external factors tolerated)', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('factor_price', 'factor', { category: 'controllable' }),
        makeNode('factor_regulation', 'factor', { category: 'external' }),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } },
          { id: 'option_b', label: 'Status Quo', status: 'ready', interventions: { factor_price: { value: 0 } } },
        ],
        'goal_revenue',
        'ready'
      )
      // CEE reports external factor as unreachable
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_regulation', reason: 'No option targets this factor', factor_label: 'Regulation' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      // External factor excluded → no blockers → can run
      expect(result.canRun).toBe(true)
      expect(result.blockers.filter(b => b.code === 'CEE_BLOCKER')).toHaveLength(0)
    })

    it('unreachable controllable factor → canRun=false with appropriate blocker', () => {
      const nodes: Node[] = [
        makeNode('goal_revenue', 'goal'),
        makeNode('option_a', 'option'),
        makeNode('factor_price', 'factor', { category: 'controllable' }),
        makeNode('factor_marketing', 'factor', { category: 'controllable' }),
      ]

      const ceeAnalysisReady = makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } },
          { id: 'option_b', label: 'Status Quo', status: 'ready', interventions: { factor_price: { value: 0 } } },
        ],
        'goal_revenue',
        'ready'
      )
      // CEE reports controllable factor as unreachable
      ceeAnalysisReady.blockers = [
        { factor_id: 'factor_marketing', reason: 'No option targets this factor', factor_label: 'Marketing Spend' },
      ]

      const result = validateBeforeRun('goal_revenue', nodes, [], ceeAnalysisReady)

      expect(result.canRun).toBe(false)
      const ceeBlocker = result.blockers.find(b => b.code === 'CEE_BLOCKER')
      expect(ceeBlocker).toBeDefined()
      expect(ceeBlocker!.affectedIds).toEqual(['factor_marketing'])
    })
  })

  // ===========================================================================
  // constraint_dropped classification
  // ===========================================================================

  describe('constraint_dropped classification', () => {
    const baseNodes: Node[] = [
      makeNode('factor_price', 'factor'),
      makeNode('goal_revenue', 'goal'),
      makeNode('option_a', 'option'),
      makeNode('option_b', 'option'),
    ]

    function makeReadyCEE() {
      return makeCEEAnalysisReady(
        [
          { id: 'option_a', label: 'Option A', status: 'ready', interventions: { factor_price: { value: 100 } } },
          { id: 'option_b', label: 'Option B', status: 'ready', interventions: { factor_price: { value: 200 } } },
        ],
        'goal_revenue',
        'ready'
      )
    }

    it('constraint_dropped blockers do NOT set canRun to false', () => {
      const cee = makeReadyCEE()
      cee.blockers = [
        { factor_id: 'constraint_budget_limit', reason: 'No matching factor', blocker_type: 'constraint_dropped' },
        { factor_id: 'constraint_time_limit', reason: 'No matching factor', blocker_type: 'constraint_dropped' },
      ]

      const result = validateBeforeRun('goal_revenue', baseNodes, [], cee)

      expect(result.canRun).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.informationalBlockers).toHaveLength(2)
      expect(result.informationalBlockers[0].code).toBe('CONSTRAINT_DROPPED')
    })

    it('real CEE blockers still set canRun to false', () => {
      const cee = makeReadyCEE()
      cee.blockers = [
        { factor_id: 'factor_price', reason: 'No causal path', blocker_type: 'missing_value' },
      ]

      const result = validateBeforeRun('goal_revenue', baseNodes, [], cee)

      expect(result.canRun).toBe(false)
      expect(result.blockers).toHaveLength(1)
      expect(result.blockers[0].code).toBe('CEE_BLOCKER')
      expect(result.informationalBlockers).toHaveLength(0)
    })

    it('mix of constraint_dropped + real blockers: only real blockers count', () => {
      const cee = makeReadyCEE()
      cee.blockers = [
        { factor_id: 'constraint_budget', reason: 'No matching factor', blocker_type: 'constraint_dropped' },
        { factor_id: 'factor_price', reason: 'No causal path' }, // no blocker_type = blocking
      ]

      const result = validateBeforeRun('goal_revenue', baseNodes, [], cee)

      expect(result.canRun).toBe(false)
      expect(result.blockers).toHaveLength(1)
      expect(result.blockers[0].code).toBe('CEE_BLOCKER')
      expect(result.informationalBlockers).toHaveLength(1)
      expect(result.informationalBlockers[0].code).toBe('CONSTRAINT_DROPPED')
    })

    it('CEE status ready + constraint_dropped only → canRun true', () => {
      const cee = makeReadyCEE()
      cee.blockers = [
        { factor_id: 'constraint_max_headcount', reason: 'Unmatched constraint', blocker_type: 'constraint_dropped' },
      ]

      const result = validateBeforeRun('goal_revenue', baseNodes, [], cee)

      expect(result.canRun).toBe(true)
      expect(result.informationalBlockers).toHaveLength(1)
      expect(result.informationalBlockers[0].action?.label).toBe('constraint_max_headcount')
    })
  })
})
