/**
 * Robustness Analysis Types
 *
 * Brief 12.8: Consolidated type definitions for ISL robustness integration
 *
 * This file re-exports and extends types from RecommendationCard/types.ts
 * while adding ISL-specific raw response types for adapter use.
 */

// Re-export UI types from RecommendationCard
export type {
  RobustnessResult,
  RobustnessLabel,
  SensitiveParameter,
  ValueOfInformation,
  RobustnessBound,
  RankedOptionWithRobustness,
  ParetoResult,
  RobustnessBlockProps,
} from '../components/RecommendationCard/types'

// Re-export ConfidenceLevel from plot adapter
export type { ConfidenceLevel } from '../../adapters/plot/types'

// =============================================================================
// ISL Raw Response Types
// =============================================================================

/**
 * Raw sensitivity parameter from ISL API
 * May use different field names than UI types
 */
export interface ISLRawSensitivityParameter {
  parameter_id?: string
  node_id?: string
  name?: string
  label?: string
  value?: number
  current_value?: number
  threshold?: number
  flip_threshold?: number
  direction?: 'increase' | 'decrease'
  magnitude?: number
  sensitivity?: number
  explanation?: string
}

/**
 * Raw value of information from ISL API
 */
export interface ISLRawValueOfInfo {
  parameter_id?: string
  node_id?: string
  name?: string
  label?: string
  expected_value?: number
  evpi?: number
  worth_investigating?: boolean
  action?: string
  suggested_action?: string
  resolution_cost?: number
  confidence?: 'high' | 'medium' | 'low'
}

/**
 * Raw robustness bound from ISL API
 */
export interface ISLRawRobustnessBound {
  scenario?: string
  label?: string
  lower?: number
  upper?: number
  lower_bound?: number
  upper_bound?: number
  varied_parameters?: string[]
  parameters?: string[]
}

/**
 * Raw option ranking from ISL API
 */
export interface ISLRawOptionRanking {
  option_id: string
  option_label?: string
  label?: string
  rank: number
  expected_value?: number
  ev?: number
  confidence?: 'high' | 'medium' | 'low'
  robust_winner?: boolean
  is_robust?: boolean
  loses_in_scenarios?: string[]
}

/**
 * Raw Pareto result from ISL API
 */
export interface ISLRawPareto {
  frontier?: string[]
  frontier_options?: string[]
  dominated?: string[]
  dominated_options?: string[]
  narrative?: string
  tradeoff_narrative?: string
  criteria?: string[]
  objectives?: string[]
}

/**
 * Raw recommendation from ISL API
 */
export interface ISLRawRecommendation {
  option_id: string
  confidence?: 'high' | 'medium' | 'low'
  status?: 'clear' | 'close_call' | 'uncertain'
  recommendation_status?: 'clear' | 'close_call' | 'uncertain'
}

/**
 * Complete raw robustness response from ISL API
 */
export interface ISLRawRobustnessResponse {
  option_rankings?: ISLRawOptionRanking[]
  rankings?: ISLRawOptionRanking[]
  recommendation?: ISLRawRecommendation
  sensitivity?: ISLRawSensitivityParameter[]
  sensitive_parameters?: ISLRawSensitivityParameter[]
  robustness_label?: 'robust' | 'moderate' | 'fragile'
  robustness?: 'robust' | 'moderate' | 'fragile'
  robustness_bounds?: ISLRawRobustnessBound[]
  bounds?: ISLRawRobustnessBound[]
  value_of_information?: ISLRawValueOfInfo[]
  voi?: ISLRawValueOfInfo[]
  narrative?: string
  summary?: string
  pareto?: ISLRawPareto
  pareto_analysis?: ISLRawPareto
}

// =============================================================================
// Request Types
// =============================================================================

/**
 * UI-facing robustness request options
 */
export interface RobustnessRequestOptions {
  runId: string
  responseHash?: string
  includeSensitivity?: boolean
  includeVoi?: boolean
  includePareto?: boolean
}

/**
 * ISL API robustness request payload
 */
export interface ISLRobustnessRequestPayload {
  run_id: string
  response_hash?: string
  include_sensitivity: boolean
  include_voi: boolean
  include_pareto: boolean
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Options for useRobustness hook
 */
export interface UseRobustnessOptions {
  /** Run ID to fetch robustness for */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
}

/**
 * Result from useRobustness hook
 */
export interface UseRobustnessResult {
  /** The robustness data if available */
  robustness: import('../components/RecommendationCard/types').RobustnessResult | null
  /** Loading state */
  loading: boolean
  /** Error message if request failed */
  error: string | null
  /** Manual refresh function */
  refetch: () => Promise<void>
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Recommendation confidence derived from robustness analysis
 */
export type RecommendationConfidence = 'clear' | 'close_call' | 'uncertain'

/**
 * Direction of sensitivity (which way the parameter would need to move to cause flip)
 */
export type SensitivityDirection = 'increase' | 'decrease'

/**
 * Whether resolving uncertainty is worth the cost
 */
export interface VoiAssessment {
  nodeId: string
  label: string
  evpi: number
  worthInvestigating: boolean
  suggestedAction?: string
  estimatedCost?: number
}
