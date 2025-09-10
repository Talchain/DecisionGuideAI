import { describe, it, expect } from 'vitest'
import { computeProjection, decayConfidence } from '../computeProjection'
import type { OptionInput } from '../types'

const now = 1_700_000_000_000

describe('scenario-engine/computeProjection', () => {
  it('returns zero bands for empty input', () => {
    const r = computeProjection([], { asOfMs: now })
    expect(r.bands.p10).toBe(0)
    expect(r.bands.p50).toBe(0)
    expect(r.bands.p90).toBe(0)
  })

  it('computes p50 as confidence-weighted mean and bands are monotonic', () => {
    const options: OptionInput[] = [
      { id: 'a', p: 0.2, c: 1 },
      { id: 'b', p: 0.8, c: 1 },
    ]
    const r = computeProjection(options, { asOfMs: now })
    expect(r.bands.p50).toBeCloseTo(0.5, 3)
    expect(r.bands.p10).toBeLessThanOrEqual(r.bands.p50)
    expect(r.bands.p50).toBeLessThanOrEqual(r.bands.p90)
    expect(r.bands.p10).toBeGreaterThanOrEqual(0)
    expect(r.bands.p90).toBeLessThanOrEqual(1)
  })

  it('applies soft clamp to avoid exact extremes', () => {
    const options: OptionInput[] = [
      { id: 'a', p: 0, c: 1 },
      { id: 'b', p: 1, c: 1 },
    ]
    const r = computeProjection(options, { asOfMs: now })
    // p50 somewhere near 0.5, bands within (0,1)
    expect(r.bands.p50).toBeGreaterThan(0)
    expect(r.bands.p50).toBeLessThan(1)
    expect(r.bands.p10).toBeGreaterThan(0)
    expect(r.bands.p90).toBeLessThan(1)
  })

  it('confidence decay halves after half-life', () => {
    const halfLife = 7 * 24 * 60 * 60 * 1000
    const c0 = 0.8
    const decayed = decayConfidence(c0, now - halfLife, now, halfLife)
    expect(decayed).toBeCloseTo(c0 * 0.5, 3)
  })

  it('lower confidence widens bands (higher uncertainty)', () => {
    const fresh: OptionInput[] = [
      { id: 'a', p: 0.6, c: 1, lastUpdatedMs: now },
      { id: 'b', p: 0.4, c: 1, lastUpdatedMs: now },
    ]
    const stale: OptionInput[] = [
      { id: 'a', p: 0.6, c: 1, lastUpdatedMs: now - 30 * 24 * 60 * 60 * 1000 },
      { id: 'b', p: 0.4, c: 1, lastUpdatedMs: now - 30 * 24 * 60 * 60 * 1000 },
    ]
    const rFresh = computeProjection(fresh, { asOfMs: now })
    const rStale = computeProjection(stale, { asOfMs: now })
    const widthFresh = rFresh.bands.p90 - rFresh.bands.p10
    const widthStale = rStale.bands.p90 - rStale.bands.p10
    expect(widthStale).toBeGreaterThan(widthFresh - 1e-6)
  })
})
