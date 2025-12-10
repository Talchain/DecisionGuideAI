/**
 * PLoT v1 HTTP API types (internal transport layer)
 * These are the pure v1 types - not exposed to UI
 */

import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from '../../../canvas/decisionReview/types'

// Request types
export interface V1Node {
  id: string
  label?: string // max 120 chars
  body?: string // max 2000 chars
  kind?: 'decision' | 'option' | 'outcome' // v1.2: node classification
  prior?: number // v1.2: 0..1 probability
  utility?: number // v1.2: -1..+1 relative payoff
}

export interface V1Edge {
  from: string
  to: string
  confidence?: number // 0..1
  weight?: number     // Visual weight or normalized (backend-specific)
  belief?: number     // v1.2: 0..1 epistemic uncertainty
  provenance?: string // v1.2: ≤100 chars source/rationale ("template" for defaults)
  id?: string         // v1.2: stable server-assigned ID
}

export interface V1Graph {
  nodes: V1Node[]
  edges: V1Edge[]
  version?: '1.2' // v1.2: schema version marker
  meta?: {
    suggested_positions?: Record<string, { x: number; y: number }> // v1.2: initial layout hints
    [key: string]: unknown
  }
}

export type V1DetailLevel = 'quick' | 'standard' | 'deep'

export interface V1RunRequest {
  graph: V1Graph
  seed?: number
  outcome_node?: string  // Target outcome node for analysis
  include_debug?: boolean  // Include debug metadata in response
  clientHash?: string
  detail_level?: V1DetailLevel  // Analysis depth: 'quick' (<20s), 'standard' (~35s), 'deep' (~60s+)
  // CEE (Cognitive Enhancement Engine) trigger fields
  scenario_id?: string  // Unique scenario identifier
  scenario_name?: string  // Human-readable scenario name
  save?: boolean  // If true, trigger CEE Decision Review generation
  idempotencyKey?: string
}

// Response types
export interface V1HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version?: string
  uptime_ms?: number
}

export interface V1Driver {
  kind: 'node' | 'edge'
  node_id?: string // Node ID for canvas highlighting
  edge_id?: string // Edge ID for canvas highlighting
  label?: string
  impact?: number
}

export interface V1Summary {
  conservative: number
  likely: number
  optimistic: number
  units?: string
}

export interface V1ExplainDelta {
  top_drivers: V1Driver[]
}

export interface V1RunResult {
  answer: string
  confidence: number // 0..1
  explanation: string
  summary?: V1Summary // Structured result values
  explain_delta?: V1ExplainDelta // Drivers nested here in actual API
  response_hash?: string
  seed?: number
}

export interface V1SyncRunResponse {
  result: V1RunResult
  execution_ms: number
  // CEE (Cognitive Enhancement Engine) overlay fields
  ceeReview?: CeeDecisionReviewPayload
  ceeTrace?: CeeTraceMeta
  ceeError?: CeeErrorViewModel
}

// SSE event types (lowercase per v1 spec)
export type V1EventType =
  | 'started'
  | 'RUN_STARTED'  // v1.2: new event name (alias for 'started')
  | 'progress'
  | 'interim'
  | 'heartbeat'
  | 'complete'
  | 'COMPLETE'     // v1.2: new event name (alias for 'complete')
  | 'error'
  | 'ERROR'        // v1.2: new event name (alias for 'error')
  | 'CANCELLED'    // v1.2: explicit cancellation event

export interface V1RunStartedData {
  run_id: string
}

export interface V1ProgressData {
  percent: number // 0-100
  message?: string
}

export interface V1InterimFindingsData {
  findings: string[]
}

export interface V1CompleteData {
  result: V1RunResult
  execution_ms: number
  // Optional diagnostics payload (if provided by backend COMPLETE event)
  diagnostics?: {
    resumes?: number
    trims?: 0 | 1
    recovered_events?: number
    correlation_id?: string
    [key: string]: unknown
  }
  // Optional metadata derived from HTTP response headers
  correlation_id_header?: string
  degraded?: boolean
  // CEE (Cognitive Enhancement Engine) overlay fields
  ceeReview?: CeeDecisionReviewPayload
  ceeTrace?: CeeTraceMeta
  ceeError?: CeeErrorViewModel
}

export interface V1ErrorData {
  code: string
  message: string
  details?: unknown
}

// Error types
export type V1ErrorCode =
  | 'BAD_INPUT'
  | 'RATE_LIMITED'
  | 'LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'GATEWAY_TIMEOUT'  // 504: Proxy timeout (analysis took too long)
  | 'NETWORK_ERROR'

export interface V1Error {
  code: V1ErrorCode
  message: string
  field?: string
  max?: number
  retry_after?: number
  // Use a loose type here because different callers enrich details with
  // HTTP status codes and backend-specific payloads.
  details?: Record<string, unknown>
  requestId?: string  // P2.3: Request ID for debugging
}

