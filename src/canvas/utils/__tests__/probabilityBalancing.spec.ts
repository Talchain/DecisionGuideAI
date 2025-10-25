/**
 * Probability Balancing - Test Suite
 *
 * Tests for auto-balance and equal-split algorithms
 * Covers: normalization, rounding, remainder apportionment, edge cases
 */

import { describe, it, expect } from 'vitest'
import { autoBalance, equalSplit, type BalanceRow } from '../probabilityBalancing'

describe('autoBalance', () => {
  describe('Basic Cases (from ChatGPT examples)', () => {
    it('handles 67/8 (sum 75) → 90/10', () => {
      const rows: BalanceRow[] = [
        { value: 67, locked: false },
        { value: 8, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.error).toBeUndefined()
      expect(result.values[0] + result.values[1]).toBe(100)
      expect(result.values[0]).toBeGreaterThan(result.values[1]) // Rank preserved

      // Should be close to 90/10 (89.3/10.7 normalized)
      expect(result.values[0]).toBeGreaterThanOrEqual(85)
      expect(result.values[0]).toBeLessThanOrEqual(95)
      expect(result.values[1]).toBeGreaterThanOrEqual(5)
      expect(result.values[1]).toBeLessThanOrEqual(15)
    })

    it('handles 53/39 (sum 92) → ~55/45 or 60/40', () => {
      const rows: BalanceRow[] = [
        { value: 53, locked: false },
        { value: 39, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0] + result.values[1]).toBe(100)
      expect(result.values[0]).toBeGreaterThan(result.values[1]) // Rank preserved

      // Should be close to 55/45 (57.6/42.4 normalized)
      expect(result.values).toSatisfy((r: number[]) =>
        (r[0] === 55 && r[1] === 45) || (r[0] === 60 && r[1] === 40)
      )
    })

    it('handles 41/33/18 (sum 92) → 45/35/20', () => {
      const rows: BalanceRow[] = [
        { value: 41, locked: false },
        { value: 33, locked: false },
        { value: 18, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0] + result.values[1] + result.values[2]).toBe(100)
      expect(result.values[0]).toBeGreaterThan(result.values[1])
      expect(result.values[1]).toBeGreaterThan(result.values[2]) // Rank preserved

      // Should be close to 45/35/20 (44.6/35.9/19.6 normalized)
      expect(result.values[0]).toBeCloseTo(45, 0)
      expect(result.values[1]).toBeCloseTo(35, 0)
      expect(result.values[2]).toBeCloseTo(20, 0)
    })
  })

  describe('Rounding to Nice Numbers', () => {
    it('rounds to 5% steps by default', () => {
      const rows: BalanceRow[] = [
        { value: 47, locked: false },
        { value: 53, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0] % 5).toBe(0)
      expect(result.values[1] % 5).toBe(0)
      expect(result.values[0] + result.values[1]).toBe(100)
    })

    it('rounds to 1% steps when step=1', () => {
      const rows: BalanceRow[] = [
        { value: 47.3, locked: false },
        { value: 52.7, locked: false }
      ]

      const result = autoBalance(rows, { step: 1 })

      expect(result.values[0] + result.values[1]).toBe(100)
      // With step=1, can get more precise
      expect(result.values[0]).toBeGreaterThanOrEqual(47)
      expect(result.values[0]).toBeLessThanOrEqual(48)
    })

    it('handles 10% steps', () => {
      const rows: BalanceRow[] = [
        { value: 30, locked: false },
        { value: 70, locked: false }
      ]

      const result = autoBalance(rows, { step: 10 })

      expect(result.values[0] % 10).toBe(0)
      expect(result.values[1] % 10).toBe(0)
      expect(result.values[0] + result.values[1]).toBe(100)
    })
  })

  describe('Locked Rows', () => {
    it('respects locked rows', () => {
      const rows: BalanceRow[] = [
        { value: 30, locked: true },
        { value: 40, locked: false },
        { value: 30, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0]).toBe(30) // Locked unchanged
      expect(result.values[1] + result.values[2]).toBe(70) // Remaining split
      expect(result.values[0] + result.values[1] + result.values[2]).toBe(100)
    })

    it('handles multiple locked rows', () => {
      const rows: BalanceRow[] = [
        { value: 20, locked: true },
        { value: 30, locked: true },
        { value: 50, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0]).toBe(20) // Locked
      expect(result.values[1]).toBe(30) // Locked
      expect(result.values[2]).toBe(50) // Gets all remaining
    })

    it('handles all locked rows', () => {
      const rows: BalanceRow[] = [
        { value: 40, locked: true },
        { value: 60, locked: true }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0]).toBe(40) // Unchanged
      expect(result.values[1]).toBe(60) // Unchanged
    })
  })

  describe('Rank Preservation', () => {
    it('preserves rank order (bigger stays bigger)', () => {
      const rows: BalanceRow[] = [
        { value: 50, locked: false },
        { value: 30, locked: false },
        { value: 10, locked: false }
      ]

      const result = autoBalance(rows, { step: 5, preserveRank: true })

      expect(result.values[0]).toBeGreaterThan(result.values[1])
      expect(result.values[1]).toBeGreaterThan(result.values[2])
      expect(result.values[0] + result.values[1] + result.values[2]).toBe(100)
    })

    it('can disable rank preservation', () => {
      const rows: BalanceRow[] = [
        { value: 51, locked: false },
        { value: 49, locked: false }
      ]

      // With preserveRank=false, rounding might invert order
      const result = autoBalance(rows, { step: 5, preserveRank: false })

      expect(result.values[0] + result.values[1]).toBe(100)
      // Order might be inverted, but sum is correct
    })
  })

  describe('Edge Cases', () => {
    it('returns error when locked sum exceeds target', () => {
      const rows: BalanceRow[] = [
        { value: 60, locked: true },
        { value: 50, locked: true },
        { value: 10, locked: false }
      ]

      const result = autoBalance(rows, { target: 100, step: 5 })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Locked rows sum to 110%')
      expect(result.error).toContain('exceeds 100%')
      // Should return original values when error occurs
      expect(result.values[0]).toBe(60)
      expect(result.values[1]).toBe(50)
      expect(result.values[2]).toBe(10)
    })

    it('handles single row', () => {
      const rows: BalanceRow[] = [
        { value: 80, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0]).toBe(100)
    })

    it('handles all zeros', () => {
      const rows: BalanceRow[] = [
        { value: 0, locked: false },
        { value: 0, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      // Can't preserve ratios from zero, but should sum to 100
      expect(result.values[0] + result.values[1]).toBe(100)
    })

    it('handles very small values', () => {
      const rows: BalanceRow[] = [
        { value: 99, locked: false },
        { value: 1, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0] + result.values[1]).toBe(100)
      expect(result.values[0]).toBeGreaterThan(result.values[1])
    })

    it('handles values over 100', () => {
      const rows: BalanceRow[] = [
        { value: 80, locked: false },
        { value: 60, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      // Should normalize to 100
      expect(result.values[0] + result.values[1]).toBe(100)
      expect(result.values[0]).toBeGreaterThan(result.values[1]) // Rank preserved
    })

    it('respects minNonZero constraint', () => {
      const rows: BalanceRow[] = [
        { value: 95, locked: false },
        { value: 5, locked: false }
      ]

      const result = autoBalance(rows, { step: 5, minNonZero: 10 })

      expect(result.values[0] + result.values[1]).toBe(100)
      expect(result.values[1]).toBeGreaterThanOrEqual(10) // Enforced minimum
    })
  })

  describe('Remainder Apportionment', () => {
    it('distributes remainder fairly (Hamilton method)', () => {
      const rows: BalanceRow[] = [
        { value: 33, locked: false },
        { value: 33, locked: false },
        { value: 33, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values[0] + result.values[1] + result.values[2]).toBe(100)
      // 33.33 each → one gets 35, two get 35, or two get 35 and one gets 30
      const sorted = [...result.values].sort((a, b) => b - a)
      expect(sorted[0]).toBeGreaterThanOrEqual(30)
      expect(sorted[2]).toBeLessThanOrEqual(35)
    })

    it('handles uneven remainders', () => {
      const rows: BalanceRow[] = [
        { value: 25, locked: false },
        { value: 25, locked: false },
        { value: 25, locked: false },
        { value: 25, locked: false }
      ]

      const result = autoBalance(rows, { step: 5 })

      expect(result.values.reduce((sum, v) => sum + v, 0)).toBe(100)
      // 25 each sums to 100, should all be 25
      expect(result.values.every(v => v === 25)).toBe(true)
    })
  })
})

describe('equalSplit', () => {
  describe('Basic Cases', () => {
    it('splits 100% equally between 2 rows', () => {
      const rows: BalanceRow[] = [
        { value: 67, locked: false },
        { value: 8, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0]).toBe(50)
      expect(result.values[1]).toBe(50)
    })

    it('splits 100% equally between 3 rows', () => {
      const rows: BalanceRow[] = [
        { value: 41, locked: false },
        { value: 33, locked: false },
        { value: 18, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0] + result.values[1] + result.values[2]).toBe(100)
      // 33.33 each → two get 35, one gets 30 (or similar with 5% steps)
      const counts = result.values.reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      // Should have values close to 33.33
      expect(Object.keys(counts).length).toBeLessThanOrEqual(2) // At most 2 different values
    })

    it('ignores previous ratios', () => {
      const rows: BalanceRow[] = [
        { value: 90, locked: false },
        { value: 10, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      // Ignores 90:10 ratio, splits equally
      expect(result.values[0]).toBe(50)
      expect(result.values[1]).toBe(50)
    })
  })

  describe('Locked Rows', () => {
    it('splits remaining after locked rows', () => {
      const rows: BalanceRow[] = [
        { value: 10, locked: true },
        { value: 45, locked: false },
        { value: 45, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0]).toBe(10) // Locked
      expect(result.values[1]).toBe(45) // 90/2
      expect(result.values[2]).toBe(45) // 90/2
    })

    it('handles multiple locked rows', () => {
      const rows: BalanceRow[] = [
        { value: 20, locked: true },
        { value: 30, locked: true },
        { value: 10, locked: false },
        { value: 40, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0]).toBe(20) // Locked
      expect(result.values[1]).toBe(30) // Locked
      expect(result.values[2]).toBe(25) // 50/2
      expect(result.values[3]).toBe(25) // 50/2
    })
  })

  describe('Rounding', () => {
    it('rounds to 5% steps by default', () => {
      const rows: BalanceRow[] = [
        { value: 10, locked: false },
        { value: 20, locked: false },
        { value: 30, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values.every(v => v % 5 === 0)).toBe(true)
      expect(result.values.reduce((sum, v) => sum + v, 0)).toBe(100)
    })

    it('handles 1% steps', () => {
      const rows: BalanceRow[] = [
        { value: 10, locked: false },
        { value: 20, locked: false },
        { value: 30, locked: false }
      ]

      const result = equalSplit(rows, { step: 1 })

      expect(result.values.reduce((sum, v) => sum + v, 0)).toBe(100)
      // With 1% steps, can get closer to 33.33
      expect(result.values.every(v => v >= 33 && v <= 34)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('returns error when locked sum exceeds target', () => {
      const rows: BalanceRow[] = [
        { value: 70, locked: true },
        { value: 40, locked: true },
        { value: 10, locked: false }
      ]

      const result = equalSplit(rows, { target: 100, step: 5 })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Locked rows sum to 110%')
      expect(result.error).toContain('exceeds 100%')
      // Should return original values when error occurs
      expect(result.values[0]).toBe(70)
      expect(result.values[1]).toBe(40)
      expect(result.values[2]).toBe(10)
    })

    it('handles single row', () => {
      const rows: BalanceRow[] = [
        { value: 50, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0]).toBe(100)
    })

    it('handles all locked', () => {
      const rows: BalanceRow[] = [
        { value: 40, locked: true },
        { value: 60, locked: true }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values[0]).toBe(40) // Unchanged
      expect(result.values[1]).toBe(60) // Unchanged
    })

    it('respects minNonZero', () => {
      const rows: BalanceRow[] = [
        { value: 50, locked: false },
        { value: 50, locked: false }
      ]

      const result = equalSplit(rows, { step: 5, minNonZero: 40 })

      expect(result.values.every(v => v >= 40)).toBe(true)
      expect(result.values[0] + result.values[1]).toBe(100)
    })
  })

  describe('Remainder Assignment', () => {
    it('assigns remainder to first rows', () => {
      const rows: BalanceRow[] = [
        { value: 10, locked: false },
        { value: 10, locked: false },
        { value: 10, locked: false }
      ]

      const result = equalSplit(rows, { step: 5 })

      expect(result.values.reduce((sum, v) => sum + v, 0)).toBe(100)
      // 100/3 = 33.33 → two get 35, one gets 30
      const sortedDesc = [...result.values].sort((a, b) => b - a)
      expect(sortedDesc[0]).toBe(35)
      expect(sortedDesc[1]).toBe(35)
      expect(sortedDesc[2]).toBe(30)
    })
  })
})

describe('Comparison: autoBalance vs equalSplit', () => {
  it('autoBalance preserves ratios, equalSplit does not', () => {
    const rows: BalanceRow[] = [
      { value: 80, locked: false },
      { value: 20, locked: false }
    ]

    const balanced = autoBalance(rows, { step: 5 })
    const split = equalSplit(rows, { step: 5 })

    // Balanced preserves 80:20 ratio (4:1)
    expect(balanced.values[0] / balanced.values[1]).toBeCloseTo(4, 0)

    // Split ignores ratio
    expect(split.values[0]).toBe(50)
    expect(split.values[1]).toBe(50)
  })

  it('both respect locked rows', () => {
    const rows: BalanceRow[] = [
      { value: 25, locked: true },
      { value: 40, locked: false },
      { value: 35, locked: false }
    ]

    const balanced = autoBalance(rows, { step: 5 })
    const split = equalSplit(rows, { step: 5 })

    expect(balanced.values[0]).toBe(25)
    expect(split.values[0]).toBe(25)

    expect(balanced.values[1] + balanced.values[2]).toBe(75)
    expect(split.values[1] + split.values[2]).toBe(75)

    // Split divides remaining equally
    expect(Math.abs(split.values[1] - split.values[2])).toBeLessThanOrEqual(5) // Within one step
  })
})
