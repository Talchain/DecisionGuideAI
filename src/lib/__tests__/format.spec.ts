/**
 * Tests for Shared Numeric Formatting Utilities
 *
 * Task 3.4: Standardise Units Throughout
 * Ensures consistent formatting across all numeric displays.
 */

import { describe, it, expect } from 'vitest'
import {
  formatOutcomeValue,
  formatOutcomeValueCompact,
  formatDeltaPercent,
  formatConfidence,
  formatConfidencePercent,
  formatRange,
  formatDelta,
  formatPercent,
} from '../format'

describe('formatOutcomeValue', () => {
  describe('currency formatting', () => {
    it('formats small currency values', () => {
      expect(formatOutcomeValue(100, 'currency')).toBe('$100')
      expect(formatOutcomeValue(999, 'currency')).toBe('$999')
    })

    it('formats thousands with K suffix', () => {
      expect(formatOutcomeValue(1000, 'currency')).toBe('$1.0K')
      expect(formatOutcomeValue(5500, 'currency')).toBe('$5.5K')
      expect(formatOutcomeValue(999999, 'currency')).toBe('$1000.0K')
    })

    it('formats millions with M suffix', () => {
      expect(formatOutcomeValue(1000000, 'currency')).toBe('$1.0M')
      expect(formatOutcomeValue(2500000, 'currency')).toBe('$2.5M')
    })

    it('uses custom currency symbol', () => {
      expect(formatOutcomeValue(1000, 'currency', '£')).toBe('£1.0K')
      expect(formatOutcomeValue(1000000, 'currency', '€')).toBe('€1.0M')
    })

    it('handles negative values', () => {
      expect(formatOutcomeValue(-1500, 'currency')).toBe('-$1.5K')
      expect(formatOutcomeValue(-2000000, 'currency')).toBe('-$2.0M')
    })
  })

  describe('percent formatting', () => {
    it('formats values already in percentage form', () => {
      expect(formatOutcomeValue(50, 'percent')).toBe('50.0%')
      // Brief 33: Values are capped at 99% to avoid unrealistic "100% success"
      expect(formatOutcomeValue(100, 'percent')).toBe('99.0%')
    })

    it('auto-converts 0-1 probability values to percent', () => {
      expect(formatOutcomeValue(0.5, 'percent')).toBe('50.0%')
      expect(formatOutcomeValue(0.75, 'percent')).toBe('75.0%')
      // Brief 33: Values are capped at 99% to avoid unrealistic "100% success"
      expect(formatOutcomeValue(1, 'percent')).toBe('99.0%')
      expect(formatOutcomeValue(0, 'percent')).toBe('0.0%')
    })

    it('handles decimal precision', () => {
      expect(formatOutcomeValue(0.333, 'percent')).toBe('33.3%')
      expect(formatOutcomeValue(0.666, 'percent')).toBe('66.6%')
    })
  })

  describe('count formatting', () => {
    it('formats regular counts', () => {
      expect(formatOutcomeValue(100, 'count')).toBe('100')
      expect(formatOutcomeValue(5000, 'count')).toBe('5.0K')
    })

    it('auto-converts 0-1 probability values', () => {
      expect(formatOutcomeValue(0.5, 'count')).toBe('50.0%')
      expect(formatOutcomeValue(0.75, 'count')).toBe('75.0%')
    })

    it('formats integer values as plain numbers', () => {
      expect(formatOutcomeValue(42, 'count')).toBe('42')
    })
  })

  describe('null handling', () => {
    it('returns placeholder for null', () => {
      expect(formatOutcomeValue(null, 'percent')).toBe('—')
      expect(formatOutcomeValue(null, 'currency')).toBe('—')
      expect(formatOutcomeValue(null, 'count')).toBe('—')
    })

    it('returns placeholder for NaN', () => {
      expect(formatOutcomeValue(NaN, 'percent')).toBe('—')
    })

    it('uses custom placeholder', () => {
      expect(formatOutcomeValue(null, 'percent', undefined, { nullPlaceholder: 'N/A' })).toBe('N/A')
    })
  })
})

describe('formatOutcomeValueCompact', () => {
  it('uses fewer decimal places than standard', () => {
    expect(formatOutcomeValueCompact(0.75, 'percent')).toBe('75%')
    expect(formatOutcomeValueCompact(50, 'percent')).toBe('50%')
  })

  it('rounds currency to whole numbers', () => {
    expect(formatOutcomeValueCompact(1234, 'currency')).toBe('$1K')
    expect(formatOutcomeValueCompact(1500000, 'currency')).toBe('$2M')
  })

  it('handles null values', () => {
    expect(formatOutcomeValueCompact(null, 'percent')).toBe('—')
  })
})

