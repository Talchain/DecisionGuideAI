/**
 * mapRobustness Semantic Contract Tests
 *
 * Tests the robustness mapping logic.
 * Verifies fragile edge preservation, switch probability handling, and label extraction.
 */

import { describe, it, expect } from 'vitest'
import { mapRobustness, getRobustnessDisplay } from '../mapRobustness'
import type { RawRobustness, RobustnessLevel } from '../types'

describe('mapRobustness', () => {
  const defaultOptions = { sourcePath: 'downstream_calls.isl' as const }

  describe('switch probability', () => {
    it('preserves switch_probability directly (no inversion)', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
            switch_probability: 0.25,
            alternative_winner_label: 'Option B',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      // CRITICAL: 0.25 should stay 0.25, NOT become 0.75
      expect(result.fragileEdges[0].switchProbability).toBe(0.25)
    })

    it('handles switch_probability: 0.744 correctly', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
            switch_probability: 0.744,
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      // 0.744 should display as ~74%, NOT ~26%
      expect(result.fragileEdges[0].switchProbability).toBeCloseTo(0.744)
    })

    it('preserves switchProbability alias (camelCase)', () => {
      const robustness: RawRobustness = {
        fragileEdges: [
          {
            edgeId: 'edge_1',
            fromId: 'fac_price',
            toId: 'out_revenue',
            switchProbability: 0.35,
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].switchProbability).toBe(0.35)
    })

    it('returns undefined when switch_probability is missing', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].switchProbability).toBeUndefined()
    })
  })

  describe('fragile edge labels', () => {
    it('preserves full edge objects (fromLabel, toLabel, alternativeWinnerLabel)', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
            from_label: 'Pro Plan Price',
            to_label: 'Revenue',
            switch_probability: 0.25,
            alternative_winner_id: 'opt_b',
            alternative_winner_label: 'Maintain current price',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].fromLabel).toBe('Pro Plan Price')
      expect(result.fragileEdges[0].toLabel).toBe('Revenue')
      expect(result.fragileEdges[0].alternativeWinnerId).toBe('opt_b')
      expect(result.fragileEdges[0].alternativeWinnerLabel).toBe('Maintain current price')
    })

    it('returns undefined for missing labels (not empty string)', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].fromLabel).toBeUndefined()
      expect(result.fragileEdges[0].toLabel).toBeUndefined()
      expect(result.fragileEdges[0].alternativeWinnerLabel).toBeUndefined()
    })

    it('converts empty string labels to undefined', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
            from_label: '',
            to_label: '  ', // Whitespace only
            alternative_winner_label: '',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].fromLabel).toBeUndefined()
      expect(result.fragileEdges[0].toLabel).toBeUndefined()
      expect(result.fragileEdges[0].alternativeWinnerLabel).toBeUndefined()
    })

    it('handles alternativeWinner alias', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
            alternativeWinner: 'Option B', // Short alias
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].alternativeWinnerLabel).toBe('Option B')
    })
  })

  describe('edge ID extraction', () => {
    it('extracts from_id and to_id', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            from_id: 'fac_price',
            to_id: 'out_revenue',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].edgeId).toBe('edge_1')
      expect(result.fragileEdges[0].fromId).toBe('fac_price')
      expect(result.fragileEdges[0].toId).toBe('out_revenue')
    })

    it('handles camelCase aliases', () => {
      const robustness: RawRobustness = {
        fragileEdges: [
          {
            edgeId: 'edge_1',
            fromId: 'fac_price',
            toId: 'out_revenue',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].edgeId).toBe('edge_1')
      expect(result.fragileEdges[0].fromId).toBe('fac_price')
      expect(result.fragileEdges[0].toId).toBe('out_revenue')
    })

    it('handles source/target aliases', () => {
      const robustness: RawRobustness = {
        fragile_edges: [
          {
            edge_id: 'edge_1',
            source: 'fac_price',
            target: 'out_revenue',
          },
        ],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.fragileEdges[0].fromId).toBe('fac_price')
      expect(result.fragileEdges[0].toId).toBe('out_revenue')
    })
  })

  describe('robustness level', () => {
    it('normalises robustness level', () => {
      const robustness: RawRobustness = {
        level: 'high',
        fragile_edges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.level).toBe('high')
    })

    it('normalises very-low to very_low', () => {
      const robustness: RawRobustness = {
        level: 'very-low',
        fragile_edges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.level).toBe('very_low')
    })

    it('handles case insensitivity', () => {
      const robustness: RawRobustness = {
        level: 'MODERATE',
        fragile_edges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.level).toBe('moderate')
    })
  })

  describe('stability scores', () => {
    it('preserves recommendation_stability', () => {
      const robustness: RawRobustness = {
        recommendation_stability: 0.85,
        fragile_edges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.recommendationStability).toBe(0.85)
    })

    it('preserves ranking_stability', () => {
      const robustness: RawRobustness = {
        ranking_stability: 0.75,
        fragile_edges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.rankingStability).toBe(0.75)
    })

    it('handles camelCase aliases', () => {
      const robustness: RawRobustness = {
        recommendationStability: 0.85,
        rankingStability: 0.75,
        fragileEdges: [],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.recommendationStability).toBe(0.85)
      expect(result.rankingStability).toBe(0.75)
    })
  })

  describe('robust edges', () => {
    it('preserves robust edge IDs', () => {
      const robustness: RawRobustness = {
        fragile_edges: [],
        robust_edges: ['edge_a', 'edge_b', 'edge_c'],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.robustEdges).toEqual(['edge_a', 'edge_b', 'edge_c'])
    })

    it('handles camelCase alias', () => {
      const robustness: RawRobustness = {
        fragileEdges: [],
        robustEdges: ['edge_a', 'edge_b'],
      }

      const result = mapRobustness(robustness, defaultOptions)

      expect(result.robustEdges).toEqual(['edge_a', 'edge_b'])
    })
  })

  describe('undefined input', () => {
    it('returns empty structure when robustness is undefined', () => {
      const result = mapRobustness(undefined, defaultOptions)

      expect(result.level).toBeUndefined()
      expect(result.recommendationStability).toBeUndefined()
      expect(result.rankingStability).toBeUndefined()
      expect(result.isRobust).toBeUndefined()
      expect(result.fragileEdges).toEqual([])
      expect(result.robustEdges).toEqual([])
    })
  })
})

