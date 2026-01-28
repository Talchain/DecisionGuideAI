/**
 * useDebugData Hook
 *
 * Normalizes all debug data sources into a unified structure for Debug Panel V2.
 * Extracts data from canvas store, payload trace store, and gate store.
 *
 * Key responsibilities:
 * - Consolidate service call data (CEE, PLoT, ISL)
 * - Extract ISL data from PLoT downstream_calls
 * - Normalize pipeline stages and metadata
 * - Provide raw payloads for inspection
 *
 * =============================================================================
 * CANONICAL DATA PATHS
 * =============================================================================
 *
 * Service Status:
 * - services.cee   → tracedPayloads['CEE'].status/response
 * - services.plot  → tracedPayloads['PLoT'].status/response
 * - services.isl   → PRIORITY: plot_response.downstream_calls.isl[0] > tracedPayloads['ISL']
 *                    (downstream_calls reflects actual ISL call via PLoT orchestration)
 *
 * Payloads:
 * - payloads.cee_request   → tracedPayloads['CEE'].request.body
 * - payloads.cee_response  → tracedPayloads['CEE'].response.body
 * - payloads.plot_request  → tracedPayloads['PLoT'].request.body
 * - payloads.plot_response → tracedPayloads['PLoT'].response.body
 * - payloads.isl_request   → derived from services.isl.request
 * - payloads.isl_response  → derived from services.isl.response
 *
 * LLM Metadata:
 * - pipeline.llm_metadata.model          → cee_response.trace.pipeline.llm_metadata.model
 * - pipeline.llm_metadata.prompt_version → cee_response.trace.pipeline.llm_metadata.prompt_version
 * - pipeline.llm_metadata.prompt_hash    → cee_response.trace.pipeline.llm_metadata.prompt_hash
 * - pipeline.llm_metadata.prompt_diagnostics → cee_response.trace.prompt_diagnostics OR .meta.prompt_diagnostics
 *   - instance_id, cache_age_ms, cache_status, use_staging_mode
 *
 * Build Versions:
 * - builds.ui   → version-cache.getClientBuild()
 * - builds.cee  → cee_response.trace.engine.version OR .build
 * - builds.plot → plot_response.meta.build OR .trace.build
 * - builds.isl  → isl_response._metadata.isl_version OR .version
 *
 * ISL Downstream Calls (from PLoT):
 * - plot_response.downstream_calls.isl[0].status_code
 * - plot_response.downstream_calls.isl[0].latency_ms (or elapsed_ms)
 * - plot_response.downstream_calls.isl[0].request_payload (or request)
 * - plot_response.downstream_calls.isl[0].response_payload (or response)
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { usePayloadTraceStore, type TracedPayload } from '../../../lib/payload-trace-store'
import { useGateStore, type GateName, type GateStatus } from '../../../lib/gate-state'
import { getClientBuild } from '../../../lib/version-cache'

// =============================================================================
// Types
// =============================================================================

export type ServiceStatus = 'success' | 'error' | 'pending' | 'unavailable'

export interface ServiceCallData {
  /** Service name */
  name: string
  /** HTTP status code */
  status: number | null
  /** Whether the call succeeded */
  success: boolean
  /** Request duration in ms */
  duration_ms: number | null
  /** Endpoint called */
  endpoint: string | null
  /** Error message if failed */
  error?: string
  /** Request payload */
  request?: unknown
  /** Response payload */
  response?: unknown
}

export interface IslDownstreamCall {
  endpoint: string
  request: unknown
  response: unknown | null
  status_code: number
  success: boolean
  latency_ms: number
  error?: string
}

export interface PipelineStageData {
  id: string
  name: string
  status: 'success' | 'error' | 'pending' | 'skipped'
  duration_ms?: number
  details?: Record<string, unknown>
}

export interface LlmMetadataData {
  model?: string
  temperature?: number
  /** LLM call duration in milliseconds */
  duration_ms?: number
  prompt_version?: string
  prompt_hash?: string
  token_usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  /** CEE prompt management diagnostic fields */
  prompt_diagnostics?: {
    /** Prompt store instance ID */
    instance_id?: string
    /** Cache age in milliseconds */
    cache_age_ms?: number
    /** Cache status (hit/miss/stale) */
    cache_status?: string
    /** Whether staging mode is enabled */
    use_staging_mode?: boolean
  }
}

export interface LlmRawData {
  /** Raw LLM output text */
  text?: string
  /** Hash of the raw output for comparison */
  hash?: string
  /** Whether the output was truncated */
  truncated?: boolean
  /** Character count of original output */
  char_count?: number
  /** Node counts extracted from raw */
  node_counts?: {
    options?: number
    factors?: number
    outcomes?: number
  }
  /** Edge counts extracted from raw */
  edge_count?: number
}

export interface NodeExtractionData {
  raw?: Record<string, number>
  normalised?: Record<string, number>
  validated?: Record<string, number>
}

export interface PipelineData {
  status: 'success' | 'error' | 'pending'
  total_duration_ms?: number
  stages: PipelineStageData[]
  llm_metadata?: LlmMetadataData
  llm_raw?: LlmRawData
  node_extraction?: NodeExtractionData
  connectivity?: {
    decision_count: number
    option_count: number
    goal_count: number
    factor_count: number
    edge_count: number
  }
}

export interface PayloadBundle {
  cee_request?: unknown
  cee_response?: unknown
  plot_request?: unknown
  plot_response?: unknown
  isl_request?: unknown
  isl_response?: unknown
}

export interface GateData {
  name: GateName
  status: GateStatus
  message?: string
}

export interface ServiceErrorData {
  /** Service that failed */
  service: string
  /** Error code/name */
  code: string
  /** Error message */
  message: string
  /** HTTP status code */
  status: number | null
  /** Duration when error occurred */
  duration_ms: number | null
  /** Whether the error is retryable */
  retryable: boolean
}

export interface BuildVersions {
  /** UI client build (from version-cache) */
  ui: string | null
  /** CEE service build */
  cee: string | null
  /** PLoT service build */
  plot: string | null
  /** ISL service build */
  isl: string | null
}

export interface DiagnosticChecks {
  /** Whether PLoT response contains downstream_calls */
  plot_has_downstream_calls: boolean
  /** Path where downstream_calls was found */
  downstream_calls_path_found: string | null
  /** All paths checked for downstream_calls */
  downstream_calls_paths_checked: string[]
  /** Source of ISL data */
  isl_data_source: 'downstream_calls' | 'direct_capture' | 'none'
  /** Whether CEE trace is present */
  cee_trace_present: boolean
  /** Whether CEE is in degraded mode */
  cee_degraded: boolean
  /** CEE degraded reason if applicable */
  cee_degraded_reason?: string
  /** Whether llm_raw data is available */
  llm_raw_available: boolean
  /** Path where llm_raw was found */
  llm_raw_path_found: string | null
}

export interface CeeTraceData {
  /** Whether CEE ran in degraded mode */
  degraded: boolean
  /** Reason for degradation */
  reason?: string
  /** CEE latency in ms */
  latency_ms?: number
  /** Source of the response */
  source?: string
}

/**
 * A single graph correction made by CEE pipeline
 */
export interface GraphCorrection {
  /** Unique correction ID */
  id: string
  /** Pipeline layer that made the correction */
  layer: 'adapter' | 'pipeline' | 'guards'
  /** Stage number within the layer */
  stage: number
  /** Human-readable stage name */
  stage_name: string
  /** Type of correction made */
  type:
    | 'node_added'
    | 'node_removed'
    | 'edge_added'
    | 'edge_removed'
    | 'node_modified'
    | 'edge_modified'
    | 'kind_normalised'
    | 'coefficient_adjusted'
  /** Target of the correction */
  target: {
    node_id?: string
    edge_id?: string
  }
  /** Reason for the correction */
  reason: string
}

/**
 * Summary of corrections by layer
 */
export interface CorrectionsSummary {
  by_layer: {
    adapter?: number
    pipeline?: number
    guards?: number
  }
  total: number
}

/**
 * A single validation issue from ISL critiques or UI-side checks
 */
export interface ValidationIssue {
  /** Unique issue ID */
  id: string
  /** Issue code (e.g., GRAPH_DISCONNECTED, STRENGTH_OUT_OF_RANGE) */
  code: string
  /** Severity level */
  severity: 'error' | 'warning' | 'info'
  /** Human-readable message */
  message: string
  /** Suggested fix or action */
  suggestion?: string
  /** Source of the issue */
  source: 'isl' | 'ui'
  /** Affected node IDs (for linking to graph) */
  affected_nodes?: string[]
  /** Affected edge IDs (for linking to graph) */
  affected_edges?: string[]
}

/**
 * Summary of validation issues by severity
 */
export interface ValidationSummary {
  errors: number
  warnings: number
  info: number
}

/**
 * Complete validation data
 */
