/**
 * utils.ts — unit tests
 *
 * Covers: strengthSemanticLabel band boundaries, formatSmartNumber, formatValueWithUnit, getPrimaryValue
 */

import { describe, it, expect } from 'vitest'
import {
  strengthSemanticLabel,
  formatSmartNumber,
  formatValueWithUnit,
  getPrimaryValue,
} from '../utils'

describe('strengthSemanticLabel', () => {
  describe('band boundaries', () => {
    it('returns "Negligible effect" for |mean| < 0.05', () => {
      expect(strengthSemanticLabel(0)).toBe('Negligible effect')
      expect(strengthSemanticLabel(0.04)).toBe('Negligible effect')
      expect(strengthSemanticLabel(-0.04)).toBe('Negligible effect')
    })

    it('returns "Weak positive effect" at lower Weak boundary (0.05)', () => {
      expect(strengthSemanticLabel(0.05)).toBe('Weak positive effect')
    })

    it('returns "Weak negative effect" at lower Weak boundary (-0.05)', () => {
      expect(strengthSemanticLabel(-0.05)).toBe('Weak negative effect')
    })

    it('returns "Weak positive effect" for 0.05 <= |mean| < 0.25', () => {
      expect(strengthSemanticLabel(0.1)).toBe('Weak positive effect')
      expect(strengthSemanticLabel(0.24)).toBe('Weak positive effect')
    })

    it('returns "Moderate positive effect" at lower Moderate boundary (0.25)', () => {
      expect(strengthSemanticLabel(0.25)).toBe('Moderate positive effect')
    })

    it('returns "Moderate negative effect" at lower Moderate boundary (-0.25)', () => {
      expect(strengthSemanticLabel(-0.25)).toBe('Moderate negative effect')
    })

    it('returns "Moderate positive effect" for 0.25 <= |mean| < 0.6', () => {
      expect(strengthSemanticLabel(0.5)).toBe('Moderate positive effect')
      expect(strengthSemanticLabel(0.59)).toBe('Moderate positive effect')
    })

    it('returns "Strong positive effect" at lower Strong boundary (0.6)', () => {
      expect(strengthSemanticLabel(0.6)).toBe('Strong positive effect')
    })

    it('returns "Strong negative effect" at lower Strong boundary (-0.6)', () => {
      expect(strengthSemanticLabel(-0.6)).toBe('Strong negative effect')
    })

    it('returns "Strong positive effect" for |mean| >= 0.6', () => {
      expect(strengthSemanticLabel(0.8)).toBe('Strong positive effect')
      expect(strengthSemanticLabel(1.0)).toBe('Strong positive effect')
      expect(strengthSemanticLabel(2.0)).toBe('Strong positive effect')
    })

    it('returns "Strong negative effect" for negative |mean| >= 0.6', () => {
      expect(strengthSemanticLabel(-0.8)).toBe('Strong negative effect')
      expect(strengthSemanticLabel(-1.0)).toBe('Strong negative effect')
    })
  })
})

describe('formatSmartNumber', () => {
  it('returns integer string for whole numbers', () => {
    expect(formatSmartNumber(0)).toBe('0')
    expect(formatSmartNumber(42)).toBe('42')
    expect(formatSmartNumber(-5)).toBe('-5')
  })

  it('trims trailing zeros from decimals', () => {
    expect(formatSmartNumber(1.5)).toBe('1.5')
    expect(formatSmartNumber(1.50)).toBe('1.5')
    expect(formatSmartNumber(1.10)).toBe('1.1')
  })

  it('rounds to max 2 decimal places', () => {
    expect(formatSmartNumber(1.234)).toBe('1.23')
    expect(formatSmartNumber(1.235)).toBe('1.24')
  })
})

describe('formatValueWithUnit', () => {
  it('prefixes currency symbols', () => {
    expect(formatValueWithUnit(49, '£')).toBe('£49')
    expect(formatValueWithUnit(1000, '$')).toBe('$1,000')
  })

  it('prefixes ISO currency codes', () => {
    expect(formatValueWithUnit(100, 'EUR')).toBe('EUR100')  // 100 is integer, no thousands separator
  })

  it('suffixes non-currency units', () => {
    expect(formatValueWithUnit(9, 'months')).toBe('9 months')
    expect(formatValueWithUnit(2.5, '%')).toBe('2.5 %')
  })
})

describe('getPrimaryValue', () => {
  it('returns formatted raw_value with unit when both present', () => {
    expect(getPrimaryValue({ raw_value: 49, unit: '£' })).toBe('£49')
  })

  it('returns formatted raw_value without unit when unit absent', () => {
    expect(getPrimaryValue({ raw_value: 3.5 })).toBe('3.5')
  })

  it('returns null when raw_value is undefined', () => {
    expect(getPrimaryValue({ value: 0.5 })).toBeNull()
    expect(getPrimaryValue({})).toBeNull()
  })
})
