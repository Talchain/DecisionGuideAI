/* eslint-disable no-restricted-syntax -- pre-existing diagnostic console.log calls behind DEV guards */
/**
 * ISL Request Adapter
 *
 * Brief 12.5: Transform UI request format to ISL API expected format
 * Brief 30: Updated to match actual ISL API schemas
 * Brief F: Updated to match actual ISL API contract (graph + options + utility format)
 * Brief v2.2: Added v2 edge transformation with signed mean and strength.std
 *
 * ISL expects specific field names and structures that differ from
 * our internal UI conventions. This adapter handles:
 * - Field name mapping
 * - Request payload structuring
 * - Graph format transformation
 * - Parameter uncertainty extraction
 * - v2.2: Signed strength mean from direction + weight
 */

import type {
  ISLRobustnessRequest,
  ISLCausalModel,
  ISLConformalRequest,
  ISLConformalModel,
  ISLGraphNode,
  ISLGraphEdge,
  ISLGraphEdgeV2,
  ISLOption,
  ISLParameterUncertainty,
  LegacyISLRobustnessRequest,
} from '../../adapters/isl/types'
import { STD_FLOOR, DEFAULT_EXISTS_PROBABILITY } from '../../adapters/plot/v2/types'

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
 * Integration fix: Maps type→kind and description→body
 */
export function transformNodesToISLGraph(nodes: UINode[]): ISLGraphNode[] {
  return nodes.map(n => ({
    id: n.id,
    kind: mapNodeKind(n.type),  // Issue 1: type → kind
    label: n.data?.label || n.id,
    body: n.data?.description,  // Issue 2: description → body
    belief: n.data?.belief ?? n.data?.value,
  }))
}

/**
 * Transform UI edges to ISL graph edge format (v1 - unsigned weight)
 */
export function transformEdgesToISLGraph(edges: UIEdge[]): ISLGraphEdge[] {
  return edges.map(e => ({
    from: e.source,
    to: e.target,
    // P0-3: Use 0.5 default for consistency with DEFAULT_EDGE_DATA.weight
    weight: e.data?.weight ?? e.data?.belief ?? 0.5,
  }))
}

// =============================================================================
// Brief v2.2: V2 Edge Transformation Functions
// =============================================================================

// Issue 4 fix: ISLGraphEdgeV2 is now imported from '../../adapters/isl/types'
// Re-export for backward compatibility with existing imports
export type { ISLGraphEdgeV2 as ISLEdgeV2 } from '../../adapters/isl/types'

/**
 * Compute signed strength mean.
 *
 * P0-4: Per canonical rule, direction is encoded ONLY via signed strength_mean.
 * Priority: strength_mean (already signed) > weight + direction (legacy fallback)
 *
 * - strength_mean=-0.8 → mean=-0.8 (sign already encoded)
 * - direction="negative" + weight=0.8 → mean=-0.8 (legacy fallback)
 * - No direction → mean=+weight (assume positive)
 */
export function computeSignedMean(data: UIEdge['data']): number {
  // P0-4: Check for pre-signed strength_mean first (canonical source of truth)
  const strengthMean = (data as any)?.strength_mean
  if (typeof strengthMean === 'number') {
    return strengthMean  // Already signed, use directly
  }

  // Legacy fallback: derive sign from direction + weight
  const magnitude = data?.weight ?? 0.5
  const direction = (data?.direction ?? (data as any)?.effect_direction) as 'positive' | 'negative' | undefined
  const sign = direction === 'negative' ? -1 : 1
  return sign * magnitude
}

/**
 * Compute default std when not provided by CEE.
 * Uses same formula as V2 adapter for consistency:
 * cv = 0.3 * (1 - belief) + 0.1
 * std = max(STD_FLOOR, cv * magnitude)
 */
export function computeDefaultStd(data: UIEdge['data']): number {
  const magnitude = data?.weight ?? 0.5
  // UI-SEM-032: Default exists_probability (0.8) for std computation — mirrors UI-SEM-031.
  const belief = data?.beliefExists ?? data?.confidence ?? data?.belief ?? DEFAULT_EXISTS_PROBABILITY
  const cv = 0.3 * (1 - belief) + 0.1
  return Math.max(STD_FLOOR, cv * magnitude)
}

