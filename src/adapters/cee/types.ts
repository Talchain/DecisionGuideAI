/**
 * CEE (Cognitive Enhancement Engine) Types
 *
 * Brief v2.2: Added support for Decision Model Schema v2.2
 * - observed_state on factor nodes
 * - effect_direction and strength_std on edges
 */

// =============================================================================
// Schema v2.2 Types (new format)
// =============================================================================

/**
 * Effect direction enum for edges
 */
export type EffectDirection = 'positive' | 'negative'

/**
 * Observed state for factor nodes (v2.2)
 * Represents the current measured/known value of a factor
 */
export interface ObservedState {
  value: number
  baseline?: number
  unit?: string
  source?: string
}

/**
 * Issue 5 fix: Constrained node type to known values
 */
export type CEENodeType = 'factor' | 'option' | 'outcome' | 'goal' | 'risk' | 'decision'

/**
 * CEE v2.2 Node schema
 */
export interface CEEv2Node {
  id: string
  type: CEENodeType  // Issue 5 fix: Constrained from string
  label: string
  description?: string
  uncertainty?: number
  observed_state?: ObservedState
}

/**
 * CEE v2.2 Edge schema with effect semantics
 */
export interface CEEv2Edge {
  id: string
  from: string
  to: string
  weight: number
  belief: number
  effect_direction: EffectDirection
  strength_std?: number  // Issue 6 fix: Made optional (CEE may not always provide)
  strength_mean?: number // P0 Fix: CEE may provide separate strength mean
  belief_exists?: number // P0 Fix: Structural certainty (0-1), distinct from parametric belief
  provenance?: string | { source: string; quote: string; location?: string }
  provenance_source?: 'document' | 'metric' | 'hypothesis' | 'engine'
}

/**
 * CEE v2.2 Response schema
 */
export interface CEEv2Response {
  schema_version: '2.2'
  quality_overall: number
  nodes: CEEv2Node[]
  edges: CEEv2Edge[]
  draft_warnings: {
    structural: CEEStructuralWarning[]
    completeness: string[]
  }
  /** Pipeline trace data for debug panel (optional, CEE may include it) */
  trace?: {
    pipeline?: CeePipelineTrace
  }
}

/**
 * Type guard for v2.2 response
 */
export function isCEEv2Response(response: unknown): response is CEEv2Response {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as any).schema_version === '2.2'
  )
}

// =============================================================================
// Schema v1 Types (legacy format)
// =============================================================================

export interface CEEDraftResponse {
  quality_overall: number // 1-10
  nodes: Array<{
    id: string
    label: string
    type: string
    uncertainty: number // 0-1, higher = less certain
  }>
  edges: Array<{
    id?: string
    from: string
    to: string
    weight?: number
    belief?: number
    provenance?:
      | { source: string; quote: string; location?: string }
      | string
    provenance_source?: 'document' | 'metric' | 'hypothesis' | 'engine'
  }>
  draft_warnings: {
    structural: CEEStructuralWarning[]
    completeness: string[]
  }
}

export type CEEStructuralWarningType =
  | 'orphan'                    // Node not connected
  | 'cycle'                     // Circular dependency
  | 'decision_after_outcome'    // Logic issue

export interface CEEStructuralWarning {
  type: CEEStructuralWarningType
  severity: 'error' | 'warning' | 'info'
  message: string
  affectedNodes: string[]
  affectedEdges?: Array<{ from: string; to: string }>
}

export type CEEBiasSeverity = 'high' | 'medium' | 'low'

export interface CEEBiasIntervention {
  action: string                           // "List failure scenario"
  effort: 'quick' | 'moderate' | 'significant'
  estimatedMinutes: number
  description: string
}

export interface CEEBiasFinding {
  id: string
  type: string                             // 'confirmation', 'anchoring', etc.
  severity: CEEBiasSeverity
  description: string                      // User-facing
  affectedNodes: string[]
  interventions: CEEBiasIntervention[]
  mechanism?: string                       // Technical explanation
  citation?: string                        // Academic reference
}

export interface CEEInsightsResponse {
  quality_overall: number                  // 1-10
  bias_findings: CEEBiasFinding[]
  completeness: number                     // 0-1
  structural_health: {
    status: 'good' | 'warning' | 'error'
    warnings: CEEStructuralWarning[]
  }
}

export interface CEEFramingFeedback {
  status: 'good' | 'needs_improvement' | 'poor'
  message: string                          // "Add outcome?" / "Looking good"
  suggestions: string[]
}

// =============================================================================
// Schema v3 Types (analysis_ready support)
// =============================================================================

/**
 * CEE V3 intervention format.
 */
export interface CEEInterventionV3 {
  value: number
  source: 'brief_extraction' | 'user_specified' | 'cee_hypothesis'
  target_match?: {
    node_id: string
    match_type: 'exact_id' | 'exact_label' | 'semantic'
    confidence: 'high' | 'medium' | 'low'
  }
  value_confidence?: 'high' | 'medium' | 'low'
  reasoning?: string
}

/**
 * CEE V3 option format.
 *
 * Note: status may be 'needs_user_input' from backend (defensive alias for 'needs_user_mapping')
 */
export interface CEEOptionV3 {
  id: string
  label: string
  status: 'ready' | 'needs_user_mapping' | 'needs_user_input'
  interventions: Record<string, CEEInterventionV3>
  user_questions?: string[]
  unresolved_targets?: string[]
}

/**
 * CEE V3 analysis_ready payload.
 *
 * When present in CEE response, this contains analysis-ready options
 * with resolved interventions that can be directly used for V2RunRequest.
 */
