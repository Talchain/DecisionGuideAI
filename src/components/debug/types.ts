/**
 * Debug Console Types
 *
 * Shared types for the redesigned Debug Console components.
 */

// =============================================================================
// URL Flag Gating
// =============================================================================

export interface DebugFlags {
  showDebugConsole: boolean
  showUnsafe: boolean
}

// =============================================================================
// Headline Signals
// =============================================================================

export interface HeadlineSignal {
  id: string
  label: string
  value: string
  status: 'ok' | 'warn' | 'error' | 'info'
  tooltip?: string
}

export interface SchemaDetectionResult {
  requested: string
  detected: string
  reason: string
  isMatch: boolean
}

// =============================================================================
// Timeline Types
// =============================================================================

export type TimelineStageStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface TimelineStage {
  id: string
  label: string
  status: TimelineStageStatus
  duration?: number
  details: Record<string, unknown>
  children?: TimelineStage[]
  isUnsafe?: boolean // LLM I/O sections
}

// =============================================================================
// Raw Data Types
// =============================================================================

export interface FieldAdaptation {
  path: string
  rawValue: unknown
  adaptedValue: unknown
  reason: string
}

export interface RequestEntry {
  id: string
  timestamp: Date
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
  status?: number
  response?: unknown
  duration?: number
}

// =============================================================================
// Payload Lab Types
// =============================================================================

export interface PayloadHistoryEntry {
  id: string
  timestamp: Date
  payload: object
  seed: string
  n_samples: number
  results?: ISLTestSummary
  duration_ms?: number
}

export interface PayloadSnapshot {
  id: string
  name: string
  description?: string
  payload: object
  created_at: Date
  tags?: string[]
}

export interface ISLTestSummary {
  options: Array<{
    id: string
    label: string
    p10: number
    p50: number
    p90: number
    winner_pct: number
  }>
  duration_ms: number
  n_samples_used: number
}

// Conformal prediction response shape from ISL /causal/counterfactual/conformal
export interface ConformalPredictionInterval {
  lower_bound: Record<string, number>
  upper_bound: Record<string, number>
  point_estimate: Record<string, number>
  interval_width?: Record<string, number>
}

export interface ConformalCoverageGuarantee {
  nominal_coverage: number
  guaranteed_coverage: number
  finite_sample_valid?: boolean
  assumptions?: Record<string, unknown>
}

export interface ConformalRawResponse {
  prediction_interval: ConformalPredictionInterval
  coverage_guarantee: ConformalCoverageGuarantee
}

export interface ISLTestResponse {
  raw_response: object | ConformalRawResponse
  summary: ISLTestSummary
}

// Parsed conformal result for display
export interface ConformalResult {
  variable: string
  lowerBound: number
  pointEstimate: number
  upperBound: number
  intervalWidth: number
}
