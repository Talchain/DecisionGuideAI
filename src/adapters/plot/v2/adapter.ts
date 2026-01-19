/**
 * PLoT V2 Adapter (P0-UI-1)
 *
 * Transforms canvas nodes/edges to V2RunRequest for /v2/run endpoint.
 *
 * Key responsibilities:
 * - Derive options from nodes with kind='option'
 * - Normalise intervention keys (legacy labels to node IDs)
 * - Apply node ID normalisation for ISL V2 constraint (^[a-z0-9_:-]+$)
 * - Enforce std floor (0.001)
 * - Send seed as string
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  V2RunRequest,
  V2RunResponse,
  V2RunError,
  V2RunResult,
  V2Node,
  V2Edge,
  V2Option,
} from './types'
import { STD_FLOOR, STD_CEILING_RATIO, STD_CEILING_ABS, DEFAULT_STD, isBlockedResponse } from './types'
import {
  normaliseGraphIds,
  translateResponseToUIIds,
} from '../../../utils/nodeIdNormalisation'
import type { UIOption, UIInterventionValue } from '../../../types/options'
import type { CEEAnalysisReady, CEEOptionV3 } from '../../cee/types'
import { recordRequestPayload, recordResponsePayload } from '../../../lib/payload-trace-store'
import { STRENGTH_BOUNDS, clampStrength } from '../../../canvas/domain/edges'

// ============================================================================
// Canvas Data Types (input format)
// ============================================================================

interface CanvasNodeData {
  label?: string
  kind?: string
  type?: string
  description?: string
  value?: number
  baseline?: number
  observedState?: {
    value?: number
    baseline?: number
    unit?: string
    source?: string
  }
  interventions?: Record<string, number | UIInterventionValue>
  [key: string]: unknown
}

interface CanvasEdgeData {
  weight?: number
  direction?: 'positive' | 'negative'
  beliefExists?: number
  confidence?: number
  belief?: number
  strengthStd?: number
  [key: string]: unknown
}

// ============================================================================
// Options Extraction
// ============================================================================

/**
 * Extract options from canvas nodes.
 * Options come from nodes with kind='option' or type='option'.
 *
 * Returns UIOption format with rich intervention metadata.
 */
export function extractOptionsFromNodes(
  nodes: Node<CanvasNodeData>[],
  validNodeIds: Set<string>
): UIOption[] {
  const optionNodes = nodes.filter(
    (n) => n.data?.kind === 'option' || n.data?.type === 'option'
  )

  if (optionNodes.length === 0) {
    return []
  }

  return optionNodes.map((node): UIOption => {
    const interventions: Record<string, UIInterventionValue> = {}
    let hasValidInterventions = false

    // Extract interventions from node data
    // Only include interventions that target valid causal nodes (factors, outcomes, goals)
    // NOT option nodes (which would be self-targeting)
    if (node.data?.interventions && typeof node.data.interventions === 'object') {
      for (const [key, rawValue] of Object.entries(node.data.interventions)) {
        // Skip if target doesn't exist
        if (!validNodeIds.has(key)) {
          if (import.meta.env.DEV) {
            console.warn(
              `[V2Adapter] Skipping stale intervention key "${key}" in option "${node.data?.label || node.id}"`
            )
          }
          continue
        }

        // Skip self-targeting (option targeting itself)
        if (key === node.id) {
          if (import.meta.env.DEV) {
            console.warn(
              `[V2Adapter] Skipping self-targeting intervention in option "${node.data?.label || node.id}"`
            )
          }
          continue
        }

        // Handle both simple number and UIInterventionValue formats
        if (typeof rawValue === 'number') {
          interventions[key] = {
            value: rawValue,
            source: 'user_specified',
            target_match: {
              node_id: key,
              match_type: 'exact_id',
              confidence: 'high',
            },
          }
          hasValidInterventions = true
        } else if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
          interventions[key] = rawValue as UIInterventionValue
          hasValidInterventions = true
        }
      }
    }

    // DO NOT create self-targeting fallback interventions
    // Options without valid interventions should have empty interventions
    // and status='needs_user_mapping' — validation will prompt user to configure

    return {
      id: node.id,
      label: node.data?.label || `Option ${node.id}`,
      description: node.data?.description,
      status: hasValidInterventions ? 'ready' : 'needs_user_mapping',
      interventions,
      user_questions: hasValidInterventions
        ? undefined
        : [
            'Which causal variable(s) does this option affect?',
            'What value should that variable have if this option is chosen?',
          ],
      source: 'legacy_node',
    }
  })
}

