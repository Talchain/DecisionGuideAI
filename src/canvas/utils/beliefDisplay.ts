/**
 * Belief Display Utilities
 *
 * UI-only transformations for displaying belief as confidence.
 *
 * CRITICAL:
 * - Belief (0-1): Technical model where 0 = certain, 1 = maximum uncertainty
 * - Confidence (0-100%): User-facing where 0% = uncertain, 100% = certain
 * - Transformation is UI-ONLY (store and API still use 0-1 belief values)
 */

/**
 * Convert belief (0-1, inverted) to confidence percent (0-100, intuitive)
 *
 * @param belief - Belief value (0 = certain, 1 = max uncertainty)
 * @returns Confidence percentage (0% = uncertain, 100% = certain)
 *
 * @example
 * beliefToConfidencePercent(0) // 100 (certain → 100% confidence)
 * beliefToConfidencePercent(0.3) // 70 (low uncertainty → 70% confidence)
 * beliefToConfidencePercent(1) // 0 (max uncertainty → 0% confidence)
 */
export function beliefToConfidencePercent(belief: number): number {
  return (1 - belief) * 100
}

/**
 * Convert confidence percent (0-100, intuitive) to belief (0-1, inverted)
 *
 * @param percent - Confidence percentage (0% = uncertain, 100% = certain)
 * @returns Belief value (0 = certain, 1 = max uncertainty)
 *
 * @example
 * confidencePercentToBelief(100) // 0 (100% confidence → certain)
 * confidencePercentToBelief(70) // 0.3 (70% confidence → low uncertainty)
 * confidencePercentToBelief(0) // 1 (0% confidence → max uncertainty)
 */
export function confidencePercentToBelief(percent: number): number {
  return 1 - percent / 100
}

/**
 * Format confidence percent for display
 *
 * @param percent - Confidence percentage
 * @returns Formatted string (e.g., "70%")
 */
export function formatConfidencePercent(percent: number): string {
  return `${Math.round(percent)}%`
}

/**
 * Get confidence level label
 *
 * @param percent - Confidence percentage
 * @returns Label describing confidence level
 */
export function getConfidenceLabel(percent: number): string {
  if (percent >= 90) return 'Very certain'
  if (percent >= 70) return 'Moderately certain'
  if (percent >= 50) return 'Somewhat certain'
  if (percent >= 30) return 'Somewhat uncertain'
  if (percent >= 10) return 'Moderately uncertain'
  return 'Very uncertain'
}

/**
 * Round-trip validation: Ensure no precision loss
 *
 * Tests that converting belief → confidence → belief preserves the original value.
 * Used in unit tests to verify transformation correctness.
 */
export function validateRoundTrip(belief: number, epsilon = 0.0001): boolean {
  const confidence = beliefToConfidencePercent(belief)
  const roundTrip = confidencePercentToBelief(confidence)
  return Math.abs(belief - roundTrip) < epsilon
}
