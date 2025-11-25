import { describe, it, expect } from 'vitest'
import {
  beliefToConfidencePercent,
  confidencePercentToBelief,
  formatConfidencePercent,
  getConfidenceLabel,
  validateRoundTrip,
} from '../beliefDisplay'

describe('beliefToConfidencePercent', () => {
  it('converts belief 0 (certain) to 100% confidence', () => {
    expect(beliefToConfidencePercent(0)).toBe(100)
  })

  it('converts belief 1 (max uncertainty) to 0% confidence', () => {
    expect(beliefToConfidencePercent(1)).toBe(0)
  })

  it('converts belief 0.5 (mid uncertainty) to 50% confidence', () => {
    expect(beliefToConfidencePercent(0.5)).toBe(50)
  })

  it('converts belief 0.3 (low uncertainty) to 70% confidence', () => {
    expect(beliefToConfidencePercent(0.3)).toBe(70)
  })

  it('converts belief 0.7 (high uncertainty) to 30% confidence', () => {
    expect(beliefToConfidencePercent(0.7)).toBeCloseTo(30, 10)
  })

  it('handles edge case: belief 0.1', () => {
    expect(beliefToConfidencePercent(0.1)).toBeCloseTo(90, 10)
  })

  it('handles edge case: belief 0.9', () => {
    expect(beliefToConfidencePercent(0.9)).toBeCloseTo(10, 10)
  })
})

describe('confidencePercentToBelief', () => {
  it('converts 100% confidence to belief 0 (certain)', () => {
    expect(confidencePercentToBelief(100)).toBe(0)
  })

  it('converts 0% confidence to belief 1 (max uncertainty)', () => {
    expect(confidencePercentToBelief(0)).toBe(1)
  })

  it('converts 50% confidence to belief 0.5 (mid uncertainty)', () => {
    expect(confidencePercentToBelief(50)).toBe(0.5)
  })

  it('converts 70% confidence to belief 0.3 (low uncertainty)', () => {
    expect(confidencePercentToBelief(70)).toBeCloseTo(0.3, 10)
  })

  it('converts 30% confidence to belief 0.7 (high uncertainty)', () => {
    expect(confidencePercentToBelief(30)).toBeCloseTo(0.7, 10)
  })

  it('handles edge case: 90% confidence', () => {
    expect(confidencePercentToBelief(90)).toBeCloseTo(0.1, 10)
  })

  it('handles edge case: 10% confidence', () => {
    expect(confidencePercentToBelief(10)).toBeCloseTo(0.9, 10)
  })
})

describe('round-trip conversion', () => {
  it('preserves belief 0 through round-trip', () => {
    const belief = 0
    const confidence = beliefToConfidencePercent(belief)
    const roundTrip = confidencePercentToBelief(confidence)
    expect(roundTrip).toBe(belief)
  })

  it('preserves belief 1 through round-trip', () => {
    const belief = 1
    const confidence = beliefToConfidencePercent(belief)
    const roundTrip = confidencePercentToBelief(confidence)
    expect(roundTrip).toBe(belief)
  })

  it('preserves belief 0.5 through round-trip', () => {
    const belief = 0.5
    const confidence = beliefToConfidencePercent(belief)
    const roundTrip = confidencePercentToBelief(confidence)
    expect(roundTrip).toBe(belief)
  })

  it('preserves belief 0.3 through round-trip', () => {
    const belief = 0.3
    const confidence = beliefToConfidencePercent(belief)
    const roundTrip = confidencePercentToBelief(confidence)
    expect(roundTrip).toBeCloseTo(belief, 10)
  })

  it('preserves belief 0.7 through round-trip', () => {
    const belief = 0.7
    const confidence = beliefToConfidencePercent(belief)
    const roundTrip = confidencePercentToBelief(confidence)
    expect(roundTrip).toBeCloseTo(belief, 10)
  })

  it('preserves arbitrary belief values', () => {
    const testValues = [0, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1]
    testValues.forEach(belief => {
      const confidence = beliefToConfidencePercent(belief)
      const roundTrip = confidencePercentToBelief(confidence)
      expect(roundTrip).toBeCloseTo(belief, 10)
    })
  })
})