/**
 * Convert UIOption to V2Option format.
 * Flattens UIInterventionValue to simple number values.
 */
export function uiOptionToV2Option(option: UIOption): V2Option {
  return {
    id: option.id,
    label: option.label,
    interventions: Object.fromEntries(
      Object.entries(option.interventions).map(([nodeId, iv]) => [
        nodeId,
        typeof iv === 'number' ? iv : iv.value,
      ])
    ),
  }
}

/**
 * Known valid status values for UIOption.
 */
const KNOWN_OPTION_STATUSES = new Set(['ready', 'needs_user_mapping', 'needs_user_input'])

/**
 * Normalise CEEOptionV3 status to UIOption status.
 * Defensive alias: 'needs_user_input' -> 'needs_user_mapping'
 * Unknown statuses default to 'needs_user_mapping' with a warning.
 */
function normaliseOptionStatus(status: CEEOptionV3['status']): UIOption['status'] {
  // Handle known alias
  if (status === 'needs_user_input') {
    return 'needs_user_mapping'
  }

  // Validate known status
  if (!KNOWN_OPTION_STATUSES.has(status)) {
    if (import.meta.env.DEV) {
      console.warn(`[V2Adapter] Unknown option status "${status}", defaulting to 'needs_user_mapping'`)
    }
    return 'needs_user_mapping'
  }

  return status as UIOption['status']
}

/**
 * Convert CEEOptionV3 to UIOption format.
 * Handles status alias and preserves intervention metadata.
 */
export function ceeOptionToUIOption(ceeOption: CEEOptionV3): UIOption {
  return {
    id: ceeOption.id,
    label: ceeOption.label,
    status: normaliseOptionStatus(ceeOption.status),
    interventions: Object.fromEntries(
      Object.entries(ceeOption.interventions).map(([nodeId, iv]) => {
        // CEE may return interventions as just numbers or as objects with metadata
        const isNumber = typeof iv === 'number'
        return [
          nodeId,
          {
            value: isNumber ? iv : iv.value,
            source: isNumber ? 'brief_extraction' : iv.source,
            target_match: isNumber ? undefined : iv.target_match,
            value_confidence: isNumber ? undefined : iv.value_confidence,
            reasoning: isNumber ? undefined : iv.reasoning,
          },
        ]
      })
    ),
    user_questions: ceeOption.user_questions,
    unresolved_targets: ceeOption.unresolved_targets,
    source: 'cee_generated',
  }
}

/**
 * Convert CEEOptionV3 directly to V2Option format.
 * Flattens intervention values for the V2 API.
 *
 * Handles both:
 * - Nested format (V3): { value: number, source: string, ... }
 * - Flattened format (analysis_ready): number
 *
 * CEE may return interventions in either format depending on the response path.
 */
export function ceeOptionToV2Option(ceeOption: CEEOptionV3): V2Option {
  if (import.meta.env.DEV) {
    console.log('[V2Adapter] ceeOptionToV2Option input:', {
      id: ceeOption.id,
      label: ceeOption.label,
      interventionKeys: Object.keys(ceeOption.interventions || {}),
      interventions: ceeOption.interventions,
    })
  }

  const result: V2Option = {
    id: ceeOption.id,
    label: ceeOption.label,
    interventions: Object.fromEntries(
      Object.entries(ceeOption.interventions).map(([nodeId, iv]) => {
        // Handle both nested (V3) and flattened (analysis_ready) formats
        // V3 nested: iv = { value: number, source: string, ... }
        // Flattened: iv = number
        const value = typeof iv === 'number' ? iv : iv?.value
        return [nodeId, value]
      })
    ),
  }

  if (import.meta.env.DEV) {
    console.log('[V2Adapter] ceeOptionToV2Option output:', {
      id: result.id,
      interventionKeys: Object.keys(result.interventions),
      interventions: result.interventions,
    })
  }

  return result
}

// ============================================================================
// Node Transformation
// ============================================================================

