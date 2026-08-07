/**
 * parseSuccessTarget — UI-SEM-086 honest numeric extraction.
 *
 * Regression anchor: dress-rehearsal 2026-07-20 — "Reach £500k incremental
 * ARR within 12 months of launch" was digit-stripped to 50012 (the "k"
 * multiplier lost, the "12" of "12 months" concatenated on), which rendered
 * as "Target: 50,012" (goal node) and "5,001,200% likelihood" (Model tab).
 */

import { describe, it, expect } from 'vitest'
import { parseSuccessTarget } from '../parseSuccessTarget'

describe('parseSuccessTarget', () => {
  describe('bare numeric input (existing behaviour preserved)', () => {
    it('parses a plain integer', () => {
      expect(parseSuccessTarget('500000')).toEqual({ value: 500000, unit: null })
    })

    it('parses thousands separators', () => {
      expect(parseSuccessTarget('500,000')).toEqual({ value: 500000, unit: null })
    })

    it('parses decimals', () => {
      expect(parseSuccessTarget('0.5')).toEqual({ value: 0.5, unit: null })
    })

    it('parses negative numbers', () => {
      expect(parseSuccessTarget('-3')).toEqual({ value: -3, unit: null })
    })

    it('returns null for empty input', () => {
      expect(parseSuccessTarget('')).toBeNull()
      expect(parseSuccessTarget('   ')).toBeNull()
    })

    it('returns null for non-numeric input', () => {
      expect(parseSuccessTarget('break even')).toBeNull()
    })
  })

  describe('currency and multiplier suffixes', () => {
    it('parses £500k as 500000 with £ unit — never 500', () => {
      expect(parseSuccessTarget('£500k')).toEqual({ value: 500000, unit: '£' })
    })

    it('parses 1.5m as 1500000', () => {
      expect(parseSuccessTarget('1.5m')).toEqual({ value: 1500000, unit: null })
    })

    it('parses $2bn as 2e9 with $ unit', () => {
      expect(parseSuccessTarget('$2bn')).toEqual({ value: 2e9, unit: '$' })
    })

    it('parses a percentage', () => {
      expect(parseSuccessTarget('15%')).toEqual({ value: 15, unit: '%' })
    })
  })

  describe('prose (the dress-rehearsal defect class)', () => {
    it('extracts £500k — NOT 50012 — from the rehearsal sentence', () => {
      expect(
        parseSuccessTarget('Reach £500k incremental ARR within 12 months of launch'),
      ).toEqual({ value: 500000, unit: '£' })
    })

    it('never treats a timeframe as the target', () => {
      expect(parseSuccessTarget('double revenue within 12 months')).toBeNull()
    })

    it('extracts a lone unambiguous bare number from prose', () => {
      expect(parseSuccessTarget('hit 40 new enterprise accounts')).toEqual({
        value: 40,
        unit: null,
      })
    })

    it('extracts a lone percentage from prose', () => {
      expect(parseSuccessTarget('grow gross margin by 15% year one')).toEqual({
        value: 15,
        unit: '%',
      })
    })

    it('fails closed on two competing bare numbers', () => {
      expect(parseSuccessTarget('grow from 200 to 400 customers')).toBeNull()
    })

    it('fails closed on two competing currency amounts', () => {
      expect(parseSuccessTarget('somewhere between £2m and £3m')).toBeNull()
    })

    it('never digit-concatenates across tokens', () => {
      // The old parser returned 50012 here.
      const result = parseSuccessTarget('Reach £500k incremental ARR within 12 months of launch')
      expect(result?.value).not.toBe(50012)
    })
  })
})
