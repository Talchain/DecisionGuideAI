/**
 * PLoT V2 API Types (P0-UI-1)
 *
 * Types for the /v2/run endpoint request and response.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * V2 node in the request graph.
 */
export interface V2Node {
  id: string
  kind: string
  label: string
  observed_state?: {
    value: number
    std?: number
  }
}

/**
 * V2 edge in the request graph.
 */
export interface V2Edge {
  from: string
  to: string
  strength: {
    mean: number
    std: number
  }
  exists_probability: number
}

/**
 * V2 option with interventions.
 */
export interface V2Option {
  id: string
  label: string
  interventions: Record<string, number>
}

/**
 * V2 run request.
 */
export interface V2RunRequest {
  graph: {
    nodes: V2Node[]
    edges: V2Edge[]
  }
  options: V2Option[]
  goal_node_id: string
  seed: string
  detail_level: 'deep' | 'summary'
  /** Optional request ID for tracing (echoed in response) */
  request_id?: string
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * V2 outcome distribution.
 */
export interface V2Outcome {
  mean: number
  std: number
  p10: number
  p50: number
  p90: number
}

/**
 * V2 option result.
 */
export interface V2OptionResult {
  id: string
  label: string
  outcome: V2Outcome
  status: 'computed' | 'unavailable' | 'error' | 'skipped'
}

/**
 * V2 critique item.
 */
export interface V2Critique {
  code: string
  severity: 'blocker' | 'warning' | 'info'
  message: string
  suggestion?: string
  affected_nodes?: string[]
}

/**
 * V2 driver.
 */
export interface V2Driver {
  node_id: string
  label: string
  contribution: number
  direction: 'positive' | 'negative'
}

/**
 * V2 robustness info.
 */
export interface V2Robustness {
  level: 'high' | 'medium' | 'low'
  confidence: number
  factors?: Array<{
    node_id: string
    sensitivity: number
  }>
}

/**
 * V2 success response.
 */
export interface V2RunResponse {
  analysis_status: 'computed' | 'partial'
  option_comparison_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  robustness_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  drivers_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  options: V2OptionResult[]
  critiques: V2Critique[]
  drivers?: V2Driver[]
  robustness?: V2Robustness
  response_hash: string
  seed_used: string
  /** Echoed from request for tracing */
  request_id?: string
}

/**
 * V2 error response (422).
 *
 * IMPORTANT: PLoT returns this UNWRAPPED (not in error.v1 envelope).
 */
export interface V2RunError {
  analysis_status: 'blocked' | 'failed'
  status_reason: string
  critiques: V2Critique[]
  /** Echoed from request for tracing */
  request_id?: string
}

/**
 * Combined result type for type-safe handling.
 */
export type V2RunResult = V2RunResponse | V2RunError

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is blocked (422 validation error).
 * User needs to fix their inputs.
 *
 * NOTE: 'failed' is NOT included here — that's a 200 response with
 * V2RunResponse type, indicating computation failed (e.g., all NaN).
 */
export function isBlockedResponse(result: V2RunResult): result is V2RunError {
  return result.analysis_status === 'blocked'
}

/**
 * Check if analysis failed (200 but computation couldn't complete).
 * This is NOT a V2RunError — it's a V2RunResponse with failed status.
 * Show "analysis couldn't complete" message, not "fix your inputs".
 */
export function isFailedAnalysis(result: V2RunResult): boolean {
  return result.analysis_status === 'failed'
}

/**
 * Check if response has usable results (computed or partial).
 */
export function isSuccessfulAnalysis(result: V2RunResult): result is V2RunResponse {
  return result.analysis_status === 'computed' || result.analysis_status === 'partial'
}

/**
 * @deprecated Use isSuccessfulAnalysis instead
 */
export function isSuccessResponse(result: V2RunResult): result is V2RunResponse {
  return isSuccessfulAnalysis(result)
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum standard deviation to avoid ISL validation errors.
 */
export const STD_FLOOR = 1e-6

/**
 * Default standard deviation when not provided.
 */
export const DEFAULT_STD = 0.1

/**
 * Default seed value.
 */
export const DEFAULT_SEED = '42'