/**
 * Extract observed_state from various canvas node formats.
 * Follows the 8-level fallback chain documented in the brief.
 */
function extractObservedState(data: CanvasNodeData | undefined): V2Node['observed_state'] | undefined {
  if (!data) return undefined

  // Priority 1: observedState object
  if (data.observedState && typeof data.observedState.value === 'number') {
    const value = data.observedState.value
    const baseline = data.observedState.baseline ?? value
    const delta = Math.abs(value - baseline)
    const unit = data.observedState.unit
    const source = data.observedState.source

    // Derive std from change magnitude (25% of delta), with floor and proportional ceiling
    // Ceiling scales with value (50% ratio) but has absolute max for safety
    const rawStd = delta > 0
      ? Math.max(STD_FLOOR, delta * 0.25)
      : Math.max(STD_FLOOR, Math.abs(value) * 0.01)
    const std = Math.min(rawStd, Math.abs(value) * STD_CEILING_RATIO, STD_CEILING_ABS)

    return {
      value,
      std,
      baseline,
      ...(unit ? { unit } : {}),
      ...(source ? { source } : {}),
    }
  }

  // Priority 2: value + baseline fields (also check for unit/source at top level)
  if (typeof data.value === 'number') {
    const value = data.value
    const baseline = typeof data.baseline === 'number' ? data.baseline : value
    const delta = Math.abs(value - baseline)
    const unit = (data as Record<string, unknown>).unit as string | undefined
    const source = (data as Record<string, unknown>).source as string | undefined

    // Proportional ceiling: scales with value (50% ratio) but has absolute max
    const rawStd = delta > 0
      ? Math.max(STD_FLOOR, delta * 0.25)
      : Math.max(STD_FLOOR, Math.abs(value) * 0.01 || DEFAULT_STD)
    const std = Math.min(rawStd, Math.abs(value) * STD_CEILING_RATIO, STD_CEILING_ABS)

    return {
      value,
      std,
      baseline,
      ...(unit ? { unit } : {}),
      ...(source ? { source } : {}),
    }
  }

  return undefined
}

/**
 * Transform canvas node to V2Node format.
 */
export function transformNodeToV2(node: Node<CanvasNodeData>): V2Node {
  const data = node.data ?? {}

  return {
    id: node.id,
    kind: data.kind ?? data.type ?? 'factor',
    label: data.label ?? node.id,
    observed_state: extractObservedState(data),
  }
}

// ============================================================================
// Edge Transformation
// ============================================================================

/**
 * Error thrown when edge validation fails.
 * Routes to VALIDATION_BLOCKED path in the run hook.
 */
export class EdgeValidationError extends Error {
  public readonly code = 'EDGE_VALIDATION_FAILED'
  public readonly edgeId: string
  public readonly fromNode: string
  public readonly toNode: string
  public readonly missingFields: string[]

  constructor(
    fromNode: string,
    toNode: string,
    missingFields: string[],
    edgeId?: string
  ) {
    const fieldList = missingFields.map((f) => `'${f}'`).join(', ')
    super(`Edge '${fromNode} → ${toNode}' is missing required field(s): ${fieldList}`)
    this.name = 'EdgeValidationError'
    this.edgeId = edgeId ?? `${fromNode}->${toNode}`
    this.fromNode = fromNode
    this.toNode = toNode
    this.missingFields = missingFields
  }
}

/**
 * Validate edge has required fields.
 * Throws EdgeValidationError if required fields are missing.
 *
 * Required fields:
 * - weight: Edge strength magnitude (0-1)
 * - direction: Effect direction ('positive' | 'negative')
 * - One of: beliefExists, confidence, belief (edge existence probability)
 *
 * @param strict - If true, also require strengthStd. Default false for backwards compatibility.
 */
export function validateEdgeData(
  edge: Edge<CanvasEdgeData>,
  options: { strict?: boolean } = {}
): void {
  const data = edge.data
  const missingFields: string[] = []

  // Check for weight
  if (data?.weight === undefined || typeof data.weight !== 'number') {
    missingFields.push('weight')
  }

  // Check for direction
  if (data?.direction === undefined) {
    missingFields.push('direction')
  }

  // Check for existence probability (one of three fields)
  const hasExistsProbability =
    typeof data?.beliefExists === 'number' ||
    typeof data?.confidence === 'number' ||
    typeof data?.belief === 'number'

  if (!hasExistsProbability) {
    missingFields.push('belief/confidence')
  }

  // In strict mode, also require strengthStd
  if (options.strict && data?.strengthStd === undefined) {
    missingFields.push('strengthStd')
  }

  if (missingFields.length > 0) {
    throw new EdgeValidationError(edge.source, edge.target, missingFields, edge.id)
  }
}

