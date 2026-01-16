/**
 * Debug Panel V2 Utilities
 *
 * Shared utilities for formatting and data extraction.
 */

/**
 * Format duration in milliseconds to human-readable string.
 * - Returns '—' for null/undefined
 * - Returns 'Xms' for < 1000ms
 * - Returns 'X.XXs' for >= 1000ms
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format node counts for abbreviated display on small screens.
 * Returns "1d, 2o, 6f, 1g" format.
 */
export function formatNodeCountsAbbreviated(connectivity: {
  decision_count: number
  option_count: number
  factor_count: number
  goal_count: number
} | null | undefined): string {
  if (!connectivity) return '—'
  const parts: string[] = []
  if (connectivity.decision_count > 0) parts.push(`${connectivity.decision_count}d`)
  if (connectivity.option_count > 0) parts.push(`${connectivity.option_count}o`)
  if (connectivity.factor_count > 0) parts.push(`${connectivity.factor_count}f`)
  if (connectivity.goal_count > 0) parts.push(`${connectivity.goal_count}g`)
  return parts.join(', ') || '—'
}
