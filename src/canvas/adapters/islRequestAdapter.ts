/**
 * ISL Request Adapter
 *
 * Brief 12.5: Transform UI request format to ISL API expected format
 * Brief 30: Updated to match actual ISL API schemas
 * Brief F: Updated to match actual ISL API contract (graph + options + utility format)
 *
 * ISL expects specific field names and structures that differ from
 * our internal UI conventions. This adapter handles:
 * - Field name mapping
 * - Request payload structuring
 * - Graph format transformation
 * - Parameter uncertainty extraction
 */

import type {
  ISLRobustnessRequest,
  ISLCausalModel,
  ISLConformalRequest,
  ISLConformalModel,
  ISLGraphNode,
  ISLGraphEdge,
  ISLOption,
  ISLParameterUncertainty,
  LegacyISLRobustnessRequest,
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
    kind?: string
    belief?: number
    range?: [number, number] | { min: number; max: number }
    [key: string]: any
  }
}

export interface UIEdge {
  id: string
  source: string
  target: string
  data?: {
    weight?: number
    belief?: number
    [key: string]: any
  }
}

// =============================================================================
// Brief F Task 5: Range Format Helper
// =============================================================================

/**
 * Extract range from various formats (array or object)
 * Handles both [min, max] and { min, max } formats
 */
export function extractRange(range: unknown): { min: number; max: number } | null {
  if (Array.isArray(range) && range.length >= 2) {
    const [min, max] = range
    if (typeof min === 'number' && typeof max === 'number') {
      return { min, max }
    }
  }
  if (range && typeof range === 'object' && 'min' in range && 'max' in range) {
    const { min, max } = range as { min: unknown; max: unknown }
    if (typeof min === 'number' && typeof max === 'number') {
      return { min, max }
    }
  }
  return null
}

// =============================================================================
// Brief F Task 2: ISL Format Transformation Functions
// =============================================================================

/**
 * Map UI node type to ISL kind
 */
function mapNodeKind(type: string | undefined): string {
  const kindMap: Record<string, string> = {
    factor: 'factor',
    outcome: 'outcome',
    goal: 'goal',
    option: 'option',
    decision: 'decision',
    risk: 'risk',
  }
  return kindMap[type?.toLowerCase() ?? ''] || type || 'factor'
}

/**
 * Transform UI nodes to ISL graph node format
 */
export function transformNodesToISLGraph(nodes: UINode[]): ISLGraphNode[] {
  return nodes.map(n => ({
    id: n.id,
    kind: mapNodeKind(n.type),
    label: n.data?.label || n.id,
    belief: n.data?.belief ?? n.data?.value,
  }))
}

/**
 * Transform UI edges to ISL graph edge format
 */
export function transformEdgesToISLGraph(edges: UIEdge[]): ISLGraphEdge[] {
  return edges.map(e => ({
    from: e.source,
    to: e.target,
    weight: e.data?.weight ?? e.data?.belief ?? 1,
  }))
}

/**
 * Extract options (option/decision nodes) for ISL format
 */
export function extractISLOptions(nodes: UINode[]): ISLOption[] {
  const optionNodes = nodes.filter(n =>
    n.type === 'option' || n.type === 'decision'
  )

  if (optionNodes.length === 0) {
    // No option nodes - create a baseline option
    return [{
      id: 'baseline',
      label: 'Baseline',
      interventions: {},
      is_baseline: true,
    }]
  }

  return optionNodes.map((node, index) => ({
    id: node.id,
    label: node.data?.label || `Option ${index + 1}`,
    interventions: extractInterventions(node),
    is_baseline: index === 0,
  }))
}

/**
 * Extract interventions from an option node
 */
function extractInterventions(node: UINode): Record<string, number> {
  const interventions: Record<string, number> = {}

  // Check for explicit interventions in node data
  if (node.data?.interventions && typeof node.data.interventions === 'object') {
    for (const [key, value] of Object.entries(node.data.interventions)) {
      if (typeof value === 'number') {
        interventions[key] = value
      }
    }
  }

  // Fall back to node's own value if no explicit interventions
  if (Object.keys(interventions).length === 0 && typeof node.data?.value === 'number') {
    interventions[node.id] = node.data.value
  }

  return interventions
}

/**
 * Extract parameter uncertainties from factor nodes for ISL analysis.
 * Brief I Task 1: Handles multiple data formats for robustness.
 */