export interface ValidationData {
  summary: ValidationSummary
  issues: ValidationIssue[]
}

/**
 * Winning option data from ISL analysis
 */
export interface WinningOptionData {
  /** Winning option ID */
  id: string
  /** Winning option label */
  label: string
  /** Win probability (0-100) */
  win_probability: number
  /** Whether it's a close race (winner < 70%) */
  is_close_race: boolean
  /** Runner-up data if close race */
  runner_up?: {
    id: string
    label: string
    win_probability: number
  }
}

/**
 * Robustness data with stability context
 */
export interface RobustnessData {
  /** Pass/fail/warn status */
  status: 'pass' | 'fail' | 'warn' | 'unavailable'
  /** Recommendation stability (0-1) */
  stability: number | null
  /** Human-readable context label */
  context_label: string
  /** Detailed description */
  description: string
}

// =============================================================================
// Enhancement Types (Debug Panel V2.1)
// =============================================================================

/**
 * Orchestrator status extracted from CEE pipeline trace
 */
export interface OrchestratorStatus {
  /** Whether orchestrator feature is enabled (null if unknown from trace) */
  enabled: boolean | null
  /** Whether orchestrator actually ran */
  ran: boolean
  /** Whether validation passed (null if validation didn't run or status unknown) */
  validation_passed: boolean | null
  /** Whether repair was attempted */
  repair_attempted: boolean
  /** Whether repair succeeded (null if not attempted or unknown) */
  repair_succeeded: boolean | null
  /** Count of errors found */
  error_count: number
  /** Count of warnings found */
  warning_count: number
}

/**
 * V12.4 category field presence check for factors
 */
export interface V12_4Checks {
  /** Whether category field is present on any factor */
  category_field_present: boolean
  /** Node IDs that have category field */
  nodes_with_category: string[]
  /** Node IDs missing category field */
  nodes_missing_category: string[]
  /** Map of node ID to category value */
  category_values: Record<string, string>
}

/**
 * Request ID chain for tracking ID propagation across services
 */
export interface RequestIdChain {
  /** ID generated by UI at request start */
  ui_generated: string | null
  /** ID sent to PLoT */
  sent_to_plot: string | null
  /** ID from CEE response trace */
  cee_trace: string | null
  /** ID in PLoT request */
  plot_request: string | null
  /** ID in PLoT response */
  plot_response: string | null
  /** ID in ISL request */
  isl_request: string | null
  /** ID in ISL response */
  isl_response: string | null
  /** Whether all IDs match */
  all_match: boolean
}

/**
 * Feature flags at the time of the request
 */
export interface FeatureFlagsAtRequest {
  /** Whether orchestrator validation is enabled */
  orchestrator_validation: boolean | null
  /** Whether causal validation is enabled */
  causal_validation: boolean | null
  /** Whether clarifier is enabled */
  clarifier: boolean | null
  /** Whether preflight is enabled */
  preflight: boolean | null
}

/**
 * Timestamps per service for timing analysis
 */
export interface ServiceTiming {
  /** When the request started */
  request_start: string | null
  /** When CEE response was received */
  cee_response: string | null
  /** When PLoT request was sent */
  plot_request: string | null
  /** When PLoT response was received */
  plot_response: string | null
  /** When ISL request was sent */
  isl_request: string | null
  /** When ISL response was received */
  isl_response: string | null
  /** When the debug bundle was created */
  bundle_created: string | null
}

/**
 * Schema version consistency check
 */
export interface SchemaVersions {
  /** CEE request schema version */
  cee_request: string | null
  /** CEE response schema version */
  cee_response: string | null
  /** PLoT request schema version */
  plot_request: string | null
  /** PLoT response schema version */
  plot_response: string | null
  /** Whether versions are consistent */
  consistent: boolean
}

export interface DebugData {
  /** Overall analysis status */
  overall: {
    status: 'success' | 'error' | 'pending'
    total_duration_ms: number | null
    /** Trace ID: server x-request-id/x-correlation-id if available, otherwise internal trace id */
    request_id: string | null
  }

  /** Service call data for each service */
  services: {
    cee: ServiceCallData | null
    plot: ServiceCallData | null
    isl: ServiceCallData | null
  }

  /** First service error (for error banner display) */
  error: ServiceErrorData | null

  /** Service build versions */
  builds: BuildVersions

  /** Diagnostic checks for troubleshooting */
  diagnostics: DiagnosticChecks

  /** CEE trace data if available */
  ceeTrace: CeeTraceData | null

  /** Graph corrections made by CEE pipeline */
  corrections: GraphCorrection[]

  /** Summary of corrections by layer */
  correctionsSummary: CorrectionsSummary | null

  /** Pipeline processing data */
  pipeline: PipelineData

  /** Raw payloads for inspection */
  payloads: PayloadBundle

  /** Gate statuses */
  gates: GateData[]

  /** Graph validation issues (ISL critiques + UI-side checks) */
  validation: ValidationData

  /** Winning option from ISL analysis */
  winningOption: WinningOptionData | null

  /** Robustness data with stability context */
  robustness: RobustnessData

  /** Whether any data is available */
  hasData: boolean

  // Enhancement fields (Debug Panel V2.1)

  /** Orchestrator status extracted from CEE pipeline */
  orchestrator: OrchestratorStatus | null

  /** V12.4 category field presence check */
  v12_4_checks: V12_4Checks | null

  /** Request ID chain for tracking ID propagation */
  request_id_chain: RequestIdChain | null

  /** Feature flags at the time of request */
  feature_flags_at_request: FeatureFlagsAtRequest | null

  /** Timestamps per service */
  timing: ServiceTiming | null

  /** Schema version consistency */
  schema_versions: SchemaVersions | null
}

// =============================================================================
// Constants
// =============================================================================

/**
 * All paths checked for downstream_calls in PLoT response.
 * Used by both findDownstreamCallsPath (for diagnostics) and extractIslFromPlotResponse (for extraction).
 */
const DOWNSTREAM_CALLS_PATHS = [
  { path: 'response.downstream_calls', accessor: (p: Record<string, unknown>) => p.downstream_calls },
  { path: 'response.body.downstream_calls', accessor: (p: Record<string, unknown>) => (p.body as Record<string, unknown>)?.downstream_calls },
  { path: 'response.trace.downstream_calls', accessor: (p: Record<string, unknown>) => (p.trace as Record<string, unknown>)?.downstream_calls },
  { path: 'response.data.downstream_calls', accessor: (p: Record<string, unknown>) => (p.data as Record<string, unknown>)?.downstream_calls },
  { path: 'response.body.trace.downstream_calls', accessor: (p: Record<string, unknown>) => ((p.body as Record<string, unknown>)?.trace as Record<string, unknown>)?.downstream_calls },
  { path: 'response.result.downstream_calls', accessor: (p: Record<string, unknown>) => (p.result as Record<string, unknown>)?.downstream_calls },
  { path: 'response.meta.downstream_calls', accessor: (p: Record<string, unknown>) => (p.meta as Record<string, unknown>)?.downstream_calls },
] as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract ISL data from PLoT response downstream_calls.
 * Uses DOWNSTREAM_CALLS_PATHS to ensure detection and extraction are aligned.
 *
 * Handles multiple structures:
 * - downstream_calls.isl as object with status_code/latency_ms (older format)
 * - downstream_calls.isl as array with status/elapsed_ms (newer PLoT format)
 */
function extractIslFromPlotResponse(plotResponse: unknown): IslDownstreamCall | null {
  if (!plotResponse || typeof plotResponse !== 'object') return null

  const response = plotResponse as Record<string, unknown>

  // Check all paths using shared accessors
  for (const { accessor } of DOWNSTREAM_CALLS_PATHS) {
    const downstream = accessor(response)
    if (downstream && typeof downstream === 'object') {
      const isl = (downstream as Record<string, unknown>).isl
      if (isl) {
        // Handle both array and object formats
        const islData = Array.isArray(isl) ? isl[0] : isl
        if (islData && typeof islData === 'object') {
          const data = islData as Record<string, unknown>
          // Normalize field names - newer PLoT uses status/elapsed_ms, interface expects status_code/latency_ms
          const statusCode = (data.status_code ?? data.status) as number | undefined
          const latencyMs = (data.latency_ms ?? data.elapsed_ms) as number | undefined
          // Derive success from status code if not explicitly provided
          const success = typeof data.success === 'boolean'
            ? data.success
            : typeof statusCode === 'number'
              ? statusCode >= 200 && statusCode < 300
              : false

          return {
            endpoint: (data.endpoint ?? '') as string,
            // Handle both field naming conventions: request/response (older) and request_payload/response_payload (newer)
            request: data.request ?? data.request_payload,
            response: data.response ?? data.response_payload ?? null,
            status_code: statusCode ?? 0,
            success,
            latency_ms: latencyMs ?? 0,
            error: data.error as string | undefined,
          }
        }
      }
    }
  }

  return null
}

