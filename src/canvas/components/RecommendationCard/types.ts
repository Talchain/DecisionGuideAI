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
