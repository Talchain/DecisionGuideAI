import { describe, it, expect } from 'vitest'
import {
  formatProbabilityWithResolution,
  isAboveSimulationResolution,
  isBelowSimulationResolution,
} from '../formatPercent'

/**
 * Display-honesty workstream — sample-resolution display formatter.
 *
 * Raw probability values are preserved by the caller; only the displayed
 * string changes. These tests pin the boundary cases (exact 0, exact 1,
 * threshold scaling with N) and the legacy fallback when no sample count
 * is available.
 */
describe('formatProbabilityWithResolution', () => {
  describe('boundary cases at n=1000', () => {
    it('renders exact 0 as <0.1%, never as 0%', () => {
      expect(formatProbabilityWithResolution(0, 1000)).toBe('<0.1%')
    })

    it('renders exact 1 as >99.9%, never as 100%', () => {
      expect(formatProbabilityWithResolution(1, 1000)).toBe('>99.9%')
    })

    it('renders a small non-zero value below the threshold as <0.1%', () => {
      expect(formatProbabilityWithResolution(0.0005, 1000)).toBe('<0.1%')
    })

    it('renders one observed win in 1000 as 0.1%, never as 0%', () => {
      // 0.001 = 1/1000: a SINGLE observed win must not collapse to "0%",
      // which would be visually identical to "below resolution".
      expect(formatProbabilityWithResolution(0.001, 1000)).toBe('0.1%')
    })

    it('renders 999 wins in 1000 as 99.9%, never as 100%', () => {
      // Symmetric guard at the upper boundary.
      expect(formatProbabilityWithResolution(0.999, 1000)).toBe('99.9%')
    })

    it('renders a typical mid-range probability normally (no spurious decimals)', () => {
      expect(formatProbabilityWithResolution(0.58, 1000)).toBe('58%')
    })
  })

  describe('threshold scales with sample count', () => {
    it('renders <0.01% at n=10000 for exact 0', () => {
      expect(formatProbabilityWithResolution(0, 10000)).toBe('<0.01%')
    })

    it('renders >99.99% at n=10000 for exact 1', () => {
      expect(formatProbabilityWithResolution(1, 10000)).toBe('>99.99%')
    })

    it('renders <1% at n=100 for exact 0', () => {
      expect(formatProbabilityWithResolution(0, 100)).toBe('<1%')
    })

    it('renders >99% at n=100 for exact 1', () => {
      expect(formatProbabilityWithResolution(1, 100)).toBe('>99%')
    })
  })

  describe('legacy fallback when sample count is unavailable', () => {
    it('falls back to normal percent formatting when nSamples is undefined', () => {
      expect(formatProbabilityWithResolution(0.42, undefined)).toBe('42%')
    })

    it('falls back when nSamples is null', () => {
      expect(formatProbabilityWithResolution(0.42, null)).toBe('42%')
    })

    it('falls back when nSamples is zero (treats as unavailable, never divides by zero)', () => {
      expect(formatProbabilityWithResolution(0.42, 0)).toBe('42%')
    })

    it('falls back when nSamples is negative (treats as unavailable)', () => {
      expect(formatProbabilityWithResolution(0.42, -100)).toBe('42%')
    })

    it('preserves the prior 0%/100% rendering when no sample count is supplied — backward-compatible at boundaries', () => {
      // Without resolution context, exact 0 still renders as 0% (legacy formatPct).
      // The resolution-aware behaviour only kicks in when nSamples is provided.
      expect(formatProbabilityWithResolution(0, undefined)).toBe('0%')
      expect(formatProbabilityWithResolution(1, undefined)).toBe('100%')
    })
  })
})

describe('isBelowSimulationResolution', () => {
  it('is true for exact 0 at n=1000', () => {
    expect(isBelowSimulationResolution(0, 1000)).toBe(true)
  })

  it('is false for typical mid-range values', () => {
    expect(isBelowSimulationResolution(0.5, 1000)).toBe(false)
  })

  it('is false at the boundary value 1/n', () => {
    expect(isBelowSimulationResolution(0.001, 1000)).toBe(false)
  })

  it('is false when nSamples is unavailable, even for exact 0', () => {
    expect(isBelowSimulationResolution(0, undefined)).toBe(false)
    expect(isBelowSimulationResolution(0, null)).toBe(false)
    expect(isBelowSimulationResolution(0, 0)).toBe(false)
  })
})

describe('isAboveSimulationResolution', () => {
  it('is true for exact 1 at n=1000', () => {
    expect(isAboveSimulationResolution(1, 1000)).toBe(true)
  })

  it('is false for typical mid-range values', () => {
    expect(isAboveSimulationResolution(0.5, 1000)).toBe(false)
  })

  it('is false at the boundary value 1 - 1/n', () => {
    expect(isAboveSimulationResolution(0.999, 1000)).toBe(false)
  })

  it('is false when nSamples is unavailable, even for exact 1', () => {
    expect(isAboveSimulationResolution(1, undefined)).toBe(false)
  })
})
