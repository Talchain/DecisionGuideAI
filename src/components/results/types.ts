/**
 * Results Panel Types
 *
 * Shared types for the redesigned Results Panel components.
 * Based on V2RunResponse contract from PLoT /v2/run endpoint.
 *
 * "Coaching over gates" philosophy - users see clear decision guidance.
 */

import type { FactorEnrichment, NearTieInfo } from '../../lib/mappers/types'
import type { ConstraintAnalysis } from '../../types/constraints'
import type { M1CoachingReadiness } from '../../types/cee'
import type { ReportV1, OptionProbability } from '../../adapters/plot/types'
import type { V2FactorSensitivity, V2OptionComparison } from '../../adapters/plot/v2/types'

// Re-export M1 coaching type for component use
export type { M1CoachingReadiness }

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
// Goal Constraint Types (Task 2 — Success Targets)
// =============================================================================

/** A single goal constraint for success target display */
export interface GoalConstraint {
  /** Unique identifier */
  id: string
  /** Display label (e.g., "MRR", "Churn rate") */
  label: string
  /** Comparison operator */
  operator: '>=' | '<=' | '>' | '<' | '='
  /** Threshold value */
  value: number
  /** Probability of achieving this individual constraint (0-1) */
  probability?: number | null
}

// =============================================================================
// Flip Threshold Types (Task 6 — Tipping Points)
// =============================================================================

/** Reason why a flip value could not be determined */
export type FlipReason = 'no_bracket' | 'timeout' | 'isl_error'

/** A single tipping-point entry from PLoT's robustness.flip_thresholds */
export interface FlipThreshold {
  /** Display label for the factor */
  label: string
  /** Canvas node ID for click-to-focus */
  node_id: string
  /** Current assumed value of the factor */
  current_value: number
  /** Value at which the recommendation changes (null if undetermined) */
  flip_value: number | null
  /** Why flip_value is null */
  flip_reason?: FlipReason
  /** Unit string for formatting (e.g., '$', '%') */
  unit?: string
  /** Label of the option that would become winner */
  alternative_winner_label?: string
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
  /** Task 8: Rank of this option (1 = best, 2 = second best, etc.) for display */
  rank?: number
  /** Multi-constraint analysis: per-option constraint satisfaction from ISL */
  constraintAnalysis?: ConstraintAnalysis
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
  goalThreshold?: number | null
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
  /** Task 6: Flip thresholds for tipping points visualisation */
  flipThresholds?: FlipThreshold[]

  // ==========================================================================
  // M1 Coaching Fields (deterministic, not LLM-generated)
  // ==========================================================================

  /** M1 Coaching headline from executive_summary */
  coachingHeadline?: string
  /** M1 Coaching paragraph from executive_summary (full narrative) */
  coachingParagraph?: string
  /** M1 Coaching readiness level */
  coachingReadiness?: M1CoachingReadiness
  /** M1 Coaching readiness score (0-100) */
  coachingReadinessScore?: number
  /** V12: Readiness signal dimensions for tooltip */
  coachingReadinessDimensions?: { evidence: number; robustness: number; clarity: number }
  /** M1 Coaching story headlines: optionId → summary */
  storyHeadlines?: Record<string, string>
  /** V12: Executive summary decision statement */
  coachingDecisionStatement?: string
  /** V12: Executive summary key qualifier */
  coachingKeyQualifier?: string
  /** V12: Executive summary action implication */
  coachingActionImplication?: string
  /** V12 C1: M2 narrative summary for "Full analysis" expandable */
  m2NarrativeSummary?: string

  // ==========================================================================
  // M1 Coaching: Dominant Factor Warning
  // ==========================================================================

