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

export interface CeeDecisionReviewPayload {
  story?: CeeDecisionReviewStory
  journey?: CeeDecisionReviewJourney
  uiFlags?: CeeDecisionReviewUiFlags
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
