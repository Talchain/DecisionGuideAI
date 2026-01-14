/**
 * Tests for Expected Value Helpers
 */

import { describe, it, expect } from 'vitest'
import {
  getExpectedValue,
  getMedian,
  getPessimistic,
  getOptimistic,
  isSkewedDistribution,
} from '../getExpectedValue'
import type { OptionResult } from '../../types'

// Helper to create minimal OptionResult for testing
function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'test',
    label: 'Test Option',
    expected: null,
    outcome: {
      mean: null,
      p10: null,
      p50: null,
      p90: null,
    },
    p10: 0,
    p50: 0,
    p90: 0,
    isRecommended: false,
    ...overrides,
  }
}

describe('getExpectedValue', () => {
  it('returns explicit expected value when present', () => {
    const option = makeOption({ expected: 0.038 })
    expect(getExpectedValue(option)).toBe(0.038)
  })

  it('falls back to outcome.mean when expected is null', () => {
    const option = makeOption({
      expected: null,
      outcome: { mean: 0.05, p10: null, p50: null, p90: null },
    })
    expect(getExpectedValue(option)).toBe(0.05)
  })

  it('returns null when no expected value available', () => {
    const option = makeOption()
    expect(getExpectedValue(option)).toBeNull()
  })

  it('does NOT fall back to p50 (median)', () => {
    // This is the key semantic distinction — expected !== median
    const option = makeOption({
      expected: null,
      outcome: { mean: null, p10: null, p50: 0.5, p90: null },
    })
    expect(getExpectedValue(option)).toBeNull()
  })
})

describe('getMedian', () => {
  it('returns p50 when present', () => {
    const option = makeOption({
      outcome: { mean: null, p10: null, p50: 0.05, p90: null },
    })
    expect(getMedian(option)).toBe(0.05)
  })

  it('returns null when p50 not available', () => {
    const option = makeOption()
    expect(getMedian(option)).toBeNull()
  })
})

describe('getPessimistic', () => {
  it('returns p10 when present', () => {
    const option = makeOption({
      outcome: { mean: null, p10: -0.02, p50: null, p90: null },
    })
    expect(getPessimistic(option)).toBe(-0.02)
  })

  it('returns null when p10 not available', () => {
    const option = makeOption()
    expect(getPessimistic(option)).toBeNull()
  })
})

describe('getOptimistic', () => {
  it('returns p90 when present', () => {
    const option = makeOption({
      outcome: { mean: null, p10: null, p50: null, p90: 0.15 },
    })
    expect(getOptimistic(option)).toBe(0.15)
  })

  it('returns null when p90 not available', () => {
    const option = makeOption()
    expect(getOptimistic(option)).toBeNull()
  })
})

describe('isSkewedDistribution', () => {
  it('returns true when expected and median differ significantly', () => {
    // Example: mean=3.8%, p50=0% (positively skewed)
    const option = makeOption({
      expected: 0.038,
      outcome: { mean: 0.038, p10: null, p50: 0, p90: null },
    })
    expect(isSkewedDistribution(option)).toBe(true)
  })

  it('returns false when expected and median are similar', () => {
    // Symmetric distribution
    const option = makeOption({
      expected: 0.10,
      outcome: { mean: 0.10, p10: null, p50: 0.10, p90: null },
    })
    expect(isSkewedDistribution(option)).toBe(false)
  })

  it('returns false when expected is null', () => {
    const option = makeOption({
      outcome: { mean: null, p10: null, p50: 0.5, p90: null },
    })
    expect(isSkewedDistribution(option)).toBe(false)
  })

  it('returns false when median is null', () => {
    const option = makeOption({
      expected: 0.5,
    })
    expect(isSkewedDistribution(option)).toBe(false)
  })

  it('uses custom threshold', () => {
    // Difference is 0.005 (0.5%)
    const option = makeOption({
      expected: 0.105,
      outcome: { mean: 0.105, p10: null, p50: 0.10, p90: null },
    })
    // Default threshold (0.01) — not skewed
    expect(isSkewedDistribution(option)).toBe(false)
    // Lower threshold (0.001) — now considered skewed
    expect(isSkewedDistribution(option, 0.001)).toBe(true)
  })
})
