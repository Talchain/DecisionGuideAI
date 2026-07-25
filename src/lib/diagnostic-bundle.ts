/**
 * Diagnostic Bundle Export
 *
 * Creates a privacy-safe diagnostic bundle for debugging and support.
 * Contains: versions, gate statuses, request traces, session metadata.
 *
 * Privacy guarantees:
 * - No PII (user IDs, emails, names)
 * - No raw payloads (only hashes)
 * - No auth tokens or credentials
 * - Timestamps are included for correlation
 *
 * @example
 * ```typescript
 * import { exportDiagnosticBundle, createDiagnosticBundle } from '@/lib/diagnostic-bundle'
 *
 * // Trigger download
 * await exportDiagnosticBundle()
 *
 * // Or get bundle data directly
 * const bundle = createDiagnosticBundle()
 * console.log(bundle)
 * ```
 */

import { getRecentTraces, getPendingTraces, getFailedTraces, getInteractionChains, type RequestTrace, type DownstreamCall, type InteractionChain } from './debug-state'
import { useGateStore, ALL_GATES, type GateName } from './gate-state'
import { getClientBuild, getVersionInfo } from './version-cache'
import { getAllServiceHealthArray, type ServiceHealthInfo } from './service-health'
import type { CeePipelineTrace } from '../adapters/cee/types'
import type { ErrorDetail } from '../types/cee'

/**
 * Sanitized downstream call for export
 */
interface SanitizedDownstreamCall {
  service: string
  status: number
  elapsedMs: number
  payloadHash: string
  responseHash?: string
}

/**
 * Sanitized trace received for export
 */
interface SanitizedTraceReceived {
  requestId: string
  payloadHash: string
  verified: boolean
}

/**
 * Sanitized request trace for export
 * (removes any potentially sensitive fields)
 */
interface SanitizedTrace {
  requestId: string
  endpoint: string
  method: string
  payloadHash: string
  timestamp: string
  status?: number
  responseHash?: string
  service?: string
  serviceBuild?: string
  elapsedMs?: number
  completed?: boolean
  /** Downstream service calls (if any) */
  downstream?: SanitizedDownstreamCall[]
  /** Trace verification data (if present) */
  traceReceived?: SanitizedTraceReceived
  // Note: we don't include rawError or upstreamHost for privacy
}

/**
 * Gate snapshot for export
 */
interface GateSnapshot {
  gate: GateName
  status: string
  updatedAt: string
  message?: string
  service?: string
}

/**
 * Service health info
 */
interface ServiceHealth {
  name: string
  build?: string
  status: 'unknown' | 'healthy' | 'degraded' | 'down'
  lastSeen?: string
}

/**
 * Browser/environment info (non-identifying)
 */
interface EnvironmentInfo {
  userAgent: string
  language: string
  platform: string
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
  timezone: string
  online: boolean
}

/**
 * Integration verification summary
 */
interface IntegrationVerification {
  /** Overall integration status */
  ok: boolean
  /** Number of traces with downstream calls */
  tracesWithDownstream: number
  /** Number of verified trace chains */
  verifiedChains: number
  /** Number of failed downstream calls */
  failedDownstreamCalls: number
  /** Issues detected */
  issues: string[]
}

interface SanitizedInteractionChain {
  chainId: string
  parentChainId?: string | null
  triggerSurface: string
  sourceSurface: string
  initiatedBy: 'user' | 'automatic'
  visibleTextSubmitted: string | null
  submittedText: string | null
  startedAt: string
  scenarioId: string | null
  stagePill: string | null
  requestIds: string[]
  requests: InteractionChain['requests']
  timeline: InteractionChain['timeline']
  stateBefore?: InteractionChain['stateBefore']
  stateAfter?: InteractionChain['stateAfter']
  childChainIds: string[]
}

/**
 * Full diagnostic bundle structure
 */
