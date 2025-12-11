/**
 * Shared Numeric Formatting Utilities
 *
 * Consolidates formatting logic for outcome values across the codebase.
 * Supports currency, percentage, and count formats with smart suffixes (K/M).
 *
 * IMPORTANT: When updating formatting logic, update all variants consistently.
 */

export type OutcomeUnits = 'currency' | 'percent' | 'count'

interface FormatOptions {
  /** Number of decimal places for standard values (default: 1) */
  decimals?: number
  /** Number of decimal places for compact format (default: 0) */
  compactDecimals?: number
  /** Placeholder for null/NaN values (default: '—') */
  nullPlaceholder?: string
}

/**
 * Format a numeric value based on its units type.
 *
 * Handles:
 * - Currency: Smart K/M suffixes (e.g., $1.5M, $200K)
 * - Percent: Auto-detects 0-1 probability format (0.75 → 75%)
 * - Count: Locale-formatted numbers with optional K/M
 *
 * @param value - The numeric value to format (supports null)
 * @param units - The unit type: 'currency' | 'percent' | 'count'
 * @param unitSymbol - Optional currency symbol (default: '$')
 * @param options - Optional formatting options
 */
export function formatOutcomeValue(
  value: number | null,
  units: OutcomeUnits,
  unitSymbol?: string,
  options: FormatOptions = {}
): string {
  const { decimals = 1, nullPlaceholder = '—' } = options

  if (value === null || Number.isNaN(value)) {
    return nullPlaceholder
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''

    if (absolute >= 1_000_000) {
      return `${prefix}${symbol}${(absolute / 1_000_000).toFixed(decimals)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${symbol}${(absolute / 1_000).toFixed(decimals)}K`
    }
    return `${prefix}${symbol}${absolute.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'percent') {
    // Auto-detect if value is in 0-1 probability form vs already percentage
    // Values in 0-1 range (inclusive) are treated as probabilities: 0.5 → 50%, 1 → 100%
    const isProbability = value >= 0 && value <= 1
    const displayValue = isProbability ? value * 100 : value
    return `${displayValue.toFixed(decimals)}%`
  }

  // Count: auto-detect probability format for 0-1 values with decimals
  if (value >= 0 && value <= 1 && (value !== Math.floor(value) || value === 0 || value === 1)) {
    return `${(value * 100).toFixed(decimals)}%`
  }

  const absolute = Math.abs(value)
  const prefix = value < 0 ? '-' : ''

  if (absolute >= 1_000_000) {
    return `${prefix}${(absolute / 1_000_000).toFixed(decimals)}M`
  }
  if (absolute >= 1_000) {
    return `${prefix}${(absolute / 1_000).toFixed(decimals)}K`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Compact variant of formatOutcomeValue.
 * Uses fewer decimal places for tighter UI spaces.
 *
 * @param value - The numeric value to format
 * @param units - The unit type
 * @param unitSymbol - Optional currency symbol
 */
export function formatOutcomeValueCompact(
  value: number | null,
  units: OutcomeUnits,
  unitSymbol?: string
): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    if (Math.abs(value) >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(0)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(0)}K`
    }
    return `${symbol}${Math.round(value)}`
  }

  // Default (percent)
  const isProbability = value >= 0 && value <= 1
  const displayValue = isProbability ? value * 100 : value
  return `${Math.round(displayValue)}%`
}

/**
 * Format a delta percentage for comparison display.
 * Always includes sign prefix (+/-).
 *
 * @param deltaPercent - The percentage change value
 */
export function formatDeltaPercent(deltaPercent: number): string {
  const sign = deltaPercent >= 0 ? '+' : ''
  return `${sign}${deltaPercent.toFixed(1)}%`
}

/**
 * Format confidence as percentage for display.
 * Converts 0-1 confidence value to percentage string.
 *
 * @param confidence - Confidence value (0-1) or undefined
 */
export function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return 'Unknown'
  return `${Math.round(confidence * 100)}%`
}

/**
 * Format a confidence percentage (already in 0-100 range).
 *
 * @param percent - Confidence percentage (0-100)
 */
export function formatConfidencePercent(percent: number): string {
  return `${Math.round(percent)}%`
}

/**
 * Format a range of values with consistent en-dash delimiter.
 * Standardizes "X – Y" format across all range displays.
 *
 * @param lower - Lower bound value
 * @param upper - Upper bound value
 * @param units - Unit type for formatting values
 * @param unitSymbol - Optional currency symbol
 */
export function formatRange(
  lower: number | null,
  upper: number | null,
  units: OutcomeUnits = 'percent',
  unitSymbol?: string
): string {
  const formattedLower = formatOutcomeValueCompact(lower, units, unitSymbol)
  const formattedUpper = formatOutcomeValueCompact(upper, units, unitSymbol)
  // Use en-dash with spaces for consistent range formatting
  return `${formattedLower} – ${formattedUpper}`
}

/**
 * Format a delta value with sign prefix.
 * Shows "+X%" for increases, "-X%" for decreases.
 *
 * @param value - The change value (already as percentage points)
 * @param showPositiveSign - Whether to show "+" for positive values (default: true)
 */
export function formatDelta(
  value: number,
  showPositiveSign = true
): string {
  const sign = value > 0 && showPositiveSign ? '+' : ''
  return `${sign}${value.toFixed(0)}%`
}

/**
 * Format a value as percentage, ensuring "X%" format (never "X pts" or "X points").
 * Auto-detects 0-1 probability scale.
 *
 * @param value - The value to format
 * @param decimals - Decimal places (default: 0)
 */
export function formatPercent(value: number, decimals = 0): string {
  // Auto-detect if value is in 0-1 probability form
  const isProbability = value >= 0 && value <= 1
  const displayValue = isProbability ? value * 100 : value
  return `${displayValue.toFixed(decimals)}%`
}
