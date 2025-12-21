/**
 * P0.1 — Contradiction Gating (Drivers + Key Insight)
 *
 * Utility functions to determine when driver-based narratives should be shown.
 * Prevents contradictory states like "No drivers identified" alongside "X is strongly driving outcomes".
 *
 * Rule: Only show driver-based narratives if ALL are true:
 * - drivers_payload?.status === 'ok'
 * - drivers_payload?.informative === true
 * - (drivers_payload?.drivers?.length ?? 0) > 0
 */

import type { DriversPayload, DriversStatus } from '../adapters/driversAdapter'

/**
 * Check if driver-based narratives should be shown.
 * Returns true only when all gating conditions are met.
 */
export function areDriversInformative(driversPayload?: DriversPayload | null): boolean {
  if (!driversPayload) return false

  return (
    driversPayload.status === 'ok' &&
    driversPayload.informative === true &&
    (driversPayload.drivers?.length ?? 0) > 0
  )
}

/**
 * Get the fallback message to show when drivers are not informative.
 * Priority: status_reason > default message based on status
 */
export function getDriversFallbackMessage(
  driversPayload?: DriversPayload | null
): string {
  if (!driversPayload) {
    return 'Run analysis to identify what drives your outcome.'
  }

  // Use status_reason if provided
  if (driversPayload.status_reason) {
    return driversPayload.status_reason
  }

  // Default messages by status
  switch (driversPayload.status) {
    case 'ok':
      // Status is ok but not informative (no drivers or informative=false)
      return 'Not enough signal to identify what\'s driving the result yet.'

    case 'low_discrimination':
      return 'Options produce similar outcomes. Add factors that differentiate them.'

    case 'cannot_compute':
      return 'Unable to compute driver analysis. Try adjusting your model structure.'

    case 'requires_run':
      return 'Run analysis to identify what drives your outcome.'

    default:
      return 'Not enough signal to identify what\'s driving the result yet.'
  }
}

/**
 * Get remediation actions for display when drivers are not informative.
 * Returns default actions based on status if none provided.
 */
export interface RemediationAction {
  code: string
  label: string
}

const DEFAULT_REMEDIATION_ACTIONS: Record<DriversStatus, RemediationAction[]> = {
  ok: [
    { code: 'add_factors', label: 'Add more factors that could affect the outcome' },
  ],
  low_discrimination: [
    { code: 'vary_weights', label: 'Vary edge weights to reflect different influence strengths' },
    { code: 'add_differentiators', label: 'Add factors that differentiate your options' },
  ],
  cannot_compute: [
    { code: 'simplify_model', label: 'Simplify model structure' },
    { code: 'rerun', label: 'Re-run analysis' },
  ],
  requires_run: [
    { code: 'run_analysis', label: 'Run analysis' },
  ],
}

export function getRemediationActions(
  driversPayload?: DriversPayload | null
): RemediationAction[] {
  if (!driversPayload) {
    return DEFAULT_REMEDIATION_ACTIONS.requires_run
  }

  // Use provided actions if available
  if (driversPayload.remediation_actions && driversPayload.remediation_actions.length > 0) {
    return driversPayload.remediation_actions.map(a => ({
      code: a.code,
      label: a.label,
    }))
  }

  // Fall back to defaults based on status
  return DEFAULT_REMEDIATION_ACTIONS[driversPayload.status] ?? []
}

/**
 * Complete gating state for components to consume
 */
export interface DriversGatingState {
  /** Whether driver narratives should be shown */
  showDriverNarratives: boolean

  /** Fallback message when drivers not shown */
  fallbackMessage: string

  /** Remediation actions (max 3) */
  remediationActions: RemediationAction[]

  /** Raw status for conditional styling */
  status: DriversStatus | 'unknown'
}

export function getDriversGatingState(
  driversPayload?: DriversPayload | null
): DriversGatingState {
  const showDriverNarratives = areDriversInformative(driversPayload)

  return {
    showDriverNarratives,
    fallbackMessage: getDriversFallbackMessage(driversPayload),
    remediationActions: getRemediationActions(driversPayload).slice(0, 3),
    status: driversPayload?.status ?? 'unknown',
  }
}