export interface DiagnosticBundle {
  /** Bundle format version */
  version: '1.0'
  /** Bundle creation timestamp (ISO 8601) */
  createdAt: string
  /** Client application info */
  client: {
    build: string
    branch?: string
    commit?: string
    builtAt?: string
    environment: string
  }
  /** Environment info (non-identifying) */
  environment: EnvironmentInfo
  /** Stage gate statuses */
  gates: GateSnapshot[]
  /** Recent request traces (sanitized) */
  traces: {
    recent: SanitizedTrace[]
    pending: SanitizedTrace[]
    failed: SanitizedTrace[]
  }
  /** Service health info (from response headers) */
  services: ServiceHealth[]
  /** Integration verification summary */
  integration: IntegrationVerification
  /** Compact UI repro chains */
  interactions: SanitizedInteractionChain[]
  /** Session metadata */
  session: {
    durationMs: number
    pageUrl: string
    referrer: string
  }
}

/** Session start time for duration calculation */
const sessionStart = Date.now()

/**
 * Sanitize downstream calls for export
 */
function sanitizeDownstreamCalls(calls?: DownstreamCall[]): SanitizedDownstreamCall[] | undefined {
  if (!calls || calls.length === 0) return undefined
  return calls.map((call) => ({
    service: call.service,
    status: call.status,
    elapsedMs: call.elapsedMs,
    payloadHash: call.payloadHash,
    responseHash: call.responseHash,
  }))
}

/**
 * Sanitize trace received for export
 */
function sanitizeTraceReceived(trace: RequestTrace): SanitizedTraceReceived | undefined {
  if (!trace.traceReceived) return undefined
  return {
    requestId: trace.traceReceived.requestId,
    payloadHash: trace.traceReceived.payloadHash,
    verified: trace.traceReceived.payloadHash === trace.payloadHash,
  }
}

/**
 * Sanitize a request trace for export
 * Removes potentially sensitive fields
 */
function sanitizeTrace(trace: RequestTrace): SanitizedTrace {
  return {
    requestId: trace.requestId,
    endpoint: trace.endpoint,
    method: trace.method,
    payloadHash: trace.payloadHash,
    timestamp: trace.timestamp,
    status: trace.status,
    responseHash: trace.responseHash,
    service: trace.service,
    serviceBuild: trace.serviceBuild,
    elapsedMs: trace.elapsedMs,
    completed: trace.completed,
    downstream: sanitizeDownstreamCalls(trace.downstream),
    traceReceived: sanitizeTraceReceived(trace),
    // Intentionally omit: error (may contain stack traces), upstreamHost (internal infra)
  }
}

function sanitizeInteractionChain(chain: InteractionChain): SanitizedInteractionChain {
  return {
    chainId: chain.chainId,
    parentChainId: chain.parentChainId,
    triggerSurface: chain.triggerSurface,
    sourceSurface: chain.sourceSurface,
    initiatedBy: chain.initiatedBy,
    visibleTextSubmitted: chain.visibleTextSubmitted,
    submittedText: chain.submittedText,
    startedAt: chain.startedAt,
    scenarioId: chain.scenarioId,
    stagePill: chain.stagePill,
    requestIds: [...chain.requestIds],
    requests: chain.requests.map((request) => ({ ...request })),
    timeline: chain.timeline.map((event) => ({ ...event })),
    stateBefore: chain.stateBefore ? { ...chain.stateBefore } : undefined,
    stateAfter: chain.stateAfter ? { ...chain.stateAfter } : undefined,
    childChainIds: [...chain.childChainIds],
  }
}

/**
 * Get environment info (non-identifying)
 */
function getEnvironmentInfo(): EnvironmentInfo {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
  }
}

/**
 * Extract unique services from traces
 */
function extractServicesFromTraces(traces: RequestTrace[]): Map<string, ServiceHealth> {
  const serviceMap = new Map<string, ServiceHealth>()

  for (const trace of traces) {
    if (trace.service && !serviceMap.has(trace.service)) {
      serviceMap.set(trace.service, {
        name: trace.service,
        build: trace.serviceBuild,
        status: trace.completed && trace.status && trace.status >= 200 && trace.status < 300 ? 'healthy' : 'unknown',
        lastSeen: trace.responseTimestamp || trace.timestamp,
      })
    }
  }

  return serviceMap
}

/**
 * Merge health endpoint data with trace-extracted services
 */
