/**
 * ISL Request Adapter
 *
 * Brief 12.5: Transform UI request format to ISL API expected format
 * Brief 30: Updated to match actual ISL API schemas
 *
 * ISL expects specific field names and structures that differ from
 * our internal UI conventions. This adapter handles:
 * - Field name mapping
 * - Request payload structuring
 * - Graph format transformation (edges as [source, target] tuples)
 */

import type {
  ISLRobustnessRequest,
  ISLCausalModel,
  ISLConformalRequest,
  ISLConformalModel,
} from '../../adapters/isl/types'

// =============================================================================
// UI Graph Types (internal format)
// =============================================================================

export interface UINode {
  id: string
  type?: string
  data?: {
    label?: string
    value?: number
    [key: string]: any
  }
}

export interface UIEdge {
  id: string
  source: string
  target: string
  data?: {
    weight?: number
    [key: string]: any
  }
}

// =============================================================================
// Brief 30: ISL Format Transformation Functions
// =============================================================================

/**
 * Transform UI edges to ISL format (string[][] tuples)
 */
export function transformEdgesToISL(edges: UIEdge[]): string[][] {
  return edges.map(e => [e.source, e.target])
}

/**
 * Transform UI nodes to ISL format (string[] of node IDs)
 */
export function transformNodesToISL(nodes: UINode[]): string[] {
  return nodes.map(n => n.id)
}

/**
 * Build ISL causal model from UI graph
 */
export function buildCausalModel(nodes: UINode[], edges: UIEdge[]): ISLCausalModel {
  return {
    nodes: transformNodesToISL(nodes),
    edges: transformEdgesToISL(edges),
  }
}

/**
 * Build target outcome from goal node
 * Uses ±20% range around the expected value by default
 */
export function buildTargetOutcome(
  goalNodeId: string,
  expectedValue: number,
  rangePercent: number = 0.2
): Record<string, [number, number]> {
  const min = expectedValue * (1 - rangePercent)
  const max = expectedValue * (1 + rangePercent)
  return { [goalNodeId]: [min, max] }
}

/**
 * Build intervention proposal from option/factor nodes with values
 */
export function buildInterventionProposal(
  nodes: UINode[]
): Record<string, number> {
  const interventions: Record<string, number> = {}

  for (const node of nodes) {
    // Include nodes that have numeric values (factors, options with set values)
    const value = node.data?.value
    if (typeof value === 'number' && !isNaN(value)) {
      interventions[node.id] = value
    }
  }

  // If no interventions found, use a placeholder
  if (Object.keys(interventions).length === 0) {
    // Find first factor node with any data
    const factorNode = nodes.find(n => n.type === 'factor')
    if (factorNode) {
      interventions[factorNode.id] = 0.5 // Default intervention value
    }
  }

  return interventions
}

/**
 * Build full ISL robustness request from UI graph
 */
export function buildISLRobustnessRequest(
  nodes: UINode[],
  edges: UIEdge[],
  options?: {
    interventionProposal?: Record<string, number>
    targetOutcome?: Record<string, [number, number]>
    perturbationRadius?: number
    minSamples?: number
    confidenceLevel?: number
  }
): ISLRobustnessRequest {
  const causalModel = buildCausalModel(nodes, edges)

  // Use provided intervention or build from nodes
  const interventionProposal = options?.interventionProposal ?? buildInterventionProposal(nodes)

  // Use provided target outcome or derive from goal/outcome nodes
  let targetOutcome = options?.targetOutcome
  if (!targetOutcome) {
    const outcomeNode = nodes.find(n => n.type === 'outcome' || n.type === 'goal')
    if (outcomeNode) {
      const value = outcomeNode.data?.value ?? 0.5
      targetOutcome = buildTargetOutcome(outcomeNode.id, value)
    } else {
      // Fallback: use first node
      targetOutcome = { [nodes[0]?.id ?? 'outcome']: [0.4, 0.6] }
    }
  }

  return {
    causal_model: causalModel,
    intervention_proposal: interventionProposal,
    target_outcome: targetOutcome,
    perturbation_radius: options?.perturbationRadius ?? 0.1,
    min_samples: options?.minSamples ?? 100,
    confidence_level: options?.confidenceLevel ?? 0.95,
  }
}

/**
 * Build ISL conformal request from UI graph
 */
export function buildISLConformalRequest(
  nodes: UINode[],
  edges: UIEdge[],
  intervention: Record<string, number>,
  calibrationData?: Array<{ inputs: Record<string, number>; outcome: Record<string, number> }>
): ISLConformalRequest {
  // Build equations from edges (simplified linear model)
  const equations: Record<string, string> = {}
  const variables = nodes.map(n => n.data?.label || n.id)

  for (const edge of edges) {
    const sourceLabel = nodes.find(n => n.id === edge.source)?.data?.label || edge.source
    const targetLabel = nodes.find(n => n.id === edge.target)?.data?.label || edge.target
    const weight = edge.data?.weight ?? 1

    // Build simple linear equation
    if (equations[targetLabel]) {
      equations[targetLabel] += ` + ${weight}*${sourceLabel}`
    } else {
      equations[targetLabel] = `${weight}*${sourceLabel}`
    }
  }

  const model: ISLConformalModel = {
    variables,
    equations,
    distributions: {
      noise: { type: 'normal', parameters: { mean: 0, std: 0.1 } }
    }
  }

  return {
    model,
    intervention,
    calibration_data: calibrationData ?? [],
    confidence_level: 0.95,
  }
}

// =============================================================================
// Legacy Types (kept for backward compatibility)
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

/** @deprecated Use ISLRobustnessRequest from types.ts instead */
export interface LegacyISLRobustnessRequest {
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
