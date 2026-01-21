/**
 * importance_score Preservation Invariants
 *
 * These tests verify that importance_score is correctly preserved through
 * the response mapper pipeline, specifically in pickFactorSensitivityForUi().
 *
 * Root cause of P0 bug: ISL/enrichment paths dropped importance_score from:
 * 1. The hasRealData check (factors with only importance_score were skipped)
 * 2. The output object (downstream consumers couldn't find the value)
 *
 * IMPORTANT: sensitivity_score and importance_score are semantically different:
 * - sensitivity_score: how much outcome changes per unit factor change
 * - importance_score: relative importance/influence weight
 * They must be kept separate - downstream getRawElasticity() handles the fallback chain.
 *
 * These tests guard against regression of this P0 data loss bug.
 */

import { describe, it, expect } from 'vitest'
import { pickFactorSensitivityForUi } from '../../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

describe('importance_score Preservation (P0 Fix)', () => {
  describe('ISL path (downstream_calls.isl)', () => {
    it('should detect hasRealData when only importance_score present', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_market_size',
                  label: 'Market Size',
                  importance_score: 0.85,
                  // No sensitivity_score, no elasticity
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should use ISL path, not fall through to top_level
      expect(result._source_path).toBe('downstream_calls.isl')
      expect(result.factors).toHaveLength(1)
    })

    it('should preserve importance_score in output object', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_market_size',
                  label: 'Market Size',
                  importance_score: 0.85,
                  direction: 'positive',
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // CRITICAL: importance_score must be in output for getRawElasticity()
      expect(result.factors[0].importance_score).toBe(0.85)
    })

    it('should keep sensitivity_score and importance_score semantically separate', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_market_size',
                  label: 'Market Size',
                  importance_score: 0.85,
                  // No sensitivity_score or elasticity
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // SEMANTIC SEPARATION: importance_score should NOT fill sensitivity_score
      // sensitivity_score is undefined when not provided (or no elasticity fallback)
      expect(result.factors[0].sensitivity_score).toBeUndefined()
      // importance_score is preserved separately
      expect(result.factors[0].importance_score).toBe(0.85)
    })

    it('should preserve both fields independently when both present with different values', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_market_size',
                  label: 'Market Size',
                  sensitivity_score: 0.72,
                  importance_score: 0.85,
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // CRITICAL: Both fields preserved with their original values
      expect(result.factors[0].sensitivity_score).toBe(0.72)
      expect(result.factors[0].importance_score).toBe(0.85)
    })
  })

  describe('Enrichment path', () => {
    it('should detect hasRealData when only importance_score present', () => {
      const v2Response = {
        enrichment: {
          sensitivity_analysis: {
            factors: [
              {
                factor_id: 'fac_tech_lead',
                label: 'Tech Lead',
                importance_score: 1.0,
                // No sensitivity_score
              },
            ],
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should use enrichment path, not fall through
      expect(result._source_path).toBe('enrichment')
      expect(result.factors).toHaveLength(1)
    })

    it('should preserve importance_score in output object', () => {
      const v2Response = {
        enrichment: {
          sensitivity_analysis: {
            factors: [
              {
                factor_id: 'fac_tech_lead',
                label: 'Tech Lead',
                importance_score: 1.0,
                direction: 'positive',
              },
            ],
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // CRITICAL: importance_score must be in output
      expect(result.factors[0].importance_score).toBe(1.0)
    })

    it('should keep sensitivity_score and importance_score semantically separate', () => {
      const v2Response = {
        enrichment: {
          sensitivity_analysis: {
            factors: [
              {
                factor_id: 'fac_tech_lead',
                label: 'Tech Lead',
                importance_score: 1.0,
              },
            ],
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // SEMANTIC SEPARATION: importance_score should NOT fill sensitivity_score
      expect(result.factors[0].sensitivity_score).toBeUndefined()
      expect(result.factors[0].importance_score).toBe(1.0)
    })
  })

  describe('Edge cases', () => {
    it('should handle small importance_score above threshold (0.002)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_minor',
                  label: 'Minor Factor',
                  importance_score: 0.002, // Above 0.001 threshold
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should detect as real data (0.002 > 0.001)
      expect(result._source_path).toBe('downstream_calls.isl')
      expect(result.factors[0].importance_score).toBe(0.002)
    })

    it('should NOT detect placeholder zeros as real data (importance_score: 0)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_placeholder',
                  label: 'Placeholder',
                  importance_score: 0, // Placeholder zero
                },
              ],
            },
          },
        },
        // No enrichment or top-level to fall back to
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should fall through to top_level (no real data detected)
      expect(result._source_path).toBe('top_level')
    })

    it('should handle multiple factors with mixed importance_score values', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_high',
                  label: 'High Importance',
                  importance_score: 1.0,
                },
                {
                  factor_id: 'fac_medium',
                  label: 'Medium Importance',
                  importance_score: 0.5,
                },
                {
                  factor_id: 'fac_low',
                  label: 'Low Importance',
                  importance_score: 0.22,
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result._source_path).toBe('downstream_calls.isl')
      expect(result.factors).toHaveLength(3)

      // Verify all importance_scores are preserved
      expect(result.factors[0].importance_score).toBe(1.0)
      expect(result.factors[1].importance_score).toBe(0.5)
      expect(result.factors[2].importance_score).toBe(0.22)

      // sensitivity_score should be undefined (no sensitivity_score or elasticity provided)
      expect(result.factors[0].sensitivity_score).toBeUndefined()
      expect(result.factors[1].sensitivity_score).toBeUndefined()
      expect(result.factors[2].sensitivity_score).toBeUndefined()
    })

    it('should preserve value_of_information alongside importance_score', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_with_voi',
                  label: 'Factor With VOI',
                  importance_score: 0.85,
                  value_of_information: 0.72,
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Both should be preserved
      expect(result.factors[0].importance_score).toBe(0.85)
      expect(result.factors[0].value_of_information).toBe(0.72)
    })

    it('should use elasticity as sensitivity_score fallback (not importance_score)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_with_elasticity',
                  label: 'Factor With Elasticity',
                  elasticity: 0.65,
                  importance_score: 0.85,
                  // No sensitivity_score
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // sensitivity_score should fall back to elasticity (NOT importance_score)
      expect(result.factors[0].sensitivity_score).toBe(0.65)
      // importance_score preserved separately
      expect(result.factors[0].importance_score).toBe(0.85)
    })
  })
})