function mergeServiceHealth(
  traceServices: Map<string, ServiceHealth>,
  healthServices: ServiceHealthInfo[]
): ServiceHealth[] {
  const merged = new Map(traceServices)

  for (const healthInfo of healthServices) {
    const existing = merged.get(healthInfo.name)
    if (existing) {
      // Merge: prefer health endpoint data for status/version
      merged.set(healthInfo.name, {
        ...existing,
        build: healthInfo.version || existing.build,
        status: healthInfo.status,
      })
    } else {
      // Add new service from health endpoint
      merged.set(healthInfo.name, {
        name: healthInfo.name,
        build: healthInfo.version,
        status: healthInfo.status,
        lastSeen: new Date().toISOString(),
      })
    }
  }

  // Sort by name for consistency
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Compute integration verification summary from traces
 */
function computeIntegrationVerification(traces: RequestTrace[]): IntegrationVerification {
  const issues: string[] = []
  let tracesWithDownstream = 0
  let verifiedChains = 0
  let failedDownstreamCalls = 0

  for (const trace of traces) {
    // Count traces with downstream calls
    if (trace.downstream && trace.downstream.length > 0) {
      tracesWithDownstream++

      // Count failed downstream calls
      for (const call of trace.downstream) {
        if (call.status >= 400) {
          failedDownstreamCalls++
          issues.push(`${call.service} returned ${call.status} for ${trace.endpoint}`)
        }
      }
    }

    // Check trace verification
    if (trace.traceReceived) {
      if (trace.traceReceived.payloadHash === trace.payloadHash) {
        verifiedChains++
      } else {
        issues.push(`Hash mismatch: sent ${trace.payloadHash?.slice(0, 6)}, received ${trace.traceReceived.payloadHash?.slice(0, 6)}`)
      }
    }
  }

  return {
    ok: issues.length === 0,
    tracesWithDownstream,
    verifiedChains,
    failedDownstreamCalls,
    issues: issues.slice(0, 10), // Limit to 10 issues
  }
}

/**
 * Create a diagnostic bundle with current state
 */
export async function createDiagnosticBundle(): Promise<DiagnosticBundle> {
  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()
  const gateState = useGateStore.getState()

  const recentTraces = getRecentTraces()
  const pendingTraces = getPendingTraces()
  const failedTraces = getFailedTraces()
  const interactionChains = getInteractionChains()

  // Build gate snapshots
  const gates: GateSnapshot[] = ALL_GATES.map((gate) => {
    const record = gateState.gates[gate]
    return {
      gate,
      status: record.status,
      updatedAt: record.updatedAt,
      message: record.message,
      service: record.service,
    }
  })

  // Extract service health from traces and health endpoints
  const traceServices = extractServicesFromTraces(recentTraces)
  let healthServices: ServiceHealthInfo[] = []
  try {
    healthServices = await getAllServiceHealthArray()
  } catch (err) {
    // Graceful degradation - continue with trace data only
    if (import.meta.env.DEV) {
      console.warn('[diagnostic-bundle] Failed to fetch service health:', err)
    }
  }
  const services = mergeServiceHealth(traceServices, healthServices)

  // Sanitize page URL (remove query params that might contain sensitive data)
  const pageUrl = new URL(window.location.href)
  // Keep only non-sensitive query params
  const safeParams = ['diag', 'view', 'tab']
  for (const key of Array.from(pageUrl.searchParams.keys())) {
    if (!safeParams.includes(key)) {
      pageUrl.searchParams.delete(key)
    }
  }

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    client: {
      build: clientBuild,
      branch: versionInfo?.branch,
      commit: versionInfo?.commit,
      builtAt: versionInfo?.timestamp,
      environment: String(import.meta.env.VITE_APP_ENV || 'development'),
    },
    environment: getEnvironmentInfo(),
    gates,
    traces: {
      recent: recentTraces.map(sanitizeTrace),
      pending: pendingTraces.map(sanitizeTrace),
      failed: failedTraces.map(sanitizeTrace),
    },
    services,
    integration: computeIntegrationVerification(recentTraces),
    interactions: interactionChains.map(sanitizeInteractionChain),
    session: {
      durationMs: Date.now() - sessionStart,
      pageUrl: pageUrl.pathname + pageUrl.search,
      referrer: document.referrer ? new URL(document.referrer).hostname : '',
    },
  }
}