/**
 * Validate all edges and collect errors (non-throwing).
 * Returns array of EdgeValidationError for edges with missing fields.
 * Use this for pre-run validation to show all issues at once.
 */
export function validateAllEdges(
  edges: Edge<CanvasEdgeData>[],
  options: { strict?: boolean } = {}
): EdgeValidationError[] {
  const errors: EdgeValidationError[] = []

  for (const edge of edges) {
    try {
      validateEdgeData(edge, options)
    } catch (error) {
      if (error instanceof EdgeValidationError) {
        errors.push(error)
      }
    }
  }

  return errors
}

/**
 * Tracking for strength corrections made during edge transformation.
 * Used for post-run summary display.
 */
export interface StrengthCorrection {
  edgeId: string
  from: string
  to: string
  original: number
  clamped: number
}

let strengthCorrections: StrengthCorrection[] = []

export function clearStrengthCorrections(): void {
  strengthCorrections = []
}

export function getStrengthCorrections(): StrengthCorrection[] {
  return [...strengthCorrections]
}

/**
 * Compute signed strength mean from direction and weight.
 * - direction="positive" + weight=0.8 -> mean=+0.8
 * - direction="negative" + weight=0.8 -> mean=-0.8
 *
 * Clamps result to CEE-valid range [-1, +1].
 *
 * IMPORTANT: Call validateEdgeData first to ensure fields exist.
 */
function computeSignedMean(data: CanvasEdgeData | undefined, edgeId?: string, from?: string, to?: string): number {
  const magnitude = data?.weight ?? 0.5
  const direction = data?.direction
  const sign = direction === 'negative' ? -1 : 1
  const raw = sign * magnitude

  // Clamp to CEE-valid range [-1, +1]
  const result = clampStrength(raw)

  if (result.wasAdjusted && edgeId && from && to) {
    strengthCorrections.push({
      edgeId,
      from,
      to,
      original: result.original,
      clamped: result.clamped,
    })

    if (import.meta.env.DEV) {
      console.log('[Adapter] Strength clamped:', {
        edge: `${from} → ${to}`,
        original: result.original,
        clamped: result.clamped,
      })
    }
  }

  return result.clamped
}

/**
 * Compute default std when not provided by CEE.
 * Uses formula: cv = 0.3 * (1 - belief) + 0.1, std = max(floor, cv * magnitude)
 *
 * IMPORTANT: Call validateEdgeData first to ensure fields exist.
 */
function computeDefaultStd(data: CanvasEdgeData | undefined): number {
  const magnitude = data?.weight ?? 0.5
  const belief = data?.beliefExists ?? data?.confidence ?? data?.belief ?? 0.5
  const cv = 0.3 * (1 - belief) + 0.1
  return Math.max(STD_FLOOR, cv * magnitude)
}

/**
 * Transform canvas edge to V2Edge format.
 * Enforces STD_FLOOR on strength.std.
 *
 * NOTE: This function uses fallback defaults for backwards compatibility.
 * Use transformEdgeToV2Strict for strict validation that blocks on missing fields.
 */
export function transformEdgeToV2(edge: Edge<CanvasEdgeData>): V2Edge {
  const data = edge.data ?? {}

  const std = data.strengthStd ?? computeDefaultStd(data)
  const existsProb = data.beliefExists ?? data.confidence ?? data.belief ?? 0.5
  const finalStd = Math.max(STD_FLOOR, std)

  // Diagnostic logging for edge uncertainty data flow
  if (import.meta.env.DEV) {
    console.log('[Adapter] Edge to PLoT:', {
      edge: `${edge.source} → ${edge.target}`,
      canvas_beliefExists: data.beliefExists,
      canvas_confidence: data.confidence,
      canvas_belief: data.belief,
      canvas_strengthStd: data.strengthStd,
      computed_defaultStd: data.strengthStd === undefined ? computeDefaultStd(data) : 'N/A (used canvas)',
      output_exists_probability: existsProb,
      output_strength_std: finalStd,
      fallback_used: data.beliefExists === undefined
        ? data.confidence === undefined
          ? data.belief === undefined
            ? '0.5 (default)'
            : 'belief'
          : 'confidence'
        : 'beliefExists',
    })
  }

  return {
    from: edge.source,
    to: edge.target,
    strength: {
      mean: computeSignedMean(data, edge.id, edge.source, edge.target),
      std: finalStd,
    },
    exists_probability: existsProb,
  }
}

