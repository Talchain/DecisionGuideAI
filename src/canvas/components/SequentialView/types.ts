/**
 * Sequential View Types
 *
 * Types for Phase 4 sequential decision support.
 * Guides users through multi-stage decisions with optimal policies.
 */

import type { ConfidenceLevel } from '../../../adapters/plot/types'

// ============================================================================
// Graph Detection Types
// ============================================================================

export interface SequentialMetadata {
  is_sequential: boolean
  stages: DecisionStage[]
  /** Total number of stages */
  stage_count: number
  /** Current stage index (0-based) */
  current_stage: number
}

export interface DecisionStage {
  /** Stage index (0-based) */
  index: number
  /** Stage label, e.g., "Launch MVP" */
  label: string
  /** Decision node ID for this stage */
  decision_node_id: string
  /** Trigger condition to move to this stage */
  trigger_condition?: string
  /** Estimated time/order indicator */
  timing?: 'now' | 'next' | 'later'
}

// ============================================================================
// ISL Sequential Analysis Types
// ============================================================================

export interface SequentialAnalysisRequest {
  graph: SequentialGraph
  stages: DecisionStage[]
  discount_factor?: number
  risk_tolerance?: string
}

export interface SequentialGraph {
  nodes: Array<{
    id: string
    label: string
    kind: string
    stage?: number
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
  sequential_metadata: SequentialMetadata
}

export interface SequentialAnalysisResponse {
  optimal_policy: Policy
  stage_analyses: StageAnalysis[]
  value_of_flexibility: number
  sensitivity_to_timing: 'high' | 'medium' | 'low'
}

export interface Policy {
  stages: StagePolicy[]
  expected_total_value: number
}

export interface StagePolicy {
  stage_index: number
  /** Decision rule for this stage */
  decision_rule: DecisionRule
  /** What must be observed before this stage */
  contingent_on: string[]
  /** Recommended option for this stage */
  recommended_option: string
  /** Expected value at this stage */
  expected_value: number
}

export interface DecisionRule {
  type: 'unconditional' | 'threshold' | 'adaptive'
  /** For threshold rules */
  variable?: string
  threshold?: number
  operator?: '<' | '>' | '<=' | '>=' | '='
  /** For adaptive rules */
  conditions?: Array<{
    if: string
    then: string
  }>
}

export interface StageAnalysis {
  stage_index: number
  stage_label: string
  options: StageOption[]
  dominant_option?: string
  sensitivity: Array<{
    factor: string
    impact: 'high' | 'medium' | 'low'
  }>
}

export interface StageOption {
  option_id: string
  option_label: string
  expected_value: number
  confidence: ConfidenceLevel
}

// ============================================================================
// CEE Policy Explanation Types
// ============================================================================

export interface ExplainPolicyRequest {
  policy: Policy
  stages: DecisionStage[]
  context: {
    decision_label: string
    goal: string
  }
}

export interface ExplainPolicyResponse {
  executive_summary: string
  stage_explanations: StageExplanation[]
  key_decision_points: DecisionPoint[]
  flexibility_explanation: string
}

export interface StageExplanation {
  stage_index: number
  stage_label: string
  /** What action to take */
  what_to_do: string
  /** What to observe before next stage */
  what_to_observe: string
  /** Why this stage matters */
  why_this_matters: string
}

export interface DecisionPoint {
  /** When this decision point occurs */
  trigger: string
  /** What decision to make */
  decision: string
  /** Impact of getting it wrong */
  stakes: 'high' | 'medium' | 'low'
}

// ============================================================================
// Component Props
// ============================================================================

export interface SequentialViewProps {
  /** Whether to auto-detect sequential metadata from graph */
  autoDetect?: boolean
  /** Override sequential metadata */
  sequentialMetadata?: SequentialMetadata
  /** Callback when stage is clicked */
  onStageClick?: (stageIndex: number) => void
  /** Callback when "View Details" for a stage is clicked */
  onStageDetailsClick?: (stageIndex: number) => void
}

export interface StageTimelineProps {
  stages: DecisionStage[]
  currentStage: number
  onStageClick?: (stageIndex: number) => void
}

export interface StageCardProps {
  stage: DecisionStage
  analysis?: StageAnalysis
  explanation?: StageExplanation
  isCurrent: boolean
  onDetailsClick?: () => void
}

export interface FlexibilityValueProps {
  value: number
  explanation: string
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseSequentialAnalysisOptions {
  autoFetch?: boolean
  sequentialMetadata?: SequentialMetadata
}

export interface UseSequentialAnalysisResult {
  /** ISL sequential analysis */
  analysis: SequentialAnalysisResponse | null
  /** CEE policy explanation */
  explanation: ExplainPolicyResponse | null
  /** Whether graph is sequential */
  isSequential: boolean
  /** Sequential metadata */
  metadata: SequentialMetadata | null
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Trigger fetch */
  fetch: () => Promise<void>
}