/**
 * Transform UI edges to ISL v2 format with signed mean.
 * Brief v2.2: Computes exists_probability and strength {mean, std}
 * Issue 4 fix: Now returns ISLGraphEdgeV2[] from central types
 */
export function transformEdgesToISLv2(edges: UIEdge[]): ISLGraphEdgeV2[] {
  return edges.map(e => {
    const data = e.data

    const existsProb = data?.beliefExists ?? data?.confidence ?? data?.belief

    return {
      from: e.source,
      to: e.target,
      // When omitted, ISL defaults to 0.8 (matches PLoT DEFAULT_EXISTS_PROBABILITY)
      ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
      strength: {
        mean: computeSignedMean(data),
        std: data?.strengthStd ?? computeDefaultStd(data)
      }
    }
  })
}

/**
 * Extract options (option/decision nodes) for ISL format
 * P0 Fix: Validates intervention node IDs against current graph to prevent ISL 422 errors
 */
export function extractISLOptions(nodes: UINode[]): ISLOption[] {
  // Build set of valid node IDs from current graph
  const validNodeIds = new Set(nodes.map(n => n.id))

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
    interventions: extractInterventions(node, validNodeIds),
    is_baseline: index === 0,
  }))
}

/**
 * Extract interventions from an option node
 * P0 Fix: Validates intervention keys against valid node IDs to prevent ISL 422 errors
 * @param node - The option node to extract interventions from
 * @param validNodeIds - Set of valid node IDs in current graph (optional for backwards compat)
 */
function extractInterventions(
  node: UINode,
  validNodeIds?: Set<string>
): Record<string, number> {
  const interventions: Record<string, number> = {}
  const filteredKeys: string[] = []

  // Check for explicit interventions in node data
  if (node.data?.interventions && typeof node.data.interventions === 'object') {
    for (const [key, value] of Object.entries(node.data.interventions)) {
      if (typeof value === 'number') {
        // P0 Fix: Validate intervention key exists in graph
        if (validNodeIds && !validNodeIds.has(key)) {
          filteredKeys.push(key)
          continue // Skip stale node ID
        }
        interventions[key] = value
      }
    }
  }

  // Log warning for filtered stale keys
  if (filteredKeys.length > 0 && import.meta.env.DEV) {
    console.warn(
      `[ISL] Filtered ${filteredKeys.length} stale intervention key(s) from option "${node.data?.label || node.id}":`,
      filteredKeys,
      '- These nodes no longer exist in the graph'
    )
  }

  // Fall back to node's own value if no explicit interventions
  if (Object.keys(interventions).length === 0 && typeof node.data?.value === 'number') {
    interventions[node.id] = node.data.value
  }

  return interventions
}

/**
 * Extract numeric value from provenance or label text.
 * Handles common formats:
 * - Currency: £49, $100, €50, £15k, $1.5M
 * - Percentages: 4%, 20%
 * - Plain numbers: 49, 1500, 1.5
 *
 * @param text - Provenance or label text to parse
 * @returns Extracted numeric value or null
 */
export function extractValueFromProvenance(text: string): number | null {
  if (!text || typeof text !== 'string') return null

  // Pattern 1: Currency with optional k/M suffix
  // Matches: £49, $100, €50, £15k, $1.5M, £15,000
  const currencyMatch = text.match(/[£$€]([\d,]+(?:\.\d+)?)\s*(k|m|K|M)?/i)
  if (currencyMatch) {
    let value = parseFloat(currencyMatch[1].replace(/,/g, ''))
    const suffix = currencyMatch[2]?.toLowerCase()
    if (suffix === 'k') value *= 1000
    if (suffix === 'm') value *= 1000000
    if (!isNaN(value)) return value
  }

  // Pattern 2: Percentage
  // Matches: 4%, 20%, 0.5%
  const percentMatch = text.match(/([\d.]+)\s*%/)
  if (percentMatch) {
    const value = parseFloat(percentMatch[1])
    if (!isNaN(value)) return value / 100 // Return as decimal
  }

  // Pattern 3: Number with k/M suffix (no currency symbol)
  // Matches: 15k, 1.5M, 100K
  const suffixMatch = text.match(/\b([\d.]+)\s*(k|m|K|M)\b/)
  if (suffixMatch) {
    let value = parseFloat(suffixMatch[1])
    const suffix = suffixMatch[2]?.toLowerCase()
    if (suffix === 'k') value *= 1000
    if (suffix === 'm') value *= 1000000
    if (!isNaN(value)) return value
  }

  // Pattern 4: "is X" or "= X" patterns (common in provenance)
  // Matches: "is 49", "= 100", "is 1.5"
  const isMatch = text.match(/(?:is|=)\s+([\d.]+)\b/)
  if (isMatch) {
    const value = parseFloat(isMatch[1])
    if (!isNaN(value)) return value
  }

  return null
}