/**
 * Transform canvas edge to V2Edge format with strict validation.
 * Throws EdgeValidationError if required fields are missing.
 *
 * Use this when building requests from CEE responses where all fields should be present.
 */
export function transformEdgeToV2Strict(edge: Edge<CanvasEdgeData>): V2Edge {
  validateEdgeData(edge, { strict: false })

  const data = edge.data!
  const std = data.strengthStd ?? computeDefaultStd(data)

  return {
    from: edge.source,
    to: edge.target,
    strength: {
      mean: computeSignedMean(data, edge.id, edge.source, edge.target),
      std: Math.max(STD_FLOOR, std),
    },
    exists_probability: data.beliefExists ?? data.confidence ?? data.belief ?? 0.5,
  }
}

// ============================================================================
// Main Adapter Functions
// ============================================================================

/**
 * Build V2RunRequest from canvas state.
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @param options - UIOptions (may come from CEE or extracted from nodes)
 * @param goalNodeId - The outcome/goal node ID
 * @returns V2RunRequest with normalised IDs and reverseIdMap for response translation
 */
export function buildV2Request(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  options: UIOption[],
  goalNodeId: string
): { request: V2RunRequest; reverseIdMap: Map<string, string> } {
  // Step 1: Extract or use provided options
  const validNodeIds = new Set(nodes.map((n) => n.id))
  const effectiveOptions =
    options.length > 0 ? options : extractOptionsFromNodes(nodes, validNodeIds)

  // Step 2: Transform to V2 formats
  const v2Nodes = nodes.map(transformNodeToV2)
  const v2Edges = edges.map(transformEdgeToV2)
  const v2Options = effectiveOptions.map(uiOptionToV2Option)

  // Step 3: Apply ID normalisation for ISL V2 constraint
  const normalised = normaliseGraphIds(
    { nodes: v2Nodes, edges: v2Edges },
    v2Options,
    goalNodeId
  )

  if (normalised.hasChanges && import.meta.env.DEV) {
    console.log('[V2Adapter] Node IDs were normalised:', {
      changes: [...normalised.idMap.entries()].filter(([a, b]) => a !== b),
    })
  }

  // Step 4: Build final request
  // P0 Fix: Derive seed from timestamp instead of hardcoded "42"
  const request: V2RunRequest = {
    graph: normalised.graph,
    options: normalised.options,
    goal_node_id: normalised.goalNodeId ?? goalNodeId,
    seed: String(Math.floor(Date.now() / 1000) % 1000000),
    detail_level: 'deep',
  }

  return { request, reverseIdMap: normalised.reverseIdMap }
}

/**
 * Options for buildV2RequestFromAnalysisReady.
 */
export interface BuildV2RequestOptions {
  /**
   * Whether to validate edges strictly.
   * When true, throws EdgeValidationError if required fields (weight, direction, belief) are missing.
   * When false (default), uses lenient transformation with fallback defaults.
   *
   * Recommendation: Use strict=false for user-edited graphs that may lack CEE-provided fields.
   * Edge validation errors can be surfaced via validateAllEdges() in pre-run checks instead.
   */
  strictEdgeValidation?: boolean
  /**
   * P0 Fix: Optional seed to use for the request.
   * If not provided, falls back to analysisReady.suggested_seed or derives from timestamp.
   */
  seed?: number
  /**
   * User's decision framing for contextualised CEE responses.
   * When provided, CEE can generate more relevant headlines and guidance.
   */
  framing?: {
    title?: string
    goal?: string
    constraints?: string
  }
}

