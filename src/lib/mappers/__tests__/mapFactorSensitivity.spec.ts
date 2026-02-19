/**
 * mapFactorSensitivity Semantic Contract Tests
 *
 * Tests the factor sensitivity mapping logic.
 * Verifies influence extraction, confidence mapping, and direction normalisation.
 */

import { describe, it, expect } from 'vitest'
import { mapFactorSensitivity } from '../mapFactorSensitivity'
import type { RawFactor } from '../types'

describe('mapFactorSensitivity', () => {
  const defaultOptions = { sourcePath: 'downstream_calls.isl' as const }

  describe('influence extraction', () => {
    it('maps importance_score directly to rawInfluence', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', importance_score: 1.0, label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].rawInfluence).toBe(1.0)
    })

    it('prefers elasticity over sensitivity_score', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          elasticity: 0.8,
          sensitivity_score: 0.5,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].rawInfluence).toBe(0.8)
    })

    it('uses sensitivity_score when elasticity is missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', sensitivity_score: 0.7, label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].rawInfluence).toBe(0.7)
    })

    it('skips sensitivity_score=0 when importance_score > 0 (placeholder detection)', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          sensitivity_score: 0,
          importance_score: 0.9,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      // Should use importance_score, not the placeholder zero
      expect(result[0].rawInfluence).toBe(0.9)
    })

    it('uses sensitivity_score=0 when importance_score is also 0', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          sensitivity_score: 0,
          importance_score: 0,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].rawInfluence).toBe(0)
    })

    it('returns 0 when all influence fields are missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].rawInfluence).toBe(0)
    })
  })

  describe('confidence mapping', () => {
    // Confidence = path certainty from exists_probability. VOI is a separate metric.

    it('maps confidence: 0.7 (0-1 scale) to confidence: 70', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          confidence: 0.7,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].confidence).toBe(70)
    })

    it('maps confidence: 1.0 to confidence: 100', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          confidence: 1.0,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].confidence).toBe(100)
    })

    it('maps missing confidence to undefined (NOT 0)', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', importance_score: 0.5, label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].confidence).toBeUndefined()
    })

    it('maps confidence: 0 to confidence: 0 (real zero preserved)', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          confidence: 0,
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].confidence).toBe(0)
    })

    it('does NOT use value_of_information for confidence (VOI is separate metric)', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          value_of_information: 0.7, // VOI is NOT confidence
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      // Confidence should be undefined - VOI is not used for confidence
      expect(result[0].confidence).toBeUndefined()
      // But VOI should be preserved separately
      expect(result[0].valueOfInformation).toBe(0.7)
    })

    it('preserves valueOfInformation as separate field', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          value_of_information: 0.9,
          confidence: 0.7, // Both VOI and confidence can coexist
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].valueOfInformation).toBe(0.9)
      expect(result[0].confidence).toBe(70) // From confidence field, not VOI
    })

    it('handles confidence already in 0-100 scale', () => {
      const factors: RawFactor[] = [
        {
          factor_id: 'fac_price',
          importance_score: 0.5,
          confidence: 80, // Already 0-100 scale
          label: 'Price',
        },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].confidence).toBe(80)
    })
  })

  describe('direction normalisation', () => {
    it('normalises "positive" to positive', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', direction: 'positive', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].direction).toBe('positive')
    })

    it('normalises "negative" to negative', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', direction: 'negative', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].direction).toBe('negative')
    })

    it('normalises case-insensitive variants', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_a', direction: 'POSITIVE', label: 'A' },
        { factor_id: 'fac_b', direction: 'Negative', label: 'B' },
        { factor_id: 'fac_c', direction: '+', label: 'C' },
        { factor_id: 'fac_d', direction: '-', label: 'D' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].direction).toBe('positive')
      expect(result[1].direction).toBe('negative')
      expect(result[2].direction).toBe('positive')
      expect(result[3].direction).toBe('negative')
    })

    it('returns undefined for unknown direction', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', direction: 'sideways', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].direction).toBeUndefined()
    })

    it('returns undefined when direction is missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].direction).toBeUndefined()
    })
  })

  describe('factor ID extraction', () => {
    it('prefers node_id over factor_id', () => {
      const factors: RawFactor[] = [
        { node_id: 'node_price', factor_id: 'fac_price', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('node_price')
    })

    it('falls back to factor_id when node_id is missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('fac_price')
    })

    it('generates key from label when IDs are missing', () => {
      const factors: RawFactor[] = [
        { label: 'Pro Plan Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('pro_plan_price')
    })

    it('generates index-based key when all identifiers are missing', () => {
      const factors: RawFactor[] = [
        { importance_score: 0.5 },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('factor_0')
    })
  })

  describe('importance rank', () => {
    it('preserves importance_rank from source', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', importance_rank: 3, label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].importanceRank).toBe(3)
    })

    it('defaults to 0 when importance_rank is missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].importanceRank).toBe(0)
    })
  })

  describe('label handling', () => {
    it('preserves label from source', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', label: 'Pro Plan Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].label).toBe('Pro Plan Price')
    })

    it('uses factorId as label when label is missing', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].label).toBe('fac_price')
    })

    it('prefers factor_label over label (PLoT V2 field name)', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', factor_label: 'Price (adjusted)', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].label).toBe('Price (adjusted)')
    })

    it('falls back to label when factor_label is empty string', () => {
      const factors: RawFactor[] = [
        { factor_id: 'fac_price', factor_label: '', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].label).toBe('Price')
    })
  })

  describe('ID fallback with factor_label', () => {
    it('uses normalised factor_label for ID when no ID fields are present', () => {
      const factors: RawFactor[] = [
        { factor_label: 'Market Size' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('market_size')
      expect(result[0].label).toBe('Market Size')
    })

    it('prefers factor_label over label for ID fallback', () => {
      const factors: RawFactor[] = [
        { factor_label: 'Price (adjusted)', label: 'Price' },
      ]

      const result = mapFactorSensitivity(factors, defaultOptions)

      expect(result[0].factorId).toBe('price_(adjusted)')
    })
  })
})
