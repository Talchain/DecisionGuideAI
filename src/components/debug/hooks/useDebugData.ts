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
  prompt_version?: string
  token_usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
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
  /** Source of ISL data */
  isl_data_source: 'downstream_calls' | 'direct_capture' | 'none'
  /** Whether CEE trace is present */
  cee_trace_present: boolean
  /** Whether CEE is in degraded mode */
  cee_degraded: boolean
  /** CEE degraded reason if applicable */
  cee_degraded_reason?: string
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

  /** Pipeline processing data */
  pipeline: PipelineData

  /** Raw payloads for inspection */
  payloads: PayloadBundle

  /** Gate statuses */
  gates: GateData[]

  /** Whether any data is available */
  hasData: boolean
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract ISL data from PLoT response downstream_calls
 */
function extractIslFromPlotResponse(plotResponse: unknown): IslDownstreamCall | null {
  if (!plotResponse || typeof plotResponse !== 'object') return null

  const response = plotResponse as Record<string, unknown>

  // Try body.downstream_calls.isl
  const body = response.body as Record<string, unknown> | undefined
  if (body?.downstream_calls && typeof body.downstream_calls === 'object') {
    const downstream = body.downstream_calls as Record<string, unknown>
    if (downstream.isl && typeof downstream.isl === 'object') {
      return downstream.isl as IslDownstreamCall
    }
  }

  // Try body.trace.downstream_calls.isl
  const trace = body?.trace as Record<string, unknown> | undefined
  if (trace?.downstream_calls && typeof trace.downstream_calls === 'object') {
    const downstream = trace.downstream_calls as Record<string, unknown>
    if (downstream.isl && typeof downstream.isl === 'object') {
      return downstream.isl as IslDownstreamCall
    }
  }

  // Try top-level downstream_calls.isl
  if (response.downstream_calls && typeof response.downstream_calls === 'object') {
    const downstream = response.downstream_calls as Record<string, unknown>
    if (downstream.isl && typeof downstream.isl === 'object') {
      return downstream.isl as IslDownstreamCall
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
 * Extract LLM metadata from pipeline trace
 */
function extractLlmMetadata(pipeline: unknown): LlmMetadataData | undefined {
  if (!pipeline || typeof pipeline !== 'object') return undefined

  const p = pipeline as Record<string, unknown>

  // Try llm_metadata directly
  if (p.llm_metadata && typeof p.llm_metadata === 'object') {
    return p.llm_metadata as LlmMetadataData
  }

  // Try llm_calls[0] fallback
  if (Array.isArray(p.llm_calls) && p.llm_calls.length > 0) {
    const firstCall = p.llm_calls[0] as Record<string, unknown>
    return {
      model: firstCall.model as string | undefined,
      token_usage: {
        prompt_tokens: firstCall.prompt_tokens as number | undefined,
        completion_tokens: firstCall.completion_tokens as number | undefined,
        total_tokens: ((firstCall.prompt_tokens as number) ?? 0) + ((firstCall.completion_tokens as number) ?? 0),
      },
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
    cee: (cee?.trace as Record<string, unknown>)?.engine?.build as string
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

  if (p.downstream_calls) return 'response.downstream_calls'
  if ((p.trace as Record<string, unknown>)?.downstream_calls) return 'response.trace.downstream_calls'
  if ((p.data as Record<string, unknown>)?.downstream_calls) return 'response.data.downstream_calls'

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

  const hasDownstreamCalls = !!(
    plot?.downstream_calls ||
    (plot?.trace as Record<string, unknown>)?.downstream_calls ||
    (plot?.data as Record<string, unknown>)?.downstream_calls
  )

  const ceeTrace = cee?.ceeTrace as Record<string, unknown>
    ?? cee?.trace as Record<string, unknown>
    ?? (cee?.meta as Record<string, unknown>)?.trace as Record<string, unknown>

  return {
    plot_has_downstream_calls: hasDownstreamCalls,
    downstream_calls_path_found: findDownstreamCallsPath(plotResponse),
    isl_data_source: islDataSource,
    cee_trace_present: !!ceeTrace,
    cee_degraded: (ceeTrace?.degraded as boolean) ?? false,
    cee_degraded_reason: ceeTrace?.reason as string | undefined,
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
 * Extract a correlation/request ID from response headers or payload.
 * Looks for common header names: x-request-id, x-correlation-id, request-id.
 * Falls back to internal trace id if no server ID found.
 */
function extractTraceId(payloads: TracedPayload[]): string | null {
  // Check each payload's response headers for a server-provided ID
  for (const payload of payloads) {
    if (!payload.response?.headers) continue

    const headers = payload.response.headers
    // Check common header names (case-insensitive)
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase()
      if (lower === 'x-request-id' || lower === 'x-correlation-id' || lower === 'request-id') {
        return value
      }
    }
  }

  // Fallback: use internal payload trace id
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

    // Diagnostic logging for ISL extraction
    const plotResponseBody = plotPayload?.response?.body
    console.log('[useDebugData] Extracting ISL data...')
    console.log('[useDebugData] plotResponse keys:', plotResponseBody ? Object.keys(plotResponseBody as object) : [])

    // Extract ISL from PLoT downstream_calls if not found directly
    const islFromPlot = plotPayload?.response?.body
      ? extractIslFromPlotResponse(plotPayload.response)
      : null

    console.log('[useDebugData] downstream_calls found:', !!islFromPlot)

    if (islFromPlot) {
      console.log('[useDebugData] ISL from downstream_calls:', {
        endpoint: islFromPlot.endpoint,
        success: islFromPlot.success,
        status: islFromPlot.status_code,
      })
    }

    // Determine ISL data source
    let islDataSource: 'downstream_calls' | 'direct_capture' | 'none' = 'none'

    // Build ISL service call data
    let islServiceCall: ServiceCallData | null = null
    if (islPayload) {
      islServiceCall = payloadToServiceCall(islPayload)
      islDataSource = 'direct_capture'
      console.log('[useDebugData] ISL from direct capture')
    } else if (islFromPlot) {
      islServiceCall = {
        name: 'ISL',
        status: islFromPlot.status_code,
        success: islFromPlot.success,
        duration_ms: islFromPlot.latency_ms,
        endpoint: islFromPlot.endpoint,
        error: islFromPlot.error,
        request: islFromPlot.request,
        response: islFromPlot.response,
      }
      islDataSource = 'downstream_calls'
    }

    // Determine overall status
    const hasErrors = tracedPayloads.some((p) => p.error || (p.status && p.status >= 400))
    const hasPending = tracedPayloads.some((p) => !p.completed)
    const overallStatus: 'success' | 'error' | 'pending' = hasErrors
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
      pipeline: {
        status: overallStatus,
        total_duration_ms: typeof (pipelineTrace as Record<string, unknown>)?.total_duration_ms === 'number'
          ? (pipelineTrace as Record<string, unknown>).total_duration_ms as number
          : undefined,
        stages: extractPipelineStages(pipelineTrace),
        llm_metadata: extractLlmMetadata(pipelineTrace),
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
      hasData,
    }
  }, [ceePipelineTrace, nodes, edges, runMeta, tracedPayloads, gatesMap])
}

export default useDebugData
