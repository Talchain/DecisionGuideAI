import { describe, it, expect } from 'vitest'

/**
 * Tests for the influence clamping logic used in DriversSection
 * The actual component clamps influenceScore/normalisedInfluence to [0,1] before display
 */
describe('DriversSection influence clamping', () => {
  // Mirror the clamping logic from DriversSection.tsx
  const clampAndConvertToPercentage = (influence: number): number => {
    const clampedInfluence = Math.max(0, Math.min(1, influence))
    return Math.round(clampedInfluence * 100)
  }

  it('should display 100% for score > 1', () => {
    expect(clampAndConvertToPercentage(1.5)).toBe(100)
    expect(clampAndConvertToPercentage(2.0)).toBe(100)
    expect(clampAndConvertToPercentage(150)).toBe(100)
  })

  it('should display 0% for score < 0', () => {
    expect(clampAndConvertToPercentage(-0.5)).toBe(0)
    expect(clampAndConvertToPercentage(-1)).toBe(0)
    expect(clampAndConvertToPercentage(-100)).toBe(0)
  })

  it('should display correct percentage for score in [0,1]', () => {
    expect(clampAndConvertToPercentage(0)).toBe(0)
    expect(clampAndConvertToPercentage(0.5)).toBe(50)
    expect(clampAndConvertToPercentage(0.73)).toBe(73)
    expect(clampAndConvertToPercentage(1)).toBe(100)
  })

  it('should round to nearest integer', () => {
    expect(clampAndConvertToPercentage(0.456)).toBe(46)
    expect(clampAndConvertToPercentage(0.454)).toBe(45)
    expect(clampAndConvertToPercentage(0.995)).toBe(100)
  })
})
