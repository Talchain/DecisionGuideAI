/**
 * CEE (Contextual Evaluation Engine) Types
 *
 * Types for the M1 CEE Orchestrator - Decision Review functionality.
 * These are additive fields returned by PLoT's /v1/run endpoint.
 *
 * @see M1 CEE Orchestrator UI Workstream v1.3
 */

// =============================================================================
// Block Types
// =============================================================================

export type BlockId =
  | 'recommendation'
  | 'prediction'
  | 'drivers'
  | 'risks'
  | 'biases'
  | 'gaps'
  | 'next_steps'

export interface ReviewBlockItem {
  id: string
  label: string
  description?: string
  severity?: 'low' | 'medium' | 'high'
}

export interface ReviewBlock {
  id: BlockId
  status: 'ok' | 'requires_run' | 'not_applicable' | 'cannot_compute' | 'low_discrimination'
  status_reason?: string
  source: 'engine' | 'validator' | 'cee' | 'hybrid'
  summary: string
  details?: string
  items?: ReviewBlockItem[]
  priority: 1 | 2 | 3
  severity?: 'low' | 'medium' | 'high'
  /** Index signature for future-proofing (highlights, model_actions, etc.) */
  [key: string]: unknown
}

// =============================================================================
// Decision Review Payload
// =============================================================================

export type ReviewIntent = 'selection' | 'prediction' | 'validation'
export type AnalysisState = 'not_run' | 'ran' | 'partial' | 'stale'
export type ReadinessLevel = 'ready' | 'caution' | 'not_ready'
export type FactorStatus = 'ok' | 'warning' | 'blocking'

export interface ReadinessFactor {
  label: string
  status: FactorStatus
}

export interface ReviewReadiness {
  level: ReadinessLevel
  headline: string
  factors: ReadinessFactor[]
}

export interface CeeDecisionReviewPayloadV1 {
  intent: ReviewIntent
  analysis_state: AnalysisState
  readiness: ReviewReadiness
  blocks: ReviewBlock[]
  /** Index signature for future-proofing */
  [key: string]: unknown
}

// =============================================================================
// CEE Trace (Three-ID Tracing per spec v1.1)
// =============================================================================

export interface CeeTrace {
  /** PLoT's request ID */
  plot_request_id: string
  /** Request ID sent to CEE (null if CEE not called) */
  cee_sent_request_id: string | null
  /** Request ID returned by CEE (null if no response) */
  cee_returned_request_id: string | null

  /** CEE latency in milliseconds (null if not measured) */
  latency_ms: number | null
  /** Model used by CEE (null if unknown) */
  model: string | null
  /** True if sent != returned (debugging flag) */
  id_mismatch?: boolean

  /** Index signature for legacy/future fields */
  [key: string]: unknown
}

// =============================================================================
// CEE Error
// =============================================================================

export interface CeeError {
  /** Error code (e.g., 'CEE_TIMEOUT', 'CEE_UNAVAILABLE') */
  code?: string
  /** Human-readable error message */
  message?: string
  /** Canonical retry flag per PLoT run.v1 contract */
  retriable?: boolean
  /** Tolerated alias (legacy/SDK variance) */
  retryable?: boolean
  /** Trace ID for debugging */
  traceId?: string
  /** Suggested action for user */
  suggestedAction?: string
  /** Index signature for future-proofing */
  [key: string]: unknown
}

// =============================================================================
// Error Detail (for Debug Panel)
// =============================================================================

/**
 * Detailed error information for debugging.
 * Captured when API requests fail for display in Debug Panel.
 */
export interface ErrorDetail {
  /** Timestamp when error occurred */
  timestamp: string
  /** Which upstream service failed (e.g., 'CEE', 'PLoT', 'ISL') */
  service: 'CEE' | 'PLoT' | 'ISL' | 'unknown'
  /** HTTP status code (e.g., 500, 504, 429) */
  httpStatus?: number
  /** Error code from the service */
  errorCode?: string
  /** Human-readable error message */
  message: string
  /** Request ID for correlation */
  requestId?: string
  /** Raw error body (JSON stringified if object) */
  rawBody?: string
  /** Endpoint that was called */
  endpoint?: string
  /** Whether the error is retryable */
  retryable?: boolean
}

