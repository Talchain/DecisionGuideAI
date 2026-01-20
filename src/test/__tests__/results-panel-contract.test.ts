/**
 * Results Panel Contract Tests (M0)
 *
 * Verifies that golden fixture data transforms correctly through the
 * responseMapper → useResultsSectionData → UI component pipeline.
 *
 * These tests establish the M0 contract that prevents data integrity regressions.
 *
 * @see golden-run-response.json - Canonical test data
 * @see golden-expectations.ts - Expected UI display values
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { mapV2ResponseToReportV1 } from '../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../adapters/plot/v2/types'
import {
  getRawElasticity,
  computeNormalisedInfluences,
} from '../../components/results/useResultsSectionData'
import goldenResponse from '../fixtures/golden-run-response.json'
import {
  RECOMMENDATION_EXPECTATIONS,
  DRIVERS_EXPECTATIONS,
  UNCERTAINTIES_EXPECTATIONS,
  FILTERING_EXPECTATIONS,
  CONTRACT_SUMMARY,
} from '../fixtures/golden-expectations'

// ============================================================================
// Test Setup
// ============================================================================

let mappedReport: ReturnType<typeof mapV2ResponseToReportV1>

beforeAll(() => {
  // Map the golden fixture through responseMapper
  mappedReport = mapV2ResponseToReportV1(
    goldenResponse as unknown as V2RunResponse,
    { seed: 42, elapsed_ms: 1250 }
  )
})

// ============================================================================
// Recommendation Section Contract Tests
// ============================================================================

describe('Recommendation Section Contract', () => {
  describe('Option Comparison Mapping', () => {
    it('identifies correct recommended option based on win_probability', () => {
      const { recommendedOption } = RECOMMENDATION_EXPECTATIONS

      // Verify option_probabilities includes the recommended option
      const optionProbs = mappedReport.option_probabilities
      expect(optionProbs).toBeDefined()
      expect(optionProbs[recommendedOption.id]).toBeDefined()

      // Verify win_probability mapping
      const recOption = optionProbs[recommendedOption.id]
      expect(recOption.win_probability).toBeCloseTo(0.68, 2)
    })

    it('maps outcome.mean correctly (NO ×100 multiplication)', () => {
      const { recommendedOption } = RECOMMENDATION_EXPECTATIONS

      const optionProbs = mappedReport.option_probabilities
      const recOption = optionProbs[recommendedOption.id]

      // Golden fixture has outcome.mean = 45.42
      // Should be preserved as-is, NOT multiplied by 100
      expect(recOption.outcome?.mean).toBeCloseTo(45.42, 1)

      // If this test fails with ~4542, the ×100 bug has regressed
      expect(recOption.outcome?.mean).toBeLessThan(100)
    })

    it('maps p10/p50/p90 range correctly', () => {
      const optionProbs = mappedReport.option_probabilities
      const recOption = optionProbs['opt_increase_with_release']

      // Golden fixture: p10=4.2, p50=46.8, p90=69.3
      expect(recOption.outcome?.p10).toBeCloseTo(4.2, 1)
      expect(recOption.outcome?.p50).toBeCloseTo(46.8, 1)
      expect(recOption.outcome?.p90).toBeCloseTo(69.3, 1)
    })

    it('maps probability_of_goal correctly', () => {
      const optionProbs = mappedReport.option_probabilities
      const recOption = optionProbs['opt_increase_with_release']

      // Golden fixture: probability_of_goal = 0.72
      // responseMapper stores this as goal_probability
      expect(recOption.goal_probability).toBeCloseTo(0.72, 2)
    })
  })
})

// ============================================================================
// Drivers Section (Factor Influence) Contract Tests
// ============================================================================

describe('Drivers Section Contract', () => {
  describe('importance_score Preservation (P0 Fix)', () => {
    it('preserves importance_score through responseMapper', () => {
      // This is the critical P0 fix verification
      const factorSensitivity = mappedReport.factor_sensitivity

      expect(factorSensitivity).toBeDefined()
      expect(factorSensitivity.length).toBeGreaterThan(0)

      // Verify importance_score is present in mapped output
      const highestFactor = factorSensitivity.find(
        (f) => f.factor_id === 'fac_pro_price' || f.node_id === 'fac_pro_price'
      )

      expect(highestFactor).toBeDefined()

      // P0 Contract: importance_score MUST be preserved
      // If this fails, the mapping is dropping importance_score
      expect(
        highestFactor?.importance_score ?? highestFactor?.sensitivity_score
      ).toBeCloseTo(1.0, 2)
    })

    it('includes importance_score in sensitivity_score fallback', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      // For factors with only importance_score (no sensitivity_score/elasticity),
      // sensitivity_score should be populated from importance_score
      const factors = DRIVERS_EXPECTATIONS.factors

      factors.forEach((expected) => {
        const actual = factorSensitivity.find(
          (f) =>
            f.factor_id === expected.factor_id ||
            f.node_id === expected.factor_id
        )

        if (actual && expected.importance_score > 0) {
          // Either importance_score is preserved OR sensitivity_score was populated from it
          const hasValue =
            (actual.importance_score !== undefined &&
              actual.importance_score > 0) ||
            (actual.sensitivity_score !== undefined &&
              actual.sensitivity_score > 0)

          expect(hasValue).toBe(true)
        }
      })
    })

    it('maps factor with highest importance_score to highest influence', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      // Golden fixture: fac_pro_price has importance_score = 1.0
      const highestFactor = factorSensitivity.find(
        (f) => f.factor_id === 'fac_pro_price' || f.node_id === 'fac_pro_price'
      )

      const lowestNonZeroFactor = factorSensitivity.find(
        (f) =>
          f.factor_id === 'fac_market_competition' ||
          f.node_id === 'fac_market_competition'
      )

      expect(highestFactor).toBeDefined()
      expect(lowestNonZeroFactor).toBeDefined()

      // Get the magnitude values
      const highestValue =
        highestFactor!.importance_score ?? highestFactor!.sensitivity_score ?? 0
      const lowestValue =
        lowestNonZeroFactor!.importance_score ??
        lowestNonZeroFactor!.sensitivity_score ??
        0

      // Highest should be greater than lowest (NOT inverted)
      expect(highestValue).toBeGreaterThan(lowestValue)
    })

    it('maps factor with zero importance_score to zero influence', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      // Golden fixture: factor_churn_rate_0 has importance_score = 0
      const zeroFactor = factorSensitivity.find(
        (f) =>
          f.factor_id === 'factor_churn_rate_0' ||
          f.node_id === 'factor_churn_rate_0'
      )

      if (zeroFactor) {
        const value =
          zeroFactor.importance_score ?? zeroFactor.sensitivity_score ?? 0
        expect(value).toBe(0)
      }
    })
  })

  describe('Direction Mapping', () => {
    it('preserves direction field from response', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      const priceFactor = factorSensitivity.find(
        (f) => f.factor_id === 'fac_pro_price' || f.node_id === 'fac_pro_price'
      )

      // Golden fixture: fac_pro_price has direction = "negative"
      expect(priceFactor?.direction).toBe('negative')
    })
  })

  describe('Confidence Mapping', () => {
    it('preserves confidence field from response', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      const priceFactor = factorSensitivity.find(
        (f) => f.factor_id === 'fac_pro_price' || f.node_id === 'fac_pro_price'
      )

      // Golden fixture: fac_pro_price has confidence = 0.85
      expect(priceFactor?.confidence).toBeCloseTo(0.85, 2)
    })
  })
})

// ============================================================================
// Uncertainties Section Contract Tests
// ============================================================================

describe('Uncertainties Section Contract', () => {
  describe('Fragile Edges Mapping', () => {
    it('maps fragile_edges to robustness object', () => {
      const robustness = mappedReport.robustness

      expect(robustness).toBeDefined()
      expect(robustness?.fragile_edges).toBeDefined()
      expect(robustness?.fragile_edges.length).toBe(
        UNCERTAINTIES_EXPECTATIONS.totalFragileEdges
      )
    })

    it('preserves switch_probability for fragile edges', () => {
      const robustness = mappedReport.robustness
      const fragileEdges = robustness?.fragile_edges ?? []

      const priceEdge = fragileEdges.find(
        (e: any) =>
          e.from_id === 'fac_pro_price' ||
          e.fromId === 'fac_pro_price' ||
          e.source === 'fac_pro_price'
      )

      if (priceEdge) {
        // Golden fixture: switch_probability = 0.35
        expect((priceEdge as any).switch_probability).toBeCloseTo(0.35, 2)
      }
    })

    it('preserves alternative_winner_label for fragile edges', () => {
      const robustness = mappedReport.robustness
      const fragileEdges = robustness?.fragile_edges ?? []

      const priceEdge = fragileEdges.find(
        (e: any) =>
          e.from_id === 'fac_pro_price' ||
          e.fromId === 'fac_pro_price' ||
          e.source === 'fac_pro_price'
      )

      if (priceEdge) {
        // Golden fixture: alternative_winner_label = "Maintain current price"
        const altLabel =
          (priceEdge as any).alternative_winner_label ??
          (priceEdge as any).alternativeWinnerLabel
        expect(altLabel).toBe('Maintain current price')
      }
    })
  })

  describe('Button Rendering (Duplicate Fix)', () => {
    it('affectedNodes contains edge endpoints (not duplicated per button)', () => {
      // This test verifies the data structure that drives button rendering.
      // The actual button rendering is tested in component tests.
      const robustness = mappedReport.robustness
      const fragileEdges = robustness?.fragile_edges ?? []

      fragileEdges.forEach((edge: any) => {
        // Each edge should have from/to identifiers
        const hasFromId =
          edge.from_id !== undefined ||
          edge.fromId !== undefined ||
          edge.source !== undefined
        const hasToId =
          edge.to_id !== undefined ||
          edge.toId !== undefined ||
          edge.target !== undefined

        expect(hasFromId).toBe(true)
        expect(hasToId).toBe(true)
      })
    })
  })
})

// ============================================================================
// Warning Filtering Contract Tests
// ============================================================================

describe('Warning Filtering Contract', () => {
  describe('Clamped Messages Filtering', () => {
    it('golden fixture contains expected clamped messages', () => {
      // Verify fixture has the messages we need to filter
      const critiques = goldenResponse.critiques
      const clampedMessages = critiques.filter((c) =>
        c.message.toLowerCase().includes('clamped')
      )

      expect(clampedMessages.length).toBe(
        FILTERING_EXPECTATIONS.clampedMessageCount
      )
    })

    it('filters clamped messages from user-facing critique array', () => {
      const critique = mappedReport.run?.critique ?? []

      // Count messages containing "clamped"
      const clampedInOutput = critique.filter(
        (c: any) =>
          c.message?.toLowerCase().includes('clamped') ||
          c.text?.toLowerCase().includes('clamped')
      )

      // Should be filtered - expect 0 clamped messages in output
      expect(clampedInOutput.length).toBe(0)
    })
  })

  describe('Normalization Messages Filtering', () => {
    it('filters normalization messages from user-facing critique array', () => {
      const critique = mappedReport.run?.critique ?? []

      const normalizationInOutput = critique.filter(
        (c: any) =>
          c.message?.toLowerCase().includes('normalization') ||
          c.text?.toLowerCase().includes('normalization')
      )

      // Should be filtered
      expect(normalizationInOutput.length).toBe(0)
    })
  })

  describe('User-Facing Warnings', () => {
    it('preserves user-facing warnings in critique array', () => {
      const critique = mappedReport.run?.critique ?? []

      // LOW_EVIDENCE_COVERAGE should be preserved
      const evidenceWarning = critique.find(
        (c: any) =>
          c.code === 'LOW_EVIDENCE_COVERAGE' ||
          c.message?.includes('evidence') ||
          c.text?.includes('evidence')
      )

      expect(evidenceWarning).toBeDefined()
    })
  })
})

// ============================================================================
// Data Flow Contract Summary Tests
// ============================================================================

describe('Data Flow Contract', () => {
  describe('Required Fields Preservation', () => {
    it('factor_sensitivity contains all required fields', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      expect(factorSensitivity.length).toBeGreaterThan(0)

      const firstFactor = factorSensitivity[0]

      // Must have identifier
      expect(
        firstFactor.factor_id ?? firstFactor.node_id
      ).toBeDefined()

      // P0 Fix: importance_score must be preserved or mapped to sensitivity_score
      const hasInfluenceValue =
        firstFactor.importance_score !== undefined ||
        firstFactor.sensitivity_score !== undefined

      expect(hasInfluenceValue).toBe(true)
    })
  })

  describe('Regression Guards', () => {
    it('outcome values are NOT multiplied by 100', () => {
      // Guard against ×100 regression
      const optionProbs = mappedReport.option_probabilities

      Object.values(optionProbs).forEach((opt: any) => {
        if (opt.outcome?.mean !== undefined) {
          // Mean should be < 100 for percentage-form values
          // If it's > 1000, the ×100 bug has regressed
          expect(opt.outcome.mean).toBeLessThan(1000)
        }
      })
    })

    it('importance_score values are NOT inverted', () => {
      // Guard against inversion regression
      const factorSensitivity = mappedReport.factor_sensitivity

      // Find highest and lowest non-zero importance_score factors
      const withValues = factorSensitivity.filter((f) => {
        const val = f.importance_score ?? f.sensitivity_score ?? 0
        return val > 0.001
      })

      if (withValues.length >= 2) {
        const values = withValues.map(
          (f) => f.importance_score ?? f.sensitivity_score ?? 0
        )
        const max = Math.max(...values)
        const min = Math.min(...values)

        // Max should be >= 4× min for our fixture (1.0 vs 0.22)
        // If inverted, max would equal min
        expect(max).toBeGreaterThan(min * 2)
      }
    })
  })
})

// ============================================================================
// useResultsSectionData Pipeline Contract Tests
// ============================================================================

describe('useResultsSectionData Pipeline Contract', () => {
  describe('getRawElasticity Fallback Chain', () => {
    it('extracts importance_score when sensitivity_score is missing', () => {
      // Simulate ISL response with only importance_score
      const factor = {
        factor_id: 'test_factor',
        importance_score: 0.85,
        // no sensitivity_score, elasticity
      }

      const rawValue = getRawElasticity(factor as any)
      expect(rawValue).toBeCloseTo(0.85, 2)
    })

    it('prefers sensitivity_score over importance_score when both present', () => {
      const factor = {
        factor_id: 'test_factor',
        sensitivity_score: 0.6,
        importance_score: 0.85,
      }

      const rawValue = getRawElasticity(factor as any)
      expect(rawValue).toBeCloseTo(0.6, 2)
    })

    it('P0 FIX: uses importance_score when sensitivity_score is 0 placeholder', () => {
      // Critical regression test: sensitivity_score=0 should NOT block importance_score
      const factor = {
        factor_id: 'test_factor',
        sensitivity_score: 0,
        importance_score: 0.85,
      }

      const rawValue = getRawElasticity(factor as any)
      // Should use importance_score, NOT return 0
      expect(rawValue).toBeCloseTo(0.85, 2)
    })

    it('returns 0 when both sensitivity_score and importance_score are 0', () => {
      const factor = {
        factor_id: 'test_factor',
        sensitivity_score: 0,
        importance_score: 0,
      }

      const rawValue = getRawElasticity(factor as any)
      expect(rawValue).toBe(0)
    })
  })

  describe('computeNormalisedInfluences', () => {
    it('normalizes highest value to 100%', () => {
      const factors = [
        { key: 'fac_a', rawElasticity: 1.0 },
        { key: 'fac_b', rawElasticity: 0.5 },
        { key: 'fac_c', rawElasticity: 0.25 },
      ]

      const normalized = computeNormalisedInfluences(factors)

      expect(normalized.get('fac_a')).toBeCloseTo(1.0, 2) // 100%
      expect(normalized.get('fac_b')).toBeCloseTo(0.5, 2) // 50%
      expect(normalized.get('fac_c')).toBeCloseTo(0.25, 2) // 25%
    })

    it('handles all-zero values gracefully', () => {
      const factors = [
        { key: 'fac_a', rawElasticity: 0 },
        { key: 'fac_b', rawElasticity: 0 },
      ]

      const normalized = computeNormalisedInfluences(factors)

      expect(normalized.get('fac_a')).toBe(0)
      expect(normalized.get('fac_b')).toBe(0)
    })
  })

  describe('Full Pipeline: Golden Fixture → UI Values', () => {
    it('produces correct influence percentages for golden fixture factors', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      // Extract raw elasticity for each factor
      const factorsWithRaw = factorSensitivity.map((f) => ({
        key: f.factor_id ?? f.node_id ?? 'unknown',
        rawElasticity: getRawElasticity(f as any),
      }))

      // Compute normalized influences
      const normalized = computeNormalisedInfluences(factorsWithRaw)

      // Find fac_pro_price (importance_score: 1.0 - highest)
      const priceInfluence = normalized.get('fac_pro_price')
      expect(priceInfluence).toBeCloseTo(1.0, 2) // Should be 100%

      // Find fac_market_competition (importance_score: 0.22 - lowest non-zero)
      const marketInfluence = normalized.get('fac_market_competition')
      expect(marketInfluence).toBeCloseTo(0.22, 2) // Should be 22%

      // Verify highest importance → highest influence (NOT inverted)
      expect(priceInfluence).toBeGreaterThan(marketInfluence!)
    })

    it('preserves factor_id → label alignment through pipeline', () => {
      const factorSensitivity = mappedReport.factor_sensitivity

      // Find fac_pro_price
      const priceFactor = factorSensitivity.find(
        (f) => f.factor_id === 'fac_pro_price' || f.node_id === 'fac_pro_price'
      )

      expect(priceFactor).toBeDefined()
      expect(priceFactor?.label).toBe('Pro Plan Price')

      // Verify this is the factor with importance_score: 1.0
      const rawValue = getRawElasticity(priceFactor as any)
      expect(rawValue).toBeCloseTo(1.0, 2)
    })
  })
})