/**
 * Build V2RunRequest preferring CEE analysis_ready when available.
 *
 * This is the preferred entry point for P0-UI integration:
 * - When analysisReady is provided, uses its options and goal_node_id
 * - Applies edge transformation (strict or lenient based on options)
 * - Falls back to buildV2Request when analysisReady is not provided
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @param analysisReady - CEE V3 analysis_ready payload (optional)
 * @param fallbackOptions - UIOptions to use if analysisReady not provided
 * @param fallbackGoalNodeId - Goal node ID to use if analysisReady not provided
 * @param options - Build options (strictEdgeValidation, etc.)
 * @returns V2RunRequest with normalised IDs and reverseIdMap for response translation
 */
export function buildV2RequestFromAnalysisReady(
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  analysisReady?: CEEAnalysisReady | null,
  fallbackOptions?: UIOption[],
  fallbackGoalNodeId?: string,
  options: BuildV2RequestOptions = {}
): { request: V2RunRequest; reverseIdMap: Map<string, string> } {
  const { strictEdgeValidation = false, framing } = options

  // Fall back to standard buildV2Request if no analysisReady
  if (!analysisReady) {
    if (!fallbackGoalNodeId) {
      throw new Error('Either analysisReady or fallbackGoalNodeId must be provided')
    }
    return buildV2Request(nodes, edges, fallbackOptions ?? [], fallbackGoalNodeId)
  }

  // Step 1: Validate edges if strict mode enabled
  // NOTE: With strictEdgeValidation=false (default), missing fields use fallback defaults.
  // For pre-run validation, use validateAllEdges() to collect and display all issues.
  if (strictEdgeValidation) {
    for (const edge of edges) {
      validateEdgeData(edge)
    }
  }

  // Step 2: Transform to V2 formats
  // Use strict or lenient edge transformation based on validation setting
  const v2Nodes = nodes.map(transformNodeToV2)
  const v2Edges = strictEdgeValidation
    ? edges.map(transformEdgeToV2Strict)
    : edges.map(transformEdgeToV2) // Lenient: uses fallback defaults for missing fields

  // Step 3: Convert CEE options to V2 format
  const v2Options = analysisReady.options.map(ceeOptionToV2Option)

  // Step 4: Get goal node ID and seed from analysisReady
  // P0 Fix: Seed precedence - options.seed > analysisReady.suggested_seed > derived
  const goalNodeId = analysisReady.goal_node_id
  const seed = options.seed?.toString() ?? analysisReady.suggested_seed ?? String(Math.floor(Date.now() / 1000) % 1000000)

  // Step 5: Apply ID normalisation for ISL V2 constraint
  // IMPORTANT: This normalises ALL IDs coherently:
  // - Node IDs
  // - Edge from/to
  // - Option IDs
  // - Option intervention keys
  // - Goal node ID
  const normalised = normaliseGraphIds(
    { nodes: v2Nodes, edges: v2Edges },
    v2Options,
    goalNodeId
  )

  if (normalised.hasChanges && import.meta.env.DEV) {
    console.log('[V2Adapter] Node IDs were normalised from analysis_ready:', {
      changes: [...normalised.idMap.entries()].filter(([a, b]) => a !== b),
    })
  }

  // Step 6: Build final request
  const request: V2RunRequest = {
    graph: normalised.graph,
    options: normalised.options,
    goal_node_id: normalised.goalNodeId ?? goalNodeId,
    seed,
    detail_level: 'deep',
    // Include framing for contextualised CEE responses
    ...(framing && { framing }),
  }

  return { request, reverseIdMap: normalised.reverseIdMap }
}

/**
 * Get UIOptions from CEE analysis_ready.
 * Converts CEEOptionV3 to UIOption with status normalisation.
 */
export function getOptionsFromAnalysisReady(analysisReady: CEEAnalysisReady): UIOption[] {
  return analysisReady.options.map(ceeOptionToUIOption)
}

/**
 * Type alias for objects that can have their IDs translated.
 * Matches the constraint of translateResponseToUIIds.
 */
type TranslatableResponse = Parameters<typeof translateResponseToUIIds>[0]

/**
 * Translate V2 response IDs back to UI IDs.
 * Ensures critique affected_nodes and option IDs match canvas nodes.
 *
 * Note: Only call this on successful responses (V2RunResponse), not errors.
 * The type constraint ensures the response has the expected shape for translation.
 */
