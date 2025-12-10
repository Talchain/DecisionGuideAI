export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface ReportV1 {
  schema: 'report.v1'
  meta: {
    seed: number
    response_id: string
    elapsed_ms: number
  }
  model_card: {
    response_hash: string
    response_hash_algo: 'sha256'
    normalized: true
    // P0 Engine Features (optional - may not be present in all responses)
    // identifiability_tag can be enum OR string (from top-level identifiability field)
    identifiability_tag?: 'identifiable' | 'underidentified' | 'overidentified' | 'unknown' | string
    sources?: Array<{ edge_id: string; provenance?: string }>
  }
  results: {
    conservative: number
    likely: number
    optimistic: number
    units?: 'currency' | 'percent' | 'count'
    unitSymbol?: string
  }
  confidence: {
    level: ConfidenceLevel
    why: string
  }
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    /** Contribution as 0-1 for percentage display */
    contribution?: number
    /** Node ID for canvas highlighting (camelCase) */
    nodeId?: string
    /** Edge ID for canvas highlighting (camelCase) */
    edgeId?: string
  }>
  critique?: string[]
  run?: CanonicalRun // v1.2: normalized run data with p10/p50/p90 bands

  // Sprint N P0: Trust Signal Fields (backend already returns these)
  graph_quality?: {
    score: number
    completeness: number
    evidence_coverage: number
    balance: number
    issues_count?: number
    recommendation?: string
  }
  insights?: {
    summary: string
    risks: string[]
    next_steps: string[]
    node_references?: Array<{
      node_id: string
      label?: string
      context?: string
    }>
    edge_references?: Array<{
      edge_id: string
      label?: string
      context?: string
    }>
  }

  // P0.1: Canonical decision readiness (normalized from confidence.level)
  // This field is always populated by the adapter from confidence.level
  decision_readiness?: {
    ready: boolean
    confidence: 'high' | 'medium' | 'low'
    blockers: string[]
    warnings: string[]
    passed: string[]
  }

  // Change Attribution - Explains why outcomes changed between runs
  change_attribution?: {
    primary_drivers: Array<{
      driver_id: string
      driver_label: string
      contribution_pct: number
      affected_nodes: string[]
      polarity: 'increase' | 'decrease'
    }>
  }

  // Evidence Freshness - Data quality and age indicators
  evidence_freshness?: {
    overall_quality: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'
    edge_freshness: Array<{
      edge_id: string
      quality: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'
      age_days?: number
      last_updated?: string
      provenance?: string
    }>
    stale_count: number
    fresh_count: number
    aging_count: number
    unknown_count: number
  }
}

export interface ErrorV1 {
  schema: 'error.v1'
  code:
    | 'BAD_INPUT'
    | 'LIMIT_EXCEEDED'
    | 'RATE_LIMITED'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR'
    | 'TIMEOUT'
    | 'GATEWAY_TIMEOUT'
    | 'NETWORK_ERROR'
    | 'NOT_FOUND'
    | 'SERVICE_UNAVAILABLE'
    | 'METHOD_NOT_ALLOWED'
    | 'CANCELLED'
  /**
   * Human-readable error message used by existing callers.
   * For error.v1 envelopes this typically mirrors the top-level `message` field.
   */
  error: string
  /** Optional original message field from the backend envelope. */
  message?: string
  hint?: string
  /**
   * Whether the operation is safe to retry from the engine's perspective.
   * When absent, callers should fall back to local heuristics (e.g. by code/status).
   */
  retryable?: boolean
  /** Source of the error, e.g. "plot". */
  source?: string
  /** Stable request identifier for support/debugging. */
  request_id?: string
  fields?: {
    field?: 'graph.nodes' | 'graph.edges' | string
    max?: number
    /** Optional structured path for validation errors (when provided by backend). */
    path?: string[]
  }
  /** Normalised retry-after delay in seconds. */
  retry_after?: number
}

export interface LimitsV1 {
  nodes: { max: number }
  edges: { max: number }
  body_kb?: { max: number } // v1.2: max request body size in KB
  engine_p95_ms_budget?: number // v1.2: p95 execution time budget in milliseconds
}

/**
 * Limits fetch result (Sprint 1 & 2 Finalisation)
 * Exposes source tracking to prevent silent fallback masking
 */
