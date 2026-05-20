import { describe, it, expect } from 'vitest'
import { formatFactorDisplayValue } from '../formatFactorDisplayValue'

describe('formatFactorDisplayValue', () => {
  it('formats raw_value with currency unit: £40,000', () => {
    expect(formatFactorDisplayValue({
      label: 'Development Capacity',
      value: 0.2,
      raw_value: 40000,
      unit: '£',
      cap: 200000,
    })).toBe('£40,000')
  })

  it('returns "No cost allocated" for zero cost factor', () => {
    expect(formatFactorDisplayValue({
      label: 'Recruitment and Salary Cost',
      value: 0,
      raw_value: 0,
      unit: '£',
      factor_type: 'cost',
      cap: 200000,
    })).toBe('No cost allocated')
  })

  // Post-review: contextual binary text now requires explicit factor_type='binary'.
  // factor_type 'other' / undefined no longer triggers the binary heuristic so
  // we don't render misleading "No X in place" for continuous quality factors.
  it('returns contextual text for explicitly-binary 0 without raw_value', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 0,
      raw_value: null,
      unit: null,
      factor_type: 'binary',
    })).toBe('No technical leadership in place')
  })

  it('returns contextual text for binary 0 with "Added" suffix', () => {
    expect(formatFactorDisplayValue({
      label: 'Developer Headcount Added',
      value: 0,
      raw_value: null,
      unit: null,
      factor_type: 'binary',
    })).toBe('No developer headcount in place')
  })

  it('returns contextual text for explicitly-binary 1 without raw_value', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 1,
      raw_value: null,
      unit: null,
      factor_type: 'binary',
    })).toBe('Technical leadership active')
  })

  it('returns null for external factor with no observed_state', () => {
    expect(formatFactorDisplayValue({
      label: 'Talent Market Tightness',
      category: 'external',
      value: null,
      raw_value: null,
    })).toBeNull()
  })

  it('returns null for factor with null value (needs-input state)', () => {
    expect(formatFactorDisplayValue({
      label: 'Customer Sensitivity',
      value: null,
    })).toBeNull()
  })

  it('returns CEE display_value verbatim when present (overrides all heuristics)', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 0,
      raw_value: null,
      display_value: 'No dedicated tech lead',
    })).toBe('No dedicated tech lead')
  })

  it('ignores display_value when empty string and factor_type is binary', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 0,
      raw_value: null,
      display_value: '',
      factor_type: 'binary',
    })).toBe('No technical leadership in place')
  })

  // Polish 4 Task 1: suppress meaningless fractional placeholder values.
  describe('meaningless-unit suppression (Polish 4 Task 1)', () => {
    it('returns null for value=0.1 with unit="scale" and no raw_value', () => {
      expect(formatFactorDisplayValue({
        label: 'Marketing Expertise Available',
        value: 0.1,
        raw_value: null,
        unit: 'scale',
      })).toBeNull()
    })

    it('returns null for value=0.5 with no unit and no raw_value', () => {
      expect(formatFactorDisplayValue({
        label: 'Generic Quality',
        value: 0.5,
        raw_value: null,
      })).toBeNull()
    })

    it('returns contextual text for value=0 with no unit and no factor_type (CEE omission)', () => {
      // Graph v2 fix: CEE omits factor_type for binary factors (CEE-4 upstream).
      // When factor_type is unset and value=0, assume binary-like zero.
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 0,
        raw_value: null,
      })).toBe('No tech lead in place')
    })

    it('suppresses value=0 with explicit non-binary factor_type', () => {
      // When factor_type IS set to something non-binary, suppress — the
      // explicit type indicates this isn't a binary factor at zero.
      expect(formatFactorDisplayValue({
        label: 'Quality Score',
        value: 0,
        raw_value: null,
        factor_type: 'continuous',
      })).toBeNull()
    })

    it('preserves explicitly-binary value=0 contextual text', () => {
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 0,
        raw_value: null,
        factor_type: 'binary',
      })).toBe('No tech lead in place')
    })

    it('preserves explicitly-binary value=1 contextual text even with unit="scale"', () => {
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 1,
        raw_value: null,
        unit: 'scale',
        factor_type: 'binary',
      })).toBe('Tech lead active')
    })

    it('returns contextual text for value=0 with unit="scale" and no factor_type', () => {
      // Graph v2 fix: same CEE-4 workaround — unit="scale" + no factor_type + value=0
      expect(formatFactorDisplayValue({
        label: 'Tech Lead Hired',
        value: 0,
        raw_value: null,
        unit: 'scale',
      })).toBe('No tech lead hired in place')
    })

    it('suppresses value=0 with unit="scale" when factor_type is explicitly non-binary', () => {
      expect(formatFactorDisplayValue({
        label: 'Some metric',
        value: 0,
        raw_value: null,
        unit: 'scale',
        factor_type: 'continuous',
      })).toBeNull()
    })

    // Placeholder unit consistency: index, score, norm get same treatment as scale
    it('suppresses value=0.5 with unit="index" and no raw_value', () => {
      expect(formatFactorDisplayValue({
        label: 'Quality Index',
        value: 0.5,
        raw_value: null,
        unit: 'index',
      })).toBeNull()
    })

    it('returns contextual text for value=0 with unit="index" and no factor_type', () => {
      expect(formatFactorDisplayValue({
        label: 'Quality Index',
        value: 0,
        raw_value: null,
        unit: 'index',
      })).toBe('No quality index in place')
    })

    it('suppresses value=0 with unit="score" when factor_type is explicitly non-binary', () => {
      expect(formatFactorDisplayValue({
        label: 'Readiness Score',
        value: 0,
        raw_value: null,
        unit: 'score',
        factor_type: 'continuous',
      })).toBeNull()
    })

    it('suppresses value=0 with unit="norm" when factor_type is explicitly non-binary', () => {
      expect(formatFactorDisplayValue({
        label: 'Performance Metric',
        value: 0,
        raw_value: null,
        unit: 'norm',
        factor_type: 'continuous',
      })).toBeNull()
    })

    it('does not suppress when raw_value is present (real-world data)', () => {
      expect(formatFactorDisplayValue({
        label: 'Headcount',
        value: 0.5,
        raw_value: 5,
        unit: 'engineers',
      })).toBe('5 engineers')
    })

    // Graph v2 fix: raw_value + unit="scale" (synthesized from cap) must suppress
    it('suppresses raw_value with unit="scale" in [0,1] range (synthesized from cap)', () => {
      expect(formatFactorDisplayValue({
        label: 'Marketing Expertise Available',
        value: 0.2,
        raw_value: 2,   // 0.2 * cap(10) — not a real measurement
        unit: 'scale',
      })).toBeNull()
    })

    it('suppresses raw_value with unit="index" (generic placeholder)', () => {
      expect(formatFactorDisplayValue({
        label: 'Long-Term Capability',
        value: 0.1,
        raw_value: 1,   // 0.1 * cap(10)
        unit: 'index',
      })).toBeNull()
    })

    it('does not suppress raw_value with meaningful unit', () => {
      expect(formatFactorDisplayValue({
        label: 'Headcount',
        value: 0.5,
        raw_value: 5,
        unit: 'engineers',
      })).toBe('5 engineers')
    })

    it('renders £0 for raw_value: 0 with currency unit (real measured zero)', () => {
      expect(formatFactorDisplayValue({
        label: 'Budget',
        value: 0,
        raw_value: 0,
        unit: '£',
      })).toBe('£0')
    })
  })

  // Polish 4 review follow-up: currency detection now goes through
  // classifyUnit from labelUtils. Previously this file had a hardcoded
  // `['£', '$', '€', '¥']` list that rendered CHF as "500 CHF" (trailing).
  // Now symbols prefix with no space and ISO codes prefix with a space —
  // consistent with every other canvas + model-tab formatter.
  describe('shared currency classification (Polish 4 review)', () => {
    it('formats single-char symbols as no-space prefix (£49,000)', () => {
      expect(formatFactorDisplayValue({
        label: 'Budget',
        value: 0.5,
        raw_value: 49000,
        unit: '£',
      })).toBe('£49,000')
    })

    it('formats ISO codes as space-prefix (CHF 500)', () => {
      expect(formatFactorDisplayValue({
        label: 'Reserve',
        value: 0.5,
        raw_value: 500,
        unit: 'CHF',
      })).toBe('CHF 500')
    })

    it('normalises lowercase ISO codes (chf → CHF 500)', () => {
      expect(formatFactorDisplayValue({
        label: 'Reserve',
        value: 0.5,
        raw_value: 500,
        unit: 'chf',
      })).toBe('CHF 500')
    })

    it('trims whitespace on ISO codes ( CHF  → CHF 1,200)', () => {
      expect(formatFactorDisplayValue({
        label: 'Reserve',
        value: 0.5,
        raw_value: 1200,
        unit: ' CHF ',
      })).toBe('CHF 1,200')
    })

    it('preserves non-uppercase "kr" label', () => {
      expect(formatFactorDisplayValue({
        label: 'Revenue',
        value: 0.5,
        raw_value: 500,
        unit: 'kr',
      })).toBe('kr 500')
    })

    it('still formats % with no space', () => {
      expect(formatFactorDisplayValue({
        label: 'Churn',
        value: 0.5,
        raw_value: 5,
        unit: '%',
      })).toBe('5%')
    })

    // V5 value-display fix: 0–1 ratio handling for percent units.
    // Pre-fix the formatter rounded raw_value before scaling, so 0.25 → "0%".
    // The deterministic rule: 0 < raw < 1 ⇒ scale by 100; raw === 0 ⇒ "0%";
    // raw >= 1 ⇒ already in percentage points.
    it('scales 0–1 ratio raw_value to percentage points: 0.25 → 25%', () => {
      expect(formatFactorDisplayValue({
        label: 'Owner Time Commitment',
        value: 0.25,
        raw_value: 0.25,
        unit: '%',
      })).toBe('25%')
    })

    it('keeps raw_value === 0 as 0% (no scaling)', () => {
      expect(formatFactorDisplayValue({
        label: 'Owner Time Commitment',
        value: 0,
        raw_value: 0,
        unit: '%',
      })).toBe('0%')
    })

    it('treats raw_value >= 1 as already in percentage points: 25 → 25%', () => {
      expect(formatFactorDisplayValue({
        label: 'Owner Time Commitment',
        value: 0.25,
        raw_value: 25,
        unit: '%',
      })).toBe('25%')
    })

    it('treats raw_value === 1 as already in percentage points: 1 → 1%', () => {
      expect(formatFactorDisplayValue({
        label: 'Defect Rate',
        value: 0.01,
        raw_value: 1,
        unit: '%',
      })).toBe('1%')
    })

    it('still formats "other" units as trailing suffix', () => {
      expect(formatFactorDisplayValue({
        label: 'Headcount',
        value: 0.5,
        raw_value: 9,
        unit: 'months',
      })).toBe('9 months')
    })
  })
})
