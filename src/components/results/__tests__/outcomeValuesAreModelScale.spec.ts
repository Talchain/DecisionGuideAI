import { describe, it, expect } from 'vitest'
import { outcomeValuesAreModelScale, MODEL_SCALE_MAX_ABS } from '../outcomeValuesAreModelScale'

describe('outcomeValuesAreModelScale — the one model-scale authority (R&C #2133 B1)', () => {
  it('the threshold is the results hook pre-scan\'s own (|v| ≤ 2)', () => {
    expect(MODEL_SCALE_MAX_ABS).toBe(2)
  })
  it('a propagated model-scale domain past ±1 is model scale', () => {
    expect(outcomeValuesAreModelScale([-1.3, 0.4])).toBe(true)
    expect(outcomeValuesAreModelScale([-0.487, 0.029])).toBe(true)
  })
  it('a real magnitude is not', () => {
    expect(outcomeValuesAreModelScale([190000, 890000])).toBe(false)
    expect(outcomeValuesAreModelScale([2.01])).toBe(false)
  })
  it('non-finite and non-numeric entries count as 0, exactly as the original pre-scan', () => {
    expect(outcomeValuesAreModelScale([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, 'x', 0.5])).toBe(true)
    expect(outcomeValuesAreModelScale([])).toBe(true)
  })
})