/**
 * Generate filename for diagnostic bundle
 * Format: diag-{build}-{timestamp}.json
 */
function generateFilename(): string {
  const build = getClientBuild()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `diag-${build}-${timestamp}.json`
}

/**
 * Export diagnostic bundle as downloadable JSON file
 */
export async function exportDiagnosticBundle(): Promise<void> {
  const bundle = await createDiagnosticBundle()
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const filename = generateFilename()

  // Create temporary link and trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL
  URL.revokeObjectURL(url)

  // Log export for debugging
  if (import.meta.env.DEV) {
    console.warn('[diagnostic-bundle] Exported:', filename)
  }
}

/**
 * Get diagnostic bundle as string (for copy/paste)
 */
export async function getDiagnosticBundleString(): Promise<string> {
  const bundle = await createDiagnosticBundle()
  return JSON.stringify(bundle, null, 2)
}

// =============================================================================
// Merged Debug Export (Task 1: Combined diagnostic + contract-trace + anomalies)
// =============================================================================

/**
 * Merged debug export structure
 * Combines all available debug data into a single file
 */
/**
 * Edge value summary for tracing transformation issues
 * Captures unique values at each stage: CEE → Canvas → PLoT
 */
export interface EdgeValueSummary {
  /** CEE pipeline output (from trace.final_graph) */
  cee_out: {
    total: number
    unique_strength_mean: number[]
    unique_exists_probability: number[]
    all_default: boolean
  } | null
  /** Canvas store state */
  canvas: {
    total: number
    unique_weights: number[]
    unique_belief_exists: number[]
    all_default: boolean
  } | null
  /** PLoT request (from contract trace) */
  plot_in: {
    total: number
    unique_strength_mean: number[]
    unique_exists_probability: number[]
    all_default: boolean
  } | null
  /** Summary: where values diverge */
  divergence: string | null
}

/**
 * Structured error data extracted from CEE error responses.
 * Captures trace/provenance even when the main pipeline fails.
 */
export interface CeeErrorResponse {
  /** HTTP status code */
  httpStatus: number
  /** Error message from response body */
  message?: string
  /** Error code from response body */
  code?: string
  /** CEE request_id from trace (CEE-generated, distinct from UI correlationId) */
  cee_request_id?: string
  /** Pipeline provenance (version/commit of CEE that generated the error) */
  cee_provenance?: {
    version?: string
    commit?: string
    [key: string]: unknown
  }
  /** Pipeline checkpoints reached before failure */
  checkpoints?: unknown[]
  /** Pipeline status at time of error */
  pipeline_status?: string
  /** Raw error body keys (for debugging missing fields) */
  body_keys?: string[]
}

/**
 * Request ID labels for cross-service correlation.
 * Multiple IDs may exist; all are included with clear labels.
 */
export interface RequestIdLabels {
  /** UI-generated correlationId — sent to CEE via x-correlation-id header.
   *  Same as boundary log request_id and payload trace id. */
  ui_correlation_id: string | null
  /** CEE-internal request_id — from error/success response trace.request_id.
   *  Generated by CEE, different from ui_correlation_id. */
  cee_request_id: string | null
  /** Whether both IDs are present and can be correlated */
  cross_service_correlation: boolean
}

export interface MergedDebugExport {
  meta: {
    timestamp: string
    environment: string
    uiBuild: string
    branch?: string
    /** Primary request ID for this bundle (UI correlationId) */
    request_id: string | null
    /** All request IDs with clear labels for cross-service correlation */
    request_ids: RequestIdLabels
  }
  diagnostic: DiagnosticBundle
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
  /** Structured error data from CEE error responses (non-2xx) */
  ceeErrorResponse?: CeeErrorResponse | null
  contractTrace: {
    payloadCount: number
    payloads: unknown[]
    /**
     * Capture-state diagnostics. P0 fix (2026-05): when payload
     * inspection is disabled (VITE_APP_ENV not in {development,staging}),
     * `payloadCount` will be 0 even on a build where the UI fetched
     * many requests. This surface explains WHY traces are absent so
     * reviewers can correct the deploy env.
     */
    inspection: {
      enabled: boolean
      resolvedAppEnv: string
      reason: string | null
    }
  }
  dataShapeAnomalies: {
    count: number
    anomalies: unknown[]
  }
  boundaryEvents: unknown[] // Placeholder for future boundary event logging
  /** Edge value summary for transformation debugging */
  edgeValueSummary: EdgeValueSummary
}

