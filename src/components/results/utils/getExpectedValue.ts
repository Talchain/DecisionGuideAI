/**
 * Expected Value Helpers
 *
 * Centralised logic for extracting expected value (mean) and median (p50)
 * from option results. These are semantically distinct values:
 *
 * - Expected (mean): Arithmetic average of all outcomes
 * - Median (p50): 50th percentile — value where half of outcomes are above/below
 *
 * For symmetric distributions, these are equal. For skewed distributions
 * (e.g., high upside potential), they can differ significantly.
 *
 * Example: mean=0.038 (3.8%), p50=0 (0%) for a positively skewed distribution.
 */

import type { OptionResult } from '../types'

/**
 * Extracts expected value from option results.
 * Expected value is the arithmetic mean (average outcome).
 *
 * @param option - The option result to extract from
 * @returns The expected value, or null if unavailable
 */
export function getExpectedValue(option: OptionResult): number | null {
  // Priority: explicit expected > outcome.mean
  // Never fall back to p50 — that's median, semantically different
  return option.expected ?? option.outcome?.mean ?? null
}

/**
 * Extracts median (p50) from option results.
 * Median is the 50th percentile, not the expected value.
 *
 * @param option - The option result to extract from
 * @returns The median value, or null if unavailable
 */
export function getMedian(option: OptionResult): number | null {
  return option.outcome?.p50 ?? null
}

/**
 * Extracts pessimistic outcome (p10) from option results.
 * This is the 10th percentile — 90% of outcomes are better than this.
 *
 * @param option - The option result to extract from
 * @returns The p10 value, or null if unavailable
 */
export function getPessimistic(option: OptionResult): number | null {
  return option.outcome?.p10 ?? null
}

/**
 * Extracts optimistic outcome (p90) from option results.
 * This is the 90th percentile — only 10% of outcomes are better than this.
 *
 * @param option - The option result to extract from
 * @returns The p90 value, or null if unavailable
 */
export function getOptimistic(option: OptionResult): number | null {
  return option.outcome?.p90 ?? null
}

/**
 * Checks if expected value and median differ significantly.
 * This indicates a skewed distribution.
 *
 * @param option - The option result to check
 * @param threshold - Minimum difference to consider significant (default 0.01 = 1%)
 * @returns true if the distribution is skewed
 */
export function isSkewedDistribution(option: OptionResult, threshold = 0.01): boolean {
  const expected = getExpectedValue(option)
  const median = getMedian(option)

  if (expected === null || median === null) {
    return false
  }

  return Math.abs(expected - median) > threshold
}
