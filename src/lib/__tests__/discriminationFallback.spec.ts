/**
 * Tests for Discrimination Fallback Module
 *
 * Phase 1 P0: Detect when outcomes are too close to call
 */

import { describe, it, expect } from 'vitest'
import {
  analyzeDiscrimination,
  optionsDiscriminate,
  getDiscriminationFallback,
  fromOptionProbabilities,
  type OutcomePrediction,
} from '../discriminationFallback'

describe('analyzeDiscrimination', () => {
  describe('basic discrimination', () => {
    it('discriminates when spread exceeds threshold', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 80 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 60 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.discriminates).toBe(true)
      expect(result.spread).toBe(20)
      expect(result.fallbackMessage).toBeNull()
      expect(result.topOption?.optionId).toBe('opt_1')
    })

    it('does not discriminate when spread is below threshold', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 72 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 74 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.discriminates).toBe(false)
      expect(result.spread).toBe(2)
      expect(result.fallbackMessage).toContain('too close to call')
      expect(result.topOption).toBeNull()
    })

    it('discriminates at exactly threshold', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 75 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 70 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.discriminates).toBe(true)
      expect(result.spread).toBe(5)
    })
  })

  describe('edge cases', () => {
    it('handles empty predictions', () => {
      const result = analyzeDiscrimination([])
      expect(result.discriminates).toBe(false)
      expect(result.fallbackMessage).toBe('No predictions available')
    })

    it('handles single prediction', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 75 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.discriminates).toBe(true)
      expect(result.spread).toBe(0)
      expect(result.topOption?.optionId).toBe('opt_1')
    })

    it('handles three or more options', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 85 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 70 },
        { optionId: 'opt_3', optionLabel: 'Option C', value: 55 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.discriminates).toBe(true)
      expect(result.spread).toBe(30)
      expect(result.topOption?.optionId).toBe('opt_1')
    })
  })

  describe('sorting', () => {
    it('sorts options by value descending', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_2', optionLabel: 'Option B', value: 60 },
        { optionId: 'opt_1', optionLabel: 'Option A', value: 80 },
        { optionId: 'opt_3', optionLabel: 'Option C', value: 70 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.sortedOptions[0].optionId).toBe('opt_1')
      expect(result.sortedOptions[1].optionId).toBe('opt_3')
      expect(result.sortedOptions[2].optionId).toBe('opt_2')
    })
  })

  describe('suggestions', () => {
    it('provides suggestions when options do not discriminate', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 51 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 50 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.suggestions.length).toBeLessThanOrEqual(3)
    })

    it('provides no suggestions when options discriminate', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 90 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 50 },
      ]
      const result = analyzeDiscrimination(predictions)
      expect(result.suggestions).toEqual([])
    })
  })

  describe('custom threshold', () => {
    it('respects custom minSpread', () => {
      const predictions: OutcomePrediction[] = [
        { optionId: 'opt_1', optionLabel: 'Option A', value: 73 },
        { optionId: 'opt_2', optionLabel: 'Option B', value: 70 },
      ]

      // With default threshold (5), this should not discriminate
      const defaultResult = analyzeDiscrimination(predictions)
      expect(defaultResult.discriminates).toBe(false)

      // With lower threshold (2), this should discriminate
      const customResult = analyzeDiscrimination(predictions, { minSpread: 2 })
      expect(customResult.discriminates).toBe(true)
    })
  })
})

describe('optionsDiscriminate', () => {
  it('returns true when options discriminate', () => {
    const predictions: OutcomePrediction[] = [
      { optionId: 'opt_1', optionLabel: 'Option A', value: 80 },
      { optionId: 'opt_2', optionLabel: 'Option B', value: 60 },
    ]
    expect(optionsDiscriminate(predictions)).toBe(true)
  })

  it('returns false when options do not discriminate', () => {
    const predictions: OutcomePrediction[] = [
      { optionId: 'opt_1', optionLabel: 'Option A', value: 51 },
      { optionId: 'opt_2', optionLabel: 'Option B', value: 50 },
    ]
    expect(optionsDiscriminate(predictions)).toBe(false)
  })
})

describe('getDiscriminationFallback', () => {
  it('returns null when options discriminate', () => {
    const predictions: OutcomePrediction[] = [
      { optionId: 'opt_1', optionLabel: 'Option A', value: 90 },
      { optionId: 'opt_2', optionLabel: 'Option B', value: 50 },
    ]
    expect(getDiscriminationFallback(predictions)).toBeNull()
  })

  it('returns message when options do not discriminate', () => {
    const predictions: OutcomePrediction[] = [
      { optionId: 'opt_1', optionLabel: 'Option A', value: 51 },
      { optionId: 'opt_2', optionLabel: 'Option B', value: 50 },
    ]
    const message = getDiscriminationFallback(predictions)
    expect(message).not.toBeNull()
    expect(message).toContain('too close to call')
  })
})

