/**
 * Debug State - Request Tracing Storage
 *
 * Stores the last N request traces for debugging and observability.
 * Captures request/response metadata without storing bodies.
 *
 * Used by:
 * - Debug Panel (Week 2) for request inspection
 * - Boundary logging for structured output
 * - Error correlation via request ID
 *
 * @example
 * ```typescript
 * import { recordRequest, recordResponse, getRecentTraces } from '@/lib/debug-state'
 *
 * // On request start
 * recordRequest({
 *   requestId: 'abc-123',
 *   endpoint: '/bff/cee/draft-graph',
 *   method: 'POST',
 *   payloadHash: 'a1b2c3d4e5f6',
 * })
 *
 * // On response received
 * recordResponse('abc-123', {
 *   status: 200,
 *   responseHash: 'x7y8z9w0a1b2',
 *   elapsedMs: 1234,
 *   service: 'cee',
 *   serviceBuild: 'def456',
 * })
 *
 * // Get recent traces for debug panel
 * const traces = getRecentTraces() // Last 20 requests
 * ```
 */

/**
 * Downstream call record from x-olumi-downstream-calls header
 */
export interface DownstreamCall {
  /** Service name (cee, isl, plot) */
  service: string
  /** HTTP status code */
  status: number
  /** Request duration in milliseconds */
  elapsedMs: number
  /** Payload hash sent to downstream */
  payloadHash: string
  /** Response hash from downstream */
  responseHash?: string
}

/**
 * Trace received record from x-olumi-trace-received header
 */
export interface TraceReceived {
  /** Request ID echoed back */
  requestId: string
  /** Payload hash echoed back */
  payloadHash: string
}

/**
 * Request trace record
 */
export interface RequestTrace {
  /** Unique request ID (UUID) */
  requestId: string
  /** BFF endpoint path */
  endpoint: string
  /** HTTP method */
  method: string
  /** SHA-256 hash of request payload (12 chars) */
  payloadHash: string
  /** Request start timestamp (ISO 8601) */
  timestamp: string
  /** Client build version */
  clientBuild?: string

  // Response fields (populated after response received)
  /** HTTP status code */
  status?: number
  /** SHA-256 hash of response payload (if provided by server) */
  responseHash?: string
  /** Upstream service name */
  service?: string
  /** Upstream service build version */
  serviceBuild?: string
  /** Upstream host (for routing debug) */
  upstreamHost?: string
  /** Request duration in milliseconds */
  elapsedMs?: number
  /** Response received timestamp (ISO 8601) */
  responseTimestamp?: string
  /** Whether request completed (vs pending/failed) */
  completed?: boolean
  /** Error message if request failed */
  error?: string

  // Call chain fields (for integration verification)
  /** Downstream service calls made by this request */
  downstream?: DownstreamCall[]
  /** Trace verification data echoed from service */
  traceReceived?: TraceReceived
}

/** Maximum number of traces to keep (expanded from 20 for better debugging during sustained traffic) */
const MAX_TRACES = 50

/** Circular buffer of recent traces */
const traces: RequestTrace[] = []

/** Map for quick lookup by request ID */
const traceMap = new Map<string, RequestTrace>()

/**
 * Record the start of a request.
 *
 * @param params - Request metadata
 */
export function recordRequest(params: {
  requestId: string
  endpoint: string
  method: string
  payloadHash: string
  clientBuild?: string
}): void {
  // Check if a trace with this requestId already exists (e.g., retry scenario)
  // Remove the existing trace to prevent duplicates
  const existingTrace = traceMap.get(params.requestId)
  if (existingTrace) {
    const existingIndex = traces.indexOf(existingTrace)
    if (existingIndex !== -1) {
      traces.splice(existingIndex, 1)
    }
    traceMap.delete(params.requestId)
    if (import.meta.env.DEV) {
      console.log('[debug-state] Replacing existing trace for retry:', params.requestId)
    }
  }

  const trace: RequestTrace = {
    requestId: params.requestId,
    endpoint: params.endpoint,
    method: params.method,
    payloadHash: params.payloadHash,
    clientBuild: params.clientBuild,
    timestamp: new Date().toISOString(),
    completed: false,
  }

  // Add to circular buffer
  if (traces.length >= MAX_TRACES) {
    const removed = traces.shift()
    if (removed) {
      traceMap.delete(removed.requestId)
    }
  }

  traces.push(trace)
  traceMap.set(params.requestId, trace)
}

/**
 * Record response metadata for a request.
 *
 * @param requestId - Request ID to update
 * @param response - Response metadata
 */
export function recordResponse(
  requestId: string,
  response: {
    status: number
    responseHash?: string
    service?: string
    serviceBuild?: string
    upstreamHost?: string
    elapsedMs: number
    error?: string
    downstream?: DownstreamCall[]
    traceReceived?: TraceReceived | null
  }
): void {
  const trace = traceMap.get(requestId)
  if (!trace) {
    // Request not found — may have been evicted from buffer
    if (import.meta.env.DEV) {
      console.warn('[debug-state] Request not found:', requestId)
    }
    return
  }

  // Update trace with response data
  trace.status = response.status
  // Truncate response hash to 12 chars for consistency with payload hash
  trace.responseHash = response.responseHash?.slice(0, 12)
  trace.service = response.service
  trace.serviceBuild = response.serviceBuild
  trace.upstreamHost = response.upstreamHost
  trace.elapsedMs = response.elapsedMs
  trace.responseTimestamp = new Date().toISOString()
  trace.completed = true
  trace.error = response.error

  // Store call chain data (if present)
  if (response.downstream && response.downstream.length > 0) {
    trace.downstream = response.downstream
  }
  if (response.traceReceived) {
    trace.traceReceived = response.traceReceived
  }
}

