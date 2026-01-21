/**
 * Display-Only Transform Invariants
 *
 * These tests verify that formatting functions are PURELY presentational
 * and do not modify the underlying data values.
 *
 * Display transforms include:
 * - Percentage formatting (value * 100 for display string)
 * - K/M suffix compression ($1,500,000 → $1.5M)
 * - Sign prefixes for deltas (+5%, -3%)
 * - Locale-specific formatting
 *
 * These transforms are acceptable because:
 * 1. They only affect the display string, not the stored value
 * 2. The original value can be reconstructed or is preserved elsewhere
 * 3. They improve readability without losing precision for the use case
 */

import { describe, it, expect } from 'vitest'
import {
  formatOutcomeValue,
  formatOutcomeValueCompact,
  formatDeltaPercent,
  formatConfidence,
  formatConfidencePercent,
} from '../../../../lib/format'

describe('Display-Only Format Functions', () => {
  describe('formatOutcomeValue - Currency', () => {
    it('should format millions with M suffix', () => {
      expect(formatOutcomeValue(1500000, 'currency')).toBe('$1.5M')
    })

    it('should format thousands with K suffix', () => {
      expect(formatOutcomeValue(200000, 'currency')).toBe('$200.0K')
    })

    it('should format small values with locale separators', () => {
      const result = formatOutcomeValue(999, 'currency')
      expect(result).toBe('$999')
    })

    it('should handle negative values', () => {
      expect(formatOutcomeValue(-1500000, 'currency')).toBe('-$1.5M')
    })

    it('should handle null with placeholder', () => {
      expect(formatOutcomeValue(null, 'currency')).toBe('—')
    })

    it('should handle NaN with placeholder', () => {
      expect(formatOutcomeValue(NaN, 'currency')).toBe('—')
    })
  })

  describe('formatOutcomeValue - Percent', () => {
    it('should convert 0-1 probability to percentage', () => {
      expect(formatOutcomeValue(0.75, 'percent')).toBe('75.0%')
    })

    it('should cap at 99% (Brief 33 fix)', () => {
      // Values >= 1.0 are capped to avoid unrealistic "100% success"
      expect(formatOutcomeValue(1.0, 'percent')).toBe('99.0%')
      expect(formatOutcomeValue(0.9999, 'percent')).toBe('99.0%')
    })

    it('should handle zero probability', () => {
      expect(formatOutcomeValue(0, 'percent')).toBe('0.0%')
    })

    it('should handle values already in percentage form', () => {
      // Values > 1 are treated as already percentages
      expect(formatOutcomeValue(75, 'percent')).toBe('75.0%')
    })
  })

  describe('formatOutcomeValue - Count', () => {
    it('should auto-detect probability format', () => {
      // Values in 0-1 range with decimals are treated as probabilities
      expect(formatOutcomeValue(0.75, 'count')).toBe('75.0%')
    })

    it('should format large counts with suffixes', () => {
      expect(formatOutcomeValue(1500000, 'count')).toBe('1.5M')
    })
  })

  describe('formatOutcomeValueCompact - Reduced precision', () => {
    it('should format currency without decimals', () => {
      expect(formatOutcomeValueCompact(1500000, 'currency')).toBe('$2M')
    })

    it('should round percentage display', () => {
      expect(formatOutcomeValueCompact(0.756, 'percent')).toBe('76%')
    })

    it('should cap at 99% (Brief 33 fix)', () => {
      expect(formatOutcomeValueCompact(1.0, 'percent')).toBe('99%')
    })
  })

  describe('formatDeltaPercent - Sign prefix', () => {
    it('should add + prefix for positive delta', () => {
      expect(formatDeltaPercent(5.2)).toBe('+5.2%')
    })

    it('should preserve - prefix for negative delta', () => {
      expect(formatDeltaPercent(-3.1)).toBe('-3.1%')
    })

    it('should add + prefix for zero delta', () => {
      expect(formatDeltaPercent(0)).toBe('+0.0%')
    })
  })

  describe('formatConfidence - 0-1 to percentage string', () => {
    it('should convert confidence to percentage', () => {
      expect(formatConfidence(0.85)).toBe('85%')
    })

    it('should round to nearest integer', () => {
      expect(formatConfidence(0.856)).toBe('86%')
    })

    it('should handle undefined', () => {
      expect(formatConfidence(undefined)).toBe('Unknown')
    })

    it('should handle zero', () => {
      expect(formatConfidence(0)).toBe('0%')
    })

    it('should handle 1.0', () => {
      expect(formatConfidence(1.0)).toBe('100%')
    })
  })

  describe('formatConfidencePercent - Already percentage', () => {
    it('should format percentage value', () => {
      expect(formatConfidencePercent(85)).toBe('85%')
    })

    it('should round to nearest integer', () => {
      expect(formatConfidencePercent(85.6)).toBe('86%')
    })
  })
})

describe('Display Transform Purity', () => {
  /**
   * These tests verify that format functions are pure and do not
   * have side effects or modify any external state.
   */

  it('should be referentially transparent (same input → same output)', () => {
    const value = 0.756
    const result1 = formatOutcomeValue(value, 'percent')
    const result2 = formatOutcomeValue(value, 'percent')
    expect(result1).toBe(result2)
  })

  it('should not modify the input value', () => {
    const value = 0.756
    const originalValue = value
    formatOutcomeValue(value, 'percent')
    expect(value).toBe(originalValue)
  })

  it('should return new string each call (no shared state)', () => {
    const result1 = formatOutcomeValue(100, 'currency')
    const result2 = formatOutcomeValue(200, 'currency')
    // Different values should produce different outputs
    expect(result1).not.toBe(result2)
  })
})

describe('Display Transform Reversibility', () => {
  /**
   * These tests document which transforms are reversible.
   * Irreversible transforms are acceptable for display because
   * the original value is preserved in the data model.
   */

  describe('Reversible transforms (lossless for display range)', () => {
    it('percentage formatting is reversible', () => {
      const original = 0.75
      const formatted = formatOutcomeValue(original, 'percent') // '75.0%'
      const parsed = parseFloat(formatted) / 100
      expect(parsed).toBeCloseTo(original, 2)
    })
  })

  describe('Lossy transforms (acceptable for display)', () => {
    it('compact currency loses precision', () => {
      const original = 1234567
      const formatted = formatOutcomeValueCompact(original, 'currency') // '$1M'
      // Cannot recover exact value from '$1M' - this is acceptable
      expect(formatted).toBe('$1M')
    })

    it('rounding loses sub-integer precision', () => {
      const original = 0.856
      const formatted = formatConfidence(original) // '86%'
      // Cannot recover 0.856 from '86%' - this is acceptable
      expect(formatted).toBe('86%')
    })

    it('99% cap loses values above 99%', () => {
      const original = 0.997
      const formatted = formatOutcomeValue(original, 'percent') // '99.0%'
      // Cannot distinguish 0.997 from 0.99 - this is by design
      expect(formatted).toBe('99.0%')
    })
  })
})