/**
 * Extract unique finite numeric values from an array, sorted
 */
function uniqueSorted(values: (number | undefined | null)[]): number[] {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return [...new Set(nums)].sort((a, b) => a - b)
}

/**
 * Safely extract array from potentially truncated data
 * CEE/payload redaction may return { __truncated: true, items: [...] } instead of array
 */
function safeArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && '__truncated' in data) {
    const truncated = data as { __truncated: boolean; items?: unknown[] }
    return Array.isArray(truncated.items) ? truncated.items : []
  }
  return []
}

/**
 * Compute edge value summary from available sources
 * Wrapped in try-catch to ensure export doesn't fail if any source is unavailable
 */
async function computeEdgeValueSummary(
  ceePipelineTrace: CeePipelineTrace | null | undefined,
  payloads: unknown[]
): Promise<EdgeValueSummary> {
  // 1. CEE output (from pipeline trace final_graph)
  let cee_out: EdgeValueSummary['cee_out'] = null
  try {
    const finalGraph = (ceePipelineTrace as any)?.final_graph
    const rawEdges = finalGraph?.edges
    const edges = safeArray(rawEdges) as any[]
    if (edges.length > 0) {
      const strengthMeans = edges.map(e => e.strength?.mean ?? e.strength_mean)
      const existsProbs = edges.map(e => e.exists_probability ?? e.belief_exists ?? e.belief)
      cee_out = {
        total: edges.length,
        unique_strength_mean: uniqueSorted(strengthMeans),
        unique_exists_probability: uniqueSorted(existsProbs),
        all_default: edges.every(e => (e.strength?.mean ?? e.strength_mean ?? 0.5) === 0.5),
      }
    }
  } catch {
    // CEE trace parsing failed
  }

  // 2. Canvas store state - dynamic import to avoid circular deps
  let canvas: EdgeValueSummary['canvas'] = null
  try {
    const { useCanvasStore } = await import('../canvas/store')
    const { isEdgeValueSet } = await import('../canvas/domain/edgeValueProvenance')
    const canvasEdges = useCanvasStore.getState().edges
    if (canvasEdges && canvasEdges.length > 0) {
      const weights = canvasEdges.map(e => e.data?.weight)
      const beliefs = canvasEdges.map(e => e.data?.beliefExists)
      canvas = {
        total: canvasEdges.length,
        unique_weights: uniqueSorted(weights),
        unique_belief_exists: uniqueSorted(beliefs),
        // ⛔ F7. This was `every(e => (e.data?.weight ?? 0.5) === 0.5)` — a
        // VALUE-EQUALITY heuristic for exactly the question the provenance
        // marker answers exactly. It was wrong in both directions: a user who
        // deliberately chose 0.5 was reported as "all default", and a canvas
        // full of USER_EDGE_DEFAULTS (weight 0.3) was reported as NOT default.
        // The CEE and PLoT summaries below keep the heuristic on purpose —
        // those are wire shapes with no marker to read, so a heuristic is the
        // honest best available there, and saying so is the point.
        all_default: canvasEdges.every(
          e => !isEdgeValueSet(e.data as Record<string, unknown> | undefined, 'weight'),
        ),
      }
    }
  } catch {
    // Canvas store not available or import failed
  }

  // 3. PLoT request (most recent /v2/run request from payloads)
  let plot_in: EdgeValueSummary['plot_in'] = null
  try {
    // Use reverse to find the most recent match (payloads are ordered oldest-first)
    const plotPayload = [...(payloads as any[])].reverse().find(p =>
      p.endpoint?.includes('/v2/run') && p.request?.body?.graph?.edges
    )
    if (plotPayload) {
      const rawEdges = plotPayload.request.body.graph.edges
      const edges = safeArray(rawEdges) as any[]
      if (edges.length > 0) {
        const strengthMeans = edges.map(e => e.strength?.mean)
        const existsProbs = edges.map(e => e.exists_probability)
        plot_in = {
          total: edges.length,
          unique_strength_mean: uniqueSorted(strengthMeans),
          unique_exists_probability: uniqueSorted(existsProbs),
          all_default: edges.every(e => (e.strength?.mean ?? 0.5) === 0.5),
        }
      }
    }
  } catch {
    // PLoT payload parsing failed
  }

  // 4. Detect divergence - compare whichever sources are available
  let divergence: string | null = null
  const ceeHasNonDefault = cee_out && !cee_out.all_default
  const canvasHasNonDefault = canvas && !canvas.all_default
  const plotHasNonDefault = plot_in && !plot_in.all_default

  // Check all possible pairs for discrepancies
  const discrepancies: string[] = []

  // CEE vs Canvas comparison
  if (cee_out && canvas) {
    if (ceeHasNonDefault && !canvasHasNonDefault) {
      discrepancies.push('CEE→Canvas: CEE outputs non-default values but Canvas stores 0.5 defaults')
    }
  }

  // Canvas vs PLoT comparison
  if (canvas && plot_in) {
    if (canvasHasNonDefault && !plotHasNonDefault) {
      discrepancies.push('Canvas→PLoT: Canvas has non-default values but PLoT request uses 0.5 defaults')
    }
  }

  // CEE vs PLoT direct comparison (when canvas missing)
  if (cee_out && plot_in && !canvas) {
    if (ceeHasNonDefault && !plotHasNonDefault) {
      discrepancies.push('CEE→PLoT: Values lost (canvas data unavailable)')
    }
  }

  // Set divergence message
  if (discrepancies.length > 0) {
    divergence = discrepancies.join('; ')
  } else if (!cee_out && !canvas && !plot_in) {
    divergence = 'No edge data available from any source'
  } else if (cee_out && !canvas && !plot_in) {
    divergence = 'Only CEE data available (no canvas or PLoT request captured)'
  } else if (!cee_out && canvas && !plot_in) {
    divergence = 'Only canvas data available (no CEE trace or PLoT request captured)'
  } else if (!cee_out && !canvas && plot_in) {
    divergence = 'Only PLoT request available (no CEE trace or canvas data)'
  }

  return { cee_out, canvas, plot_in, divergence }
}