/**
 * Convert TracedPayload to ServiceCallData
 */
function payloadToServiceCall(payload: TracedPayload | undefined): ServiceCallData | null {
  if (!payload) return null

  return {
    name: payload.service,
    status: payload.status ?? null,
    success: payload.completed && (payload.status ?? 0) >= 200 && (payload.status ?? 0) < 300,
    duration_ms: payload.duration ?? null,
    endpoint: payload.endpoint,
    error: payload.error,
    request: payload.request?.body,
    response: payload.response?.body,
  }
}

/**
 * Extract prompt diagnostics from CEE response
 * Checks multiple paths where CEE might place diagnostic fields
 */
function extractPromptDiagnostics(ceeResponse: unknown): LlmMetadataData['prompt_diagnostics'] | undefined {
  if (!ceeResponse || typeof ceeResponse !== 'object') return undefined

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.trace as Record<string, unknown> | undefined
  const meta = cee.meta as Record<string, unknown> | undefined

  // Check multiple paths for prompt diagnostics
  const diagnostics =
    trace?.prompt_diagnostics ??
    meta?.prompt_diagnostics ??
    cee.prompt_diagnostics ??
    // Also check for individual fields at common locations
    (trace?.instance_id || trace?.cache_status ? trace : undefined) ??
    (meta?.instance_id || meta?.cache_status ? meta : undefined)

  if (!diagnostics || typeof diagnostics !== 'object') return undefined

  const d = diagnostics as Record<string, unknown>
  return {
    instance_id: d.instance_id as string | undefined,
    cache_age_ms: d.cache_age_ms as number | undefined,
    cache_status: d.cache_status as string | undefined,
    use_staging_mode: d.use_staging_mode as boolean | undefined,
  }
}

/**
 * Extract LLM metadata from pipeline trace
 */
function extractLlmMetadata(pipeline: unknown, ceeResponse?: unknown): LlmMetadataData | undefined {
  if (!pipeline || typeof pipeline !== 'object') return undefined

  const p = pipeline as Record<string, unknown>

  // Try llm_metadata directly
  if (p.llm_metadata && typeof p.llm_metadata === 'object') {
    const metadata = p.llm_metadata as LlmMetadataData
    // Add prompt diagnostics from CEE response if available
    const prompt_diagnostics = extractPromptDiagnostics(ceeResponse)
    return prompt_diagnostics ? { ...metadata, prompt_diagnostics } : metadata
  }

  // Try llm_calls[0] fallback
  if (Array.isArray(p.llm_calls) && p.llm_calls.length > 0) {
    const firstCall = p.llm_calls[0] as Record<string, unknown>
    const prompt_diagnostics = extractPromptDiagnostics(ceeResponse)
    return {
      model: firstCall.model as string | undefined,
      temperature: firstCall.temperature as number | undefined,
      duration_ms: firstCall.duration_ms as number | undefined,
      token_usage: {
        prompt_tokens: firstCall.prompt_tokens as number | undefined,
        completion_tokens: firstCall.completion_tokens as number | undefined,
        total_tokens: ((firstCall.prompt_tokens as number) ?? 0) + ((firstCall.completion_tokens as number) ?? 0),
      },
      prompt_diagnostics,
    }
  }

  return undefined
}

/**
 * Extract node extraction data from pipeline
 */
function extractNodeExtraction(pipeline: unknown): NodeExtractionData | undefined {
  if (!pipeline || typeof pipeline !== 'object') return undefined

  const p = pipeline as Record<string, unknown>
  if (p.node_extraction && typeof p.node_extraction === 'object') {
    return p.node_extraction as NodeExtractionData
  }

  return undefined
}

/**
 * Simple hash function for comparing raw outputs
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Extract raw LLM output data from CEE response
 * Looks in: ceeResponse?.trace?.pipeline?.llm_raw
 *           ceeResponse?.pipeline_trace?.llm_raw
 *           ceeResponse?.llm_raw
 */
function extractLlmRaw(ceeResponse: unknown): LlmRawData | undefined {
  if (!ceeResponse || typeof ceeResponse !== 'object') return undefined

  const cee = ceeResponse as Record<string, unknown>

  // Try multiple paths for llm_raw
  const llmRaw =
    (cee.trace as Record<string, unknown>)?.pipeline?.llm_raw ??
    (cee.trace as Record<string, unknown>)?.llm_raw ??
    (cee.pipeline_trace as Record<string, unknown>)?.llm_raw ??
    cee.llm_raw

  if (!llmRaw || typeof llmRaw !== 'object') return undefined

  const raw = llmRaw as Record<string, unknown>

  // Extract text content (type-guarded) - check all possible field names
  const rawText = raw.output_preview ?? raw.text ?? raw.content ?? raw.output
  const text = typeof rawText === 'string' ? rawText : undefined

  // Calculate hash if we have text, or use pre-computed hash from CEE
  const rawHash = raw.output_hash ?? raw.hash
  const hash = text ? simpleHash(text) : (typeof rawHash === 'string' ? rawHash : undefined)

  // Check for truncation indicators (type-guarded)
  const truncated = raw.truncated === true || raw.was_truncated === true

  // Get character count (type-guarded) - check all possible field names
  const rawCharCount = raw.char_count ?? raw.character_count ?? raw.length
  const charCount = text?.length ?? (typeof rawCharCount === 'number' ? rawCharCount : undefined)

  // Extract node counts if available (type-guarded)
  let nodeCounts: LlmRawData['node_counts'] | undefined
  if (raw.node_counts && typeof raw.node_counts === 'object') {
    const nc = raw.node_counts as Record<string, unknown>
    nodeCounts = {
      options: typeof nc.options === 'number' ? nc.options : undefined,
      factors: typeof nc.factors === 'number' ? nc.factors : undefined,
      outcomes: typeof nc.outcomes === 'number' ? nc.outcomes : undefined,
    }
    // Only include if at least one value is present
    if (nodeCounts.options === undefined && nodeCounts.factors === undefined && nodeCounts.outcomes === undefined) {
      nodeCounts = undefined
    }
  }

  // Extract edge count (type-guarded)
  const edgeCount = typeof raw.edge_count === 'number' ? raw.edge_count : undefined

  return {
    text,
    hash,
    truncated,
    char_count: charCount,
    node_counts: nodeCounts,
    edge_count: edgeCount,
  }
}

/**
 * Extract pipeline stages from trace
 */
function extractPipelineStages(pipeline: unknown): PipelineStageData[] {
  if (!pipeline || typeof pipeline !== 'object') return []

  const p = pipeline as Record<string, unknown>
  const stages: PipelineStageData[] = []

  // Add stages based on available data
  if (p.llm_calls || p.llm_metadata) {
    stages.push({
      id: 'llm_draft',
      name: 'LLM Draft',
      status: 'success',
      duration_ms: Array.isArray(p.llm_calls) ? (p.llm_calls[0] as Record<string, unknown>)?.duration_ms as number : undefined,
    })
  }

  if (p.node_extraction) {
    stages.push({
      id: 'node_extraction',
      name: 'Node Extraction',
      status: 'success',
      details: p.node_extraction as Record<string, unknown>,
    })
  }

  if (p.transforms) {
    stages.push({
      id: 'transforms',
      name: 'Transforms',
      status: 'success',
      details: p.transforms as Record<string, unknown>,
    })
  }

  if (p.final_graph) {
    stages.push({
      id: 'final_graph',
      name: 'Final Graph',
      status: 'success',
      details: p.final_graph as Record<string, unknown>,
    })
  }

  return stages
}

/**
 * Count nodes by kind
 */
function countNodesByKind(nodes: Array<{ data?: { kind?: string } }>): {
  decision: number
  option: number
  goal: number
  factor: number
  outcome: number
} {
  const counts = { decision: 0, option: 0, goal: 0, factor: 0, outcome: 0 }

  for (const node of nodes) {
    const kind = node.data?.kind as keyof typeof counts | undefined
    if (kind && kind in counts) {
      counts[kind]++
    }
  }

  return counts
}

/**
 * Find the most recent payload for a service, preferring completed over in-flight.
 * Falls back to most recent incomplete only if no completed payload exists.
 */
function findBestPayload(payloads: TracedPayload[], service: string): TracedPayload | undefined {
  // First try: most recent completed payload for this service
  const completed = payloads.find((p) => p.service === service && p.completed)
  if (completed) return completed

  // Fallback: most recent incomplete payload for this service
  return payloads.find((p) => p.service === service)
}

/**
 * Extract error data from the first failed service.
 * Looks in both the traced payload and the response body for error details.
 */
