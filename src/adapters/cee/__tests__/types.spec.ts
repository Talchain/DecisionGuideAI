/**
 * CEE Types Tests
 *
 * Brief v2.2: Tests for v2.2 schema type guard
 */

import { describe, it, expect } from 'vitest'
import { isCEEv2Response } from '../types'

describe('CEE Types', () => {
  describe('isCEEv2Response', () => {
    it('should identify v2.2 response', () => {
      const v2Response = {
        schema_version: '2.2',
        quality_overall: 0.85,
        nodes: [{ id: 'n1', type: 'factor', label: 'Price' }],
        edges: [{
          id: 'e1',
          from: 'n1',
          to: 'n2',
          weight: 0.8,
          belief: 0.9,
          effect_direction: 'negative',
          strength_std: 0.15
        }],
        draft_warnings: { structural: [], completeness: [] }
      }
      expect(isCEEv2Response(v2Response)).toBe(true)
    })

    it('should not identify v1 response as v2', () => {
      const v1Response = {
        quality_overall: 0.8,
        nodes: [{ id: 'n1', label: 'Test', type: 'factor', uncertainty: 0.2 }],
        edges: [{ from: 'n1', to: 'n2', weight: 0.5 }],
        draft_warnings: { structural: [], completeness: [] }
      }
      expect(isCEEv2Response(v1Response)).toBe(false)
    })

    it('should not identify null as v2', () => {
      expect(isCEEv2Response(null)).toBe(false)
    })

    it('should not identify undefined as v2', () => {
      expect(isCEEv2Response(undefined)).toBe(false)
    })

    it('should not identify string as v2', () => {
      expect(isCEEv2Response('v2.2')).toBe(false)
    })

    it('should not identify response with wrong schema version', () => {
      const wrongVersion = {
        schema_version: '2.0',
        nodes: [],
        edges: []
      }
      expect(isCEEv2Response(wrongVersion)).toBe(false)
    })
  })
})