export type LimitsFetch =
  | { ok: true; source: 'live'; data: LimitsV1; fetchedAt: number }
  | { ok: true; source: 'fallback'; data: LimitsV1; fetchedAt: number; reason: string }
  | { ok: false; error: Error; fetchedAt: number }

export interface TemplateSummary {
  id: string
  name: string
  version: string
  description: string
}

export interface TemplateDetail extends TemplateSummary {
  default_seed: number
  graph: unknown
}

export interface TemplateListV1 {
  schema: 'template-list.v1'
  items: TemplateSummary[]
}

export interface RunRequest {
  template_id: string
  seed?: number
  outcome_node?: string  // Target outcome node for analysis
  include_debug?: boolean  // Include debug metadata in response
  mode?: 'strict' | 'real'
  inputs?: Record<string, unknown>
  graph?: {
    nodes: Array<{ id: string; data?: { label?: string; body?: string; [key: string]: unknown }; [key: string]: unknown }>
    edges: Array<{ id: string; source: string; target: string; data?: { confidence?: number; weight?: number; [key: string]: unknown }; [key: string]: unknown }>
  } // Optional: if provided, use this graph instead of fetching template
  // Optional idempotency key used to trigger CEE in the Engine when
  // combined with server-side gating. When present, it is forwarded as
  // the Idempotency-Key HTTP header by the v1 client.
  idempotencyKey?: string
  // CEE (Cognitive Enhancement Engine) trigger fields
  scenario_id?: string  // Unique scenario identifier
  scenario_name?: string  // Human-readable scenario name
  save?: boolean  // If true, trigger CEE Decision Review generation
}

export type StreamEvent =
  | { type: 'hello'; data: { response_id: string } }
  | { type: 'tick'; data: { index: number } }
  | { type: 'reconnected'; data: { attempt: number } }
  | { type: 'done'; data: { response_id: string } }
  | { type: 'error'; data: ErrorV1 }

/**
 * Critique item from PLoT Engine v1.1 contract
 * Includes severity tiers, optional node/edge references, and auto-fix metadata
 */
export interface CritiqueItemV1 {
  severity: 'INFO' | 'WARNING' | 'BLOCKER'
  message: string
  code?: string
  node_id?: string
  edge_id?: string
  suggested_fix?: string
  auto_fixable?: boolean
}

/**
 * Canonical run result structure for v1.2
 * Normalizes both legacy and v1.2 response formats
 */
export type CanonicalRun = {
  responseHash: string
  bands: { p10: number | null; p50: number | null; p90: number | null }
  confidence?: { level?: string; reason?: string; score?: number }
  critique?: CritiqueItemV1[]
}

/**
 * CEE (Cognitive Enhancement Engine) Types
 * Decision Review feature integration
 */

export interface CEEKeyDriver {
  label: string
  why: string
  impact?: number
  node_id?: string
  edge_id?: string
}

export interface CEENextAction {
  label: string
  why: string
  priority?: 'low' | 'medium' | 'high'
}

export interface CEEStory {
  headline: string
  key_drivers: CEEKeyDriver[]
  next_actions: CEENextAction[]
  summary?: string
}

export interface CEEJourney {
  is_complete: boolean
  missing_envelopes: string[]
  completion_percent?: number
}

export interface CEEReview {
  story: CEEStory
  journey: CEEJourney
  generated_at?: string
}

export interface CEETrace {
  requestId: string
  degraded: boolean
  timestamp: string
  engine_version?: string
}

export type CEEErrorCode =
  | 'CEE_TEMPORARY'
  | 'CEE_UNAVAILABLE'
  | 'CEE_TIMEOUT'
  | 'CEE_INVALID_INPUT'
  | 'CEE_QUOTA_EXCEEDED'

export interface CEEError {
  code: CEEErrorCode
  retryable: boolean
  traceId: string
  suggestedAction: 'retry' | 'contact_support' | 'check_input'
  message?: string
  details?: Record<string, unknown>
}

// =============================================================================
// Run Bundle Types (Option Ranking)
// =============================================================================

/**
 * Node sensitivity data - shows which nodes contribute most to uncertainty
 */
export interface NodeSensitivity {
  node_id: string
  node_label: string
  contribution_pct: number // 0-100 percentage of variance contribution
}

/**
 * Change attribution - explains why outcomes differ from baseline
 */
export interface ChangeAttribution {
  summary: string // Human-readable explanation
  primary_factors?: string[]
}