function extractFirstError(
  services: { cee: ServiceCallData | null; plot: ServiceCallData | null; isl: ServiceCallData | null },
  payloads: PayloadBundle
): ServiceErrorData | null {
  // Check services in order: CEE -> PLoT -> ISL
  const serviceOrder: Array<{ name: string; service: ServiceCallData | null; responseKey: keyof PayloadBundle }> = [
    { name: 'CEE', service: services.cee, responseKey: 'cee_response' },
    { name: 'PLoT', service: services.plot, responseKey: 'plot_response' },
    { name: 'ISL', service: services.isl, responseKey: 'isl_response' },
  ]

  for (const { name, service, responseKey } of serviceOrder) {
    if (!service || service.success) continue

    // Try to extract error details from response body
    const responseBody = payloads[responseKey] as Record<string, unknown> | undefined
    const errorFromBody = responseBody?.error as Record<string, unknown> | undefined

    return {
      service: name,
      code: (errorFromBody?.code as string) || (service.error ? 'ERROR' : `HTTP_${service.status}`),
      message: (errorFromBody?.message as string) || service.error || `Service ${name} failed`,
      status: service.status,
      duration_ms: service.duration_ms,
      retryable: (errorFromBody?.retryable as boolean) ?? (service.status === 503 || service.status === 429),
    }
  }

  return null
}

/**
 * Extract build versions from service responses
 */
function extractBuildVersions(
  ceeResponse: unknown,
  plotResponse: unknown,
  islResponse: unknown
): BuildVersions {
  const cee = ceeResponse as Record<string, unknown> | undefined
  const plot = plotResponse as Record<string, unknown> | undefined
  const isl = islResponse as Record<string, unknown> | undefined

  return {
    ui: getClientBuild() || null,
    // CEE path: trace.engine.version (preferred) or trace.engine.build (fallback)
    cee: (cee?.trace as Record<string, unknown>)?.engine?.version as string
      ?? (cee?.trace as Record<string, unknown>)?.engine?.build as string
      ?? (cee?.trace as Record<string, unknown>)?.build as string
      ?? (cee?.build as string)
      ?? null,
    plot: (plot?.meta as Record<string, unknown>)?.build as string
      ?? (plot?.trace as Record<string, unknown>)?.build as string
      ?? (plot?.build as string)
      ?? null,
    isl: (isl?._metadata as Record<string, unknown>)?.isl_version as string
      ?? (isl?._metadata as Record<string, unknown>)?.version as string
      ?? (isl?.version as string)
      ?? null,
  }
}

/**
 * Find the path where downstream_calls was found in plot response
 */
function findDownstreamCallsPath(plotResponse: unknown): string | null {
  if (!plotResponse || typeof plotResponse !== 'object') return null
  const p = plotResponse as Record<string, unknown>

  for (const { path, accessor } of DOWNSTREAM_CALLS_PATHS) {
    if (accessor(p)) return path
  }

  return null
}

/**
 * Get list of all paths checked for downstream_calls (for diagnostics)
 */
function getDownstreamCallsPathsChecked(): string[] {
  return DOWNSTREAM_CALLS_PATHS.map(({ path }) => path)
}

/**
 * Find the path where llm_raw was found in CEE response
 */
function findLlmRawPath(ceeResponse: unknown): string | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null
  const cee = ceeResponse as Record<string, unknown>

  if ((cee.trace as Record<string, unknown>)?.pipeline?.llm_raw) return 'response.trace.pipeline.llm_raw'
  if ((cee.trace as Record<string, unknown>)?.llm_raw) return 'response.trace.llm_raw'
  if ((cee.pipeline_trace as Record<string, unknown>)?.llm_raw) return 'response.pipeline_trace.llm_raw'
  if (cee.llm_raw) return 'response.llm_raw'

  return null
}

/**
 * Extract diagnostic checks from payloads
 */
function extractDiagnosticChecks(
  plotResponse: unknown,
  ceeResponse: unknown,
  islDataSource: 'downstream_calls' | 'direct_capture' | 'none'
): DiagnosticChecks {
  const plot = plotResponse as Record<string, unknown> | undefined
  const cee = ceeResponse as Record<string, unknown> | undefined

  const hasDownstreamCalls = findDownstreamCallsPath(plotResponse) !== null

  const ceeTrace = cee?.ceeTrace as Record<string, unknown>
    ?? cee?.trace as Record<string, unknown>
    ?? (cee?.meta as Record<string, unknown>)?.trace as Record<string, unknown>

  const llmRawPath = findLlmRawPath(ceeResponse)

  return {
    plot_has_downstream_calls: hasDownstreamCalls,
    downstream_calls_path_found: findDownstreamCallsPath(plotResponse),
    downstream_calls_paths_checked: getDownstreamCallsPathsChecked(),
    isl_data_source: islDataSource,
    cee_trace_present: !!ceeTrace,
    cee_degraded: (ceeTrace?.degraded as boolean) ?? false,
    cee_degraded_reason: ceeTrace?.reason as string | undefined,
    llm_raw_available: llmRawPath !== null,
    llm_raw_path_found: llmRawPath,
  }
}

// =============================================================================
// Validation Extraction Functions
// =============================================================================

/**
 * ISL critique structure from response
 */
interface ISLCritique {
  id: string
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  source?: string
  suggestion?: string
}

/**
 * Extract ISL critiques from PLoT response
 */
function extractIslCritiques(plotResponse: unknown): ValidationIssue[] {
  if (!plotResponse || typeof plotResponse !== 'object') return []

  const response = plotResponse as Record<string, unknown>

  // Try multiple paths for critiques (check all possible ISL response locations)
  const critiques =
    (response.critiques as ISLCritique[]) ??
    ((response.response as Record<string, unknown>)?.critiques as ISLCritique[]) ??
    (((response.isl as Record<string, unknown>)?.response as Record<string, unknown>)?.critiques as ISLCritique[]) ??
    ((response.body as Record<string, unknown>)?.critiques as ISLCritique[]) ??
    ((response.data as Record<string, unknown>)?.critiques as ISLCritique[]) ??
    (((response.downstream_calls as Record<string, unknown>)?.isl as Record<string, unknown>)?.response as Record<string, unknown>)?.critiques as ISLCritique[] ??
    []

  if (!Array.isArray(critiques)) return []

  return critiques.map((critique): ValidationIssue => ({
    id: critique.id ?? `isl_${crypto.randomUUID().slice(0, 8)}`,
    code: critique.code ?? 'UNKNOWN',
    severity: critique.severity ?? 'warning',
    message: critique.message ?? 'Unknown issue',
    suggestion: critique.suggestion,
    source: 'isl',
  }))
}

/**
 * Edge data structure for validation checks
 */
interface EdgeForValidation {
  id: string
  source: string
  target: string
  data?: {
    strength_mean?: number
    strength?: number
    confidence?: number
    kind?: string
  }
}

/**
 * Perform UI-side validation checks on the graph
 */
function performUiValidationChecks(
  edges: EdgeForValidation[],
  _nodes: Array<{ id: string; data?: { label?: string; kind?: string } }>
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check 1: STRENGTH_OUT_OF_RANGE
  // Any edge with strength_mean < -1 or > +1
  for (const edge of edges) {
    // Determine which field we're checking and its value
    let strengthField: string | null = null
    let strength: number | undefined
    if (edge.data?.strength_mean !== undefined) {
      strengthField = 'strength_mean'
      strength = edge.data.strength_mean
    } else if (edge.data?.strength !== undefined) {
      strengthField = 'strength'
      strength = edge.data.strength
    } else if (edge.data?.confidence !== undefined) {
      strengthField = 'confidence'
      strength = edge.data.confidence
    }

    if (strength !== undefined && (strength < -1 || strength > 1)) {
      issues.push({
        id: `ui_strength_${edge.id}`,
        code: 'STRENGTH_OUT_OF_RANGE',
        severity: 'warning',
        message: `Edge ${edge.source}→${edge.target} has ${strengthField}=${strength.toFixed(2)} outside [-1, +1]`,
        suggestion: 'Clamp to valid range',
        source: 'ui',
        affected_edges: [edge.id],
        affected_nodes: [edge.source, edge.target],
      })
    }
  }

  // Check 2: BIDIRECTIONAL_EDGE (optimized single-pass O(n))
  // Track both the sorted key and direction in one loop
  const edgePairs = new Map<string, { edgeIds: string[]; hasForward: boolean; hasBackward: boolean; nodeA: string; nodeB: string }>()
  for (const edge of edges) {
    const [nodeA, nodeB] = [edge.source, edge.target].sort()
    const key = `${nodeA}|${nodeB}`
    if (!edgePairs.has(key)) {
      edgePairs.set(key, { edgeIds: [], hasForward: false, hasBackward: false, nodeA, nodeB })
    }
    const pair = edgePairs.get(key)!
    pair.edgeIds.push(edge.id)
    // Forward = nodeA→nodeB (alphabetically first to second)
    if (edge.source === nodeA && edge.target === nodeB) {
      pair.hasForward = true
    } else {
      pair.hasBackward = true
    }
  }

  for (const [key, { edgeIds, hasForward, hasBackward, nodeA, nodeB }] of edgePairs) {
    if (hasForward && hasBackward) {
      issues.push({
        id: `ui_bidirectional_${key.replace('|', '_')}`,
        code: 'BIDIRECTIONAL_EDGE',
        severity: 'warning',
        message: `Bidirectional edges between ${nodeA} and ${nodeB}`,
        suggestion: 'Review causal direction',
        source: 'ui',
        affected_edges: edgeIds,
        affected_nodes: [nodeA, nodeB],
      })
    }
  }

  // Check 3: UNIFORM_STRENGTHS
  // All non-structural edges have identical strength_mean (threshold: 5+ edges)
  const nonStructuralEdges = edges.filter(e => {
    // Exclude decision→option edges with strength 1.0 (structural)
    const kind = e.data?.kind?.toLowerCase()
    if (kind === 'structural' || kind === 'decision_option') return false
    const strength = e.data?.strength_mean ?? e.data?.strength ?? e.data?.confidence
    // Also exclude edges without strength values
    return strength !== undefined
  })

  if (nonStructuralEdges.length >= 5) {
    const strengths = nonStructuralEdges.map(e =>
      e.data?.strength_mean ?? e.data?.strength ?? e.data?.confidence ?? 0
    )
    const uniqueStrengths = new Set(strengths.map(s => s.toFixed(3)))
    if (uniqueStrengths.size === 1) {
      const uniformValue = strengths[0]
      issues.push({
        id: `ui_uniform_strengths`,
        code: 'UNIFORM_STRENGTHS',
        severity: 'info',
        message: `All ${nonStructuralEdges.length} causal edges have identical strength ${uniformValue.toFixed(2)}`,
        suggestion: 'May indicate CEE prompt regression',
        source: 'ui',
        affected_edges: nonStructuralEdges.map(e => e.id),
      })
    }
  }

  return issues
}

