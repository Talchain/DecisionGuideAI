/**
 * getStabilityDisplayLabel — Analysis-tab-local adapter that composes the
 * numeric classification from src/lib/stability.ts with confidence_tier /
 * coaching_readiness overrides.
 *
 * Brief 5.5 §2.7: the override now mirrors shouldSoftenPhrasing exactly
 * (tier ∈ {needs_work, fair} AND stability < 0.85). This keeps hero and
 * footer copy in lock-step: if the hero softens, the footer softens; if
 * the hero goes confident, the footer passes through the numeric label.
 * coachingReadiness is NOT consulted (spec correction).
 *
 * This is deliberately a UI-side composer, not a change to the shared
 * getStabilityClassification signature. Other callers of stability.ts (e.g.
 * canvas hero borders) stay numeric-only.
 */

import type { StabilityClassification } from '../../../lib/stability'
import type { M1CoachingReadiness } from '../../../types/cee'
import type { ConfidenceTier } from '../types'
import { shouldSoftenPhrasing } from './certaintyCopy'

export interface StabilityDisplayLabelInput {
  classification: StabilityClassification | null
  confidenceTier?: ConfidenceTier
  coachingReadiness?: M1CoachingReadiness
  /**
   * Numeric stability used by the softening gate. When absent, the gate
   * treats stability as weak (same precedent as the certaintyCopy helper).
   */
  recommendationStability?: number
}

export interface StabilityDisplayLabel {
  heroLabel: string
  /**
   * True when the label was forced to "Stability sensitive" by the shared
   * softening gate. Exposed so the footer can optionally style the label
   * (e.g. warning colour) when the override fires.
   */
  overriddenByTier: boolean
}

export function getStabilityDisplayLabel(
  input: StabilityDisplayLabelInput,
): StabilityDisplayLabel | null {
  const { classification, confidenceTier, recommendationStability } = input
  if (!classification) return null

  if (shouldSoftenPhrasing(confidenceTier, recommendationStability)) {
    return { heroLabel: 'Stability sensitive', overriddenByTier: true }
  }

  return { heroLabel: classification.heroLabel, overriddenByTier: false }
}
