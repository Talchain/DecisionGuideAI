/**
 * Regression tests for the canonical stability classification utility.
 *
 * Verifies that getStabilityClassification, deriveStabilityLevel, and
 * getStabilityBorderClass produce consistent results at every boundary.
 */

import { describe, it, expect } from 'vitest'
import {
  getStabilityClassification,
  deriveStabilityLevel,
  getStabilityBorderClass,
} from '../stability'

describe('getStabilityClassification', () => {
  it('returns null for undefined/null', () => {
    expect(getStabilityClassification(undefined)).toBeNull()
    expect(getStabilityClassification(null)).toBeNull()
  })

  it('classifies >= 0.80 as high / "Stable result"', () => {
    const c = getStabilityClassification(0.80)!
    expect(c.level).toBe('high')
    expect(c.heroLabel).toBe('Stable result')
    expect(c.badgeLabel).toBe('Robust')
    expect(c.colorClass).toBe('text-success')
    expect(c.borderClass).toBe('border-success/30')
    expect(c.coaching).toBeNull()
  })

  it('classifies 0.55–0.79 as moderate / "Mostly stable"', () => {
    for (const v of [0.55, 0.65, 0.72, 0.79]) {
      const c = getStabilityClassification(v)!
      expect(c.level).toBe('moderate')
      expect(c.heroLabel).toBe('Mostly stable')
      expect(c.badgeLabel).toBe('Moderate')
    }
  })

  it('classifies 0.30–0.54 as low / "Sensitive to assumptions"', () => {
    for (const v of [0.30, 0.40, 0.54]) {
      const c = getStabilityClassification(v)!
      expect(c.level).toBe('low')
      expect(c.heroLabel).toBe('Sensitive to assumptions')
      expect(c.badgeLabel).toBe('Fragile')
    }
  })

  it('classifies < 0.30 as very_low / "Highly sensitive"', () => {
    for (const v of [0.0, 0.15, 0.29]) {
      const c = getStabilityClassification(v)!
      expect(c.level).toBe('very_low')
      expect(c.heroLabel).toBe('Highly sensitive')
      expect(c.badgeLabel).toBe('Very Fragile')
    }
  })

  // C3 regression: stability=0.72 must produce consistent level/label/colour
  it('stability=0.72 produces consistent moderate classification', () => {
    const c = getStabilityClassification(0.72)!
    expect(c.level).toBe('moderate')
    expect(c.heroLabel).toBe('Mostly stable')
    expect(c.badgeLabel).toBe('Moderate')
    expect(c.colorClass).toBe('text-success')
    expect(c.borderClass).toBe('border-info/30')
  })
})

describe('deriveStabilityLevel', () => {
  it('returns undefined for undefined input', () => {
    expect(deriveStabilityLevel(undefined)).toBeUndefined()
  })

  it('returns the same level as getStabilityClassification', () => {
    for (const v of [0.0, 0.29, 0.30, 0.54, 0.55, 0.79, 0.80, 1.0]) {
      expect(deriveStabilityLevel(v)).toBe(
        getStabilityClassification(v)!.level
      )
    }
  })
})

describe('getStabilityBorderClass', () => {
  it('prefers explicit categorical level', () => {
    expect(getStabilityBorderClass('high')).toBe('border-success/30')
    expect(getStabilityBorderClass('moderate')).toBe('border-info/30')
    expect(getStabilityBorderClass('low')).toBe('border-factor/30')
    expect(getStabilityBorderClass('very_low')).toBe('border-factor/30')
  })

  it('falls back to numeric stability when level missing', () => {
    expect(getStabilityBorderClass(undefined, 0.85)).toBe('border-success/30')
    expect(getStabilityBorderClass(undefined, 0.60)).toBe('border-info/30')
    expect(getStabilityBorderClass(undefined, 0.35)).toBe('border-factor/30')
    expect(getStabilityBorderClass(undefined, 0.10)).toBe('border-factor/30')
  })

  it('returns default when both missing', () => {
    expect(getStabilityBorderClass(undefined, undefined)).toBe('border-panel-border')
  })
})
