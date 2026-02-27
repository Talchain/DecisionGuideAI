import { describe, it, expect } from 'vitest'
import {
  getConfidenceCoaching,
  getEffectSizeCoaching,
  shouldShowInfluenceCoaching,
} from '../coachingText'

// ---------------------------------------------------------------------------
// D.2: getConfidenceCoaching
// ---------------------------------------------------------------------------
describe('getConfidenceCoaching', () => {
  it('returns danger for 0% (very low)', () => {
    const r = getConfidenceCoaching(0)
    expect(r.colorClass).toBe('text-danger')
    expect(r.text).toContain('mostly ignored')
  })

  it('returns danger for exactly 15%', () => {
    expect(getConfidenceCoaching(0.15).colorClass).toBe('text-danger')
  })

  it('returns warning for 16% (low)', () => {
    const r = getConfidenceCoaching(0.16)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('uncertain')
  })

  it('returns warning for exactly 39%', () => {
    expect(getConfidenceCoaching(0.39).colorClass).toBe('text-warning')
  })

  it('returns muted for 40% (moderate)', () => {
    const r = getConfidenceCoaching(0.40)
    expect(r.colorClass).toBe('text-text-light')
    expect(r.text).toContain('reasonable starting point')
  })

  it('returns muted for 50%', () => {
    expect(getConfidenceCoaching(0.5).colorClass).toBe('text-text-light')
  })

  it('returns muted for exactly 69%', () => {
    expect(getConfidenceCoaching(0.69).colorClass).toBe('text-text-light')
  })

  it('returns muted for 70% (high)', () => {
    const r = getConfidenceCoaching(0.70)
    expect(r.colorClass).toBe('text-text-light')
    expect(r.text).toContain('rely heavily')
  })

  it('returns muted for 80%', () => {
    expect(getConfidenceCoaching(0.80).colorClass).toBe('text-text-light')
  })

  it('returns muted for exactly 89%', () => {
    expect(getConfidenceCoaching(0.89).colorClass).toBe('text-text-light')
  })

  it('returns warning for 90% (very high)', () => {
    const r = getConfidenceCoaching(0.90)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('consider lowering')
  })

  it('returns warning for 95%', () => {
    expect(getConfidenceCoaching(0.95).colorClass).toBe('text-warning')
  })

  it('returns warning for 100%', () => {
    expect(getConfidenceCoaching(1.0).colorClass).toBe('text-warning')
  })
})

// ---------------------------------------------------------------------------
// D.2: getEffectSizeCoaching
// ---------------------------------------------------------------------------
describe('getEffectSizeCoaching', () => {
  it('returns negligible for 0', () => {
    const r = getEffectSizeCoaching(0)
    expect(r.text).toContain('Negligible')
    expect(r.colorClass).toBe('text-text-light')
  })

  it('returns negligible for exactly 0.1', () => {
    expect(getEffectSizeCoaching(0.1).text).toContain('Negligible')
  })

  it('returns moderate for 0.11', () => {
    expect(getEffectSizeCoaching(0.11).text).toBe('Moderate effect.')
  })

  it('returns moderate for 0.3', () => {
    expect(getEffectSizeCoaching(0.3).text).toBe('Moderate effect.')
  })

  it('returns moderate for exactly 0.4', () => {
    expect(getEffectSizeCoaching(0.4).text).toBe('Moderate effect.')
  })

  it('returns strong for 0.41', () => {
    const r = getEffectSizeCoaching(0.41)
    expect(r.text).toContain('significantly shift')
    expect(r.colorClass).toBe('text-text-light')
  })

  it('returns strong for exactly 0.7', () => {
    expect(getEffectSizeCoaching(0.7).text).toContain('significantly shift')
  })

  it('returns very strong (warning) for 0.71', () => {
    const r = getEffectSizeCoaching(0.71)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('few real-world')
  })

  it('returns very strong for 0.8', () => {
    expect(getEffectSizeCoaching(0.8).colorClass).toBe('text-warning')
  })

  it('returns very strong for exactly 0.9', () => {
    expect(getEffectSizeCoaching(0.9).text).toContain('few real-world')
  })

  it('returns near-total (warning) for 0.91', () => {
    const r = getEffectSizeCoaching(0.91)
    expect(r.colorClass).toBe('text-warning')
    expect(r.text).toContain('Near-total')
  })

  it('returns near-total for 1.0', () => {
    expect(getEffectSizeCoaching(1.0).text).toContain('Near-total')
  })
})

// ---------------------------------------------------------------------------
// D.3: shouldShowInfluenceCoaching
// ---------------------------------------------------------------------------
describe('shouldShowInfluenceCoaching', () => {
  it('returns true when rank=1, fragile, confidence < 0.7', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.5)).toBe(true)
  })

  it('returns true at confidence boundary 0.69', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.69)).toBe(true)
  })

  it('returns false when rank=2', () => {
    expect(shouldShowInfluenceCoaching(2, true, 0.5)).toBe(false)
  })

  it('returns false when rank=3', () => {
    expect(shouldShowInfluenceCoaching(3, true, 0.3)).toBe(false)
  })

  it('returns false when not fragile', () => {
    expect(shouldShowInfluenceCoaching(1, false, 0.5)).toBe(false)
  })

  it('returns false when confidence >= 0.7', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0.7)).toBe(false)
  })

  it('returns false when confidence is null', () => {
    expect(shouldShowInfluenceCoaching(1, true, null)).toBe(false)
  })

  it('returns false when rank is null', () => {
    expect(shouldShowInfluenceCoaching(null, true, 0.5)).toBe(false)
  })

  it('returns true when confidence is 0 (valid low)', () => {
    expect(shouldShowInfluenceCoaching(1, true, 0)).toBe(true)
  })
})