// Limits (PLoT Engine v1.1 Contract)
export const V1_LIMITS = {
  MAX_NODES: 50,      // Contract: max 50 nodes
  MAX_EDGES: 200,     // Contract: max 200 edges
  MAX_LABEL_LENGTH: 120,
  MAX_BODY_LENGTH: 2000,
  RATE_LIMIT_RPM: 60,
} as const

// v1.2: Extended limits response (M1 spec format)
export interface V1LimitsResponse {
  schema: 'limits.v1'
  max_nodes: number
  max_edges: number
  max_body_kb: number
  rate_limit_rpm: number
  flags?: {
    scm_lite?: number // 0 or 1
    [key: string]: unknown
  }
  engine_p95_ms_budget?: number // v1.2: p95 execution time budget in milliseconds

  // Legacy nested format for backwards compat
  nodes?: { max: number }
  edges?: { max: number }
}

// SSE handlers
export interface V1StreamHandlers {
  onStarted: (data: V1RunStartedData) => void
  onProgress: (data: V1ProgressData) => void
  onInterim: (data: V1InterimFindingsData) => void
  onComplete: (data: V1CompleteData) => void
  onError: (error: V1Error) => void
}

// Template types (actual v1 API format)
export interface V1TemplateSummary {
  id: string
  label: string // Display name
  summary: string // Short description
  updated_at: string // ISO timestamp
}

// v1 API returns bare array, not wrapped object
export type V1TemplateListResponse = V1TemplateSummary[]

export interface V1TemplateGraphResponse {
  template_id: string
  default_seed: number
  graph: V1Graph
  version?: '1.2' // v1.2: template schema version
}

// Validation types
export interface V1ValidationError {
  code: string
  message: string
  node_id?: string
  edge_id?: string
  severity: 'error' | 'warning'
  suggestion?: string // v1.2: coaching hint for non-blocking violations
}

export interface V1ValidateRequest {
  graph: V1Graph
}

export interface V1ValidateResponse {
  valid: boolean
  errors: V1ValidationError[] // Hard errors (block execution)
  violations?: V1ValidationError[] // v1.2: soft coaching warnings (non-blocking)
}

// =============================================================================
// Run Bundle Types (Option Ranking - v1.3)
// =============================================================================

export interface V1RunBundleRequest {
  base_graph: V1Graph
  deltas: Array<{
    name: string
    modifications: Record<string, unknown>
  }>
  include_ranking?: boolean
  include_change_attribution?: boolean
  baseline_index?: number // 0-indexed, which delta is baseline
  sort_by?: 'p10' | 'p50' | 'p90'
}

export interface V1NodeSensitivity {
  node_id: string
  node_label: string
  contribution_pct: number // 0-100
}

export interface V1ChangeAttribution {
  summary: string
  primary_factors?: string[]
}

export interface V1DeltaFromBaseline {
  p50: number
  p10?: number
  p90?: number
  change_attribution?: V1ChangeAttribution
}

export interface V1RunBundleResult {
  label: string
  rank: number
  success_probability: number
  summary: {
    p10: number
    p50: number
    p90: number
  }
  sensitivity_by_node?: V1NodeSensitivity[]
  delta_from_baseline?: V1DeltaFromBaseline
}

export interface V1RankingSummary {
  winner: string
  winner_p50: number
  margin_pct: number
  ranking_confidence: 'high' | 'medium' | 'low'
}

export interface V1RunBundleResponse {
  results: V1RunBundleResult[]
  ranking_summary?: V1RankingSummary
}

// =============================================================================
// Key Insight Types (CEE Assist - Phase 2)
// =============================================================================

/**
 * Request for key insight after run_bundle completes
 */
export interface V1KeyInsightRequest {
  /** Run ID or response hash from completed analysis */
  run_id: string
  /** Optional scenario context for richer insight */
  scenario_name?: string
  /** Optional: include drivers in response */
  include_drivers?: boolean
}

/**
 * Key insight response from /v1/assist/key-insight
 */
export interface V1KeyInsightResponse {
  /** Main headline insight (e.g., "Option A leads to 25% higher success") */
  headline: string
  /** Primary driver explanation */
  primary_driver?: {
    label: string
    contribution_pct: number
    explanation: string
    node_id?: string
  }
  /** Confidence statement (e.g., "High confidence based on 3 validated factors") */
  confidence_statement?: string
  /** Optional caveat/warning (e.g., "However, this assumes stable market conditions") */
  caveat?: string
  /** Source attribution */
  provenance: 'cee'
}

// =============================================================================
// Belief Elicitation Types (CEE Elicit - Phase 2)
// =============================================================================

/**
 * Request for belief elicitation from natural language
 */
export interface V1BeliefElicitRequest {
  /** Natural language input (e.g., "I think market adoption will be around 60-70%") */
  text: string
  /** Context about the factor being estimated */
  factor_context?: {
    label: string
    node_id?: string
    current_value?: number
  }
  /** Optional: scenario context for better interpretation */
  scenario_name?: string
}