  /** Dominant factor ID if any factor has >50% influence */
  dominantFactorId?: string
  /** Dominant factor label for display */
  dominantFactorLabel?: string
  /** Whether there are warnings/uncertainties that need attention (for Ready + warnings consistency) */
  hasWarnings?: boolean
  /**
   * v7: True when outcome values are normalised model scores (scale=1, no goalThresholdCap).
   * When true, UI must label values as "Relative score" with tooltip, never as user units.
   */
  isNormalised?: boolean
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
  /** V14.1: confidence is a default estimate (isl_default), not user-provided */
  isDefaultedConfidence?: boolean
  /** ISL bootstrap: stability of this factor's attribution across model variations */
  attributionStability?: 'high' | 'moderate' | 'low' | 'negligible'
  /** True when at least one inbound edge has validation.status === 'contested' */
  hasContestedEdge?: boolean
  /** ISL bootstrap: fraction of bootstrap samples where this factor's rank flips (0-1) */
  rankFlipRate?: number
  /** ISL EVPI: expected value of perfect information */
  evpi?: number
  /** ISL EVPI: expected improvement in percentage points */
  evpiPercentagePoints?: number
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
  /** M1 Coaching: dominant factor ID if any factor has >50% influence */
  dominantFactorId?: string
  /** M1 Coaching: dominant factor label (looked up from drivers) */
  dominantFactorLabel?: string
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
  /** Humanised message from PLoT (preferred over raw `message` for user-facing UI) */
  userMessage?: string
  /** V14.3b: Pre-sanitised text for JSX render fallback. Computed at data layer via internal-token guard. */
  displayText?: string
  suggestion?: string
  affectedNodes?: string[]
  /** Severity level for visual styling - defaults to 'warning' if not specified */
  severity?: CritiqueSeverity
  /** Factor confidence (0-1) for confidence pill display. Derived from edge exists_probability. */
  factorConfidence?: number | null
  /** ISL E-value: how many times wrong the assumption must be to flip the recommendation */
  eValue?: number
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

// =============================================================================
// M1 Coaching Item Types
// =============================================================================

/** Evidence gap from M1 Coaching - area where more data would help */
export interface EvidenceGapItem {
  factorId: string
  factorLabel: string
  /** Confidence (0-100) */
  confidence: number
  /** Value of Information (0-1) - higher = more impactful to investigate */
  voi: number
  /** ISL EVPI: expected value of perfect information (absolute units) — gated on presence */
  evpi?: number
  /** ISL EVPI: expected improvement in percentage points — for display text */
  evpiPp?: number
  suggestion: string
  /** Node ID for canvas focus (may differ from factorId) */
  targetNodeId?: string
}

/** Next action from M1 Coaching - prioritised recommendation */
export interface NextActionItem {
  action: string
  rationale: string
  /** Lower = more important */
  priority: number
  targetType?: 'node' | 'edge' | 'factor' | 'option'
  targetId?: string
  targetLabel?: string
}

/** Assumption from M1 Coaching ledger */
export interface AssumptionItem {
  severity: 'low' | 'medium' | 'high'
  message: string
  target?: string
}

/** Conditional winner entry from ISL (factor-dependent recommendation splits) */
export interface ConditionalWinner {
  /** Factor label driving the split */
  factor_label: string
  /** Factor node ID */
  factor_id: string
  /** Split value where winner changes */
  split_value: number
  /** Unit for display */
  split_unit?: string
  /** Winner label when factor is above split */
  high_bucket: { winner_label: string; win_probability: number }
  /** Winner label when factor is below split */
  low_bucket: { winner_label: string; win_probability: number }
}

/** Inference warning from ISL (model gaps) */
export interface InferenceWarning {
  /** Warning code (e.g. 'MISSING_ROOT_VALUE') */
  code: string
  /** Affected node IDs */
  affected_nodes: string[]
  /** Affected node labels (resolved from canvas) */
  affected_labels?: string[]
  /** Human-readable message */
  message?: string
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

  /** P1 Integration: Top fragile edge for HeroSection bullet 3 */
  topFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    alternativeWinnerLabel: string
    alternativeWinnerId?: string
    switchProbability?: number
    /** Task C: Whether labels were successfully resolved (true) or fell back to "Unknown" (false) */
    labelsResolved?: boolean
  }

  // ==========================================================================
  // M1 Coaching Fields (deterministic, not LLM-generated)
  // ==========================================================================

