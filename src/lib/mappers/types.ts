/**
 * Results Pipeline Mapper Types
 *
 * Canonical types for the results data pipeline. These match the output shape
 * of useResultsSectionData to ensure backwards compatibility.
 *
 * Key contracts:
 * - confidence: number | undefined — never 0 as fallback for missing
 * - switchProbability: number — direct flip probability, no inversion
 * - All optional fields use | undefined, not default values
 */

// =============================================================================
// Data Source Selection
// =============================================================================

export type DataSourcePath =
  | 'downstream_calls.isl'
  | 'enrichment'
  | 'top_level'
  | 'none'

export interface DataSourceResult<T> {
  source: DataSourcePath
  data: T
  fallbacksApplied: string[] // Machine-readable codes, not prose
}

// =============================================================================
// Factor Enrichment Types (CEE-generated insights)
// =============================================================================

/**
 * Factor enrichment from CEE /assist/v1/review
 * Attached to factors via factor_id matching (never by label)
 */
export interface FactorEnrichment {
  /** Factor identifier - used for matching */
  factor_id: string
  /** Factor label (informational, not for matching) */
  factor_label: string
  /** Observational insights (1-2 items typically) */
  observations: string[]
  /** Alternative perspectives (1-2 items typically) */
  perspectives: string[]
  /** Confidence-probing question (only for rank 1-3 factors) */
  confidence_question?: string
}

// =============================================================================
// Factor Sensitivity Types
// =============================================================================

export interface MappedFactor {
  /** Canonical identifier: node_id ?? factor_id ?? id ?? normalised(label) */
  factorId: string
  /** Display label */
  label: string
  /** Raw influence value (elasticity ?? sensitivity_score ?? sensitivity ?? importance_score) */
  rawInfluence: number
  /** Direction: positive increases goal, negative decreases */
  direction: 'positive' | 'negative' | undefined
  /** Confidence from value_of_information (0-100 scale), undefined if missing */
  confidence: number | undefined
  /** Importance rank from source, 0 if not provided */
  importanceRank: number
  /** Value of information raw score (0-1), undefined if missing */
  valueOfInformation: number | undefined
  /** CEE-generated enrichment (observations, perspectives, confidence question) */
  enrichment?: FactorEnrichment
}

export interface FactorSensitivityResult {
  factors: MappedFactor[]
  _sourcePath: DataSourcePath
  _fallbacksApplied: string[]
}

// =============================================================================
// Robustness Types
// =============================================================================

/** Strict robustness level type */
export type RobustnessLevel = 'high' | 'moderate' | 'low' | 'very_low'

/** Badge colour for robustness display */
export type BadgeColour = 'green' | 'amber' | 'orange' | 'red' | 'grey'

export interface MappedFragileEdge {
  /** Edge identifier */
  edgeId: string
  /** Source node ID */
  fromId: string
  /** Target node ID */
  toId: string
  /** Source node label */
  fromLabel: string | undefined
  /** Target node label */
  toLabel: string | undefined
  /** Probability decision flips to alternative (0-1, higher = more likely to flip) */
  switchProbability: number | undefined
  /** Alternative winner ID */
  alternativeWinnerId: string | undefined
  /** Alternative winner label */
  alternativeWinnerLabel: string | undefined
}

/**
 * Near-tie detection from PLoT robustness.near_tie
 * Indicates when top options are too close to call
 */
export interface NearTieInfo {
  /** Whether the top options are effectively tied */
  isTie: boolean
  /** Top option ID */
  topOptionId: string
  /** Second-place option ID (null if only one option) */
  secondOptionId: string | null
  /** All tied option IDs */
  tiedOptionIds: string[]
  /** Probability gap between top options (0-1, NOT percentage) */
  gap: number
  /** Detection threshold used (typically 0.10) */
  threshold: number
}

export interface MappedRobustness {
  /** Overall robustness level */
  level: 'high' | 'moderate' | 'low' | 'very_low' | undefined
  /** Recommendation stability score (0-1) */
  recommendationStability: number | undefined
  /** Ranking stability score (0-1) */
  rankingStability: number | undefined
  /** Whether the decision is robust */
  isRobust: boolean | undefined
  /** Fragile edges with full objects */
  fragileEdges: MappedFragileEdge[]
  /** Robust edge IDs */
  robustEdges: string[]
  /** Recommended option ID */
  recommendedOptionId: string | undefined
  /** Recommended option label */
  recommendedOptionLabel: string | undefined
  /** Near-tie detection (when top options are too close to call) */
  nearTie: NearTieInfo | undefined
}

