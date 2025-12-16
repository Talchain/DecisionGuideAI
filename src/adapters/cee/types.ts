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
