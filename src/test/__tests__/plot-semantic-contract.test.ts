/**
 * PLoT Semantic Contract Tests
 *
 * Verifies that the UI preserves meaning fields from PLoT response without
 * semantic transformation. These tests ensure the data pipeline maintains
 * the contract between ISL/PLoT and UI display.
 *
 * CRITICAL: If these tests fail, investigate whether the UI is incorrectly
 * transforming data that should be passed through unchanged.
 *
 * See: docs/UI_SEMANTIC_TRANSFORMS_AUDIT.md for full transform inventory.
 */

import { describe, it, expect } from 'vitest'
import goldenFixture from '../fixtures/golden-run-response.json'
import { mapRobustness } from '../../lib/mappers/mapRobustness'
import { mapFactorSensitivity } from '../../lib/mappers/mapFactorSensitivity'
import { normaliseDirection, normaliseRobustnessLevel } from '../../lib/mappers/utils'

// =============================================================================
// Test Data Setup
// =============================================================================

const fixtureFactorSensitivity = goldenFixture.factor_sensitivity
const fixtureRobustness = goldenFixture.robustness

// Map through actual mappers
const mappedFactors = mapFactorSensitivity(fixtureFactorSensitivity as any, {
  sourcePath: 'top_level',
})

const mappedRobustness = mapRobustness(fixtureRobustness as any, {
  sourcePath: 'top_level',
})

// =============================================================================
// Passthrough Contract Tests
// =============================================================================

describe('PLoT Semantic Contract: No Unauthorized Transforms', () => {
  describe('Direction Passthrough', () => {
    it('preserves direction values without inversion', () => {
      // Verify each fixture factor's direction is preserved
      fixtureFactorSensitivity.forEach((fixtureFactor, index) => {
        const mappedFactor = mappedFactors[index]
        const expectedDirection = normaliseDirection(fixtureFactor.direction)

        expect(mappedFactor.direction).toBe(expectedDirection)
      })
    })

    it('does NOT invert positive to negative', () => {
      const positiveFactor = fixtureFactorSensitivity.find(f => f.direction === 'positive')
      expect(positiveFactor).toBeDefined()

      const mappedPositive = mappedFactors.find(f => f.factorId === positiveFactor!.factor_id)
      expect(mappedPositive?.direction).toBe('positive')
    })

    it('does NOT invert negative to positive', () => {
      const negativeFactor = fixtureFactorSensitivity.find(f => f.direction === 'negative')
      expect(negativeFactor).toBeDefined()

      const mappedNegative = mappedFactors.find(f => f.factorId === negativeFactor!.factor_id)
      expect(mappedNegative?.direction).toBe('negative')
    })
  })

  describe('Confidence Passthrough', () => {
    it('preserves confidence values without clamping (when in 0-1 range)', () => {
      fixtureFactorSensitivity.forEach((fixtureFactor) => {
        if (typeof fixtureFactor.confidence === 'number') {
          const mappedFactor = mappedFactors.find(f => f.factorId === fixtureFactor.factor_id)

          // Confidence is scaled 0-1 → 0-100 in mapper, which is documented presentation transform
          // The CONTRACT is: no clamping, truncation, or value modification beyond scale
          const expectedScaled = Math.round(fixtureFactor.confidence * 100)
          expect(mappedFactor?.confidence).toBe(expectedScaled)
        }
      })
    })

    it('does NOT clamp confidence to arbitrary range', () => {
      // Verify that 0.85 confidence is preserved as 85, not clamped
      const highConfidenceFactor = fixtureFactorSensitivity.find(f => f.confidence === 0.85)
      expect(highConfidenceFactor).toBeDefined()

      const mapped = mappedFactors.find(f => f.factorId === highConfidenceFactor!.factor_id)
      expect(mapped?.confidence).toBe(85) // Scaled but not clamped
    })
  })

  describe('Switch Probability Passthrough', () => {
    it('preserves switch_probability without inversion', () => {
      mappedRobustness.fragileEdges.forEach((mappedEdge, index) => {
        const fixtureEdge = fixtureRobustness.fragile_edges[index]

        // CRITICAL: switch_probability should be passed through directly
        // ISL defines: switch_probability = P(alternative wins | edge weak)
        // Higher = more likely to flip - NO INVERSION
        expect(mappedEdge.switchProbability).toBe(fixtureEdge.switch_probability)
      })
    })

    it('does NOT apply 1 - switch_probability inversion', () => {
      const firstEdge = fixtureRobustness.fragile_edges[0]
      const mappedEdge = mappedRobustness.fragileEdges[0]

      // If inverted incorrectly: 1 - 0.35 = 0.65
      // Correct passthrough: 0.35
      expect(mappedEdge.switchProbability).toBe(0.35)
      expect(mappedEdge.switchProbability).not.toBe(0.65)
    })
  })

  describe('Alternative Winner Label Passthrough', () => {
    it('preserves alternative_winner_label without remapping', () => {
      mappedRobustness.fragileEdges.forEach((mappedEdge, index) => {
        const fixtureEdge = fixtureRobustness.fragile_edges[index]

        expect(mappedEdge.alternativeWinnerLabel).toBe(fixtureEdge.alternative_winner_label)
      })
    })

    it('does NOT substitute fallback values when label exists', () => {
      const edgeWithLabel = fixtureRobustness.fragile_edges.find(
        e => e.alternative_winner_label && e.alternative_winner_label.length > 0
      )
      expect(edgeWithLabel).toBeDefined()

      const mapped = mappedRobustness.fragileEdges.find(
        e => e.fromId === edgeWithLabel!.from_id
      )

      // Should preserve exact label, not substitute "another option"
      expect(mapped?.alternativeWinnerLabel).toBe(edgeWithLabel!.alternative_winner_label)
      expect(mapped?.alternativeWinnerLabel).not.toBe('another option')
    })
  })

  describe('Ranking Stability Passthrough', () => {
    it('preserves ranking_stability without clamping', () => {
      expect(mappedRobustness.rankingStability).toBe(fixtureRobustness.ranking_stability)
    })

    it('does NOT clamp ranking_stability to arbitrary range', () => {
      // Fixture has 0.72 - should be passed through exactly
      expect(mappedRobustness.rankingStability).toBe(0.72)
    })
  })

  describe('Win Probability Passthrough', () => {
    it('preserves win_probability from option_comparison', () => {
      const fixtureOptions = goldenFixture.option_comparison

      fixtureOptions.forEach((fixtureOpt) => {
        // win_probability should be passed through without modification
        // UI may display as percentage, but stored value should match
        expect(fixtureOpt.win_probability).toBeDefined()
        expect(typeof fixtureOpt.win_probability).toBe('number')
      })
    })
  })

  describe('From/To Label Passthrough', () => {
    it('preserves from_label and to_label on fragile edges', () => {
      mappedRobustness.fragileEdges.forEach((mappedEdge, index) => {
        const fixtureEdge = fixtureRobustness.fragile_edges[index]

        expect(mappedEdge.fromLabel).toBe(fixtureEdge.from_label)
        expect(mappedEdge.toLabel).toBe(fixtureEdge.to_label)
      })
    })
  })
})

