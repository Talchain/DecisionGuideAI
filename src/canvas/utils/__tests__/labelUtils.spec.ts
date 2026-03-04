/**
 * Unit tests for labelUtils
 * T2: cleanFactorLabel
 * T6: sensitivityTierLabel, evidenceTierLabel
 * T8: formatInterventionValue
 */

import { describe, it, expect } from 'vitest'
import {
  cleanFactorLabel,
  sensitivityTierLabel,
  evidenceTierLabel,
  formatInterventionValue,
} from '../labelUtils'

// ---------------------------------------------------------------------------
// cleanFactorLabel (T2)
// ---------------------------------------------------------------------------
describe('cleanFactorLabel', () => {
  // Five CEE patterns from the brief
  it('strips "(0–1 scale)" with en-dash', () => {
    expect(cleanFactorLabel('Sales Team Hiring (0–1 scale)')).toBe('Sales Team Hiring')
  })

  it('strips "(0–1 qualitative scale)"', () => {
    expect(cleanFactorLabel('Culture fit (0–1 qualitative scale)')).toBe('Culture fit')
  })

  it('strips "(0–1, share of 6 months)"', () => {
    expect(cleanFactorLabel('Founder time (0–1, share of 6 months)')).toBe('Founder time')
  })

  it('strips "(0–1, share of 20 engineers)"', () => {
    expect(cleanFactorLabel('Team allocation (0–1, share of 20 engineers)')).toBe('Team allocation')
  })

  it('strips "(0/1)" binary notation', () => {
    expect(cleanFactorLabel('Hire decision (0/1)')).toBe('Hire decision')
  })

  // Additional coverage
  it('strips "(0-1 scale)" with hyphen', () => {
    expect(cleanFactorLabel('Founder Time on Sales (0-1 scale)')).toBe('Founder Time on Sales')
  })

  it('strips bare "(0–1)" range with en-dash', () => {
    expect(cleanFactorLabel('Effort (0–1)')).toBe('Effort')
  })

  it('strips bare "(0-1)" range with hyphen', () => {
    expect(cleanFactorLabel('Effort (0-1)')).toBe('Effort')
  })

  it('does not strip legitimate parenthetical content', () => {
    expect(cleanFactorLabel('Revenue (£k)')).toBe('Revenue (£k)')
    expect(cleanFactorLabel('Conversion rate (measured weekly)')).toBe('Conversion rate (measured weekly)')
    expect(cleanFactorLabel('NPS (Net Promoter Score)')).toBe('NPS (Net Promoter Score)')
  })

  it('handles empty string', () => {
    expect(cleanFactorLabel('')).toBe('')
  })

  it('handles label with no parentheticals', () => {
    expect(cleanFactorLabel('Sales velocity')).toBe('Sales velocity')
  })

  it('handles label that is entirely a parenthetical', () => {
    expect(cleanFactorLabel('(0–1 scale)')).toBe('')
  })

  it('strips trailing whitespace after removal', () => {
    expect(cleanFactorLabel('Metric   (0/1)')).toBe('Metric')
  })
})

// ---------------------------------------------------------------------------
// sensitivityTierLabel (T6)
// ---------------------------------------------------------------------------
describe('sensitivityTierLabel', () => {
  it('returns "High" for score >= 0.7', () => {
    expect(sensitivityTierLabel(0.7)).toBe('High')
    expect(sensitivityTierLabel(1.0)).toBe('High')
    expect(sensitivityTierLabel(0.85)).toBe('High')
  })

  it('returns "Med" for score 0.4–0.69', () => {
    expect(sensitivityTierLabel(0.4)).toBe('Med')
    expect(sensitivityTierLabel(0.55)).toBe('Med')
    expect(sensitivityTierLabel(0.699)).toBe('Med')
  })

  it('returns "Low" for score < 0.4', () => {
    expect(sensitivityTierLabel(0.0)).toBe('Low')
    expect(sensitivityTierLabel(0.2)).toBe('Low')
    expect(sensitivityTierLabel(0.399)).toBe('Low')
  })

  it('boundary at exactly 0.4 returns "Med"', () => {
    expect(sensitivityTierLabel(0.4)).toBe('Med')
  })

  it('boundary at exactly 0.7 returns "High"', () => {
    expect(sensitivityTierLabel(0.7)).toBe('High')
  })
})