/**
 * Get all recent traces (most recent first).
 *
 * @returns Array of request traces
 */
export function getRecentTraces(): RequestTrace[] {
  return [...traces].reverse()
}

/**
 * Get a specific trace by request ID.
 *
 * @param requestId - Request ID to look up
 * @returns Trace if found, undefined otherwise
 */
export function getTrace(requestId: string): RequestTrace | undefined {
  return traceMap.get(requestId)
}

/**
 * Get pending (incomplete) traces.
 *
 * @returns Array of traces without responses
 */
export function getPendingTraces(): RequestTrace[] {
  return traces.filter((t) => !t.completed)
}

/**
 * Get failed traces (completed with error or non-2xx status).
 *
 * @returns Array of failed traces
 */
export function getFailedTraces(): RequestTrace[] {
  return traces.filter(
    (t) => t.completed && (t.error || (t.status && (t.status < 200 || t.status >= 300)))
  )
}

/**
 * Clear all traces.
 * Used by Debug Panel "Clear History" action.
 */
export function clearTraces(): void {
  traces.length = 0
  traceMap.clear()
}

/**
 * @deprecated Use clearTraces instead
 * @internal
 */
export const _clearTraces = clearTraces

/**
 * Get trace count (for testing).
 * @internal
 */
export function _getTraceCount(): number {
  return traces.length
}

/**
 * Canonical header names for observability (lowercase per RFC 7230).
 * HTTP headers are case-insensitive, but we standardise on lowercase
 * for consistency with backend services.
 */
export const OBSERVABILITY_HEADERS = {
  RESPONSE_HASH: 'x-olumi-response-hash',
  SERVICE: 'x-olumi-service',
  SERVICE_BUILD: 'x-olumi-service-build',
  PAYLOAD_HASH: 'x-olumi-payload-hash',
  UPSTREAM_HOST: 'x-olumi-upstream-host',
  REQUEST_ID: 'x-request-id',
  DOWNSTREAM_CALLS: 'x-olumi-downstream-calls',
  TRACE_RECEIVED: 'x-olumi-trace-received',
} as const

/**
 * Parse x-olumi-downstream-calls header.
 * Format: service:status:elapsed:payloadHash:responseHash;...
 *
 * @param header - Header value or null
 * @returns Array of downstream call records
 */
export function parseDownstreamCalls(header: string | null | undefined): DownstreamCall[] {
  if (!header || header.trim() === '') return []

  try {
    return header
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const [service, status, elapsed, payloadHash, responseHash] = part.split(':')
        return {
          service: service || 'unknown',
          status: parseInt(status, 10) || 0,
          elapsedMs: parseInt(elapsed, 10) || 0,
          payloadHash: payloadHash || '',
          responseHash: responseHash || undefined,
        }
      })
      .filter((call) => call.service !== 'unknown') // Filter out malformed entries
  } catch {
    // Graceful degradation on parse error
    if (import.meta.env.DEV) {
      console.warn('[debug-state] Failed to parse downstream-calls header:', header)
    }
    return []
  }
}

/**
 * Parse x-olumi-trace-received header.
 * Format: request_id:payload_hash
 *
 * @param header - Header value or null
 * @returns TraceReceived record or null
 */
export function parseTraceReceived(header: string | null | undefined): TraceReceived | null {
  if (!header || header.trim() === '') return null

  try {
    const [requestId, payloadHash] = header.split(':')
    if (!requestId && !payloadHash) return null

    return {
      requestId: requestId || 'none',
      payloadHash: payloadHash || 'none',
    }
  } catch {
    // Graceful degradation on parse error
    if (import.meta.env.DEV) {
      console.warn('[debug-state] Failed to parse trace-received header:', header)
    }
    return null
  }
}

/**
 * Get a header value with case-insensitive lookup.
 *
 * Note: The Fetch API's Headers.get() is already case-insensitive per spec,
 * but this helper makes the intent explicit and provides a single point
 * of control if behavior needs to change.
 *
 * @param headers - Headers object from fetch Response
 * @param name - Header name (case-insensitive)
 * @returns Header value or undefined if not present
 */
export function getHeaderCaseInsensitive(headers: Headers, name: string): string | undefined {
  // Headers.get() is case-insensitive per Fetch API spec (RFC 7230 compliance)
  // We use lowercase for consistency with backend standardisation
  return headers.get(name.toLowerCase()) ?? undefined
}

/**
 * Extract observability headers from a Response object.
 *
 * Handles both lowercase (new standard) and mixed-case (legacy) headers
 * via case-insensitive lookup per RFC 7230.
 *
 * @param headers - Response headers
 * @returns Extracted header values
 */
export function extractResponseHeaders(headers: Headers): {
  responseHash?: string
  service?: string
  serviceBuild?: string
  upstreamHost?: string
  requestIdEcho?: string
  downstream?: DownstreamCall[]
  traceReceived?: TraceReceived | null
} {
  const downstreamHeader = getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.DOWNSTREAM_CALLS)
  const traceReceivedHeader = getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.TRACE_RECEIVED)

  return {
    responseHash: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.RESPONSE_HASH),
    service: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.SERVICE),
    serviceBuild: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.SERVICE_BUILD),
    upstreamHost: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.UPSTREAM_HOST),
    requestIdEcho: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.REQUEST_ID),
    downstream: parseDownstreamCalls(downstreamHeader),
    traceReceived: parseTraceReceived(traceReceivedHeader),
  }
}
