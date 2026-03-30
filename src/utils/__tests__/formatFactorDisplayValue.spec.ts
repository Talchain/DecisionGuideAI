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
})
