/**
 * Observability Headers Utility
 *
 * Shared utility for computing and injecting observability headers
 * into BFF requests. Used by all HTTP adapters.
 *
 * Headers added:
 * - `x-olumi-payload-hash`: 12-char SHA-256 of canonicalised request body
 * - `x-olumi-client-build`: 7-char git SHA from /version.json
 *
 * Also handles:
 * - Boundary logging (structured JSON for request/response)
 * - Debug state recording (for Debug Panel)
 *
 * @example
 * ```typescript
 * import { withObservabilityHeaders, recordBffResponse } from '@/lib/observability-headers'
 *
 * const { headers, requestId, startTime } = await withObservabilityHeaders(
 *   '/bff/cee/draft-graph',
 *   'POST',
 *   requestBody,
 *   existingHeaders
 * )
 *
 * const response = await fetch(url, { headers, body: ... })
 *
 * recordBffResponse(requestId, '/bff/cee/draft-graph', response, startTime)
 * ```
 */

import { computePayloadHash } from './canonical-hash'
import { getClientBuild } from './version-cache'
import { recordRequest, recordResponse, extractResponseHeaders } from './debug-state'
import { logBoundaryRequest, logBoundaryResponse } from './logger'

/**
 * Result of preparing observability headers
 */
export interface ObservabilityHeadersResult {
  /** Headers to merge into request */
  headers: Record<string, string>
  /** Request ID (for correlation) */
  requestId: string
  /** Payload hash (for reference) */
  payloadHash: string
  /** Request start time (for elapsed calculation) */
  startTime: number
}

/**
 * Prepare observability headers for a BFF request.
 * Also records the request in debug state and logs boundary event.
 *
 * @param endpoint - BFF endpoint path
 * @param method - HTTP method
 * @param body - Request body (will be hashed via SHA-256)
 * @param existingHeaders - Existing headers to merge with
 * @param existingRequestId - Use existing request ID if provided
 * @returns Promise resolving to headers and metadata for the request
 */
export async function withObservabilityHeaders(
  endpoint: string,
  method: string,
  body: unknown,
  existingHeaders?: Record<string, string>,
  existingRequestId?: string
): Promise<ObservabilityHeadersResult> {
  const startTime = Date.now()
  const requestId = existingRequestId || crypto.randomUUID()
  const payloadHash = await computePayloadHash(body)
  const clientBuild = getClientBuild()

  // Build headers
  const headers: Record<string, string> = {
    ...existingHeaders,
    'x-olumi-payload-hash': payloadHash,
    'x-olumi-client-build': clientBuild,
  }

  // Record in debug state
  recordRequest({
    requestId,
    endpoint,
    method,
    payloadHash,
    clientBuild,
  })

  // Log boundary event
  logBoundaryRequest({
    requestId,
    endpoint,
    method,
    payloadHash,
    clientBuild,
  })

  return {
    headers,
    requestId,
    payloadHash,
    startTime,
  }
}

/**
 * Record a BFF response in debug state and log boundary event.
 *
 * @param requestId - Request ID to correlate
 * @param endpoint - BFF endpoint path
 * @param response - Fetch Response object
 * @param startTime - Request start time (from withObservabilityHeaders)
 * @param error - Error message if request failed
 */
export function recordBffResponse(
  requestId: string,
  endpoint: string,
  response: Response | null,
  startTime: number,
  error?: string
): void {
  const elapsedMs = Date.now() - startTime
  const status = response?.status ?? 0

  // Extract observability headers from response
  const responseHeaders = response?.headers
    ? extractResponseHeaders(response.headers)
    : {}

  // Record in debug state
  recordResponse(requestId, {
    status,
    responseHash: responseHeaders.responseHash,
    service: responseHeaders.service,
    serviceBuild: responseHeaders.serviceBuild,
    upstreamHost: responseHeaders.upstreamHost,
    elapsedMs,
    error,
  })

  // Log boundary event
  logBoundaryResponse({
    requestId,
    endpoint,
    status,
    elapsedMs,
    responseHash: responseHeaders.responseHash,
    service: responseHeaders.service,
    serviceBuild: responseHeaders.serviceBuild,
    error,
  })
}

/**
 * Record a failed BFF request (network error, timeout, etc.).
 *
 * @param requestId - Request ID to correlate
 * @param endpoint - BFF endpoint path
 * @param startTime - Request start time
 * @param error - Error that occurred
 */
export function recordBffError(
  requestId: string,
  endpoint: string,
  startTime: number,
  error: Error | unknown
): void {
  const elapsedMs = Date.now() - startTime
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Record in debug state
  recordResponse(requestId, {
    status: 0,
    elapsedMs,
    error: errorMessage,
  })

  // Log boundary event
  logBoundaryResponse({
    requestId,
    endpoint,
    status: 0,
    elapsedMs,
    error: errorMessage,
  })
}
