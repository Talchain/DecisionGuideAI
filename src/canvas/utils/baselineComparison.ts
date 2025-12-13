/**
 * Baseline Comparison Utilities
 *
 * Unified logic for comparing outcome values against baselines.
 * Single source of truth for OutcomesSignal, DecisionSummary, and other components.
 *
 * Fixes:
 * - P0: Consistent detection of probability vs percent vs currency/count
 * - P0: Unified comparison logic across components
 */

import type { OutcomeUnits } from '../../lib/format'

export interface BaselineComparisonInput {
  /** Current outcome value (p50) */
  value: number
  /** Baseline value to compare against */
  baseline: number
  /** Units of the outcome */
  units: OutcomeUnits
  /** Goal direction for interpreting positive/negative */
  goalDirection: 'maximize' | 'minimize'
}

export interface BaselineComparisonResult {
  /** Raw delta (value - baseline) */
  delta: number
  /** Formatted display string (e.g., "+5 pts", "+12%", "$500") */
  display: string
  /** Whether the change is an increase */
  isIncrease: boolean
  /** Whether the change is positive (good) based on goal direction */
  isPositive: boolean
  /** Whether this is using absolute points (vs relative %) */
  isAbsoluteChange: boolean
  /** Whether values are in probability scale (0-1) */
  isProbabilityScale: boolean
}

/**
 * Detect if a value appears to be in probability scale (0-1).
 *
 * IMPORTANT: Only treat as probability if units are 'percent' or unspecified.
 * Currency values like $0.75 should NOT be treated as probabilities.
 */
export function isProbabilityScale(value: number, units: OutcomeUnits): boolean {
  // Only percent/unspecified units can be probabilities
  if (units === 'currency' || units === 'count') {
    return false
  }
  // Check if value is in 0-1 range
  return value >= 0 && value <= 1
}

/**
 * Get threshold for "negligible" change based on units and scale.
 *
 * - For 0-1 probability: 0.005 (0.5 percentage points)
 * - For 0-100 percent: 0.5 percentage points
 * - For currency/count: 1% of baseline or 1 unit (whichever is larger)
 */
export function getChangeThreshold(
  value: number,
  baseline: number,
  units: OutcomeUnits
): number {
  const isProb = isProbabilityScale(value, units)

  if (units === 'percent' || (units !== 'currency' && units !== 'count')) {
    // Percent/probability
    return isProb ? 0.005 : 0.5
  }

  // Currency/count: 1% of baseline or 1 unit
  return Math.max(Math.abs(baseline) * 0.01, 1)
}

/**
 * Compute baseline comparison with unified logic.
 *
 * Returns null if:
 * - Either value is null/undefined
 * - Change is below threshold (negligible)
 */
export function computeBaselineComparison(
  input: Partial<BaselineComparisonInput>
): BaselineComparisonResult | null {
  const {
    value,
    baseline,
    units = 'percent',
    goalDirection = 'maximize',
  } = input

  // Guard against null/undefined
  if (value === null || value === undefined || baseline === null || baseline === undefined) {
    return null
  }

  const delta = value - baseline

  // Check if change is negligible
  const threshold = getChangeThreshold(value, baseline, units)
  if (Math.abs(delta) < threshold) {
    return null
  }

  const isProb = isProbabilityScale(value, units)
  const isIncrease = delta > 0
  const isPositive =
    (goalDirection === 'maximize' && isIncrease) ||
    (goalDirection === 'minimize' && !isIncrease)

  // Format display string based on units
  let display: string
  let isAbsoluteChange = false

  if (units === 'percent' || (units !== 'currency' && units !== 'count' && isProb)) {
    // Percent/probability: always show absolute points
    // This avoids confusing "99% worse" when going from 100% to 1%
    const deltaPts = isProb ? delta * 100 : delta
    display = `${isIncrease ? '+' : ''}${Math.round(deltaPts)} pts`
    isAbsoluteChange = true
  } else if (units === 'currency') {
    // Currency: show relative % for non-zero baseline, absolute for zero baseline
    if (baseline === 0) {
      const symbol = '$' // Could be passed in if needed
      display = `${isIncrease ? '+' : ''}${symbol}${Math.abs(delta).toFixed(0)}`
      isAbsoluteChange = true
    } else {
      const pctChange = (delta / Math.abs(baseline)) * 100
      display = `${isIncrease ? '+' : ''}${pctChange.toFixed(0)}%`
    }
  } else {
    // Count/other: show relative % for non-zero baseline, absolute for zero baseline
    if (baseline === 0) {
      display = `${isIncrease ? '+' : ''}${Math.abs(delta).toFixed(0)}`
      isAbsoluteChange = true
    } else {
      const pctChange = (delta / Math.abs(baseline)) * 100
      display = `${isIncrease ? '+' : ''}${pctChange.toFixed(0)}%`
    }
  }

  return {
    delta,
    display,
    isIncrease,
    isPositive,
    isAbsoluteChange,
    isProbabilityScale: isProb,
  }
}

/**
 * Get human-readable comparison text for UI display.
 *
 * Returns e.g., "+5 pts better than baseline" or "12% worse than baseline"
 */
export function getBaselineComparisonText(
  comparison: BaselineComparisonResult,
  baselineName = 'baseline'
): string {
  const qualifier = comparison.isPositive ? 'better' : 'worse'
  return `${comparison.display} ${qualifier} than ${baselineName}`
}