/**
 * Find the most recent CEE payload from the trace store.
 * Prefers completed draft-graph payloads.
 */
function findCeePayload(payloads: { id: string; service: string; endpoint: string; status?: number; completed: boolean; response?: { body: unknown } }[]): typeof payloads[number] | undefined {
  // Prefer completed CEE draft-graph
  const draftGraph = payloads.find(
    p => p.service === 'CEE' && p.completed && p.endpoint.includes('draft-graph')
  )
  if (draftGraph) return draftGraph
  // Any completed CEE payload
  return payloads.find(p => p.service === 'CEE' && p.completed)
}

/**
 * Extract structured error data from a CEE error response body.
 * CEE may include trace.pipeline.cee_provenance, checkpoints, and error details
 * even when the main pipeline fails (non-2xx).
 */
function extractCeeErrorResponse(ceePayload: { status?: number; response?: { body: unknown } } | undefined): CeeErrorResponse | null {
  if (!ceePayload) return null
  const status = ceePayload.status
  // Only extract from error responses (non-2xx)
  if (!status || (status >= 200 && status < 300)) return null

  const body = ceePayload.response?.body
  if (!body || typeof body !== 'object') return null

  const b = body as Record<string, unknown>

  // Extract structured error fields
  const message = (b.message as string) ?? (b.error as string) ?? undefined
  const code = (b.code as string) ?? ((b.details as Record<string, unknown>)?.code as string) ?? undefined

  // Extract trace data from both shapes:
  // Shape A — direct passthrough: body.trace.pipeline (PLoT relays CEE error as-is)
  // Shape B — PLoT-wrapped:       body.details.trace.pipeline (PLoT wraps CEE error in details envelope)
  const directTrace = b.trace as Record<string, unknown> | undefined
  const wrappedDetails = b.details as Record<string, unknown> | undefined
  const wrappedTrace = wrappedDetails?.trace as Record<string, unknown> | undefined
  // Use whichever trace has a pipeline object
  const trace = (directTrace?.pipeline ? directTrace : wrappedTrace?.pipeline ? wrappedTrace : directTrace) ?? undefined
  const pipeline = trace?.pipeline as Record<string, unknown> | undefined

  const cee_request_id = (directTrace?.request_id as string)
    ?? (wrappedTrace?.request_id as string)
    ?? undefined
  const cee_provenance = pipeline?.cee_provenance as CeeErrorResponse['cee_provenance'] | undefined
  const checkpoints = Array.isArray(pipeline?.checkpoints) ? pipeline.checkpoints : undefined
  const pipeline_status = (pipeline?.status as string) ?? undefined

  return {
    httpStatus: status,
    message,
    code,
    cee_request_id,
    cee_provenance: cee_provenance ?? undefined,
    checkpoints,
    pipeline_status,
    body_keys: Object.keys(b),
  }
}