/**
 * Extract all validation issues (ISL critiques + UI-side checks)
 */
function extractValidation(
  plotResponse: unknown,
  edges: EdgeForValidation[],
  nodes: Array<{ id: string; data?: { label?: string; kind?: string } }>
): ValidationData {
  const islIssues = extractIslCritiques(plotResponse)
  const uiIssues = performUiValidationChecks(edges, nodes)

  const allIssues = [...islIssues, ...uiIssues]

  // Sort by severity: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 }
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const summary: ValidationSummary = {
    errors: allIssues.filter(i => i.severity === 'error').length,
    warnings: allIssues.filter(i => i.severity === 'warning').length,
    info: allIssues.filter(i => i.severity === 'info').length,
  }

  return { summary, issues: allIssues }
}

/**
 * Extract winning option data from PLoT/ISL response
 */
function extractWinningOption(
  plotResponse: unknown,
  ceeResponse: unknown
): WinningOptionData | null {
  if (!plotResponse || typeof plotResponse !== 'object') return null

  const plot = plotResponse as Record<string, unknown>

  // Try multiple paths for ISL options
  const islOptions =
    ((plot.isl as Record<string, unknown>)?.response as Record<string, unknown>)?.options ??
    (plot.response as Record<string, unknown>)?.options ??
    (plot.options as unknown[])

  if (!Array.isArray(islOptions) || islOptions.length === 0) return null

  // Find option with highest win_probability
  interface IslOption {
    id?: string
    win_probability?: number
    label?: string
  }

  const sortedOptions = [...islOptions]
    .filter((o): o is IslOption => typeof o === 'object' && o !== null)
    .filter(o => typeof o.win_probability === 'number')
    .sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))

  if (sortedOptions.length === 0) return null

  const winner = sortedOptions[0]
  const winnerId = winner.id ?? ''
  const winProb = (winner.win_probability ?? 0) * 100

  // Try to get label from CEE response options
  let winnerLabel = winner.label ?? winnerId
  if (ceeResponse && typeof ceeResponse === 'object') {
    const cee = ceeResponse as Record<string, unknown>
    const ceeOptions =
      ((cee.response as Record<string, unknown>)?.graph as Record<string, unknown>)?.options ??
      (cee.graph as Record<string, unknown>)?.options ??
      cee.options
    if (Array.isArray(ceeOptions)) {
      const matchingOption = ceeOptions.find(
        (o): o is { id?: string; label?: string } =>
          typeof o === 'object' && o !== null && (o as { id?: string }).id === winnerId
      )
      if (matchingOption?.label) {
        winnerLabel = matchingOption.label
      }
    }
  }

  const isCloseRace = winProb < 70
  let runnerUp: WinningOptionData['runner_up'] = undefined

  if (isCloseRace && sortedOptions.length > 1) {
    const second = sortedOptions[1]
    const secondId = second.id ?? ''
    let secondLabel = second.label ?? secondId

    // Try to get runner-up label from CEE
    if (ceeResponse && typeof ceeResponse === 'object') {
      const cee = ceeResponse as Record<string, unknown>
      const ceeOptions =
        ((cee.response as Record<string, unknown>)?.graph as Record<string, unknown>)?.options ??
        (cee.graph as Record<string, unknown>)?.options ??
        cee.options
      if (Array.isArray(ceeOptions)) {
        const matchingOption = ceeOptions.find(
          (o): o is { id?: string; label?: string } =>
            typeof o === 'object' && o !== null && (o as { id?: string }).id === secondId
        )
        if (matchingOption?.label) {
          secondLabel = matchingOption.label
        }
      }
    }

    runnerUp = {
      id: secondId,
      label: secondLabel,
      win_probability: (second.win_probability ?? 0) * 100,
    }
  }

  return {
    id: winnerId,
    label: winnerLabel,
    win_probability: winProb,
    is_close_race: isCloseRace,
    runner_up: runnerUp,
  }
}

/**
 * Extract robustness data with stability context
 *
 * Thresholds (matching ISL spec):
 * - stability ≥ 0.85: Robust
 * - stability 0.65-0.84: Moderate
 * - stability < 0.65: Fragile
 */
function extractRobustness(
  gates: GateData[],
  plotResponse: unknown,
  islResponse: unknown
): RobustnessData {
  const robustnessGate = gates.find(g => g.name === 'robustness')

  // Extract stability from responses (check multiple paths)
  let stability: number | null = null

  // First try ISL response directly (most reliable)
  if (islResponse && typeof islResponse === 'object') {
    const isl = islResponse as Record<string, unknown>
    const robustness = isl.robustness as Record<string, unknown> | undefined
    if (robustness && typeof robustness.recommendation_stability === 'number') {
      stability = robustness.recommendation_stability
    }
  }

  // Fallback: try PLoT response paths
  if (stability === null && plotResponse && typeof plotResponse === 'object') {
    const plot = plotResponse as Record<string, unknown>
    // Check multiple paths where ISL robustness data could be nested
    const robustness =
      // downstream_calls.isl.response.robustness (most common for ISL via PLoT)
      (((plot.downstream_calls as Record<string, unknown>)?.isl as Record<string, unknown>)?.response as Record<string, unknown>)?.robustness ??
      ((plot.isl as Record<string, unknown>)?.response as Record<string, unknown>)?.robustness ??
      (plot.response as Record<string, unknown>)?.robustness ??
      plot.robustness
    if (robustness && typeof robustness === 'object') {
      const r = robustness as Record<string, unknown>
      stability = typeof r.recommendation_stability === 'number'
        ? r.recommendation_stability
        : null
    }
  }

  // Format stability percentage with one decimal place
  const stabilityPercent = stability !== null ? (stability * 100).toFixed(1) : null

  if (!robustnessGate || robustnessGate.status === 'pending') {
    return {
      status: 'unavailable',
      stability: null,
      context_label: 'N/A',
      description: 'Robustness check not available',
    }
  }

  // Use stability-based thresholds: ≥0.85 Robust, 0.65-0.84 Moderate, <0.65 Fragile
  if (stability !== null) {
    if (stability >= 0.85) {
      return {
        status: 'pass',
        stability,
        context_label: `Robust (${stabilityPercent}% stable)`,
        description: 'Recommendation holds under assumption changes',
      }
    } else if (stability >= 0.65) {
      return {
        status: 'warn',
        stability,
        context_label: `Moderate (${stabilityPercent}% stable)`,
        description: 'Some sensitivity to assumptions',
      }
    } else {
      return {
        status: 'fail',
        stability,
        context_label: `Fragile (${stabilityPercent}% stable)`,
        description: 'Recommendation may change if assumptions vary',
      }
    }
  }

  // Fallback to gate status when stability not available
  if (robustnessGate.status === 'pass') {
    return {
      status: 'pass',
      stability: null,
      context_label: 'Robust',
      description: 'Recommendation stable',
    }
  }

  if (robustnessGate.status === 'warn') {
    return {
      status: 'warn',
      stability: null,
      context_label: 'Moderate',
      description: 'Recommendation may vary under different assumptions',
    }
  }

  // Fail status
  return {
    status: 'fail',
    stability: null,
    context_label: 'Fragile',
    description: 'Recommendation may change if assumptions vary',
  }
}