  /** M1 Coaching evidence gaps - areas where more data would improve decision confidence */
  evidenceGaps?: EvidenceGapItem[]
  /** M1 Coaching top evidence gaps (max 3, sorted by VOI) */
  topEvidenceGaps?: EvidenceGapItem[]
  /** M1 Coaching next actions - prioritised recommendations */
  nextActions?: NextActionItem[]
  /** M1 Coaching top next actions (max 3, sorted by priority) */
  topNextActions?: NextActionItem[]
  /** M1 Coaching assumptions from ledger */
  assumptions?: AssumptionItem[]
  /** Humanised critique items for attention banner (non-SENSITIVE_ASSUMPTION only) */
  humanisedCritiques?: Array<{ title: string; description: string; displayText: string | null; suggestion?: string; factorId?: string }>

  // ==========================================================================
  // V12: M1 Coaching Top Fragile Edge + M2 Fields
  // ==========================================================================

  /** V12: M1 coaching's pick for the single most decision-relevant sensitivity (Priority 0 hinge) */
  m1CoachingTopFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    switchProbability: number
    alternativeWinnerLabel: string | null
  }
  /** V12: Review status for M2 gate ('complete' enables M2 data) */
  reviewStatus?: string
  /** V12: M2 bias findings (structured) */
  m2BiasFindings?: Array<{
    type: string
    source: string
    description: string
    affectedElements: string[]
    linkedCritiqueCode: string
  }>
  /** V12: M2 decision quality prompts (structured) */
  m2DecisionQualityPrompts?: Array<{
    principle: string
    appliesBecause: string
    question: string
  }>
  /** V12: M2 evidence enhancements per factor_id */
  m2EvidenceEnhancements?: Record<string, { specific_action: string; decision_hygiene: string }>
  /** V12: M2 narrative summary paragraph */
  m2NarrativeSummary?: string

  // ==========================================================================
  // New ISL Fields (gated on presence)
  // ==========================================================================

  /** ISL conditional_winners — factor-dependent recommendation splits */
  conditionalWinners?: ConditionalWinner[]
  /** ISL inference_warnings — model gap warnings */
  inferenceWarnings?: InferenceWarning[]
  /** ISL edge_e_values — sensitivity measure per edge */
  edgeEValues?: Array<{ edge_id: string; e_value: number }>
  /** Fragile edges from robustness — for ChallengeSection Model structure subgroup */
  challengeFragileEdges?: Array<{ edge_id?: string; from_id?: string; from_label: string; to_label: string; switch_probability: number }>
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
  /** Breakdown of confidence into structural and sampling components */
  confidence_components?: {
    structural_certainty: number
    sampling_stability: number | null
  }
  /** ISL bootstrap stability */
  attribution_stability?: 'high' | 'moderate' | 'low' | 'negligible'
  rank_flip_rate?: number
  evpi?: number
  evpi_percentage_points?: number
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
  attributionStability?: 'high' | 'moderate' | 'low' | 'negligible'
  rankFlipRate?: number
  evpi?: number
  evpiPercentagePoints?: number
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

// =============================================================================
// V11: Results View Model Types
// =============================================================================

/** Tri-state decision classification driving hero, colours, and collapse behaviour */
export type DecisionState = 'robust' | 'sensitive' | 'indeterminate'

/** Evidence quality derived from decision state + fragile ratio */
export type EvidenceLevel = 'good' | 'fair' | 'needs_work'

/** Deterministic single-uncertainty selection for coaching copy */
export interface HingeInfo {
  /** The uncertainty FACTOR name (from_label), NOT the edge or option */
  label: string
  /** Always from_id — the input factor the user can edit */
  nodeId: string
  /** 'edge' if from fragile_edges, 'node' if from VOI/heuristic */
  kind: 'edge' | 'node'
  /** How the hinge was selected */
  reason: 'fragile_edge' | 'voi' | 'heuristic' | 'none'
  /** Full edge description "X → Y" — for tooltip / "More detail" only */
  edgeDetail: string | null
  /** Label of the option that would win if this assumption shifts */
  alternativeWinnerLabel: string | null
}

/** VOI-driven top action recommendation */
export interface TopAction {
  /** Factor label for display */
  label: string
  /** Node ID for focus */
  nodeId: string
  /** True when this factor could flip the recommendation */
  couldFlip: boolean
}

