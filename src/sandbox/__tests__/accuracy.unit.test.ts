import { describe, it, expect } from 'vitest'
import { mape, brier } from '@/sandbox/metrics/accuracy'

describe('Accuracy metrics', () => {
  it('MAPE handles zeros and returns percent', () => {
    expect(mape([100, 200, 300], [110, 210, 330])).toBeCloseTo(((10/100)+(10/200)+(30/300))/3*100, 6)
    // zero actuals guarded by eps
    const res = mape([0, 0], [1, 2])
    expect(Number.isFinite(res)).toBe(true)
  })

  it('Brier score clamps probabilities and averages squared error', () => {
    expect(brier([0.7, 0.2, 0.9], [1, 0, 1])).toBeCloseTo(((0.3*0.3)+(0.2*0.2)+(0.1*0.1))/3, 6)
    expect(brier([-1, 2], [0, 1])).toBeLessThanOrEqual(1)
  })
})
