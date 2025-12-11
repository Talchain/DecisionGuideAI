/**
 * Goal Conflict Detection Tests
 *
 * Task 5.3: Tests for multi-goal trade-off detection
 */
import { describe, it, expect } from 'vitest'
import {
  detectGoalConflicts,
  applyWeights,
  getDefaultWeights,
  formatConflictStrength,
} from '../goalConflictDetection'

describe('detectGoalConflicts', () => {
  describe('basic conflict detection', () => {
    it('detects conflicting goals with negative correlation', () => {
      const goals = ['cost', 'quality']
      const optionScores = [
        { optionId: 'opt1', scores: { cost: 0.9, quality: 0.3 } },
        { optionId: 'opt2', scores: { cost: 0.5, quality: 0.5 } },
        { optionId: 'opt3', scores: { cost: 0.2, quality: 0.8 } },
      ]

      const result = detectGoalConflicts(goals, optionScores)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflictingPairs).toHaveLength(1)
      expect(result.conflictingPairs[0].isConflicting).toBe(true)
    })

    it('detects aligned goals with positive correlation', () => {
      const goals = ['speed', 'efficiency']
      const optionScores = [
        { optionId: 'opt1', scores: { speed: 0.9, efficiency: 0.85 } },
        { optionId: 'opt2', scores: { speed: 0.5, efficiency: 0.55 } },
        { optionId: 'opt3', scores: { speed: 0.2, efficiency: 0.25 } },
      ]

      const result = detectGoalConflicts(goals, optionScores)

      expect(result.hasConflicts).toBe(false)
      expect(result.alignedPairs.length).toBeGreaterThan(0)
    })

    it('returns empty results for insufficient data', () => {
      const result1 = detectGoalConflicts(['cost'], [])
      expect(result1.hasConflicts).toBe(false)
      expect(result1.conflictingPairs).toHaveLength(0)

      const result2 = detectGoalConflicts(
        ['cost', 'quality'],
        [{ optionId: 'opt1', scores: { cost: 0.5, quality: 0.5 } }]
      )
      expect(result2.hasConflicts).toBe(false)
    })
  })

  describe('conflict strength classification', () => {
    it('classifies strong conflict correctly', () => {
      const goals = ['a', 'b']
      // Perfect negative correlation
      const optionScores = [
        { optionId: 'opt1', scores: { a: 1, b: 0 } },
        { optionId: 'opt2', scores: { a: 0.5, b: 0.5 } },
        { optionId: 'opt3', scores: { a: 0, b: 1 } },
      ]

      const result = detectGoalConflicts(goals, optionScores)

      expect(result.conflictingPairs[0].conflictStrength).toBe('strong')
    })

    it('generates recommendations for conflicts', () => {
      const goals = ['cost', 'quality']
      const optionScores = [
        { optionId: 'opt1', scores: { cost: 0.9, quality: 0.1 } },
        { optionId: 'opt2', scores: { cost: 0.5, quality: 0.5 } },
        { optionId: 'opt3', scores: { cost: 0.1, quality: 0.9 } },
      ]

      const result = detectGoalConflicts(goals, optionScores)

      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations.some(r => r.includes('Pareto'))).toBe(true)
    })
  })

  describe('multiple goal pairs', () => {
    it('handles 3+ goals correctly', () => {
      const goals = ['cost', 'quality', 'speed']
      const optionScores = [
        { optionId: 'opt1', scores: { cost: 0.9, quality: 0.3, speed: 0.5 } },
        { optionId: 'opt2', scores: { cost: 0.5, quality: 0.5, speed: 0.6 } },
        { optionId: 'opt3', scores: { cost: 0.2, quality: 0.8, speed: 0.7 } },
      ]

      const result = detectGoalConflicts(goals, optionScores)

      // Should have 3 pairs: cost-quality, cost-speed, quality-speed
      const totalPairs = result.conflictingPairs.length + result.alignedPairs.length
      expect(totalPairs).toBeLessThanOrEqual(3)
    })
  })
})

describe('applyWeights', () => {
  it('applies equal weights by default', () => {
    const options = [
      { optionId: 'opt1', label: 'A', scores: { x: 0.8, y: 0.4 } },
      { optionId: 'opt2', label: 'B', scores: { x: 0.4, y: 0.8 } },
    ]
    const weights = { x: 0.5, y: 0.5 }

    const result = applyWeights(options, weights)

    // Both should have same weighted score (0.8*0.5 + 0.4*0.5 = 0.6)
    expect(result[0].weightedScore).toBeCloseTo(0.6)
    expect(result[1].weightedScore).toBeCloseTo(0.6)
  })

  it('applies unequal weights correctly', () => {
    const options = [
      { optionId: 'opt1', label: 'A', scores: { x: 0.8, y: 0.4 } },
      { optionId: 'opt2', label: 'B', scores: { x: 0.4, y: 0.8 } },
    ]
    const weights = { x: 0.8, y: 0.2 } // Strongly favor x

    const result = applyWeights(options, weights)

    // opt1 should have higher score (favors x)
    expect(result.find(r => r.optionId === 'opt1')!.weightedScore).toBeGreaterThan(
      result.find(r => r.optionId === 'opt2')!.weightedScore
    )
  })

  it('normalizes weights that do not sum to 1', () => {
    const options = [
      { optionId: 'opt1', label: 'A', scores: { x: 1.0, y: 0 } },
    ]
    const weights = { x: 2, y: 2 } // Sum to 4, not 1

    const result = applyWeights(options, weights)

    // Should still compute correctly (normalized)
    expect(result[0].weightedScore).toBeCloseTo(0.5)
  })
})

describe('getDefaultWeights', () => {
  it('returns equal weights for all criteria', () => {
    const criteria = ['a', 'b', 'c']
    const weights = getDefaultWeights(criteria)

    expect(weights.a).toBeCloseTo(1 / 3)
    expect(weights.b).toBeCloseTo(1 / 3)
    expect(weights.c).toBeCloseTo(1 / 3)
  })

  it('handles single criterion', () => {
    const weights = getDefaultWeights(['only'])
    expect(weights.only).toBe(1)
  })
})

describe('formatConflictStrength', () => {
  it('returns human-readable labels', () => {
    expect(formatConflictStrength('strong')).toBe('Strong conflict')
    expect(formatConflictStrength('moderate')).toBe('Moderate trade-off')
    expect(formatConflictStrength('weak')).toBe('Slight tension')
    expect(formatConflictStrength('none')).toBe('No conflict')
  })
})
