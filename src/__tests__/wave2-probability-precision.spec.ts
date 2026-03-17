/**
 * Wave 2 P1: Probability Precision Contract Tests
 *
 * Validates that all result surface formatters produce integer-rounded
 * percentages consistently. Prevents future drift across Hero, OptionCards,
 * and node components.
 */

import { describe, it, expect } from 'vitest'
import { formatPercent } from '../utils/formatPercent'

// =============================================================================
// Cross-surface precision contract
// =============================================================================
describe('Probability precision — cross-surface contract', () => {
  // Representative win_probability values from PLoT (0-1 decimals)
  const testCases = [
    { input: 0.58, expected: '58%' },
    { input: 0.9615, expected: '96%' },
    { input: 0.0, expected: '0%' },
    { input: 1.0, expected: '100%' },
    { input: 0.505, expected: '51%' },  // Rounds up from .5
    { input: 0.994, expected: '99%' },
    { input: 0.001, expected: '0%' },   // Rounds down
    { input: 0.999, expected: '100%' },  // Edge: rounds to 100 (UI-SEM-008 caps at 99 separately)
    { input: 0.3333, expected: '33%' },
    { input: 0.6667, expected: '67%' },
  ]

  describe('formatPercent(value, { fromDecimal: true }) — HeroSection/OptionCards path', () => {
    it.each(testCases)('$input → $expected', ({ input, expected }) => {
      expect(formatPercent(input, { fromDecimal: true })).toBe(expected)
    })

    it('never produces decimal places (integer-only output)', () => {
      for (const { input } of testCases) {
        const result = formatPercent(input, { fromDecimal: true })
        // Strip the % suffix and check for decimal point
        const numericPart = result.replace('%', '')
        expect(numericPart).not.toContain('.')
      }
    })
  })

  describe('Math.round(value * 100) — GoalNode/OptionNode inline path', () => {
    // GoalNode and OptionNode use Math.round(displayMetadata.achievementProbability * 100)
    // This must produce identical results to formatPercent with fromDecimal: true
    it.each(testCases)('$input → matches formatPercent output', ({ input }) => {
      const inlineResult = `${Math.round(input * 100)}%`
      const formatterResult = formatPercent(input, { fromDecimal: true })
      expect(inlineResult).toBe(formatterResult)
    })
  })

  describe('Delta percentages (sign prefix)', () => {
    it('positive delta: +10%', () => {
      expect(formatPercent(10, { sign: true })).toBe('+10%')
    })

    it('negative delta: -14%', () => {
      expect(formatPercent(-14, { sign: true })).toBe('-14%')
    })

    it('zero delta: 0% (no sign)', () => {
      expect(formatPercent(0, { sign: true })).toBe('0%')
    })
  })

  describe('Edge cases — no NaN, no undefined', () => {
    it('zero input produces "0%"', () => {
      expect(formatPercent(0, { fromDecimal: true })).toBe('0%')
    })

    it('exactly 1.0 produces "100%"', () => {
      expect(formatPercent(1.0, { fromDecimal: true })).toBe('100%')
    })

    it('very small positive produces "0%"', () => {
      expect(formatPercent(0.001, { fromDecimal: true })).toBe('0%')
    })
  })
})
