/**
 * Sci-4B verbal uncertainty calibration — pure mapper tests.
 *
 * RED fixtures per tier + the honest-render "say nothing" absent-field case.
 */

import { describe, it, expect } from 'vitest'
import { calibrateUncertaintyCopy } from '../uncertaintyCalibration'

describe('calibrateUncertaintyCopy', () => {
  it('high robustness + tight interval (no zero-straddle) → fairly confident', () => {
    const result = calibrateUncertaintyCopy({
      robustnessLevel: 'high',
      p10: 0.2,
      p90: 0.5,
    })
    expect(result).toEqual({ tier: 'confident', text: 'This result looks fairly confident.' })
  })

  it('high robustness via robustnessLabel="robust" fallback → fairly confident', () => {
    const result = calibrateUncertaintyCopy({
      robustnessLabel: 'robust',
      p10: 0.2,
      p90: 0.5,
    })
    expect(result?.tier).toBe('confident')
  })

  it('high robustness with no interval fields present → still confident (interval check only downgrades, never blocks)', () => {
    const result = calibrateUncertaintyCopy({ robustnessLevel: 'high' })
    expect(result).toEqual({ tier: 'confident', text: 'This result looks fairly confident.' })
  })

  it('high robustness BUT interval straddles zero → downgraded to moderate framing', () => {
    const result = calibrateUncertaintyCopy({
      robustnessLevel: 'high',
      p10: -0.1,
      p90: 0.3,
    })
    expect(result).toEqual({
      tier: 'moderate',
      text: "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    })
  })

  it('moderate robustness → meaningful-uncertainty framing regardless of interval', () => {
    const result = calibrateUncertaintyCopy({
      robustnessLevel: 'moderate',
      p10: 0.1,
      p90: 0.2,
    })
    expect(result).toEqual({
      tier: 'moderate',
      text: "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    })
  })

  it('moderate robustness via robustnessLabel="moderate" fallback', () => {
    const result = calibrateUncertaintyCopy({ robustnessLabel: 'moderate' })
    expect(result?.tier).toBe('moderate')
  })

  it('low robustness → tentative framing', () => {
    const result = calibrateUncertaintyCopy({ robustnessLevel: 'low' })
    expect(result).toEqual({
      tier: 'tentative',
      text: 'This result is tentative. The uncertainty is substantial.',
    })
  })

  it('very_low robustness → tentative framing', () => {
    const result = calibrateUncertaintyCopy({ robustnessLevel: 'very_low' })
    expect(result?.tier).toBe('tentative')
  })

  it('fragile robustnessLabel fallback → tentative framing', () => {
    const result = calibrateUncertaintyCopy({ robustnessLabel: 'fragile' })
    expect(result?.tier).toBe('tentative')
  })

  it('honest-render: no robustness signal on the wire at all → null (say nothing, never invent)', () => {
    expect(calibrateUncertaintyCopy({})).toBeNull()
    expect(calibrateUncertaintyCopy({ p10: 0.1, p90: 0.2 })).toBeNull()
  })

  it('unrecognised robustness level/label strings → null (never guess a tier from an unknown token)', () => {
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'unknown_token' })).toBeNull()
  })

  it('level takes precedence over label when both present', () => {
    const result = calibrateUncertaintyCopy({ robustnessLevel: 'low', robustnessLabel: 'robust' })
    expect(result?.tier).toBe('tentative')
  })
})
