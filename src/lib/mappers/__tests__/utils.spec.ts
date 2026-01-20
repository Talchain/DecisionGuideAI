/**
 * Mapper Utilities Tests
 *
 * Tests boundary parse functions that prevent regression classes.
 */

import { describe, it, expect } from 'vitest'
import {
  asOptionalNumber,
  asOptionalString,
  asOptionalBoolean,
  asArray,
  asObject,
  emptyToUndefined,
  firstDefined,
  normaliseDirection,
  normaliseRobustnessLevel,
  normaliseLabel,
} from '../utils'

describe('asOptionalNumber', () => {
  it('returns number when input is valid finite number', () => {
    expect(asOptionalNumber(42)).toBe(42)
    expect(asOptionalNumber(0.5)).toBe(0.5)
    expect(asOptionalNumber(-10)).toBe(-10)
  })

  it('CRITICAL: returns 0 when input is 0 (real zero preserved)', () => {
    expect(asOptionalNumber(0)).toBe(0)
    expect(asOptionalNumber(0)).not.toBeUndefined()
  })

  it('returns undefined for undefined/null', () => {
    expect(asOptionalNumber(undefined)).toBeUndefined()
    expect(asOptionalNumber(null)).toBeUndefined()
  })

  it('returns undefined for NaN', () => {
    expect(asOptionalNumber(NaN)).toBeUndefined()
  })

  it('returns undefined for Infinity', () => {
    expect(asOptionalNumber(Infinity)).toBeUndefined()
    expect(asOptionalNumber(-Infinity)).toBeUndefined()
  })

  it('returns undefined for non-numeric types (no coercion)', () => {
    expect(asOptionalNumber('42')).toBeUndefined()
    expect(asOptionalNumber('0.5')).toBeUndefined()
    expect(asOptionalNumber(true)).toBeUndefined()
    expect(asOptionalNumber([])).toBeUndefined()
    expect(asOptionalNumber({})).toBeUndefined()
  })
})

describe('asOptionalString', () => {
  it('returns string when input is string', () => {
    expect(asOptionalString('hello')).toBe('hello')
  })

  it('preserves empty string', () => {
    expect(asOptionalString('')).toBe('')
  })

  it('returns undefined for non-strings', () => {
    expect(asOptionalString(undefined)).toBeUndefined()
    expect(asOptionalString(null)).toBeUndefined()
    expect(asOptionalString(42)).toBeUndefined()
    expect(asOptionalString(true)).toBeUndefined()
    expect(asOptionalString([])).toBeUndefined()
    expect(asOptionalString({})).toBeUndefined()
  })
})

describe('asOptionalBoolean', () => {
  it('returns boolean when input is boolean', () => {
    expect(asOptionalBoolean(true)).toBe(true)
    expect(asOptionalBoolean(false)).toBe(false)
  })

  it('returns undefined for non-booleans (no coercion)', () => {
    expect(asOptionalBoolean(undefined)).toBeUndefined()
    expect(asOptionalBoolean(null)).toBeUndefined()
    expect(asOptionalBoolean(1)).toBeUndefined()
    expect(asOptionalBoolean(0)).toBeUndefined()
    expect(asOptionalBoolean('true')).toBeUndefined()
  })
})

describe('asArray', () => {
  it('returns array when input is array', () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3])
    expect(asArray([])).toEqual([])
  })

  it('returns empty array for non-arrays', () => {
    expect(asArray(undefined)).toEqual([])
    expect(asArray(null)).toEqual([])
    expect(asArray('not array')).toEqual([])
    expect(asArray(42)).toEqual([])
    expect(asArray({})).toEqual([])
  })
})

describe('asObject', () => {
  it('returns object when input is plain object', () => {
    expect(asObject({ foo: 1 })).toEqual({ foo: 1 })
    expect(asObject({})).toEqual({})
  })

  it('returns undefined for undefined/null', () => {
    expect(asObject(undefined)).toBeUndefined()
    expect(asObject(null)).toBeUndefined()
  })

  it('returns undefined for arrays (excluded)', () => {
    expect(asObject([1, 2])).toBeUndefined()
  })

  it('returns undefined for primitives', () => {
    expect(asObject('string')).toBeUndefined()
    expect(asObject(42)).toBeUndefined()
    expect(asObject(true)).toBeUndefined()
  })
})

