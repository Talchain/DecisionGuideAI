/**
 * Response Normalisation Layer (Phase 0.1)
 *
 * Handles both legacy and V3 backend responses by deriving status
 * fields from data presence when explicit status fields are missing.
 *
 * This prevents UI from showing confident labels when analysis is actually
 * unavailable or incomplete.
 */

// ============================================================================
// Types
// ============================================================================

export type AnalysisStatus = 'computed' | 'unavailable' | 'unavailable_legacy_contract' | 'skipped' | 'error'

export interface NormalisedAnalysisResponse {
  /** Status of option comparison (outcomes, probabilities) */
  option_comparison_status: AnalysisStatus
  /** Status of robustness/sensitivity analysis */
  robustness_status: AnalysisStatus
  /** Status of driver analysis */
  drivers_status: AnalysisStatus
  /** Reason if analysis is unavailable */
  unavailable_reason?: string
  /** Critique items from engine */
  critiques?: Critique[]

  // Passthrough data (may be undefined/null even if status is 'computed')
  options?: AnalysisOption[]
  robustness?: RobustnessData
  drivers?: Driver[]
}

export interface Critique {
  code: string
  severity: 'blocker' | 'warning' | 'info'
  message: string
  suggestion?: string
  affected_nodes?: string[]
}

export interface AnalysisOption {
  id: string
  label: string
  outcome?: {
    p10?: number
    p50?: number
    p90?: number
  }
  probability?: number
}

export interface RobustnessData {
  level?: string
  confidence?: number
  label?: string
  narrative?: string
}

export interface Driver {
  node_id?: string
  edge_id?: string
  label: string
  contribution?: number
  polarity?: 'up' | 'down' | 'neutral'
  strength?: 'low' | 'medium' | 'high'
}

// ============================================================================
// Legacy Response Detection
// ============================================================================

interface LegacyAnalysisResponse {
  // May not have status fields
  robustness?: { level?: string; confidence?: number }
  options?: Array<{ outcome?: { p10?: number; p50?: number; p90?: number } }>
  drivers?: Array<unknown>
  results?: { conservative?: number; likely?: number; optimistic?: number }
  // No explicit status fields
}

interface V3AnalysisResponse {
  // Explicit status fields
  option_comparison_status: AnalysisStatus
  robustness_status: AnalysisStatus
  drivers_status: AnalysisStatus
  unavailable_reason?: string
  critiques?: Critique[]
  // Data fields
  options?: AnalysisOption[]
  robustness?: RobustnessData
  drivers?: Driver[]
}

/**
 * Check if response is V3 format (has explicit status fields)
 */
function isV3Response(response: unknown): response is V3AnalysisResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'option_comparison_status' in response
  )
}

// ============================================================================
// Status Derivation for Legacy Responses
// ============================================================================

/**
 * Derive option comparison status from legacy response data
 */
function deriveOptionStatus(response: LegacyAnalysisResponse): AnalysisStatus {
  // Check for options array with outcomes
  if (response.options && response.options.length > 0) {
    const hasValidOutcomes = response.options.every(
      (o) => o.outcome?.p50 !== undefined && Number.isFinite(o.outcome.p50)
    )
    return hasValidOutcomes ? 'computed' : 'unavailable_legacy_contract'
  }

  // Check for results object (single outcome scenario)
  if (response.results?.likely !== undefined && Number.isFinite(response.results.likely)) {
    return 'computed'
  }

  return 'unavailable_legacy_contract'
}

/**
 * Derive robustness status from legacy response data
 */
function deriveRobustnessStatus(response: LegacyAnalysisResponse): AnalysisStatus {
  if (!response.robustness?.level) {
    return 'unavailable'
  }

  // Must have valid confidence to be truly computed
  if (
    response.robustness.confidence === undefined ||
    !Number.isFinite(response.robustness.confidence)
  ) {
    return 'unavailable'
  }

  return 'computed'
}

/**
 * Derive drivers status from legacy response data
 */