export function translateV2Response<T extends TranslatableResponse>(
  response: T,
  reverseIdMap: Map<string, string>
): T {
  return translateResponseToUIIds(response, reverseIdMap)
}

/**
 * Type guard for checking if result is an error response.
 */
export { isBlockedResponse }

// ============================================================================
// HTTP Client Integration
// ============================================================================

/**
 * Configuration for V2 HTTP calls.
 */
export interface V2AdapterConfig {
  baseUrl: string
  timeout?: number
}

/**
 * Make V2 run request.
 * Handles 422 responses by preserving the unwrapped V2RunError body.
 */
export async function runV2(
  config: V2AdapterConfig,
  request: V2RunRequest
): Promise<V2RunResult> {
  const { baseUrl, timeout = 120000 } = config
  const startTime = Date.now()
  const requestId = request.request_id || `v2-${Date.now()}`
  const endpoint = '/v2/run'
  const directPlotUrl = import.meta.env.VITE_PLOT_ENGINE_URL
  const resolvedBaseUrl = typeof directPlotUrl === 'string' && directPlotUrl.trim().length > 0
    ? directPlotUrl.trim()
    : baseUrl

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Build headers, including X-Request-Id if present in request
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (request.request_id) {
    headers['X-Request-Id'] = request.request_id
  }

  // Record request payload for debug panel
  recordRequestPayload({
    id: requestId,
    endpoint,
    method: 'POST',
    headers,
    body: request,
  })

  try {
    const response = await fetch(`${resolvedBaseUrl}/v2/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle 422 - returns V2RunError directly (not wrapped in error.v1)
    if (response.status === 422) {
      const errorBody: V2RunError = await response.json()

      // Record 422 error response for debug panel
      recordResponsePayload({
        id: requestId,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody,
        duration: Date.now() - startTime,
        error: errorBody.status_reason || 'Validation blocked',
      })

      return errorBody
    }

    // Handle other errors
    if (!response.ok) {
      const errorMessage = `V2 run failed: ${response.status} ${response.statusText}`

      // Try to get error body if available (JSON first, then raw text fallback)
      // Clone response first since body can only be read once
      let errorBody: unknown = null
      const responseClone = response.clone()
      try {
        errorBody = await response.json()
      } catch (parseError) {
        // JSON parse failed - try to get raw text from clone for debugging
        if (import.meta.env.DEV) {
          console.warn('[V2Adapter] Failed to parse error response as JSON:', parseError)
        }
        try {
          const rawText = await responseClone.text()
          errorBody = { _raw_text: rawText, _parse_error: true }
        } catch {
          // Last resort - record that we couldn't get any body
          errorBody = { _parse_error: true, _status: response.status }
        }
      }

      // Record error response for debug panel
      recordResponsePayload({
        id: requestId,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody,
        duration: Date.now() - startTime,
        error: errorMessage,
      })

      // Include error body info in the thrown error for better debugging
      const bodyPreview = errorBody
        ? typeof errorBody === 'object' && '_raw_text' in (errorBody as Record<string, unknown>)
          ? (errorBody as Record<string, unknown>)._raw_text
          : JSON.stringify(errorBody).slice(0, 200)
        : null
      const fullMessage = bodyPreview
        ? `${errorMessage} - ${bodyPreview}`
        : errorMessage
      throw new Error(fullMessage)
    }

    const result: V2RunResponse = await response.json()

    // Record success response for debug panel
    recordResponsePayload({
      id: requestId,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: result,
      duration: Date.now() - startTime,
    })

    return result
  } catch (error) {
    clearTimeout(timeoutId)

    const errorMessage = error instanceof Error && error.name === 'AbortError'
      ? 'V2 run request timed out'
      : error instanceof Error ? error.message : 'Unknown error'

    // Record error for debug panel (if not already recorded)
    if (!(error instanceof Error && error.message.startsWith('V2 run failed'))) {
      recordResponsePayload({
        id: requestId,
        status: 0,
        headers: {},
        body: null,
        duration: Date.now() - startTime,
        error: errorMessage,
      })
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('V2 run request timed out')
    }

    throw error
  }
}

/**
 * Full V2 adapter workflow:
 * 1. Build request from canvas state
 * 2. Make HTTP call
 * 3. Translate response IDs back to UI IDs
 *
 * @param requestId - Optional request ID for tracing (auto-generated if not provided)
 */
export async function executeV2Run(
  config: V2AdapterConfig,
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  options: UIOption[],
  goalNodeId: string,
  requestId?: string
): Promise<V2RunResult> {
  // Build request with ID normalisation
  const { request, reverseIdMap } = buildV2Request(nodes, edges, options, goalNodeId)

  // Add request ID for tracing
  if (requestId) {
    request.request_id = requestId
  }

  if (import.meta.env.DEV) {
    console.log('[V2Adapter] Sending request:', {
      requestId: request.request_id,
      nodeCount: request.graph.nodes.length,
      edgeCount: request.graph.edges.length,
      optionCount: request.options.length,
      goalNodeId: request.goal_node_id,
    })
  }

  // Execute request
  const result = await runV2(config, request)

  // Translate response IDs back to UI IDs
  const translated = translateV2Response(result, reverseIdMap)

  if (import.meta.env.DEV) {
    console.log('[V2Adapter] Response:', {
      requestId: translated.request_id,
      status: translated.analysis_status,
      isBlocked: isBlockedResponse(translated),
    })
  }

  return translated
}

/**
 * Execute V2 run using CEE analysis_ready when available.
 *
 * Preferred entry point for P0-UI integration:
 * - When analysisReady is provided, uses its options and goal_node_id
 * - Falls back to extracting options from nodes when not provided
 *
 * @param config - V2 adapter config
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @param analysisReady - CEE V3 analysis_ready payload (optional)
 * @param fallbackGoalNodeId - Goal node ID to use if analysisReady not provided
 * @param requestId - Optional request ID for tracing
 * @param goalThreshold - Optional success threshold for probability_of_goal
 * @param seed - P0 Fix: Optional seed for reproducibility (avoids hardcoded "42")
 * @param framing - User's decision framing for contextualised CEE responses
 */
export async function executeV2RunWithAnalysisReady(
  config: V2AdapterConfig,
  nodes: Node<CanvasNodeData>[],
  edges: Edge<CanvasEdgeData>[],
  analysisReady: CEEAnalysisReady | null,
  fallbackGoalNodeId: string,
  requestId?: string,
  goalThreshold?: number,
  seed?: number,
  framing?: { title?: string; goal?: string; constraints?: string }
): Promise<V2RunResult> {
  // Build fallback options from nodes (used when analysisReady not available)
  const validNodeIds = new Set(nodes.map((n) => n.id))
  const fallbackOptions = extractOptionsFromNodes(nodes, validNodeIds)

  // Build request - uses analysisReady if available, falls back to node extraction
  // P0 Fix: Pass seed to avoid hardcoded "42" default
  const { request, reverseIdMap } = buildV2RequestFromAnalysisReady(
    nodes,
    edges,
    analysisReady,
    fallbackOptions,
    fallbackGoalNodeId,
    { strictEdgeValidation: false, seed, framing } // Lenient mode for user-edited graphs
  )

  // Add request ID for tracing
  if (requestId) {
    request.request_id = requestId
  }

  // Add goal threshold for probability_of_goal calculation
  if (goalThreshold !== undefined) {
    request.goal_threshold = goalThreshold
  }

  if (import.meta.env.DEV) {
    console.log('[V2Adapter] Sending request (via analysisReady path):', {
      requestId: request.request_id,
      nodeCount: request.graph.nodes.length,
      edgeCount: request.graph.edges.length,
      optionCount: request.options.length,
      goalNodeId: request.goal_node_id,
      goalThreshold: request.goal_threshold,
      usingAnalysisReady: !!analysisReady,
    })

    // Detailed options logging for debugging empty interventions
    console.log('[V2Adapter] Final request options:', request.options.map((o) => ({
      id: o.id,
      label: o.label,
      interventionKeys: Object.keys(o.interventions),
      interventions: o.interventions,
    })))
  }

  // Execute request
  const result = await runV2(config, request)

  // Translate response IDs back to UI IDs
  const translated = translateV2Response(result, reverseIdMap)

  if (import.meta.env.DEV) {
    console.log('[V2Adapter] Response:', {
      requestId: translated.request_id,
      status: translated.analysis_status,
      isBlocked: isBlockedResponse(translated),
    })
  }

  return translated
}