/**
 * Extract CEE trace data if available
 */
function extractCeeTrace(ceeResponse: unknown): CeeTraceData | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.ceeTrace as Record<string, unknown>
    ?? cee.trace as Record<string, unknown>
    ?? (cee.meta as Record<string, unknown>)?.trace as Record<string, unknown>

  if (!trace) return null

  return {
    degraded: (trace.degraded as boolean) ?? false,
    reason: trace.reason as string | undefined,
    latency_ms: trace.latency_ms as number | undefined,
    source: trace.source as string | undefined,
  }
}

/**
 * Extract graph corrections from CEE response trace
 */
function extractCorrections(ceeResponse: unknown): GraphCorrection[] {
  if (!ceeResponse || typeof ceeResponse !== 'object') return []

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.trace as Record<string, unknown>
    ?? cee.ceeTrace as Record<string, unknown>
    ?? (cee.meta as Record<string, unknown>)?.trace as Record<string, unknown>

  if (!trace) return []

  const corrections = trace.corrections
  if (!Array.isArray(corrections)) return []

  return corrections.filter((c): c is GraphCorrection => {
    if (!c || typeof c !== 'object') return false
    const corr = c as Record<string, unknown>
    return typeof corr.id === 'string' && typeof corr.type === 'string'
  })
}

/**
 * Extract corrections summary from CEE response trace
 */
function extractCorrectionsSummary(ceeResponse: unknown): CorrectionsSummary | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.trace as Record<string, unknown>
    ?? cee.ceeTrace as Record<string, unknown>
    ?? (cee.meta as Record<string, unknown>)?.trace as Record<string, unknown>

  if (!trace) return null

  const summary = trace.corrections_summary as Record<string, unknown> | undefined
  if (!summary || typeof summary !== 'object') return null

  const byLayer = summary.by_layer as Record<string, number> | undefined
  const total = typeof summary.total === 'number' ? summary.total : 0

  return {
    by_layer: byLayer ?? {},
    total,
  }
}

// =============================================================================
// Enhancement Extraction Functions (Debug Panel V2.1)
// =============================================================================

/**
 * Extract orchestrator status from CEE pipeline trace.
 * Looks at pipeline stages to determine if orchestrator ran and its results.
 */
function extractOrchestratorStatus(ceeResponse: unknown): OrchestratorStatus | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.trace as Record<string, unknown>
    ?? cee.ceeTrace as Record<string, unknown>

  if (!trace) return null

  const pipeline = trace.pipeline as Record<string, unknown> | undefined
  const stages = pipeline?.stages as Record<string, unknown>[] | undefined

  // Look for orchestrator stage in pipeline
  const orchestratorStage = stages?.find(s =>
    (s.name as string)?.toLowerCase().includes('orchestrator') ||
    (s.id as string)?.toLowerCase().includes('orchestrator')
  )

  // Look for validation stage
  const validationStage = stages?.find(s =>
    (s.name as string)?.toLowerCase().includes('validation') ||
    (s.id as string)?.toLowerCase().includes('validation')
  )

  // Look for repair stage
  const repairStage = stages?.find(s =>
    (s.name as string)?.toLowerCase().includes('repair') ||
    (s.id as string)?.toLowerCase().includes('repair')
  )

  // Extract feature flag if available - don't fall back to stage existence
  // Stage existence != feature enabled (stages may always be recorded)
  const featureFlags = trace.feature_flags as Record<string, unknown> | undefined
    ?? pipeline?.feature_flags as Record<string, unknown> | undefined

  const orchestratorEnabled: boolean | null =
    typeof featureFlags?.orchestrator_validation === 'boolean'
      ? featureFlags.orchestrator_validation
      : typeof featureFlags?.orchestrator === 'boolean'
        ? featureFlags.orchestrator
        : null // Unknown - no explicit flag found

  // Determine if orchestrator actually ran
  const orchestratorRan = orchestratorStage !== undefined
    || (trace.orchestrator as Record<string, unknown>)?.ran === true
    || (pipeline?.orchestrator as Record<string, unknown>)?.ran === true

  // Extract validation results - distinguish "passed", "failed", and "unknown/not run"
  // validation_passed is null if validation didn't run or we can't determine status
  const validationErrors = trace.validation_errors as unknown[] | undefined
  const validationWarnings = trace.validation_warnings as unknown[] | undefined

  let validationPassed: boolean | null = null
  if (validationStage?.status === 'success') {
    validationPassed = true
  } else if (validationStage?.status === 'error' || validationStage?.status === 'failed') {
    validationPassed = false
  } else if ((trace.validation as Record<string, unknown>)?.passed === true) {
    validationPassed = true
  } else if ((trace.validation as Record<string, unknown>)?.passed === false) {
    validationPassed = false
  } else if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    // Has errors means validation ran and found issues
    validationPassed = false
  }
  // If none of the above, validationPassed stays null (unknown/not run)

  // Extract repair info
  const repairAttempted = repairStage !== undefined
    || (trace.repair as Record<string, unknown>)?.attempted === true

  let repairSucceeded: boolean | null = null
  if (repairAttempted) {
    if (repairStage?.status === 'success') {
      repairSucceeded = true
    } else if (repairStage?.status === 'error' || repairStage?.status === 'failed') {
      repairSucceeded = false
    } else if ((trace.repair as Record<string, unknown>)?.succeeded === true) {
      repairSucceeded = true
    } else if ((trace.repair as Record<string, unknown>)?.succeeded === false) {
      repairSucceeded = false
    }
  }

  // Count errors and warnings
  const errorCount = Array.isArray(validationErrors) ? validationErrors.length : 0
  const warningCount = Array.isArray(validationWarnings) ? validationWarnings.length : 0

  return {
    enabled: orchestratorEnabled,
    ran: orchestratorRan,
    validation_passed: validationPassed,
    repair_attempted: repairAttempted,
    repair_succeeded: repairSucceeded,
    error_count: errorCount,
    warning_count: warningCount,
  }
}

/**
 * Extract V12.4 category field presence check from CEE response nodes.
 * Checks factors for the category field.
 */
function extractV12_4Checks(ceeResponse: unknown): V12_4Checks | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null

  const cee = ceeResponse as Record<string, unknown>

  // Try multiple paths for nodes
  const nodes =
    (cee.nodes as unknown[]) ??
    ((cee.graph as Record<string, unknown>)?.nodes as unknown[]) ??
    ((cee.response as Record<string, unknown>)?.nodes as unknown[]) ??
    ((cee.response as Record<string, unknown>)?.graph as Record<string, unknown>)?.nodes as unknown[]

  if (!Array.isArray(nodes)) return null

  // Filter to factors only
  const factors = nodes.filter((n): n is Record<string, unknown> => {
    if (!n || typeof n !== 'object') return false
    const node = n as Record<string, unknown>
    const kind = (node.kind ?? node.type ?? (node.data as Record<string, unknown>)?.kind) as string | undefined
    return kind?.toLowerCase() === 'factor'
  })

  if (factors.length === 0) return null

  const nodesWithCategory: string[] = []
  const nodesMissingCategory: string[] = []
  const categoryValues: Record<string, string> = {}

  for (const factor of factors) {
    const id = (factor.id ?? (factor.data as Record<string, unknown>)?.id) as string
    if (!id) continue

    const category = (factor.category ?? (factor.data as Record<string, unknown>)?.category) as string | undefined

    if (category) {
      nodesWithCategory.push(id)
      categoryValues[id] = category
    } else {
      nodesMissingCategory.push(id)
    }
  }

  return {
    category_field_present: nodesWithCategory.length > 0,
    nodes_with_category: nodesWithCategory,
    nodes_missing_category: nodesMissingCategory,
    category_values: categoryValues,
  }
}

/**
 * Helper to extract request ID from payload headers or body
 */
function extractRequestIdFromPayload(payload: TracedPayload | undefined): string | null {
  if (!payload) return null

  // Check response headers first
  if (payload.response?.headers) {
    const headers = payload.response.headers
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase()
      if (lower === 'x-request-id' || lower === 'x-correlation-id' || lower === 'request-id') {
        return value
      }
    }
  }

  // Check request headers
  if (payload.request?.headers) {
    const headers = payload.request.headers
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase()
      if (lower === 'x-request-id' || lower === 'x-correlation-id' || lower === 'request-id') {
        return value
      }
    }
  }

  // Check response body for request_id
  const responseBody = payload.response?.body as Record<string, unknown> | undefined
  if (responseBody) {
    const traceRequestId = (responseBody.trace as Record<string, unknown>)?.request_id
      ?? (responseBody.meta as Record<string, unknown>)?.request_id
      ?? responseBody.request_id
    if (typeof traceRequestId === 'string') return traceRequestId
  }

  // Fallback to payload's internal ID
  return payload.id
}

