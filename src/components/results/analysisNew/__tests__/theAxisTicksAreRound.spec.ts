/**
 * THE AXIS TICKS ARE ROUND (V2 prototype `chartHTML()`: 0% · 10% · 20% · 30%).
 * Served 1a8afc11 (Panel's prototype comparison, 26 Sep 2026) read
 * "0 · 0.0463 · 0.0925 · 0.139": four ticks at thirds of the raw data range.
 */
import { describe, expect, it } from 'vitest'
import { niceDomain } from '../comparisonLens'

const ticks = (lo: number, hi: number) => [...(niceDomain(lo, hi).ticks ?? [])]

describe('the outcome axis reads in round steps', () => {
  it("⭐ served shape: 0 … 0.139 reads 0 · 0.05 · 0.1 · 0.15, not 0 · 0.0463 · 0.0925 · 0.139", () => {
    expect(ticks(0, 0.139)).toEqual([0, 0.05, 0.1, 0.15])
  })

  it('a range crossing zero keeps zero on a tick (-0.163 … 0.211 → -0.2 · 0 · 0.2 · 0.4)', () => {
    expect(ticks(-0.163, 0.211)).toEqual([-0.2, 0, 0.2, 0.4])
  })

  it('large magnitudes step roundly (0 … 423,333 → 0 · 150K · 300K · 450K)', () => {
    expect(ticks(0, 423_333)).toEqual([0, 150_000, 300_000, 450_000])
  })

  it('INVARIANT over a sweep: the domain contains the data, widens by less than 2×, and every tick is round', () => {
    for (const [lo, hi] of [[0, 0.16], [0.012, 0.087], [-5, 17], [3.2, 3.9], [0, 1], [-0.9, -0.1], [120, 4_870]]) {
      const d = niceDomain(lo, hi)
      expect(d.lo).toBeLessThanOrEqual(lo)
      expect(d.hi).toBeGreaterThanOrEqual(hi - 1e-12)
      expect(d.span / (hi - lo)).toBeLessThan(2.01)
      const step = d.span / 3
      const mant = Number((step / Math.pow(10, Math.floor(Math.log10(step)))).toPrecision(6))
      expect([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]).toContain(mant)
    }
  })
})
