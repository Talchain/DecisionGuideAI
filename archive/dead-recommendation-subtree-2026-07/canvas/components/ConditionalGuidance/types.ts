/**
 * Conditional Guidance Types
 *
 * Types for Phase 4 conditional recommendation display.
 * Shows when recommendations might change based on conditions.
 */

import type { ConfidenceLevel } from '../../../adapters/plot/types'

// ============================================================================
// ISL Conditional Recommendation Types
// ============================================================================

export interface ConditionalRecommendRequest {
  run_id: string
  ranked_options: RankedOption[]
  condition_types?: ('threshold' | 'dominance' | 'risk_profile')[]
  max_conditions?: number
}

export interface RankedOption {
  option_id: string
  option_label: string
  rank: number
  expected_value: number
  confidence: ConfidenceLevel
}

export interface ConditionalRecommendResponse {
  primary_recommendation: Recommendation
  conditional_recommendations: ConditionalRecommendation[]
  robustness_summary: RobustnessSummary
}

export interface Recommendation {
  option_id: string
  option_label: string
  expected_value: number
  confidence: ConfidenceLevel
}

export interface ConditionalRecommendation {
  condition_expression: ConditionExpression
  triggered_recommendation: Recommendation
  probability_of_condition?: number
  impact_magnitude: 'high' | 'medium' | 'low'
}

export interface ConditionExpression {
  type: 'threshold' | 'dominance' | 'risk_profile' | 'compound'
  /** Human-readable condition description */
  description?: string
  /** For threshold conditions */
  variable?: string
  operator?: '<' | '>' | '<=' | '>=' | '='
  value?: number
  /** For compound conditions */
  conditions?: ConditionExpression[]
  operator_type?: 'AND' | 'OR'
}

export interface RobustnessSummary {
  level: 'high' | 'medium' | 'low'
  explanation: string
  /** Number of scenarios that could change the recommendation */
  switching_scenarios: number
}

// ============================================================================
// CEE Narration Types
// ============================================================================

export interface NarrateConditionsRequest {
  conditions: ConditionalRecommendation[]
  context: {
    decision_label: string
    primary_recommendation: string
  }
}

export interface NarrateConditionsResponse {
  robustness_statement: string
  conditions: NarratedCondition[]
}

export interface NarratedCondition {
  /** "If marketing ROI drops below 30%..." */
  if_statement: string
  /** "...consider keeping current price" */
  then_statement: string
  /** "...because higher price won't generate enough volume" */
  because_statement: string
  /** How to monitor this condition */
  how_to_monitor?: string
  /** Likelihood description: "Moderate likelihood (35%)" */
  likelihood?: string
  /** Impact if condition triggers */
  impact: 'high' | 'medium' | 'low'
  /** Original condition for linking */
  original_condition?: ConditionalRecommendation
}

// ============================================================================
// Component Props
// ============================================================================

export interface ConditionalGuidanceProps {
  /** Run ID for fetching conditions */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Whether to auto-fetch */
  autoFetch?: boolean
  /** Maximum conditions to display */
  maxConditions?: number
  /** Callback when condition element is clicked (for graph highlighting) */
  onConditionClick?: (edgeId?: string, nodeId?: string) => void
  /** Compact mode for embedding in RecommendationCard */
  compact?: boolean
}

export interface ConditionCardProps {
  condition: NarratedCondition
  index: number
  onConditionClick?: (edgeId?: string, nodeId?: string) => void
}

export interface RobustnessIndicatorProps {
  level: 'high' | 'medium' | 'low'
  statement: string
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseConditionalRecommendationsOptions {
  runId?: string
  responseHash?: string
  autoFetch?: boolean
  maxConditions?: number
}

export interface UseConditionalRecommendationsResult {
  /** ISL conditions data */
  conditions: ConditionalRecommendResponse | null
  /** CEE narrated conditions */
  narratedConditions: NarrateConditionsResponse | null
  /** Combined loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Trigger fetch */
  fetch: () => Promise<void>
  /** Clear cached data */
  clear: () => void
}
