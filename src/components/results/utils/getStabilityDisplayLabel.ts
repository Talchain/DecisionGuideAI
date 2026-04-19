/**
 * getStabilityDisplayLabel — Analysis-tab-local adapter that composes the
 * numeric classification from src/lib/stability.ts with confidence_tier /
 * coaching_readiness overrides.
 *
 * Brief 5.2 Task 1: weak tier forces "Stability sensitive" even when numeric
 * stability is high — over-confident footer copy (e.g. "Stable result · 97%")
 * is suppressed regardless of the raw number when evidence is weak.
 *
 * This is deliberately a UI-side composer, not a change to the shared
 * getStabilityClassification signature. Other callers of stability.ts (e.g.
 * canvas hero borders) stay numeric-only.
 */

import type { StabilityClassification } from '../../../lib/stability'
import type { M1CoachingReadiness } from '../../../types/cee'
import type { ConfidenceTier } from '../types'

const WEAK_READINESS: readonly M1CoachingReadiness[] = [
  'needs_evidence',
  'needs_framing',
  'low',
  'not_ready',
]

function isWeakReadiness(value: M1CoachingReadiness | undefined): boolean {
  if (value == null) return false
  return (WEAK_READINESS as readonly M1CoachingReadiness[]).includes(value)
}

function isWeakTier(
  tier: ConfidenceTier | undefined,
  readiness: M1CoachingReadiness | undefined,
): boolean {
  return tier === 'needs_work' || isWeakReadiness(readiness)
}

export interface StabilityDisplayLabelInput {
  classification: StabilityClassification | null
  confidenceTier?: ConfidenceTier
  coachingReadiness?: M1CoachingReadiness
}

export interface StabilityDisplayLabel {
  heroLabel: string
  /**
   * True when the label was forced to "Stability sensitive" by a weak tier
   * override. Exposed so the footer can optionally style the label (e.g.
   * warning colour) when the override fires.
   */
  overriddenByTier: boolean
}

export function getStabilityDisplayLabel(
  input: StabilityDisplayLabelInput,
): StabilityDisplayLabel | null {
  const { classification, confidenceTier, coachingReadiness } = input
  if (!classification) return null

  if (isWeakTier(confidenceTier, coachingReadiness)) {
    return { heroLabel: 'Stability sensitive', overriddenByTier: true }
  }

  return { heroLabel: classification.heroLabel, overriddenByTier: false }
}