describe('emptyToUndefined', () => {
  it('returns string when non-empty', () => {
    expect(emptyToUndefined('hello')).toBe('hello')
  })

  it('returns undefined for empty string', () => {
    expect(emptyToUndefined('')).toBeUndefined()
  })

  it('returns undefined for whitespace-only string', () => {
    expect(emptyToUndefined('   ')).toBeUndefined()
    expect(emptyToUndefined('\t\n')).toBeUndefined()
  })

  it('returns undefined when input is undefined', () => {
    expect(emptyToUndefined(undefined)).toBeUndefined()
  })
})

describe('firstDefined', () => {
  it('returns first defined value', () => {
    expect(firstDefined(undefined, null, 'value')).toBe('value')
    expect(firstDefined('first', 'second')).toBe('first')
  })

  it('returns 0 when 0 is defined (not skipped)', () => {
    expect(firstDefined(undefined, 0, 1)).toBe(0)
  })

  it('returns false when false is defined (not skipped)', () => {
    expect(firstDefined(undefined, false, true)).toBe(false)
  })

  it('returns empty string when defined (not skipped)', () => {
    expect(firstDefined(undefined, '', 'fallback')).toBe('')
  })

  it('returns undefined when all values are undefined/null', () => {
    expect(firstDefined(undefined, null, undefined)).toBeUndefined()
  })
})

describe('normaliseDirection', () => {
  it('normalises positive variants', () => {
    expect(normaliseDirection('positive')).toBe('positive')
    expect(normaliseDirection('POSITIVE')).toBe('positive')
    expect(normaliseDirection('pos')).toBe('positive')
    expect(normaliseDirection('+')).toBe('positive')
    expect(normaliseDirection('increase')).toBe('positive')
    expect(normaliseDirection('up')).toBe('positive')
  })

  it('normalises negative variants', () => {
    expect(normaliseDirection('negative')).toBe('negative')
    expect(normaliseDirection('NEGATIVE')).toBe('negative')
    expect(normaliseDirection('neg')).toBe('negative')
    expect(normaliseDirection('-')).toBe('negative')
    expect(normaliseDirection('decrease')).toBe('negative')
    expect(normaliseDirection('down')).toBe('negative')
  })

  it('returns undefined for unknown values', () => {
    expect(normaliseDirection('sideways')).toBeUndefined()
    expect(normaliseDirection('unknown')).toBeUndefined()
  })

  it('returns undefined for undefined/empty', () => {
    expect(normaliseDirection(undefined)).toBeUndefined()
    expect(normaliseDirection('')).toBeUndefined()
  })
})

describe('normaliseRobustnessLevel', () => {
  it('normalises standard levels', () => {
    expect(normaliseRobustnessLevel('high')).toBe('high')
    expect(normaliseRobustnessLevel('moderate')).toBe('moderate')
    expect(normaliseRobustnessLevel('low')).toBe('low')
    expect(normaliseRobustnessLevel('very_low')).toBe('very_low')
  })

  it('handles case insensitivity', () => {
    expect(normaliseRobustnessLevel('HIGH')).toBe('high')
    expect(normaliseRobustnessLevel('Moderate')).toBe('moderate')
  })

  it('normalises hyphenated format', () => {
    expect(normaliseRobustnessLevel('very-low')).toBe('very_low')
  })

  it('handles medium alias', () => {
    expect(normaliseRobustnessLevel('medium')).toBe('moderate')
  })

  it('returns undefined for unknown values', () => {
    expect(normaliseRobustnessLevel('extreme')).toBeUndefined()
    expect(normaliseRobustnessLevel(undefined)).toBeUndefined()
  })
})

describe('normaliseLabel', () => {
  it('converts to lowercase with underscores', () => {
    expect(normaliseLabel('Pro Plan Price')).toBe('pro_plan_price')
  })

  it('collapses multiple spaces', () => {
    expect(normaliseLabel('Market  Competition')).toBe('market_competition')
  })

  it('returns "unknown" for undefined', () => {
    expect(normaliseLabel(undefined)).toBe('unknown')
  })
})
