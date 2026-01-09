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
  review: CeeDecisionReviewPayloadV1 | null | undefined,
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
