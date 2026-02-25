/**
 * PLoT V2 API Types (P0-UI-1)
 *
 * Types for the /v2/run endpoint request and response.
 */

import type { ConstraintAnalysis } from '../../../types/constraints'
import type {
  M1ReviewStatus,
  DecisionQualityV3,
  InsightV3,
  ImprovementGuidanceV3,
  RationaleV3,
  RobustnessSynthesisV3,
  M1Coaching,
} from '../../../types/cee'
import type { CEEGoalConstraint } from '../../cee/types'

// ============================================================================
// Request Types
// ============================================================================

/**
 * Observed state for a V2 node.
 *
 * Convention: snake_case (`observed_state`) in CEE/PLoT payloads.
 * Canvas nodes use camelCase (`observedState`) — see extractObservedState().
 */
export interface V2ObservedState {
  value: number
  std?: number
  baseline?: number
  unit?: string
  source?: string
  // V3 pass-through fields from CEE
  raw_value?: number
  cap?: number
  factor_type?: string
  uncertainty_drivers?: unknown[]
  extractionType?: string
}

/**
 * V2 node in the request graph.
 */
export interface V2Node {
  id: string
  kind: string
  label: string
  observed_state?: V2ObservedState
  category?: 'controllable' | 'observable' | 'external'
  // V3 pass-through fields from CEE goal nodes
  goal_threshold?: number
  goal_threshold_raw?: number
  goal_threshold_unit?: string
  goal_threshold_cap?: number
  // V3 pass-through for external factor nodes
  prior?: number
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
  /**
   * Seed for reproducibility. PLoT expects string format.
   *
   * UI passes numeric seeds which are converted to string at the adapter boundary
   * in buildV2RequestFromAnalysisReady() via .toString(). This ensures:
   * - UI can work with numbers (easier for hashing/derivation)
   * - API receives strings (as PLoT expects)
   */
  seed: string
  detail_level: 'deep' | 'summary'
  /** Optional request ID for tracing (echoed in response) */
  request_id?: string
  /** Optional success threshold for probability_of_goal calculation */
  goal_threshold?: number
  /**
   * User's decision framing for contextualised CEE responses.
   * When provided, CEE can generate more relevant headlines and guidance.
   */
  framing?: {
    title?: string
    goal?: string
    constraints?: string
  }
  /**
   * Original decision brief from the user.
   * PLoT uses this for context when generating insights and recommendations.
   */
  brief?: string
  /**
   * Goal constraints for multi-constraint analysis.
   * When present, ISL computes probability_of_joint_goal.
   */
  goal_constraints?: CEEGoalConstraint[]
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
  /** Expected outcome value (mean of outcome distribution) */
  expected_outcome?: number
  /** Full outcome distribution when available (all fields optional in V2 response) */
  outcome?: Partial<V2Outcome>
  /** Multi-constraint analysis results (when goal_constraints were provided) */
  constraint_analysis?: ConstraintAnalysis
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
  /** Human-readable label (may come from ISL enrichment) */
  label?: string
  /** PLoT V2 factor label (preferred over label when present) */
  factor_label?: string
  /** Raw sensitivity value (may be positive or negative) */
  sensitivity?: number
  /** Sensitivity score (PLoT v2 format, 0-1 normalized) */
  sensitivity_score?: number
  /** P0 Fix: Importance score (PLoT v2 may use this instead of sensitivity_score) */
  importance_score?: number
  /** Direction of influence: positive or negative */
  direction?: 'positive' | 'negative'
  /** Elasticity measure (optional) */
  elasticity?: number
  /** Importance ranking (optional) */
  importance_rank?: number
  /** P0 Fix: Confidence in this factor's influence (0-1, from ISL enrichment) */
  confidence?: number
  /** Value of information score (0-1), used for driver confidence display */
  value_of_information?: number
  /** Breakdown of confidence into structural and sampling components */
  confidence_components?: {
    structural_certainty: number
    sampling_stability: number | null
  }
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
  /** Ranking stability - how stable the overall ranking is (0-1) */
  ranking_stability?: number
  /** Recommendation stability - how often recommendation stays winner (0-1) */
  recommendation_stability?: number
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

// ============================================================================
// M1 Review Types (key assumptions + pre-mortem from PLoT)
// ============================================================================

/** Pre-mortem analysis from PLoT */
export interface V2PreMortem {
  failure_scenario: string
  warning_signs: string[]
  mitigation: string
}

/** M2 decision quality prompt — structured coaching question from PLoT review */
export interface V2DecisionQualityPrompt {
  /** Framework principle, e.g. "Pre-mortem (Klein)" */
  principle: string
  /** Why this principle applies */
  applies_because: string
  /** The coaching question itself */
  question: string
}

/** M2 bias finding — cognitive bias risk from PLoT review */
export interface V2BiasFinding {
  /** Bias type code, e.g. "ANCHORING_RISK" */
  type: string
  /** Source of the finding */
  source: string
  /** Human-readable description of the bias risk */
  description: string
  /** Factor IDs affected — for graph links */
  affected_elements: string[]
  /** Linked critique code for cross-reference */
  linked_critique_code: string
}

/** M2 evidence enhancement — per-factor enrichment from PLoT review */
export interface V2EvidenceEnhancement {
  /** Concrete action to improve this factor's evidence */
  specific_action: string
  /** Decision hygiene tip for this factor */
  decision_hygiene: string
}

/** M1 Review: key assumptions and pre-mortem analysis from PLoT /v2/run */
export interface V2M1Review {
  key_assumptions: string[]
  pre_mortem?: V2PreMortem | null
  /** V12: M2 decision quality prompts (gated on review_status === 'complete') */
  decision_quality_prompts?: V2DecisionQualityPrompt[]
  /** V12: M2 bias findings */
  bias_findings?: V2BiasFinding[]
  /** V12: M2 evidence enhancements keyed by factor_id */
  evidence_enhancements?: Record<string, V2EvidenceEnhancement>
  /** V12: M2 narrative summary paragraph */
  narrative_summary?: string
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

