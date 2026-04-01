/**
 * V2 Adapter Tests (P0-UI Integration)
 *
 * Tests for /v2/run request building and response handling.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  extractOptionsFromNodes,
  uiOptionToV2Option,
  transformNodeToV2,
  transformEdgeToV2,
  buildV2Request,
  buildV2RequestFromAnalysisReady,
} from '../adapter'
import {
  isBlockedResponse,
  isFailedAnalysis,
  isSuccessfulAnalysis,
  STD_FLOOR,
  DEFAULT_SEED,
  type V2RunResponse,
  type V2RunError,
} from '../types'
import type { UIOption, UIInterventionValue } from '../../../../types/options'
import type { CEEAnalysisReady } from '../../../cee/types'

// ============================================================================
// Test Fixtures
// ============================================================================

function makeNode(id: string, data: Record<string, unknown>): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data,
  }
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {}
): Edge {
  return { id, source, target, data }
}

// ============================================================================
// extractOptionsFromNodes Tests
// ============================================================================

describe('extractOptionsFromNodes', () => {
  it('extracts options from nodes with kind=option', () => {
    const nodes: Node[] = [
      makeNode('opt1', { kind: 'option', label: 'Option A', interventions: { factor1: 10 } }),
      makeNode('factor1', { kind: 'factor', label: 'Factor 1' }),
    ]
    const validIds = new Set(['opt1', 'factor1'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options).toHaveLength(1)
    expect(options[0].id).toBe('opt1')
    expect(options[0].label).toBe('Option A')
    expect(options[0].status).toBe('ready')
    expect(options[0].interventions.factor1).toEqual({
      value: 10,
      source: 'user_specified',
      target_match: {
        node_id: 'factor1',
        match_type: 'exact_id',
        confidence: 'high',
      },
    })
  })

  it('extracts options from nodes with type=option (legacy)', () => {
    const nodes: Node[] = [
      makeNode('opt1', { type: 'option', label: 'Legacy Option', interventions: { f1: 5 } }),
      makeNode('f1', { kind: 'factor', label: 'Factor' }),
    ]
    const validIds = new Set(['opt1', 'f1'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options).toHaveLength(1)
    expect(options[0].label).toBe('Legacy Option')
  })

  it('skips interventions targeting non-existent nodes', () => {
    const nodes: Node[] = [
      makeNode('opt1', {
        kind: 'option',
        label: 'Option',
        interventions: {
          valid_target: 10,
          missing_target: 20, // Should be skipped
        },
      }),
      makeNode('valid_target', { kind: 'factor' }),
    ]
    const validIds = new Set(['opt1', 'valid_target'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(Object.keys(options[0].interventions)).toEqual(['valid_target'])
    expect(options[0].interventions.missing_target).toBeUndefined()
  })

  it('skips self-targeting interventions', () => {
    const nodes: Node[] = [
      makeNode('opt1', {
        kind: 'option',
        label: 'Self-Target Option',
        interventions: {
          opt1: 100, // Self-targeting - should be skipped
          factor1: 50,
        },
      }),
      makeNode('factor1', { kind: 'factor' }),
    ]
    const validIds = new Set(['opt1', 'factor1'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(Object.keys(options[0].interventions)).toEqual(['factor1'])
    expect(options[0].interventions.opt1).toBeUndefined()
  })

  it('marks options without valid interventions as needs_user_mapping', () => {
    const nodes: Node[] = [
      makeNode('opt1', { kind: 'option', label: 'Empty Option' }),
    ]
    const validIds = new Set(['opt1'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options[0].status).toBe('needs_user_mapping')
    expect(options[0].user_questions).toBeDefined()
    expect(options[0].user_questions?.length).toBeGreaterThan(0)
  })

  it('handles UIInterventionValue format', () => {
    const interventionValue: UIInterventionValue = {
      value: 42,
      source: 'cee_mapped',
      target_match: {
        node_id: 'factor1',
        match_type: 'semantic',
        confidence: 'medium',
      },
    }

    const nodes: Node[] = [
      makeNode('opt1', {
        kind: 'option',
        label: 'CEE Option',
        interventions: { factor1: interventionValue },
      }),
      makeNode('factor1', { kind: 'factor' }),
    ]
    const validIds = new Set(['opt1', 'factor1'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options[0].interventions.factor1).toEqual(interventionValue)
  })

  it('returns empty array when no option nodes exist', () => {
    const nodes: Node[] = [
      makeNode('f1', { kind: 'factor', label: 'Factor' }),
      makeNode('f2', { kind: 'factor', label: 'Factor 2' }),
    ]
    const validIds = new Set(['f1', 'f2'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options).toHaveLength(0)
  })

  // Regression: rerun fallback path produces valid payload when ceeAnalysisReady is null
  // but node.data.interventions was backfilled from the prior ceeAnalysisReady.
  it('produces valid interventions from backfilled node.data.interventions (rerun fallback path)', () => {
    // Simulates state after: (1) ceeAnalysisReady was set, (2) backfill ran, (3) ceeAnalysisReady was cleared
    const nodes: Node[] = [
      makeNode('opt_a', {
        kind: 'option',
        label: 'Option A',
        interventions: {
          fac_tech_lead: { value: 1, source: 'cee_hypothesis', target_match: { node_id: 'fac_tech_lead', match_type: 'exact_id', confidence: 'high' } },
          fac_dev_cap: { value: 0.33, source: 'cee_hypothesis', target_match: { node_id: 'fac_dev_cap', match_type: 'exact_id', confidence: 'high' } },
        },
      }),
      makeNode('opt_b', {
        kind: 'option',
        label: 'Option B',
        interventions: {
          fac_dev_cap: { value: 0.67, source: 'cee_hypothesis', target_match: { node_id: 'fac_dev_cap', match_type: 'exact_id', confidence: 'high' } },
        },
      }),
      makeNode('fac_tech_lead', { kind: 'factor', label: 'Tech Lead' }),
      makeNode('fac_dev_cap', { kind: 'factor', label: 'Dev Capacity' }),
    ]
    const validIds = new Set(['opt_a', 'opt_b', 'fac_tech_lead', 'fac_dev_cap'])

    const options = extractOptionsFromNodes(nodes, validIds)

    expect(options).toHaveLength(2)
    expect(options[0].status).toBe('ready')
    expect(Object.keys(options[0].interventions)).toContain('fac_tech_lead')
    expect(Object.keys(options[0].interventions)).toContain('fac_dev_cap')
    expect(options[1].status).toBe('ready')
    expect(Object.keys(options[1].interventions)).toContain('fac_dev_cap')
  })
})

// ============================================================================
// uiOptionToV2Option Tests
// ============================================================================

describe('uiOptionToV2Option', () => {
  it('flattens UIInterventionValue to simple numbers', () => {
    const uiOption: UIOption = {
      id: 'opt1',
      label: 'Test Option',
      status: 'ready',
      interventions: {
        factor1: { value: 100, source: 'user_specified' } as UIInterventionValue,
        factor2: { value: 200, source: 'cee_mapped' } as UIInterventionValue,
      },
      source: 'legacy_node',
    }

    const v2Option = uiOptionToV2Option(uiOption)

    expect(v2Option.id).toBe('opt1')
    expect(v2Option.label).toBe('Test Option')
    expect(v2Option.interventions).toEqual({
      factor1: 100,
      factor2: 200,
    })
  })
})

// ============================================================================
// transformNodeToV2 Tests
// ============================================================================

describe('transformNodeToV2', () => {
  it('transforms basic node', () => {
    const node = makeNode('n1', { label: 'Test Node', kind: 'factor' })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.id).toBe('n1')
    expect(v2Node.label).toBe('Test Node')
    expect(v2Node.kind).toBe('factor')
    expect(v2Node.observed_state).toBeUndefined()
  })

  it('extracts observed_state from observedState object', () => {
    const node = makeNode('n1', {
      label: 'Factor',
      kind: 'factor',
      observedState: { value: 50, baseline: 40, unit: 'percent' },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.observed_state).toBeDefined()
    expect(v2Node.observed_state!.value).toBe(50)
    expect(v2Node.observed_state!.std).toBeGreaterThanOrEqual(STD_FLOOR)
  })

  it('extracts observed_state from value field', () => {
    const node = makeNode('n1', {
      label: 'Factor',
      kind: 'factor',
      value: 100,
      baseline: 80,
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.observed_state).toBeDefined()
    expect(v2Node.observed_state!.value).toBe(100)
    // std should be derived from delta (100-80=20), ~25% of delta
    expect(v2Node.observed_state!.std).toBeGreaterThanOrEqual(STD_FLOOR)
  })

  it('uses type fallback for kind', () => {
    const node = makeNode('n1', { label: 'Legacy', type: 'decision' })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.kind).toBe('decision')
  })

  it('defaults kind to factor when not specified', () => {
    const node = makeNode('n1', { label: 'Unknown' })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.kind).toBe('factor')
  })

  it('uses node id as label fallback', () => {
    const node = makeNode('my_node_id', {})

    const v2Node = transformNodeToV2(node)

    expect(v2Node.label).toBe('my_node_id')
  })
})

// ============================================================================
// transformEdgeToV2 Tests
// ============================================================================

describe('transformEdgeToV2', () => {
  it('transforms edge with positive direction', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {
      weight: 0.8,
      direction: 'positive',
      beliefExists: 0.9,
    })

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.from).toBe('n1')
    expect(v2Edge.to).toBe('n2')
    expect(v2Edge.strength.mean).toBe(0.8)
    expect(v2Edge.exists_probability).toBe(0.9)
    expect(v2Edge.strength.std).toBeGreaterThanOrEqual(STD_FLOOR)
  })

  it('transforms edge with negative direction', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {
      weight: 0.6,
      direction: 'negative',
      beliefExists: 0.7,
    })

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.strength.mean).toBe(-0.6)
  })

  it('enforces STD_FLOOR on strength.std', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {
      weight: 0.5,
      strengthStd: 0, // Should be enforced to STD_FLOOR
    })

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.strength.std).toBe(STD_FLOOR)
  })

  it('uses beliefExists fallbacks (confidence, belief)', () => {
    const edgeConfidence = makeEdge('e1', 'n1', 'n2', { confidence: 0.75 })
    const edgeBelief = makeEdge('e2', 'n1', 'n2', { belief: 0.65 })

    expect(transformEdgeToV2(edgeConfidence).exists_probability).toBe(0.75)
    expect(transformEdgeToV2(edgeBelief).exists_probability).toBe(0.65)
  })

  it('defaults to 0.5 mean and omits exists_probability for missing values', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {})

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.strength.mean).toBe(0.5)
    // exists_probability omitted — PLoT applies DEFAULT_EXISTS_PROBABILITY (0.8) with repair logging
    expect(v2Edge).not.toHaveProperty('exists_probability')
  })

  // CIL Phase 1: UI→PLoT boundary - explicit vs default values
  describe('UI→PLoT default leakage prevention', () => {
    it('forwards explicit zero strength (not treated as falsy)', () => {
      // Critical: zero is a valid strength value and must be forwarded
      // Catches bugs where falsy-check (if (weight)) would skip zero
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0,
        beliefExists: 0.8,
      })

      const v2Edge = transformEdgeToV2(edge)

      expect(v2Edge.strength.mean).toBe(0)
      expect(v2Edge.exists_probability).toBe(0.8)
    })

    it('forwards explicit negative strength from direction', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'negative',
        beliefExists: 0.9,
      })

      const v2Edge = transformEdgeToV2(edge)

      expect(v2Edge.strength.mean).toBe(-0.7)
      expect(v2Edge.exists_probability).toBe(0.9)
    })

    it('omits exists_probability when CEE provides no belief values', () => {
      /**
       * Contract: when CEE provides no existence probability, the UI omits
       * the field entirely. PLoT applies DEFAULT_EXISTS_PROBABILITY (0.8)
       * with repair logging, so the analytical result is the same but PLoT
       * retains visibility into which values were defaults.
       */
      const edgeNoCEEData = makeEdge('e1', 'n1', 'n2', {})

      const v2Edge = transformEdgeToV2(edgeNoCEEData)

      expect(v2Edge.strength.mean).toBe(0.5)
      expect(v2Edge).not.toHaveProperty('exists_probability')
    })

    it('preserves CEE-provided strength values exactly', () => {
      // When CEE provides explicit values, they must be forwarded unchanged
      const edgeWithCEEData = makeEdge('e1', 'n1', 'n2', {
        weight: 0.73,
        direction: 'positive',
        beliefExists: 0.88,
        strengthStd: 0.15,
      })

      const v2Edge = transformEdgeToV2(edgeWithCEEData)

      expect(v2Edge.strength.mean).toBe(0.73)
      expect(v2Edge.strength.std).toBe(0.15)
      expect(v2Edge.exists_probability).toBe(0.88)
    })
  })
})

