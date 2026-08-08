/**
 * Canonical stability classification.
 *
 * Single source of truth for mapping numeric recommendation_stability (0-1)
 * to categorical level, display label, colour, and border class.
 *
 * Consumers: useResultsSectionData (robustnessLevel derivation),
 * buildResultsVM (DecisionState), GoalNode (badge).
 *
 * Thresholds align with ISL robustness protocol:
 *   >= 0.85  high      — "Stable ranking"
 *   >= 0.70  moderate  — "Mostly stable ranking"
 *   >= 0.40  low       — "Ranking sensitive to assumptions"
 *   <  0.40  very_low  — "Ranking highly sensitive"
 *
 * ⭐ ROADMAP 2.580 member 3 — WHAT THIS NUMBER IS, AND WHAT THE COPY MAY CLAIM.
 *
 * Read at the producer (ISL `staging`), not inferred here:
 *   `RobustnessResultV2.recommendation_stability`  →  "P(same recommendation
 *     across samples)"                        (src/models/robustness_v2.py)
 *   `_build_robustness_interpretation`          →  "{winner} wins in {x:.0%}
 *     of sampled scenarios"        (src/services/robustness_analyzer_v2.py)
 *
 * So the quantity is THE SHARE OF SAMPLED SCENARIOS IN WHICH THE SAME OPTION
 * CAME OUT ON TOP: a statement about the RANKING, over a FINITE SAMPLE.
 *
 * The copy used to say "Stable result" / "Result stays the same even if
 * estimates are off". Codex (5 Aug 2026) saw that beside 19 sensitive
 * assumptions and zero stable edges — two over-claims stacked:
 *   (a) "the result" — every number, when only the ORDER was measured; the
 *       sensitive assumptions are exactly the numbers that did NOT hold;
 *   (b) "even if estimates are off" — an unbounded universal over all possible
 *       estimate errors, drawn from a finite sample of scenarios.
 * The wording below states the ranking scope and the sample, and nothing else.
 * `stabilityRankingScope.spec.ts` pins both properties at every tier.
 */

import type { RobustnessLevel } from './mappers/types'

export interface StabilityClassification {
  /** Categorical level matching ISL robustness.level enum */
  level: RobustnessLevel
  /** User-facing label for trust/robustness badge (e.g., "Robust") */
  badgeLabel: string
  /** User-facing label for hero stability tier (e.g., "Stable ranking") */
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
      heroLabel: 'Stable ranking',
      heroShortText: 'Across sampled scenarios',
      heroExpandedText: 'The same option led in nearly every scenario we sampled. Individual estimates can still be off.',
      coaching: null,
      colorClass: 'text-success',
      borderClass: 'border-success/30',
    }
  }

  if (stability >= 0.70) {
    return {
      level: 'moderate',
      badgeLabel: 'Moderate',
      heroLabel: 'Mostly stable ranking',
      heroShortText: 'In most sampled scenarios',
      heroExpandedText: 'The same option led in most of the scenarios we sampled.',
      coaching: 'The leading option was the same in most of the scenarios we sampled. A few edge cases could change it.',
      colorClass: 'text-success',
      borderClass: 'border-info/30',
    }
  }

  if (stability >= 0.40) {
    return {
      level: 'low',
      badgeLabel: 'Sensitive',
      heroLabel: 'Ranking sensitive to assumptions',
      heroShortText: 'Review key inputs',
      heroExpandedText: 'Which option leads changed across the scenarios we sampled. Review key inputs.',
      coaching: 'Which option leads changed across the scenarios we sampled. Small changes could change it again.',
      colorClass: 'text-warning',
      borderClass: 'border-factor/30',
    }
  }

  return {
    level: 'very_low',
    badgeLabel: 'Highly sensitive',
    heroLabel: 'Ranking highly sensitive',
    heroShortText: 'Treat as directional',
    heroExpandedText: 'Which option leads changed often across the scenarios we sampled. Treat as directional.',
    coaching: 'Which option leads changed often across the scenarios we sampled. Consider strengthening key assumptions before committing.',
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