describe('fromOptionProbabilities', () => {
  it('converts option probabilities to predictions', () => {
    const optionProbs = {
      opt_1: { goal_probability: 0.8 },
      opt_2: { goal_probability: 0.6 },
    }
    const labels = {
      opt_1: 'Option A',
      opt_2: 'Option B',
    }

    const result = fromOptionProbabilities(optionProbs, labels)

    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(80)
    expect(result[0].optionLabel).toBe('Option A')
  })

  it('handles undefined input', () => {
    expect(fromOptionProbabilities(undefined)).toEqual([])
  })

  it('uses ID as label when not provided', () => {
    const optionProbs = {
      opt_1: { goal_probability: 0.8 },
    }
    const result = fromOptionProbabilities(optionProbs)
    expect(result[0].optionLabel).toBe('opt_1')
  })

  it('includes confidence when provided', () => {
    const optionProbs = {
      opt_1: { goal_probability: 0.8, confidence: 0.9 },
    }
    const result = fromOptionProbabilities(optionProbs)
    expect(result[0].confidence).toBe(0.9)
  })

  // ── GOAL-PROBABILITY IDENTITY ────────────────────────────────────────────
  // The discrimination verdict ("too close to call") is computed FROM these
  // values, so a value chosen by a different rule from the one the panel
  // displays makes the verdict contradict the numbers on screen. This function
  // used to read `goal_probability` directly, with no joint fallback; it now
  // reads `selectGoalProbability`'s choice.

  /**
   * ⭐ AMENDED BY L62 (2026-08-04) — AND THIS SURFACE MATTERS MORE THAN MOST.
   *
   * The test pinned the joint FALLBACK: no `goal_probability` ⇒ use
   * `probability_of_joint_goal` and rank on it. `selectGoalProbability` no
   * longer substitutes (L60 §5–§8: the joint figure on that path is
   * P(level-or-count threshold >= change-frame sample), a structural zero), so
   * both options are DROPPED and the discrimination verdict is computed from
   * an empty set.
   *
   * That is the honest outcome and it is worth naming, because this function
   * does not merely display a number — it feeds the "too close to call"
   * VERDICT. Ranking options by a quantity that is ~0 for all of them by
   * arithmetic would have produced a confident discrimination claim about
   * noise. `analyzeDiscrimination([])` returns `discriminates: false` with
   * "No predictions available", which is the correct thing to say when nothing
   * scoreable arrived.
   *
   * The original comment's concern — never contribute NaN to the spread — is
   * unchanged and still pinned by the sibling test below.
   */
  it('L62: drops options whose only figure is a withheld joint one — the verdict is not computed from a structural zero', () => {
    const result = fromOptionProbabilities({
      opt_1: { probability_of_joint_goal: 0.6 } as never,
      opt_2: { probability_of_joint_goal: 0.2 } as never,
    })
    expect(result).toEqual([])

    // …and the verdict built from that is an honest absence, not a confident
    // "too close to call" over nothing.
    const verdict = analyzeDiscrimination(result)
    expect(verdict.discriminates).toBe(false)
    expect(verdict.topOption).toBeNull()
    expect(verdict.spread).toBe(0)
  })

  it('POSITIVE CONTROL: a real goal_probability still ranks, by identity — the drop above is not a blanket one', () => {
    // Without this, deleting the body of `fromOptionProbabilities` would pass
    // the test above (trap 13).
    const result = fromOptionProbabilities({
      opt_1: { goal_probability: 0.6 } as never,
      opt_2: { goal_probability: 0.2 } as never,
    })
    // Bound by option id, never by position or value: a builder that paired
    // the wrong label to the wrong number would satisfy a `.map(r => r.value)`
    // assertion (CLAUDE.md trap 19).
    const byId = new Map(result.map((r) => [r.optionId, r.value]))
    expect(byId.get('opt_1')).toBe(60)
    expect(byId.get('opt_2')).toBe(20)
    expect(result.every((r) => Number.isFinite(r.value))).toBe(true)
  })

  it('drops an option with no admissible number rather than contributing NaN', () => {
    const result = fromOptionProbabilities({
      opt_1: { goal_probability: 0.8 },
      opt_2: {} as never,
    })
    expect(result).toHaveLength(1)
    expect(result[0].optionId).toBe('opt_1')
  })

  it('is unchanged for a fully-specified input (behaviour-preservation pin)', () => {
    const result = fromOptionProbabilities(
      { opt_1: { goal_probability: 0.8, confidence: 0.9 }, opt_2: { goal_probability: 0.6 } },
      { opt_1: 'Option A', opt_2: 'Option B' },
    )
    expect(result).toEqual([
      { optionId: 'opt_1', optionLabel: 'Option A', value: 80, confidence: 0.9 },
      { optionId: 'opt_2', optionLabel: 'Option B', value: 60, confidence: undefined },
    ])
  })
})
