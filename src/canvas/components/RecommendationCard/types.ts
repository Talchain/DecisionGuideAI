/**
 * Recommendation Card Types
 *
 * Types for Phase 4 CEE-powered recommendation generation and display.
 * Integrates with /bff/engine/v1/recommend/generate endpoint.
 */

import type { ConfidenceLevel } from '../../../adapters/plot/types'

// ============================================================================
// Request Types
// ============================================================================

export interface GenerateRecommendationRequest {
  run_id: string
  graph: {
    nodes: Array<{ id: string; label: string; kind?: string }>
    edges: Array<{ id: string; source: string; target: string; label?: string }>
  }
  results: {
    conservative: number
    likely: number
    optimistic: number
    units?: string
  }
  ranked_options: RankedOption[]
  narrative_style?: 'concise' | 'detailed' | 'executive'
}

export interface RankedOption {
  option_id: string
  option_label: string
  rank: number
  expected_value: number
  confidence: ConfidenceLevel
}

// ============================================================================
// Response Types
// ============================================================================

export interface GenerateRecommendationResponse {
  recommendation: {
    /** Short action headline, e.g., "Increase price to £59" */
    headline: string
    /** Confidence in the recommendation */
    confidence: ConfidenceLevel
    /** 2-3 sentence summary */
    summary: string
  }

  reasoning: {
    /** Why this option is recommended */
    primary_drivers: Driver[]
    /** What you give up by choosing this option */
    key_tradeoffs: Tradeoff[]
    /** Critical beliefs/assumptions underlying the recommendation */
    assumptions: Assumption[]
    /** Steps to validate key assumptions */
    validation_steps: ValidationStep[]
  }

  /** Source attribution */
  provenance: 'cee'

  /** Trace metadata for debugging */
  trace?: TraceMetadata
}

export interface Driver {
  /** Factor name, e.g., "Revenue potential" */
  factor: string
  /** Link to graph edge */
  edge_id: string
  /** How much this contributes */
  contribution: 'high' | 'medium' | 'low'
  /** Plain language explanation */
  explanation: string
  /** Optional node ID for highlighting */
  node_id?: string
}

export interface Tradeoff {
  /** What you're giving up */
  description: string
  /** Severity of the tradeoff */
  severity: 'high' | 'medium' | 'low'
  /** Which option benefits if you don't make this tradeoff */
  alternative_benefits?: string
  /** Link to graph element */
  edge_id?: string
}

export interface Assumption {
  /** The assumption being made */
  description: string
  /** How critical this is */
  criticality: 'critical' | 'important' | 'minor'
  /** Link to graph element */
  edge_id?: string
  /** Node ID if applicable */
  node_id?: string
  /** How to validate this assumption */
  validation_suggestion: string
}

export interface ValidationStep {
  /** What to do */
  action: string
  /** Why this matters */
  rationale: string
  /** Estimated effort */
  effort?: 'low' | 'medium' | 'high'
  /** Related assumption index */
  assumption_index?: number
}

// ============================================================================
// Constraint Violation Types (Task 1.3)
// ============================================================================

export interface ConstraintViolation {
  /** Option that was excluded */
  option_id: string
  /** Option label for display */
  option_label: string
  /** Which constraint was violated */
  constraint_label: string
  /** Type of constraint */
  constraint_type: 'budget' | 'time' | 'resource' | 'regulatory' | 'other'
  /** The limit value */
  limit_value?: number
  /** The option's value that exceeded the limit */
  actual_value?: number
  /** Units for display */
  units?: string
}

export interface ActiveConstraint {
  /** Constraint label */
  label: string
  /** Type of constraint */
  type: 'budget' | 'time' | 'resource' | 'regulatory' | 'other'
  /** Current value (at the boundary) */
  current_value: number
  /** Limit value */
  limit_value: number
  /** Units for display */
  units?: string
  /** Whether relaxing this could improve outcomes */
  relaxation_benefit?: string
}

export interface TraceMetadata {
  request_id: string
  model_version?: string
  latency_ms?: number
}

// ============================================================================
// Component Props
// ============================================================================

/** Identifiability status from CEE analysis */
export type IdentifiabilityStatus =
  | 'identifiable'
  | 'underidentified'
  | 'overidentified'
  | 'unknown'

export interface RecommendationCardProps {
  /** Run ID for fetching recommendation */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean
  /** Callback when driver is clicked (for graph highlighting) */
  onDriverClick?: (edgeId: string, nodeId?: string) => void
  /** Callback when assumption is clicked (for belief editor) */
  onAssumptionClick?: (edgeId: string, nodeId?: string) => void
  /** Callback when "Validate Assumptions" is clicked */
  onValidateClick?: () => void
  /** Number of options (for context, Compare CTA is in DecisionSummary) */
  optionCount?: number
  /** Whether analysis is currently running */
  isAnalyzing?: boolean
  /** Task 2+4: Outcome data for consolidated display */
  outcomeData?: {
    p50: number | null
    p10?: number | null
    p90?: number | null
    units: 'currency' | 'percent' | 'count'
    unitSymbol?: string
    baseline?: number | null
    goalDirection?: 'maximize' | 'minimize'
  }
  /** Brief 4.2: Identifiability status for exploratory warning */
  identifiability?: IdentifiabilityStatus | null
}

