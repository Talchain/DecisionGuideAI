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
  /** Optional success threshold for probability_of_goal calculation */
  goal_threshold?: number
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
 * V2 option result (legacy format - kept for backward compatibility).
 */
export interface V2OptionResult {
  id: string
  label: string
  outcome: V2Outcome
  status: 'computed' | 'unavailable' | 'error' | 'skipped'
}

/**
 * V2 option comparison result (actual PLoT response format).
 */
export interface V2OptionComparison {
  option_id: string
  option_label: string
  confidence_interval: [number, number]
  /** Probability of exceeding goal_threshold (only when threshold provided) */
  probability_of_goal?: number
  /** Probability this option wins vs others (pairwise comparison) */
  win_probability?: number
}

/**
 * V2 edge sensitivity analysis.
 */
export interface V2EdgeSensitivity {
  edge_id: string
  from: string
  to: string
  sensitivity_type: 'existence' | 'magnitude'
  elasticity: number
  importance_rank: number
  interpretation: string
}

/**
 * V2 factor sensitivity from PLoT.
 * Contains sensitivity analysis for individual factors.
 */
export interface V2FactorSensitivity {
  /** Primary identifier - use factor_id or node_id */
  factor_id?: string
  /** Alias for factor_id (PLoT may use either) */
  node_id?: string
  /** Raw sensitivity value (may be positive or negative) */
  sensitivity?: number
  /** Direction of influence: positive or negative */
  direction?: 'positive' | 'negative'
  /** Elasticity measure (optional) */
  elasticity?: number
  /** Importance ranking (optional) */
  importance_rank?: number
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
 * V2 robustness info (legacy format - kept for backward compatibility).
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
 * V2 robustness info (actual PLoT response format).
 */
export interface V2RobustnessActual {
  fragile_edges: string[]
  robust_edges: string[]
}

/**
 * V2 response metadata.
 */
export interface V2Meta {
  seed_used: string
  n_samples: number
  detail_level: string
  latency_ms: number
}

/**
 * V2 success response.
 *
 * Note: PLoT returns `option_comparison` (not `options`), and robustness
 * uses `fragile_edges`/`robust_edges` structure. Legacy `options` and
 * `V2Robustness` types are kept for backward compatibility with existing
 * UI components during transition.
 */
export interface V2RunResponse {
  analysis_status: 'computed' | 'partial'
  option_comparison_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  robustness_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  drivers_status: 'computed' | 'unavailable' | 'skipped' | 'error'
  /** Option comparison results (actual PLoT field name) */
  option_comparison: V2OptionComparison[]
  /** @deprecated Use option_comparison instead */
  options?: V2OptionResult[]
  critiques: V2Critique[]
  drivers?: V2Driver[]
  /** Edge sensitivity analysis */
  edge_sensitivity?: V2EdgeSensitivity[]
  /** Factor sensitivity (may be empty) */
  factor_sensitivity?: V2FactorSensitivity[]
  /** Robustness analysis (actual PLoT format) */
  robustness?: V2RobustnessActual
  response_hash: string
  /** Response metadata */
  meta?: V2Meta
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