describe('formatDeltaPercent', () => {
  it('includes + sign for positive values', () => {
    expect(formatDeltaPercent(25)).toBe('+25.0%')
    expect(formatDeltaPercent(0.5)).toBe('+0.5%')
  })

  it('shows negative values with - sign', () => {
    expect(formatDeltaPercent(-15)).toBe('-15.0%')
    expect(formatDeltaPercent(-0.3)).toBe('-0.3%')
  })

  it('handles zero', () => {
    expect(formatDeltaPercent(0)).toBe('+0.0%')
  })
})

describe('formatConfidence', () => {
  it('converts 0-1 values to percentages', () => {
    expect(formatConfidence(0.75)).toBe('75%')
    expect(formatConfidence(0.9)).toBe('90%')
    expect(formatConfidence(1)).toBe('100%')
    expect(formatConfidence(0)).toBe('0%')
  })

  it('returns Unknown for undefined', () => {
    expect(formatConfidence(undefined)).toBe('Unknown')
  })

  it('rounds to whole numbers', () => {
    expect(formatConfidence(0.333)).toBe('33%')
    expect(formatConfidence(0.666)).toBe('67%')
  })
})

describe('formatConfidencePercent', () => {
  it('formats already-percentage values', () => {
    expect(formatConfidencePercent(75)).toBe('75%')
    expect(formatConfidencePercent(90)).toBe('90%')
  })

  it('rounds to whole numbers', () => {
    expect(formatConfidencePercent(75.5)).toBe('76%')
    expect(formatConfidencePercent(33.3)).toBe('33%')
  })
})

describe('formatRange', () => {
  it('uses en-dash delimiter consistently', () => {
    const result = formatRange(10, 90, 'percent')
    expect(result).toBe('10% – 90%')
    expect(result).toContain(' – ')
    expect(result).not.toContain(' to ')
    expect(result).not.toMatch(/ - /)
  })

  it('formats percentage ranges', () => {
    expect(formatRange(0.1, 0.9, 'percent')).toBe('10% – 90%')
    expect(formatRange(25, 75, 'percent')).toBe('25% – 75%')
  })

  it('formats currency ranges', () => {
    expect(formatRange(1000, 5000, 'currency')).toBe('$1K – $5K')
    expect(formatRange(1000000, 2000000, 'currency')).toBe('$1M – $2M')
  })

  it('handles null values', () => {
    expect(formatRange(null, 90, 'percent')).toBe('— – 90%')
    expect(formatRange(10, null, 'percent')).toBe('10% – —')
    expect(formatRange(null, null, 'percent')).toBe('— – —')
  })
})

describe('formatDelta', () => {
  it('shows + sign for positive values by default', () => {
    expect(formatDelta(25)).toBe('+25%')
    expect(formatDelta(5)).toBe('+5%')
  })

  it('shows - sign for negative values', () => {
    expect(formatDelta(-15)).toBe('-15%')
    expect(formatDelta(-3)).toBe('-3%')
  })

  it('can hide positive sign', () => {
    expect(formatDelta(25, false)).toBe('25%')
    expect(formatDelta(-15, false)).toBe('-15%')
  })

  it('rounds to whole numbers', () => {
    expect(formatDelta(25.7)).toBe('+26%')
    expect(formatDelta(-15.3)).toBe('-15%')
  })
})

describe('formatPercent', () => {
  it('formats percentage values', () => {
    expect(formatPercent(50)).toBe('50%')
    expect(formatPercent(100)).toBe('100%')
  })

  it('auto-converts 0-1 probability values', () => {
    expect(formatPercent(0.5)).toBe('50%')
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercent(1)).toBe('100%')
  })

  it('supports custom decimal places', () => {
    expect(formatPercent(0.333, 1)).toBe('33.3%')
    expect(formatPercent(0.666, 2)).toBe('66.60%')
  })

  it('never uses "pts" or "points" terminology', () => {
    const result = formatPercent(0.5)
    expect(result).not.toContain('pts')
    expect(result).not.toContain('points')
    expect(result).toContain('%')
  })
})

describe('unit format consistency', () => {
  it('all percent formatters use % symbol, never pts or points', () => {
    const testValues = [0.25, 0.5, 0.75, 25, 50, 75]

    testValues.forEach((v) => {
      const result = formatOutcomeValue(v, 'percent')
      expect(result).toContain('%')
      expect(result).not.toContain('pts')
      expect(result).not.toContain('points')
    })
  })

  it('currency symbol always precedes value', () => {
    expect(formatOutcomeValue(100, 'currency')).toMatch(/^\$/)
    expect(formatOutcomeValue(1000, 'currency', '£')).toMatch(/^£/)
    expect(formatOutcomeValue(1000000, 'currency', '€')).toMatch(/^€/)
  })

  it('range delimiter is always en-dash with spaces', () => {
    const ranges = [
      formatRange(10, 90, 'percent'),
      formatRange(1000, 5000, 'currency'),
      formatRange(100, 500, 'count'),
    ]

    ranges.forEach((r) => {
      expect(r).toMatch(/ – /)
      expect(r).not.toMatch(/ to /)
      expect(r).not.toMatch(/ - (?![\d$])/) // Not hyphen (but allow negative numbers)
    })
  })
})
