/**
 * CEE Debug Headers Parser (Phase 1 Section 4.1)
 *
 * Parses debug headers from CEE responses for dev-only debugging UI.
 * These headers provide observability into CEE processing.
 */

export interface CeeDebugHeaders {
  requestId?: string
  executionMs?: number
  modelVersion?: string
  degraded?: boolean
  [key: string]: unknown
}

/**
 * Parse CEE debug headers from HTTP response headers
 *
 * Expected headers (optional):
 * - X-Cee-Request-Id: unique request identifier
 * - X-Cee-Execution-Ms: execution time in milliseconds
 * - X-Cee-Model-Version: CEE model version
 * - X-Cee-Degraded: "true" or "false" if CEE ran in degraded mode
 * - X-Cee-Debug-*: any additional debug headers
 */
export function parseCeeDebugHeaders(headers: Headers | Record<string, string>): CeeDebugHeaders {
  const result: CeeDebugHeaders = {}

  // Helper to get header value (works for both Headers and Record)
  const getHeader = (key: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(key)
    }
    // Case-insensitive lookup for Record
    const lowerKey = key.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerKey) {
        return v
      }
    }
    return null
  }

  // Parse standard CEE debug headers
  const requestId = getHeader('x-cee-request-id')
  if (requestId) {
    result.requestId = requestId
  }

  const executionMs = getHeader('x-cee-execution-ms')
  if (executionMs) {
    const parsed = Number(executionMs)
    if (Number.isFinite(parsed) && parsed >= 0) {
      result.executionMs = parsed
    }
  }

  const modelVersion = getHeader('x-cee-model-version')
  if (modelVersion) {
    result.modelVersion = modelVersion
  }

  const degraded = getHeader('x-cee-degraded')
  if (degraded) {
    result.degraded = degraded.toLowerCase() === 'true'
  }

  // Collect any additional X-Cee-Debug-* headers
  const allHeaders = headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers)

  for (const [key, value] of allHeaders) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.startsWith('x-cee-debug-')) {
      const debugKey = lowerKey.slice('x-cee-debug-'.length)
      result[debugKey] = value
    }
  }

  return result
}

/**
 * Check if any CEE debug headers are present
 */
export function hasCeeDebugHeaders(headers: Headers | Record<string, string>): boolean {
  const parsed = parseCeeDebugHeaders(headers)
  return Object.keys(parsed).length > 0
}
