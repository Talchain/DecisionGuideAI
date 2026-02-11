/**
 * Contract Integrity Layer (CIL) constants.
 *
 * Warning codes, severity mappings, and detection thresholds used by
 * the ContractIntegrityTab and validation pipeline.
 *
 * These are pure constants and types — no runtime parsing.
 */

// =============================================================================
// Warning Codes
// =============================================================================

/**
 * Known CIL validation warning codes emitted by CEE/ISL.
 */
export const CIL_WARNING_CODES = {
  /** Strength default applied to an edge (no CEE/user value) */
  STRENGTH_DEFAULT_APPLIED: 'STRENGTH_DEFAULT_APPLIED',
  /** Edge has low causal strength */
  EDGE_STRENGTH_LOW: 'EDGE_STRENGTH_LOW',
  /** Majority of edges use default strength (UI display convention) */
  STRENGTH_MEAN_DEFAULT_DOMINANT: 'STRENGTH_MEAN_DEFAULT_DOMINANT',
} as const

export type CilWarningCode = typeof CIL_WARNING_CODES[keyof typeof CIL_WARNING_CODES]

// =============================================================================
// Warning Severity
// =============================================================================

/**
 * Severity lookup for CIL warning codes.
 */
export const CIL_WARNING_SEVERITY: Record<CilWarningCode, 'info' | 'warning' | 'error'> = {
  [CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED]: 'info',
  [CIL_WARNING_CODES.EDGE_STRENGTH_LOW]: 'warning',
  [CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT]: 'warning',
} as const

// =============================================================================
// Detection Thresholds
// =============================================================================

/**
 * Detection thresholds for default-signature edge detection.
 *
 * An edge is considered "defaulted" when its strength mean and std
 * match the UI display default within TOLERANCE.
 */
export const CIL_THRESHOLDS = {
  /** Default strength mean applied by UI display layer */
  STRENGTH_DEFAULT_MEAN: 0.5,
  /** Default strength std computed for display default */
  STRENGTH_DEFAULT_STD: 0.125,
  /** Tolerance for float comparison when detecting defaults */
  STRENGTH_DEFAULT_TOLERANCE: 0.001,
  /** Percentage of defaulted edges that triggers a warning */
  DEFAULTED_PERCENTAGE_WARN: 50,
  /** Number of repair warnings that triggers section fail */
  REPAIR_WARN_THRESHOLD: 5,
} as const

// =============================================================================
// Warning Detail Types
// =============================================================================

/**
 * Typed details for STRENGTH_DEFAULT_APPLIED validation warning.
 * Available in validation_warnings[].details when code matches.
 */
export interface StrengthDefaultAppliedDetails {
  /** Edge ID where default was applied */
  edge_id: string
  /** Default mean value applied */
  default_mean: number
  /** Default std value applied */
  default_std: number
}

/**
 * Typed details for STRENGTH_MEAN_DEFAULT_DOMINANT validation warning.
 * Available in validation_warnings[].details when code matches.
 */
export interface StrengthMeanDefaultDominantDetails {
  /** Total edges in graph */
  total_edges: number
  /** Structural edges excluded from audit */
  structural_edges_excluded: number
  /** Edge IDs where default mean was detected */
  mean_defaulted_edge_ids: string[]
  /** Percentage of causal edges that are defaulted */
  defaulted_percentage: number
}
