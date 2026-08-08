/**
 * getStabilityDisplayLabel — Brief 5.5 §2.7 tier × stability footer gate.
 *
 * The override now mirrors shouldSoftenPhrasing(tier, stability) exactly so
 * hero and footer stay in lock-step:
 *   soft ⇔ tier ∈ {needs_work, fair} AND stability < 0.85
 * coachingReadiness is NOT consulted (spec correction — the Brief 5.2
 * version overrode on weak readiness even when the hero stayed confident).
 */

import { describe, it, expect } from 'vitest'
import { getStabilityDisplayLabel } from '../getStabilityDisplayLabel'
import { getStabilityClassification } from '../../../../lib/stability'

describe('getStabilityDisplayLabel — tier × stability gate (Brief 5.5 §2.7)', () => {
  it('returns null when classification is null (missing stability)', () => {
    expect(
      getStabilityDisplayLabel({
        classification: null,
        confidenceTier: 'strong',
        recommendationStability: 0.9,
      }),
    ).toBeNull()
  })

  describe('pass-through: strong tier retains numeric classification at every stability', () => {
    it.each([
      [0.97, 'Stable ranking'],
      [0.85, 'Stable ranking'],
      [0.80, 'Mostly stable ranking'],
      [0.55, 'Ranking sensitive to assumptions'],
      [0.30, 'Ranking highly sensitive'],
    ])('stability %s → heroLabel "%s" (strong tier, any readiness)', (stability, expected) => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'strong',
        coachingReadiness: 'needs_evidence', // readiness must NOT override strong
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe(expected)
      expect(result?.overriddenByTier).toBe(false)
    })
  })

  describe('stability override — tier ∈ {needs_work, fair} at stability ≥ 0.85 → pass-through', () => {
    it('needs_work + stability 0.97 → "Stable ranking" (stability override)', () => {
      const stability = 0.97
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'needs_work',
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe('Stable ranking')
      expect(result?.overriddenByTier).toBe(false)
    })

    it('fair + stability 0.90 → "Stable ranking"', () => {
      const stability = 0.90
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'fair',
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe('Stable ranking')
      expect(result?.overriddenByTier).toBe(false)
    })
  })

  describe('soft footer — tier ∈ {needs_work, fair} AND stability < 0.85 → "Stability sensitive"', () => {
    it('needs_work + stability 0.75 → "Stability sensitive"', () => {
      const stability = 0.75
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'needs_work',
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })

    it('fair + stability 0.78 → "Stability sensitive" (new per §2.7)', () => {
      const stability = 0.78
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'fair',
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })

    it('needs_work + absent stability → "Stability sensitive" (absent treated as weak)', () => {
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(0.3), // some classification, but no stability threaded
        confidenceTier: 'needs_work',
      })
      expect(result?.heroLabel).toBe('Stability sensitive')
      expect(result?.overriddenByTier).toBe(true)
    })
  })

  describe('readiness is orthogonal to the override (spec correction)', () => {
    it.each([
      ['needs_evidence' as const],
      ['needs_framing' as const],
      ['low' as const],
      ['not_ready' as const],
    ])('strong tier + weak readiness %s at stability 0.95 → "Stable ranking" (readiness never overrides)', (readiness) => {
      const stability = 0.95
      const result = getStabilityDisplayLabel({
        classification: getStabilityClassification(stability),
        confidenceTier: 'strong',
        coachingReadiness: readiness,
        recommendationStability: stability,
      })
      expect(result?.heroLabel).toBe('Stable ranking')
      expect(result?.overriddenByTier).toBe(false)
    })
  })

  it('absent tier → pass-through (no override)', () => {
    const result = getStabilityDisplayLabel({
      classification: getStabilityClassification(0.9),
      recommendationStability: 0.9,
    })
    expect(result?.heroLabel).toBe('Stable ranking')
    expect(result?.overriddenByTier).toBe(false)
  })

  it('close_call readiness alone does NOT trigger the override', () => {
    const result = getStabilityDisplayLabel({
      classification: getStabilityClassification(0.9),
      coachingReadiness: 'close_call',
      recommendationStability: 0.9,
    })
    expect(result?.heroLabel).toBe('Stable ranking')
    expect(result?.overriddenByTier).toBe(false)
  })
})
