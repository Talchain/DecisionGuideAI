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
} from '../utils'
import { directionFromProducerSignedMean } from '../../../domain/edgeValueProvenance'
import { CANVAS_STRENGTH_BANDS } from '../../../domain/vocabulary'

/**
 * ROADMAP 2.263 — the direction is now an explicit argument (see
 * `strengthBands.spec.ts` for the same note). Band boundaries are what these
 * cases pin; the direction comes from a named source so no assertion here
 * depends on a magnitude's sign being read as a scientific claim.
 */
const dir = (mean: number) => directionFromProducerSignedMean(mean)

/**
 * Band boundaries come from the ONE canonical table, `CANVAS_STRENGTH_BANDS`
 * (A15, PR #2039): the Model tab, the inspector and the canvas name a magnitude
 * the same way. The boundaries below are READ from that table, not re-typed,
 * so this spec cannot drift from it again (it pinned the retired 0.25/0.6 table).
 * Only the "negligible" floor (0.05) is the Model tab's own.
 */
const MODERATE_MIN = CANVAS_STRENGTH_BANDS.find(b => b.id === 'moderate')!.min
const STRONG_MIN = CANVAS_STRENGTH_BANDS.find(b => b.id === 'strong')!.min
const JUST_BELOW = (x: number) => x - 0.01

describe('strengthSemanticLabel', () => {
  describe('band boundaries (read from CANVAS_STRENGTH_BANDS)', () => {
    it('the canonical table is the one this spec reads (0.20 moderate, 0.40 strong)', () => {
      expect(MODERATE_MIN).toBe(0.2)
      expect(STRONG_MIN).toBe(0.4)
    })

    it('returns "Negligible effect" for |mean| < 0.05', () => {
      expect(strengthSemanticLabel(0, dir(0))).toBe('Negligible effect')
      expect(strengthSemanticLabel(0.04, dir(0.04))).toBe('Negligible effect')
      expect(strengthSemanticLabel(-0.04, dir(-0.04))).toBe('Negligible effect')
    })

    it('returns "Weak positive/negative effect" at the lower Weak boundary (±0.05)', () => {
      expect(strengthSemanticLabel(0.05, dir(0.05))).toBe('Weak positive effect')
      expect(strengthSemanticLabel(-0.05, dir(-0.05))).toBe('Weak negative effect')
    })

    it('returns "Weak positive effect" up to just below the canonical Moderate minimum', () => {
      expect(strengthSemanticLabel(0.1, dir(0.1))).toBe('Weak positive effect')
      expect(strengthSemanticLabel(JUST_BELOW(MODERATE_MIN), dir(JUST_BELOW(MODERATE_MIN)))).toBe('Weak positive effect')
    })

    it('returns "Moderate positive/negative effect" at the canonical Moderate minimum', () => {
      expect(strengthSemanticLabel(MODERATE_MIN, dir(MODERATE_MIN))).toBe('Moderate positive effect')
      expect(strengthSemanticLabel(-MODERATE_MIN, dir(-MODERATE_MIN))).toBe('Moderate negative effect')
    })

    it('returns "Moderate positive effect" up to just below the canonical Strong minimum', () => {
      expect(strengthSemanticLabel(0.3, dir(0.3))).toBe('Moderate positive effect')
      expect(strengthSemanticLabel(JUST_BELOW(STRONG_MIN), dir(JUST_BELOW(STRONG_MIN)))).toBe('Moderate positive effect')
    })

    it('returns "Strong positive/negative effect" at the canonical Strong minimum', () => {
      expect(strengthSemanticLabel(STRONG_MIN, dir(STRONG_MIN))).toBe('Strong positive effect')
      expect(strengthSemanticLabel(-STRONG_MIN, dir(-STRONG_MIN))).toBe('Strong negative effect')
    })

    it('returns "Strong positive/negative effect" above it', () => {
      expect(strengthSemanticLabel(0.8, dir(0.8))).toBe('Strong positive effect')
      expect(strengthSemanticLabel(1.0, dir(1.0))).toBe('Strong positive effect')
      expect(strengthSemanticLabel(2.0, dir(2.0))).toBe('Strong positive effect')
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

// `isGenericUnit` removed with its function (16 Aug 2026 mount train, design
// §7.5 — no production importer). The LIVE generic-unit behaviour is pinned
// above through `formatValueWithUnit` ('omits generic units …'), which is the
// path production actually takes.

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