  // ==========================================================================
  // M1 CEE Review Fields (optional enrichment)
  // ==========================================================================

  /** CEE status - indicates availability of CEE-generated content */
  cee_status?: M1ReviewStatus
  /** Decision quality assessment from CEE */
  decision_quality?: DecisionQualityV3 | null
  /** Insights from CEE analysis */
  insights?: InsightV3[] | null
  /** Improvement guidance from CEE */
  improvement_guidance?: ImprovementGuidanceV3[] | null
  /** Decision rationale from CEE */
  rationale?: RationaleV3 | null
  /** Robustness synthesis from CEE */
  robustness_synthesis?: RobustnessSynthesisV3 | null
  /** CEE trace for debugging */
  cee_trace?: {
    request_id: string
    latency_ms: number
    degraded?: boolean
  }

  // ==========================================================================
  // M1 Coaching Fields (deterministic, computed after ISL)
  // ==========================================================================

  /** M1 Coaching - deterministic coaching fields (not LLM-generated) */
  m1_coaching?: M1Coaching

  // ==========================================================================
  // M1 Review Fields (key assumptions + pre-mortem from PLoT)
  // ==========================================================================

  /** M1 Review - key assumptions and pre-mortem analysis */
  m1_review?: V2M1Review

  // ==========================================================================
  // Observability Fields (optional, from PLoT response passthrough)
  // ==========================================================================

  /** Repairs applied by PLoT during processing */
  repairs_applied?: Array<{
    code?: string
    type?: string
    layer?: string
    field_path?: string
    before?: unknown
    after?: unknown
    severity?: string
    node_id?: string
    value?: unknown
    source?: string
    reason?: string
  }>

  /** PLoT response metadata (filtered constraints, constraint sources) */
  _meta?: {
    filtered_constraints?: unknown[]
    constraint_sources?: Record<string, string>
    [key: string]: unknown
  }

  /** Decision review status (FeatureStatus-like: 'complete' | 'failed' | absent) */
  review_status?: string

  /** Decision review warnings (M1 warning codes) */
  review_warnings?: string[]

  /** Decision review failure codes */
  review_failure_codes?: string[]