/**
 * Extract parameter uncertainties from factor nodes for ISL analysis.
 * Brief I Task 1: Handles multiple data formats for robustness.
 * Brief v2.2: Added support for observedState format from CEE v2.
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

    // Brief v2.2 Format: { observedState: { value, baseline, unit } }
    // This is the preferred format from CEE v2.2
    const observedState = data.observedState as { value?: number; baseline?: number; unit?: string } | undefined
    if (observedState && typeof observedState.value === 'number') {
      const value = observedState.value
      const baseline = observedState.baseline ?? value

      // Derive std from the change magnitude (25% of delta)
      // Issue 2 fix: When value === baseline (delta=0), use 1% floor
      const delta = Math.abs(value - baseline)
      std = delta > 0
        ? delta * 0.25  // 25% of the change as uncertainty
        : Math.max(STD_FLOOR, Math.abs(value) * 0.01)  // 1% of value or floor

      mean = value
      std = Math.max(STD_FLOOR, std)  // Minimum floor (aligned with V2 adapter)

      if (import.meta.env.DEV) {
        console.log(`[ISL Adapter] Factor ${node.id}: extracted from observedState`, { observedState, mean, std })
      }
    }

    // Format 1: { range: [min, max] } or { range: { min, max } }
    if (mean === null) {
      const range = extractRange(data.range)
      if (range) {
        mean = (range.min + range.max) / 2
        std = (range.max - range.min) / 4 // ~95% within range
        if (import.meta.env.DEV) {
          console.log(`[ISL Adapter] Factor ${node.id}: extracted from range`, { range, mean, std })
        }
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

    // Format 6: Extract from provenance text (fallback)
    // Provenance often contains values like "hypothesis • Current price is £49"
    if (mean === null && data.provenance) {
      const provText = typeof data.provenance === 'string'
        ? data.provenance
        : (data.provenance as { quote?: string })?.quote ?? ''

      const extractedValue = extractValueFromProvenance(provText)
      if (extractedValue !== null) {
        mean = extractedValue
        std = Math.abs(mean) * 0.2 || 0.1 // Default 20% uncertainty for provenance-extracted values
        if (import.meta.env.DEV) {
          console.log(`[ISL Adapter] Factor ${node.id}: extracted from provenance`, { provText, mean, std })
        }
      }
    }

    // Format 7: Extract from label text (last resort)
    // Labels may contain values like "Current Pro plan price (£49)"
    if (mean === null && data.label) {
      const extractedValue = extractValueFromProvenance(data.label)
      if (extractedValue !== null) {
        mean = extractedValue
        std = Math.abs(mean) * 0.2 || 0.1
        if (import.meta.env.DEV) {
          console.log(`[ISL Adapter] Factor ${node.id}: extracted from label`, { label: data.label, mean, std })
        }
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
 * Brief v2.2: Added useV2Schema option for signed strength mean
 */
