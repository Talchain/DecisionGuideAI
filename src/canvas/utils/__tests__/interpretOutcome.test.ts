import { describe, it, expect } from 'vitest'
import { deriveVerdict, computeDelta } from '../interpretOutcome'

describe('deriveVerdict', () => {
  it('returns supports when outcome improves toward maximize goal', () => {
    const result = deriveVerdict({
      outcomeValue: 120,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('supports')
    expect(result.strength).toBe('moderately')
  })

  it('returns opposes when outcome worsens toward maximize goal', () => {
    const result = deriveVerdict({
      outcomeValue: 80,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('opposes')
    expect(result.strength).toBe('moderately')
  })

  it('returns mixed when change is within tolerance', () => {
    const result = deriveVerdict({
      outcomeValue: 101,
      baselineValue: 100,
      goalDirection: 'maximize',
      tolerancePercent: 0.05,
    })

    expect(result.verdict).toBe('mixed')
    expect(result.strength).toBe('slightly')
  })

  it('handles minimize goals correctly', () => {
    const result = deriveVerdict({
      outcomeValue: 80,
      baselineValue: 100,
      goalDirection: 'minimize',
    })

    expect(result.verdict).toBe('supports')
    expect(result.strength).toBe('moderately')
  })

  it('handles minimize goals with negative outcome', () => {
    const result = deriveVerdict({
      outcomeValue: 120,
      baselineValue: 100,
      goalDirection: 'minimize',
    })

    expect(result.verdict).toBe('opposes')
    expect(result.strength).toBe('moderately')
  })

  it('classifies strongly for large changes', () => {
    const result = deriveVerdict({
      outcomeValue: 150,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('supports')
    expect(result.strength).toBe('strongly')
  })

  it('classifies slightly for small changes', () => {
    const result = deriveVerdict({
      outcomeValue: 108,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('supports')
    expect(result.strength).toBe('slightly')
  })

  it('handles zero baseline value', () => {
    const result = deriveVerdict({
      outcomeValue: 50,
      baselineValue: 0,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('supports')
    // With zero baseline, any positive is treated as infinite relative change
  })

  it('handles negative values', () => {
    const result = deriveVerdict({
      outcomeValue: -80,
      baselineValue: -100,
      goalDirection: 'maximize',
    })

    expect(result.verdict).toBe('supports')
    expect(result.strength).toBe('moderately')
  })

  it('returns confidence based on relative change', () => {
    const result = deriveVerdict({
      outcomeValue: 150,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    // 50% relative change → confidence capped at 1.0
    expect(result.confidence).toBeLessThanOrEqual(1.0)
    expect(result.confidence).toBeGreaterThan(0)
  })
})

describe('computeDelta', () => {
  it('identifies significant improvement', () => {
    const result = computeDelta({
      currentValue: 150,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('better')
    expect(result.magnitude).toBe('significantly')
    expect(result.deltaValue).toBe(50)
    expect(result.deltaPercent).toBeCloseTo(50)
  })

  it('identifies moderate improvement', () => {
    const result = computeDelta({
      currentValue: 115,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('better')
    expect(result.magnitude).toBe('moderately')
    expect(result.deltaPercent).toBeCloseTo(15)
  })

  it('identifies slight improvement', () => {
    const result = computeDelta({
      currentValue: 105,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('better')
    expect(result.magnitude).toBe('slightly')
    expect(result.deltaPercent).toBeCloseTo(5)
  })

  it('identifies similar when within epsilon', () => {
    const result = computeDelta({
      currentValue: 100.01,
      baselineValue: 100,
      goalDirection: 'maximize',
      epsilon: 0.02,
    })

    expect(result.direction).toBe('similar')
    expect(result.magnitude).toBe('slightly')
  })

  it('identifies degradation for minimize goals', () => {
    const result = computeDelta({
      currentValue: 120,
      baselineValue: 100,
      goalDirection: 'minimize',
    })

    expect(result.direction).toBe('worse')
    expect(result.magnitude).toBe('moderately')
  })

  it('identifies improvement for minimize goals', () => {
    const result = computeDelta({
      currentValue: 80,
      baselineValue: 100,
      goalDirection: 'minimize',
    })

    expect(result.direction).toBe('better')
    expect(result.magnitude).toBe('moderately')
  })

  it('handles zero baseline value', () => {
    const result = computeDelta({
      currentValue: 50,
      baselineValue: 0,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('better')
    expect(result.deltaValue).toBe(50)
    expect(result.deltaPercent).toBeNull()
  })

  it('handles negative deltas', () => {
    const result = computeDelta({
      currentValue: 80,
      baselineValue: 100,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('worse')
    expect(result.deltaValue).toBe(-20)
    expect(result.deltaPercent).toBeCloseTo(-20)
  })

  it('handles negative baseline values', () => {
    const result = computeDelta({
      currentValue: -80,
      baselineValue: -100,
      goalDirection: 'maximize',
    })

    expect(result.direction).toBe('better')
    expect(result.deltaValue).toBe(20)
    expect(result.deltaPercent).toBeCloseTo(20)
  })

  it('uses custom epsilon', () => {
    const result = computeDelta({
      currentValue: 100.05,
      baselineValue: 100,
      goalDirection: 'maximize',
      epsilon: 0.1, // More tolerant
    })

    expect(result.direction).toBe('similar')
  })
})
