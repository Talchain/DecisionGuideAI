/**
 * Debug Panel Types
 *
 * Shared types for the Payload Lab and debug components.
 */

/**
 * ISL test response summary
 */
export interface ISLTestSummary {
  options?: Array<{
    id: string
    label?: string
    score?: number
    rank?: number
  }>
  duration_ms?: number
}

/**
 * Conformal prediction result for a single variable
 */
export interface ConformalResult {
  variable: string
  lowerBound: number
  pointEstimate: number
  upperBound: number
  intervalWidth: number
}

/**
 * Raw conformal response from ISL
 */
export interface ConformalRawResponse {
  prediction_interval?: {
    point_estimate?: Record<string, number>
    lower_bound?: Record<string, number>
    upper_bound?: Record<string, number>
    interval_width?: Record<string, number>
  }
  coverage_guarantee?: {
    nominal_coverage?: number
    guaranteed_coverage?: number
  }
}

/**
 * Full ISL test response
 */
export interface ISLTestResponse {
  summary: ISLTestSummary
  raw_response?: unknown
}

/**
 * Payload history entry for run tracking
 */
export interface PayloadHistoryEntry {
  id: string
  timestamp: Date
  payload: object
  seed: string
  n_samples: number
  results: ISLTestSummary
  duration_ms?: number
}

/**
 * Saved payload snapshot
 */
export interface PayloadSnapshot {
  id: string
  name: string
  payload: object
  created_at: Date
}
