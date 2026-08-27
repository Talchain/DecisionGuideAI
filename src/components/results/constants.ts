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

/** Robustness level colors for badges */
export const ROBUSTNESS_LEVEL_COLOURS = {
  high: 'green',
  medium: 'amber',
  moderate: 'amber',
  low: 'orange',
  very_low: 'red',
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
// ⚠ NOTE FOR WHOEVER PRUNES THIS FILE NEXT: `ROBUSTNESS_LEVEL_COLOURS` and
// `SWITCH_PROBABILITY_THRESHOLD` also read ZERO consumers, but they were already
// dead BEFORE this PR — they are not residue from this deletion and are
// deliberately left alone here rather than absorbed into an unrelated train.

/**
 * Epsilon for baseline delta display.
 * Deltas with absolute value less than this are shown as "Same as baseline".
 */
export const BASELINE_DELTA_EPSILON = 0.05

/**
 * Switch probability threshold for filtering fragile edges.
 * Only edges with switch_probability > this value are shown.
 */
export const SWITCH_PROBABILITY_THRESHOLD = 0.3

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
