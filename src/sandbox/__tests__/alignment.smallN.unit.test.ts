import { describe, it, expect } from 'vitest'
import { maxStdDev01, computeAlignmentPRD, alignmentBucket } from '@/sandbox/state/voting'

function ones(n: number): number[] { return Array.from({ length: n }, () => 1) }
function zeros(n: number): number[] { return Array.from({ length: n }, () => 0) }

describe('Alignment small-N behaviour', () => {
  it('maxStdDev01 has expected values for n=2..5', () => {
    // closed-form expectations
    const vals = [2,3,4,5].map(n => maxStdDev01(n))
    expect(vals[0]).toBeCloseTo(0.5, 6) // n=2: [0,1] sd=0.5
    expect(vals[1]).toBeCloseTo(Math.sqrt(2)/3, 6) // n=3: [0,1,1]
    expect(vals[2]).toBeCloseTo(0.5, 6) // n=4: [0,0,1,1] sd=0.5
    expect(vals[3]).toBeGreaterThan(0.4) // approximate
  })

  it('identical votes → score 100 for n=2..5', () => {
    for (let n = 2; n <= 5; n++) {
      const p = ones(n).map(() => 0.5)
      const c = ones(n).map(() => 0.5)
      const { scoreProb, scoreConf, score } = computeAlignmentPRD(p, c)
      expect(scoreProb).toBe(100)
      expect(scoreConf).toBe(100)
      expect(score).toBe(100)
      expect(alignmentBucket(score)).toBe('High')
    }
  })

  it('max dispersion cases → score near 0', () => {
    for (let n = 2; n <= 5; n++) {
      const half = Math.floor(n/2)
      const p = [...zeros(n - half), ...ones(half)]
      const c = [...zeros(n - half), ...ones(half)]
      const { score } = computeAlignmentPRD(p, c)
      expect(score).toBeLessThanOrEqual(5) // near 0
      expect(alignmentBucket(score)).toBe('Low')
    }
  })

  it('bucket thresholds: Low <40, Medium <70, High ≥70', () => {
    expect(alignmentBucket(39)).toBe('Low')
    expect(alignmentBucket(40)).toBe('Medium')
    expect(alignmentBucket(69)).toBe('Medium')
    expect(alignmentBucket(70)).toBe('High')
  })
})
