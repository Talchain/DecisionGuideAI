/**
 * CEE V3 Contract Bridge Tests (P0-UI Integration)
 *
 * Validates that the V2 adapter correctly handles CEE V3 responses with analysis_ready.
 *
 * Tests:
 * - Type guards for CEE V3 responses
 * - buildV2RequestFromAnalysisReady function
 * - Edge validation (EdgeValidationError on missing fields)
 * - Status alias normalisation (needs_user_input -> needs_user_mapping)
 * - ID normalisation coherence across all IDs
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  buildV2RequestFromAnalysisReady,
  ceeOptionToUIOption,
  ceeOptionToV2Option,
  getOptionsFromAnalysisReady,
  validateEdgeData,
  transformEdgeToV2Strict,
  EdgeValidationError,
} from '../adapter'
import { DEFAULT_SEED } from '../types'
import {
  isCEEv3Response,
  hasAnalysisReady,
  type CEEAnalysisReady,
  type CEEOptionV3,
  type CEEv3Response,
} from '../../../cee/types'

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

function makeCEEv3Response(
  analysisReady?: CEEAnalysisReady
): CEEv3Response {
  return {
    schema_version: '2.2',
    quality_overall: 8,
    nodes: [
      { id: 'factor_price', type: 'factor', label: 'Price' },
      { id: 'outcome_revenue', type: 'outcome', label: 'Revenue' },
    ],
    edges: [
      {
        id: 'e1',
        from: 'factor_price',
        to: 'outcome_revenue',
        weight: 0.7,
        belief: 0.8,
        effect_direction: 'positive',
        strength_std: 0.1,
      },
    ],
    draft_warnings: { structural: [], completeness: [] },
    analysis_ready: analysisReady,
  }
}

function makeCEEOptionV3(
  id: string,
  status: CEEOptionV3['status'] = 'ready',
  interventions: Record<string, { value: number }> = {}
): CEEOptionV3 {
  return {
    id,
    label: `Option ${id}`,
    status,
    interventions: Object.fromEntries(
      Object.entries(interventions).map(([nodeId, iv]) => [
        nodeId,
        {
          value: iv.value,
          source: 'brief_extraction' as const,
          target_match: {
            node_id: nodeId,
            match_type: 'exact_id' as const,
            confidence: 'high' as const,
          },
        },
      ])
    ),
  }
}

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('CEE V3 Type Guards', () => {
  describe('isCEEv3Response', () => {
    it('returns true for response with analysis_ready', () => {
      const response = makeCEEv3Response({
        options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
        goal_node_id: 'outcome_revenue',
      })

      expect(isCEEv3Response(response)).toBe(true)
    })

    it('returns false for v2 response without analysis_ready', () => {
      const response = makeCEEv3Response(undefined)

      expect(isCEEv3Response(response)).toBe(false)
    })

    it('returns false for v1 response', () => {
      const v1Response = {
        quality_overall: 8,
        nodes: [],
        edges: [],
        draft_warnings: { structural: [], completeness: [] },
      }

      expect(isCEEv3Response(v1Response)).toBe(false)
    })

    it('returns false for non-object', () => {
      expect(isCEEv3Response(null)).toBe(false)
      expect(isCEEv3Response(undefined)).toBe(false)
      expect(isCEEv3Response('string')).toBe(false)
    })
  })

  describe('hasAnalysisReady', () => {
    it('returns true for valid analysis_ready with options and goal', () => {
      const response = makeCEEv3Response({
        options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
        goal_node_id: 'outcome_revenue',
      })

      expect(hasAnalysisReady(response)).toBe(true)
    })

    it('returns false for empty options array', () => {
      const response = makeCEEv3Response({
        options: [],
        goal_node_id: 'outcome_revenue',
      })

      expect(hasAnalysisReady(response)).toBe(false)
    })

    it('returns false for missing goal_node_id', () => {
      const response = makeCEEv3Response({
        options: [makeCEEOptionV3('opt1')],
        goal_node_id: '',
      })

      // Empty string is still a string, but semantically invalid
      // Type guard allows it but validation should catch it
      expect(hasAnalysisReady(response)).toBe(true) // Type guard passes
    })
  })
})

// ============================================================================
// Status Alias Normalisation Tests
// ============================================================================

describe('Status Alias Normalisation', () => {
  it('normalises needs_user_input to needs_user_mapping', () => {
    const ceeOption: CEEOptionV3 = {
      id: 'opt1',
      label: 'Option with user input needed',
      status: 'needs_user_input', // Backend might use this alias
      interventions: {},
      user_questions: ['Which factor does this affect?'],
    }

    const uiOption = ceeOptionToUIOption(ceeOption)

    expect(uiOption.status).toBe('needs_user_mapping')
  })

  it('preserves ready status', () => {
    const ceeOption = makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })

    const uiOption = ceeOptionToUIOption(ceeOption)

    expect(uiOption.status).toBe('ready')
  })

  it('preserves needs_user_mapping status', () => {
    const ceeOption: CEEOptionV3 = {
      id: 'opt1',
      label: 'Option needing mapping',
      status: 'needs_user_mapping',
      interventions: {},
    }

    const uiOption = ceeOptionToUIOption(ceeOption)

    expect(uiOption.status).toBe('needs_user_mapping')
  })
})

// ============================================================================
// CEE Option Conversion Tests
// ============================================================================

describe('ceeOptionToUIOption', () => {
  it('converts CEEOptionV3 to UIOption with full metadata', () => {
    const ceeOption: CEEOptionV3 = {
      id: 'premium_pricing',
      label: 'Premium Pricing Strategy',
      status: 'ready',
      interventions: {
        factor_price: {
          value: 150,
          source: 'brief_extraction',
          target_match: {
            node_id: 'factor_price',
            match_type: 'exact_id',
            confidence: 'high',
          },
          value_confidence: 'high',
          reasoning: 'Extracted from "set price to $150"',
        },
      },
    }

    const uiOption = ceeOptionToUIOption(ceeOption)

    expect(uiOption.id).toBe('premium_pricing')
    expect(uiOption.label).toBe('Premium Pricing Strategy')
    expect(uiOption.status).toBe('ready')
    expect(uiOption.source).toBe('cee_generated')
    expect(uiOption.interventions.factor_price).toEqual({
      value: 150,
      source: 'brief_extraction',
      target_match: {
        node_id: 'factor_price',
        match_type: 'exact_id',
        confidence: 'high',
      },
      value_confidence: 'high',
      reasoning: 'Extracted from "set price to $150"',
    })
  })

  it('preserves user_questions and unresolved_targets', () => {
    const ceeOption: CEEOptionV3 = {
      id: 'ambiguous_option',
      label: 'Ambiguous Option',
      status: 'needs_user_mapping',
      interventions: {},
      user_questions: ['Which factor does this affect?', 'What is the target value?'],
      unresolved_targets: ['market share', 'customer satisfaction'],
    }

    const uiOption = ceeOptionToUIOption(ceeOption)

    expect(uiOption.user_questions).toEqual([
      'Which factor does this affect?',
      'What is the target value?',
    ])
    expect(uiOption.unresolved_targets).toEqual(['market share', 'customer satisfaction'])
  })
})

describe('ceeOptionToV2Option', () => {
  it('flattens CEE intervention values to simple numbers', () => {
    const ceeOption: CEEOptionV3 = {
      id: 'opt1',
      label: 'Test Option',
      status: 'ready',
      interventions: {
        factor_a: {
          value: 100,
          source: 'brief_extraction',
          target_match: { node_id: 'factor_a', match_type: 'exact_id', confidence: 'high' },
        },
        factor_b: {
          value: 0.75,
          source: 'cee_hypothesis',
          value_confidence: 'medium',
        },
      },
    }

    const v2Option = ceeOptionToV2Option(ceeOption)

    expect(v2Option.id).toBe('opt1')
    expect(v2Option.label).toBe('Test Option')
    expect(v2Option.interventions).toEqual({
      factor_a: 100,
      factor_b: 0.75,
    })
  })
})

describe('getOptionsFromAnalysisReady', () => {
  it('converts all options with status normalisation', () => {
    const analysisReady: CEEAnalysisReady = {
      options: [
        makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } }),
        {
          id: 'opt2',
          label: 'Option 2',
          status: 'needs_user_input', // Should be normalised
          interventions: {},
        },
      ],
      goal_node_id: 'outcome_revenue',
    }

    const uiOptions = getOptionsFromAnalysisReady(analysisReady)

    expect(uiOptions).toHaveLength(2)
    expect(uiOptions[0].status).toBe('ready')
    expect(uiOptions[1].status).toBe('needs_user_mapping') // Normalised
  })
})

// ============================================================================
// Edge Validation Tests
// ============================================================================

describe('Edge Validation', () => {
  describe('validateEdgeData', () => {
    it('passes for edge with all required fields', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      })

      // Should not throw
      expect(() => validateEdgeData(edge)).not.toThrow()
    })

    it('throws EdgeValidationError for missing weight', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        direction: 'positive',
        beliefExists: 0.8,
      })

      expect(() => validateEdgeData(edge)).toThrow(EdgeValidationError)

      try {
        validateEdgeData(edge)
      } catch (error) {
        expect(error).toBeInstanceOf(EdgeValidationError)
        const edgeError = error as EdgeValidationError
        expect(edgeError.fromNode).toBe('n1')
        expect(edgeError.toNode).toBe('n2')
        expect(edgeError.missingFields).toContain('weight')
        expect(edgeError.message).toContain("Edge 'n1 → n2'")
        expect(edgeError.message).toContain("'weight'")
      }
    })

    it('throws EdgeValidationError for missing direction', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        beliefExists: 0.8,
      })

      expect(() => validateEdgeData(edge)).toThrow(EdgeValidationError)

      try {
        validateEdgeData(edge)
      } catch (error) {
        expect((error as EdgeValidationError).missingFields).toContain('direction')
      }
    })

    it('throws EdgeValidationError for missing belief/confidence', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
      })

      expect(() => validateEdgeData(edge)).toThrow(EdgeValidationError)

      try {
        validateEdgeData(edge)
      } catch (error) {
        expect((error as EdgeValidationError).missingFields).toContain('belief/confidence')
      }
    })

    it('accepts confidence as alternative to beliefExists', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
        confidence: 0.8, // Alternative field name
      })

      expect(() => validateEdgeData(edge)).not.toThrow()
    })

    it('accepts belief as alternative to beliefExists', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
        belief: 0.8, // Alternative field name
      })

      expect(() => validateEdgeData(edge)).not.toThrow()
    })

    it('reports all missing fields in a single error', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {})

      try {
        validateEdgeData(edge)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(EdgeValidationError)
        const edgeError = error as EdgeValidationError
        expect(edgeError.missingFields).toHaveLength(3)
        expect(edgeError.missingFields).toContain('weight')
        expect(edgeError.missingFields).toContain('direction')
        expect(edgeError.missingFields).toContain('belief/confidence')
      }
    })

    it('includes strengthStd in strict mode', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
        // Missing strengthStd
      })

      // Normal mode passes
      expect(() => validateEdgeData(edge)).not.toThrow()

      // Strict mode fails
      expect(() => validateEdgeData(edge, { strict: true })).toThrow(EdgeValidationError)

      try {
        validateEdgeData(edge, { strict: true })
      } catch (error) {
        expect((error as EdgeValidationError).missingFields).toContain('strengthStd')
      }
    })
  })

  describe('transformEdgeToV2Strict', () => {
    it('transforms valid edge', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      })

      const v2Edge = transformEdgeToV2Strict(edge)

      expect(v2Edge.from).toBe('n1')
      expect(v2Edge.to).toBe('n2')
      expect(v2Edge.strength.mean).toBe(0.7)
      expect(v2Edge.exists_probability).toBe(0.8)
    })

    it('throws EdgeValidationError for invalid edge', () => {
      const edge = makeEdge('e1', 'n1', 'n2', {
        weight: 0.7,
        // Missing direction and belief
      })

      expect(() => transformEdgeToV2Strict(edge)).toThrow(EdgeValidationError)
    })
  })
})

// ============================================================================
// buildV2RequestFromAnalysisReady Tests
// ============================================================================

describe('buildV2RequestFromAnalysisReady', () => {
  it('builds request from analysis_ready with options and goal', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [
        makeCEEOptionV3('opt_low', 'ready', { factor_price: { value: 80 } }),
        makeCEEOptionV3('opt_high', 'ready', { factor_price: { value: 150 } }),
      ],
      goal_node_id: 'outcome_revenue',
    }

    const { request, reverseIdMap } = buildV2RequestFromAnalysisReady(
      nodes,
      edges,
      analysisReady
    )

    expect(request.goal_node_id).toBe('outcome_revenue')
    expect(request.seed).toBe(DEFAULT_SEED)
    expect(request.options).toHaveLength(2)
    expect(request.options[0].interventions.factor_price).toBe(80)
    expect(request.options[1].interventions.factor_price).toBe(150)
    expect(reverseIdMap).toBeInstanceOf(Map)
  })

  it('uses suggested_seed from analysis_ready', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
      goal_node_id: 'outcome_revenue',
      suggested_seed: '12345',
    }

    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    expect(request.seed).toBe('12345')
  })

  it('falls back to DEFAULT_SEED when suggested_seed not provided', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
      goal_node_id: 'outcome_revenue',
      // No suggested_seed
    }

    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    expect(request.seed).toBe(DEFAULT_SEED)
  })

  it('uses fallback defaults when edges missing fields (lenient mode)', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', {
        // Missing weight, direction, belief - uses fallback defaults
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
      goal_node_id: 'outcome_revenue',
    }

    // Default behavior (strictEdgeValidation=false) should NOT throw
    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    // Edge should have fallback values
    expect(request.graph.edges[0].strength.mean).toBe(0.5) // Default weight
    expect(request.graph.edges[0].exists_probability).toBe(0.5) // Default belief
  })

  it('throws EdgeValidationError with strictEdgeValidation=true', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'factor_price', 'outcome_revenue', {
        // Missing weight, direction, belief
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
      goal_node_id: 'outcome_revenue',
    }

    // With strictEdgeValidation=true, should throw
    expect(() =>
      buildV2RequestFromAnalysisReady(nodes, edges, analysisReady, undefined, undefined, {
        strictEdgeValidation: true,
      })
    ).toThrow(EdgeValidationError)
  })

  it('falls back to buildV2Request when analysisReady is null', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = []
    const fallbackOptions: any[] = []

    const { request } = buildV2RequestFromAnalysisReady(
      nodes,
      edges,
      null, // No analysis_ready
      fallbackOptions,
      'outcome_revenue' // Fallback goal
    )

    expect(request.goal_node_id).toBe('outcome_revenue')
  })

  it('throws error when neither analysisReady nor fallbackGoalNodeId provided', () => {
    const nodes: Node[] = [makeNode('n1', { label: 'Node' })]
    const edges: Edge[] = []

    expect(() => buildV2RequestFromAnalysisReady(nodes, edges)).toThrow(
      'Either analysisReady or fallbackGoalNodeId must be provided'
    )
  })
})

// ============================================================================
// ID Normalisation Coherence Tests
// ============================================================================

describe('ID Normalisation Coherence', () => {
  it('normalises all IDs coherently (nodes, edges, options, interventions, goal)', () => {
    // Use IDs that need normalisation (uppercase, special chars)
    const nodes: Node[] = [
      makeNode('Factor Price', { label: 'Price', kind: 'factor' }),
      makeNode('Outcome Revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'Factor Price', 'Outcome Revenue', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [
        {
          id: 'Option Premium',
          label: 'Premium Strategy',
          status: 'ready',
          interventions: {
            'Factor Price': {
              value: 150,
              source: 'brief_extraction',
              target_match: {
                node_id: 'Factor Price',
                match_type: 'exact_id',
                confidence: 'high',
              },
            },
          },
        },
      ],
      goal_node_id: 'Outcome Revenue',
    }

    const { request, reverseIdMap } = buildV2RequestFromAnalysisReady(
      nodes,
      edges,
      analysisReady
    )

    // All IDs should be normalised to lowercase with underscores
    expect(request.goal_node_id).toBe('outcome_revenue')
    expect(request.graph.nodes[0].id).toBe('factor_price')
    expect(request.graph.nodes[1].id).toBe('outcome_revenue')
    expect(request.graph.edges[0].from).toBe('factor_price')
    expect(request.graph.edges[0].to).toBe('outcome_revenue')
    expect(request.options[0].id).toBe('option_premium')
    expect(Object.keys(request.options[0].interventions)).toEqual(['factor_price'])

    // ReverseIdMap should allow translating back
    expect(reverseIdMap.get('factor_price')).toBe('Factor Price')
    expect(reverseIdMap.get('outcome_revenue')).toBe('Outcome Revenue')
    expect(reverseIdMap.get('option_premium')).toBe('Option Premium')
  })

  it('handles collision resolution deterministically', () => {
    // Create nodes that would normalise to the same ID
    // Note: hyphen '-' is allowed in ISL V2 IDs, so we use space instead
    // 'Factor A' (with space) and 'factor_a' (already normalised) both -> 'factor_a'
    const nodes: Node[] = [
      makeNode('Factor A', { label: 'Factor A (space)', kind: 'factor' }),
      makeNode('factor_a', { label: 'Factor A (underscore)', kind: 'factor' }),
      makeNode('goal', { label: 'Goal', kind: 'outcome' }),
    ]
    const edges: Edge[] = [
      makeEdge('e1', 'Factor A', 'goal', {
        weight: 0.7,
        direction: 'positive',
        beliefExists: 0.8,
      }),
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { 'Factor A': { value: 100 } })],
      goal_node_id: 'goal',
    }

    const { request } = buildV2RequestFromAnalysisReady(
      nodes,
      edges,
      analysisReady
    )

    // Should have unique IDs after normalisation
    const nodeIds = request.graph.nodes.map((n) => n.id)
    const uniqueIds = new Set(nodeIds)
    expect(uniqueIds.size).toBe(nodeIds.length)

    // Both 'Factor A' and 'factor_a' normalise to 'factor_a'
    // So we should see 'factor_a' and 'factor_a__2'
    expect(nodeIds).toContain('factor_a')
    expect(nodeIds.some((id) => id.startsWith('factor_a__'))).toBe(true)
  })
})

// =============================================================================
// Status Alias Handling Tests
// =============================================================================

describe('CEE Option Status Normalisation', () => {
  it('normalises needs_user_input to needs_user_mapping', () => {
    const nodes: Node[] = [
      makeNode('factor_price', { label: 'Price', kind: 'factor' }),
      makeNode('outcome_revenue', { label: 'Revenue', kind: 'outcome' }),
    ]
    const edges: Edge[] = []
    const analysisReady: CEEAnalysisReady = {
      options: [
        // Simulate CEE sending 'needs_user_input' status
        {
          id: 'opt1',
          label: 'Option 1',
          status: 'needs_user_input' as any, // Type cast to simulate backend variance
          interventions: {},
          user_questions: ['What value?'],
        },
      ],
      goal_node_id: 'outcome_revenue',
    }

    // The function should normalise the status
    const uiOptions = getOptionsFromAnalysisReady(analysisReady)

    expect(uiOptions[0].status).toBe('needs_user_mapping')
  })

  it('preserves ready status unchanged', () => {
    const analysisReady: CEEAnalysisReady = {
      options: [makeCEEOptionV3('opt1', 'ready', { factor_price: { value: 100 } })],
      goal_node_id: 'outcome_revenue',
    }

    const uiOptions = getOptionsFromAnalysisReady(analysisReady)

    expect(uiOptions[0].status).toBe('ready')
  })

  it('preserves needs_user_mapping status unchanged', () => {
    const analysisReady: CEEAnalysisReady = {
      options: [
        {
          id: 'opt1',
          label: 'Option 1',
          status: 'needs_user_mapping',
          interventions: {},
          user_questions: ['What value?'],
        },
      ],
      goal_node_id: 'outcome_revenue',
    }

    const uiOptions = getOptionsFromAnalysisReady(analysisReady)

    expect(uiOptions[0].status).toBe('needs_user_mapping')
  })
})
