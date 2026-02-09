/**
 * Schema round-trip validation tests.
 *
 * Ensures all schemas can parse and validate correctly.
 */

import { describe, it, expect } from 'vitest'
import {
  NodeV3Schema,
  EdgeV3Schema,
  OptionForAnalysisSchema,
  AnalysisReadyV3Schema,
  FactorSensitivitySchema,
  FragileEdgeSchema,
  SeedConfigSchema,
  isNodeV3,
  isEdgeV3,
  isOptionForAnalysis,
  isAnalysisReadyV3,
  isFullyReady,
} from '../src'

describe('NodeV3Schema', () => {
  it('validates a minimal node', () => {
    const node = {
      id: 'goal_revenue',
      kind: 'goal',
      label: 'Increase Revenue',
    }

    const result = NodeV3Schema.safeParse(node)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('goal_revenue')
      expect(result.data.kind).toBe('goal')
    }
  })

  it('validates a node with observed_state', () => {
    const node = {
      id: 'factor_price',
      kind: 'factor',
      label: 'Price',
      category: 'controllable',
      observed_state: {
        value: 0.5,
        std: 0.1,
        baseline: 0.6,
        unit: 'USD',
        source: 'user_specified',
        raw_value: 100,
        cap: 200,
      },
    }

    const result = NodeV3Schema.safeParse(node)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.observed_state?.value).toBe(0.5)
      expect(result.data.observed_state?.raw_value).toBe(100)
    }
  })

  it('validates a goal node with threshold fields', () => {
    const node = {
      id: 'goal_revenue',
      kind: 'goal',
      label: 'Revenue Goal',
      goal_threshold: 0.8,
      goal_threshold_raw: 1000000,
      goal_threshold_unit: 'USD',
      goal_threshold_cap: 1500000,
    }

    const result = NodeV3Schema.safeParse(node)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.goal_threshold).toBe(0.8)
      expect(result.data.goal_threshold_raw).toBe(1000000)
    }
  })

  it('rejects invalid node IDs (must match ISL V2 format)', () => {
    const invalidNodes = [
      { id: 'Goal_Revenue', kind: 'goal', label: 'Uppercase start' },
      { id: '123_node', kind: 'factor', label: 'Digit start' },
      { id: 'test node', kind: 'factor', label: 'Space' },
    ]

    for (const node of invalidNodes) {
      const result = NodeV3Schema.safeParse(node)
      expect(result.success).toBe(false)
    }
  })

  it('accepts valid canonical node IDs', () => {
    const validNodes = [
      { id: 'test_node', kind: 'goal', label: 'Valid' },
      { id: 'goal-revenue', kind: 'goal', label: 'Hyphen' },
      { id: 'factor_a:v2', kind: 'factor', label: 'Colon' },
    ]

    for (const node of validNodes) {
      const result = NodeV3Schema.safeParse(node)
      expect(result.success).toBe(true)
    }
  })

  it('type guard works correctly', () => {
    const validNode = {
      id: 'test_node',
      kind: 'factor',
      label: 'Test',
    }
    const invalidNode = {
      id: '123',
      kind: 'invalid',
    }

    expect(isNodeV3(validNode)).toBe(true)
    expect(isNodeV3(invalidNode)).toBe(false)
  })
})

describe('EdgeV3Schema', () => {
  it('validates a complete edge (canonical contract)', () => {
    const edge = {
      from: 'factor_price',
      to: 'goal_revenue',
      strength: {
        mean: 0.7,
        std: 0.1,
      },
      exists_probability: 0.9,
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.strength.mean).toBe(0.7)
      expect(result.data.exists_probability).toBe(0.9)
    }
  })

  it('rejects edge without required strength field', () => {
    // Canonical EdgeV3Schema requires strength (CEE guarantees it)
    const edge = {
      from: 'factor_a',
      to: 'factor_b',
      exists_probability: 0.8,
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(false)
  })

  it('rejects edge without required exists_probability field', () => {
    // Canonical EdgeV3Schema requires exists_probability
    const edge = {
      from: 'factor_a',
      to: 'factor_b',
      strength: { mean: 0.5, std: 0.1 },
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(false)
  })

  it('validates edge with effect_direction', () => {
    const edge = {
      from: 'factor_price',
      to: 'goal_revenue',
      strength: {
        mean: -0.5,
        std: 0.15,
      },
      exists_probability: 0.85,
      effect_direction: 'negative',
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.effect_direction).toBe('negative')
    }
  })

  it('rejects strength mean outside [-1, 1] when strength provided', () => {
    const edge = {
      from: 'a',
      to: 'b',
      strength: {
        mean: 1.5,  // Invalid
        std: 0.1,
      },
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(false)
  })

  it('rejects negative std when strength provided', () => {
    const edge = {
      from: 'a',
      to: 'b',
      strength: {
        mean: 0.5,
        std: -0.1,  // Invalid
      },
    }

    const result = EdgeV3Schema.safeParse(edge)
    expect(result.success).toBe(false)
  })

  it('type guard works correctly', () => {
    const validEdge = {
      from: 'a',
      to: 'b',
      strength: { mean: 0.5, std: 0.1 },
      exists_probability: 0.9,
    }
    const invalidEdge = {
      from: 'a',
      // Missing required fields
    }

    expect(isEdgeV3(validEdge)).toBe(true)
    expect(isEdgeV3(invalidEdge)).toBe(false)
  })
})

describe('OptionForAnalysisSchema', () => {
  it('validates a ready option', () => {
    const option = {
      id: 'option_discount',
      label: '20% Discount',
      status: 'ready',
      interventions: {
        'factor_price': 0.8,
        'factor_quality': 0.95,
      },
    }

    const result = OptionForAnalysisSchema.safeParse(option)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('ready')
      expect(Object.keys(result.data.interventions).length).toBe(2)
    }
  })

  it('validates option with raw_interventions', () => {
    const option = {
      id: 'option_a',
      label: 'Option A',
      status: 'needs_encoding',
      interventions: {
        'factor_color': 0.5,
      },
      raw_interventions: {
        'factor_color': 'red',
      },
    }

    const result = OptionForAnalysisSchema.safeParse(option)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.raw_interventions?.factor_color).toBe('red')
    }
  })

  it('type guard works correctly', () => {
    const validOption = {
      id: 'opt1',
      label: 'Option 1',
      status: 'ready',
      interventions: {},
    }
    const invalidOption = {
      id: 'opt2',
      // Missing required fields
    }

    expect(isOptionForAnalysis(validOption)).toBe(true)
    expect(isOptionForAnalysis(invalidOption)).toBe(false)
  })
})