// =============================================================================
// getRobustnessDisplay Tests
// =============================================================================

describe('getRobustnessDisplay', () => {
  describe('valid robustness levels', () => {
    it('returns "Robust" with green colour for high', () => {
      const result = getRobustnessDisplay('high')
      expect(result.label).toBe('Robust')
      expect(result.colour).toBe('green')
    })

    it('returns "Moderate" with amber colour for moderate', () => {
      const result = getRobustnessDisplay('moderate')
      expect(result.label).toBe('Moderate')
      expect(result.colour).toBe('amber')
    })

    it('returns "Fragile" with orange colour for low', () => {
      const result = getRobustnessDisplay('low')
      expect(result.label).toBe('Fragile')
      expect(result.colour).toBe('orange')
    })

    it('returns "Very Fragile" with red colour for very_low', () => {
      const result = getRobustnessDisplay('very_low')
      expect(result.label).toBe('Very Fragile')
      expect(result.colour).toBe('red')
    })
  })

  describe('null/undefined handling', () => {
    it('returns "Unknown" with grey colour for undefined', () => {
      const result = getRobustnessDisplay(undefined)
      expect(result.label).toBe('Unknown')
      expect(result.colour).toBe('grey')
    })

    it('returns "Unknown" with grey colour for null', () => {
      const result = getRobustnessDisplay(null)
      expect(result.label).toBe('Unknown')
      expect(result.colour).toBe('grey')
    })
  })

  describe('exhaustive coverage', () => {
    it('handles all valid RobustnessLevel values', () => {
      const levels: RobustnessLevel[] = ['high', 'moderate', 'low', 'very_low']

      levels.forEach((level) => {
        const result = getRobustnessDisplay(level)
        expect(result.label).toBeDefined()
        expect(result.colour).toBeDefined()
        expect(result.label).not.toBe('Unknown')
      })
    })
  })

  describe('badge derivation contract', () => {
    it('badge must derive from robustness.level, NOT recommendation_stability', () => {
      // This test documents the critical contract:
      // When level = "low", badge must show "Fragile" (orange)
      // NOT "Moderate" (derived from recommendation_stability threshold)

      const level: RobustnessLevel = 'low'
      const result = getRobustnessDisplay(level)

      // Even if recommendation_stability were 0.553 (which would be "Moderate" by threshold),
      // the badge must show "Fragile" because level = "low"
      expect(result.label).toBe('Fragile')
      expect(result.colour).toBe('orange')
    })
  })
})