/**
 * Extract request ID chain from all payloads to track ID propagation.
 */
function extractRequestIdChain(
  payloads: TracedPayload[],
  ceePayload: TracedPayload | undefined,
  plotPayload: TracedPayload | undefined,
  islPayload: TracedPayload | undefined,
  ceeResponse: unknown,
  plotResponse: unknown
): RequestIdChain | null {
  if (payloads.length === 0) return null

  const ceeId = extractRequestIdFromPayload(ceePayload)
  const plotReqId = extractRequestIdFromPayload(plotPayload)
  const islReqId = extractRequestIdFromPayload(islPayload)

  // Extract ID from CEE response trace
  const cee = ceeResponse as Record<string, unknown> | undefined
  const ceeTraceId = cee
    ? ((cee.trace as Record<string, unknown>)?.request_id
      ?? (cee.meta as Record<string, unknown>)?.request_id) as string | undefined
    : undefined

  // Extract ID from PLoT response
  const plot = plotResponse as Record<string, unknown> | undefined
  const plotResponseId = plot
    ? ((plot.trace as Record<string, unknown>)?.request_id
      ?? (plot.meta as Record<string, unknown>)?.request_id) as string | undefined
    : undefined

  // Extract ISL request/response ID from downstream_calls if available
  let islResponseId: string | null = null
  if (plot) {
    const downstream = (plot.downstream_calls as Record<string, unknown>)?.isl
    if (Array.isArray(downstream) && downstream[0]) {
      const islData = downstream[0] as Record<string, unknown>
      islResponseId = (islData.response as Record<string, unknown>)?.request_id as string
        ?? (islData.response as Record<string, unknown>)?.meta?.request_id as string
        ?? null
    }
  }

  // Find the UI-generated ID - prefer CEE (draft-graph) payload's ID as it starts the flow
  // Fallback order: CEE payload > PLoT payload > earliest payload in store
  // Note: payloads are stored most-recent-first, so [length-1] is the earliest
  const uiGenerated = ceePayload?.id ?? plotPayload?.id ?? payloads[payloads.length - 1]?.id ?? null

  // Check if all IDs match
  const allIds = [
    uiGenerated,
    ceeId,
    ceeTraceId,
    plotReqId,
    plotResponseId,
    islReqId,
    islResponseId,
  ].filter((id): id is string => id !== null && id !== undefined)

  const uniqueIds = new Set(allIds)
  const allMatch = uniqueIds.size <= 1 // 0 or 1 unique IDs means all match

  return {
    ui_generated: uiGenerated,
    sent_to_plot: plotReqId,
    cee_trace: ceeTraceId ?? null,
    plot_request: plotReqId,
    plot_response: plotResponseId ?? null,
    isl_request: islReqId,
    isl_response: islResponseId,
    all_match: allMatch,
  }
}

/**
 * Extract feature flags from CEE response or healthz snapshot.
 */
function extractFeatureFlags(ceeResponse: unknown): FeatureFlagsAtRequest | null {
  if (!ceeResponse || typeof ceeResponse !== 'object') return null

  const cee = ceeResponse as Record<string, unknown>
  const trace = cee.trace as Record<string, unknown> | undefined
  const meta = cee.meta as Record<string, unknown> | undefined

  // Try to find feature flags in various locations
  const flags = trace?.feature_flags as Record<string, unknown> | undefined
    ?? meta?.feature_flags as Record<string, unknown> | undefined
    ?? (trace?.pipeline as Record<string, unknown>)?.feature_flags as Record<string, unknown> | undefined
    ?? cee.feature_flags as Record<string, unknown> | undefined

  if (!flags) return null

  return {
    orchestrator_validation: flags.orchestrator_validation as boolean ?? flags.orchestrator as boolean ?? null,
    causal_validation: flags.causal_validation as boolean ?? null,
    clarifier: flags.clarifier as boolean ?? null,
    preflight: flags.preflight as boolean ?? null,
  }
}

/**
 * Extract timestamps per service from payloads.
 */
function extractServiceTiming(
  ceePayload: TracedPayload | undefined,
  plotPayload: TracedPayload | undefined,
  islPayload: TracedPayload | undefined
): ServiceTiming | null {
  // If no payloads, return null
  if (!ceePayload && !plotPayload && !islPayload) return null

  const toIso = (ts: number | undefined) =>
    ts ? new Date(ts).toISOString() : null

  return {
    request_start: toIso(ceePayload?.timestamp ?? plotPayload?.timestamp),
    cee_response: ceePayload?.completed && ceePayload.duration
      ? toIso(ceePayload.timestamp + ceePayload.duration)
      : null,
    plot_request: toIso(plotPayload?.timestamp),
    plot_response: plotPayload?.completed && plotPayload.duration
      ? toIso(plotPayload.timestamp + plotPayload.duration)
      : null,
    isl_request: toIso(islPayload?.timestamp),
    isl_response: islPayload?.completed && islPayload.duration
      ? toIso(islPayload.timestamp + islPayload.duration)
      : null,
    bundle_created: new Date().toISOString(),
  }
}

/**
 * Extract schema versions from payloads for consistency check.
 */
function extractSchemaVersions(
  ceeRequest: unknown,
  ceeResponse: unknown,
  plotRequest: unknown,
  plotResponse: unknown
): SchemaVersions | null {
  const extractVersion = (payload: unknown, paths: string[][]): string | null => {
    if (!payload || typeof payload !== 'object') return null

    for (const path of paths) {
      let current: unknown = payload
      for (const key of path) {
        if (!current || typeof current !== 'object') break
        current = (current as Record<string, unknown>)[key]
      }
      if (typeof current === 'string') return current
      if (typeof current === 'number') return `v${current}`
    }
    return null
  }

  const ceeReqVersion = extractVersion(ceeRequest, [
    ['schema_version'],
    ['version'],
    ['meta', 'schema_version'],
  ])

  const ceeResVersion = extractVersion(ceeResponse, [
    ['schema_version'],
    ['version'],
    ['trace', 'schema_version'],
    ['meta', 'schema_version'],
  ])

  const plotReqVersion = extractVersion(plotRequest, [
    ['schema_version'],
    ['version'],
    ['meta', 'schema_version'],
  ])

  const plotResVersion = extractVersion(plotResponse, [
    ['schema_version'],
    ['version'],
    ['trace', 'schema_version'],
    ['meta', 'schema_version'],
  ])

  // If no versions found, return null
  if (!ceeReqVersion && !ceeResVersion && !plotReqVersion && !plotResVersion) {
    return null
  }

  // Check consistency - versions should match within request/response pairs
  const versions = [ceeReqVersion, ceeResVersion, plotReqVersion, plotResVersion].filter(Boolean)
  const uniqueVersions = new Set(versions)
  const consistent = uniqueVersions.size <= 1

  return {
    cee_request: ceeReqVersion,
    cee_response: ceeResVersion,
    plot_request: plotReqVersion,
    plot_response: plotResVersion,
    consistent,
  }
}

/**
 * Helper to extract request ID from payload headers.
 */
function extractIdFromHeaders(payload: TracedPayload): string | null {
  if (!payload.response?.headers) return null
  const headers = payload.response.headers
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (lower === 'x-request-id' || lower === 'x-correlation-id' || lower === 'request-id') {
      return value
    }
  }
  return null
}

/**
 * Check if a payload is for the draft-graph endpoint.
 */
function isDraftGraphEndpoint(payload: TracedPayload): boolean {
  const endpoint = payload.endpoint?.toLowerCase() ?? ''
  return endpoint.includes('draft-graph') || endpoint.includes('draft-flows')
}

/**
 * Extract a correlation/request ID from response headers or payload.
 * PRIORITY:
 * 1. CEE draft-graph request ID (the main analysis flow)
 * 2. Any CEE request ID (fallback if endpoint not identified)
 * 3. PLoT request ID
 * 4. Any other payload
 *
 * This ensures the debug bundle captures the correct request ID for the main analysis flow,
 * even if multiple CEE calls exist (e.g., healthz, probe, auxiliary calls).
 *
 * Looks for common header names: x-request-id, x-correlation-id, request-id.
 * Falls back to internal trace id if no server ID found.
 */
