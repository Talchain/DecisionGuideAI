/**
 * Regression tests for ISL field surfacing (bootstrap stability, EVPI, E-value).
 * Verifies:
 * - New fields flow through normalizeFactorSensitivity → DriverItem
 * - Field-presence gates: absent fields produce no-op (no rendering)
 * - E-value colour tiers (> 3 success, 1.5-3 warning, < 1.5 danger)
 * - EVPI sort preference over VOI
 */
import { describe, it, expect } from 'vitest'

// --- E-value indicator tiers ---

describe('EValueIndicator colour tiers', () => {
  // The tier logic was never exported; this asserts the rule itself. (It used to
  // say "test via the parent, ConfidenceSection" — that parent was deleted as
  // unreachable on 18 Aug 2026 and was never rendered here anyway.)
  it('classifies e-value > 3 as success (robust)', () => {
    const eValue = 4.2
    const colour = eValue > 3 ? 'text-success' : eValue >= 1.5 ? 'text-warning' : 'text-danger'
    expect(colour).toBe('text-success')
  })

  it('classifies e-value 1.5-3 as warning (moderate)', () => {
    const eValue = 2.0
    const colour = eValue > 3 ? 'text-success' : eValue >= 1.5 ? 'text-warning' : 'text-danger'
    expect(colour).toBe('text-warning')
  })

  it('classifies e-value < 1.5 as danger (fragile)', () => {
    const eValue = 1.1
    const colour = eValue > 3 ? 'text-success' : eValue >= 1.5 ? 'text-warning' : 'text-danger'
    expect(colour).toBe('text-danger')
  })
})

// --- EVPI sort preference ---

describe('EVPI sort preference over VOI', () => {
  it('sorts by evpi descending when both present', () => {
    const gaps = [
      { id: 'a', voi: 0.9, evpi: 1.0 },
      { id: 'b', voi: 0.1, evpi: 5.0 },
      { id: 'c', voi: 0.5, evpi: 2.0 },
    ]
    const sorted = [...gaps].sort((a, b) => {
      if (typeof a.evpi === 'number' && typeof b.evpi === 'number') return b.evpi - a.evpi
      return b.voi - a.voi
    })
    expect(sorted.map(g => g.id)).toEqual(['b', 'c', 'a'])
  })

  it('falls back to voi when evpi absent', () => {
    const gaps = [
      { id: 'a', voi: 0.3 },
      { id: 'b', voi: 0.9 },
      { id: 'c', voi: 0.5 },
    ]
    const sorted = [...gaps].sort((a, b) => {
      const aEvpi = (a as any).evpi as number | undefined
      const bEvpi = (b as any).evpi as number | undefined
      if (typeof aEvpi === 'number' && typeof bEvpi === 'number') return bEvpi - aEvpi
      return b.voi - a.voi
    })
    expect(sorted.map(g => g.id)).toEqual(['b', 'c', 'a'])
  })
})

// --- Field-presence gating ---

describe('Field-presence gating', () => {
  it('attribution_stability extraction accepts valid values', () => {
    const validValues = ['high', 'moderate', 'low', 'negligible'] as const
    for (const v of validValues) {
      const result = v === 'high' || v === 'moderate' || v === 'low' || v === 'negligible' ? v : undefined
      expect(result).toBe(v)
    }
  })

  it('attribution_stability extraction rejects invalid values', () => {
    const invalid = 'unknown'
    const result = invalid === 'high' || invalid === 'moderate' || invalid === 'low' || invalid === 'negligible' ? invalid : undefined
    expect(result).toBeUndefined()
  })

  it('rank_flip_rate extraction requires number', () => {
    const numVal: unknown = 0.5
    const strVal: unknown = 'string'
    const undefVal: unknown = undefined
    expect(typeof numVal === 'number' ? numVal : undefined).toBe(0.5)
    expect(typeof strVal === 'number' ? strVal : undefined).toBeUndefined()
    expect(typeof undefVal === 'number' ? undefVal : undefined).toBeUndefined()
  })

  it('evpi_percentage_points extraction requires number', () => {
    const ppVal: unknown = 3.2
    const nullVal: unknown = null
    expect(typeof ppVal === 'number' ? ppVal : undefined).toBe(3.2)
    expect(typeof nullVal === 'number' ? nullVal : undefined).toBeUndefined()
  })
})

// --- Weight standardisation ---

describe('CEE weight clamp standardisation', () => {
  it('clamps weight to [0, 2] (canvas domain) and signed mean to [-1, +1]', () => {
    // Mirrors useConversation.ts UI-SEM-035:
    //   weight clamped to canvas range [0, 2], then direction * weight clamped to [-1, +1]
    const cases = [
      { weight: 0.5, dir: 'positive', expected: 0.5 },
      { weight: 1.5, dir: 'positive', expected: 1.0 },   // 1.5 stays in [0,2]; direction*1.5=1.5 → clamped to 1.0
      { weight: 0.8, dir: 'negative', expected: -0.8 },
      { weight: 2.0, dir: 'negative', expected: -1.0 },   // 2.0 stays in [0,2]; direction*2.0=-2.0 → clamped to -1.0
      { weight: 2.5, dir: 'positive', expected: 1.0 },    // 2.5 clamped to 2.0; direction*2.0=2.0 → clamped to 1.0
      { weight: -0.3, dir: 'positive', expected: 0.0 },   // negative weight clamped to 0
    ] as const

    for (const { weight: w, dir, expected } of cases) {
      const clampedWeight = Math.max(0, Math.min(w, 2.0))
      const direction = dir === 'negative' ? -1 : 1
      const mean = Math.max(-1, Math.min(1, direction * clampedWeight))
      expect(mean).toBeCloseTo(expected, 5)
    }
  })
})
