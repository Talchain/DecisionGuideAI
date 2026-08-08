/**
 * Mapper Constants
 *
 * Canonical thresholds, field names, and display configuration.
 * Single source of truth for the results data pipeline.
 *
 * Key contracts:
 * - Use FIELDS.FRAGILE_PROBABILITY for filtering (NOT marginal_switch_probability)
 * - Use ROBUSTNESS_LEVEL_DISPLAY for badge mapping from robustness.level
 * - Use COPY templates for user-facing messages ("assumptions" NOT "edges")
 */

// The badge WORDS live in one place (ROADMAP 2.928 member d). `lib/stability.ts`
// imports only a type from `./types`, so this import cannot cycle.
import { ROBUSTNESS_BADGE_LABELS } from '../stability'

// =============================================================================
// Threshold Constants
// =============================================================================

export const THRESHOLDS = {
  /** Switch probability threshold for filtering fragile edges (>0.15 shown) */
  FRAGILE_EDGE_FILTER: 0.15, // Spec Section 6.3: switch_probability > 0.15
  // Stability thresholds removed — canonical source is src/lib/stability.ts
  /** Epsilon for baseline delta display (|delta| < 0.05 = "Same as baseline") */
  BASELINE_DELTA_EPSILON: 0.05,
  /** Task 2: Below this value = effectively zero impact */
  FACTOR_ZERO_IMPACT: 0.01,
} as const

// =============================================================================
// Display Limits
// =============================================================================

export const LIMITS = {
  /** Maximum fragile edges to display before "show more" */
  FRAGILE_EDGES_DISPLAY: 3,
  /** Maximum top drivers to show by default */
  TOP_DRIVERS_DISPLAY: 3,
} as const

// =============================================================================
// Field Name Constants
// =============================================================================

/**
 * Canonical field names for data extraction.
 * Use these instead of hardcoded strings to ensure consistency.
 */
export const FIELDS = {
  /** Primary field for fragile edge probability - NOT marginal_switch_probability */
  FRAGILE_PROBABILITY: 'switch_probability',
  /** Fallback field (legacy/deprecated) */
  FRAGILE_PROBABILITY_LEGACY: 'marginal_switch_probability',
} as const

// =============================================================================
// Robustness Display Configuration
// =============================================================================

export type BadgeColour = 'green' | 'amber' | 'orange' | 'red' | 'grey'

export interface RobustnessDisplayConfig {
  label: string
  colour: BadgeColour
}

/**
 * Robustness level to display mapping.
 * CRITICAL: Badge MUST derive from robustness.level field, NOT from recommendation_stability.
 *
 * ⭐ ROADMAP 2.928 member (d) — THE LABELS ARE DERIVED, NOT COPIED. They used to
 * be five string literals here, five more in `components/results/constants.ts`
 * and four more in `lib/stability.ts`: one register, three hand-maintained
 * mirrors (CLAUDE.md trap 12). The COLOUR stays local — it is a per-surface
 * display decision and folding it into the shared register would give the
 * register a second owner. `medium` remains a declared alias of `moderate` for
 * legacy producer values, and now derives from the same entry, so the alias
 * cannot drift from what it aliases either.
 */
export const ROBUSTNESS_LEVEL_DISPLAY: Record<string, RobustnessDisplayConfig> = {
  high: { label: ROBUSTNESS_BADGE_LABELS.high, colour: 'green' },
  moderate: { label: ROBUSTNESS_BADGE_LABELS.moderate, colour: 'amber' },
  medium: { label: ROBUSTNESS_BADGE_LABELS.moderate, colour: 'amber' }, // Alias for moderate
  low: { label: ROBUSTNESS_BADGE_LABELS.low, colour: 'orange' },
  very_low: { label: ROBUSTNESS_BADGE_LABELS.very_low, colour: 'red' },
} as const

// =============================================================================
// Copy Templates
// =============================================================================

/**
 * User-facing message templates.
 * Use "assumptions" terminology, NOT "edges".
 */
