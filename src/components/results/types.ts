/**
 * Results Panel Types
 *
 * Shared types for the redesigned Results Panel components.
 * Based on V2RunResponse contract from PLoT /v2/run endpoint.
 *
 * "Coaching over gates" philosophy - users see clear decision guidance.
 */

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
  p10: number
  /** @deprecated Use expected or outcome.p50 instead. Kept for backward compatibility. */
  p50: number
  /** @deprecated Use outcome.p90 instead. Kept for backward compatibility. */
  p90: number
  isRecommended: boolean
  winProbability?: number
}

export interface RecommendationSectionData {
  recommendedOption: OptionResult | null
  allOptions: OptionResult[]
  goalLabel: string
  goalNodeId?: string // For click-to-focus
  isSingleOption: boolean
  analysisStatus: 'computed' | 'partial' | 'failed' | 'blocked'
  statusReason?: string
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
}

export interface DriversSectionData {
  drivers: DriverItem[]
  driversStatus: 'computed' | 'unavailable' | 'skipped' | 'error'
  topDrivers: DriverItem[] // Top 3
  totalCount: number
  /** True if any factor has real elasticity data (>0.001). When false, show direction-only view. */
  hasMagnitudeData: boolean
}

// =============================================================================
// Confidence Types (Merged with Improvements per redesign spec)
// =============================================================================

/** Severity levels for critiques/uncertainties */
export type CritiqueSeverity = 'blocker' | 'error' | 'warning' | 'info'

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

export interface ConfidenceSectionData {
  tier: ConfidenceTierInfo
  /** Quality score 0-100 from graph readiness or fallback */
  qualityScore: number | null
  /** Merged uncertainties from critiques and sensitivity analysis */
  uncertainties: UncertaintyItem[]
  topUncertainties: UncertaintyItem[] // Top 3
  /** Ranking stability from robustness (0-1) */
  rankingStability?: number
  /** Evidence coverage from graph readiness */
  evidenceCoverage?: EvidenceCoverage
  /** Merged and deduplicated improvements */
  improvements: ImprovementItem[]
  topImprovements: ImprovementItem[] // Top 2
  /** Status fields from runMeta */
  analysisStatus?: string
  driversStatus?: string
  robustnessStatus?: string
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

export interface RawFactorSensitivity {
  factor_id?: string
  node_id?: string
  id?: string
  label?: string
  elasticity?: number
  sensitivity_score?: number
  sensitivity?: number
  direction?: string
  importance_rank?: number
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
