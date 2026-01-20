/**
 * Ground Truth Tests - Real Fixture Validation
 *
 * Tests the mappers against the golden fixture to ensure real-world data
 * is correctly mapped. This prevents regressions from breaking production data handling.
 *
 * Fixture: src/test/fixtures/golden-run-response.json
 */

import { describe, it, expect } from 'vitest'
import goldenFixture from '../../../test/fixtures/golden-run-response.json'
import { mapPloTResponse } from '../index'

describe('ground truth: golden fixture', () => {
  // Map the golden fixture through the pipeline
  const result = mapPloTResponse(goldenFixture)

  describe('source path detection', () => {
    it('detects top_level source (fixture has no ISL data)', () => {
      // Golden fixture has top-level factor_sensitivity, not downstream_calls.isl
      expect(result._meta.sourcePath).toBe('top_level')
    })

    it('tracks request_id from fixture', () => {
      expect(result._meta.requestId).toBe('golden-test-001')
    })
  })

  describe('factor sensitivity mapping', () => {
    it('maps all 5 factors from fixture', () => {
      expect(result.factors).toHaveLength(5)
    })

    it('maps fac_pro_price with highest importance_score (1.0)', () => {
      const factor = result.factors.find(f => f.factorId === 'fac_pro_price')
      expect(factor).toBeDefined()
      expect(factor!.label).toBe('Pro Plan Price')
      expect(factor!.rawInfluence).toBe(1.0) // importance_score: 1.0
      expect(factor!.direction).toBe('negative')
    })

    it('maps fac_perceived_value with importance_score 0.62', () => {
      const factor = result.factors.find(f => f.factorId === 'fac_perceived_value')
      expect(factor).toBeDefined()
      expect(factor!.label).toBe('Perceived Value')
      expect(factor!.rawInfluence).toBe(0.62) // importance_score: 0.62
      expect(factor!.direction).toBe('positive')
    })

    it('maps confidence from confidence field (0-1 scale → 0-100)', () => {
      // fac_perceived_value has confidence: 0.72 → should become 72
      const factor = result.factors.find(f => f.factorId === 'fac_perceived_value')
      expect(factor!.confidence).toBe(72)
    })

    it('preserves zero importance_score for factor_churn_rate_0', () => {
      // CRITICAL: Real zero should be preserved, not become undefined
      const factor = result.factors.find(f => f.factorId === 'factor_churn_rate_0')
      expect(factor).toBeDefined()
      expect(factor!.rawInfluence).toBe(0)
    })
  })

  describe('robustness mapping', () => {
    it('maps fragile edges without inverting switch_probability', () => {
      // First fragile edge has switch_probability: 0.35
      // CRITICAL: Should stay 0.35, NOT become 0.65 (1 - 0.35)
      expect(result.robustness.fragileEdges).toHaveLength(2)
      expect(result.robustness.fragileEdges[0].switchProbability).toBe(0.35)
    })

    it('preserves fragile edge labels', () => {
      const edge = result.robustness.fragileEdges[0]
      expect(edge.fromLabel).toBe('Pro Plan Price')
      expect(edge.toLabel).toBe('Monthly Recurring Revenue')
      expect(edge.alternativeWinnerLabel).toBe('Maintain current price')
    })

    it('maps second fragile edge correctly', () => {
      const edge = result.robustness.fragileEdges[1]
      expect(edge.fromId).toBe('fac_market_competition')
      expect(edge.switchProbability).toBe(0.18)
    })

    it('preserves robust edge IDs', () => {
      expect(result.robustness.robustEdges).toEqual([
        'fac_perceived_value->out_mrr',
        'fac_bundle_release->out_mrr',
      ])
    })

    it('maps ranking_stability', () => {
      expect(result.robustness.rankingStability).toBe(0.72)
    })
  })

  describe('option comparison mapping', () => {
    it('maps both options', () => {
      expect(result.options).toHaveLength(2)
    })

    it('maps option outcome distribution', () => {
      const option = result.options.find(o => o.optionId === 'opt_increase_with_release')
      expect(option).toBeDefined()
      expect(option!.outcome.expected).toBe(45.42)
      expect(option!.outcome.p10).toBe(4.2)
      expect(option!.outcome.p50).toBe(46.8)
      expect(option!.outcome.p90).toBe(69.3)
    })

    it('maps win_probability', () => {
      const option = result.options.find(o => o.optionId === 'opt_increase_with_release')
      expect(option!.winProbability).toBe(0.68)
    })

    it('maps goal_probability from probability_of_goal', () => {
      const option = result.options.find(o => o.optionId === 'opt_maintain_price')
      expect(option!.goalProbability).toBe(0.45)
    })
  })
})