  /** Constraints pipeline status */
  constraints_status?: 'computed' | 'unavailable' | 'skipped' | 'error'
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
// Runtime Validation Guards
// ============================================================================

import type { ValidationFailure } from '../../../lib/api-errors'

/**
 * Validation result with split between hard errors and soft warnings.
 *
 * HARD ERRORS: Block processing, throw MalformedApiResponseError
 * - Missing required fields (analysis_status, response_hash)
 * - option_comparison is not an array (will crash map())
 * - Root is not an object
 *
 * SOFT WARNINGS: Log warning, continue with degraded UX
 * - Optional arrays are objects instead of arrays (fallback to [])
 * - Missing optional nested fields
 * - Extra unexpected fields
 */
export interface ValidationResult {
  valid: boolean
  hardErrors: ValidationFailure[]
  softWarnings: ValidationFailure[]
}

/**
 * Validate V2RunResponse structure at runtime.
 * Splits validation into hard blockers and soft warnings.
 */
export function validateV2RunResponseFull(data: unknown): ValidationResult {
  const hardErrors: ValidationFailure[] = []
  const softWarnings: ValidationFailure[] = []

  // Root must be object - HARD ERROR
  if (typeof data !== 'object' || data === null) {
    hardErrors.push({
      field: 'root',
      expected: 'object',
      received: data === null ? 'null' : typeof data,
    })
    return { valid: false, hardErrors, softWarnings }
  }

  const response = data as Record<string, unknown>

  // =========================================================================
  // HARD ERRORS - Block processing
  // =========================================================================

  // analysis_status is required - HARD ERROR
  if (typeof response.analysis_status !== 'string') {
    hardErrors.push({
      field: 'analysis_status',
      expected: 'string',
      received: typeof response.analysis_status,
    })
  }

  // response_hash is required - HARD ERROR
  if (typeof response.response_hash !== 'string') {
    hardErrors.push({
      field: 'response_hash',
      expected: 'string',
      received: typeof response.response_hash,
    })
  }

  // option_comparison being non-array is HARD (will crash map())
  if ('option_comparison' in response && response.option_comparison !== null && response.option_comparison !== undefined) {
    if (!Array.isArray(response.option_comparison)) {
      hardErrors.push({
        field: 'option_comparison',
        expected: 'array',
        received: typeof response.option_comparison,
      })
    }
  }

  // =========================================================================
  // SOFT WARNINGS - Log and continue
  // =========================================================================

  // critiques being non-array is SOFT (can fallback to [])
  if ('critiques' in response && response.critiques !== undefined && !Array.isArray(response.critiques)) {
    softWarnings.push({
      field: 'critiques',
      expected: 'array | undefined',
      received: typeof response.critiques,
    })
  }

  // drivers being non-array is SOFT (can fallback to [])
  if ('drivers' in response && response.drivers !== undefined && !Array.isArray(response.drivers)) {
    softWarnings.push({
      field: 'drivers',
      expected: 'array | undefined',
      received: typeof response.drivers,
    })
  }

  // edge_sensitivity being non-array is SOFT (can fallback to [])
  if ('edge_sensitivity' in response && response.edge_sensitivity !== undefined && !Array.isArray(response.edge_sensitivity)) {
    softWarnings.push({
      field: 'edge_sensitivity',
      expected: 'array | undefined',
      received: typeof response.edge_sensitivity,
    })
  }

  // factor_sensitivity being non-array is SOFT (can fallback to [])
  if ('factor_sensitivity' in response && response.factor_sensitivity !== undefined && !Array.isArray(response.factor_sensitivity)) {
    softWarnings.push({
      field: 'factor_sensitivity',
      expected: 'array | undefined',
      received: typeof response.factor_sensitivity,
    })
  }

  // Status fields - SOFT (can fallback to 'unavailable')
  const statusFields = ['option_comparison_status', 'robustness_status', 'drivers_status']
  for (const field of statusFields) {
    if (field in response && typeof response[field] !== 'string') {
      softWarnings.push({
        field,
        expected: 'string',
        received: typeof response[field],
      })
    }
  }

  // robustness object missing when status is computed - SOFT
  if (response.robustness_status === 'computed' && !response.robustness) {
    softWarnings.push({
      field: 'robustness',
      expected: 'object (when robustness_status is computed)',
      received: String(response.robustness),
    })
  }

  return {
    valid: hardErrors.length === 0,
    hardErrors,
    softWarnings,
  }
}

/**
 * Legacy validation function - returns flat list of all failures.
 * @deprecated Use validateV2RunResponseFull for hard/soft split
 */
export function validateV2RunResponse(data: unknown): ValidationFailure[] {
  const result = validateV2RunResponseFull(data)
  return [...result.hardErrors, ...result.softWarnings]
}

/**
 * Check if data is a valid V2RunResponse (runtime type guard).
 * Only checks hard errors - soft warnings don't invalidate.
 */
export function isValidV2RunResponse(data: unknown): data is V2RunResponse {
  return validateV2RunResponseFull(data).hardErrors.length === 0
}

/**
 * Validate V2RunError structure at runtime.
 */
export function validateV2RunError(data: unknown): ValidationFailure[] {
  const failures: ValidationFailure[] = []

  if (typeof data !== 'object' || data === null) {
    failures.push({
      field: 'root',
      expected: 'object',
      received: data === null ? 'null' : typeof data,
    })
    return failures
  }

  const response = data as Record<string, unknown>

  if (typeof response.analysis_status !== 'string') {
    failures.push({
      field: 'analysis_status',
      expected: 'string (blocked | failed)',
      received: typeof response.analysis_status,
    })
  }

  if (typeof response.status_reason !== 'string') {
    failures.push({
      field: 'status_reason',
      expected: 'string',
      received: typeof response.status_reason,
    })
  }

  if (!Array.isArray(response.critiques)) {
    failures.push({
      field: 'critiques',
      expected: 'array',
      received: typeof response.critiques,
    })
  }

  return failures
}

/**
 * Check if data is a valid V2RunError (runtime type guard).
 */
export function isValidV2RunError(data: unknown): data is V2RunError {
  return validateV2RunError(data).length === 0
}

/**
 * Sanitize a V2RunResponse by fixing soft anomalies.
 * Converts non-array fields to empty arrays to prevent crashes.
 * Logs warnings when sanitisation is applied.
 */
export function sanitizeV2RunResponse(data: V2RunResponse): V2RunResponse {
  // Track what needs fixing
  const fixes: string[] = []

  if (!Array.isArray(data.critiques)) {
    fixes.push(`critiques: ${typeof data.critiques} → []`)
  }
  if (data.drivers !== undefined && !Array.isArray(data.drivers)) {
    fixes.push(`drivers: ${typeof data.drivers} → []`)
  }
  if (data.edge_sensitivity !== undefined && !Array.isArray(data.edge_sensitivity)) {
    fixes.push(`edge_sensitivity: ${typeof data.edge_sensitivity} → []`)
  }
  if (data.factor_sensitivity !== undefined && !Array.isArray(data.factor_sensitivity)) {
    fixes.push(`factor_sensitivity: ${typeof data.factor_sensitivity} → []`)
  }

  // Log warning if sanitisation was applied
  if (fixes.length > 0) {
    const env = (import.meta as any)?.env?.VITE_APP_ENV || 'development'
    if (env === 'development' || env === 'staging') {
      console.warn('[V2 Sanitisation] Applied to V2RunResponse:', {
        fixCount: fixes.length,
        fixes,
      })
    }
  }

  return {
    ...data,
    // Ensure array fields are arrays (fix soft anomalies)
    critiques: Array.isArray(data.critiques) ? data.critiques : [],
    drivers: data.drivers !== undefined ? (Array.isArray(data.drivers) ? data.drivers : []) : undefined,
    edge_sensitivity: data.edge_sensitivity !== undefined
      ? (Array.isArray(data.edge_sensitivity) ? data.edge_sensitivity : [])
      : undefined,
    factor_sensitivity: data.factor_sensitivity !== undefined
      ? (Array.isArray(data.factor_sensitivity) ? data.factor_sensitivity : [])
      : undefined,
  }
}

// ============================================================================
// Constants — re-exported from @talchain/schemas
// ============================================================================

export {
  STD_FLOOR,
  STD_CEILING_RATIO,
  STD_CEILING_ABS,
  DEFAULT_STD,
  DEFAULT_SEED,
} from '@talchain/schemas'
