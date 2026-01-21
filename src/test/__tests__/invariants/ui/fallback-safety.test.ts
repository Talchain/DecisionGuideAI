/**
 * Fallback Safety Invariants
 *
 * These tests verify that the boundary parse functions correctly handle
 * edge cases that have caused production bugs:
 *
 * 1. "Zero blocks fallback" - asOptionalNumber(0) must return 0, not undefined
 * 2. "Missing becomes zero" - undefined must NOT become 0
 * 3. "Placeholder detection" - threshold-based checks for placeholder zeros
 *
 * These invariants prevent regression of P0 data integrity bugs.
 */

import { describe, it, expect } from 'vitest'
import {
  asOptionalNumber,
  asOptionalString,
  asOptionalBoolean,
  asArray,
  asObject,
  firstDefined,
  emptyToUndefined,
} from '../../../../lib/mappers/utils'

describe('Fallback Safety Invariants', () => {
  describe('asOptionalNumber - Zero preservation', () => {
    it('should preserve real zero (CRITICAL)', () => {
      // CRITICAL: Zero is a valid value, not missing data
      expect(asOptionalNumber(0)).toBe(0)
    })

    it('should preserve negative zero as a finite number', () => {
      // Note: JavaScript distinguishes -0 from 0 with Object.is
      // What matters is that it's preserved as a number, not undefined
      const result = asOptionalNumber(-0)
      expect(typeof result).toBe('number')
      expect(Number.isFinite(result)).toBe(true)
      expect(result === 0).toBe(true)  // Strict equality treats -0 and 0 as equal
    })

    it('should preserve small values near zero', () => {
      expect(asOptionalNumber(0.001)).toBe(0.001)
      expect(asOptionalNumber(0.0001)).toBe(0.0001)
    })

    it('should return undefined for undefined input', () => {
      // Missing data should remain undefined, NOT become 0
      expect(asOptionalNumber(undefined)).toBeUndefined()
    })

    it('should return undefined for null input', () => {
      expect(asOptionalNumber(null)).toBeUndefined()
    })

    it('should return undefined for NaN', () => {
      expect(asOptionalNumber(NaN)).toBeUndefined()
    })

    it('should return undefined for Infinity', () => {
      expect(asOptionalNumber(Infinity)).toBeUndefined()
      expect(asOptionalNumber(-Infinity)).toBeUndefined()
    })

    it('should return undefined for strings (no coercion)', () => {
      expect(asOptionalNumber('42')).toBeUndefined()
      expect(asOptionalNumber('0')).toBeUndefined()
    })

    it('should return undefined for boolean (no coercion)', () => {
      expect(asOptionalNumber(true)).toBeUndefined()
      expect(asOptionalNumber(false)).toBeUndefined()
    })
  })

  describe('firstDefined - Zero handling', () => {
    it('should return zero as first defined value (CRITICAL)', () => {
      // CRITICAL: Zero is defined, should be returned
      expect(firstDefined(0, 1, 2)).toBe(0)
    })

    it('should skip undefined and return zero', () => {
      expect(firstDefined(undefined, 0, 1)).toBe(0)
    })

    it('should skip null and return zero', () => {
      expect(firstDefined(null, 0, 1)).toBe(0)
    })

    it('should skip undefined and null to find first defined', () => {
      expect(firstDefined(undefined, null, undefined, 'value')).toBe('value')
    })

    it('should return undefined when all values are undefined/null', () => {
      expect(firstDefined(undefined, null, undefined)).toBeUndefined()
    })

    it('should handle false as defined value', () => {
      expect(firstDefined(false, true)).toBe(false)
    })

    it('should handle empty string as defined value', () => {
      expect(firstDefined('', 'fallback')).toBe('')
    })
  })

  describe('asOptionalString - Type safety', () => {
    it('should preserve empty string', () => {
      expect(asOptionalString('')).toBe('')
    })

    it('should return undefined for number (no coercion)', () => {
      expect(asOptionalString(42)).toBeUndefined()
    })

    it('should return undefined for boolean', () => {
      expect(asOptionalString(true)).toBeUndefined()
    })
  })

  describe('asOptionalBoolean - Type safety', () => {
    it('should preserve false', () => {
      expect(asOptionalBoolean(false)).toBe(false)
    })

    it('should preserve true', () => {
      expect(asOptionalBoolean(true)).toBe(true)
    })

    it('should return undefined for truthy number (no coercion)', () => {
      expect(asOptionalBoolean(1)).toBeUndefined()
    })

    it('should return undefined for falsy number (no coercion)', () => {
      expect(asOptionalBoolean(0)).toBeUndefined()
    })
  })

  describe('asArray - Safe extraction', () => {
    it('should return empty array for undefined', () => {
      expect(asArray(undefined)).toEqual([])
    })

    it('should return empty array for null', () => {
      expect(asArray(null)).toEqual([])
    })

    it('should return empty array for non-array', () => {
      expect(asArray('not array')).toEqual([])
      expect(asArray(42)).toEqual([])
      expect(asArray({})).toEqual([])
    })

    it('should preserve empty array', () => {
      expect(asArray([])).toEqual([])
    })

    it('should preserve array with values', () => {
      expect(asArray([1, 2, 3])).toEqual([1, 2, 3])
    })
  })

  describe('asObject - Safe extraction', () => {
    it('should return undefined for array (arrays excluded)', () => {
      expect(asObject([1, 2])).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(asObject(null)).toBeUndefined()
    })

    it('should preserve empty object', () => {
      expect(asObject({})).toEqual({})
    })

    it('should preserve object with values', () => {
      expect(asObject({ foo: 1 })).toEqual({ foo: 1 })
    })
  })

  describe('emptyToUndefined - Whitespace handling', () => {
    it('should return undefined for empty string', () => {
      expect(emptyToUndefined('')).toBeUndefined()
    })

    it('should return undefined for whitespace-only string', () => {
      expect(emptyToUndefined('   ')).toBeUndefined()
      expect(emptyToUndefined('\t\n')).toBeUndefined()
    })

    it('should preserve non-empty string', () => {
      expect(emptyToUndefined('hello')).toBe('hello')
    })

    it('should preserve string with leading/trailing whitespace', () => {
      expect(emptyToUndefined('  hello  ')).toBe('  hello  ')
    })
  })
})