export const COPY = {
  /**
   * Message for filtered fragile edges disclosure (below threshold).
   * @param count - Number of filtered assumptions
   * @returns Formatted message with correct singular/plural
   */
  FILTERED_EDGES_TEMPLATE: (count: number): string =>
    `${count} additional assumption${count === 1 ? '' : 's'} changed which option ranks first in <30% of simulations`,

  /**
   * Task 1: Message for hidden high-risk edges (above threshold but cut by display limit).
   * @param count - Number of hidden high-risk assumptions
   * @returns Formatted message with correct singular/plural
   */
  HIDDEN_HIGH_RISK_TEMPLATE: (count: number): string =>
    `${count} more assumption${count === 1 ? '' : 's'} above threshold not shown`,

  /**
   * Message for individual fragile edge description.
   * @param fromLabel - Source node label
   * @param toLabel - Target node label
   * @returns Formatted message
   */
  FRAGILE_EDGE_TEMPLATE: (fromLabel: string, toLabel: string): string =>
    `If "${fromLabel} → ${toLabel}" changes significantly`,

  /** Empty state when no sensitive assumptions identified */
  NO_SENSITIVE_ASSUMPTIONS: 'No sensitive assumptions identified at the current threshold.',

  /** Pre-run empty state for uncertainties */
  UNCERTAINTIES_PRE_RUN: 'Analysis will identify sensitive assumptions once you run.',

  /** Message when all assumptions below threshold */
  ALL_BELOW_THRESHOLD: (count: number, threshold: number): string =>
    `No high-sensitivity assumptions found. ${count} assumption${count === 1 ? '' : 's'} changed which option ranks first in <${Math.round(threshold * 100)}% of simulations.`,

  /** Task 3: Empty improvements message when model is in good state */
  IMPROVEMENTS_EMPTY_READY: 'No improvements identified — your model structure is sound.',

  /** Task 3: Empty improvements message when model needs attention */
  IMPROVEMENTS_EMPTY_PARTIAL: 'No structural issues detected. Focus on the assumptions above.',

  // ==========================================================================
  // Near-Tie Messages
  // ==========================================================================

  /** Generic near-tie message when gap is zero or unavailable */
  NEAR_TIE_MESSAGE: 'The top options are too close to call. Small changes in your assumptions could shift the result.',

  /**
   * Near-tie message with gap percentage.
   * @param gapPercent - Gap as integer percentage (e.g., 4 for 4%)
   * @returns Formatted message with gap
   */
  NEAR_TIE_WITH_GAP: (gapPercent: number): string =>
    `Only ${gapPercent}% separates the top options — practically tied at this resolution.`,

  /**
   * Tied options message with option labels.
   * @param option1 - First option label
   * @param option2 - Second option label
   * @returns Formatted message with option names
   */
  TIED_OPTIONS_TEMPLATE: (option1: string, option2: string): string =>
    `${option1} and ${option2} are effectively tied within the model's uncertainty.`,

  // ==========================================================================
  // Outcome Range Messages (Task 1 - data-bound copy)
  // ==========================================================================

  /** Message when best case (better bound) is negative */
  OUTCOME_RANGE_NEGATIVE: 'Outcomes are consistently negative in this model. Consider reviewing your assumptions.',

  /** Message when best case is barely positive (near break-even) */
  OUTCOME_RANGE_NEAR_BREAKEVEN: 'High uncertainty — outcomes range from significant decline to near break-even.',

  /** Message when range is wide with meaningful positive upside */
  OUTCOME_RANGE_WIDE: 'Could go either way — from significant decline to strong improvement. Consider strengthening key assumptions.',

  /** Generic fallback for outcome range */
  OUTCOME_RANGE_FALLBACK: 'Consider strengthening key assumptions to reduce uncertainty.',

  // ==========================================================================
  // Similar Outcomes Messages (Task 2 - win probability explanation)
  // ==========================================================================

  /**
   * Message when outcomes are similar but one option wins more consistently.
   * @param optionLabel - Label of the winning option
   * @param winPct - Win percentage as integer (e.g., 63 for 63%)
   * @returns Formatted message explaining win probability
   */
  SIMILAR_OUTCOMES_WITH_WINNER: (optionLabel: string, winPct: number): string =>
    `Expected outcomes are similar, but ${optionLabel} leads in ${winPct}% of simulations — it performs better across more plausible conditions.`,
} as const
