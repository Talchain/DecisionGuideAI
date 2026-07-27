/**
 * Coherence Check Utility Tests
 *
 * Task 1.6: Tests for detecting contradictions between recommendation and outcome
 */
import { describe, it, expect } from 'vitest'
import {
  checkRecommendationCoherence,
  getCoherenceWarningMessage,
} from '../coherenceCheck'

describe('checkRecommendationCoherence', () => {
  describe('returns coherent for valid inputs', () => {
    it('returns coherent when both are positive', () => {
      const result = checkRecommendationCoherence(
        'Go with Option A for best results',
        'Success is highly likely with this approach',
        75
      )

      expect(result.isCoherent).toBe(true)
      expect(result.contradiction).toBeUndefined()
    })

    it('returns coherent when both are negative', () => {
      const result = checkRecommendationCoherence(
        'Avoid this option due to risks',
        'Failure is likely with current setup',
        25
      )

      expect(result.isCoherent).toBe(true)
    })

    it('returns coherent when inputs are null or undefined', () => {
      expect(checkRecommendationCoherence(null, 'Some outcome', 50).isCoherent).toBe(true)
      expect(checkRecommendationCoherence('Some headline', null, 50).isCoherent).toBe(true)
      expect(checkRecommendationCoherence(undefined, undefined, null).isCoherent).toBe(true)
    })

    it('returns coherent for empty strings', () => {
      const result = checkRecommendationCoherence('', '', 50)
      expect(result.isCoherent).toBe(true)
    })
  })

  describe('detects sentiment mismatch', () => {
    it('detects positive recommendation with negative outcome', () => {
      const result = checkRecommendationCoherence(
        'Proceed with Option A - it performs best',
        'Failure is likely and risks are high',
        30
      )

      expect(result.isCoherent).toBe(false)
      expect(result.contradiction?.type).toBe('sentiment_mismatch')
    })

    it('allows negative/neutral recommendation with positive outcome', () => {
      // Implementation only checks positive recommendation + negative outcome
      // Negative recommendation with positive outcome is not flagged as incoherent
      const result = checkRecommendationCoherence(
        'Avoid Option B - it has poor outcomes',
        'Success is very likely with excellent results',
        80
      )

      // This is coherent since the implementation focuses on catching
      // overly optimistic recommendations, not pessimistic ones
      expect(result.isCoherent).toBe(true)
    })
  })

  describe('detects outcome mismatch', () => {
    it('detects positive recommendation with low outcome value', () => {
      const result = checkRecommendationCoherence(
        'Proceed with Option A for best results',
        'Analysis complete',
        15
      )

      expect(result.isCoherent).toBe(false)
      expect(result.contradiction?.type).toBe('outcome_mismatch')
    })

    it('allows non-positive recommendation with any outcome value', () => {
      // "Avoid" is not a positive action, so no mismatch is detected
      const result = checkRecommendationCoherence(
        'Avoid this approach',
        'Analysis complete',
        85
      )

      expect(result.isCoherent).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles undefined outcome value', () => {
      const result = checkRecommendationCoherence(
        'Go with this option',
        'Good results expected',
        undefined
      )

      expect(result.isCoherent).toBe(true)
    })

    it('handles outcome value of 0 with positive recommendation', () => {
      const result = checkRecommendationCoherence(
        'Proceed with this option',
        'Analysis complete',
        0
      )

      // Outcome value 0 with positive recommendation should be flagged
      expect(result.isCoherent).toBe(false)
      expect(result.contradiction?.type).toBe('outcome_mismatch')
    })

    it('handles outcome value of 100 (no mismatch)', () => {
      // High outcome value with any recommendation is coherent
      const result = checkRecommendationCoherence(
        'Proceed with this option',
        'Success is expected',
        100
      )

      expect(result.isCoherent).toBe(true)
    })

    it('handles risk-aware recommendations with low outcome', () => {
      // Recommendations mentioning "risk" are allowed with low outcomes
      const result = checkRecommendationCoherence(
        'Proceed with caution due to risk',
        'Results uncertain',
        15
      )

      expect(result.isCoherent).toBe(true)
    })
  })
})

describe('getCoherenceWarningMessage', () => {
  it('returns empty string for coherent result', () => {
    const message = getCoherenceWarningMessage({ isCoherent: true })
    expect(message).toBe('')
  })

  it('returns appropriate message for sentiment_mismatch', () => {
    const result = checkRecommendationCoherence(
      'Proceed with Option A - it performs best',
      'Failure is likely and risks are high',
      30
    )
    const message = getCoherenceWarningMessage(result)
    expect(message).toContain('Results require review')
    expect(message.length).toBeGreaterThan(10)
  })

  it('returns appropriate message for outcome_mismatch', () => {
    const result = checkRecommendationCoherence(
      'Proceed with this option',
      'Analysis complete',
      10
    )
    const message = getCoherenceWarningMessage(result)
    expect(message).toContain('Results require review')
    expect(message.length).toBeGreaterThan(10)
  })

  it('returns message for incoherent result with no specific type', () => {
    const message = getCoherenceWarningMessage({
      isCoherent: false,
      contradiction: undefined,
    })
    expect(message).toContain('Results require review')
  })
})
