/**
 * getStabilityDisplayLabel — Brief 5.2 Task 1 tier-aware footer label.
 *
 * Locks the tier × numeric-stability matrix for the Analysis-tab footer so
 * an evidence-weak bundle can never read "Stable result · 97%" regardless
 * of numeric stability.
 */

import { describe, it, expect } from 'vitest'
import { getStabilityDisplayLabel } from '../getStabilityDisplayLabel'
import { getStabilityClassification } from '../../../../lib/stability'

describe('getStabilityDisplayLabel — Brief 5.2 Task 1', () => {
  it('returns null when classification is null (missing stability)', () => {
    expect(
      getStabilityDisplayLabel({ classification: null, confidenceTier: 'strong' }),
    ).toBeNull()
  })

  describe('pass-through: strong / fair tier retains numeric classification', () => {
    it.each([
      [0.97, 'Stable result'],
      [0.85, 'Stable result'],
      [0.80, 'Mostly stable'],
      [0.55, 'Sensitive to assumptions'],
      [0.30, 'Highly sensitive'],
    ])('stability %s → heroLabel "%s" (strong tier)', (stability, expected) => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      })
      expect(result?.heroLabel).toBe(expected)
      expect(result?.overriddenByTier).toBe(false)
    })

    it('fair tier passes through numeric label at high stability', () => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(0.9),
        confidenceTier: 'fair',
        coachingReadiness: 'close_call',
      })
      expect(result?.heroLabel).toBe('Stable result')
      expect(result?.overriddenByTier).toBe(false)
    })
  })

  describe('weak tier override: "Stability sensitive" regardless of numeric stability', () => {
    it('needs_work + stability 0.97 → "Stability sensitive" (the bundle-609164c7 case)', () => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(0.97),
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })

    it.each([
      ['needs_evidence' as const],
      ['needs_framing' as const],
      ['low' as const],
      ['not_ready' as const],
    ])('weak readiness %s overrides even at stability 0.95', (readiness) => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(0.95),
        confidenceTier: 'strong',
        coachingReadiness: readiness,
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })

    it('weak tier at low numeric stability still labels "Stability sensitive" (consistent messaging)', () => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(0.3),
        confidenceTier: 'needs_work',
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })
  })

  it('absent tier and readiness → pass-through (no override)', () => {
    const result = getStabilityDisplayLabel({
      classification: getStabilityClassification(0.9),
    })
    expect(result?.heroLabel).toBe('Stable result')
    expect(result?.overriddenByTier).toBe(false)
  })

  it('ready readiness does NOT override', () => {
    const result = getStabilityDisplayLabel({
      classification: getStabilityClassification(0.9),
      coachingReadiness: 'ready',
    })
    expect(result?.heroLabel).toBe('Stable result')
    expect(result?.overriddenByTier).toBe(false)
  })

  it('close_call readiness alone does NOT trigger the override (Brief 5.1 decision-table rule 5)', () => {
    const result = getStabilityDisplayLabel({
      classification: getStabilityClassification(0.9),
      coachingReadiness: 'close_call',
    })
    expect(result?.heroLabel).toBe('Stable result')
    expect(result?.overriddenByTier).toBe(false)
  })
})
