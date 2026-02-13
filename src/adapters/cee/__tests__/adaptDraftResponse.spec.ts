/**
 * adaptDraftResponse edge spread-first tests
 *
 * CIL Phase 0: Validates that unknown/additive CEE edge fields survive
 * through the adapter, and that all currently-used fields are correctly
 * present after adaptation (regression guard).
 */

import { describe, it, expect } from 'vitest'
import { adaptDraftResponse } from '../client'

describe('adaptDraftResponse – edge spread-first', () => {
  // --- Unknown field preservation ---

  it('preserves unknown/additive edge fields through adaptation', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          {
            from: 'a',
            to: 'b',
            weight: 0.5,
            new_contract_field: 'preserved',
            edge_type: 'causal',
            cil_metadata: { version: 2 },
          },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges).toHaveLength(1)

    const edge = result.edges[0]
    expect(edge.from).toBe('a')
    expect(edge.to).toBe('b')
    expect(edge.weight).toBe(0.5)
    // Unknown fields must survive
    expect((edge as any).new_contract_field).toBe('preserved')
    expect((edge as any).edge_type).toBe('causal')
    expect((edge as any).cil_metadata).toEqual({ version: 2 })
  })

  it('preserves unknown fields on root-level edges (non-graph path)', () => {
    const raw = {
      nodes: [
        { id: 'x', label: 'X', type: 'factor', uncertainty: 0.3 },
        { id: 'y', label: 'Y', type: 'goal', uncertainty: 0.1 },
      ],
      edges: [
        {
          from: 'x',
          to: 'y',
          weight: 0.7,
          future_field: 42,
        },
      ],
      quality_overall: 7,
      draft_warnings: { structural: [], completeness: [] },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges).toHaveLength(1)
    // Root-level path passes through directly — unknown field preserved
    expect((result.edges[0] as any).future_field).toBe(42)
  })

  // --- Regression: all currently-used fields ---

  it('correctly adapts all known edge fields (regression)', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'n1', label: 'Price', kind: 'factor' },
          { id: 'n2', label: 'Revenue', kind: 'goal' },
        ],
        edges: [
          {
            id: 'e1',
            from: 'n1',
            to: 'n2',
            weight: 0.8,
            belief: 0.9,
            effect_direction: 'negative',
            strength_mean: 0.75,
            strength_std: 0.12,
            belief_exists: 0.95,
            provenance: { source: 'doc', quote: 'price drives revenue', location: 'p3' },
            provenance_source: 'document',
          },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges).toHaveLength(1)

    const edge = result.edges[0]
    expect(edge.id).toBe('e1')
    expect(edge.from).toBe('n1')
    expect(edge.to).toBe('n2')
    expect(edge.weight).toBe(0.8)
    expect(edge.belief).toBe(0.9)
    expect((edge as any).effect_direction).toBe('negative')
    expect((edge as any).strength_mean).toBe(0.75)
    expect((edge as any).strength_std).toBe(0.12)
    expect((edge as any).belief_exists).toBe(0.95)
    expect(edge.provenance).toEqual({ source: 'doc', quote: 'price drives revenue', location: 'p3' })
    expect(edge.provenance_source).toBe('document')
  })

  it('clamps weight to [0,1] and belief to [0,1]', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', weight: 1.5, belief: 1.3 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const edge = result.edges[0]
    expect(edge.weight).toBe(1)
    expect(edge.belief).toBe(1)
  })

  it('normalizes strength_mean from nested strength object', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', strength: { mean: 0.6, std: 0.1 } },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const edge = result.edges[0]
    expect((edge as any).strength_mean).toBe(0.6)
    expect((edge as any).strength_std).toBe(0.1)
  })

  it('drops edges with missing from/to', () => {
    const raw = {
      graph: {
        nodes: [{ id: 'a', label: 'A', kind: 'factor' }],
        edges: [
          { from: 'a', weight: 0.5, new_field: 'should_be_dropped' },
          { to: 'a', weight: 0.5 },
          { from: '', to: 'a', weight: 0.5 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges).toHaveLength(0)
  })

  it('coerces numeric from/to to strings', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 1, label: 'A', kind: 'factor' },
          { id: 2, label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 1, to: 2, weight: 0.5, extra: true },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].from).toBe('1')
    expect(result.edges[0].to).toBe('2')
    // Unknown field preserved even with numeric coercion
    expect((result.edges[0] as any).extra).toBe(true)
  })

  it('validates effect_direction against known values', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', effect_direction: 'invalid_value' },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    // Invalid effect_direction should be overridden to undefined
    expect((result.edges[0] as any).effect_direction).toBeUndefined()
  })

  it('validates provenance_source against allowlist', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', provenance_source: 'unknown_source' },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges[0].provenance_source).toBeUndefined()
  })

  // --- CIL 0.2: NaN/Infinity rejection (Task 2) ---

  it('rejects NaN weight', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b', weight: NaN }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges[0].weight).toBeUndefined()
  })

  it('rejects Infinity belief', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b', belief: Infinity }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges[0].belief).toBeUndefined()
  })

  it('rejects -Infinity strength_mean', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b', strength_mean: -Infinity }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect((result.edges[0] as any).strength_mean).toBeUndefined()
  })

  it('accepts zero as a valid finite weight', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b', weight: 0 }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.edges[0].weight).toBe(0)
  })

  it('rejects NaN belief_exists', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b', belief_exists: NaN }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect((result.edges[0] as any).belief_exists).toBeUndefined()
  })

  // --- CIL 0.2: Nested strength object removal (Task 3) ---

  it('removes mean/std from nested strength, preserves other subfields', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', strength: { mean: 0.6, std: 0.1, confidence: 'high', source: 'experiment' } },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const edge = result.edges[0]
    expect((edge as any).strength_mean).toBe(0.6)
    expect((edge as any).strength_std).toBe(0.1)
    // mean/std removed, but unknown subfields preserved
    expect((edge as any).strength).toEqual({ confidence: 'high', source: 'experiment' })
  })

  it('removes strength entirely when only mean/std present', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'a', label: 'A', kind: 'factor' },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [
          { from: 'a', to: 'b', strength: { mean: 0.6, std: 0.1 } },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const edge = result.edges[0]
    expect((edge as any).strength_mean).toBe(0.6)
    expect((edge as any).strength_std).toBe(0.1)
    // No unknown subfields, so strength object removed entirely
    expect((edge as any).strength).toBeUndefined()
  })

  it('rejects NaN in node uncertainty', () => {
    const raw = {
      graph: {
        nodes: [{ id: 'a', label: 'A', kind: 'factor', uncertainty: NaN }],
        edges: [],
      },
    }

    const result = adaptDraftResponse(raw)
    // Falls back to computed fallback (1 - confidence)
    expect(result.nodes[0].uncertainty).not.toBe(NaN)
    expect(Number.isFinite(result.nodes[0].uncertainty)).toBe(true)
  })

  // --- inferMissingCategories (called within adaptDraftResponse) ---

  it('infers controllable category on factor nodes with incoming option edges', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'opt1', label: 'Option A', kind: 'option' },
          { id: 'f1', label: 'Price', kind: 'factor' },   // target of option edge
          { id: 'f2', label: 'Weather', kind: 'factor' },  // no option edge
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [
          { from: 'opt1', to: 'f1', weight: 0.5 },
          { from: 'f1', to: 'g1', weight: 0.8 },
          { from: 'f2', to: 'g1', weight: 0.3 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const f1 = result.nodes.find(n => n.id === 'f1')
    const f2 = result.nodes.find(n => n.id === 'f2')

    expect((f1 as any).category).toBe('controllable')
    expect((f2 as any).category).toBe('observable')
  })

  it('does not overwrite existing category on factor nodes', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'opt1', label: 'Option A', kind: 'option' },
          { id: 'f1', label: 'Price', kind: 'factor', category: 'external' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [
          { from: 'opt1', to: 'f1', weight: 0.5 },
          { from: 'f1', to: 'g1', weight: 0.8 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const f1 = result.nodes.find(n => n.id === 'f1')

    // Should NOT be overwritten to 'controllable' — preserve existing value
    expect((f1 as any).category).toBe('external')
  })

  it('infers controllable from decision node edges too', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'dec1', label: 'Decision', kind: 'decision' },
          { id: 'f1', label: 'Budget', kind: 'factor' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [
          { from: 'dec1', to: 'f1', weight: 0.5 },
          { from: 'f1', to: 'g1', weight: 0.8 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const f1 = result.nodes.find(n => n.id === 'f1')

    expect((f1 as any).category).toBe('controllable')
  })

  it('does not assign category to non-factor nodes', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'opt1', label: 'Option A', kind: 'option' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [
          { from: 'opt1', to: 'g1', weight: 0.5 },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const g1 = result.nodes.find(n => n.id === 'g1')

    // Goal node should not get a category from inference
    expect((g1 as any).category).toBeUndefined()
  })

  it('handles graph with no edges gracefully (all factors become observable)', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'f1', label: 'Factor A', kind: 'factor' },
          { id: 'f2', label: 'Factor B', kind: 'factor' },
        ],
        edges: [],
      },
    }

    const result = adaptDraftResponse(raw)

    expect((result.nodes[0] as any).category).toBe('observable')
    expect((result.nodes[1] as any).category).toBe('observable')
  })

  it('rejects NaN in observed_state.value', () => {
    const raw = {
      graph: {
        nodes: [
          {
            id: 'a',
            label: 'A',
            kind: 'factor',
            observed_state: { value: NaN, baseline: 10 },
          },
        ],
        edges: [],
      },
    }

    const result = adaptDraftResponse(raw)
    // observed_state dropped due to invalid value
    expect((result.nodes[0] as any).observed_state).toBeUndefined()
  })

  // --- CIL 0.2: Legacy node path spread-first (Task 4) ---

  it('preserves unknown node fields in legacy graph.nodes path', () => {
    const raw = {
      graph: {
        nodes: [
          {
            id: 'a',
            label: 'A',
            kind: 'factor',
            new_cil_field: 42,
            category: 'observable',
          },
          { id: 'b', label: 'B', kind: 'factor' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.nodes).toHaveLength(2)
    // Unknown fields must survive through spread-first
    expect((result.nodes[0] as any).new_cil_field).toBe(42)
    expect((result.nodes[0] as any).category).toBe('observable')
  })

  it('preserves node unknown fields without affecting validated fields', () => {
    const raw = {
      graph: {
        nodes: [
          {
            id: 'x',
            label: 'Test',
            kind: 'goal',
            uncertainty: 0.5,
            custom_array: [1, 2, { nested: true }],
          },
        ],
        edges: [],
      },
    }

    const result = adaptDraftResponse(raw)
    expect(result.nodes[0].id).toBe('x')
    expect(result.nodes[0].label).toBe('Test')
    expect(result.nodes[0].type).toBe('goal')
    expect(result.nodes[0].uncertainty).toBe(0.5)
    expect((result.nodes[0] as any).custom_array).toEqual([1, 2, { nested: true }])
  })
})

// =============================================================================
// Pipeline-level: analysis_ready sub-field preservation through adaptDraftResponse
// =============================================================================

describe('adaptDraftResponse – analysis_ready sub-fields', () => {
  it('preserves model_adjustments through adaptation (root-level nodes path)', () => {
    const raw = {
      nodes: [
        { id: 'f1', label: 'Price', type: 'factor', uncertainty: 0.3 },
        { id: 'g1', label: 'Revenue', type: 'goal', uncertainty: 0.1 },
      ],
      edges: [{ from: 'f1', to: 'g1', weight: 0.5 }],
      quality_overall: 7,
      draft_warnings: { structural: [], completeness: [] },
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Raise Price', status: 'ready', interventions: { f1: { value: 0.8 } } }],
        goal_node_id: 'g1',
        model_adjustments: [
          { type: 'strp_repair', target: 'edge_e1', detail: 'Restored dropped edge' },
          { type: 'category_infer', field: 'category', detail: 'Inferred controllable' },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const ar = (result as any).analysis_ready
    expect(ar).toBeDefined()
    expect(ar.model_adjustments).toHaveLength(2)
    expect(ar.model_adjustments[0].type).toBe('strp_repair')
    expect(ar.model_adjustments[1].type).toBe('category_infer')
  })

  it('preserves blockers through adaptation (graph path)', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'f1', label: 'Price', kind: 'factor' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [{ from: 'f1', to: 'g1', weight: 0.5 }],
      },
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Raise Price', status: 'ready', interventions: { f1: { value: 0.8 } } }],
        goal_node_id: 'g1',
        blockers: [
          { factor_id: 'f1', reason: 'No observed value', factor_label: 'Price' },
          { factor_id: 'f2', reason: 'No causal path', option_id: 'opt1' },
        ],
      },
    }

    const result = adaptDraftResponse(raw)
    const ar = (result as any).analysis_ready
    expect(ar).toBeDefined()
    expect(ar.blockers).toHaveLength(2)
    expect(ar.blockers[0].factor_id).toBe('f1')
    expect(ar.blockers[0].reason).toBe('No observed value')
    expect(ar.blockers[1].option_id).toBe('opt1')
  })

  it('preserves both model_adjustments and blockers together', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'f1', label: 'Price', kind: 'factor' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [{ from: 'f1', to: 'g1', weight: 0.5 }],
      },
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Raise Price', status: 'ready', interventions: { f1: { value: 0.8 } } }],
        goal_node_id: 'g1',
        model_adjustments: [{ type: 'strp_repair', detail: 'Fixed edge' }],
        blockers: [{ factor_id: 'f1', reason: 'Missing data' }],
      },
    }

    const result = adaptDraftResponse(raw)
    const ar = (result as any).analysis_ready
    expect(ar.model_adjustments).toHaveLength(1)
    expect(ar.blockers).toHaveLength(1)
  })

  it('analysis_ready without model_adjustments/blockers is not affected', () => {
    const raw = {
      graph: {
        nodes: [
          { id: 'f1', label: 'Price', kind: 'factor' },
          { id: 'g1', label: 'Revenue', kind: 'goal' },
        ],
        edges: [{ from: 'f1', to: 'g1', weight: 0.5 }],
      },
      analysis_ready: {
        options: [{ id: 'opt1', label: 'Raise Price', status: 'ready', interventions: { f1: { value: 0.8 } } }],
        goal_node_id: 'g1',
      },
    }

    const result = adaptDraftResponse(raw)
    const ar = (result as any).analysis_ready
    expect(ar).toBeDefined()
    expect(ar.model_adjustments).toBeUndefined()
    expect(ar.blockers).toBeUndefined()
  })
})
