/**
 * Results Panel Types
 *
 * Shared types for the redesigned Results Panel components.
 * Based on V2RunResponse contract from PLoT /v2/run endpoint.
 *
 * "Coaching over gates" philosophy - users see clear decision guidance.
 */

import type { FactorEnrichment, NearTieInfo } from '../../lib/mappers/types'

// =============================================================================
// Confidence Tier Types
// =============================================================================

export type ConfidenceTier = 'strong' | 'fair' | 'needs_work' | 'unknown'

export interface ConfidenceTierInfo {
  tier: ConfidenceTier
  icon: string
  label: string
  description: string
}

// =============================================================================
// Recommendation Types
// =============================================================================

/**
 * Outcome distribution for an option.
 * p10/p50/p90 are percentiles; mean is the arithmetic average.
 * Note: mean (expected) and p50 (median) are semantically different for skewed distributions.
 */
export interface OptionOutcome {
  /** Arithmetic mean (average outcome) - use OptionResult.expected for display */
  mean: number | null
  /** 10th percentile (pessimistic case) */
  p10: number | null
  /** 50th percentile (median) - NOT the same as mean for skewed distributions */
  p50: number | null
  /** 90th percentile (optimistic case) */
  p90: number | null
}

export interface OptionResult {
  id: string
  label: string
  /** Explicit expected value (mean) - primary value for "Expected" display */
  expected: number | null
  /** Full outcome distribution when available */
  outcome: OptionOutcome
  /** @deprecated Use outcome.p10/p50/p90 instead. Kept for backward compatibility. */
  p10: number | null
  /** @deprecated Use expected or outcome.p50 instead. Kept for backward compatibility. */
  p50: number | null
  /** @deprecated Use outcome.p90 instead. Kept for backward compatibility. */
  p90: number | null
  isRecommended: boolean
  winProbability?: number
  /** Optional goal probability when no distribution data exists. */
  goalProbability?: number | null
  /** Task 2.1: Whether this option is the baseline for comparison */
  isBaseline?: boolean
  /** Task 2.2: Point delta vs baseline (absolute, not percent) */
  deltaFromBaseline?: number | null
}

/** Outcome unit type for formatting - from goal node observed_state.unit */
export type OutcomeUnitType = 'currency' | 'percent' | 'count'

/** Stability level derived from recommendation_stability score */
export type StabilityLevel = 'high' | 'medium' | 'low'

/** How the winner was determined - for honest labelling */
export type WinnerDeterminedBy = 'win_probability' | 'expected_outcome' | 'unknown'

/** Robustness level from PLoT (level field) - aligned with mapper types */
export type RobustnessLevel = 'high' | 'moderate' | 'low' | 'very_low'

/** Robustness label from PLoT (label field - alternative naming) */
export type RobustnessLabel = 'robust' | 'moderate' | 'fragile'

export interface RecommendationSectionData {
  recommendedOption: OptionResult | null
  allOptions: OptionResult[]
  goalLabel: string
  goalNodeId?: string // For click-to-focus
  isSingleOption: boolean
  analysisStatus: 'computed' | 'partial' | 'failed' | 'blocked'
  statusReason?: string
  /** Unit for outcome values (from goal node observed_state.unit) */
  outcomeUnit?: OutcomeUnitType
  /** Symbol for currency (e.g., '$', '£') */
  outcomeUnitSymbol?: string
  /** Recommendation stability (0-1): how often the recommendation stays winner under uncertainty */
  recommendationStability?: number
  /** Win probability (0-1): how often this option beats alternatives */
  winProbability?: number
  /** How the winner was determined - for honest labelling */
  determinedBy?: WinnerDeterminedBy
  /** Robustness level from PLoT */
  robustnessLevel?: RobustnessLevel
  /** Robustness label from PLoT (fallback when level missing) */
  robustnessLabel?: RobustnessLabel
  /** Goal text from scenario framing */
  goalText?: string
  /** Task 2.1: Resolved baseline option ID (PLoT > user > heuristic) */
  baselineId?: string | null
  /** Task 2.1: Baseline outcome for delta calculations */
  baselineOutcome?: number | null
  /** Near-tie detection: when top options are too close to call */
  nearTie?: NearTieInfo
}