/**
 * Parsed belief from natural language
 */
export interface V1BeliefElicitResponse {
  /** Suggested numeric value (0-1 for probabilities, or raw value) */
  suggested_value: number
  /** Confidence in the parse */
  confidence: 'high' | 'medium' | 'low'
  /** Explanation of how value was derived */
  reasoning: string
  /** Source attribution */
  provenance: 'cee'
  /** If true, CEE needs clarification before providing value */
  needs_clarification?: boolean
  /** Clarifying question to ask user */
  clarifying_question?: string
  /** Options for clarification (when needs_clarification is true) */
  options?: Array<{
    label: string
    value: number
  }>
  /** Original text echoed back */
  original_text?: string
}

// =============================================================================
// Utility Weight Suggestion Types (CEE Suggest - Phase 2)
// =============================================================================

/**
 * Request for utility weight suggestions
 */
export interface V1UtilityWeightRequest {
  /** Graph context for understanding outcomes */
  graph: {
    nodes: Array<{
      id: string
      type?: string
      label?: string
    }>
    edges: Array<{
      source: string
      target: string
    }>
  }
  /** Outcome nodes to weight */
  outcome_node_ids: string[]
  /** Optional: user's stated goal for context */
  user_goal?: string
  /** Optional: scenario context */
  scenario_name?: string
}

/**
 * Individual weight suggestion for an outcome
 */
export interface V1UtilityWeightSuggestion {
  node_id: string
  label: string
  suggested_weight: number // 0-1, normalised
  reasoning: string
}

/**
 * Alternative weighting preset
 */
export interface V1WeightingPreset {
  id: string
  label: string
  description: string
  weights: Record<string, number> // node_id -> weight
  icon?: string // emoji or icon name
}

/**
 * Response from /v1/suggest/utility-weights
 */
export interface V1UtilityWeightResponse {
  /** Suggested weights for each outcome */
  suggestions: V1UtilityWeightSuggestion[]
  /** Confidence in suggestions */
  confidence: 'high' | 'medium' | 'low'
  /** Overall reasoning */
  reasoning: string
  /** Alternative preset weightings */
  alternatives?: V1WeightingPreset[]
  /** Source attribution */
  provenance: 'cee'
}

// =============================================================================
// Risk Tolerance Elicitation Types (CEE Elicit - Phase 2)
// =============================================================================

/** Risk profile preset values */
export type RiskProfilePreset = 'risk_averse' | 'neutral' | 'risk_seeking'

/**
 * Request for risk tolerance elicitation
 */
export interface V1RiskToleranceRequest {
  /** Mode: 'get_questions' to fetch questionnaire, 'submit_answers' to get profile */
  mode: 'get_questions' | 'submit_answers'
  /** Required when mode='submit_answers': answers to questions */
  answers?: Array<{
    question_id: string
    answer: string | number
  }>
  /** Optional: preset selection (skips questionnaire) */
  preset?: RiskProfilePreset
  /** Optional: context for better calibration */
  context?: {
    decision_domain?: string // e.g., 'business', 'personal', 'investment'
    time_horizon?: 'short' | 'medium' | 'long'
  }
}

/**
 * Individual questionnaire question
 */
export interface V1RiskQuestion {
  id: string
  text: string
  type: 'scale' | 'choice' | 'numeric'
  /** For scale questions: min/max values */
  scale?: {
    min: number
    max: number
    min_label: string
    max_label: string
  }
  /** For choice questions: available options */
  choices?: Array<{
    value: string | number
    label: string
  }>
  /** For numeric: optional range */
  range?: {
    min?: number
    max?: number
    step?: number
  }
}

/**
 * Response from /v1/elicit/risk-tolerance (mode='get_questions')
 */
export interface V1RiskQuestionsResponse {
  /** List of questions to answer */
  questions: V1RiskQuestion[]
  /** Estimated completion time */
  estimated_minutes?: number
  /** Source attribution */
  provenance: 'cee'
}

/**
 * Risk profile result
 */
export interface V1RiskProfile {
  /** Profile classification */
  profile: RiskProfilePreset
  /** Human-readable label */
  label: string
  /** Numeric score (0=risk averse, 1=risk seeking) */
  score: number
  /** Confidence in assessment */
  confidence: 'high' | 'medium' | 'low'
  /** Explanation of assessment */
  reasoning: string
  /** Risk capacity indicator (separate from risk tolerance) */
  capacity_note?: string
}

/**
 * Response from /v1/elicit/risk-tolerance (mode='submit_answers' or preset)
 */
export interface V1RiskProfileResponse {
  /** The determined risk profile */
  profile: V1RiskProfile
  /** Recommendations based on profile */
  recommendations?: string[]
  /** Source attribution */
  provenance: 'cee'
}