// ============================================================================
// exists_probability omit-when-unset tests
// ============================================================================

describe('exists_probability omit-when-unset', () => {
  it('edge with no belief fields must not serialise exists_probability', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {
      weight: 0.7,
      direction: 'positive',
      // No beliefExists, confidence, or belief
    })

    const v2Edge = transformEdgeToV2(edge)

    // Field omitted — PLoT applies DEFAULT_EXISTS_PROBABILITY (0.8) with repair logging
    expect(v2Edge).not.toHaveProperty('exists_probability')
  })

  it('edge with explicit beliefExists forwards the value', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {
      weight: 0.7,
      direction: 'positive',
      beliefExists: 0.6,
    })

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.exists_probability).toBe(0.6)
  })
})

// ============================================================================
// buildV2Request Tests
// ============================================================================

describe('buildV2Request', () => {
  it('builds request with goal_node_id', () => {
    const nodes: Node[] = [
      makeNode('goal', { label: 'Goal', kind: 'outcome' }),
      makeNode('factor', { label: 'Factor', kind: 'factor' }),
    ]
    const edges: Edge[] = [makeEdge('e1', 'factor', 'goal', { weight: 0.8 })]
    const options: UIOption[] = []

    const { request } = buildV2Request(nodes, edges, options, 'goal')

    expect(request.goal_node_id).toBe('goal')
    // P0 Fix: Seed is derived from timestamp, not hardcoded "42"
    expect(request.seed).toMatch(/^\d+$/) // Numeric string
    expect(request.seed).not.toBe('42') // Never hardcoded DEFAULT_SEED
    expect(request.detail_level).toBe('deep')
    expect(request.graph.nodes).toHaveLength(2)
    expect(request.graph.edges).toHaveLength(1)
  })

  it('extracts options from nodes when not provided', () => {
    const nodes: Node[] = [
      makeNode('opt1', { label: 'Option', kind: 'option', interventions: { f1: 10 } }),
      makeNode('f1', { label: 'Factor', kind: 'factor' }),
      makeNode('goal', { label: 'Goal', kind: 'outcome' }),
    ]
    const edges: Edge[] = []

    const { request } = buildV2Request(nodes, edges, [], 'goal')

    expect(request.options).toHaveLength(1)
    expect(request.options[0].id).toBe('opt1')
    expect(request.options[0].interventions).toEqual({ f1: 10 })
  })

  it('uses provided options over extraction', () => {
    const nodes: Node[] = [
      makeNode('opt1', { label: 'Option', kind: 'option', interventions: { f1: 10 } }),
      makeNode('f1', { kind: 'factor' }),
    ]
    const edges: Edge[] = []
    const providedOptions: UIOption[] = [
      {
        id: 'provided_opt',
        label: 'Provided Option',
        status: 'ready',
        interventions: { f1: { value: 99, source: 'cee_mapped' } as UIInterventionValue },
        source: 'cee',
      },
    ]

    const { request } = buildV2Request(nodes, edges, providedOptions, 'f1')

    expect(request.options).toHaveLength(1)
    expect(request.options[0].id).toBe('provided_opt')
    expect(request.options[0].interventions.f1).toBe(99)
  })

  it('returns reverseIdMap for response translation', () => {
    const nodes: Node[] = [makeNode('n1', { label: 'Node' })]
    const edges: Edge[] = []

    const { reverseIdMap } = buildV2Request(nodes, edges, [], 'n1')

    expect(reverseIdMap).toBeInstanceOf(Map)
  })
})

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isBlockedResponse', () => {
  it('returns true for blocked status', () => {
    const error: V2RunError = {
      analysis_status: 'blocked',
      status_reason: 'Validation failed',
      critiques: [],
    }

    expect(isBlockedResponse(error)).toBe(true)
  })

  it('returns false for failed status (NOT blocked - it is a 200)', () => {
    const response: V2RunResponse = {
      analysis_status: 'failed',
      option_comparison_status: 'unavailable',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      options: [],
      critiques: [],
      response_hash: 'hash',
      seed_used: '42',
    }

    // 'failed' is a 200 response, not a 422 blocked response
    expect(isBlockedResponse(response as any)).toBe(false)
  })

  it('returns false for computed status', () => {
    const response: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      options: [],
      critiques: [],
      response_hash: 'hash',
      seed_used: '42',
    }

    expect(isBlockedResponse(response)).toBe(false)
  })
})

