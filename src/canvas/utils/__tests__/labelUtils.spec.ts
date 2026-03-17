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
  qualitativeTierLabel,
  denormaliseInterventionValue,
} from '../labelUtils'
import { describeEdgeInfluence } from '../../domain/edges'

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
// qualitativeTierLabel (G2)
// ---------------------------------------------------------------------------
describe('qualitativeTierLabel', () => {
  it('returns "None" for 0', () => {
    expect(qualitativeTierLabel(0)).toBe('None')
  })

  it('returns "Low" for values 0.01–0.30', () => {
    expect(qualitativeTierLabel(0.01)).toBe('Low')
    expect(qualitativeTierLabel(0.2)).toBe('Low')
    expect(qualitativeTierLabel(0.3)).toBe('Low')
  })

  it('returns "Medium" for values 0.31–0.60', () => {
    expect(qualitativeTierLabel(0.31)).toBe('Medium')
    expect(qualitativeTierLabel(0.5)).toBe('Medium')
    expect(qualitativeTierLabel(0.6)).toBe('Medium')
  })

  it('returns "High" for values 0.61–0.89', () => {
    expect(qualitativeTierLabel(0.61)).toBe('High')
    expect(qualitativeTierLabel(0.75)).toBe('High')
    expect(qualitativeTierLabel(0.89)).toBe('High')
  })

  it('returns "Very high" for values 0.90–1.0', () => {
    expect(qualitativeTierLabel(0.9)).toBe('Very high')
    expect(qualitativeTierLabel(1.0)).toBe('Very high')
  })

  it('boundary: 0.3 → "Low", 0.31 → "Medium"', () => {
    expect(qualitativeTierLabel(0.3)).toBe('Low')
    expect(qualitativeTierLabel(0.31)).toBe('Medium')
  })

  it('boundary: 0.6 → "Medium", 0.61 → "High"', () => {
    expect(qualitativeTierLabel(0.6)).toBe('Medium')
    expect(qualitativeTierLabel(0.61)).toBe('High')
  })

  it('boundary: 0.89 → "High", 0.9 → "Very high"', () => {
    expect(qualitativeTierLabel(0.89)).toBe('High')
    expect(qualitativeTierLabel(0.9)).toBe('Very high')
  })
})