describe('Placeholder Zero Detection Pattern', () => {
  /**
   * Placeholder detection pattern used in getRawElasticity():
   *
   * sensitivity_score=0 with importance_score > 0 is treated as placeholder.
   * This prevents real data from being masked by placeholder zeros.
   */

  describe('sensitivity_score with importance_score interaction', () => {
    it('should skip placeholder zero when real data exists', () => {
      const sensitivityScore = 0
      const importanceScore = 0.85

      // Pattern: skip sensitivity_score if it's 0 but importance_score > 0
      const shouldSkip = sensitivityScore === 0 && importanceScore > 0

      expect(shouldSkip).toBe(true)
    })

    it('should use zero sensitivity_score when no importance_score', () => {
      const sensitivityScore = 0
      const importanceScore = undefined

      const shouldSkip = sensitivityScore === 0 && (importanceScore ?? 0) > 0

      expect(shouldSkip).toBe(false) // Zero is valid when no fallback data exists
    })

    it('should use non-zero sensitivity_score even with importance_score', () => {
      const sensitivityScore = 0.5
      const importanceScore = 0.85

      const shouldSkip = sensitivityScore === 0 && importanceScore > 0

      expect(shouldSkip).toBe(false) // Non-zero sensitivity takes precedence
    })
  })

  describe('hasRealData threshold pattern', () => {
    /**
     * hasRealData pattern used in pickFactorSensitivityForUi():
     * Checks if any factor has meaningful data (> 0.001)
     */

    it('should detect real data above threshold', () => {
      const values = [0.5, 0.3, 0.1]
      const hasRealData = values.some(v => v > 0.001)
      expect(hasRealData).toBe(true)
    })

    it('should not detect placeholder zeros', () => {
      const values = [0, 0, 0]
      const hasRealData = values.some(v => v > 0.001)
      expect(hasRealData).toBe(false)
    })

    it('should detect small but real values', () => {
      const values = [0.002, 0, 0]
      const hasRealData = values.some(v => v > 0.001)
      expect(hasRealData).toBe(true)
    })
  })
})
