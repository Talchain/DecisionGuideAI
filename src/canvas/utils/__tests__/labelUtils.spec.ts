/**
 * Unit tests for labelUtils
 * T2: cleanFactorLabel
 * T6: sensitivityTierLabel, evidenceTierLabel
 * T8: formatInterventionValue
 */

import { describe, it, expect } from 'vitest'
import {
  cleanFactorLabel,
  compactFactorLabel,
  classifyUnit,
  sensitivityTierLabel,
  evidenceTierLabel,
  formatInterventionValue,
  formatRawValueWithUnit,
  qualitativeTierLabel,
  denormaliseInterventionValue,
  isCurrencyUnit,
  formatFactorValue,
  unwrapInterventionValue,
  formatWinProbability,
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
// compactFactorLabel — Graph v1.1 Task 6 (wireframe v4 OptionWinnerPre pills)
// ---------------------------------------------------------------------------
describe('compactFactorLabel', () => {
  it('returns the canonical short form for known wireframe phrases', () => {
    expect(compactFactorLabel('Technical leadership presence')).toBe('leadership')
    expect(compactFactorLabel('Technical leadership in place')).toBe('leadership')
    expect(compactFactorLabel('Developer headcount capacity')).toBe('dev headcount')
    expect(compactFactorLabel('Developer headcount level')).toBe('dev headcount')
    // Polish 4 Task 2: "added" variant from staging screenshots.
    expect(compactFactorLabel('Developer headcount added')).toBe('dev headcount')
    expect(compactFactorLabel('Monthly recurring revenue')).toBe('MRR')
    expect(compactFactorLabel('Advertising spend')).toBe('ad spend')
  })

  // Polish 4 Task 2: marketing-graph factor labels from staging screenshots.
  it('compacts marketing-graph factor labels from the lookup table', () => {
    expect(compactFactorLabel('Campaign execution quality')).toBe('campaign quality')
    expect(compactFactorLabel('Marketing expertise available')).toBe('marketing expertise')
    expect(compactFactorLabel('Founder time burden')).toBe('founder time')
    expect(compactFactorLabel('Founder/PM time on marketing')).toBe('founder time')
    expect(compactFactorLabel('Founder PM time on marketing')).toBe('founder time')
    expect(compactFactorLabel('Market receptivity to feature')).toBe('market receptivity')
    expect(compactFactorLabel('Customer price sensitivity')).toBe('price sensitivity')
    expect(compactFactorLabel('Technical complexity of roadmap')).toBe('tech complexity')
  })

  it('lookup is case-insensitive', () => {
    expect(compactFactorLabel('TECHNICAL LEADERSHIP PRESENCE')).toBe('leadership')
    expect(compactFactorLabel('technical leadership presence')).toBe('leadership')
  })

  it('strips known generic suffixes when no lookup matches', () => {
    // "Sales rate" -> strip "rate" -> "Sales" (within cap, no truncate)
    expect(compactFactorLabel('Sales rate')).toBe('Sales')
    expect(compactFactorLabel('Hiring capacity')).toBe('Hiring')
    expect(compactFactorLabel('Inventory state')).toBe('Inventory')
  })

  it('truncates long labels with an ellipsis when over the cap', () => {
    // "Customer satisfaction Level" -> strip Level -> "Customer satisfaction" (21 chars)
    // -> substring(0, 15) -> "Customer satisf" -> ends with "…"
    const result = compactFactorLabel('Customer satisfaction Level')
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(16)
    expect(result.startsWith('Customer')).toBe(true)
  })

  it('does not break a word mid-character when truncating', () => {
    // 25 chars, no suffix match, must truncate
    const result = compactFactorLabel('Customer acquisition cost')
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(16)
  })

  it('returns the original label when shorter than the cap and no lookup matches', () => {
    expect(compactFactorLabel('Budget')).toBe('Budget')
  })

  it('handles empty / falsy input', () => {
    expect(compactFactorLabel('')).toBe('')
    expect(compactFactorLabel('   ')).toBe('')
  })

  it('respects a custom maxLength', () => {
    expect(compactFactorLabel('Customer satisfaction', 8)).toMatch(/…$/)
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
  // 0.2-step scale: Very low / Low / Medium / High / Very high
  it('returns "Very low" for 0', () => {
    expect(qualitativeTierLabel(0)).toBe('Very low')
  })

  it('returns "Very low" for values 0.01–0.20', () => {
    expect(qualitativeTierLabel(0.01)).toBe('Very low')
    expect(qualitativeTierLabel(0.1)).toBe('Very low')
    expect(qualitativeTierLabel(0.2)).toBe('Very low')
  })

  it('returns "Low" for values 0.21–0.40', () => {
    expect(qualitativeTierLabel(0.21)).toBe('Low')
    expect(qualitativeTierLabel(0.3)).toBe('Low')
    expect(qualitativeTierLabel(0.4)).toBe('Low')
  })

  it('returns "Medium" for values 0.41–0.60', () => {
    expect(qualitativeTierLabel(0.41)).toBe('Medium')
    expect(qualitativeTierLabel(0.5)).toBe('Medium')
    expect(qualitativeTierLabel(0.6)).toBe('Medium')
  })

  it('returns "High" for values 0.61–0.80', () => {
    expect(qualitativeTierLabel(0.61)).toBe('High')
    expect(qualitativeTierLabel(0.75)).toBe('High')
    expect(qualitativeTierLabel(0.8)).toBe('High')
  })

  it('returns "Very high" for values 0.81–1.0', () => {
    expect(qualitativeTierLabel(0.81)).toBe('Very high')
    expect(qualitativeTierLabel(0.9)).toBe('Very high')
    expect(qualitativeTierLabel(1.0)).toBe('Very high')
  })

  it('boundary: 0.20 → "Very low", 0.21 → "Low"', () => {
    expect(qualitativeTierLabel(0.2)).toBe('Very low')
    expect(qualitativeTierLabel(0.21)).toBe('Low')
  })

  it('boundary: 0.40 → "Low", 0.41 → "Medium"', () => {
    expect(qualitativeTierLabel(0.4)).toBe('Low')
    expect(qualitativeTierLabel(0.41)).toBe('Medium')
  })

  it('boundary: 0.60 → "Medium", 0.61 → "High"', () => {
    expect(qualitativeTierLabel(0.6)).toBe('Medium')
    expect(qualitativeTierLabel(0.61)).toBe('High')
  })

  it('boundary: 0.80 → "High", 0.81 → "Very high"', () => {
    expect(qualitativeTierLabel(0.8)).toBe('High')
    expect(qualitativeTierLabel(0.81)).toBe('Very high')
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

  // T3 fix: raw-value proportional mapping
  describe('raw-value proportional mapping (T3)', () => {
    it('returns raw_value directly when value matches baseline (baseline case)', () => {
      // raw_value: 49, cap: 70, value (baseline): 0.69
      // Intervention value = 0.69 (same as baseline) → should return 49, not 0.69 * 70 = 48.3
      expect(denormaliseInterventionValue(0.69, 70, 0.69, 49)).toBe(49)
    })

    it('proportionally maps non-baseline value through raw scale', () => {
      // raw_value: 49, cap: 70, baseline: 0.69, target: 0.83
      // Should return 49 * (0.83 / 0.69) ≈ 58.94, not 0.83 * 70 = 58.1
      expect(denormaliseInterventionValue(0.83, 70, 0.69, 49)).toBeCloseTo(58.94, 1)
    })

    it('falls back to value * cap when baseline normalised value is 0 (zero-division guard)', () => {
      // Binary factor: baseline is off (value=0), cap=1 → baselineNorm check fails (> 0)
      // Falls through to value * scaleBase
      expect(denormaliseInterventionValue(0.5, 10, 0, 5)).toBe(5)
    })

    it('falls back to value * cap when raw_value is absent', () => {
      // No raw_value → old behaviour (value * cap)
      expect(denormaliseInterventionValue(0.5, 100, 0.5, null)).toBe(50)
      expect(denormaliseInterventionValue(0.5, 100, 0.5, undefined)).toBe(50)
    })

    it('percentage factor: raw-value path produces same result as cap path', () => {
      // raw_value: 50, cap: 100, value: 0.5
      // raw path: 50 (baseline match) ✓; cap path would give 0.5 * 100 = 50 ✓
      expect(denormaliseInterventionValue(0.5, 100, 0.5, 50)).toBe(50)
      // target 0.8: raw path: 50 * (0.8 / 0.5) = 80; cap path: 0.8 * 100 = 80
      expect(denormaliseInterventionValue(0.8, 100, 0.5, 50)).toBe(80)
    })

    it('handles string raw_value (from CEE)', () => {
      // CEE sometimes sends raw_value as string
      expect(denormaliseInterventionValue(0.69, 70, 0.69, '49')).toBe(49)
    })

    it('falls back to value * cap when raw_value is 0 (prevents collapsing all interventions to zero)', () => {
      // raw_value: 0, cap: 10, baselineNorm: 0.01 — raw path would give 0 * (anything) = 0
      // Must fall through to value * cap instead
      expect(denormaliseInterventionValue(0.5, 10, 0.01, 0)).toBe(5)
    })
  })
})

// ---------------------------------------------------------------------------
// unwrapInterventionValue
// ---------------------------------------------------------------------------
// Centralised unwrap helper for intervention map values, which may be either
// plain numbers (legacy / analysis_ready) or {value, source, ...} objects
// (UIInterventionValue / CEEInterventionV3 from normaliseOptionFromCEE).
// Inspector panels and the FactorNode hover memo previously inlined or omitted
// this logic, producing "[object Object]" / "£NaN" / silently-dropped rows.

describe('unwrapInterventionValue', () => {
  describe('null and undefined', () => {
    it('returns null for undefined', () => {
      expect(unwrapInterventionValue(undefined)).toBeNull()
    })
    it('returns null for null', () => {
      expect(unwrapInterventionValue(null)).toBeNull()
    })
  })

  describe('primitive number', () => {
    it('returns finite numbers unchanged', () => {
      expect(unwrapInterventionValue(0.1)).toBe(0.1)
      expect(unwrapInterventionValue(0)).toBe(0)
      expect(unwrapInterventionValue(-7)).toBe(-7)
      expect(unwrapInterventionValue(1_000_000)).toBe(1_000_000)
    })
    it('returns null for NaN', () => {
      expect(unwrapInterventionValue(NaN)).toBeNull()
    })
    it('returns null for Infinity and -Infinity', () => {
      expect(unwrapInterventionValue(Infinity)).toBeNull()
      expect(unwrapInterventionValue(-Infinity)).toBeNull()
    })
  })

  describe('CEEInterventionV3 / UIInterventionValue object', () => {
    it('extracts .value when raw is a {value} object', () => {
      expect(unwrapInterventionValue({ value: 0.1 })).toBe(0.1)
    })
    it('extracts .value from a full CEEInterventionV3 shape', () => {
      const intervention = {
        value: 25000,
        source: 'brief_extraction',
        target_match: { node_id: 'budget', match_type: 'exact_id', confidence: 'high' },
        value_confidence: 'high',
        reasoning: 'Extracted from "£25k marketing budget"',
      }
      expect(unwrapInterventionValue(intervention)).toBe(25000)
    })
    it('returns null when .value is missing', () => {
      expect(unwrapInterventionValue({ source: 'brief_extraction' })).toBeNull()
    })
    it('returns null when .value is non-finite', () => {
      expect(unwrapInterventionValue({ value: NaN })).toBeNull()
      expect(unwrapInterventionValue({ value: Infinity })).toBeNull()
    })
    it('returns null when .value is undefined', () => {
      expect(unwrapInterventionValue({ value: undefined })).toBeNull()
    })
    it('returns null when .value is null (not coerced to 0)', () => {
      // Strict typeof check on .value: null is not a finite number, so the
      // entry is treated as missing. A previous version coerced via
      // `Number(null) === 0`, which rendered "Intervention: £0" for unset
      // interventions and short-circuited the legacy fallback chain in
      // OptionsSection.extractInterventionNumeric (raw_target / target_value).
      expect(unwrapInterventionValue({ value: null })).toBeNull()
    })
    it('returns null when .value is a string (no Number coercion)', () => {
      // Both numeric-looking and non-numeric strings drop. Sites that need
      // to render string interventions verbatim must read the raw entry
      // separately (see FactorControllablePanel connections badge).
      expect(unwrapInterventionValue({ value: '0.5' })).toBeNull()
      expect(unwrapInterventionValue({ value: 'low' })).toBeNull()
      expect(unwrapInterventionValue({ value: '' })).toBeNull()
    })
    it('returns null when .value is a boolean', () => {
      expect(unwrapInterventionValue({ value: true })).toBeNull()
      expect(unwrapInterventionValue({ value: false })).toBeNull()
    })
  })

  describe('other types', () => {
    it('returns null for plain strings', () => {
      expect(unwrapInterventionValue('0.1')).toBeNull()
    })
    it('returns null for booleans', () => {
      expect(unwrapInterventionValue(true)).toBeNull()
      expect(unwrapInterventionValue(false)).toBeNull()
    })
    it('returns null for arrays', () => {
      // Arrays are objects but lack a `.value` property.
      expect(unwrapInterventionValue([0.1])).toBeNull()
    })
    it('returns null for empty objects', () => {
      expect(unwrapInterventionValue({})).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// formatInterventionValue (T8)
// ---------------------------------------------------------------------------
describe('formatInterventionValue', () => {
  describe('defensive guard: non-finite input returns empty string', () => {
    // Regression guard for the FactorNode hover bug where CEEInterventionV3
    // objects were cast as numbers and produced "[object Object] scale" / "£NaN" /
    // "Very high" via Math.round / string concat / falsy comparison coercion.
    it('returns "" for NaN', () => {
      expect(formatInterventionValue(NaN)).toBe('')
      expect(formatInterventionValue(NaN, '£')).toBe('')
      expect(formatInterventionValue(NaN, 'hours')).toBe('')
    })

    it('returns "" for Infinity', () => {
      expect(formatInterventionValue(Infinity)).toBe('')
      expect(formatInterventionValue(-Infinity, '%')).toBe('')
    })

    it('returns "" when an object is passed where a number is expected', () => {
      // Simulates the pre-fix bug: CEEInterventionV3 object reaching the
      // formatter through a mistyped cast. Double-cast through `unknown` is
      // intentional — we're specifically testing runtime behaviour when the
      // compile-time contract is violated, which TypeScript would otherwise
      // (correctly) reject.
      const intervention = { value: 0.7, source: 'brief_extraction' } as unknown as number
      expect(formatInterventionValue(intervention, '£')).toBe('')
      expect(formatInterventionValue(intervention, 'scale')).toBe('')
      expect(formatInterventionValue(intervention)).toBe('')
    })
  })

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

  describe('no unit, no factorType — qualitative tier labels (default, 0.2-step scale)', () => {
    it('returns "Very low" for 0', () => {
      expect(formatInterventionValue(0)).toBe('Very low')
    })

    it('returns "Very low" for 0.2', () => {
      expect(formatInterventionValue(0.2)).toBe('Very low')
    })

    it('returns "Low" for 0.3', () => {
      expect(formatInterventionValue(0.3)).toBe('Low')
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

    it('uses tier labels for factorType "binary"', () => {
      expect(formatInterventionValue(0, undefined, 'binary')).toBe('Very low')
      expect(formatInterventionValue(1, undefined, 'binary')).toBe('Very high')
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

  it('qualitativeTierLabel(0) returns "Very low" (not "None")', () => {
    expect(qualitativeTierLabel(0)).toBe('Very low')
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

// ---------------------------------------------------------------------------
// P1.6: isCurrencyUnit — multi-char currency symbol detection
// ---------------------------------------------------------------------------
describe('isCurrencyUnit', () => {
  it('detects single-char symbols (£, $, €)', () => {
    expect(isCurrencyUnit('£')).toBe(true)
    expect(isCurrencyUnit('$')).toBe(true)
    expect(isCurrencyUnit('€')).toBe(true)
  })

  it('detects multi-char symbols (CHF, kr, R$)', () => {
    expect(isCurrencyUnit('CHF')).toBe(true)
    expect(isCurrencyUnit('kr')).toBe(true)
    expect(isCurrencyUnit('R$')).toBe(true)
  })

  it('returns false for non-currency units', () => {
    expect(isCurrencyUnit('engineers')).toBe(false)
    expect(isCurrencyUnit('months')).toBe(false)
    expect(isCurrencyUnit('%')).toBe(false)
    expect(isCurrencyUnit('k')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isCurrencyUnit('')).toBe(false)
  })
})

describe('formatInterventionValue — multi-char currency (P1.6 + Polish 4 follow-up)', () => {
  // Polish 4 follow-up: multi-char ISO codes now prefix WITH a space
  // ("CHF 1,200") instead of the previous no-space form ("CHF1,200") which
  // was off-brand for ISO codes. Single-char symbols still prefix with no
  // space. Source of truth: CURRENCY_SYMBOLS vs ISO_CURRENCY_CODES.
  it('prefixes CHF with a space (ISO code)', () => {
    expect(formatInterventionValue(1200, 'CHF')).toBe('CHF 1,200')
  })

  it('prefixes kr with a space (ISO-ish label)', () => {
    expect(formatInterventionValue(500, 'kr')).toBe('kr 500')
  })

  it('prefixes R$ with a space (ISO-ish label)', () => {
    expect(formatInterventionValue(2000, 'R$')).toBe('R$ 2,000')
  })
})

// Polish 4 review: scale-unit + no raw_value → empty string so callers can
// suppress the arrow + value entirely on intervention pills and popovers.
describe('formatInterventionValue — meaningless scale unit suppression', () => {
  it('returns empty string for value=0.1 with unit="scale" and no raw anchor', () => {
    expect(formatInterventionValue(0.1, 'scale')).toBe('')
  })

  it('returns empty string for value=0.5 with unit="scale" and no raw anchor', () => {
    expect(formatInterventionValue(0.5, 'scale')).toBe('')
  })

  it('returns empty string regardless of factor_type when scale + no raw', () => {
    expect(formatInterventionValue(0.7, 'scale', 'quality')).toBe('')
    expect(formatInterventionValue(0.7, 'scale', 'demand')).toBe('')
  })

  it('preserves scale-unit formatting when an observed raw value anchors it', () => {
    // If we have something to denormalise against, the unit becomes meaningful.
    // Note: real-world scale values denormalised through observedRawValue
    // would render as a number, not the bare unit. Just assert non-empty.
    const out = formatInterventionValue(0.5, 'scale', undefined, undefined, undefined, 10)
    expect(out).not.toBe('')
  })

  it('case-insensitive: "Scale" / " SCALE " also suppressed', () => {
    expect(formatInterventionValue(0.5, 'Scale')).toBe('')
    expect(formatInterventionValue(0.5, ' SCALE ')).toBe('')
  })

  // Polish 4 follow-up Item C: extended generic-placeholder set covers
  // index, score, norm, unit, units. Note: 'normalised'/'normalized' are
  // *also* in the legacy INTERNAL_FACTOR_TYPE_DESCRIPTORS set, so they get
  // stripped earlier by sanitiseUnit and fall through to the qualitative
  // tier branch — same end result (no misleading numeric text bleeds
  // through), just via a different code path. The test below pins both
  // behaviours so neither path drifts.
  it('suppresses generic placeholder units that survive sanitiseUnit', () => {
    expect(formatInterventionValue(0.5, 'index')).toBe('')
    expect(formatInterventionValue(0.5, 'score')).toBe('')
    expect(formatInterventionValue(0.5, 'norm')).toBe('')
    expect(formatInterventionValue(0.5, 'unit')).toBe('')
    expect(formatInterventionValue(0.5, 'units')).toBe('')
  })

  it('legacy normalised/normalized units fall through to qualitative tier (sanitiseUnit strips them first)', () => {
    // Effectively suppressed: no "0.5 normalised" string ever appears, but
    // the tier label still surfaces because sanitiseUnit drops the unit
    // before isGenericPlaceholderUnit is reached.
    expect(formatInterventionValue(0.5, 'normalised')).toBe('Medium')
    expect(formatInterventionValue(0.5, 'normalized')).toBe('Medium')
  })
})

// Polish 4 follow-up Item B: preserveTierLabel keeps the qualitative tier
// for generic-placeholder units instead of returning '', so GraphTextView
// can render coarse classification while the canvas suppresses meaningless
// numbers.
describe('formatInterventionValue — preserveTierLabel option (Item B)', () => {
  it('returns the qualitative tier for value=0.1 with scale + preserveTierLabel', () => {
    expect(formatInterventionValue(0.1, 'scale', undefined, undefined, undefined, undefined, { preserveTierLabel: true })).toBe('Very low')
  })

  it('returns the qualitative tier for value=0.5 with scale + preserveTierLabel', () => {
    expect(formatInterventionValue(0.5, 'scale', undefined, undefined, undefined, undefined, { preserveTierLabel: true })).toBe('Medium')
  })

  it('returns the qualitative tier for value=0.85 with scale + preserveTierLabel', () => {
    expect(formatInterventionValue(0.85, 'scale', undefined, undefined, undefined, undefined, { preserveTierLabel: true })).toBe('Very high')
  })

  it('preserveTierLabel does NOT bypass the raw-anchor branch', () => {
    // When raw is present, normal denormalisation runs — preserveTierLabel
    // is only relevant for the "meaningless unit" suppression path.
    const out = formatInterventionValue(0.5, 'scale', undefined, undefined, undefined, 10, { preserveTierLabel: true })
    expect(out).not.toBe('Low')
    expect(out).not.toBe('')
  })

  it('preserveTierLabel default is still empty string (canvas behaviour unchanged)', () => {
    expect(formatInterventionValue(0.5, 'scale')).toBe('')
    expect(formatInterventionValue(0.5, 'scale', undefined, undefined, undefined, undefined, {})).toBe('')
    expect(formatInterventionValue(0.5, 'scale', undefined, undefined, undefined, undefined, { preserveTierLabel: false })).toBe('')
  })

  // Contract pinning for callers that pass preserveTierLabel=true (currently
  // GraphTextView observed-state rows). If this regresses, the text view
  // will hide rows entirely instead of showing a coarse tier label.
  it('preserveTierLabel contract: factor with unit=scale and no raw renders a tier, not empty', () => {
    const result = formatInterventionValue(
      0.5, 'scale', 'quality', undefined, undefined, undefined, { preserveTierLabel: true },
    )
    expect(result).not.toBe('')
    expect(['Very low', 'Low', 'Medium', 'High', 'Very high']).toContain(result)
  })

  it('preserveTierLabel contract: covers all tier ranges for scale-no-raw', () => {
    const opts = { preserveTierLabel: true }
    expect(formatInterventionValue(0.0, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Very low')
    expect(formatInterventionValue(0.2, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Very low')
    expect(formatInterventionValue(0.21, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Low')
    expect(formatInterventionValue(0.4, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Low')
    expect(formatInterventionValue(0.41, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Medium')
    expect(formatInterventionValue(0.6, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Medium')
    expect(formatInterventionValue(0.61, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('High')
    expect(formatInterventionValue(0.8, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('High')
    expect(formatInterventionValue(0.81, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Very high')
    expect(formatInterventionValue(1.0, 'scale', undefined, undefined, undefined, undefined, opts)).toBe('Very high')
  })
})

// ---------------------------------------------------------------------------
// P1.6: formatFactorValue — currency unit handling
// ---------------------------------------------------------------------------
describe('formatFactorValue — multi-char currency (P1.6 + Polish 4 follow-up)', () => {
  // Polish 4 follow-up: ISO codes render with a space ("CHF 1,200").
  it('formats CHF raw_value as space-separated prefix', () => {
    expect(formatFactorValue({ raw_value: '1200', unit: 'CHF' })).toBe('CHF 1,200')
  })

  it('formats kr raw_value as space-separated prefix', () => {
    expect(formatFactorValue({ raw_value: '500', unit: 'kr' })).toBe('kr 500')
  })

  it('formats £ raw_value as no-space prefix (single-char symbol)', () => {
    expect(formatFactorValue({ raw_value: '49', unit: '£' })).toBe('£49')
  })

  it('formats non-currency unit as suffix', () => {
    expect(formatFactorValue({ raw_value: '10', unit: 'engineers' })).toBe('10 engineers')
  })
})

// ---------------------------------------------------------------------------
// P0.1 parity: formatFactorValue (Task 3 — formatFactorValue core paths)
// ---------------------------------------------------------------------------
describe('formatFactorValue', () => {
  it('returns null for null input', () => {
    expect(formatFactorValue(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatFactorValue(undefined)).toBeNull()
  })

  it('returns null when value is undefined', () => {
    expect(formatFactorValue({ unit: 'k' })).toBeNull()
  })

  it('returns qualitative tier when value present and no unit/cap', () => {
    expect(formatFactorValue({ value: 0.5 })).toBe('Medium')
    expect(formatFactorValue({ value: 0 })).toBe('Very low')
  })

  it('denormalises via cap when raw_value absent', () => {
    // 0.3 × 18 = 5.4 → 5
    expect(formatFactorValue({ value: 0.3, cap: 18, unit: 'months' })).toBe('5 months')
  })

  it('prefers raw_value over cap denormalisation', () => {
    expect(formatFactorValue({ raw_value: '12', unit: 'months', value: 0.3, cap: 18 })).toBe('12 months')
  })

  it('formats % unit from value (no cap)', () => {
    expect(formatFactorValue({ value: 0.85, unit: '%' })).toBe('85%')
  })
})

// ---------------------------------------------------------------------------
// Task 4: factor_type descriptor must never leak as a display unit
// ---------------------------------------------------------------------------
describe('factor_type descriptor suppression (Task 4)', () => {
  it('formatInterventionValue — suppresses "binary" as unit, falls back to qualitative tier', () => {
    // CEE erroneously sets unit="binary" — should be treated as no unit
    expect(formatInterventionValue(0, 'binary')).toBe('Very low')
    expect(formatInterventionValue(1, 'binary')).toBe('Very high')
    expect(formatInterventionValue(0.3, 'binary')).toBe('Low')
  })

  it('formatInterventionValue — suppresses "normalized" as unit', () => {
    expect(formatInterventionValue(0.3, 'normalized')).toBe('Low')
  })

  it('formatInterventionValue — suppresses "normalised" (British spelling) as unit', () => {
    expect(formatInterventionValue(0.3, 'normalised')).toBe('Low')
  })

  it('formatInterventionValue — suppresses "continuous" as unit (no factorType → qualitative fallback)', () => {
    // "continuous" unit is suppressed; without factorType context, falls back to qualitative tier
    expect(formatInterventionValue(0.75, 'continuous')).toBe('High')
    // With explicit non-qualitative factorType, numeric display is used
    expect(formatInterventionValue(0.75, 'continuous', 'continuous')).toBe('0.75')
  })

  it('formatInterventionValue — suppresses "cost" as unit (no factorType → qualitative fallback)', () => {
    // "cost" unit is suppressed; without factorType context, falls back to qualitative tier
    expect(formatInterventionValue(0.5, 'cost')).toBe('Medium')
    // With explicit "cost" factorType, numeric display is used
    expect(formatInterventionValue(0.5, 'cost', 'cost')).toBe('0.5')
  })

  it('formatFactorValue — suppresses "binary" as unit, falls back to qualitative tier', () => {
    expect(formatFactorValue({ value: 0, unit: 'binary' })).toBe('Very low')
    expect(formatFactorValue({ value: 1, unit: 'binary' })).toBe('Very high')
  })

  it('formatFactorValue — suppresses "normalized" as unit', () => {
    expect(formatFactorValue({ value: 0.3, unit: 'normalized' })).toBe('Low')
  })

  it('formatFactorValue — still shows real units normally', () => {
    expect(formatFactorValue({ raw_value: '10', unit: 'engineers' })).toBe('10 engineers')
    expect(formatFactorValue({ raw_value: '500', unit: '£' })).toBe('£500')
  })
})

// ---------------------------------------------------------------------------
// Task 5: top-tier label is "Very high" not "Full"
// ---------------------------------------------------------------------------
describe('top-tier label is Very high (Task 5)', () => {
  it('qualitativeTierLabel(1.0) returns "Very high"', () => {
    expect(qualitativeTierLabel(1.0)).toBe('Very high')
  })

  it('formatInterventionValue(1, undefined) returns "Very high" (no unit, no factorType)', () => {
    expect(formatInterventionValue(1)).toBe('Very high')
  })

  it('formatInterventionValue(0.9, undefined, "quality") returns "Very high"', () => {
    expect(formatInterventionValue(0.9, undefined, 'quality')).toBe('Very high')
  })

  it('formatFactorValue({ value: 1.0 }) returns "Very high"', () => {
    expect(formatFactorValue({ value: 1.0 })).toBe('Very high')
  })
})

// ---------------------------------------------------------------------------
// formatRawValueWithUnit — Polish 4 follow-up Item C
// Replaces the local `formatInterventionValue` shadow inside OptionsSection.
// Takes an already-denormalised value (no cap denormalisation) and glues a
// unit onto it with currency / ISO / % / generic-strip rules.
// ---------------------------------------------------------------------------
describe('formatRawValueWithUnit', () => {
  it('returns "Not set" for non-finite values', () => {
    expect(formatRawValueWithUnit(NaN, '£')).toBe('Not set')
    expect(formatRawValueWithUnit(Infinity, '£')).toBe('Not set')
    expect(formatRawValueWithUnit(-Infinity, '£')).toBe('Not set')
  })

  it('returns bare smart number when no unit is provided', () => {
    expect(formatRawValueWithUnit(49000)).toBe('49,000')
    expect(formatRawValueWithUnit(1.5)).toBe('1.5')
    expect(formatRawValueWithUnit(0.5)).toBe('0.5')
    expect(formatRawValueWithUnit(0)).toBe('0')
  })

  it('returns bare smart number when unit is empty / whitespace', () => {
    expect(formatRawValueWithUnit(49000, '')).toBe('49,000')
    expect(formatRawValueWithUnit(49000, '   ')).toBe('49,000')
  })

  it('drops the unit suffix for generic placeholder units', () => {
    expect(formatRawValueWithUnit(49, 'scale')).toBe('49')
    expect(formatRawValueWithUnit(49, 'index')).toBe('49')
    expect(formatRawValueWithUnit(49, 'score')).toBe('49')
    expect(formatRawValueWithUnit(49, 'norm')).toBe('49')
    expect(formatRawValueWithUnit(49, 'units')).toBe('49')
    // Case-insensitive.
    expect(formatRawValueWithUnit(49, 'SCALE')).toBe('49')
    expect(formatRawValueWithUnit(49, ' Scale ')).toBe('49')
  })

  it('prefixes currency symbols with no space', () => {
    expect(formatRawValueWithUnit(49000, '£')).toBe('£49,000')
    expect(formatRawValueWithUnit(49000, '$')).toBe('$49,000')
    expect(formatRawValueWithUnit(49000, '€')).toBe('€49,000')
  })

  it('prefixes ISO currency codes with a space', () => {
    expect(formatRawValueWithUnit(49000, 'USD')).toBe('USD 49,000')
    expect(formatRawValueWithUnit(49000, 'GBP')).toBe('GBP 49,000')
    expect(formatRawValueWithUnit(49000, 'EUR')).toBe('EUR 49,000')
  })

  it('suffixes percent with no space', () => {
    expect(formatRawValueWithUnit(75, '%')).toBe('75%')
    expect(formatRawValueWithUnit(0.5, '%')).toBe('0.5%')
  })

  it('suffixes generic units with a space', () => {
    expect(formatRawValueWithUnit(9, 'months')).toBe('9 months')
    expect(formatRawValueWithUnit(3, 'engineers')).toBe('3 engineers')
    expect(formatRawValueWithUnit(0, 'FTE')).toBe('0 FTE')
  })

  it('handles decimals with smart precision', () => {
    expect(formatRawValueWithUnit(0.05, '%')).toBe('0.05%')
    expect(formatRawValueWithUnit(1.234, 'index')).toBe('1.23')
  })

  it('formats negative numbers correctly', () => {
    expect(formatRawValueWithUnit(-1500, '£')).toBe('£-1,500')
    expect(formatRawValueWithUnit(-5, 'engineers')).toBe('-5 engineers')
  })

  it('accepts null unit (parity with the original local helper)', () => {
    expect(formatRawValueWithUnit(49000, null)).toBe('49,000')
  })
})

// ---------------------------------------------------------------------------
// classifyUnit — single source of truth for unit type detection.
// Polish 4 review follow-up: normalises case + whitespace so 'chf', ' CHF '
// and 'USD' all resolve to their canonical ISO form.
// ---------------------------------------------------------------------------
describe('classifyUnit', () => {
  it('returns "none" for null / undefined / empty / whitespace', () => {
    expect(classifyUnit(null).kind).toBe('none')
    expect(classifyUnit(undefined).kind).toBe('none')
    expect(classifyUnit('').kind).toBe('none')
    expect(classifyUnit('   ').kind).toBe('none')
  })

  it('returns "symbol" for single-char currency glyphs', () => {
    expect(classifyUnit('£').kind).toBe('symbol')
    expect(classifyUnit('$').kind).toBe('symbol')
    expect(classifyUnit('€').kind).toBe('symbol')
    expect(classifyUnit('¥').kind).toBe('symbol')
  })

  it('trims whitespace on symbols', () => {
    expect(classifyUnit(' £ ').kind).toBe('symbol')
    expect(classifyUnit(' £ ').canonical).toBe('£')
  })

  it('returns "iso" for uppercase 3-letter codes', () => {
    expect(classifyUnit('CHF').kind).toBe('iso')
    expect(classifyUnit('USD').kind).toBe('iso')
    expect(classifyUnit('EUR').kind).toBe('iso')
  })

  it('normalises lowercase ISO codes to uppercase canonical', () => {
    const chf = classifyUnit('chf')
    expect(chf.kind).toBe('iso')
    expect(chf.canonical).toBe('CHF')
    const usd = classifyUnit('usd')
    expect(usd.kind).toBe('iso')
    expect(usd.canonical).toBe('USD')
  })

  it('normalises mixed-case ISO codes', () => {
    expect(classifyUnit('Chf').canonical).toBe('CHF')
    expect(classifyUnit('uSd').canonical).toBe('USD')
  })

  it('trims whitespace on ISO codes', () => {
    expect(classifyUnit(' CHF ').kind).toBe('iso')
    expect(classifyUnit(' CHF ').canonical).toBe('CHF')
    expect(classifyUnit(' chf ').canonical).toBe('CHF')
  })

  it('preserves non-uppercase ISO-ish labels ("kr", "R$") as canonical', () => {
    expect(classifyUnit('kr').kind).toBe('iso')
    expect(classifyUnit('kr').canonical).toBe('kr')
    expect(classifyUnit('R$').kind).toBe('iso')
    expect(classifyUnit('R$').canonical).toBe('R$')
    // Uppercased "KR" does NOT normalise to "kr" — only the exact label matches.
    expect(classifyUnit('KR').kind).toBe('other')
  })

  it('lowercased "r$" normalises to canonical "R$" via .toUpperCase()', () => {
    // '$' is not alphabetic, so 'r$'.toUpperCase() === 'R$' which IS in the set.
    expect(classifyUnit('r$').kind).toBe('iso')
    expect(classifyUnit('r$').canonical).toBe('R$')
  })

  it('returns "percent" for %', () => {
    expect(classifyUnit('%').kind).toBe('percent')
    expect(classifyUnit(' % ').kind).toBe('percent')
  })

  it('returns "placeholder" for generic units', () => {
    expect(classifyUnit('scale').kind).toBe('placeholder')
    expect(classifyUnit('index').kind).toBe('placeholder')
    expect(classifyUnit('score').kind).toBe('placeholder')
    expect(classifyUnit('SCALE').kind).toBe('placeholder')
    expect(classifyUnit(' Scale ').kind).toBe('placeholder')
  })

  it('returns "other" for real unnormalised units', () => {
    expect(classifyUnit('engineers').kind).toBe('other')
    expect(classifyUnit('months').kind).toBe('other')
    expect(classifyUnit('FTE').kind).toBe('other')
  })
})

// ---------------------------------------------------------------------------
// Case + whitespace drift — Polish 4 review follow-up. These tests pin the
// classifyUnit normalisation across every formatter so we can't regress into
// "chf" / " CHF " rendering inconsistently.
// ---------------------------------------------------------------------------
describe('ISO currency normalisation across formatters', () => {
  describe('formatInterventionValue', () => {
    it('formats lowercase "chf" as space-prefix "CHF 1,200"', () => {
      expect(formatInterventionValue(1200, 'chf')).toBe('CHF 1,200')
    })
    it('formats whitespace-padded " CHF " as space-prefix "CHF 1,200"', () => {
      expect(formatInterventionValue(1200, ' CHF ')).toBe('CHF 1,200')
    })
    it('formats mixed-case "uSd" as "USD 500"', () => {
      expect(formatInterventionValue(500, 'uSd')).toBe('USD 500')
    })
    it('preserves non-uppercase "kr" label as canonical "kr"', () => {
      expect(formatInterventionValue(500, 'kr')).toBe('kr 500')
    })
  })

  describe('formatFactorValue', () => {
    it('formats lowercase raw_value currency as space-prefix ISO', () => {
      expect(formatFactorValue({ raw_value: '1200', unit: 'chf' })).toBe('CHF 1,200')
    })
    it('formats whitespace-padded raw_value currency', () => {
      expect(formatFactorValue({ raw_value: '500', unit: ' USD ' })).toBe('USD 500')
    })
  })

  describe('formatRawValueWithUnit', () => {
    it('formats lowercase ISO codes with space prefix', () => {
      expect(formatRawValueWithUnit(49000, 'chf')).toBe('CHF 49,000')
      expect(formatRawValueWithUnit(49000, 'usd')).toBe('USD 49,000')
    })
    it('formats whitespace-padded ISO codes', () => {
      expect(formatRawValueWithUnit(49000, ' CHF ')).toBe('CHF 49,000')
    })
    it('still preserves symbol prefix for lowercase symbol (no-op for £)', () => {
      // Single-char symbols don't have a lowercase — just verify whitespace trims.
      expect(formatRawValueWithUnit(49000, ' £ ')).toBe('£49,000')
    })
  })

  describe('isCurrencyUnit', () => {
    it('returns true for lowercase / padded ISO codes', () => {
      expect(isCurrencyUnit('chf')).toBe(true)
      expect(isCurrencyUnit(' USD ')).toBe(true)
      expect(isCurrencyUnit('eur')).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// formatWinProbability — "< 1%" for non-zero rounded-to-zero values
// ---------------------------------------------------------------------------
describe('formatWinProbability', () => {
  it('returns "0%" only for exact zero', () => {
    expect(formatWinProbability(0)).toBe('0%')
  })

  it('returns "< 1%" for any non-zero value below 1%', () => {
    expect(formatWinProbability(0.0001)).toBe('< 1%')
    expect(formatWinProbability(0.004)).toBe('< 1%')
    expect(formatWinProbability(0.005)).toBe('< 1%')
    expect(formatWinProbability(0.009)).toBe('< 1%')
  })

  it('returns integer percent for values between 1% and 99%', () => {
    expect(formatWinProbability(0.01)).toBe('1%')
    expect(formatWinProbability(0.5)).toBe('50%')
    expect(formatWinProbability(0.99)).toBe('99%')
  })

  it('returns "100%" for values at or above 99.5%', () => {
    expect(formatWinProbability(0.995)).toBe('100%')
    expect(formatWinProbability(1.0)).toBe('100%')
  })

  it('returns "—" for non-finite inputs', () => {
    expect(formatWinProbability(NaN)).toBe('—')
    expect(formatWinProbability(Infinity)).toBe('—')
    expect(formatWinProbability(-Infinity)).toBe('—')
  })

  it('treats negative values as "0%"', () => {
    expect(formatWinProbability(-0.1)).toBe('0%')
  })
})
