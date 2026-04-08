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

  it('returns contextual text for binary 0 without raw_value', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 0,
      raw_value: null,
      unit: null,
      factor_type: 'other',
    })).toBe('No technical leadership in place')
  })

  it('returns contextual text for binary 0 with "Added" suffix', () => {
    expect(formatFactorDisplayValue({
      label: 'Developer Headcount Added',
      value: 0,
      raw_value: null,
      unit: null,
    })).toBe('No developer headcount in place')
  })

  it('returns contextual text for binary 1 without raw_value', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 1,
      raw_value: null,
      unit: null,
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

  it('ignores display_value when empty string', () => {
    expect(formatFactorDisplayValue({
      label: 'Technical Leadership Presence',
      value: 0,
      raw_value: null,
      display_value: '',
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

    it('preserves binary value=0 contextual text even with no unit', () => {
      // Polish 4 Task 1 explicitly only suppresses 0 < value < 1; value === 0
      // and value === 1 still flow through the binary contextual heuristic.
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 0,
        raw_value: null,
      })).toBe('No tech lead in place')
    })

    it('preserves binary value=1 contextual text even with unit="scale"', () => {
      expect(formatFactorDisplayValue({
        label: 'Tech Lead',
        value: 1,
        raw_value: null,
        unit: 'scale',
      })).toBe('Tech lead active')
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
