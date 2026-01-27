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

// =============================================================================
// Threshold Constants
// =============================================================================

export const THRESHOLDS = {
  /** Switch probability threshold for filtering fragile edges (>=0.3 shown) */
  FRAGILE_EDGE_FILTER: 0.3,
  /** High stability threshold (>=0.8 = robust) */
  STABILITY_HIGH: 0.8,
  /** Moderate stability threshold (>=0.6 = moderate) */
  STABILITY_MODERATE: 0.6,
  /** Epsilon for baseline delta display (|delta| < 0.05 = "Same as baseline") */
  BASELINE_DELTA_EPSILON: 0.05,
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
 */
export const ROBUSTNESS_LEVEL_DISPLAY: Record<string, RobustnessDisplayConfig> = {
  high: { label: 'Robust', colour: 'green' },
  moderate: { label: 'Moderate', colour: 'amber' },
  medium: { label: 'Moderate', colour: 'amber' }, // Alias for moderate
  low: { label: 'Fragile', colour: 'orange' },
  very_low: { label: 'Very Fragile', colour: 'red' },
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
   * Message for filtered fragile edges disclosure.
   * @param count - Number of filtered assumptions
   * @returns Formatted message with correct singular/plural
   */
  FILTERED_EDGES_TEMPLATE: (count: number): string =>
    `${count} additional assumption${count === 1 ? '' : 's'} changed the best option in <30% of scenarios tested`,

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
    `No high-sensitivity assumptions found. ${count} assumption${count === 1 ? '' : 's'} changed the best option in <${Math.round(threshold * 100)}% of scenarios.`,
} as const