function extractTraceId(payloads: TracedPayload[]): string | null {
  // Priority 1: Find CEE draft-graph request specifically
  const ceeDraftGraphPayload = payloads.find(
    p => p.service === 'CEE' && p.completed && isDraftGraphEndpoint(p)
  )
  if (ceeDraftGraphPayload) {
    const headerId = extractIdFromHeaders(ceeDraftGraphPayload)
    if (headerId) return headerId
    return ceeDraftGraphPayload.id
  }

  // Priority 2: Any CEE request (if draft-graph not found by endpoint)
  const ceePayload = payloads.find(p => p.service === 'CEE' && p.completed)
  if (ceePayload) {
    const headerId = extractIdFromHeaders(ceePayload)
    if (headerId) return headerId
    return ceePayload.id
  }

  // Priority 3: Try PLoT request ID (if CEE not available)
  const plotPayload = payloads.find(p => p.service === 'PLoT' && p.completed)
  if (plotPayload) {
    const headerId = extractIdFromHeaders(plotPayload)
    if (headerId) return headerId
    return plotPayload.id
  }

  // Priority 3: Check all payloads (original behaviour, but now as fallback)
  for (const payload of payloads) {
    if (!payload.response?.headers) continue

    const headers = payload.response.headers
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase()
      if (lower === 'x-request-id' || lower === 'x-correlation-id' || lower === 'request-id') {
        return value
      }
    }
  }

  // Final fallback: use first payload's internal trace id
  return payloads[0]?.id ?? null
}

// =============================================================================
// Hook
// =============================================================================

export function useDebugData(): DebugData {
  // Canvas store data
  const ceePipelineTrace = useCanvasStore((s) => s.ceePipelineTrace)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const runMeta = useCanvasStore((s) => s.runMeta)

  // Payload trace store data
  const tracedPayloads = usePayloadTraceStore((s) => s.payloads)

  // Gate store data
  const gatesMap = useGateStore((s) => s.gates)

  return useMemo(() => {
    // Find service payloads (prefer completed over in-flight)
    const ceePayload = findBestPayload(tracedPayloads, 'CEE')
    const plotPayload = findBestPayload(tracedPayloads, 'PLoT')
    const islPayload = findBestPayload(tracedPayloads, 'ISL')

    // Extract ISL from PLoT downstream_calls if not found directly
    const islFromPlot = plotPayload?.response?.body
      ? extractIslFromPlotResponse(plotPayload.response)
      : null

    // Determine ISL data source
    let islDataSource: 'downstream_calls' | 'direct_capture' | 'none' = 'none'

    // Build ISL service call data from both sources
    const directIslCall = islPayload ? payloadToServiceCall(islPayload) : null
    const downstreamIslCall: ServiceCallData | null = islFromPlot ? {
      name: 'ISL',
      status: islFromPlot.status_code,
      success: islFromPlot.success,
      duration_ms: islFromPlot.latency_ms,
      endpoint: islFromPlot.endpoint,
      error: islFromPlot.error,
      request: islFromPlot.request,
      response: islFromPlot.response,
    } : null

    // Priority: downstream_calls (actual ISL call via PLoT) > direct_capture (probe/validation endpoint)
    // This ensures we show the real ISL result, not any separate health check or probe
    let islServiceCall: ServiceCallData | null = null
    if (downstreamIslCall?.success) {
      // Prefer successful downstream_calls data (this is the actual analysis ISL call)
      islServiceCall = downstreamIslCall
      islDataSource = 'downstream_calls'
    } else if (directIslCall?.success) {
      // Fall back to successful direct capture
      islServiceCall = directIslCall
      islDataSource = 'direct_capture'
    } else if (downstreamIslCall) {
      // Show failed downstream_calls (actual ISL error)
      islServiceCall = downstreamIslCall
      islDataSource = 'downstream_calls'
    } else if (directIslCall) {
      // Show failed direct capture as last resort
      islServiceCall = directIslCall
      islDataSource = 'direct_capture'
    }

    // Determine overall status
    const hasErrors = tracedPayloads.some((p) => p.error || (p.status && p.status >= 400))
    const hasPending = tracedPayloads.some((p) => !p.completed)
    const plotAnalysisStatus = (plotPayload?.response?.body as Record<string, unknown> | undefined)?.analysis_status
    const overallStatus: 'success' | 'error' | 'pending' = plotAnalysisStatus === 'computed'
      ? 'success'
      : hasErrors
        ? 'error'
        : hasPending
          ? 'pending'
          : 'success'

    // Calculate total duration (sum of all service calls)
    const totalDuration = tracedPayloads.reduce((sum, p) => sum + (p.duration ?? 0), 0) || null

    // Extract trace ID (prefers server x-request-id header, falls back to internal id)
    const traceId = extractTraceId(tracedPayloads)

    // Extract pipeline data
    const pipelineSource = ceePayload?.response?.body ?? ceePipelineTrace
    const pipelineTrace = (pipelineSource as Record<string, unknown>)?.pipeline_trace
      ?? (pipelineSource as Record<string, unknown>)?.trace?.pipeline
      ?? pipelineSource

    const nodeCounts = countNodesByKind(nodes)

    // Build gates array
    const gates: GateData[] = Object.entries(gatesMap).map(([name, data]) => ({
      name: name as GateName,
      status: data.status,
      message: data.message,
    }))

    // Check if we have any data
    const hasData = tracedPayloads.length > 0 || !!ceePipelineTrace || nodes.length > 0

    // Build services object
    const services = {
      cee: payloadToServiceCall(ceePayload),
      plot: payloadToServiceCall(plotPayload),
      isl: islServiceCall,
    }

    // Build payloads bundle
    const payloadBundle: PayloadBundle = {
      cee_request: ceePayload?.request?.body,
      cee_response: ceePayload?.response?.body,
      plot_request: plotPayload?.request?.body,
      plot_response: plotPayload?.response?.body,
      isl_request: islServiceCall?.request,
      isl_response: islServiceCall?.response,
    }

    // Extract first error for error banner
    const error = extractFirstError(services, payloadBundle)

    // Extract build versions
    const builds = extractBuildVersions(
      payloadBundle.cee_response,
      payloadBundle.plot_response,
      payloadBundle.isl_response
    )

    // Extract diagnostic checks
    const diagnostics = extractDiagnosticChecks(
      payloadBundle.plot_response,
      payloadBundle.cee_response,
      islDataSource
    )

    // Extract CEE trace data
    const ceeTrace = extractCeeTrace(payloadBundle.cee_response)

    // Extract graph corrections
    const corrections = extractCorrections(payloadBundle.cee_response)
    const correctionsSummary = extractCorrectionsSummary(payloadBundle.cee_response)

    // Extract validation issues (ISL critiques + UI-side checks)
    const validation = extractValidation(
      payloadBundle.plot_response,
      edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data as EdgeForValidation['data'],
      })),
      nodes.map(n => ({
        id: n.id,
        data: n.data as { label?: string; kind?: string },
      }))
    )

    // Extract winning option data
    const winningOption = extractWinningOption(
      payloadBundle.plot_response,
      payloadBundle.cee_response
    )

    // Extract robustness data with stability context
    const robustness = extractRobustness(gates, payloadBundle.plot_response, payloadBundle.isl_response)

    // Enhancement extractions (Debug Panel V2.1)
    const orchestrator = extractOrchestratorStatus(payloadBundle.cee_response)
    const v12_4_checks = extractV12_4Checks(payloadBundle.cee_response)
    const request_id_chain = extractRequestIdChain(
      tracedPayloads,
      ceePayload,
      plotPayload,
      islPayload,
      payloadBundle.cee_response,
      payloadBundle.plot_response
    )
    const feature_flags_at_request = extractFeatureFlags(payloadBundle.cee_response)
    const timing = extractServiceTiming(ceePayload, plotPayload, islPayload)
    const schema_versions = extractSchemaVersions(
      payloadBundle.cee_request,
      payloadBundle.cee_response,
      payloadBundle.plot_request,
      payloadBundle.plot_response
    )

    return {
      overall: {
        status: overallStatus,
        total_duration_ms: totalDuration,
        request_id: traceId,
      },
      services,
      error,
      builds,
      diagnostics,
      ceeTrace,
      corrections,
      correctionsSummary,
      pipeline: {
        status: overallStatus,
        total_duration_ms: typeof (pipelineTrace as Record<string, unknown>)?.total_duration_ms === 'number'
          ? (pipelineTrace as Record<string, unknown>).total_duration_ms as number
          : undefined,
        stages: extractPipelineStages(pipelineTrace),
        llm_metadata: extractLlmMetadata(pipelineTrace, payloadBundle.cee_response),
        llm_raw: extractLlmRaw(payloadBundle.cee_response),
        node_extraction: extractNodeExtraction(pipelineTrace),
        connectivity: {
          decision_count: nodeCounts.decision,
          option_count: nodeCounts.option,
          goal_count: nodeCounts.goal,
          factor_count: nodeCounts.factor,
          edge_count: edges.length,
        },
      },
      payloads: payloadBundle,
      gates,
      validation,
      winningOption,
      robustness,
      hasData,

      // Enhancement fields (Debug Panel V2.1)
      orchestrator,
      v12_4_checks,
      request_id_chain,
      feature_flags_at_request,
      timing,
      schema_versions,
    }
  }, [ceePipelineTrace, nodes, edges, runMeta, tracedPayloads, gatesMap])
}

export default useDebugData
