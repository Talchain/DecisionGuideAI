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
import islImportanceFixture from '../../../test/fixtures/golden-isl-importance-score.json'
import { mapPloTResponse } from '../index'
import { pickFactorSensitivityForUi } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

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

// =============================================================================
// P0 Fix: ISL path importance_score preservation
// =============================================================================

describe('ground truth: ISL importance_score fixture (P0 Fix)', () => {
  describe('response mapper pickFactorSensitivityForUi', () => {
    // Test the response mapper directly to verify ISL path handling
    const mapperResult = pickFactorSensitivityForUi(islImportanceFixture as unknown as V2RunResponse)

    it('selects ISL path (downstream_calls.isl) when importance_score is present', () => {
      // CRITICAL: Should detect hasRealData from importance_score alone
      expect(mapperResult._source_path).toBe('downstream_calls.isl')
    })

    it('preserves all 3 factors from ISL response', () => {
      expect(mapperResult.factors).toHaveLength(3)
    })

    it('preserves importance_score in output object', () => {
      const techLead = mapperResult.factors.find(f => f.factor_id === 'fac_hire_tech_lead')
      expect(techLead).toBeDefined()
      // CRITICAL: importance_score must be in output for getRawElasticity()
      expect(techLead!.importance_score).toBe(1.0)
    })

    it('keeps sensitivity_score and importance_score semantically separate', () => {
      const techLead = mapperResult.factors.find(f => f.factor_id === 'fac_hire_tech_lead')
      // SEMANTIC SEPARATION: sensitivity_score should NOT fall back to importance_score
      // They are different metrics - downstream getRawElasticity() handles the fallback
      expect(techLead!.sensitivity_score).toBeUndefined()
      expect(techLead!.importance_score).toBe(1.0)
    })

    it('preserves value_of_information alongside importance_score', () => {
      const techLead = mapperResult.factors.find(f => f.factor_id === 'fac_hire_tech_lead')
      expect(techLead!.value_of_information).toBe(0.85)
    })

    it('maps all importance_score values correctly', () => {
      const techLead = mapperResult.factors.find(f => f.factor_id === 'fac_hire_tech_lead')
      const budget = mapperResult.factors.find(f => f.factor_id === 'fac_budget_constraints')
      const timeline = mapperResult.factors.find(f => f.factor_id === 'fac_timeline_pressure')

      expect(techLead!.importance_score).toBe(1.0)
      expect(budget!.importance_score).toBe(0.65)
      expect(timeline!.importance_score).toBe(0.22)
    })
  })

  describe('full pipeline (mapPloTResponse)', () => {
    // Test the full pipeline to verify end-to-end mapping
    const pipelineResult = mapPloTResponse(islImportanceFixture)

    it('maps factors through full pipeline with correct rawInfluence', () => {
      const techLead = pipelineResult.factors.find(f => f.factorId === 'fac_hire_tech_lead')
      expect(techLead).toBeDefined()
      // rawInfluence should use importance_score (1.0)
      expect(techLead!.rawInfluence).toBe(1.0)
    })

    it('maps all factor rawInfluence values from importance_score', () => {
      const techLead = pipelineResult.factors.find(f => f.factorId === 'fac_hire_tech_lead')
      const budget = pipelineResult.factors.find(f => f.factorId === 'fac_budget_constraints')
      const timeline = pipelineResult.factors.find(f => f.factorId === 'fac_timeline_pressure')

      expect(techLead!.rawInfluence).toBe(1.0)
      expect(budget!.rawInfluence).toBe(0.65)
      expect(timeline!.rawInfluence).toBe(0.22)
    })

    it('returns undefined confidence when only value_of_information is present (VOI is separate metric)', () => {
      const techLead = pipelineResult.factors.find(f => f.factorId === 'fac_hire_tech_lead')
      // value_of_information is NOT used for confidence - they are semantically different
      // VOI = "how much would more info help", confidence = "path certainty from exists_probability"
      expect(techLead!.confidence).toBeUndefined()
      // But VOI should be preserved separately
      expect(techLead!.valueOfInformation).toBe(0.85)
    })

    it('preserves direction from ISL response', () => {
      const budget = pipelineResult.factors.find(f => f.factorId === 'fac_budget_constraints')
      expect(budget!.direction).toBe('negative')
    })
  })
})
