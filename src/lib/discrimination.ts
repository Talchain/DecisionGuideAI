/**
 * Discrimination Signal Module
 *
 * Gets discrimination signal from PLoT engine response.
 * PREFERS engine signal over local fallback calculation.
 *
 * PLoT Contract:
 * - report.discrimination.status: 'ok' | 'low_discrimination'
 * - report.discrimination.metric: 'quantile_spread'
 * - report.discrimination.value: number (normalized spread)
 * - report.discrimination.threshold: 0.05
 * - report.discrimination.affected_option_ids?: string[]
 * - report.discrimination.remediation_actions?: RemediationAction[]
 *
 * Used by:
 * - OutputsDock to show discrimination warnings
 * - Readiness computation
 * - Next steps suggestions
 */

import type { RemediationAction } from '../adapters/driversAdapter'

// =============================================================================
// Types - PLoT Contract
// =============================================================================

/**
 * Discrimination payload from PLoT /v1/run response
 */
export interface DiscriminationPayload {
  status: DiscriminationStatus
  metric: string // 'quantile_spread'
  value: number // Normalized spread value
  threshold: number // 0.05 per contract
  affected_option_ids?: string[]
  remediation_actions?: RemediationAction[]
}

export type DiscriminationStatus = 'ok' | 'low_discrimination'

// =============================================================================
// Types - UI Output
// =============================================================================

/**
 * Complete discrimination display state for UI
 */
export interface DiscriminationDisplayState {
  /** Status from engine or fallback */
  status: DiscriminationStatus

  /** Metric name (quantile_spread for engine, quantile_spread_fallback for local) */
  metric: string

  /** Normalized spread value */
  value: number

  /** Threshold for low discrimination (0.05) */
  threshold: number

  /** Options affected by low discrimination */
  affectedOptionIds?: string[]

  /** Actions to resolve low discrimination */
  remediationActions?: UIRemediationAction[]

  /** Data source for debugging */
  source: 'engine' | 'fallback'
}

export interface UIRemediationAction {
  code: string
  label: string
  targetIds?: string[]
}

/**
 * Summary statistics for fallback calculation
 */
export interface SummaryStats {
  p10: number
  p50: number
  p90: number
}

// =============================================================================
// Constants
// =============================================================================

/** PLoT's threshold for low discrimination */
export const DISCRIMINATION_THRESHOLD = 0.05

/** Metric name for engine signal */
export const ENGINE_METRIC = 'quantile_spread'

/** Metric name for fallback calculation */
export const FALLBACK_METRIC = 'quantile_spread_fallback'

// =============================================================================
// Fallback Calculation
// =============================================================================

/**
 * Compute normalized quantile spread matching PLoT's discrimination metric.
 * PLoT uses: value = |p90 - p10| / baseline, threshold = 0.05
 *
 * @param summary - Summary statistics with p10, p50, p90
 * @returns Fallback discrimination result
 */
function computeFallbackDiscrimination(
  summary: SummaryStats | undefined
): { normalizedSpread: number; isLowDiscrimination: boolean } {
  if (!summary) {
    return { normalizedSpread: 0, isLowDiscrimination: true }
  }

  const { p10, p50, p90 } = summary

  // Calculate absolute spread
  const absoluteSpread = Math.abs(p90 - p10)

  // Normalize by baseline (use p50 as baseline, avoid division by zero)
  const baseline = Math.abs(p50) || 1
  const normalizedSpread = absoluteSpread / baseline

  return {
    normalizedSpread,
    isLowDiscrimination: normalizedSpread < DISCRIMINATION_THRESHOLD,
  }
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Get discrimination signal from PLoT response.
 * PREFERS engine signal over local fallback calculation.
 *
 * @param report - PLoT run report (may contain discrimination payload)
 * @returns Complete discrimination display state
 *
 * @example
 * const discriminationState = getDiscriminationSignal(report)
 * if (discriminationState.status === 'low_discrimination') {
 *   showLowDiscriminationWarning(discriminationState.value)
 * }
 */
export function getDiscriminationSignal(
  report: {
    discrimination?: DiscriminationPayload
    result?: { summary?: SummaryStats }
  }
): DiscriminationDisplayState {
  // PREFER engine signal
  if (report.discrimination) {
    return {
      status: report.discrimination.status,
      metric: report.discrimination.metric,
      value: report.discrimination.value,
      threshold: report.discrimination.threshold,
      affectedOptionIds: report.discrimination.affected_option_ids,
      remediationActions: report.discrimination.remediation_actions?.map(a => ({
        code: a.code,
        label: a.label,
        targetIds: a.target_ids,
      })),
      source: 'engine',
    }
  }

  // FALLBACK to local calculation
  if (import.meta.env.DEV) {
    console.info('[Discrimination] Using client-side fallback - engine signal not present')
  }

  const fallback = computeFallbackDiscrimination(report.result?.summary)

  return {
    status: fallback.isLowDiscrimination ? 'low_discrimination' : 'ok',
    metric: FALLBACK_METRIC,
    value: fallback.normalizedSpread,
    threshold: DISCRIMINATION_THRESHOLD,
    source: 'fallback',
  }
}

/**
 * Check if discrimination is low (model doesn't distinguish well between options)
 */
export function isLowDiscrimination(state: DiscriminationDisplayState): boolean {
  return state.status === 'low_discrimination'
}

/**
 * Get human-readable discrimination message
 */
export function getDiscriminationMessage(state: DiscriminationDisplayState): string {
  if (state.status === 'ok') {
    return 'Model clearly distinguishes between options'
  }

  const spreadPercent = Math.round(state.value * 100)
  const thresholdPercent = Math.round(state.threshold * 100)

  return `Results are very close (${spreadPercent}% spread, threshold ${thresholdPercent}%). Consider adding more factors or refining relationships.`
}

/**
 * Get discrimination severity for UI styling
 */
export function getDiscriminationSeverity(
  state: DiscriminationDisplayState
): 'none' | 'warning' | 'error' {
  if (state.status === 'ok') {
    return 'none'
  }

  // Very low spread is more severe
  if (state.value < state.threshold / 2) {
    return 'error'
  }

  return 'warning'
}

/**
 * Format discrimination value for display
 */
export function formatDiscriminationValue(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * Get suggested actions for low discrimination
 */
export function getSuggestedActionsForLowDiscrimination(
  state: DiscriminationDisplayState
): string[] {
  if (state.status === 'ok') {
    return []
  }

  const actions: string[] = []

  // Use remediation actions from engine if available
  if (state.remediationActions && state.remediationActions.length > 0) {
    state.remediationActions.forEach(a => {
      actions.push(a.label)
    })
  } else {
    // Default suggestions
    actions.push('Add more distinguishing factors between options')
    actions.push('Review and strengthen relationships that differ between options')
    actions.push('Consider if options are truly different or should be combined')
  }

  return actions
}

/**
 * Check if we have engine signal (for debugging/telemetry)
 */
export function hasEngineSignal(state: DiscriminationDisplayState): boolean {
  return state.source === 'engine'
}

/**
 * Convert discrimination state to readiness reason format
 */
export function toReadinessReason(
  state: DiscriminationDisplayState
): { code: string; severity: 'warning' | 'info'; message: string; source: string } | null {
  if (state.status === 'ok') {
    return null
  }

  return {
    code: 'low_discrimination',
    severity: 'warning',
    message: 'Model may not clearly distinguish between options',
    source: state.source,
  }
}
