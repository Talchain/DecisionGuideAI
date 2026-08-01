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
  isCurrencyUnit,
  isGenericUnit,
} from '../utils'
import { directionFromProducerSignedMean } from '../../../domain/edgeValueProvenance'

/**
 * ROADMAP 2.263 — the direction is now an explicit argument (see
 * `strengthBands.spec.ts` for the same note). Band boundaries are what these
 * cases pin; the direction comes from a named source so no assertion here
 * depends on a magnitude's sign being read as a scientific claim.
 */
const dir = (mean: number) => directionFromProducerSignedMean(mean)

describe('strengthSemanticLabel', () => {
  describe('band boundaries', () => {
    it('returns "Negligible effect" for |mean| < 0.05', () => {
      expect(strengthSemanticLabel(0, dir(0))).toBe('Negligible effect')
      expect(strengthSemanticLabel(0.04, dir(0.04))).toBe('Negligible effect')
      expect(strengthSemanticLabel(-0.04, dir(-0.04))).toBe('Negligible effect')
    })

    it('returns "Weak positive effect" at lower Weak boundary (0.05)', () => {
      expect(strengthSemanticLabel(0.05, dir(0.05))).toBe('Weak positive effect')
    })

    it('returns "Weak negative effect" at lower Weak boundary (-0.05)', () => {
      expect(strengthSemanticLabel(-0.05, dir(-0.05))).toBe('Weak negative effect')
    })

    it('returns "Weak positive effect" for 0.05 <= |mean| < 0.25', () => {
      expect(strengthSemanticLabel(0.1, dir(0.1))).toBe('Weak positive effect')
      expect(strengthSemanticLabel(0.24, dir(0.24))).toBe('Weak positive effect')
    })

    it('returns "Moderate positive effect" at lower Moderate boundary (0.25)', () => {
      expect(strengthSemanticLabel(0.25, dir(0.25))).toBe('Moderate positive effect')
    })

    it('returns "Moderate negative effect" at lower Moderate boundary (-0.25)', () => {
      expect(strengthSemanticLabel(-0.25, dir(-0.25))).toBe('Moderate negative effect')
    })

    it('returns "Moderate positive effect" for 0.25 <= |mean| < 0.6', () => {
      expect(strengthSemanticLabel(0.5, dir(0.5))).toBe('Moderate positive effect')
      expect(strengthSemanticLabel(0.59, dir(0.59))).toBe('Moderate positive effect')
    })

    it('returns "Strong positive effect" at lower Strong boundary (0.6)', () => {
      expect(strengthSemanticLabel(0.6, dir(0.6))).toBe('Strong positive effect')
    })

    it('returns "Strong negative effect" at lower Strong boundary (-0.6)', () => {
      expect(strengthSemanticLabel(-0.6, dir(-0.6))).toBe('Strong negative effect')
    })

    it('returns "Strong positive effect" for |mean| >= 0.6', () => {
      expect(strengthSemanticLabel(0.8, dir(0.8))).toBe('Strong positive effect')
      expect(strengthSemanticLabel(1.0, dir(1.0))).toBe('Strong positive effect')
      expect(strengthSemanticLabel(2.0, dir(2.0))).toBe('Strong positive effect')
    })

    it('returns "Strong negative effect" for negative |mean| >= 0.6', () => {
      expect(strengthSemanticLabel(-0.8, dir(-0.8))).toBe('Strong negative effect')
      expect(strengthSemanticLabel(-1.0, dir(-1.0))).toBe('Strong negative effect')
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

  it('prefixes ISO currency codes with space', () => {
    expect(formatValueWithUnit(100, 'EUR')).toBe('EUR 100')  // ISO 4217 style: code + space + number
  })

  it('suffixes non-currency units', () => {
    expect(formatValueWithUnit(9, 'months')).toBe('9 months')
    expect(formatValueWithUnit(2.5, '%')).toBe('2.5 %')
    expect(formatValueWithUnit(0, 'FTE')).toBe('0 FTE')  // regression: was 'FTE0'
    expect(formatValueWithUnit(3, 'FTE')).toBe('3 FTE')  // regression: was 'FTE3'
  })

  it('omits generic units (scale, index, score, normalised)', () => {
    expect(formatValueWithUnit(0.7, 'scale')).toBe('0.7')
    expect(formatValueWithUnit(0, 'scale')).toBe('0')
    expect(formatValueWithUnit(0.5, 'normalised')).toBe('0.5')
    expect(formatValueWithUnit(1.23, 'index')).toBe('1.23')
    expect(formatValueWithUnit(0.9, 'score')).toBe('0.9')
    expect(formatValueWithUnit(0.3, 'normalized')).toBe('0.3')
  })
})

describe('isCurrencyUnit', () => {
  it('recognises currency symbols', () => {
    expect(isCurrencyUnit('£')).toBe(true)
    expect(isCurrencyUnit('$')).toBe(true)
    expect(isCurrencyUnit('€')).toBe(true)
  })

  it('recognises ISO currency codes', () => {
    expect(isCurrencyUnit('USD')).toBe(true)
    expect(isCurrencyUnit('GBP')).toBe(true)
  })

  it('rejects non-currency units', () => {
    expect(isCurrencyUnit('months')).toBe(false)
    expect(isCurrencyUnit('FTE')).toBe(false)
    expect(isCurrencyUnit('scale')).toBe(false)
  })
})

describe('isGenericUnit', () => {
  it('recognises generic/dimensionless units', () => {
    expect(isGenericUnit('scale')).toBe(true)
    expect(isGenericUnit('index')).toBe(true)
    expect(isGenericUnit('score')).toBe(true)
    expect(isGenericUnit('normalised')).toBe(true)
    expect(isGenericUnit('normalized')).toBe(true)
    expect(isGenericUnit('norm')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isGenericUnit('Scale')).toBe(true)
    expect(isGenericUnit('NORMALISED')).toBe(true)
  })

  it('rejects specific units', () => {
    expect(isGenericUnit('months')).toBe(false)
    expect(isGenericUnit('FTE')).toBe(false)
    expect(isGenericUnit('%')).toBe(false)
    expect(isGenericUnit('£')).toBe(false)
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