// =============================================================================
// Drivers Types (Updated for semantic labels and dynamic normalisation)
// =============================================================================

/**
 * Semantic labels for driver importance.
 * - 'biggest': Rank 1 factor (always unique)
 * - 'strong': normalisedInfluence >= 0.50
 * - 'moderate': normalisedInfluence >= 0.20
 * - 'minor': normalisedInfluence < 0.20
 */
export type DriverSemanticLabel = 'biggest' | 'strong' | 'moderate' | 'minor'

/**
 * Canonical direction after normalisation.
 * 'positive' = increases goal, 'negative' = decreases goal
 */
export type DriverDirection = 'positive' | 'negative'

export interface DriverItem {
  /** Canonical identifier: node_id ?? factor_id ?? id ?? normalised(label) */
  factorKey: string
  /** Display label */
  factorLabel: string
  /** Raw elasticity value (elasticity ?? sensitivity_score ?? sensitivity) */
  rawElasticity: number
  /** Dynamically normalised 0-1 (abs(rawElasticity) / max(all elasticities)) */
  normalisedInfluence: number
  /** ISL influence_score (0-1) - structural causal influence, used for Influence column */
  influenceScore?: number
  /** ISL zero_reason - explains why sensitivity is zero for intervention factors */
  zeroReason?: ZeroReasonCode
  /** 1-indexed rank by absolute elasticity */
  rank: number
  /** Direction derived from edges, normalised */
  direction?: DriverDirection
  /** Semantic label based on rank (1) or threshold (2+) */
  semanticLabel: DriverSemanticLabel
  /** Whether this factor has a matching canvas node for click-to-focus */
  canFocus: boolean
  /** Matching canvas node ID (if different from factorKey) */
  matchedNodeId?: string
  /** Confidence in this factor's influence (beliefExists from edge to goal, 0-1) */
  confidence?: number
  /** Value of Information (0-1) - whether gathering more data could change the decision */
  valueOfInformation?: number
  /** Fragile edge info if this factor can flip the decision */
  fragileEdgeInfo?: {
    /** Probability decision flips to alternative winner (0-1, higher = more likely to flip) */
    switchProbability?: number
    /** Alternative option that would win if flipped */
    alternativeWinnerLabel?: string
  }
  /** PLoT flip_risk_category - how this factor contributes to decision uncertainty */
  flipRiskCategory?: FlipRiskCategory
  /** CEE-generated enrichment (observations, perspectives, confidence question) */
  enrichment?: FactorEnrichment
}

export interface DriversSectionData {
  drivers: DriverItem[]
  driversStatus: 'computed' | 'unavailable' | 'skipped' | 'error'
  topDrivers: DriverItem[] // Top 3 (excluding zero-impact factors)
  totalCount: number
  /** True if any factor has real elasticity data (>0.001). When false, show direction-only view. */
  hasMagnitudeData: boolean
  /** ISL service error message if unavailable */
  islError?: string
  /** Task 2: Count of zero-impact factors hidden from default view */
  hiddenZeroImpactCount?: number
}

// =============================================================================
// Confidence Types (Merged with Improvements per redesign spec)
// =============================================================================

/** Severity levels for critiques/uncertainties */
// 'blocker' = genuine pre-run validation blocker (blocks_analysis: true)
// 'critical' = high-severity fragile edge (flip probability > 0.7) - doesn't block, but critical assumption
// 'error' = medium-severity fragile edge (flip probability > 0.5)
// 'warning' = lower-severity items
// 'info' = informational
export type CritiqueSeverity = 'blocker' | 'critical' | 'error' | 'warning' | 'info'

export interface UncertaintyItem {
  code: string
  message: string
  suggestion?: string
  affectedNodes?: string[]
  /** Severity level for visual styling - defaults to 'warning' if not specified */
  severity?: CritiqueSeverity
  /** For sensitivity thresholds (when small changes flip the recommendation) */
  threshold?: {
    variable: string
    direction: DriverDirection
    value: number
    alternativeOption?: string
  }
}

export interface ImprovementItem {
  action: string
  reason: string
  priority: number // Lower = more important
  source: 'bias' | 'quality_factor' | 'improvement_guidance'
  effortMinutes?: number
  potentialImprovement?: string
}

