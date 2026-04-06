/**
 * Canonical stability classification.
 *
 * Single source of truth for mapping numeric recommendation_stability (0-1)
 * to categorical level, display label, colour, and border class.
 *
 * Consumers: useResultsSectionData (robustnessLevel derivation), HeroSection
 * (stability tier + border), buildResultsVM (DecisionState), GoalNode (badge).
 *
 * Thresholds align with ISL robustness protocol:
 *   >= 0.85  high      — "Stable result"
 *   >= 0.70  moderate  — "Mostly stable"
 *   >= 0.40  low       — "Sensitive to assumptions"
 *   <  0.40  very_low  — "Highly sensitive"
 */

import type { RobustnessLevel } from './mappers/types'

export interface StabilityClassification {
  /** Categorical level matching ISL robustness.level enum */
  level: RobustnessLevel
  /** User-facing label for trust/robustness badge (e.g., "Robust") */
  badgeLabel: string
  /** User-facing label for hero stability tier (e.g., "Stable result") */
  heroLabel: string
  /** Short explanatory text for the hero section */
  heroShortText: string
  /** Expanded text for disclosure/tooltip */
  heroExpandedText: string
  /** Coaching text shown when stability is not high (null when stable) */
  coaching: string | null
  /** Semantic colour class for text (e.g., "text-success") */
  colorClass: string
  /** Border class for hero card */
  borderClass: string
}

/**
 * UI-SEM-005 / UI-SEM-041 / UI-SEM-044 (consolidated):
 * Canonical stability classification from numeric recommendation_stability.
 *
 * Returns null when stability is undefined/null (caller should handle missing data).
 */
export function getStabilityClassification(
  stability: number | null | undefined
): StabilityClassification | null {
  if (stability == null) return null

  // Science UX Architecture v2 Section 4.2 thresholds
  if (stability >= 0.85) {
    return {
      level: 'high',
      badgeLabel: 'Robust',
      heroLabel: 'Stable result',
      heroShortText: 'Even if estimates are off',
      heroExpandedText: 'Result stays the same even if estimates are off.',
      coaching: null,
      colorClass: 'text-success',
      borderClass: 'border-success/30',
    }
  }

  if (stability >= 0.70) {
    return {
      level: 'moderate',
      badgeLabel: 'Moderate',
      heroLabel: 'Mostly stable',
      heroShortText: 'Under most assumptions',
      heroExpandedText: 'Result stays the same under most assumptions.',
      coaching: 'The analysis is consistent under most assumptions. A few edge cases could shift the outcome.',
      colorClass: 'text-success',
      borderClass: 'border-info/30',
    }
  }

  if (stability >= 0.40) {
    return {
      level: 'low',
      badgeLabel: 'Sensitive',
      heroLabel: 'Sensitive to assumptions',
      heroShortText: 'Review key inputs',
      heroExpandedText: 'Result changes under different assumptions. Review key inputs.',
      coaching: 'Result changes under different assumptions. Small changes could shift the result.',
      colorClass: 'text-warning',
      borderClass: 'border-factor/30',
    }
  }

  return {
    level: 'very_low',
    badgeLabel: 'Highly sensitive',
    heroLabel: 'Highly sensitive',
    heroShortText: 'Treat as directional',
    heroExpandedText: 'Small changes in assumptions change the result. Treat as directional.',
    coaching: 'Small changes in assumptions change the result. Consider strengthening key assumptions before committing.',
    colorClass: 'text-danger',
    borderClass: 'border-factor/30',
  }
}

/**
 * Derive categorical robustness level from stability score.
 * Convenience wrapper returning just the level enum.
 */
export function deriveStabilityLevel(
  stability: number | undefined
): RobustnessLevel | undefined {
  return getStabilityClassification(stability ?? null)?.level
}

/**
 * Get hero border class from robustness level or stability score.
 * Prefers explicit categorical level; falls back to numeric stability.
 */
export function getStabilityBorderClass(
  robustnessLevel?: RobustnessLevel,
  stability?: number,
): string {
  // Explicit categorical level takes precedence
  if (robustnessLevel) {
    switch (robustnessLevel) {
      case 'high':     return 'border-success/30'
      case 'moderate': return 'border-info/30'
      case 'low':
      case 'very_low': return 'border-factor/30'
    }
  }
  // Fall back to numeric stability
  return getStabilityClassification(stability)?.borderClass ?? 'border-panel-border'
}