describe('validateRoundTrip', () => {
  it('validates round-trip for belief 0', () => {
    expect(validateRoundTrip(0)).toBe(true)
  })

  it('validates round-trip for belief 1', () => {
    expect(validateRoundTrip(1)).toBe(true)
  })

  it('validates round-trip for belief 0.5', () => {
    expect(validateRoundTrip(0.5)).toBe(true)
  })

  it('validates round-trip for all common values', () => {
    const testValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    testValues.forEach(belief => {
      expect(validateRoundTrip(belief)).toBe(true)
    })
  })
})

describe('formatConfidencePercent', () => {
  it('formats 100% correctly', () => {
    expect(formatConfidencePercent(100)).toBe('100%')
  })

  it('formats 0% correctly', () => {
    expect(formatConfidencePercent(0)).toBe('0%')
  })

  it('formats 50% correctly', () => {
    expect(formatConfidencePercent(50)).toBe('50%')
  })

  it('rounds to nearest integer', () => {
    expect(formatConfidencePercent(70.4)).toBe('70%')
    expect(formatConfidencePercent(70.5)).toBe('71%')
    expect(formatConfidencePercent(70.6)).toBe('71%')
  })

  it('handles edge case: 99.9%', () => {
    expect(formatConfidencePercent(99.9)).toBe('100%')
  })

  it('handles edge case: 0.1%', () => {
    expect(formatConfidencePercent(0.1)).toBe('0%')
  })
})

describe('getConfidenceLabel', () => {
  it('returns "Very certain" for 90-100%', () => {
    expect(getConfidenceLabel(100)).toBe('Very certain')
    expect(getConfidenceLabel(95)).toBe('Very certain')
    expect(getConfidenceLabel(90)).toBe('Very certain')
  })

  it('returns "Moderately certain" for 70-89%', () => {
    expect(getConfidenceLabel(89)).toBe('Moderately certain')
    expect(getConfidenceLabel(80)).toBe('Moderately certain')
    expect(getConfidenceLabel(70)).toBe('Moderately certain')
  })

  it('returns "Somewhat certain" for 50-69%', () => {
    expect(getConfidenceLabel(69)).toBe('Somewhat certain')
    expect(getConfidenceLabel(60)).toBe('Somewhat certain')
    expect(getConfidenceLabel(50)).toBe('Somewhat certain')
  })

  it('returns "Somewhat uncertain" for 30-49%', () => {
    expect(getConfidenceLabel(49)).toBe('Somewhat uncertain')
    expect(getConfidenceLabel(40)).toBe('Somewhat uncertain')
    expect(getConfidenceLabel(30)).toBe('Somewhat uncertain')
  })

  it('returns "Moderately uncertain" for 10-29%', () => {
    expect(getConfidenceLabel(29)).toBe('Moderately uncertain')
    expect(getConfidenceLabel(20)).toBe('Moderately uncertain')
    expect(getConfidenceLabel(10)).toBe('Moderately uncertain')
  })

  it('returns "Very uncertain" for 0-9%', () => {
    expect(getConfidenceLabel(9)).toBe('Very uncertain')
    expect(getConfidenceLabel(5)).toBe('Very uncertain')
    expect(getConfidenceLabel(0)).toBe('Very uncertain')
  })
})

describe('inverted scale validation', () => {
  it('confirms 0 belief (certain) maps to 100% confidence', () => {
    // User thinks: "I'm 100% confident this is true"
    // System stores: belief = 0 (no epistemic uncertainty)
    const userConfidence = 100
    const systemBelief = confidencePercentToBelief(userConfidence)
    expect(systemBelief).toBe(0)
  })

  it('confirms 1 belief (max uncertainty) maps to 0% confidence', () => {
    // User thinks: "I'm 0% confident (complete guess)"
    // System stores: belief = 1 (maximum epistemic uncertainty)
    const userConfidence = 0
    const systemBelief = confidencePercentToBelief(userConfidence)
    expect(systemBelief).toBe(1)
  })

  it('confirms high belief (0.8) maps to low confidence (20%)', () => {
    // User thinks: "I'm only 20% confident"
    // System stores: belief = 0.8 (high epistemic uncertainty)
    const userConfidence = 20
    const systemBelief = confidencePercentToBelief(userConfidence)
    expect(systemBelief).toBeCloseTo(0.8, 10)
  })

  it('confirms low belief (0.2) maps to high confidence (80%)', () => {
    // User thinks: "I'm 80% confident"
    // System stores: belief = 0.2 (low epistemic uncertainty)
    const userConfidence = 80
    const systemBelief = confidencePercentToBelief(userConfidence)
    expect(systemBelief).toBeCloseTo(0.2, 10)
  })
})