function deriveDriversStatus(response: LegacyAnalysisResponse): AnalysisStatus {
  if (!response.drivers || !Array.isArray(response.drivers)) {
    return 'unavailable'
  }

  // Even an empty array is valid if the field exists
  return 'computed'
}

// ============================================================================
// Main Normalisation Function
// ============================================================================

/**
 * Normalise any analysis response to V3 format.
 *
 * - V3 responses pass through unchanged
 * - Legacy responses have status derived from data presence
 *
 * This ensures UI can always check status fields without worrying
 * about response format differences.
 */
export function normaliseResponse(
  response: LegacyAnalysisResponse | V3AnalysisResponse | null | undefined
): NormalisedAnalysisResponse | null {
  if (!response) {
    return null
  }

  // V3 response - pass through
  if (isV3Response(response)) {
    return response as NormalisedAnalysisResponse
  }

  // Legacy response - derive status from data presence
  const legacy = response as LegacyAnalysisResponse

  return {
    option_comparison_status: deriveOptionStatus(legacy),
    robustness_status: deriveRobustnessStatus(legacy),
    drivers_status: deriveDriversStatus(legacy),
    unavailable_reason: 'legacy_response',

    // Pass through data (adapter will handle conversion if needed)
    options: legacy.options as AnalysisOption[],
    robustness: legacy.robustness as RobustnessData,
    drivers: legacy.drivers as Driver[],
  }
}

// ============================================================================
// Display Helpers
// ============================================================================

export interface RobustnessDisplay {
  /** Whether to show the level badge */
  showLevel: boolean
  /** Robustness level if available */
  level?: string
  /** Confidence value if available */
  confidence?: number
  /** Text to show when level not available */
  fallbackText: string
  /** Whether to show retry button */
  showRetry?: boolean
  /** CSS class for styling */
  className: string
}

/**
 * Get display configuration for robustness based on normalised response.
 *
 * Ensures we never show confident labels when analysis is unavailable.
 */
export function getRobustnessDisplay(
  response: NormalisedAnalysisResponse | null
): RobustnessDisplay {
  if (!response) {
    return {
      showLevel: false,
      fallbackText: 'Run analysis to see robustness',
      className: 'robustness--pending',
    }
  }

  const status = response.robustness_status

  if (status === 'unavailable' || status === 'skipped') {
    return {
      showLevel: false,
      fallbackText: `Robustness analysis ${status === 'skipped' ? 'was skipped' : 'unavailable'}`,
      className: 'robustness--unavailable',
    }
  }

  if (status === 'error') {
    return {
      showLevel: false,
      fallbackText: 'Robustness analysis failed',
      showRetry: true,
      className: 'robustness--error',
    }
  }

  if (status === 'unavailable_legacy_contract') {
    return {
      showLevel: false,
      fallbackText: 'Robustness not available (legacy format)',
      className: 'robustness--unavailable',
    }
  }

  // status === 'computed' — verify data exists
  const robustness = response.robustness

  if (!robustness?.level || !Number.isFinite(robustness.confidence)) {
    return {
      showLevel: false,
      fallbackText: 'Robustness data incomplete',
      className: 'robustness--incomplete',
    }
  }

  return {
    showLevel: true,
    level: robustness.level,
    confidence: robustness.confidence,
    fallbackText: '',
    className: 'robustness--computed',
  }
}

export interface DriversDisplay {
  /** Whether to show the drivers list */
  showDrivers: boolean
  /** Drivers to display */
  drivers?: Driver[]
  /** Text to show when drivers not available */
  fallbackText: string
  /** Explanation text for empty state */
  explanation?: string
  /** Whether to show retry button */
  showRetry?: boolean
  /** CSS class for styling */
  className: string
}

/**
 * Get display configuration for drivers based on normalised response.
 *
 * Distinguishes between "analysis unavailable" and "no drivers found".
 */
