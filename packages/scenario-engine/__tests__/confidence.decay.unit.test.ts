import { describe, it, expect } from 'vitest'
import { computeProjection } from '../computeProjection'
import type { OptionInput } from '../types'

describe('scenario-engine confidence decay over time', () => {
  it('decays confidence and widens bands; bands remain ordered', () => {
    const t0 = 1_700_000_000_000
    const halfLife = 14 * 24 * 60 * 60 * 1000
    const options: OptionInput[] = [
      { id: 'a', p: 0.6, c: 1, lastUpdatedMs: t0 },
      { id: 'b', p: 0.4, c: 1, lastUpdatedMs: t0 },
    ]

    const r0 = computeProjection(options, { asOfMs: t0, decayHalfLifeMs: halfLife })
    const r1 = computeProjection(options, { asOfMs: t0 + halfLife, decayHalfLifeMs: halfLife })

    // Ordered bands
    expect(r0.bands.p10).toBeLessThanOrEqual(r0.bands.p50)
    expect(r0.bands.p50).toBeLessThanOrEqual(r0.bands.p90)
    expect(r1.bands.p10).toBeLessThanOrEqual(r1.bands.p50)
    expect(r1.bands.p50).toBeLessThanOrEqual(r1.bands.p90)

    const w0 = r0.bands.p90 - r0.bands.p10
    const w1 = r1.bands.p90 - r1.bands.p10
    // After half-life, effective confidence is lower -> bands widen
    expect(w1).toBeGreaterThanOrEqual(w0)
  })
})