describe('AnalysisReadyV3Schema', () => {
  it('validates a ready analysis payload', () => {
    const payload = {
      status: 'ready',
      options: [
        {
          id: 'option_a',
          label: 'Option A',
          status: 'ready',
          interventions: { 'factor_x': 0.5 },
        },
      ],
      goal_node_id: 'goal_revenue',
      suggested_seed: '42',
    }

    const result = AnalysisReadyV3Schema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('ready')
      expect(result.data.options.length).toBe(1)
    }
  })

  it('validates payload with goal threshold fields', () => {
    const payload = {
      status: 'ready',
      options: [
        {
          id: 'opt1',
          label: 'Option 1',
          status: 'ready',
          interventions: {},
        },
      ],
      goal_node_id: 'goal_revenue',
      goal_threshold: 0.8,
      goal_threshold_raw: 1000000,
      goal_threshold_unit: 'USD',
      goal_threshold_cap: 1500000,
    }

    const result = AnalysisReadyV3Schema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.goal_threshold).toBe(0.8)
      expect(result.data.goal_threshold_raw).toBe(1000000)
    }
  })

  it('isFullyReady returns true when status is ready and has options', () => {
    const payload = {
      status: 'ready' as const,
      options: [
        {
          id: 'opt1',
          label: 'Option 1',
          status: 'ready' as const,
          interventions: {},
        },
      ],
      goal_node_id: 'goal_revenue',
    }

    expect(isFullyReady(payload)).toBe(true)
  })

  it('isFullyReady returns false when status is not ready', () => {
    const payload = {
      status: 'needs_encoding' as const,
      options: [
        {
          id: 'opt1',
          label: 'Option 1',
          status: 'needs_encoding' as const,
          interventions: {},
        },
      ],
      goal_node_id: 'goal_revenue',
    }

    expect(isFullyReady(payload)).toBe(false)
  })

  it('type guard works correctly', () => {
    const valid = {
      status: 'ready',
      options: [],
      goal_node_id: 'goal',
    }
    const invalid = {
      status: 'invalid_status',
    }

    expect(isAnalysisReadyV3(valid)).toBe(true)
    expect(isAnalysisReadyV3(invalid)).toBe(false)
  })
})

describe('FactorSensitivitySchema', () => {
  it('validates a complete sensitivity result', () => {
    const sensitivity = {
      node_id: 'factor_price',
      label: 'Price',
      importance_score: 0.85,
      sensitivity_score: 0.75,
      elasticity: 1.2,
      direction: 'positive',
      importance_rank: 1,
      confidence: 0.9,
    }

    const result = FactorSensitivitySchema.safeParse(sensitivity)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.importance_rank).toBe(1)
      expect(result.data.direction).toBe('positive')
    }
  })

  it('rejects importance_score outside [0, 1]', () => {
    const sensitivity = {
      node_id: 'factor_x',
      label: 'X',
      importance_score: 1.5,  // Invalid
      sensitivity_score: 0.5,
      elasticity: 1.0,
      direction: 'positive',
      importance_rank: 1,
    }

    const result = FactorSensitivitySchema.safeParse(sensitivity)
    expect(result.success).toBe(false)
  })
})

describe('FragileEdgeSchema', () => {
  it('validates a fragile edge result', () => {
    const fragileEdge = {
      edge_id: 'factor_a->goal_b',
      from_id: 'factor_a',
      to_id: 'goal_b',
      current_strength: 0.5,
      threshold: 0.3,
      impact_on_outcome: 0.2,
    }

    const result = FragileEdgeSchema.safeParse(fragileEdge)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.edge_id).toBe('factor_a->goal_b')
      expect(result.data.impact_on_outcome).toBe(0.2)
    }
  })
})

describe('SeedConfigSchema', () => {
  it('validates a seed config', () => {
    const config = {
      seed: '42',
      seed_source: 'user_provided',
    }

    const result = SeedConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.seed).toBe('42')
      expect(result.data.seed_source).toBe('user_provided')
    }
  })
})