export function getDriversDisplay(
  response: NormalisedAnalysisResponse | null
): DriversDisplay {
  if (!response) {
    return {
      showDrivers: false,
      fallbackText: 'Run analysis to see drivers',
      className: 'drivers--pending',
    }
  }

  const status = response.drivers_status

  if (status === 'unavailable' || status === 'skipped') {
    return {
      showDrivers: false,
      fallbackText: `Driver analysis ${status === 'skipped' ? 'was skipped' : 'unavailable'}`,
      className: 'drivers--unavailable',
    }
  }

  if (status === 'error') {
    return {
      showDrivers: false,
      fallbackText: 'Driver analysis failed',
      showRetry: true,
      className: 'drivers--error',
    }
  }

  if (status === 'unavailable_legacy_contract') {
    return {
      showDrivers: false,
      fallbackText: 'Drivers not available (legacy format)',
      className: 'drivers--unavailable',
    }
  }

  // status === 'computed'
  if (!response.drivers || response.drivers.length === 0) {
    return {
      showDrivers: false,
      fallbackText: 'No significant drivers identified',
      explanation:
        'The analysis ran successfully but found no variables with significant influence on the outcome differences.',
      className: 'drivers--empty',
    }
  }

  return {
    showDrivers: true,
    drivers: response.drivers,
    fallbackText: '',
    className: 'drivers--computed',
  }
}

// ============================================================================
// Degeneracy Detection
// ============================================================================

export interface DegeneracyCheck {
  /** Whether degeneracy was detected */
  detected: boolean
  /** Type of degeneracy */
  type?: 'identical_outcomes' | 'narrow_range'
  /** Message describing the issue */
  message?: string
  /** Suggestion for resolution */
  suggestion?: string
  /** Whether this is from backend blocker (authoritative) */
  isBackendBlocker: boolean
  /** Whether user can dismiss this warning */
  canDismiss: boolean
}

/**
 * Check for outcome degeneracy (identical or near-identical outcomes).
 *
 * Backend blocker critiques take precedence (authoritative, non-dismissible).
 * UI heuristic checks are secondary (dismissible).
 */
export function checkOutcomeDegeneracy(
  response: NormalisedAnalysisResponse | null
): DegeneracyCheck {
  if (!response) {
    return { detected: false, isBackendBlocker: false, canDismiss: true }
  }

  // Check for backend blockers first (these are authoritative)
  const backendBlocker = response.critiques?.find(
    (c) =>
      c.severity === 'blocker' &&
      ['IDENTICAL_OPTIONS', 'NO_PATH_TO_GOAL', 'EMPTY_INTERVENTIONS'].includes(c.code)
  )

  if (backendBlocker) {
    return {
      detected: true,
      type: 'identical_outcomes',
      message: backendBlocker.message,
      suggestion: backendBlocker.suggestion,
      isBackendBlocker: true,
      canDismiss: false, // Backend blockers cannot be dismissed
    }
  }

  // UI heuristic checks (can be dismissed)
  const options = response.options

  if (!options || options.length < 2) {
    return { detected: false, isBackendBlocker: false, canDismiss: true }
  }

  // Check for identical p50 outcomes
  const p50Values = options
    .map((o) => o.outcome?.p50)
    .filter((v): v is number => v !== undefined && Number.isFinite(v))

  if (p50Values.length < 2) {
    return { detected: false, isBackendBlocker: false, canDismiss: true }
  }

  // Use relative tolerance for comparison
  const maxAbs = Math.max(...p50Values.map(Math.abs), 1) // Avoid division by zero
  const tolerance = 0.01 * maxAbs // 1% of max absolute value

  const allIdentical = p50Values.every((v) => Math.abs(v - p50Values[0]) < tolerance)

  if (allIdentical) {
    return {
      detected: true,
      type: 'identical_outcomes',
      message: 'All options produce nearly identical outcomes.',
      suggestion:
        'This may indicate missing or incorrect intervention mappings. Check that each option specifies different values for causal variables.',
      isBackendBlocker: false,
      canDismiss: true, // User can dismiss and view anyway
    }
  }

  return { detected: false, isBackendBlocker: false, canDismiss: true }
}