export interface ExpandableSectionProps {
  /** Section title */
  title: string
  /** Optional badge count */
  badgeCount?: number
  /** Badge color variant */
  badgeVariant?: 'default' | 'warning' | 'critical'
  /** Whether section is initially expanded */
  defaultExpanded?: boolean
  /** Child content */
  children: React.ReactNode
  /** Test ID for E2E */
  testId?: string
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseRecommendationOptions {
  /** Run ID to fetch recommendation for */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Whether to auto-fetch */
  autoFetch?: boolean
  /** Narrative style preference */
  narrativeStyle?: 'concise' | 'detailed' | 'executive'
}

export interface UseRecommendationResult {
  /** The recommendation data */
  recommendation: GenerateRecommendationResponse | null
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Manually trigger fetch */
  fetch: () => Promise<void>
  /** Clear cached data */
  clear: () => void
}

// ============================================================================
// Brief 10: ISL Robustness Types
// ============================================================================

/** Robustness classification from ISL analysis */
export type RobustnessLabel = 'robust' | 'moderate' | 'fragile'

/**
 * Sensitive parameter - a factor that significantly affects the recommendation
 * Brief 10.3: Top 2-3 sensitive parameters with flip thresholds
 */
export interface SensitiveParameter {
  /** Parameter/node ID */
  node_id: string
  /** Human-readable label */
  label: string
  /** Current value (0-1) */
  current_value: number
  /** Value at which recommendation flips */
  flip_threshold: number
  /** Direction of sensitivity */
  direction: 'increase' | 'decrease'
  /** Sensitivity magnitude (0-1) */
  sensitivity: number
  /** Brief explanation */
  explanation?: string
}

/**
 * Value of Information - expected value of resolving uncertainty
 * Brief 10.4: VoI suggestions for EVPI > threshold
 */
export interface ValueOfInformation {
  /** Parameter/node ID */
  node_id: string
  /** Human-readable label */
  label: string
  /** Expected Value of Perfect Information (0-1 or currency) */
  evpi: number
  /** Whether EVPI exceeds decision-relevant threshold */
  worth_investigating: boolean
  /** Suggested action to resolve uncertainty */
  suggested_action?: string
  /** Cost estimate to resolve (optional) */
  resolution_cost?: number
  /** Confidence in the VoI estimate */
  confidence?: 'high' | 'medium' | 'low'
}

/**
 * Robustness bound - outcome range under parameter variation
 */
export interface RobustnessBound {
  /** Scenario label */
  scenario: string
  /** Lower bound outcome */
  lower: number
  /** Upper bound outcome */
  upper: number
  /** Parameter(s) varied */
  varied_parameters: string[]
}

/**
 * Ranked option with robustness metadata
 */
export interface RankedOptionWithRobustness {
  option_id: string
  option_label: string
  rank: number
  expected_value: number
  confidence: ConfidenceLevel
  /** Whether this option remains top under robustness testing */
  robust_winner: boolean
  /** Scenarios where this option loses */
  loses_in_scenarios?: string[]
}

/**
 * Pareto frontier result for multi-goal decisions
 * Brief 10.6: Pareto visualisation
 */
export interface ParetoResult {
  /** Options on the Pareto frontier */
  frontier: string[]
  /** Options dominated by frontier options */
  dominated: string[]
  /** Trade-off explanation between frontier options */
  tradeoff_narrative?: string
  /** Criteria used for Pareto analysis */
  criteria: string[]
}

/**
 * Full robustness result from ISL
 * Brief 10: Unified robustness display
 */
export interface RobustnessResult {
  /** Ranked options with robustness metadata */
  option_rankings: RankedOptionWithRobustness[]
  /** Top recommendation with confidence */
  recommendation: {
    option_id: string
    confidence: ConfidenceLevel
    recommendation_status: 'clear' | 'close_call' | 'uncertain'
  }
  /** Brief 10.3: Sensitive parameters (top 2-3) */
  sensitivity: SensitiveParameter[]
  /** Brief 10.2: Overall robustness classification */
  robustness_label: RobustnessLabel
  /** Robustness bounds under parameter variation */
  robustness_bounds: RobustnessBound[]
  /** Brief 10.4: Value of information suggestions */
  value_of_information: ValueOfInformation[]
  /** Brief 10.7: Natural language narrative */
  narrative: string
  /** Brief 10.6: Pareto analysis for multi-goal decisions */
  pareto?: ParetoResult
}

/**
 * Props for RobustnessBlock component
 * Brief 10.1: Single unified robustness block
 */
export interface RobustnessBlockProps {
  /** Robustness result from ISL */
  robustness: RobustnessResult | null
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
  /** Callback when parameter is clicked */
  onParameterClick?: (nodeId: string) => void
  /** Callback when VoI action is clicked */
  onVoiActionClick?: (nodeId: string, action: string) => void
  /** Callback when Pareto option is clicked */
  onParetoOptionClick?: (optionId: string) => void
  /** Whether to show expanded view by default */
  defaultExpanded?: boolean
  /** Compact mode (hide details) */
  compact?: boolean
}