export function buildISLRobustnessRequest(
  nodes: UINode[],
  edges: UIEdge[],
  options?: {
    includeVoi?: boolean
    sampleSizesForEvsi?: number[]
    useV2Schema?: boolean
  }
): ISLRobustnessRequest {
  // Brief v2.2: Use v2 edge transformation if flag is set
  // Issue 4 fix: ISLGraph.edges now accepts ISLGraphEdge[] | ISLGraphEdgeV2[]
  const graphEdges = options?.useV2Schema
    ? transformEdgesToISLv2(edges)
    : transformEdgesToISLGraph(edges)

  return {
    graph: {
      nodes: transformNodesToISLGraph(nodes),
      edges: graphEdges,
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
 *
 * IMPORTANT: Filters out option and decision nodes before building the causal model.
 * Options are scenarios to compare, not variables in the causal model.
 * Including them causes ISL to fail or return degenerate results.
 */
export function buildISLConformalRequest(
  nodes: UINode[],
  edges: UIEdge[],
  intervention: Record<string, number>,
  calibrationData?: Array<{ inputs: Record<string, number>; outcome: Record<string, number> }>
): ISLConformalRequest {
  // Filter out option and decision nodes - they are scenarios, not causal variables
  // Check both node.type and node.data?.kind for compatibility with different graph formats
  const optionNodeIds = new Set(
    nodes
      .filter(n => n.type === 'option' || n.type === 'decision' ||
                   n.data?.kind === 'option' || n.data?.kind === 'decision')
      .map(n => n.id)
  )

  // Only include causal nodes (factors, outcomes, goals, etc.)
  const causalNodes = nodes.filter(n => !optionNodeIds.has(n.id))
  const variables = causalNodes.map(n => n.id)

  // Filter edges: exclude any edge where source OR target is an option/decision node
  const causalEdges = edges.filter(e =>
    !optionNodeIds.has(e.source) && !optionNodeIds.has(e.target)
  )

  // Build equations from filtered edges (simplified linear model)
  // Use node IDs (not labels) - ISL requires variable names matching ^[a-zA-Z_][a-zA-Z0-9_]*$
  const equations: Record<string, string> = {}

  // Create node lookup for risk→goal heuristic
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (const edge of causalEdges) {
    const sourceId = edge.source
    const targetId = edge.target

    /**
     * UI-SEM-004: Risk→goal sign heuristic (last-resort fallback).
     * When an edge lacks signed strength_mean and effect_direction, auto-negates
     * the coefficient for risk→goal/outcome edges. Same class as UI-SEM-001
     * (adapter concern: translating causal semantics to ISL wire format).
     * PLoT now owns sign computation canonically (March 2026); this is defence-in-depth.
     */
    // P0-4: Priority order for sign handling (canonical rule: direction encoded via signed strength_mean)
    // 1. Use signed strength_mean if present (canonical source of truth)
    // 2. Apply effect_direction if coefficient is positive/unsigned
    // 3. LAST RESORT: risk→goal heuristic with warning
    let coefficient = computeSignedMean(edge.data)

    // Only apply additional sign logic if coefficient is positive (may need correction)
    if (coefficient > 0) {
      const hasExplicitDirection = edge.data?.direction === 'negative' ||
                                   (edge.data as any)?.effect_direction === 'negative'

      if (hasExplicitDirection) {
        // 2a. Explicit direction takes precedence — apply sign flip
        coefficient = -coefficient
      } else {
        // 2b. Heuristic fallback — warn when triggered
        const sourceNode = nodeMap.get(sourceId)
        const targetNode = nodeMap.get(targetId)
        const isRiskSource = sourceNode?.data?.kind === 'risk'
        const isGoalOrOutcomeTarget = targetNode?.data?.kind === 'goal' ||
                                       targetNode?.data?.kind === 'outcome'

        if (isRiskSource && isGoalOrOutcomeTarget) {
          console.warn(
            `[ISL Adapter] Applying risk→goal heuristic for edge ${edge.id} — ` +
            `upstream should set negative strength_mean or effect_direction`
          )
          coefficient = -coefficient
        }
      }
    }
    // If coefficient is already negative, trust it — do not override

    const signedWeight = coefficient

    // Build equation with correct sign
    const operator = signedWeight >= 0 ? '+' : '-'
    const absWeight = Math.abs(signedWeight)

    // Build simple linear equation using node IDs
    if (equations[targetId]) {
      equations[targetId] += ` ${operator} ${absWeight}*${sourceId}`
    } else {
      // First term: include negative sign if needed, no '+' prefix
      equations[targetId] = signedWeight >= 0
        ? `${absWeight}*${sourceId}`
        : `-${absWeight}*${sourceId}`
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
