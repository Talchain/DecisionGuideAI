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
}

/** Maximum number of traces to keep */
const MAX_TRACES = 20

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
 * Clear all traces (for testing).
 * @internal
 */
export function _clearTraces(): void {
  traces.length = 0
  traceMap.clear()
}

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
} as const

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
} {
  return {
    responseHash: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.RESPONSE_HASH),
    service: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.SERVICE),
    serviceBuild: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.SERVICE_BUILD),
    upstreamHost: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.UPSTREAM_HOST),
    requestIdEcho: getHeaderCaseInsensitive(headers, OBSERVABILITY_HEADERS.REQUEST_ID),
  }
}
