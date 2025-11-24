/**
 * ISL (Inference Service Layer) Types
 */

export interface ISLValidationSuggestion {
  id: string
  type: 'missing_edge' | 'missing_node' | 'incomplete_data' | 'logic_error'
  severity: 'error' | 'warning' | 'info'
  message: string
  affectedNodes: string[]
  affectedEdges?: string[]
  quickFix?: {
    label: string
    action: 'add_edge' | 'add_node' | 'update_data' | 'remove_node'
    payload: any
  }
}

export interface ISLValidationResponse {
  valid: boolean
  suggestions: ISLValidationSuggestion[]
  graph_health: {
    completeness: number // 0-1
    connectivity: number // 0-1
    logical_consistency: number // 0-1
  }
}

export interface ISLConformalPrediction {
  node_id: string
  prediction: any
  confidence_interval: {
    lower: number
    upper: number
    confidence_level: number // e.g., 0.95 for 95%
  }
  calibration_quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface ISLConformalResponse {
  predictions: ISLConformalPrediction[]
  overall_calibration: number // 0-1
  sample_size: number
}

export interface ISLComparisonScenario {
  id: string
  name: string
  modified_values: Record<string, any>
  outcome_predictions: Record<string, number>
  confidence_intervals: Record<string, { lower: number; upper: number }>
}

export interface ISLComparisonResponse {
  base_scenario: {
    id: string
    name: string
    outcome_predictions: Record<string, number>
  }
  alternative_scenarios: ISLComparisonScenario[]
  recommended_scenario: string | null
  comparison_metrics: {
    risk_adjusted_value: Record<string, number>
    expected_utility: Record<string, number>
  }
}

export interface ISLRunRequest {
  graph: {
    nodes: Array<{ id: string; label: string; type: string; value?: any }>
    edges: Array<{ from: string; to: string; weight?: number }>
  }
  options?: {
    enable_conformal?: boolean
    confidence_level?: number
    comparison_scenarios?: Array<{ name: string; modifications: Record<string, any> }>
  }
}

/**
 * Phase 2: Goal Mode (Contrastive Explanation)
 * "How do I achieve X?"
 */

export interface InterventionStep {
  nodeId: string
  nodeLabel: string
  currentValue: number
  targetValue: number
  change: number
  impact: {
    onTarget: number
    sideEffects: Array<{
      nodeId: string
      nodeLabel: string
      expectedChange: number
    }>
  }
  effort: 'low' | 'moderate' | 'high'
}

export interface ContrastiveExplanationRequest {
  graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }
  currentState: Record<string, number>
  targetState: {
    nodeId: string
    targetValue: number
  }
  constraints?: {
    fixedNodes?: string[]
    maxChanges?: number
  }
}

export interface ContrastiveExplanationResponse {
  path: InterventionStep[]
  totalCost: number
  feasibility: 'easy' | 'moderate' | 'difficult'
  expectedOutcome: {
    nodeId: string
    value: number
    confidence: number
  }
  alternatives?: Array<{
    path: InterventionStep[]
    tradeoff: string
  }>
}

/**
 * Phase 2: Transportability
 * Cross-context validation ("Will this work in Germany?")
 */

export interface TransportabilityRequest {
  graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }
  sourceContext: string       // e.g., "UK Market"
  targetContext: string       // e.g., "Germany"
  validationData?: unknown
}

export interface TransportabilityResponse {
  transferable: boolean
  confidence: number          // 0-1
  requiredAssumptions: string[]
  missingData: string[]
  adaptations: Array<{
    what: string
    why: string
  }>
}
