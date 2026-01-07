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

  it('defaults to 0.5 for missing values', () => {
    const edge = makeEdge('e1', 'n1', 'n2', {})

    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.strength.mean).toBe(0.5)
    expect(v2Edge.exists_probability).toBe(0.5)
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
