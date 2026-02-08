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
})
