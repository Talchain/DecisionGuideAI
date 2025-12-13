/**
 * Confidence Range Labels Utility Tests
 *
 * Task 3.9: Tests for consistent confidence range labeling
 */
import { describe, it, expect } from 'vitest'
import {
  PERCENTILE_LABELS,
  CONFIDENCE_RANGES,
  getPercentileLabel,
  getConfidenceRangeLabel,
  getConfidenceRangeExplanation,
  formatConfidenceRangeDisplay,
  getConfidenceRangeTooltip,
} from '../confidenceRangeLabels'

describe('PERCENTILE_LABELS', () => {
  it('has all required percentile entries', () => {
    expect(PERCENTILE_LABELS.p10).toBeDefined()
    expect(PERCENTILE_LABELS.p15).toBeDefined()
    expect(PERCENTILE_LABELS.p50).toBeDefined()
    expect(PERCENTILE_LABELS.p85).toBeDefined()
    expect(PERCENTILE_LABELS.p90).toBeDefined()
  })

  it('has consistent structure for all entries', () => {
    Object.values(PERCENTILE_LABELS).forEach((label) => {
      expect(label.short).toBeDefined()
      expect(label.long).toBeDefined()
      expect(label.percentile).toBeDefined()
      expect(label.explanation).toBeDefined()
    })
  })

  it('has user-friendly short labels', () => {
    expect(PERCENTILE_LABELS.p10.short).toBe('Worst case')
    expect(PERCENTILE_LABELS.p50.short).toBe('Most likely')
    expect(PERCENTILE_LABELS.p90.short).toBe('Best case')
  })

  it('has descriptive long labels', () => {
    expect(PERCENTILE_LABELS.p10.long).toBe('Worst case scenario')
    expect(PERCENTILE_LABELS.p50.long).toBe('Most likely outcome')
    expect(PERCENTILE_LABELS.p90.long).toBe('Best case scenario')
  })
})

describe('CONFIDENCE_RANGES', () => {
  it('has full and core range definitions', () => {
    expect(CONFIDENCE_RANGES.full).toBeDefined()
    expect(CONFIDENCE_RANGES.core).toBeDefined()
  })

  it('has consistent structure', () => {
    Object.values(CONFIDENCE_RANGES).forEach((range) => {
      expect(range.label).toBeDefined()
      expect(range.shortLabel).toBeDefined()
      expect(range.description).toBeDefined()
      expect(range.percentiles).toBeDefined()
    })
  })

  it('has correct core range label', () => {
    expect(CONFIDENCE_RANGES.core.label).toBe('70% Confidence Range')
    expect(CONFIDENCE_RANGES.core.shortLabel).toBe('70% likely')
  })

  it('has correct full range label', () => {
    expect(CONFIDENCE_RANGES.full.label).toBe('Full Range')
    expect(CONFIDENCE_RANGES.full.shortLabel).toBe('Range')
  })
})

describe('getPercentileLabel', () => {
  it('returns short label by default', () => {
    expect(getPercentileLabel('p10')).toBe('Worst case')
    expect(getPercentileLabel('p50')).toBe('Most likely')
    expect(getPercentileLabel('p90')).toBe('Best case')
  })

  it('returns long label when specified', () => {
    expect(getPercentileLabel('p10', 'long')).toBe('Worst case scenario')
    expect(getPercentileLabel('p50', 'long')).toBe('Most likely outcome')
  })

  it('returns percentile label when specified', () => {
    expect(getPercentileLabel('p10', 'percentile')).toBe('10th percentile')
    expect(getPercentileLabel('p50', 'percentile')).toBe('50th percentile (median)')
    expect(getPercentileLabel('p90', 'percentile')).toBe('90th percentile')
  })
})

describe('getConfidenceRangeLabel', () => {
  it('returns full label by default', () => {
    expect(getConfidenceRangeLabel('full')).toBe('Full Range')
    expect(getConfidenceRangeLabel('core')).toBe('70% Confidence Range')
  })

  it('returns short label when specified', () => {
    expect(getConfidenceRangeLabel('full', 'shortLabel')).toBe('Range')
    expect(getConfidenceRangeLabel('core', 'shortLabel')).toBe('70% likely')
  })
})

describe('getConfidenceRangeExplanation', () => {
  it('returns explanation for full range', () => {
    const explanation = getConfidenceRangeExplanation('full')
    expect(explanation).toContain('80%')
  })

  it('returns explanation for core range', () => {
    const explanation = getConfidenceRangeExplanation('core')
    expect(explanation).toContain('Most outcomes')
  })
})

describe('formatConfidenceRangeDisplay', () => {
  it('formats percent values', () => {
    const result = formatConfidenceRangeDisplay(15, 85, 'percent')
    expect(result).toBe('15% – 85%')
  })

  it('handles 0-1 scale values', () => {
    const result = formatConfidenceRangeDisplay(0.15, 0.85, 'percent')
    expect(result).toBe('15% – 85%')
  })

  it('formats currency values', () => {
    const result = formatConfidenceRangeDisplay(1000, 5000, 'currency')
    expect(result).toContain('$')
  })

  it('formats count values', () => {
    const result = formatConfidenceRangeDisplay(100, 500, 'count')
    expect(result).toBe('100 – 500')
  })

  it('includes label when requested', () => {
    const result = formatConfidenceRangeDisplay(15, 85, 'percent', { includeLabel: true })
    expect(result).toBe('70% likely: 15% – 85%')
  })
})

describe('getConfidenceRangeTooltip', () => {
  it('returns tooltip for core range', () => {
    const tooltip = getConfidenceRangeTooltip('core')
    expect(tooltip).toContain('70%')
    expect(tooltip).toContain('15%')
  })

  it('returns tooltip for full range', () => {
    const tooltip = getConfidenceRangeTooltip('full')
    expect(tooltip).toContain('80%')
    expect(tooltip).toContain('worst case')
  })
})
