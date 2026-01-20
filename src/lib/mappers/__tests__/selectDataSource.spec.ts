/**
 * selectDataSource Semantic Contract Tests
 *
 * Tests the deterministic source selection logic.
 * Verifies precedence, validity guards, and fallback tracking.
 */

import { describe, it, expect } from 'vitest'
import { selectDataSource } from '../selectDataSource'

describe('selectDataSource', () => {
  describe('source precedence', () => {
    it('selects downstream_calls.isl when ISL factors have real data', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: 0.8, label: 'Price' },
              ],
              robustness: {
                fragile_edges: [],
              },
            },
          },
        },
        factor_sensitivity: [
          { factor_id: 'fac_price', importance_score: 0.5 },
        ],
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('downstream_calls.isl')
      expect(result.data.factorSensitivity).toHaveLength(1)
      expect(result.data.factorSensitivity[0].sensitivity_score).toBe(0.8)
    })

    it('falls back to enrichment when ISL factors are empty', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [], // Empty
            },
          },
        },
        enrichment: {
          sensitivity_analysis: {
            factors: [
              { factor_id: 'fac_price', sensitivity_score: 0.7, label: 'Price' },
            ],
          },
        },
        factor_sensitivity: [
          { factor_id: 'fac_price', importance_score: 0.5 },
        ],
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('enrichment')
      expect(result.fallbacksApplied).toContain('NO_DOWNSTREAM_ISL')
    })

    it('falls back to enrichment when ISL factors have no real data', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: 0, label: 'Price' }, // Placeholder
              ],
            },
          },
        },
        enrichment: {
          sensitivity_analysis: {
            factors: [
              { factor_id: 'fac_price', sensitivity_score: 0.7, label: 'Price' },
            ],
          },
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('enrichment')
    })

    it('falls back to top_level when both ISL and enrichment are empty', () => {
      const response = {
        factor_sensitivity: [
          { factor_id: 'fac_price', importance_score: 0.5, label: 'Price' },
        ],
        robustness: {
          fragile_edges: [],
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('top_level')
      expect(result.fallbacksApplied).toContain('NO_DOWNSTREAM_ISL')
      expect(result.fallbacksApplied).toContain('NO_ENRICHMENT')
    })

    it('selects none when no factor_sensitivity exists anywhere', () => {
      const response = {
        robustness: {
          fragile_edges: [],
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('none')
      expect(result.fallbacksApplied).toContain('NO_FACTOR_SENSITIVITY')
    })
  })

  describe('validity guards', () => {
    it('requires real data (>0.001) in factors', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: 0.0001 }, // Below threshold
              ],
            },
          },
        },
        factor_sensitivity: [
          { factor_id: 'fac_price', importance_score: 0.5 },
        ],
      }

      const result = selectDataSource(response)

      // Should fall through to top_level since ISL has no real data
      expect(result.source).toBe('top_level')
    })

    it('accepts negative values with Math.abs check', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: -0.8 }, // Negative but real
              ],
            },
          },
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('downstream_calls.isl')
    })

    it('checks importance_score when sensitivity_score is missing', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', importance_score: 0.9 }, // Only importance_score
              ],
            },
          },
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('downstream_calls.isl')
    })
  })

  describe('fallback tracking', () => {
    it('tracks ROBUSTNESS_FROM_TOP_LEVEL when ISL lacks robustness', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: 0.8 },
              ],
              // No robustness here
            },
          },
        },
        robustness: {
          fragile_edges: [],
        },
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('downstream_calls.isl')
      expect(result.fallbacksApplied).toContain('ROBUSTNESS_FROM_TOP_LEVEL')
    })

    it('tracks NO_REAL_FACTOR_DATA when top_level has placeholder data', () => {
      const response = {
        factor_sensitivity: [
          { factor_id: 'fac_price', importance_score: 0 }, // All zeros
        ],
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('top_level')
      expect(result.fallbacksApplied).toContain('NO_REAL_FACTOR_DATA')
    })
  })

  describe('option_comparison extraction', () => {
    it('extracts option_comparison from top-level regardless of source', () => {
      const response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_price', sensitivity_score: 0.8 },
              ],
            },
          },
        },
        option_comparison: [
          { option_id: 'opt_a', label: 'Option A', win_probability: 0.7 },
          { option_id: 'opt_b', label: 'Option B', win_probability: 0.3 },
        ],
      }

      const result = selectDataSource(response)

      expect(result.source).toBe('downstream_calls.isl')
      expect(result.data.optionComparison).toHaveLength(2)
    })

    it('handles missing option_comparison gracefully', () => {
      const response = {
        factor_sensitivity: [
          { factor_id: 'fac_price', sensitivity_score: 0.8 },
        ],
      }

      const result = selectDataSource(response)

      expect(result.data.optionComparison).toEqual([])
    })
  })
})