describe('isFailedAnalysis', () => {
  it('returns true for failed status', () => {
    const response = { analysis_status: 'failed' }

    expect(isFailedAnalysis(response as any)).toBe(true)
  })

  it('returns false for blocked status', () => {
    const error = { analysis_status: 'blocked' }

    expect(isFailedAnalysis(error as any)).toBe(false)
  })

  it('returns false for computed status', () => {
    const response = { analysis_status: 'computed' }

    expect(isFailedAnalysis(response as any)).toBe(false)
  })
})

describe('isSuccessfulAnalysis', () => {
  it('returns true for computed status', () => {
    const response: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      options: [],
      critiques: [],
      response_hash: 'hash',
      seed_used: '42',
    }

    expect(isSuccessfulAnalysis(response)).toBe(true)
  })

  it('returns true for partial status', () => {
    const response: V2RunResponse = {
      analysis_status: 'partial',
      option_comparison_status: 'computed',
      robustness_status: 'skipped',
      drivers_status: 'skipped',
      options: [],
      critiques: [],
      response_hash: 'hash',
      seed_used: '42',
    }

    expect(isSuccessfulAnalysis(response)).toBe(true)
  })

  it('returns false for failed status', () => {
    const response = { analysis_status: 'failed' }

    expect(isSuccessfulAnalysis(response as any)).toBe(false)
  })

  it('returns false for blocked status', () => {
    const error = { analysis_status: 'blocked' }

    expect(isSuccessfulAnalysis(error as any)).toBe(false)
  })
})

