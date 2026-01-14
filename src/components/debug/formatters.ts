/**
 * Debug Panel Shared Formatters
 *
 * Safe formatters that handle null/undefined/NaN/Infinity values without crashing.
 * Use these instead of raw .toFixed() calls.
 *
 * Also includes error code explanation utilities for Debug Panel.
 */

import { getDebugErrorExplanation, type DebugErrorExplanation } from '../../canvas/utils/errorTaxonomy'

export { getDebugErrorExplanation, type DebugErrorExplanation }

/**
 * Safely format a number with specified decimal places.
 * Returns fallback string for null/undefined/NaN/Infinity.
 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 2,
  fallback = '—'
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback
  }
  return value.toFixed(decimals)
}

/**
 * Format milliseconds as seconds (e.g., "1.23s").
 * Returns "—" for invalid values.
 */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return '—'
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format milliseconds as seconds with 1 decimal place (e.g., "1.2s").
 * Returns "—" for invalid values.
 */
export function formatMsShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return '—'
  }
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Format a 0-1 value as a percentage (e.g., "85.5%").
 * Returns "—" for invalid values.
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
  fallback = '—'
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback
  }
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a coefficient value (e.g., "0.85").
 * Returns "—" for invalid values.
 */
export function formatCoeff(
  value: number | null | undefined,
  decimals = 2,
  fallback = '—'
): string {
  return formatNumber(value, decimals, fallback)
}

/**
 * Format a delta/change value with sign (e.g., "+3.8%" or "-1.2%").
 * Returns "—" for invalid values.
 */
export function formatDelta(
  value: number | null | undefined,
  decimals = 1,
  fallback = '—'
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a raw delta value with sign (not multiplied by 100).
 * Returns "—" for invalid values.
 */
export function formatRawDelta(
  value: number | null | undefined,
  decimals = 3,
  fallback = '—'
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}`
}

// =============================================================================
// HTTP Status Helpers
// =============================================================================

export interface StatusDisplay {
  label: string
  color: string
  isError: boolean
}

/**
 * Get display properties for HTTP status code.
 * Status 0 is special: it means network error/aborted, NOT pending.
 *
 * @param status - HTTP status code (0 = network error)
 * @param hasError - Whether there's an error object
 * @param isComplete - Whether the request completed
 */
export function getStatusDisplay(
  status: number | null | undefined,
  hasError = false,
  isComplete = true
): StatusDisplay {
  // Status 0 = network error, abort, or CORS issue
  if (status === 0) {
    if (hasError) {
      return { label: 'Network Error', color: 'text-red-600', isError: true }
    }
    if (!isComplete) {
      return { label: 'In Flight', color: 'text-amber-600', isError: false }
    }
    return { label: 'Aborted', color: 'text-stone-500', isError: true }
  }

  // No status yet = pending
  if (status == null) {
    return { label: 'Pending', color: 'text-amber-600', isError: false }
  }

  // Success (2xx)
  if (status >= 200 && status < 300) {
    return { label: `${status} OK`, color: 'text-green-600', isError: false }
  }

  // Client error (4xx)
  if (status >= 400 && status < 500) {
    return { label: `${status} Error`, color: 'text-red-600', isError: true }
  }

  // Server error (5xx)
  if (status >= 500) {
    return { label: `${status} Error`, color: 'text-red-600', isError: true }
  }

  // Other (1xx, 3xx)
  return { label: `${status}`, color: 'text-stone-600', isError: false }
}

/**
 * Format HTTP status for display.
 * Handles status 0 correctly as network error.
 */
export function formatStatus(
  status: number | null | undefined,
  hasError = false,
  isComplete = true
): string {
  return getStatusDisplay(status, hasError, isComplete).label
}

// =============================================================================
// Enhanced Status Display with Error Explanations
// =============================================================================

export interface EnhancedStatusDisplay extends StatusDisplay {
  /** Human-readable status label (e.g., "Bad Request") */
  errorLabel: string | null
  /** Technical hint for debugging */
  hint: string | null
}

/**
 * Get enhanced status display with error explanation.
 * Combines status display logic with debug error explanations.
 *
 * @param status - HTTP status code (0 = network error)
 * @param hasError - Whether there's an error object
 * @param isComplete - Whether the request completed
 */
export function getEnhancedStatusDisplay(
  status: number | null | undefined,
  hasError = false,
  isComplete = true
): EnhancedStatusDisplay {
  const baseDisplay = getStatusDisplay(status, hasError, isComplete)
  const explanation = getDebugErrorExplanation(status)

  return {
    ...baseDisplay,
    errorLabel: explanation?.label ?? null,
    hint: explanation?.hint ?? null,
  }
}

/**
 * Format HTTP status with error label for display.
 * Example: "400 Bad Request" instead of "400 Error"
 */
export function formatStatusWithLabel(
  status: number | null | undefined,
  hasError = false,
  isComplete = true
): string {
  const display = getEnhancedStatusDisplay(status, hasError, isComplete)

  // For error statuses, use the error label if available
  if (display.isError && display.errorLabel) {
    if (status === 0 || status === 'Network Error') {
      return 'Network Error'
    }
    return `${status} ${display.errorLabel}`
  }

  return display.label
}