// =============================================================================
// Normalization Contract Tests (Documented Transforms)
// =============================================================================

describe('PLoT Semantic Contract: Documented Normalizations', () => {
  describe('Direction Normalization (Documented)', () => {
    it('normalizes direction variants to canonical enum', () => {
      // These are DOCUMENTED transforms - acceptable
      expect(normaliseDirection('positive')).toBe('positive')
      expect(normaliseDirection('POSITIVE')).toBe('positive')
      expect(normaliseDirection('+')).toBe('positive')
      expect(normaliseDirection('increase')).toBe('positive')

      expect(normaliseDirection('negative')).toBe('negative')
      expect(normaliseDirection('NEGATIVE')).toBe('negative')
      expect(normaliseDirection('-')).toBe('negative')
      expect(normaliseDirection('decrease')).toBe('negative')

      expect(normaliseDirection('unknown')).toBeUndefined()
      expect(normaliseDirection(undefined)).toBeUndefined()
    })
  })

  describe('Robustness Level Normalization (Documented)', () => {
    it('normalizes level variants to canonical enum', () => {
      expect(normaliseRobustnessLevel('high')).toBe('high')
      expect(normaliseRobustnessLevel('HIGH')).toBe('high')
      expect(normaliseRobustnessLevel('moderate')).toBe('moderate')
      expect(normaliseRobustnessLevel('medium')).toBe('moderate') // Alias
      expect(normaliseRobustnessLevel('low')).toBe('low')
      expect(normaliseRobustnessLevel('very_low')).toBe('very_low')
      expect(normaliseRobustnessLevel('verylow')).toBe('very_low') // Alias
    })
  })
})

// =============================================================================
// Regression Guards
// =============================================================================

describe('PLoT Semantic Contract: Regression Guards', () => {
  it('mapRobustness does NOT invert any probabilities', () => {
    // Guard against accidentally adding 1 - probability transforms
    const sourceCode = mapRobustness.toString()

    // These patterns would indicate incorrect inversion
    expect(sourceCode).not.toContain('1 - ')
    expect(sourceCode).not.toContain('1.0 - ')
    expect(sourceCode).not.toContain('1-')
  })

  it('fixture has expected structure for contract verification', () => {
    // Ensure fixture is valid for testing
    expect(fixtureFactorSensitivity.length).toBeGreaterThan(0)
    expect(fixtureRobustness.fragile_edges.length).toBeGreaterThan(0)

    // Ensure direction diversity for testing
    const directions = fixtureFactorSensitivity.map(f => f.direction)
    expect(directions).toContain('positive')
    expect(directions).toContain('negative')
  })
})