export interface CEEAnalysisReady {
  /** Options with resolved interventions */
  options: CEEOptionV3[]
  /** Goal node ID from CEE */
  goal_node_id: string
  /** Suggested seed for reproducibility (string, defaults to "42") */
  suggested_seed?: string
  /**
   * Overall readiness status.
   * - 'ready': All options resolved, graph is valid, can run analysis
   * - 'needs_encoding': Options have categorical values needing encoding
   * - 'needs_user_mapping': Structural issues (e.g., no causal path to goal)
   */
  status?: 'ready' | 'needs_encoding' | 'needs_user_mapping'
  /**
   * User-facing questions explaining issues when status is not 'ready'.
   * E.g., "The factor 'Price' doesn't have a path to the goal. Is this correct?"
   */
  user_questions?: string[]
}

/**
 * CEE v2.2 Response with optional analysis_ready (V3 extension)
 *
 * analysis_ready is present when CEE has successfully resolved
 * all option interventions and the graph is ready for analysis.
 */
export interface CEEv3Response extends CEEv2Response {
  analysis_ready?: CEEAnalysisReady
}

/**
 * Type guard for v3 response with analysis_ready.
 *
 * V3 responses may have schema_version '2.2' or '3.0' depending on CEE version,
 * so we check for structural validity rather than strict schema version.
 */
export function isCEEv3Response(response: unknown): response is CEEv3Response {
  if (typeof response !== 'object' || response === null) return false

  const r = response as Record<string, unknown>

  // Must have analysis_ready object
  if (!('analysis_ready' in r) || typeof r.analysis_ready !== 'object' || r.analysis_ready === null) {
    return false
  }

  // Must have nodes and edges arrays - check both root level and nested under graph
  // CEE may return edges at r.edges (root) OR r.graph.edges (nested)
  const hasNodes = Array.isArray(r.nodes) || Array.isArray((r as any).graph?.nodes)
  const hasEdges = Array.isArray(r.edges) || Array.isArray((r as any).graph?.edges)
  if (!hasNodes || !hasEdges) {
    return false
  }

  return true
}

/**
 * Type guard for checking if analysis_ready is present and valid.
 */
export function hasAnalysisReady(response: unknown): response is CEEv3Response & { analysis_ready: CEEAnalysisReady } {
  return (
    isCEEv3Response(response) &&
    Array.isArray(response.analysis_ready?.options) &&
    response.analysis_ready.options.length > 0 &&
    typeof response.analysis_ready.goal_node_id === 'string'
  )
}

// =============================================================================
// CEE Pipeline Trace Types (Debug Panel)
// =============================================================================

/**
 * Pipeline stage name - identifies the processing step
 */
export type CeePipelineStageName =
  | 'llm_draft'
  | 'node_validation'
  | 'connectivity_check'
  | 'goal_repair'
  | 'edge_repair'
  | 'final_validation'

/**
 * Pipeline stage status
 */
export type CeePipelineStageStatus = 'success' | 'failed' | 'skipped' | 'repaired'

/**
 * Overall pipeline status
 */
export type CeePipelineStatus = 'success' | 'success_with_repairs' | 'failed'

/**
 * Individual pipeline stage with timing and status
 */
export interface CeePipelineStage {
  name: CeePipelineStageName
  status: CeePipelineStageStatus
  duration_ms: number
  details?: Record<string, unknown>
}

/**
 * Connectivity diagnostic information
 */
export interface CeeConnectivityDiagnostic {
  checked: boolean
  passed: boolean
  decision_ids: string[]
  reachable_options: string[]
  reachable_goals: string[]
  unreachable_nodes: string[]
  edges_added?: Array<{ from: string; to: string }>
}

/**
 * LLM call trace information
 */
export interface CeeLlmCall {
  id: string
  model: string
  duration_ms: number
  prompt_tokens?: number
  completion_tokens?: number
  request?: unknown
  response?: unknown
}

/**
 * Final graph summary (simplified node/edge data)
 */
export interface CeeFinalGraph {
  node_count: number
  edge_count: number
  nodes?: CEEv2Node[]
  edges?: CEEv2Edge[]
}

/**
 * LLM quality corrections applied during pipeline
 */
export interface CeeLlmQualityCorrection {
  edge_id: string
  from_node: string
  to_node: string
  original_coefficient: number
  corrected_coefficient: number
  reason: string
}

/**
 * LLM quality tracking and corrections
 */
export interface CeeLlmQuality {
  corrections?: CeeLlmQualityCorrection[]
  risk_coefficient_corrections?: CeeLlmQualityCorrection[]
}

/**
 * CEE Pipeline Trace - complete trace data from draft-graph response
 *
 * Contains detailed timing, connectivity diagnostics, and LLM call information
 * for debugging and visualisation in the debug panel.
 */
export interface CeePipelineTrace {
  status: CeePipelineStatus
  total_duration_ms: number
  /** LLM call count - optional, defaults to 1 in raw_output mode */
  llm_call_count?: number
  stages: CeePipelineStage[]
  connectivity?: CeeConnectivityDiagnostic
  llm_calls?: CeeLlmCall[]
  final_graph?: CeeFinalGraph
  llm_quality?: CeeLlmQuality
  /** Indicates raw output mode (bypasses CEE post-processing) */
  raw_output_mode?: boolean
}

/**
 * Type guard for pipeline trace
 * Note: llm_call_count is optional (not present in raw_output mode)
 */
export function isCeePipelineTrace(value: unknown): value is CeePipelineTrace {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.status === 'string' &&
    typeof v.total_duration_ms === 'number' &&
    Array.isArray(v.stages)
  )
}