// ============================================================================
// Test Set 3: Request Payload Validation (P1 - Regression Prevention)
// ============================================================================

describe('Request Payload Validation - intervention flattening', () => {
  /**
   * These tests verify that the actual request payload contains numeric
   * intervention values, not the rich metadata objects that CEE produces.
   *
   * CEE output format:
   *   { value: 120, source: 'brief_extraction', target_match: {...}, ... }
   *
   * Required /v2/run format:
   *   120 (just the number)
   */

  it('flattens rich intervention objects to simple numbers', () => {
    // GIVEN: Options with CEE-style rich intervention objects
    const richOption: UIOption = {
      id: 'option_premium',
      label: 'Premium Pricing',
      status: 'ready',
      interventions: {
        factor_price: {
          value: 120,
          source: 'brief_extraction',
          target_match: {
            node_id: 'factor_price',
            match_type: 'exact_id',
            confidence: 'high',
          },
          value_confidence: 'high',
          reasoning: 'Extracted from "set price to $120"',
        },
        factor_quality: {
          value: 0.85,
          source: 'cee_hypothesis',
          value_confidence: 'medium',
        },
      },
      source: 'cee_generated',
    }

    // WHEN: We convert to V2 format
    const v2Option = uiOptionToV2Option(richOption)

    // THEN: All intervention values should be simple numbers
    for (const [key, value] of Object.entries(v2Option.interventions)) {
      expect(typeof value).toBe('number')
    }

    // AND: The numeric values should match the .value from the input
    expect(v2Option.interventions.factor_price).toBe(120)
    expect(v2Option.interventions.factor_quality).toBe(0.85)
  })

  it('handles mixed input: some numbers, some rich objects', () => {
    // GIVEN: Options with mixed intervention formats
    const mixedOption: UIOption = {
      id: 'option_mixed',
      label: 'Mixed Format',
      status: 'ready',
      interventions: {
        // Already a number (legacy format)
        simple_factor: {
          value: 50,
          source: 'user_specified',
        },
        // Rich CEE object
        cee_factor: {
          value: 75.5,
          source: 'brief_extraction',
          target_match: {
            node_id: 'cee_factor',
            match_type: 'semantic',
            confidence: 'medium',
          },
        },
      },
      source: 'legacy_node',
    }

    // WHEN: We convert to V2 format
    const v2Option = uiOptionToV2Option(mixedOption)

    // THEN: All values should be flattened to numbers
    expect(typeof v2Option.interventions.simple_factor).toBe('number')
    expect(typeof v2Option.interventions.cee_factor).toBe('number')
    expect(v2Option.interventions.simple_factor).toBe(50)
    expect(v2Option.interventions.cee_factor).toBe(75.5)
  })

  it('preserves intervention values exactly (no rounding or mutation)', () => {
    // GIVEN: Options with precise decimal values
    const preciseOption: UIOption = {
      id: 'precise_opt',
      label: 'Precise',
      status: 'ready',
      interventions: {
        factor_a: { value: 123.456789, source: 'user_specified' },
        factor_b: { value: -0.000001, source: 'user_specified' },
        factor_c: { value: 9999999.999, source: 'user_specified' },
      },
      source: 'user_created',
    }

    // WHEN: We convert
    const v2Option = uiOptionToV2Option(preciseOption)

    // THEN: Values should be preserved exactly
    expect(v2Option.interventions.factor_a).toBe(123.456789)
    expect(v2Option.interventions.factor_b).toBe(-0.000001)
    expect(v2Option.interventions.factor_c).toBe(9999999.999)
  })

  it('buildV2Request produces numeric interventions in final request', () => {
    // GIVEN: A complete scenario with CEE-style options
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', { weight: 0.7 }),
    ]
    const ceeOptions: UIOption[] = [
      {
        id: 'opt_low',
        label: 'Low Price',
        status: 'ready',
        interventions: {
          factor_price: {
            value: 80,
            source: 'brief_extraction',
            target_match: { node_id: 'factor_price', match_type: 'exact_id', confidence: 'high' },
          },
        },
        source: 'cee_generated',
      },
      {
        id: 'opt_high',
        label: 'High Price',
        status: 'ready',
        interventions: {
          factor_price: {
            value: 150,
            source: 'brief_extraction',
            target_match: { node_id: 'factor_price', match_type: 'exact_id', confidence: 'high' },
          },
        },
        source: 'cee_generated',
      },
    ]

    // WHEN: We build the V2 request
    const { request } = buildV2Request(nodes, edges, ceeOptions, 'outcome_revenue')

    // THEN: The request should have flattened intervention values
    expect(request.options).toHaveLength(2)

    for (const option of request.options) {
      for (const [key, value] of Object.entries(option.interventions)) {
        expect(typeof value).toBe('number')
      }
    }

    // AND: The specific values should be correct
    expect(request.options[0].interventions.factor_price).toBe(80)
    expect(request.options[1].interventions.factor_price).toBe(150)
  })

  it('request payload structure matches /v2/run contract', () => {
    // GIVEN: A representative scenario
    const nodes: Node[] = [
      makeNode('factor_1', { label: 'Factor 1', kind: 'factor' }),
      makeNode('goal', { label: 'Goal', kind: 'outcome' }),
    ]
    const options: UIOption[] = [
      {
        id: 'option_a',
        label: 'Option A',
        status: 'ready',
        interventions: {
          factor_1: { value: 100, source: 'user_specified' },
        },
        source: 'user_created',
      },
    ]

    // WHEN: We build the request
    const { request } = buildV2Request(nodes, [], options, 'goal')

    // THEN: The structure should match the contract
    expect(request).toMatchObject({
      graph: {
        nodes: expect.any(Array),
        edges: expect.any(Array),
      },
      options: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(String),
          interventions: expect.any(Object),
        }),
      ]),
      goal_node_id: expect.any(String),
      seed: expect.any(String),
      detail_level: expect.stringMatching(/^(deep|summary)$/),
    })

    // AND: interventions should be Record<string, number>
    const interventions = request.options[0].interventions
    expect(Object.values(interventions).every((v) => typeof v === 'number')).toBe(true)
  })
})

