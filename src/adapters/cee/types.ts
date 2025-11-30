/**
 * CEE (Cognitive Enhancement Engine) Types
 */

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