// ---------------------------------------------------------------------------
// denormaliseInterventionValue (J1)
// ---------------------------------------------------------------------------
describe('denormaliseInterventionValue', () => {
  it('multiplies by cap when cap > 1', () => {
    expect(denormaliseInterventionValue(0.3, 18)).toBeCloseTo(5.4)
    expect(denormaliseInterventionValue(0.7, 20)).toBeCloseTo(14)
  })

  it('returns value unchanged when cap is null', () => {
    expect(denormaliseInterventionValue(0.5, null)).toBe(0.5)
  })

  it('returns value unchanged when cap is undefined', () => {
    expect(denormaliseInterventionValue(0.5, undefined)).toBe(0.5)
  })

  it('returns value unchanged when cap = 1 (normalised ceiling, not a scale)', () => {
    expect(denormaliseInterventionValue(0.5, 1)).toBe(0.5)
  })

  it('handles cap = 0 gracefully (returns value unchanged)', () => {
    expect(denormaliseInterventionValue(0.5, 0)).toBe(0.5)
  })

  it('denormalises value=1.0 (normalised max) instead of treating as already-denormalised integer', () => {
    // Number.isInteger(1.0) === true in JS — guard must not catch this
    expect(denormaliseInterventionValue(1.0, 100)).toBe(100)
  })

  it('passes through integer value > 1 within scale (already denormalised)', () => {
    expect(denormaliseInterventionValue(49, 100)).toBe(49)
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

  describe('no unit, no factorType — qualitative tier labels (default)', () => {
    it('returns "None" for 0', () => {
      expect(formatInterventionValue(0)).toBe('None')
    })

    it('returns "Low" for 0.2', () => {
      expect(formatInterventionValue(0.2)).toBe('Low')
    })

    it('returns "Medium" for 0.5', () => {
      expect(formatInterventionValue(0.5)).toBe('Medium')
    })

    it('returns "High" for 0.75', () => {
      expect(formatInterventionValue(0.75)).toBe('High')
    })

    it('returns "Very high" for 1.0', () => {
      expect(formatInterventionValue(1)).toBe('Very high')
    })
  })

  describe('no unit + explicit qualitative factorType', () => {
    it('uses tier labels for factorType "quality"', () => {
      expect(formatInterventionValue(0.7, undefined, 'quality')).toBe('High')
    })

    it('uses tier labels for factorType "demand"', () => {
      expect(formatInterventionValue(0.3, undefined, 'demand')).toBe('Low')
    })

    it('uses tier labels for factorType "other"', () => {
      expect(formatInterventionValue(0.5, undefined, 'other')).toBe('Medium')
    })
  })

  describe('no unit + non-qualitative factorType — numeric display', () => {
    it('shows numeric for factorType "continuous"', () => {
      expect(formatInterventionValue(0.75, undefined, 'continuous')).toBe('0.75')
      expect(formatInterventionValue(2, undefined, 'continuous')).toBe('2')
    })

    it('shows numeric for factorType "cost"', () => {
      expect(formatInterventionValue(0.5, undefined, 'cost')).toBe('0.5')
    })

    it('shows numeric for factorType "time"', () => {
      expect(formatInterventionValue(12, undefined, 'time')).toBe('12')
    })
  })

  describe('unit always wins over factorType', () => {
    it('uses fraction format when unit=fraction even if factorType is quality', () => {
      expect(formatInterventionValue(0.6, 'fraction', 'quality')).toBe('60%')
    })

    it('uses generic unit format when unit is present', () => {
      expect(formatInterventionValue(12, 'months', 'quality')).toBe('12 months')
    })
  })

  // ---------------------------------------------------------------------------
  // J1: cap-based denormalisation
  // ---------------------------------------------------------------------------
  describe('cap denormalisation (J1)', () => {
    it('denormalises value × cap for cap > 1', () => {
      // 0.3 × 18 = 5.4 → rounded → 5 months
      expect(formatInterventionValue(0.3, 'months', undefined, 18)).toBe('5 months')
    })

    it('denormalises engineers: 0.7 × 20 = 14', () => {
      expect(formatInterventionValue(0.7, 'engineers', undefined, 20)).toBe('14 engineers')
    })

    it('denormalises currency: 0.49 × 100 = 49 → £49', () => {
      expect(formatInterventionValue(0.49, '£', undefined, 100)).toBe('£49')
    })

    it('denormalises $ currency: 0.5 × 200 = 100 → $100', () => {
      expect(formatInterventionValue(0.5, '$', undefined, 200)).toBe('$100')
    })

    it('does not denormalise when cap is absent', () => {
      // No cap — fraction behaviour unchanged
      expect(formatInterventionValue(0.6, 'fraction', undefined, undefined)).toBe('60%')
    })

    it('does not denormalise when cap = 1 (normalised ceiling)', () => {
      expect(formatInterventionValue(0.5, 'months', undefined, 1)).toBe('0.5 months')
    })

    it('rounds capped value to integer', () => {
      // 0.333 × 12 = 3.996 → 4
      expect(formatInterventionValue(0.333, 'months', undefined, 12)).toBe('4 months')
    })

    it('fraction/proportion unit ignores cap (already a ratio)', () => {
      // fraction is already 0–1, cap is irrelevant
      expect(formatInterventionValue(0.6, 'fraction', undefined, 18)).toBe('60%')
    })

    it('qualitative tier labels use original normalised value (cap ignored)', () => {
      // 0.7 is "High" tier regardless of cap
      expect(formatInterventionValue(0.7, undefined, 'quality', 10)).toBe('High')
    })

    it('prefers observed raw value scale when it materially differs from cap', () => {
      expect(formatInterventionValue(0.5, '£', undefined, 100, 0.5, 250)).toBe('£250')
    })

    // Brief scenario: raw_value: 49, cap: 59, value: 0.49, intervention: 0.59
    // The scale is inferred from raw/normalised (49/0.49 = 100), not cap (59).
    it('displays £49 for status quo and £59 for increase in brief pricing scenario', () => {
      // Status quo: intervention = 0.49, factor has raw_value 49, cap 59, value 0.49
      expect(formatInterventionValue(0.49, '£', undefined, 59, 0.49, 49)).toBe('£49')
      // Increase: intervention = 0.59
      expect(formatInterventionValue(0.59, '£', undefined, 59, 0.49, 49)).toBe('£59')
    })

    it('denormalises value=1.0 correctly (full scale, not raw 1)', () => {
      // value=1.0 is normalised max — should produce scaleBase, not 1
      expect(formatInterventionValue(1.0, '£', undefined, 100)).toBe('£100')
    })
  })

  describe('factorType case-insensitive normalization (P1-4)', () => {
    it('treats "Quality" (title case) as qualitative', () => {
      expect(formatInterventionValue(0.7, undefined, 'Quality')).toBe('High')
    })

    it('treats "QUALITY" (all caps) as qualitative', () => {
      expect(formatInterventionValue(0.3, undefined, 'QUALITY')).toBe('Low')
    })

    it('treats "Demand" (title case) as qualitative', () => {
      expect(formatInterventionValue(0.5, undefined, 'Demand')).toBe('Medium')
    })

    it('treats "CONTINUOUS" as non-qualitative (numeric)', () => {
      expect(formatInterventionValue(0.75, undefined, 'CONTINUOUS')).toBe('0.75')
    })

    it('treats whitespace-padded " quality " as qualitative', () => {
      expect(formatInterventionValue(0.7, undefined, ' quality ')).toBe('High')
    })
  })
})

// ---------------------------------------------------------------------------
// Wave 1: Observed value formatting patterns (Task 3)
// Ensures inspector/panel surfaces never show raw floats or technical tokens
// ---------------------------------------------------------------------------
describe('observed value formatting (no raw data)', () => {
  it('qualitativeTierLabel(0.5) returns "Medium" not "0.5"', () => {
    expect(qualitativeTierLabel(0.5)).toBe('Medium')
  })

  it('qualitativeTierLabel(0) returns "None"', () => {
    expect(qualitativeTierLabel(0)).toBe('None')
  })

  it('qualitativeTierLabel(1) returns "Very high"', () => {
    expect(qualitativeTierLabel(1)).toBe('Very high')
  })

  it('currency value formatted with symbol: £40,000', () => {
    expect(formatInterventionValue(40000, '£')).toBe('£40,000')
  })

  it('percentage formatted from decimal', () => {
    expect(formatInterventionValue(0.75, '%')).toBe('75%')
  })
})

// ---------------------------------------------------------------------------
// describeEdgeInfluence (Fix 2 — brief test requirement)
// ---------------------------------------------------------------------------
describe('describeEdgeInfluence', () => {
  it('returns "Strong positive influence on goal" for strength 0.5', () => {
    expect(describeEdgeInfluence(0.5)).toBe('Strong positive influence on goal')
  })

  it('returns "Moderate negative influence on goal" for strength -0.3', () => {
    expect(describeEdgeInfluence(-0.3)).toBe('Moderate negative influence on goal')
  })

  it('returns "Weak positive influence on goal" for strength 0.1', () => {
    expect(describeEdgeInfluence(0.1)).toBe('Weak positive influence on goal')
  })

  it('returns "Minimal influence on goal" for near-zero strength', () => {
    expect(describeEdgeInfluence(0.02)).toBe('Minimal influence on goal')
  })

  it('returns "Strong negative influence on goal" for strength -0.5', () => {
    expect(describeEdgeInfluence(-0.5)).toBe('Strong negative influence on goal')
  })
})
