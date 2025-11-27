/**
 * Evidence Coverage Utility Tests (P0.2)
 */
import { describe, it, expect } from 'vitest'
import {
  calculateCoverageLevel,
  fromBackendPercentage,
  fromLocalCounts,
  getBestEvidenceCoverage,
} from '../evidenceCoverage'

describe('evidenceCoverage utils', () => {
  describe('calculateCoverageLevel', () => {
    it('returns full for 100%', () => {
      expect(calculateCoverageLevel(100)).toBe('full')
    })

    it('returns partial for 60-99%', () => {
      expect(calculateCoverageLevel(60)).toBe('partial')
      expect(calculateCoverageLevel(80)).toBe('partial')
      expect(calculateCoverageLevel(99)).toBe('partial')
    })

    it('returns minimal for 1-59%', () => {
      expect(calculateCoverageLevel(1)).toBe('minimal')
      expect(calculateCoverageLevel(30)).toBe('minimal')
      expect(calculateCoverageLevel(59)).toBe('minimal')
    })

    it('returns none for 0%', () => {
      expect(calculateCoverageLevel(0)).toBe('none')
    })
  })

  describe('fromBackendPercentage', () => {
    it('converts 0.0-1.0 range to 0-100 percentage', () => {
      expect(fromBackendPercentage(0.5).percentage).toBe(50)
      expect(fromBackendPercentage(1.0).percentage).toBe(100)
      expect(fromBackendPercentage(0.0).percentage).toBe(0)
    })

    it('sets source to backend', () => {
      expect(fromBackendPercentage(0.75).source).toBe('backend')
    })

    it('calculates correct coverage level', () => {
      expect(fromBackendPercentage(1.0).level).toBe('full')
      expect(fromBackendPercentage(0.75).level).toBe('partial')
      expect(fromBackendPercentage(0.3).level).toBe('minimal')
      expect(fromBackendPercentage(0.0).level).toBe('none')
    })

    it('does not include counts', () => {
      expect(fromBackendPercentage(0.5).counts).toBeUndefined()
    })
  })

  describe('fromLocalCounts', () => {
    it('calculates percentage from counts', () => {
      expect(fromLocalCounts(5, 10).percentage).toBe(50)
      expect(fromLocalCounts(10, 10).percentage).toBe(100)
      expect(fromLocalCounts(0, 10).percentage).toBe(0)
    })

    it('handles zero total gracefully', () => {
      expect(fromLocalCounts(0, 0).percentage).toBe(0)
      expect(fromLocalCounts(5, 0).percentage).toBe(0)
    })

    it('sets source to local', () => {
      expect(fromLocalCounts(5, 10).source).toBe('local')
    })

    it('includes counts in result', () => {
      const result = fromLocalCounts(5, 10)
      expect(result.counts).toEqual({ evidenced: 5, total: 10 })
    })

    it('calculates correct coverage level', () => {
      expect(fromLocalCounts(10, 10).level).toBe('full')
      expect(fromLocalCounts(8, 10).level).toBe('partial')
      expect(fromLocalCounts(3, 10).level).toBe('minimal')
      expect(fromLocalCounts(0, 10).level).toBe('none')
    })
  })

  describe('getBestEvidenceCoverage', () => {
    it('prefers local counts when available', () => {
      const result = getBestEvidenceCoverage(
        { evidenced: 5, total: 10 },
        0.75
      )
      expect(result?.source).toBe('local')
      expect(result?.percentage).toBe(50)
    })

    it('falls back to backend percentage when no local counts', () => {
      const result = getBestEvidenceCoverage(null, 0.75)
      expect(result?.source).toBe('backend')
      expect(result?.percentage).toBe(75)
    })

    it('falls back to backend when local total is 0', () => {
      const result = getBestEvidenceCoverage(
        { evidenced: 0, total: 0 },
        0.5
      )
      expect(result?.source).toBe('backend')
    })

    it('returns null when neither source available', () => {
      expect(getBestEvidenceCoverage(null, null)).toBeNull()
      expect(getBestEvidenceCoverage(undefined, undefined)).toBeNull()
    })

    it('handles NaN backend percentage', () => {
      const result = getBestEvidenceCoverage(null, NaN)
      expect(result).toBeNull()
    })
  })
})