// ============================================================================
// V3 Field Pass-Through Tests (CEE → PLoT preservation)
// ============================================================================

describe('V3 observed_state field pass-through', () => {
  it('preserves V3 fields (raw_value, cap, factor_type, uncertainty_drivers, extractionType)', () => {
    const node = makeNode('fac_investment', {
      label: 'Investment',
      kind: 'factor',
      observedState: {
        value: 0.2,
        unit: '£',
        source: 'cee_inference',
        raw_value: 100000,
        cap: 500000,
        extractionType: 'inferred',
        factor_type: 'cost',
        uncertainty_drivers: ['Final vendor quotes pending', 'Scope not fully defined'],
      },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.observed_state).toBeDefined()
    expect(v2Node.observed_state!.value).toBe(0.2)
    expect(v2Node.observed_state!.raw_value).toBe(100000)
    expect(v2Node.observed_state!.cap).toBe(500000)
    expect(v2Node.observed_state!.factor_type).toBe('cost')
    expect(v2Node.observed_state!.extractionType).toBe('inferred')
    expect(v2Node.observed_state!.uncertainty_drivers).toEqual([
      'Final vendor quotes pending',
      'Scope not fully defined',
    ])
  })

  it('preserves CEE-provided source (does not overwrite)', () => {
    const node = makeNode('fac_1', {
      label: 'Factor 1',
      kind: 'factor',
      observedState: {
        value: 0.5,
        source: 'cee_inference',
      },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.observed_state!.source).toBe('cee_inference')
  })

  it('uses CEE-provided std when present (does not overwrite with computed)', () => {
    const node = makeNode('fac_1', {
      label: 'Factor 1',
      kind: 'factor',
      observedState: {
        value: 100,
        std: 5,
        baseline: 90,
      },
    })

    const v2Node = transformNodeToV2(node)

    // std should be CEE's value (5), not the UI-computed value
    expect(v2Node.observed_state!.std).toBe(5)
  })

  it('computes std only when CEE did not provide it', () => {
    const node = makeNode('fac_1', {
      label: 'Factor 1',
      kind: 'factor',
      observedState: {
        value: 100,
        baseline: 80,
        // No std provided — UI should compute it
      },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.observed_state!.std).toBeGreaterThanOrEqual(STD_FLOOR)
    // delta = |100-80| = 20, computed std = max(0.001, 20*0.25) = 5
    expect(v2Node.observed_state!.std).toBe(5)
  })
})

describe('V3 node-level field pass-through', () => {
  it('preserves goal_threshold_* fields on goal nodes (node path)', () => {
    const node = makeNode('goal_growth', {
      label: 'Reach 800 Pro Customers',
      kind: 'goal',
      goal_threshold: 0.8,
      goal_threshold_raw: 800,
      goal_threshold_unit: 'count',
      goal_threshold_cap: 1000,
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.goal_threshold).toBe(0.8)
    expect(v2Node.goal_threshold_raw).toBe(800)
    expect(v2Node.goal_threshold_unit).toBe('count')
    expect(v2Node.goal_threshold_cap).toBe(1000)
  })

  it('preserves prior field on external factor nodes', () => {
    const node = makeNode('fac_external', {
      label: 'Market Conditions',
      kind: 'factor',
      category: 'external',
      prior: 0.7,
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.prior).toBe(0.7)
    expect(v2Node.category).toBe('external')
  })

  // CIL 0.2: unknown category values pass through (Task 6)
  it('preserves unknown category values for forward compatibility', () => {
    const node = makeNode('fac_derived', {
      label: 'Derived Factor',
      kind: 'factor',
      category: 'derived',
    })

    const v2Node = transformNodeToV2(node)

    // Unknown categories must pass through to PLoT (not be dropped)
    expect(v2Node.category).toBe('derived')
  })

  it('omits category when not present on node', () => {
    const node = makeNode('fac_nocategory', {
      label: 'No Category',
      kind: 'factor',
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node.category).toBeUndefined()
  })

  it('excludes React Flow internal fields from V2 output', () => {
    const node = makeNode('n1', {
      label: 'Test',
      kind: 'factor',
      // React Flow internals that must NOT leak into PLoT payload
      selected: true,
      dragging: false,
      measured: { width: 200, height: 100 },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node).not.toHaveProperty('selected')
    expect(v2Node).not.toHaveProperty('dragging')
    expect(v2Node).not.toHaveProperty('measured')
  })

  it('excludes UI-only fields (uncertainty, interventions) from V2 output', () => {
    const node = makeNode('opt1', {
      label: 'Option A',
      kind: 'option',
      uncertainty: 0.3,
      interventions: { factor_price: 100 },
    })

    const v2Node = transformNodeToV2(node)

    expect(v2Node).not.toHaveProperty('uncertainty')
    expect(v2Node).not.toHaveProperty('interventions')
  })
})

// ============================================================================
// observed_state vs observedState Naming Boundary Tests
// ============================================================================

describe('observed_state / observedState naming boundary', () => {
  it('transformNodeToV2 outputs snake_case key (observed_state) for PLoT', () => {
    const node = makeNode('fac_1', {
      label: 'Factor',
      kind: 'factor',
      observedState: { value: 42 },  // camelCase input (canvas convention)
    })

    const v2Node = transformNodeToV2(node)

    // PLoT payload must use snake_case
    expect(v2Node).toHaveProperty('observed_state')
    expect(v2Node).not.toHaveProperty('observedState')
    expect(v2Node.observed_state!.value).toBe(42)
  })

  it('camelCase observedState on canvas node does not leak as-is into V2 output', () => {
    const node = makeNode('fac_1', {
      label: 'Factor',
      kind: 'factor',
      observedState: { value: 10, source: 'cee_inference' },
    })

    const v2Node = transformNodeToV2(node)

    // observedState is in the blocklist — must not appear in output
    expect(v2Node).not.toHaveProperty('observedState')
    // But snake_case observed_state must be present
    expect(v2Node.observed_state).toBeDefined()
  })
})

// ============================================================================
// /v2/run request allowlist — CEE display metadata exclusion
// ============================================================================

describe('buildV2RequestFromAnalysisReady — display metadata exclusion', () => {
  it('excludes goal_threshold_raw, _unit, _cap from request top level', () => {
    // CEE analysis_ready includes display metadata alongside normalised fields.
    // PLoT uses extra='forbid' — only allowed fields may appear on the request.
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor', value: 100 }),
      makeNode('goal_revenue', { label: 'Revenue Target', kind: 'goal' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'goal_revenue', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [{
        id: 'opt_high',
        label: 'High Price',
        status: 'ready',
        interventions: { factor_price: { value: 150, source: 'brief_extraction' } },
      }],
      goal_node_id: 'goal_revenue',
      goal_threshold: 0.8,
      goal_threshold_raw: 800,
      goal_threshold_unit: 'count',
      goal_threshold_cap: 1000,
    }

    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    // Allowed: goal_threshold (normalised 0-1)
    expect(request.goal_threshold).toBe(0.8)

    // Excluded: CEE display metadata
    expect(request).not.toHaveProperty('goal_threshold_raw')
    expect(request).not.toHaveProperty('goal_threshold_unit')
    expect(request).not.toHaveProperty('goal_threshold_cap')
  })

  it('request contains only PLoT-accepted top-level keys', () => {
    const ALLOWED_KEYS = new Set([
      'graph', 'options', 'goal_node_id', 'goal_threshold',
      'goal_constraints', 'seed', 'detail_level', 'brief',
      'request_id',
      // Audit F-01: framing removed — PLoT rejects it (extra='forbid').
    ])

    const nodes: Node[] = [
      makeNode('f1', { label: 'Factor', kind: 'factor', value: 50 }),
      makeNode('goal', { label: 'Goal', kind: 'goal' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'f1', 'goal', { weight: 0.5, direction: 'positive', beliefExists: 0.7 }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [{
        id: 'opt1',
        label: 'Option',
        status: 'ready',
        interventions: { f1: { value: 100, source: 'brief_extraction' } },
      }],
      goal_node_id: 'goal',
      goal_threshold: 0.6,
      goal_threshold_raw: 600,
      goal_threshold_unit: 'USD',
      goal_threshold_cap: 1000,
    }

    const { request } = buildV2RequestFromAnalysisReady(
      nodes, edges, analysisReady, [], undefined,
      { brief: 'test brief', goalConstraints: [{ node_id: 'f1', operator: '>=', value: 40 }] }
    )

    // Every key on the request must be in the allowlist
    for (const key of Object.keys(request)) {
      expect(ALLOWED_KEYS).toContain(key)
    }
  })

  it('unknown analysisReady fields do not leak to request', () => {
    // Future-proof: if CEE adds new fields to analysis_ready,
    // they must NOT appear on the /v2/run request unless explicitly allowlisted.
    const nodes: Node[] = [
      makeNode('f1', { label: 'Factor', kind: 'factor', value: 50 }),
      makeNode('goal', { label: 'Goal', kind: 'goal' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'f1', 'goal', { weight: 0.5, direction: 'positive', beliefExists: 0.7 }),
    ]
    const analysisReady = {
      options: [{
        id: 'opt1',
        label: 'Option',
        status: 'ready' as const,
        interventions: { f1: { value: 100, source: 'brief_extraction' } },
      }],
      goal_node_id: 'goal',
      goal_threshold: 0.6,
      // Synthetic unknown fields that could appear in future CEE versions
      new_backend_field: 'should_not_leak',
      experimental_config: { nested: true },
      display_hint: 'compact',
    } as CEEAnalysisReady

    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    expect(request).not.toHaveProperty('new_backend_field')
    expect(request).not.toHaveProperty('experimental_config')
    expect(request).not.toHaveProperty('display_hint')
    // Allowed field still present
    expect(request.goal_threshold).toBe(0.6)
  })
})

// =============================================================================
// XOR: goal_threshold vs goal_constraints
// =============================================================================

describe('XOR: goal_threshold vs goal_constraints', () => {
  const xorNodes: Node[] = [
    makeNode('f1', { label: 'Factor', kind: 'factor', value: 50 }),
    makeNode('goal', { label: 'Goal', kind: 'goal' }),
  ]
  const xorEdges: Edge[] = [
    makeEdge('e1', 'f1', 'goal', { weight: 0.5, direction: 'positive', beliefExists: 0.7 }),
  ]
  const xorAnalysisReady: CEEAnalysisReady = {
    options: [{
      id: 'opt1',
      label: 'Option',
      status: 'ready',
      interventions: { f1: { value: 100, source: 'brief_extraction' } },
    }],
    goal_node_id: 'goal',
    goal_threshold: 0.8,
  }

  it('removes goal_threshold when goal_constraints are present (non-empty array)', () => {
    const { request } = buildV2RequestFromAnalysisReady(
      xorNodes, xorEdges, xorAnalysisReady, [], undefined,
      { goalConstraints: [{ id: 'c1', label: 'Revenue >= 500', operator: '>=', value: 500 }] }
    )

    expect(request.goal_constraints).toHaveLength(1)
    expect(request).not.toHaveProperty('goal_threshold')
  })

  it('preserves goal_threshold when goal_constraints is empty array', () => {
    const { request } = buildV2RequestFromAnalysisReady(
      xorNodes, xorEdges, xorAnalysisReady, [], undefined,
      { goalConstraints: [] }
    )

    expect(request.goal_threshold).toBe(0.8)
    expect(request).not.toHaveProperty('goal_constraints')
  })

  it('preserves goal_threshold when goal_constraints is absent', () => {
    const { request } = buildV2RequestFromAnalysisReady(
      xorNodes, xorEdges, xorAnalysisReady
    )

    expect(request.goal_threshold).toBe(0.8)
    expect(request).not.toHaveProperty('goal_constraints')
  })

  it('preserves goal_constraints when goal_threshold is absent', () => {
    const noThreshold: CEEAnalysisReady = {
      ...xorAnalysisReady,
      goal_threshold: undefined,
    }
    const { request } = buildV2RequestFromAnalysisReady(
      xorNodes, xorEdges, noThreshold, [], undefined,
      { goalConstraints: [{ id: 'c1', label: 'Revenue >= 500', operator: '>=', value: 500 }] }
    )

    expect(request.goal_constraints).toHaveLength(1)
    expect(request).not.toHaveProperty('goal_threshold')
  })

  it('execute path: goal_threshold re-injected via parameter is removed when goal_constraints exist', () => {
    // Regression test for executeV2RunWithAnalysisReady (adapter.ts:1186-1196).
    // The builder XOR removes goal_threshold, but the execute path can re-inject
    // it via the goalThreshold parameter. The second XOR must catch this.
    const { request } = buildV2RequestFromAnalysisReady(
      xorNodes, xorEdges, xorAnalysisReady, [], undefined,
      { goalConstraints: [{ id: 'c1', label: 'Revenue >= 500', operator: '>=', value: 500 }] }
    )

    // Builder XOR already removed goal_threshold
    expect(request).not.toHaveProperty('goal_threshold')

    // Simulate execute path: goalThreshold parameter re-injects after builder
    request.goal_threshold = 0.8

    // Apply the same XOR pattern as executeV2RunWithAnalysisReady (adapter.ts:1194-1196)
    if (Array.isArray(request.goal_constraints) && request.goal_constraints.length > 0) {
      delete request.goal_threshold
    }

    expect(request).not.toHaveProperty('goal_threshold')
    expect(request.goal_constraints).toHaveLength(1)
  })
})

// =============================================================================
// buildV2Request: scenario comparison path
// =============================================================================

describe('buildV2Request (scenario comparison path)', () => {
  it('does not include goal_constraints in request', () => {
    const nodes: Node[] = [
      makeNode('f1', { label: 'Factor', kind: 'factor', value: 50 }),
      makeNode('goal', { label: 'Goal', kind: 'goal' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'f1', 'goal', { weight: 0.5, direction: 'positive', beliefExists: 0.7 }),
    ]
    const options: UIOption[] = [{
      id: 'opt1',
      label: 'Option',
      status: 'ready',
      interventions: { f1: { value: 100, source: 'brief_extraction' as const } },
    }]

    const { request } = buildV2Request(nodes, edges, options, 'goal')

    expect(request).not.toHaveProperty('goal_constraints')
    expect(request).not.toHaveProperty('goal_threshold')
  })
})