/** Extra metadata not in ResultsSectionDataReturn (passed from parent) */
export interface BuildResultsVMMeta {
  fragileEdgeCount?: number
  totalEdgeCount?: number
}

/** Enriched view model layered on top of ResultsSectionDataReturn */
export interface ResultsVM {
  decisionState: DecisionState
  gapTop2: number
  hinge: HingeInfo | null
  evidenceLevel: EvidenceLevel
  topAction: TopAction | null
  /** Pass-through to underlying data */
  raw: import('./useResultsSectionData').ResultsSectionDataReturn
}

// =============================================================================
// Trust Boundary Types
// =============================================================================
// These types capture the actual runtime shape of data consumed by
// useResultsSectionData. They replace `as any` casts at the trust boundary
// between backend responses and UI components.

/**
 * Extended report type representing the actual shape of `results.report`
 * as produced by `mapV2ResponseToReportV1()` in the response mapper.
 *
 * The mapper returns a `ReportV1` plus additional V2 pass-through fields
 * that are not declared on the base interface. This type makes those
 * fields explicitly typed so consumers don't need `as any`.
 */
export interface ResultsReport extends Omit<ReportV1, 'option_probabilities'> {
  /** Widened option_probabilities with V2 pass-through fields */
  option_probabilities?: Record<string, ResultsOptionProbability>
  // V2 pass-through fields from responseMapper
  factor_sensitivity?: V2FactorSensitivity[]
  robustness?: {
    fragile_edges: Array<Record<string, unknown>>
    robust_edges: Array<Record<string, unknown>>
    ranking_stability?: number
    recommendation_stability?: number
    is_robust?: boolean
    level?: string
    recommended_option_id?: string
    near_tie?: Record<string, unknown>
    nearTie?: Record<string, unknown>
    flip_thresholds?: Array<Record<string, unknown>>
    _truncation?: {
      fragile_truncated: boolean
      fragile_total: number
      robust_truncated: boolean
      robust_total: number
    }
  }
  robustness_status?: 'computed' | 'unavailable' | 'skipped' | 'error'
  option_comparison?: V2OptionComparison[]

  // Fields accessed by useResultsSectionData that may appear on report
  flip_thresholds?: Array<Record<string, unknown>>
  recommendation?: { option_id?: string; selected_option?: string }
  selected_option_id?: string
  evidence_quality?: Record<string, unknown>
  bias_findings?: Array<Record<string, unknown>>
  quality_factors?: Array<Record<string, unknown>>
  improvement_guidance?: Array<Record<string, unknown>>
  analysis_state?: string
  drivers_error?: string
  sensitivity?: { factors?: Array<Record<string, unknown>>; error?: string }
  isl_error?: string
  downstream_calls?: unknown
  factors?: Array<Record<string, unknown>>
  factor_enrichments?: Array<Record<string, unknown>>
}

/**
 * Extended option probability with all fields the mapper may add.
 * Widens the base OptionProbability from plot/types.
 */
export interface ResultsOptionProbability extends OptionProbability {
  expected_outcome?: number
  expected?: number
  outcome?: {
    mean?: number | null
    p10?: number | null
    p50?: number | null
    p90?: number | null
  }
  bands?: { p10?: number | null; p50?: number | null; p90?: number | null }
  constraint_analysis?: ConstraintAnalysis
}

/**
 * Canvas node data shape as accessed by results hooks.
 * Captures the subset of node.data fields needed for results computation.
 */
export interface ResultsCanvasNodeData {
  kind?: string
  label?: string
  is_baseline?: boolean
  observedState?: { value?: number; unit?: string; [key: string]: unknown }
  observed_state?: { value?: number; unit?: string; [key: string]: unknown }
  goal_threshold_unit?: string
  goal_threshold_raw?: number
  goal_threshold?: number
  success_threshold?: number
  threshold?: number
  threshold_cap?: number
  scale_max?: number
  [key: string]: unknown
}

/**
 * Canvas edge data shape as accessed by results hooks.
 */
export interface ResultsCanvasEdgeData {
  effect_direction?: string
  direction?: string
  beliefExists?: number
  [key: string]: unknown
}
