/**
 * Baseline Detection Utility Tests
 *
 * Task 1.7: Tests for identifying and labeling baseline/status quo options
 */
import { describe, it, expect } from 'vitest'
import {
  detectBaseline,
  detectBaselineByValue,
  analyzeBaselineComparison,
  formatBaselineComparison,
  getBaselineBadgeProps,
  type RankedOption,
} from '../baselineDetection'

describe('detectBaseline', () => {
  describe('detects baseline keywords', () => {
    it('detects "do nothing"', () => {
      const result = detectBaseline('Do nothing')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('do nothing')
      expect(result.displayLabel).toBe('Your baseline')
    })

    it('detects "keep"', () => {
      const result = detectBaseline('Keep current system')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('keep')
    })

    it('detects "maintain"', () => {
      const result = detectBaseline('Maintain existing process')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('maintain')
    })

    it('detects "status quo"', () => {
      const result = detectBaseline('Status quo option')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('status quo')
    })

    it('detects "current"', () => {
      const result = detectBaseline('Current approach')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('current')
    })

    it('detects "baseline"', () => {
      const result = detectBaseline('Baseline scenario')
      expect(result.isBaseline).toBe(true)
      expect(result.matchedKeywords).toContain('baseline')
    })

    it('detects "as is" and "as-is"', () => {
      expect(detectBaseline('Leave as is').isBaseline).toBe(true)
      expect(detectBaseline('As-is approach').isBaseline).toBe(true)
    })
  })

  describe('does not detect non-baseline options', () => {
    it('returns false for action-oriented options', () => {
      const result = detectBaseline('Implement new software')
      expect(result.isBaseline).toBe(false)
      expect(result.matchedKeywords).toHaveLength(0)
      expect(result.displayLabel).toBe('Implement new software')
    })

    it('returns false for change options', () => {
      const result = detectBaseline('Switch to vendor B')
      expect(result.isBaseline).toBe(false)
    })
  })

  describe('case insensitivity', () => {
    it('detects keywords regardless of case', () => {
      expect(detectBaseline('DO NOTHING').isBaseline).toBe(true)
      expect(detectBaseline('Keep Current').isBaseline).toBe(true)
      expect(detectBaseline('STATUS QUO').isBaseline).toBe(true)
    })
  })
})

describe('detectBaselineByValue', () => {
  it('detects matching values within tolerance', () => {
    expect(detectBaselineByValue(100, 100)).toBe(true)
    expect(detectBaselineByValue(100.5, 100, 0.01)).toBe(true)
    expect(detectBaselineByValue(99.5, 100, 0.01)).toBe(true)
  })

  it('rejects values outside tolerance', () => {
    expect(detectBaselineByValue(102, 100, 0.01)).toBe(false)
    expect(detectBaselineByValue(98, 100, 0.01)).toBe(false)
  })

  it('handles zero baseline', () => {
    expect(detectBaselineByValue(0, 0)).toBe(true)
    expect(detectBaselineByValue(0.005, 0, 0.01)).toBe(true)
    expect(detectBaselineByValue(0.1, 0, 0.01)).toBe(false)
  })
})

describe('analyzeBaselineComparison', () => {
  const mockOptions: RankedOption[] = [
    { id: 'opt1', label: 'Do nothing', expectedValue: 50, rank: 3 },
    { id: 'opt2', label: 'Option A', expectedValue: 75, rank: 1 },
    { id: 'opt3', label: 'Option B', expectedValue: 60, rank: 2 },
  ]

  it('identifies baseline by label', () => {
    const result = analyzeBaselineComparison(mockOptions)

    expect(result.baselineOption?.id).toBe('opt1')
    expect(result.baselineOption?.label).toBe('Do nothing')
  })

  it('categorizes options relative to baseline', () => {
    const result = analyzeBaselineComparison(mockOptions)

    expect(result.improvingOptions).toHaveLength(2)
    expect(result.worseOptions).toHaveLength(0)
    expect(result.allWorseThanBaseline).toBe(false)
    expect(result.warningMessage).toBeNull()
  })

  it('handles all options worse than baseline', () => {
    const worseOptions: RankedOption[] = [
      { id: 'opt1', label: 'Keep current', expectedValue: 80, rank: 1 },
      { id: 'opt2', label: 'Option A', expectedValue: 60, rank: 2 },
      { id: 'opt3', label: 'Option B', expectedValue: 40, rank: 3 },
    ]

    const result = analyzeBaselineComparison(worseOptions)

    expect(result.allWorseThanBaseline).toBe(true)
    expect(result.warningMessage).toBeTruthy()
    expect(result.warningMessage).toContain('No option improves')
  })

  it('handles empty options array', () => {
    const result = analyzeBaselineComparison([])

    expect(result.baselineOption).toBeNull()
    expect(result.improvingOptions).toHaveLength(0)
    expect(result.worseOptions).toHaveLength(0)
    expect(result.allWorseThanBaseline).toBe(false)
  })

  it('uses lowest-ranked option as implicit baseline when no keywords match', () => {
    const noBaselineKeywords: RankedOption[] = [
      { id: 'opt1', label: 'Option A', expectedValue: 30, rank: 3 },
      { id: 'opt2', label: 'Option B', expectedValue: 75, rank: 1 },
      { id: 'opt3', label: 'Option C', expectedValue: 60, rank: 2 },
    ]

    const result = analyzeBaselineComparison(noBaselineKeywords)

    // Should pick the lowest expectedValue as implicit baseline
    expect(result.baselineOption?.id).toBe('opt1')
  })
})

describe('formatBaselineComparison', () => {
  it('returns "vs. your baseline" for detected baseline', () => {
    const result = formatBaselineComparison('Do nothing', true)
    expect(result).toBe('vs. your baseline')
  })

  it('cleans up common baseline labels', () => {
    expect(formatBaselineComparison('do nothing', false)).toBe('vs. taking no action')
    expect(formatBaselineComparison('status quo', false)).toBe('vs. your current approach')
  })

  it('preserves non-baseline labels with "vs." prefix', () => {
    const result = formatBaselineComparison('Option A', false)
    expect(result).toBe('vs. Option A')
  })
})

describe('getBaselineBadgeProps', () => {
  it('returns badge props for baseline options', () => {
    const result = getBaselineBadgeProps(true)

    expect(result).not.toBeNull()
    expect(result?.label).toBe('Your baseline')
    expect(result?.className).toContain('bg-sky-100')
  })

  it('returns null for non-baseline options', () => {
    const result = getBaselineBadgeProps(false)
    expect(result).toBeNull()
  })
})
