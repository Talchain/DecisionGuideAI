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

    it('suppresses value=0 with no unit when factor_type is not binary', () => {
      // Post-review tightening: contextual text only fires when factor_type is
      // explicitly 'binary'. Without that signal, "No X in place" misrepresents
      // continuous quality factors that happen to land at 0.
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 0,
        raw_value: null,
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

    it('suppresses value=0 with unit="scale" when factor_type is not binary', () => {
      expect(formatFactorDisplayValue({
        label: 'Some metric',
        value: 0,
        raw_value: null,
        unit: 'scale',
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
  })
})