/**
 * Extract all request IDs with labels for cross-service correlation.
 */
function extractRequestIdLabels(
  ceePayload: { id: string; response?: { body: unknown } } | undefined
): RequestIdLabels {
  const ui_correlation_id = ceePayload?.id ?? null

  // CEE-generated request_id from response trace
  // Check both direct passthrough (body.trace) and PLoT-wrapped (body.details.trace)
  let cee_request_id: string | null = null
  if (ceePayload?.response?.body && typeof ceePayload.response.body === 'object') {
    const body = ceePayload.response.body as Record<string, unknown>
    const directTrace = body.trace as Record<string, unknown> | undefined
    const wrappedTrace = (body.details as Record<string, unknown>)?.trace as Record<string, unknown> | undefined
    cee_request_id = (directTrace?.request_id as string)
      ?? (wrappedTrace?.request_id as string)
      ?? null
  }

  return {
    ui_correlation_id,
    cee_request_id,
    cross_service_correlation: ui_correlation_id !== null && cee_request_id !== null,
  }
}

/**
 * Auto-extract ceePipelineTrace from the CEE payload in the trace store.
 * Falls back to error response paths when the main pipeline trace is absent.
 */
function extractPipelineTraceFromPayload(ceePayload: { response?: { body: unknown } } | undefined): CeePipelineTrace | null {
  if (!ceePayload?.response?.body || typeof ceePayload.response.body !== 'object') return null

  const body = ceePayload.response.body as Record<string, unknown>

  // Success path: response.trace.pipeline
  const trace = body.trace as Record<string, unknown> | undefined
  const pipeline = trace?.pipeline
  if (pipeline && typeof pipeline === 'object' && 'status' in (pipeline as Record<string, unknown>)) {
    return pipeline as CeePipelineTrace
  }

  // Error response paths (CEE may nest trace differently)
  const errorDetails = body.details as Record<string, unknown> | undefined
  const errorTrace = errorDetails?.trace as Record<string, unknown> | undefined
  const errorPipeline = errorTrace?.pipeline
  if (errorPipeline && typeof errorPipeline === 'object' && 'status' in (errorPipeline as Record<string, unknown>)) {
    return errorPipeline as CeePipelineTrace
  }

  return null
}

/**
 * Create merged debug export with all available data
 */