// ---------------------------------------------------------------------------
// evidenceTierLabel (T6)
// ---------------------------------------------------------------------------
describe('evidenceTierLabel', () => {
  it('returns "Strong" for score >= 0.7', () => {
    expect(evidenceTierLabel(0.7)).toBe('Strong')
    expect(evidenceTierLabel(1.0)).toBe('Strong')
    expect(evidenceTierLabel(0.9)).toBe('Strong')
  })

  it('returns "Fair" for score 0.4–0.69', () => {
    expect(evidenceTierLabel(0.4)).toBe('Fair')
    expect(evidenceTierLabel(0.55)).toBe('Fair')
    expect(evidenceTierLabel(0.699)).toBe('Fair')
  })

  it('returns "Weak" for score < 0.4', () => {
    expect(evidenceTierLabel(0.0)).toBe('Weak')
    expect(evidenceTierLabel(0.2)).toBe('Weak')
    expect(evidenceTierLabel(0.399)).toBe('Weak')
  })

  it('boundary at exactly 0.4 returns "Fair"', () => {
    expect(evidenceTierLabel(0.4)).toBe('Fair')
  })

  it('boundary at exactly 0.7 returns "Strong"', () => {
    expect(evidenceTierLabel(0.7)).toBe('Strong')
  })
})

// ---------------------------------------------------------------------------
// formatInterventionValue (T8)
// ---------------------------------------------------------------------------
describe('formatInterventionValue', () => {
  describe('fraction / proportion unit', () => {
    it('converts fraction to percentage', () => {
      expect(formatInterventionValue(0.6, 'fraction')).toBe('60%')
      expect(formatInterventionValue(0.6, 'proportion')).toBe('60%')
    })

    it('handles 0 and 1 as 0% and 100%', () => {
      expect(formatInterventionValue(0, 'fraction')).toBe('0%')
      expect(formatInterventionValue(1, 'fraction')).toBe('100%')
    })
  })

  describe('% unit', () => {
    it('treats value in [0,1] as fractional', () => {
      expect(formatInterventionValue(0.5, '%')).toBe('50%')
    })

    it('treats value >1 as already a percentage', () => {
      expect(formatInterventionValue(75, '%')).toBe('75%')
    })
  })

  describe('currency unit', () => {
    it('prepends £ symbol', () => {
      expect(formatInterventionValue(1000, '£')).toBe('£1,000')
    })

    it('prepends $ symbol', () => {
      expect(formatInterventionValue(500, '$')).toBe('$500')
    })
  })

  describe('generic unit', () => {
    it('appends unit after value', () => {
      expect(formatInterventionValue(12, 'hours')).toBe('12 hours')
    })
  })

  describe('no unit (binary / continuous)', () => {
    it('returns "None" for 0', () => {
      expect(formatInterventionValue(0)).toBe('None')
    })

    it('returns "Full" for 1', () => {
      expect(formatInterventionValue(1)).toBe('Full')
    })

    it('formats continuous value without unit', () => {
      expect(formatInterventionValue(0.75)).toBe('0.75')
      expect(formatInterventionValue(2)).toBe('2')
    })

    it('formats 0.5 as continuous (not binary)', () => {
      // 0.5 is not 0 or 1, so formatted as a continuous number
      expect(formatInterventionValue(0.5)).toBe('0.5')
    })
  })

  describe('missing unit', () => {
    it('handles undefined unit', () => {
      expect(formatInterventionValue(0.3, undefined)).toBe('0.3')
    })
  })
})