export interface RobustnessResult {
  robustness: MappedRobustness
  _sourcePath: DataSourcePath
  _fallbacksApplied: string[]
}

// =============================================================================
// Option Comparison Types
// =============================================================================

export interface MappedOptionOutcome {
  /** Arithmetic mean (expected value) */
  expected: number | undefined
  /** 10th percentile */
  p10: number | undefined
  /** 50th percentile (median) */
  p50: number | undefined
  /** 90th percentile */
  p90: number | undefined
}

export interface MappedOption {
  /** Option identifier */
  optionId: string
  /** Display label */
  label: string
  /** Outcome distribution */
  outcome: MappedOptionOutcome
  /** Win probability (0-1) */
  winProbability: number | undefined
  /** Goal probability when no distribution exists */
  goalProbability: number | undefined
  /** Whether this is the recommended option */
  isRecommended: boolean
}

export interface OptionComparisonResult {
  options: MappedOption[]
  _sourcePath: DataSourcePath
  _fallbacksApplied: string[]
}

// =============================================================================
// Orchestrated Result (Full Pipeline Output)
// =============================================================================

export interface PipelineMetadata {
  sourcePath: DataSourcePath
  fallbacksApplied: string[]
  requestId: string | undefined
}

export interface MappedPloTResponse {
  factors: MappedFactor[]
  robustness: MappedRobustness
  options: MappedOption[]
  _meta: PipelineMetadata
}

// =============================================================================
// Raw Source Types (for type-safe boundary parsing)
// =============================================================================

/**
 * Raw factor from any source path.
 * All fields optional — mappers handle missing data gracefully.
 */
export interface RawFactor {
  factor_id?: string
  node_id?: string
  id?: string
  label?: string
  factor_label?: string
  elasticity?: number
  sensitivity_score?: number
  sensitivity?: number
  importance_score?: number
  direction?: string
  importance_rank?: number
  value_of_information?: number
  confidence?: number
}

/**
 * Raw fragile edge from robustness.fragile_edges
 */
export interface RawFragileEdge {
  edge_id?: string
  edgeId?: string
  from_id?: string
  fromId?: string
  source?: string
  to_id?: string
  toId?: string
  target?: string
  from_label?: string
  fromLabel?: string
  to_label?: string
  toLabel?: string
  switch_probability?: number
  switchProbability?: number
  alternative_winner_id?: string
  alternativeWinnerId?: string
  alternative_winner_label?: string
  alternativeWinnerLabel?: string
  alternativeWinner?: string
}

/**
 * Raw near-tie object from PLoT robustness.near_tie
 */
export interface RawNearTie {
  is_tie?: boolean
  isTie?: boolean
  top_option_id?: string
  topOptionId?: string
  second_option_id?: string | null
  secondOptionId?: string | null
  tied_option_ids?: string[]
  tiedOptionIds?: string[]
  gap?: number
  threshold?: number
}

/**
 * Raw robustness object from response
 */
export interface RawRobustness {
  level?: string
  recommendation_stability?: number
  recommendationStability?: number
  ranking_stability?: number
  rankingStability?: number
  is_robust?: boolean
  isRobust?: boolean
  fragile_edges?: RawFragileEdge[]
  fragileEdges?: RawFragileEdge[]
  robust_edges?: string[]
  robustEdges?: string[]
  recommended_option_id?: string
  recommendedOptionId?: string
  recommended_option_label?: string
  recommendedOptionLabel?: string
  near_tie?: RawNearTie
  nearTie?: RawNearTie
}

/**
 * Raw option from option_comparison
 */
export interface RawOption {
  option_id?: string
  optionId?: string
  id?: string
  label?: string
  name?: string
  expected?: number
  mean?: number
  p10?: number
  p50?: number
  p90?: number
  outcome?: {
    mean?: number
    expected?: number
    p10?: number
    p50?: number
    p90?: number
  }
  win_probability?: number
  winProbability?: number
  goal_probability?: number
  goalProbability?: number
  probability_of_goal?: number
  is_recommended?: boolean
  isRecommended?: boolean
}