export async function createMergedDebugExport(extras?: {
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
}): Promise<MergedDebugExport> {
  // Import payload trace store dynamically to avoid circular deps
  const { usePayloadTraceStore, getDataShapeAnomalies, getPayloadInspectionStatus } = await import('./payload-trace-store')

  const diagnostic = await createDiagnosticBundle()

  // Get contract trace payloads
  const payloadState = usePayloadTraceStore.getState()
  const inspection = getPayloadInspectionStatus()
  const contractTrace = {
    payloadCount: payloadState.payloads.length,
    payloads: payloadState.payloads.map((p) => ({
      id: p.id,
      service: p.service,
      endpoint: p.endpoint,
      method: p.method,
      timestamp: new Date(p.timestamp).toISOString(),
      duration: p.duration,
      status: p.status,
      completed: p.completed,
      error: p.error,
      // P0 fix (2026-05): expose richer error metadata captured by
      // v5Adapter on fetch() throws (TypeError: Failed to fetch and
      // friends). Browsers cannot expose blocked-preflight response
      // detail to JS; `source: 'preflight_or_network'` is the
      // diagnostic, and it cues the reviewer to inspect the Network
      // panel for the underlying preflight response.
      errorName: p.errorName,
      errorCause: p.errorCause,
      source: p.source,
      // Payloads are already redacted at capture time by payload-trace-store
      // (with neverTruncateKeys: ['text'] to preserve llm_raw.text).
      // Do NOT re-redact here — it would strip the neverTruncateKeys exemption.
      request: p.request ?? undefined,
      response: p.response ?? undefined,
      contractValidation: p.contractValidation,
    })),
    inspection: {
      enabled: inspection.enabled,
      resolvedAppEnv: inspection.resolvedAppEnv,
      reason: inspection.reason,
    },
  }

  // Get data shape anomalies
  const anomalies = getDataShapeAnomalies()
  const dataShapeAnomalies = {
    count: anomalies.length,
    anomalies: anomalies.map((a) => ({
      ...a,
      timestamp: new Date(a.timestamp).toISOString(),
    })),
  }

  const versionInfo = getVersionInfo()
  const clientBuild = getClientBuild()

  // Find the most recent CEE payload for error/ID extraction
  const ceePayload = findCeePayload(payloadState.payloads)

  // Extract request IDs with labels
  const requestIds = extractRequestIdLabels(ceePayload)

  // Auto-extract ceePipelineTrace from payload store if not provided in extras
  const ceePipelineTrace = extras?.ceePipelineTrace
    ?? extractPipelineTraceFromPayload(ceePayload)

  // Auto-extract errorDetails from canvas store if not provided in extras
  let errorDetails = extras?.errorDetails
  if (!errorDetails) {
    try {
      const { useCanvasStore } = await import('../canvas/store')
      const storeErrorDetails = useCanvasStore.getState().runMeta?.errorDetails
      if (storeErrorDetails && storeErrorDetails.length > 0) {
        errorDetails = storeErrorDetails
      }
    } catch {
      // Canvas store not available
    }
  }

  // Extract structured error data from CEE error responses
  const ceeErrorResponse = extractCeeErrorResponse(ceePayload)

  // Compute edge value summary for transformation debugging
  const edgeValueSummary = await computeEdgeValueSummary(
    ceePipelineTrace,
    payloadState.payloads
  )

  return {
    meta: {
      timestamp: new Date().toISOString(),
      environment: String(import.meta.env.VITE_APP_ENV || 'development'),
      uiBuild: clientBuild,
      branch: versionInfo?.branch,
      request_id: requestIds.ui_correlation_id,
      request_ids: requestIds,
    },
    diagnostic,
    ceePipelineTrace,
    errorDetails,
    ceeErrorResponse,
    contractTrace,
    dataShapeAnomalies,
    boundaryEvents: [], // Boundary events logged to console, not stored in-memory
    edgeValueSummary,
  }
}

/**
 * Generate filename for merged debug export
 * Format: olumi-diagnostic-{timestamp}.json
 */
function generateMergedFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `olumi-diagnostic-${timestamp}.json`
}

/**
 * Export merged debug data as downloadable JSON file
 */
export async function exportMergedDebugBundle(extras?: {
  ceePipelineTrace?: CeePipelineTrace | null
  errorDetails?: ErrorDetail[]
}): Promise<void> {
  const bundle = await createMergedDebugExport(extras)
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const filename = generateMergedFilename()

  // Create temporary link and trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL
  URL.revokeObjectURL(url)

  if (import.meta.env.DEV) {
    console.warn('[diagnostic-bundle] Exported merged:', filename)
  }
}

 export const __test__ = {
   generateMergedFilename,
 }