export function extractParameterUncertainties(
  nodes: UINode[]
): Record<string, ISLParameterUncertainty> {
  const uncertainties: Record<string, ISLParameterUncertainty> = {}
  const factorNodes = nodes.filter(n => n.type === 'factor')

  if (import.meta.env.DEV) {
    console.log('[ISL Adapter] Extracting parameter uncertainties from', factorNodes.length, 'factor nodes')
  }

  for (const node of factorNodes) {
    const data = node.data

    // Skip if no data at all
    if (!data) {
      if (import.meta.env.DEV) {
        console.warn(`[ISL Adapter] Factor ${node.id} has no data field`)
      }
      continue
    }

    let mean: number | null = null
    let std: number | null = null

    // Format 1: { range: [min, max] } or { range: { min, max } }
    const range = extractRange(data.range)
    if (range) {
      mean = (range.min + range.max) / 2
      std = (range.max - range.min) / 4 // ~95% within range
      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from range`, { range, mean, std })
      }
    }

    // Format 2: { value, baseline } — use value as mean, derive std from baseline
    if (mean === null && typeof data.value === 'number') {
      mean = data.value
      if (typeof data.baseline === 'number') {
        // Use distance from baseline as proxy for uncertainty
        std = Math.abs(data.value - data.baseline) * 0.5 || 0.1
      } else {
        // Default to 10% of value
        std = Math.abs(data.value) * 0.1 || 0.1
      }
      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from value`, { value: data.value, mean, std })
      }
    }

    // Format 3: { belief } — treat as probability (0-1)
    if (mean === null && typeof data.belief === 'number') {
      mean = data.belief
      std = 0.1 // Default uncertainty for belief values
      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from belief`, { belief: data.belief, mean, std })
      }
    }

    // Format 4: Check node-level properties (some nodes store data directly)
    if (mean === null && typeof (node as any).belief === 'number') {
      mean = (node as any).belief
      std = 0.1
      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from node.belief`, { mean, std })
      }
    }

    // Format 5: Check for probability field
    if (mean === null && typeof data.probability === 'number') {
      mean = data.probability
      std = 0.1
      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from probability`, { mean, std })
      }
    }

    // If we extracted valid values, add to uncertainties
    if (mean !== null && std !== null && !isNaN(mean) && !isNaN(std)) {
      uncertainties[node.id] = { mean, std }
    } else if (import.meta.env.DEV) {
      console.warn(`[ISL Adapter] Could not extract uncertainties for factor ${node.id}:`, data)
    }
  }

  // Brief I: If no factor nodes have data, create defaults
  if (Object.keys(uncertainties).length === 0 && factorNodes.length > 0) {
    if (import.meta.env.DEV) {
      console.warn('[ISL Adapter] No parameter uncertainties extracted, using defaults for', factorNodes.length, 'factors')
    }
    for (const factor of factorNodes) {
      uncertainties[factor.id] = { mean: 0.5, std: 0.1 }
    }
  }

  if (import.meta.env.DEV) {
    console.log('[ISL Adapter] Final parameter uncertainties:', uncertainties)
  }

  return uncertainties
}

/**
 * Find goal node and build utility specification
 */
export function extractUtility(nodes: UINode[]): { goal_node_id: string; maximize?: boolean } {
  const goalNode = nodes.find(n => n.type === 'goal' || n.type === 'outcome')
  return {
    goal_node_id: goalNode?.id || nodes[0]?.id || 'outcome',
    maximize: true, // Default to maximization
  }
}

/**
 * Build full ISL robustness request from UI graph
 * Brief F Task 2: Uses actual ISL API contract format
 */
export function buildISLRobustnessRequest(
  nodes: UINode[],
  edges: UIEdge[],
  options?: {
    includeVoi?: boolean
    sampleSizesForEvsi?: number[]
  }
): ISLRobustnessRequest {
  return {
    graph: {
      nodes: transformNodesToISLGraph(nodes),
      edges: transformEdgesToISLGraph(edges),
    },
    options: extractISLOptions(nodes),
    utility: extractUtility(nodes),
    parameter_uncertainties: extractParameterUncertainties(nodes),
    analysis_options: {
      include_voi: options?.includeVoi ?? true,
      sample_sizes_for_evsi: options?.sampleSizesForEvsi ?? [10, 50, 100],
    },
  }
}

// =============================================================================
// Legacy ISL Format (kept for backward compatibility)
// =============================================================================

/**
 * Transform UI edges to legacy ISL format (string[][] tuples)
 * @deprecated Use transformEdgesToISLGraph instead
 */
export function transformEdgesToISL(edges: UIEdge[]): string[][] {
  return edges.map(e => [e.source, e.target])
}

/**
 * Transform UI nodes to legacy ISL format (string[] of node IDs)
 * @deprecated Use transformNodesToISLGraph instead
 */
export function transformNodesToISL(nodes: UINode[]): string[] {
  return nodes.map(n => n.id)
}

/**
 * Build legacy ISL causal model from UI graph
 * @deprecated Use buildISLRobustnessRequest instead
 */
export function buildCausalModel(nodes: UINode[], edges: UIEdge[]): ISLCausalModel {
  return {
    nodes: transformNodesToISL(nodes),
    edges: transformEdgesToISL(edges),
  }
}

/**
 * Build target outcome from goal node
 * @deprecated No longer used in new ISL format
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
 * @deprecated Use extractISLOptions instead
 */
export function buildInterventionProposal(
  nodes: UINode[]
): Record<string, number> {
  const interventions: Record<string, number> = {}

  for (const node of nodes) {
    const value = node.data?.value
    if (typeof value === 'number' && !isNaN(value)) {
      interventions[node.id] = value
    }
  }

  if (Object.keys(interventions).length === 0) {
    const factorNode = nodes.find(n => n.type === 'factor')
    if (factorNode) {
      interventions[factorNode.id] = 0.5
    }
  }

  return interventions
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

// LegacyISLRobustnessRequest is imported from types.ts

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
 * @deprecated Use buildISLRobustnessRequest instead for new ISL API format
 */
export function adaptRobustnessRequest(
  request: UIRobustnessRequest
): LegacyISLRobustnessRequest {
  const islRequest: LegacyISLRobustnessRequest = {
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
 * @deprecated Use buildISLRobustnessRequest instead for new ISL API format
 */
export function buildRobustnessRequest(
  runId: string,
  responseHash?: string
): LegacyISLRobustnessRequest {
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
