/**
 * Passthrough behavior tests.
 *
 * Ensures contract-boundary schemas preserve unknown fields.
 */

import { describe, it, expect } from 'vitest'
import {
  NodeV3Schema,
  EdgeV3Schema,
  OptionForAnalysisSchema,
  AnalysisReadyV3Schema,
  ObservedStateSchema,
} from '../src'

describe('Passthrough behavior', () => {
  describe('NodeV3Schema', () => {
    it('preserves unknown fields', () => {
      const input = {
        id: 'node_1',
        kind: 'goal',
        label: 'My Goal',
        unknown_field: 'preserved',
        nested_unknown: {
          foo: 'bar',
          baz: 123,
        },
      }

      const result = NodeV3Schema.parse(input)

      expect(result).toHaveProperty('unknown_field')
      expect(result).toHaveProperty('nested_unknown')
      expect((result as any).unknown_field).toBe('preserved')
      expect((result as any).nested_unknown.foo).toBe('bar')
    })

    it('preserves future CEE fields', () => {
      const input = {
        id: 'factor_x',
        kind: 'factor',
        label: 'Factor X',
        // Hypothetical future CEE fields
        cee_version: '4.0',
        extraction_metadata: {
          confidence: 0.95,
          source_page: 3,
        },
      }

      const result = NodeV3Schema.parse(input)

      expect((result as any).cee_version).toBe('4.0')
      expect((result as any).extraction_metadata.confidence).toBe(0.95)
    })
  })

  describe('ObservedStateSchema', () => {
    it('preserves unknown fields in observed_state', () => {
      const input = {
        value: 0.5,
        std: 0.1,
        // Unknown fields
        future_field: 'test',
        another_unknown: {
          nested: true,
        },
      }

      const result = ObservedStateSchema.parse(input)

      expect((result as any).future_field).toBe('test')
      expect((result as any).another_unknown.nested).toBe(true)
    })
  })

  describe('EdgeV3Schema', () => {
    it('preserves unknown fields', () => {
      const input = {
        from: 'a',
        to: 'b',
        strength: {
          mean: 0.5,
          std: 0.1,
        },
        exists_probability: 0.9,
        // Unknown fields
        provenance: {
          source: 'document',
          quote: 'text',
        },
        cee_confidence: 0.85,
      }

      const result = EdgeV3Schema.parse(input)

      expect((result as any).provenance).toBeDefined()
      expect((result as any).provenance.source).toBe('document')
      expect((result as any).cee_confidence).toBe(0.85)
    })
  })

  describe('OptionForAnalysisSchema', () => {
    it('preserves unknown fields in options', () => {
      const input = {
        id: 'option_1',
        label: 'Option 1',
        status: 'ready',
        interventions: {
          'factor_a': 0.5,
        },
        // Unknown fields
        priority: 'high',
        metadata: {
          created_at: '2024-01-01',
        },
      }

      const result = OptionForAnalysisSchema.parse(input)

      expect((result as any).priority).toBe('high')
      expect((result as any).metadata.created_at).toBe('2024-01-01')
    })
  })

  describe('AnalysisReadyV3Schema', () => {
    it('preserves unknown fields in analysis_ready', () => {
      const input = {
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
        // Unknown fields
        cee_version: '3.5',
        processing_time_ms: 1234,
        metadata: {
          confidence: 0.92,
        },
      }

      const result = AnalysisReadyV3Schema.parse(input)

      expect((result as any).cee_version).toBe('3.5')
      expect((result as any).processing_time_ms).toBe(1234)
      expect((result as any).metadata.confidence).toBe(0.92)
    })
  })

  describe('Round-trip preservation', () => {
    it('preserves unknown fields through parse → serialize → parse', () => {
      const original = {
        id: 'node_test',
        kind: 'goal',
        label: 'Test Goal',
        unknown_1: 'value_1',
        unknown_2: { nested: 'value_2' },
        unknown_3: [1, 2, 3],
      }

      // First parse
      const parsed1 = NodeV3Schema.parse(original)

      // Serialize (simulate API boundary)
      const serialized = JSON.parse(JSON.stringify(parsed1))

      // Second parse
      const parsed2 = NodeV3Schema.parse(serialized)

      // Verify all unknowns survived
      expect((parsed2 as any).unknown_1).toBe('value_1')
      expect((parsed2 as any).unknown_2.nested).toBe('value_2')
      expect((parsed2 as any).unknown_3).toEqual([1, 2, 3])
    })
  })
})