/**
 * Delta from baseline - comparison to reference scenario
 */
export interface DeltaFromBaseline {
  p50: number // Delta in p50 (median) outcome
  p10?: number
  p90?: number
  change_attribution?: ChangeAttribution
}

/**
 * Individual option result in run_bundle response
 */
export interface RunBundleResult {
  label: string // Option name (e.g., "2 days in office")
  rank: number // 1-indexed rank (1 = best)
  success_probability: number // 0-1 probability
  summary: {
    p10: number
    p50: number
    p90: number
  }
  sensitivity_by_node?: NodeSensitivity[]
  delta_from_baseline?: DeltaFromBaseline
}

/**
 * Ranking summary - overall ranking outcome
 */
export interface RankingSummary {
  winner: string // Label of winning option
  winner_p50: number // Winner's median outcome
  margin_pct: number // Percentage margin over second place
  ranking_confidence: 'high' | 'medium' | 'low'
}

/**
 * Run bundle response - compares multiple options
 */
export interface RunBundleResponse {
  results: RunBundleResult[]
  ranking_summary?: RankingSummary
}

/**
 * Run bundle request parameters
 */
export interface RunBundleRequest {
  base_graph: {
    nodes: Array<{ id: string; label?: string; [key: string]: unknown }>
    edges: Array<{ source: string; target: string; [key: string]: unknown }>
  }
  deltas: Array<{
    name: string
    modifications: Record<string, unknown>
  }>
  include_ranking?: boolean
  include_change_attribution?: boolean
  baseline_index?: number // 0-indexed, which delta is baseline
  sort_by?: 'p10' | 'p50' | 'p90'
}

// =============================================================================
// Key Insight Types (CEE Assist - Phase 2)
// =============================================================================

/**
 * Request for key insight after run completes
 */
export interface KeyInsightRequest {
  /** Run ID or response hash from completed analysis */
  run_id: string
  /** Optional scenario context for richer insight */
  scenario_name?: string
  /** Optional: include drivers in response */
  include_drivers?: boolean
}

/**
 * Key insight response
 */
export interface KeyInsightResponse {
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
export interface BeliefElicitRequest {
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
export interface BeliefElicitResponse {
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
// Utility Weight Suggestion Types (UI layer)
// =============================================================================

/**
 * Request for utility weight suggestions
 */
export interface UtilityWeightRequest {
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
export interface UtilityWeightSuggestion {
  node_id: string
  label: string
  suggested_weight: number
  reasoning: string
}

/**
 * Alternative weighting preset
 */
export interface WeightingPreset {
  id: string
  label: string
  description: string
  weights: Record<string, number>
  icon?: string
}

/**
 * Response from utility weight suggestion
 */
export interface UtilityWeightResponse {
  suggestions: UtilityWeightSuggestion[]
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  alternatives?: WeightingPreset[]
  provenance: 'cee'
}

// =============================================================================
// Risk Tolerance Elicitation Types (UI layer)
// =============================================================================

/** Risk profile preset values */
export type RiskProfilePreset = 'risk_averse' | 'neutral' | 'risk_seeking'

/**
 * Request for risk tolerance elicitation
 */
export interface RiskToleranceRequest {
  mode: 'get_questions' | 'submit_answers'
  answers?: Array<{
    question_id: string
    answer: string | number
  }>
  preset?: RiskProfilePreset
  context?: {
    decision_domain?: string
    time_horizon?: 'short' | 'medium' | 'long'
  }
}

/**
 * Individual questionnaire question
 */
export interface RiskQuestion {
  id: string
  text: string
  type: 'scale' | 'choice' | 'numeric'
  scale?: {
    min: number
    max: number
    min_label: string
    max_label: string
  }
  choices?: Array<{
    value: string | number
    label: string
  }>
  range?: {
    min?: number
    max?: number
    step?: number
  }
}

/**
 * Response with questionnaire questions
 */
export interface RiskQuestionsResponse {
  questions: RiskQuestion[]
  estimated_minutes?: number
  provenance: 'cee'
}

/**
 * Risk profile result
 */
export interface RiskProfile {
  profile: RiskProfilePreset
  label: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  capacity_note?: string
}

/**
 * Response with risk profile
 */
export interface RiskProfileResponse {
  profile: RiskProfile
  recommendations?: string[]
  provenance: 'cee'
}
