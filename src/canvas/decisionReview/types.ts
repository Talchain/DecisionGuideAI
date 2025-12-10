export interface CeeDecisionReviewDriver {
  label: string
  why?: string
}

export interface CeeDecisionReviewNextAction {
  label: string
  why?: string
}

export interface CeeDecisionReviewStory {
  headline?: string
  key_drivers?: CeeDecisionReviewDriver[]
  next_actions?: CeeDecisionReviewNextAction[]
}

export interface CeeDecisionReviewJourney {
  is_complete?: boolean
  missing_envelopes?: string[]
}

export interface CeeDecisionReviewUiFlags {
  has_team_disagreement?: boolean
  has_truncation_somewhere?: boolean
  high_risk?: boolean
  [key: string]: boolean | undefined
}

/**
 * Weight suggestion from CEE/ISL backend
 * Provides AI-recommended edge weights with rationale
 */
export interface WeightSuggestion {
  /** Edge ID to apply suggestion to */
  edge_id: string
  /** Suggested weight value (0-1) */
  suggested_weight: number
  /** Optional suggested belief/epistemic uncertainty (0-1) */
  suggested_belief?: number
  /** Human-readable explanation for the suggestion */
  rationale: string
  /** Confidence level of the suggestion */
  confidence: 'high' | 'medium' | 'low'
  /**
   * Whether this suggestion was auto-applied by the backend.
   * Optional for backward compatibility - undefined treated as false.
   * Client-side: also check edge.data.provenance === 'ai-suggested' for user-applied state.
   */
  auto_applied?: boolean
}

export interface CeeDecisionReviewPayload {
  story?: CeeDecisionReviewStory
  journey?: CeeDecisionReviewJourney
  uiFlags?: CeeDecisionReviewUiFlags
  /** Weight suggestions from ISL validation */
  weight_suggestions?: WeightSuggestion[]
}

export interface CeeTraceMeta {
  requestId?: string
  degraded?: boolean
  timestamp?: string
}

export type CeeSuggestedAction = 'retry' | 'fix_input' | 'fail'

export interface CeeErrorViewModel {
  code?: string
  retryable: boolean
  traceId?: string
  suggestedAction: CeeSuggestedAction
}
