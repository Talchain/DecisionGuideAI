/**
 * P0.2 — Confidence ↔ Precision Alignment
 *
 * Utility for displaying outcome values with appropriate precision based on confidence level.
 *
 * Rule:
 * - HIGH confidence: Point estimate (p50) as headline. Range in secondary text optional.
 * - MEDIUM confidence: Range only (p10–p90) as headline. No single-point percentage.
 * - LOW confidence: Range only (p10–p90) as headline. Add qualifier: "Model needs strengthening"
 *
 * Edge case: If quantiles unavailable, show qualitative summary rather than inventing precision.
 */

import { formatOutcomeValue, type OutcomeUnits } from './format'

// =============================================================================
// Types
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface QuantileValues {
  p10?: number  // Conservative (10th percentile)
  p50?: number  // Likely (median)
  p90?: number  // Optimistic (90th percentile)
}

export interface PrecisionDisplayResult {
  /** Main headline value or range */
  headline: string

  /** Secondary text (range when headline is point, null otherwise) */
  secondary: string | null

  /** Qualifier text for low confidence */
  qualifier: string | null

  /** Whether this is a point estimate (true) or range (false) */
  isPointEstimate: boolean

  /** Display type for styling */
  displayType: 'point' | 'range' | 'qualitative'
}

export interface PrecisionDisplayInput {
  confidenceLevel: ConfidenceLevel
  quantiles: QuantileValues
  units?: OutcomeUnits
  unitSymbol?: string
}

// =============================================================================
// Core Logic
// =============================================================================

/**
 * Format a range string from p10 to p90
 */
function formatRange(
  p10: number,
  p90: number,
  units: OutcomeUnits = 'percent',
  unitSymbol?: string
): string {
  const low = formatOutcomeValue(p10, units, unitSymbol)
  const high = formatOutcomeValue(p90, units, unitSymbol)
  return `${low}–${high}`
}

/**
 * Check if quantiles are available and valid
 */
function hasValidQuantiles(quantiles: QuantileValues): boolean {
  return (
    quantiles.p50 !== undefined &&
    !isNaN(quantiles.p50)
  )
}

/**
 * Check if range quantiles are available
 */
function hasValidRange(quantiles: QuantileValues): boolean {
  return (
    quantiles.p10 !== undefined &&
    quantiles.p90 !== undefined &&
    !isNaN(quantiles.p10) &&
    !isNaN(quantiles.p90)
  )
}

/**
 * Get qualitative description when no quantiles available
 */
function getQualitativeDescription(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case 'high':
      return 'Outcome appears favorable'
    case 'medium':
      return 'Outcome direction is positive'
    case 'low':
      return 'Insufficient data for estimate'
    default:
      return 'Analysis in progress'
  }
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Compute precision-appropriate display for outcome values
 *
 * P0.2 Rule: No headline value is a single-point % unless confidence.level === 'HIGH'
 *
 * @example
 * // High confidence: show point estimate
 * getPrecisionDisplay({ confidenceLevel: 'high', quantiles: { p10: 40, p50: 65, p90: 80 } })
 * // => { headline: '65%', secondary: '40%–80%', qualifier: null, isPointEstimate: true }
 *
 * // Medium confidence: show range only
 * getPrecisionDisplay({ confidenceLevel: 'medium', quantiles: { p10: 40, p50: 65, p90: 80 } })
 * // => { headline: '40%–80%', secondary: null, qualifier: null, isPointEstimate: false }
 *
 * // Low confidence: show range with qualifier
 * getPrecisionDisplay({ confidenceLevel: 'low', quantiles: { p10: 30, p50: 50, p90: 85 } })
 * // => { headline: '30%–85%', secondary: null, qualifier: 'Model needs strengthening', isPointEstimate: false }
 */
export function getPrecisionDisplay(input: PrecisionDisplayInput): PrecisionDisplayResult {
  const { confidenceLevel, quantiles, units = 'percent', unitSymbol } = input

  // Edge case: No quantiles available
  if (!hasValidQuantiles(quantiles)) {
    return {
      headline: getQualitativeDescription(confidenceLevel),
      secondary: null,
      qualifier: confidenceLevel === 'low' ? 'Model needs strengthening' : null,
      isPointEstimate: false,
      displayType: 'qualitative',
    }
  }

  const p50 = quantiles.p50!
  const hasRange = hasValidRange(quantiles)

  // HIGH confidence: Point estimate as headline
  if (confidenceLevel === 'high') {
    return {
      headline: formatOutcomeValue(p50, units, unitSymbol),
      secondary: hasRange ? formatRange(quantiles.p10!, quantiles.p90!, units, unitSymbol) : null,
      qualifier: null,
      isPointEstimate: true,
      displayType: 'point',
    }
  }

  // MEDIUM confidence: Range only as headline
  if (confidenceLevel === 'medium') {
    if (hasRange) {
      return {
        headline: formatRange(quantiles.p10!, quantiles.p90!, units, unitSymbol),
        secondary: null,
        qualifier: null,
        isPointEstimate: false,
        displayType: 'range',
      }
    }
    // Fallback if no range: show qualitative
    return {
      headline: getQualitativeDescription(confidenceLevel),
      secondary: null,
      qualifier: null,
      isPointEstimate: false,
      displayType: 'qualitative',
    }
  }

  // LOW confidence: Range with qualifier
  if (hasRange) {
    return {
      headline: formatRange(quantiles.p10!, quantiles.p90!, units, unitSymbol),
      secondary: null,
      qualifier: 'Model needs strengthening',
      isPointEstimate: false,
      displayType: 'range',
    }
  }

  // Fallback for low confidence without range
  return {
    headline: getQualitativeDescription(confidenceLevel),
    secondary: null,
    qualifier: 'Model needs strengthening',
    isPointEstimate: false,
    displayType: 'qualitative',
  }
}

/**
 * Quick check if we should show point estimate based on confidence
 */
export function shouldShowPointEstimate(confidenceLevel: ConfidenceLevel): boolean {
  return confidenceLevel === 'high'
}

/**
 * Get confidence-appropriate styling class
 */
export function getConfidenceColorClass(confidenceLevel: ConfidenceLevel): string {
  switch (confidenceLevel) {
    case 'high':
      return 'text-mint-700'
    case 'medium':
      return 'text-banana-700'
    case 'low':
      return 'text-carrot-700'
    default:
      return 'text-ink-700'
  }
}
