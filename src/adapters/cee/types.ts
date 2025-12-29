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
 */
export function isCEEv3Response(response: unknown): response is CEEv3Response {
  return (
    isCEEv2Response(response) &&
    'analysis_ready' in response &&
    typeof (response as any).analysis_ready === 'object' &&
    (response as any).analysis_ready !== null
  )
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