export interface EvidenceCoverage {
  backedByData: number
  needsValidation: number
}

/** Disclosure info when items are filtered below threshold */
export interface FilteredItemsDisclosure {
  /** Number of items filtered out */
  filteredCount: number
  /** Threshold used for filtering (e.g., 0.3 for 30% flip probability) */
  threshold: number
  /** Human-readable description of what was filtered */
  description: string
}

export interface ConfidenceSectionData {
  tier: ConfidenceTierInfo
  /** Quality score 0-100 from graph readiness or fallback */
  qualityScore: number | null
  /** Merged uncertainties from critiques and sensitivity analysis */
  uncertainties: UncertaintyItem[]
  topUncertainties: UncertaintyItem[] // Top 3
  /** Task 1: Total high-risk edges (above threshold) before display limit */
  totalHighRiskEdges?: number
  /** Ranking stability from robustness (0-1) */
  rankingStability?: number
  /** Robustness level from PLoT (high/medium/low/very_low) */
  robustnessLevel?: RobustnessLevel
  /** Evidence coverage from graph readiness */
  evidenceCoverage?: EvidenceCoverage
  /** Merged and deduplicated improvements */
  improvements: ImprovementItem[]
  topImprovements: ImprovementItem[] // Top 2
  /** Status fields from runMeta */
  analysisStatus?: string
  driversStatus?: string
  robustnessStatus?: string
  /** Disclosure when fragile edges are filtered below threshold */
  filteredFragileEdges?: FilteredItemsDisclosure
  /** Task 1: Count of high-risk edges hidden by display limit (above threshold but not shown) */
  hiddenHighRiskCount?: number
}

// =============================================================================
// Improvements Types (Legacy - now merged into ConfidenceSectionData)
// =============================================================================

export interface ImprovementsSectionData {
  improvements: ImprovementItem[]
  count: number
  hasHighPriority: boolean
}

// =============================================================================
// Click-to-Focus Event
// =============================================================================

export interface FocusCanvasEvent {
  nodeId: string
  source: 'objective' | 'recommendation' | 'drivers' | 'confidence' | 'improvements'
}

// =============================================================================
// Raw Factor Data (from response, before presentation transform)
// =============================================================================

/** ISL zero_reason codes - explains why influence is zero for intervention factors */
export type ZeroReasonCode = 'intervention_override' | 'disconnected' | 'zero_outcome_diff' | null

/** PLoT flip_risk_category - how a factor contributes to decision uncertainty */
export type FlipRiskCategory = 'isolated' | 'correlated' | 'negligible'

export interface RawFactorSensitivity {
  factor_id?: string
  node_id?: string
  id?: string
  label?: string
  elasticity?: number
  sensitivity_score?: number
  sensitivity?: number
  /** P0 Fix: PLoT may return importance_score instead of elasticity/sensitivity_score */
  importance_score?: number
  /** ISL influence_score (0-1) - structural causal influence */
  influence_score?: number
  /** ISL zero_reason - explains why sensitivity is zero for intervention factors */
  zero_reason?: ZeroReasonCode
  direction?: string
  importance_rank?: number
  /** Confidence signal for factor influence (0-1), used for driver confidence */
  value_of_information?: number
  /** Confidence in this factor's influence (0-1), from PLoT factor_sensitivity */
  confidence?: number
}

export interface UiFactorSensitivity {
  factorId: string
  label: string
  elasticity: number
  direction: 'positive' | 'negative'
  confidence: number | null
  importanceRank: number
  /** ISL influence_score (0-1) - structural causal influence */
  influenceScore?: number
  /** ISL zero_reason - explains why sensitivity is zero */
  zeroReason?: ZeroReasonCode
  /** ISL value_of_information (0-1) - whether gathering more data could change the decision */
  valueOfInformation?: number
  /** PLoT flip_risk_category - how this factor contributes to decision uncertainty */
  flipRiskCategory?: FlipRiskCategory
}

// =============================================================================
// Edge Data (for direction derivation)
// =============================================================================

export interface EdgeForDirection {
  source?: string
  from?: string
  target?: string
  to?: string
  effect_direction?: string
  direction?: string
}