// =============================================================================
// CEE Meta Fields (added to existing meta)
// =============================================================================

export interface CeeMeta {
  /** Always present per PLoT run.v1 contract */
  request_id_cee_sanitised: boolean
  /** DEPRECATED - use ceeError != null */
  cee_degraded?: boolean
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a CEE error allows retry.
 * Returns true only if retriable/retryable is explicitly true.
 * Defaults to false for safety - server must opt-in to allow retry.
 */
export function canRetry(error: CeeError | null | undefined): boolean {
  if (!error) return false
  return error.retriable === true || error.retryable === true
}

/**
 * Safely get a block by ID from a review.
 * Returns undefined without throwing if review is null/undefined.
 *
 * IMPORTANT: Block order is NOT guaranteed. CEE may return blocks in any order.
 * Always use getBlock() by ID — never rely on array index.
 */
export function getBlock(
  review: CeeDecisionReviewPayloadV1 | null | undefined,
  id: BlockId
): ReviewBlock | undefined {
  return review?.blocks?.find(b => b.id === id)
}

/**
 * Get blocks for a specific intent layout.
 * Returns the blocks to render for each section based on intent.
 * Falls back to 'selection' layout for unknown intents to prevent crashes.
 */
export function getBlocksForIntent(
  _review: CeeDecisionReviewPayloadV1 | null | undefined,
  intent: ReviewIntent
): {
  hero: BlockId
  analysis: BlockId[]
  considerations: BlockId[]
  actions: BlockId
} {
  // Default layout used for 'selection' and as fallback for unknown intents
  const defaultLayout = {
    hero: 'recommendation' as BlockId,
    analysis: ['drivers'] as BlockId[],
    considerations: ['risks', 'biases'] as BlockId[],
    actions: 'next_steps' as BlockId,
  }

  switch (intent) {
    case 'selection':
      return defaultLayout
    case 'prediction':
      return {
        hero: 'prediction',
        analysis: ['drivers'],
        considerations: ['risks', 'biases'],
        actions: 'next_steps',
      }
    case 'validation':
      return {
        hero: 'biases',
        analysis: ['drivers', 'risks'],
        considerations: ['gaps'],
        actions: 'next_steps',
      }
    default:
      // Fallback for unknown intents - use selection layout
      if (import.meta.env?.DEV) {
        console.warn(`[CEE] Unknown intent "${intent}", using default layout`)
      }
      return defaultLayout
  }
}

// =============================================================================
// M1 Review Types (PLoT /v2/run CEE enrichment)
// =============================================================================

/**
 * M1 Review Status - indicates availability of CEE-generated content
 */
export type M1ReviewStatus = 'available' | 'unavailable' | 'degraded' | 'skipped'

/**
 * Decision Quality - readiness assessment from CEE
 */
export interface DecisionQualityV3 {
  level: 'ready' | 'caution' | 'not_ready'
  headline: string
  factors?: Array<{
    label: string
    status: 'ok' | 'warning' | 'blocking'
  }>
}

/**
 * Insight - individual insight from CEE analysis
 */
export interface InsightV3 {
  id: string
  type: 'finding' | 'caveat' | 'risk' | 'opportunity'
  severity?: 'low' | 'medium' | 'high'
  content: string
  related_nodes?: string[]
}

/**
 * Improvement Guidance - actionable suggestions from CEE
 */
export interface ImprovementGuidanceV3 {
  priority: 'critical' | 'high' | 'medium' | 'low'
  action: string
  reason: string
  affected_nodes?: string[]
}

/**
 * Rationale - decision explanation from CEE
 */
export interface RationaleV3 {
  summary: string
  key_driver?: string
  confidence_explanation?: string
}

/**
 * Robustness Synthesis - plain-language robustness summary from CEE
 */
export interface RobustnessSynthesisV3 {
  headline: string
  assumption_explanations?: Array<{
    node_id: string
    label: string
    explanation: string
  }>
  investigation_suggestions?: string[]
}

/**
 * M1 Review - combined CEE enrichment data from /v2/run
 */
export interface M1Review {
  cee_status: M1ReviewStatus
  decision_quality?: DecisionQualityV3 | null
  insights?: InsightV3[] | null
  improvement_guidance?: ImprovementGuidanceV3[] | null
  rationale?: RationaleV3 | null
  robustness_synthesis?: RobustnessSynthesisV3 | null
  ceeTrace?: {
    requestId: string
    latency_ms: number
    degraded?: boolean
  }
}

// =============================================================================
// M1 Coaching Types (PLoT /v2/run deterministic coaching fields)
// =============================================================================

/**
 * M1 Coaching Readiness - actionability estimate based on evidence and model quality.
 * Separate from statistical robustness.
 */
export type M1CoachingReadiness = 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing' | 'low' | 'not_ready'

/**
 * Executive Summary - headline coaching content from PLoT.
 */
export interface M1ExecutiveSummary {
  headline: string
  paragraph: string
  /** Concrete recommendation sentence, e.g. "Acquire Competitor is the clear winner..." */
  decision_statement: string
  /** Key uncertainty qualifier, e.g. "Key uncertainty: Engineering Capacity..." */
  key_qualifier: string
  /** Concrete next step, e.g. "Gather evidence on Engineering Capacity before deciding." */
  action_implication: string
  /** @deprecated Use decision_statement. Kept for backwards compat with older payloads. */
  recommendation?: string
  /** @deprecated Use key_qualifier. Kept for backwards compat with older payloads. */
  readiness_statement?: string
  /** Full paragraph summary (alias for paragraph, some payloads send this) */
  summary?: string
}

/**
 * Top Fragile Edge from M1 coaching - the single most decision-relevant sensitivity.
 * Parsed from PLoT payload: edge_id is "from_id->to_id", label is "From Label → To Label".
 */
export interface M1TopFragileEdge {
  /** Composite edge ID, e.g. "fac_product_market_fit->out_customer_acquisition" */
  edge_id: string
  /** Human-readable edge label, e.g. "Product-Market Fit → Mid-Market Customer Acquisition" */
  label: string
  /** Option that would win if this edge shifts */
  alternative_winner: string
  /** Probability that this edge flips the recommendation (0-1) */
  switch_probability: number
}

/**
 * Readiness Signals - quality/readiness scores from PLoT.
 */
export interface M1ReadinessSignals {
  score: number  // 0-100
  dimensions?: {
    evidence: number
    robustness: number
    clarity: number
  }
}

/**
 * Key Drivers - factor sensitivity with dominant factor detection.
 */
export interface M1KeyDrivers {
  drivers: Array<{
    factor_id: string
    factor_label?: string
    sensitivity_score?: number
    importance_score?: number
    direction?: 'positive' | 'negative'
  }>
  /** Factor ID if any single factor has >50% influence */
  dominant_factor?: string
}

/**
 * Evidence Gap - area where more data would improve decision confidence.
 */
export interface M1EvidenceGap {
  factor_id: string
  factor_label: string
  confidence: number  // 0-100
  voi: number  // Value of Information (0-1)
  suggestion: string
  target_node_id?: string  // For canvas focus
}

/**
 * Next Action - prioritised recommendation for improving the decision.
 */
export interface M1NextAction {
  action: string
  rationale: string
  priority: number  // Lower = more important
  target_type?: 'node' | 'edge' | 'factor' | 'option'
  target_id?: string
  target_label?: string
}

/**
 * Assumption - recorded assumption made during analysis.
 */
export interface M1Assumption {
  severity: 'low' | 'medium' | 'high'
  message: string
  target?: string
}

/**
 * M1 Coaching - deterministic coaching fields from PLoT /v2/run response.
 * Computed after ISL returns, not LLM-generated.
 */
export interface M1Coaching {
  executive_summary?: M1ExecutiveSummary
  /** Option ID → summary headline */
  story_headlines?: Record<string, string>
  readiness?: M1CoachingReadiness
  readiness_signals?: M1ReadinessSignals
  key_drivers?: M1KeyDrivers
  evidence_gaps?: M1EvidenceGap[]
  next_actions?: M1NextAction[]
  assumptions_ledger?: M1Assumption[]
  /** V12: Coaching's pick for the single most decision-relevant sensitivity */
  top_fragile_edge?: M1TopFragileEdge
}
