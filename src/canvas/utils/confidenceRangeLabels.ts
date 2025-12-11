/**
 * Confidence Range Labeling Utilities
 *
 * Task 3.9: Single source of truth for confidence range labels.
 * Ensures consistent terminology across all components.
 */

/**
 * Percentile labels with user-friendly terminology
 */
export const PERCENTILE_LABELS = {
  p10: {
    short: 'Worst case',
    long: 'Worst case scenario',
    percentile: '10th percentile',
    explanation: '90% of outcomes are expected to be better than this',
  },
  p15: {
    short: '15th',
    long: 'Lower bound',
    percentile: '15th percentile',
    explanation: 'Low end of the 70% confidence range',
  },
  p50: {
    short: 'Most likely',
    long: 'Most likely outcome',
    percentile: '50th percentile (median)',
    explanation: 'The central estimate - equally likely to be higher or lower',
  },
  p85: {
    short: '85th',
    long: 'Upper bound',
    percentile: '85th percentile',
    explanation: 'High end of the 70% confidence range',
  },
  p90: {
    short: 'Best case',
    long: 'Best case scenario',
    percentile: '90th percentile',
    explanation: '90% of outcomes are expected to be worse than this',
  },
} as const

/**
 * Confidence range names with consistent terminology
 */
export const CONFIDENCE_RANGES = {
  /** p10 to p90: 80% of outcomes */
  full: {
    label: 'Full Range',
    shortLabel: 'Range',
    description: '80% of outcomes fall within this range',
    percentiles: 'p10–p90',
  },
  /** p15 to p85: ~70% of outcomes */
  core: {
    label: '70% Confidence Range',
    shortLabel: '70% likely',
    description: 'Most outcomes will fall within this range',
    percentiles: 'p15–p85',
  },
} as const

/**
 * Get label for a percentile value
 */
export function getPercentileLabel(
  percentile: 'p10' | 'p15' | 'p50' | 'p85' | 'p90',
  variant: 'short' | 'long' | 'percentile' = 'short'
): string {
  return PERCENTILE_LABELS[percentile][variant]
}

/**
 * Get confidence range label
 */
export function getConfidenceRangeLabel(
  range: 'full' | 'core',
  variant: 'label' | 'shortLabel' = 'label'
): string {
  return CONFIDENCE_RANGES[range][variant]
}

/**
 * Get explanation for why a range matters
 */
export function getConfidenceRangeExplanation(range: 'full' | 'core'): string {
  return CONFIDENCE_RANGES[range].description
}

/**
 * Format a confidence range display string
 * @example formatConfidenceRangeDisplay(15, 85, 'percent') => "15% – 85%"
 */
export function formatConfidenceRangeDisplay(
  lower: number,
  upper: number,
  units: 'percent' | 'currency' | 'count' = 'percent',
  options?: { includeLabel?: boolean }
): string {
  const { includeLabel = false } = options || {}

  const formatValue = (value: number): string => {
    if (units === 'currency') {
      return `$${value.toLocaleString()}`
    }
    if (units === 'count') {
      return value.toLocaleString()
    }
    // Default percent - handle 0-1 scale
    const displayValue = value >= 0 && value <= 1 ? value * 100 : value
    return `${displayValue.toFixed(0)}%`
  }

  const rangeText = `${formatValue(lower)} – ${formatValue(upper)}`

  if (includeLabel) {
    return `70% likely: ${rangeText}`
  }

  return rangeText
}

/**
 * Get tooltip content for confidence range
 */
export function getConfidenceRangeTooltip(range: 'full' | 'core'): string {
  if (range === 'core') {
    return 'This range contains 70% of expected outcomes. The actual result has about a 15% chance of being below and 15% chance of being above this range.'
  }
  return 'This range contains 80% of expected outcomes, from worst case (10th percentile) to best case (90th percentile).'
}
