/**
 * Results Panel Constants
 *
 * Shared constants for the Results Panel components.
 * Phase 3 Bug Fixes: Threshold and label constants.
 */

import { ROBUSTNESS_BADGE_LABELS } from '../../lib/stability'

// =============================================================================
// Robustness Level Configuration
// =============================================================================

/**
 * Robustness level labels for display.
 *
 * ⭐ ROADMAP 2.928 member (d) — DERIVED from the one register in
 * `lib/stability.ts`, not re-typed here. This map, `ROBUSTNESS_LEVEL_DISPLAY`
 * and `getStabilityClassification().badgeLabel` were three hand-maintained
 * copies of four words; they happened to agree, which is exactly how that
 * defect class stays invisible until it doesn't (CLAUDE.md trap 12).
 * `medium` stays as the legacy alias of `moderate`, derived from the same entry.
 */
export const ROBUSTNESS_LEVEL_LABELS = {
  high: ROBUSTNESS_BADGE_LABELS.high,
  medium: ROBUSTNESS_BADGE_LABELS.moderate,
  moderate: ROBUSTNESS_BADGE_LABELS.moderate,
  low: ROBUSTNESS_BADGE_LABELS.low,
  very_low: ROBUSTNESS_BADGE_LABELS.very_low,
} as const


// =============================================================================
// Threshold Constants
// =============================================================================

// ⛔ REMOVED (A5): `MIN_STABLE_RECOMMENDATION_STABILITY = 0.6`.
//
// `utils/stabilityReadiness.ts` was its ONLY consumer, and that module is deleted
// in this PR (zero references repo-wide). Verified after the deletion: the symbol
// had no occurrence anywhere in the repo except its own definition — case
// insensitive, all file types. Contrast control in the same sweep:
// `ROBUSTNESS_LEVEL_LABELS` returned 11 consumers, so the probe discriminates.
//
// ⛔ ALSO REMOVED (delete-first batch 2): `ROBUSTNESS_LEVEL_COLOURS` and
// `SWITCH_PROBABILITY_THRESHOLD`. #894 measured both as dead and deliberately left
// them rather than absorb pre-existing drift into its evidence; this is that follow-up.
//
// ⚠ `SWITCH_PROBABILITY_THRESHOLD` was a DIVERGENT mirror, not a duplicate. Its comment
// claimed "only edges with switch_probability > this value are shown" and it held 0.3,
// while the value that actually decides is `THRESHOLDS.FRAGILE_EDGE_FILTER = 0.15`
// (src/lib/mappers/constants.ts:23, Spec 6.3 / UI-SEM-013) — the two disagreed by 2x.
// Wiring the local one up to "remove a duplicate" would have doubled the filter and
// silently hidden half the fragile edges. If you need this threshold, import THRESHOLDS.

/**
 * Epsilon for baseline delta display.
 * Deltas with absolute value less than this are shown as "Same as baseline".
 */
export const BASELINE_DELTA_EPSILON = 0.05


// =============================================================================
// Robustness Level Helpers
// =============================================================================

export type RobustnessLevelKey = keyof typeof ROBUSTNESS_LEVEL_LABELS

/**
 * Check if robustness level indicates a stable model.
 * High and moderate/medium are considered stable.
 */
export function isStableRobustnessLevel(level: string | undefined): boolean {
  if (!level) return false
  const normalized = level.toLowerCase().trim().replace(/-/g, '_')
  return normalized === 'high' || normalized === 'medium' || normalized === 'moderate'
}

/**
 * Check if robustness level indicates an unstable model.
 * Low and very_low are considered unstable.
 */
export function isUnstableRobustnessLevel(level: string | undefined): boolean {
  if (!level) return false
  const normalized = level.toLowerCase().trim().replace(/-/g, '_')
  return normalized === 'low' || normalized === 'very_low'
}
