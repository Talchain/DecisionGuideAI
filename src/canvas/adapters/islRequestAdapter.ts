/**
 * ISL Request Adapter
 *
 * Brief 12.5: Transform UI request format to ISL API expected format
 *
 * ISL expects specific field names and structures that differ from
 * our internal UI conventions. This adapter handles:
 * - Field name mapping
 * - Request payload structuring
 * - Optional field handling
 */

// =============================================================================
// UI Request Types (internal format)
// =============================================================================

export interface UIRobustnessRequest {
  runId: string
  responseHash?: string
  includeSensitivity?: boolean
  includeVoi?: boolean
  includePareto?: boolean
  graphContext?: {
    nodes: Array<{ id: string; label: string; kind: string }>
    edges: Array<{ id: string; source: string; target: string; weight?: number }>
  }
  analysisOptions?: {
    sensitivityDepth?: 'shallow' | 'deep'
    voiThreshold?: number
    paretoObjectives?: string[]
  }
}

// =============================================================================
// ISL Request Types (API expected format)
// =============================================================================

export interface ISLRobustnessRequest {
  run_id: string
  response_hash?: string
  include_sensitivity: boolean
  include_voi: boolean
  include_pareto: boolean
  graph?: {
    nodes: Array<{ id: string; label: string; kind: string }>
    edges: Array<{ id: string; source: string; target: string; weight?: number }>
  }
  options?: {
    sensitivity_depth?: 'shallow' | 'deep'
    voi_threshold?: number
    pareto_objectives?: string[]
  }
}

// =============================================================================
// CEE Form Request Types
// =============================================================================

export interface UIEdgeContext {
  edgeId: string
  sourceKind: string
  targetKind: string
  currentForm: string
  context: {
    sourceLabel: string
    targetLabel: string
  }
}

export interface CEEEdgeContext {
  edge_id: string
  source_kind: string
  target_kind: string
  current_form: string
  context: {
    source_label: string
    target_label: string
  }
}

export interface UIFormRequest {
  edges: UIEdgeContext[]
}

export interface CEEFormRequest {
  edges: CEEEdgeContext[]
}

// =============================================================================
// Adapter Functions
// =============================================================================

/**
 * Transform UI robustness request to ISL format
 */
export function adaptRobustnessRequest(
  request: UIRobustnessRequest
): ISLRobustnessRequest {
  const islRequest: ISLRobustnessRequest = {
    run_id: request.runId,
    include_sensitivity: request.includeSensitivity ?? true,
    include_voi: request.includeVoi ?? true,
    include_pareto: request.includePareto ?? true,
  }

  if (request.responseHash) {
    islRequest.response_hash = request.responseHash
  }

  if (request.graphContext) {
    islRequest.graph = request.graphContext
  }

  if (request.analysisOptions) {
    islRequest.options = {}

    if (request.analysisOptions.sensitivityDepth) {
      islRequest.options.sensitivity_depth = request.analysisOptions.sensitivityDepth
    }
    if (request.analysisOptions.voiThreshold !== undefined) {
      islRequest.options.voi_threshold = request.analysisOptions.voiThreshold
    }
    if (request.analysisOptions.paretoObjectives) {
      islRequest.options.pareto_objectives = request.analysisOptions.paretoObjectives
    }
  }

  return islRequest
}

/**
 * Transform UI edge context to CEE format
 */
function adaptEdgeContext(edge: UIEdgeContext): CEEEdgeContext {
  return {
    edge_id: edge.edgeId,
    source_kind: edge.sourceKind,
    target_kind: edge.targetKind,
    current_form: edge.currentForm,
    context: {
      source_label: edge.context.sourceLabel,
      target_label: edge.context.targetLabel,
    },
  }
}

/**
 * Transform UI form request to CEE format
 */
export function adaptFormRequest(request: UIFormRequest): CEEFormRequest {
  return {
    edges: request.edges.map(adaptEdgeContext),
  }
}

/**
 * Build robustness request from hook parameters
 * Helper to construct request from useRobustness options
 */
export function buildRobustnessRequest(
  runId: string,
  responseHash?: string
): ISLRobustnessRequest {
  return {
    run_id: runId,
    response_hash: responseHash,
    include_sensitivity: true,
    include_voi: true,
    include_pareto: true,
  }
}

/**
 * Build form request from edges and nodes
 * Helper to construct request from useFormRecommendations data
 */
export function buildFormRequest(
  edges: Array<{ id: string; source: string; target: string; data?: any }>,
  nodes: Array<{ id: string; type?: string; data?: any }>
): CEEFormRequest {
  const edgeContexts = edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    return {
      edge_id: edge.id,
      source_kind: sourceNode?.type || 'unknown',
      target_kind: targetNode?.type || 'unknown',
      current_form: edge.data?.functionType || 'linear',
      context: {
        source_label: sourceNode?.data?.label || sourceNode?.id || 'Unknown',
        target_label: targetNode?.data?.label || targetNode?.id || 'Unknown',
      },
    }
  })

  return { edges: edgeContexts }
}
