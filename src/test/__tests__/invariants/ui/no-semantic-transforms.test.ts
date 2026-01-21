/**
 * UI Semantic Transform Invariants
 *
 * These tests verify that the UI layer does NOT perform hidden semantic transforms
 * on data values. All allowed transforms are:
 * - Display-only (CSS percentages, K/M suffixes)
 * - Documented in UI_OPERATIONS_INVENTORY.md
 * - Covered by contract tests
 *
 * If a test fails, it means a new semantic transform was introduced that
 * should either be:
 * 1. Moved to the typed mappers layer
 * 2. Documented in the inventory
 * 3. Removed as a bug
 */

import { describe, it, expect } from 'vitest'
import { mapFactorSensitivity } from '../../../../lib/mappers/mapFactorSensitivity'
import { mapRobustness } from '../../../../lib/mappers/mapRobustness'
import { mapOptionComparison } from '../../../../lib/mappers/mapOptionComparison'

describe('UI Semantic Transform Invariants', () => {
  describe('switch_probability passthrough', () => {
    it('should NOT invert switch_probability (no 1-x transform)', () => {
      const rawRobustness = {
        fragile_edges: [
          {
            edge_id: 'e1',
            from_id: 'factor1',
            to_id: 'goal',
            switch_probability: 0.224,
          },
        ],
      }

      const result = mapRobustness(rawRobustness, { sourcePath: 'enrichment' })

      // CRITICAL: switch_probability should be passed through directly
      // NOT inverted (1 - 0.224 = 0.776 would be WRONG)
      expect(result.fragileEdges[0].switchProbability).toBe(0.224)
    })

    it('should preserve high switch_probability without inversion', () => {
      const rawRobustness = {
        fragile_edges: [
          { edge_id: 'e1', from_id: 'f1', to_id: 'g', switch_probability: 0.95 },
        ],
      }

      const result = mapRobustness(rawRobustness, { sourcePath: 'enrichment' })

      // 0.95 means 95% chance of flipping - should NOT become 0.05
      expect(result.fragileEdges[0].switchProbability).toBe(0.95)
    })

    it('should preserve zero switch_probability', () => {
      const rawRobustness = {
        fragile_edges: [
          { edge_id: 'e1', from_id: 'f1', to_id: 'g', switch_probability: 0 },
        ],
      }

      const result = mapRobustness(rawRobustness, { sourcePath: 'enrichment' })

      // 0 means 0% chance of flipping - should NOT become 1.0
      expect(result.fragileEdges[0].switchProbability).toBe(0)
    })
  })

  describe('rawInfluence passthrough', () => {
    it('should NOT scale importance_score', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1', importance_score: 0.85 },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      // CRITICAL: importance_score should be preserved exactly
      // NOT multiplied by 100 (that would be 85)
      expect(result[0].rawInfluence).toBe(0.85)
    })

    it('should preserve elasticity exactly', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1', elasticity: 0.42 },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      expect(result[0].rawInfluence).toBe(0.42)
    })

    it('should preserve zero influence', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1', importance_score: 0 },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      // Zero should be preserved, not converted to undefined
      expect(result[0].rawInfluence).toBe(0)
    })
  })

  describe('outcome values passthrough', () => {
    it('should NOT multiply outcome by 100', () => {
      const rawOptions = [
        {
          option_id: 'opt1',
          label: 'Option 1',
          outcome: { expected: 0.75, p10: 0.60, p50: 0.75, p90: 0.85 },
        },
      ]

      const result = mapOptionComparison(rawOptions, { sourcePath: 'enrichment' })

      // CRITICAL: outcome values should be preserved exactly
      // NOT multiplied by 100 (that would make expected = 75)
      expect(result[0].outcome.expected).toBe(0.75)
      expect(result[0].outcome.p10).toBe(0.60)
      expect(result[0].outcome.p50).toBe(0.75)
      expect(result[0].outcome.p90).toBe(0.85)
    })

    it('should preserve large currency values', () => {
      const rawOptions = [
        {
          option_id: 'opt1',
          label: 'Option 1',
          outcome: { expected: 1500000 },
        },
      ]

      const result = mapOptionComparison(rawOptions, { sourcePath: 'enrichment' })

      // Large values should NOT be divided or scaled
      expect(result[0].outcome.expected).toBe(1500000)
    })
  })

  describe('VOI to confidence transform (documented)', () => {
    it('should multiply value_of_information by 100 for confidence', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1', value_of_information: 0.72 },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      // DOCUMENTED TRANSFORM: VOI (0-1) × 100 = confidence (0-100)
      // This is the ONLY semantic scaling allowed
      expect(result[0].confidence).toBe(72)
    })

    it('should preserve zero VOI as zero confidence', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1', value_of_information: 0 },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      // VOI 0 → confidence 0 (not undefined)
      expect(result[0].confidence).toBe(0)
    })

    it('should return undefined confidence when VOI is missing', () => {
      const rawFactors = [
        { factor_id: 'f1', label: 'Factor 1' },
      ]

      const result = mapFactorSensitivity(rawFactors, { sourcePath: 'enrichment' })

      // Missing VOI → undefined (not 0)
      expect(result[0].confidence).toBeUndefined()
    })
  })
})
