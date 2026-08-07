/**
 * PLoT v1 HTTP client (via proxy)
 * All calls go through /api/plot proxy; server adds auth headers
 */

import type {
  V1HealthResponse,
  V1RunRequest,
  V1SyncRunResponse,
  V1Error,
  V1TemplateListResponse,
  V1TemplateGraphResponse,
  V1ValidateRequest,
  V1ValidateResponse,
  V1LimitsResponse,
  V1RunBundleRequest,
  V1RunBundleResponse,
} from './types'
import {
  RETRY,
  TIMEOUTS,
  calculateBackoffMs,
  calculateRateLimitDelayMs,
  isRetryableStatus,
  isRetryableErrorCode,
} from './constants'
import { validatePayloadSize } from './payloadGuard'
import { parseCeeDebugHeaders } from '../../../canvas/utils/ceeDebugHeaders' // Phase 1 Section 4.1
import { withObservabilityHeaders, recordBffResponse, recordBffError, recordBffResponsePayload } from '../../../lib/observability-headers'
import { useGateStore } from '../../../lib/gate-state'
import { V1SyncRunResponseSchema, warnOnInvalidApiResponse } from '../../../lib/api-schemas'
// PR follow-up to #153: record the request side into the payload-trace
// store so the debug bundle's PLoT selector can find this entry by
// service + endpoint. Pre-fix only `recordBffResponsePayload` (line
// 438) wrote to the store, which left the entry without `service` /
// `endpoint` and the bundle silently rejected it.
import { recordRequestPayload, recordResponsePayload } from '../../../lib/payload-trace-store'
import { plotFetch } from '../../../lib/plotFetch'

const getProxyBase = (): string => {
  return import.meta.env?.VITE_PLOT_PROXY_BASE || '/bff/engine'
}


const getTimeouts = () => ({
  sync: parseInt(import.meta.env?.VITE_PLOT_SYNC_TIMEOUT_MS || String(TIMEOUTS.SYNC_REQUEST_MS), 10),
  stream: parseInt(import.meta.env?.VITE_PLOT_STREAM_TIMEOUT_MS || String(TIMEOUTS.SYNC_REQUEST_MS * 4), 10),
})

/**
 * Cache for backend capabilities (expires after 5 minutes)
 * Sprint N P1: Capability negotiation to prevent "Unknown field" errors
 */
let cachedCapabilities: { data: CapabilitiesResponse; fetchedAt: number } | null = null
const CAPABILITIES_TTL_MS = 5 * 60 * 1000

/**
 * Capabilities response from /version endpoint
 */
export interface CapabilitiesResponse {
  version: string
  build?: string
  capabilities: {
    detail_level?: string[]
    streaming?: string
    max_recommended_latency_ms?: number
  }
}

/**
 * GET /version - Check backend capabilities before using features
 * Prevents "Unknown field" errors from version drift
 * Sprint N P1: Capability negotiation
 */
export async function getCapabilities(): Promise<CapabilitiesResponse> {
  // Return cached if fresh
  if (cachedCapabilities && Date.now() - cachedCapabilities.fetchedAt < CAPABILITIES_TTL_MS) {
    return cachedCapabilities.data
  }

  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await plotFetch(`${base}/version`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      // Graceful degradation - return empty capabilities
      if (import.meta.env.DEV) {
        console.warn('[plot/v1] /version returned non-OK, using empty capabilities')
      }
      return { version: 'unknown', capabilities: {} }
    }

    const data = await response.json()
    const caps: CapabilitiesResponse = {
      version: data.version || 'unknown',
      build: data.build,
      capabilities: data.capabilities || {},
    }
    cachedCapabilities = { data: caps, fetchedAt: Date.now() }

    if (import.meta.env.DEV) {
      console.log('[plot/v1] Capabilities fetched:', caps)
    }

    return caps
  } catch (err) {
    // Network error - return empty capabilities
    if (import.meta.env.DEV) {
      console.warn('[plot/v1] Failed to fetch capabilities:', err)
    }
    return { version: 'unknown', capabilities: {} }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Check if backend supports a specific feature
 * Sprint N P1: Helper for capability negotiation
 */
export async function hasCapability(feature: 'detail_level' | 'streaming'): Promise<boolean> {
  const caps = await getCapabilities()
  if (feature === 'detail_level') {
    return Array.isArray(caps.capabilities?.detail_level) && caps.capabilities.detail_level.length > 0
  }
  if (feature === 'streaming') {
    return caps.capabilities?.streaming === 'enhanced'
  }
  return false
}

/**
 * Clear cached capabilities (useful for testing or force refresh)
 */
export function clearCapabilitiesCache(): void {
  cachedCapabilities = null
}

/**
 * Generic retry wrapper with exponential backoff and jitter
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; shouldRetry?: (error: V1Error) => boolean }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? RETRY.MAX_ATTEMPTS
  const shouldRetry = options?.shouldRetry ?? ((error: V1Error) => {
    // Check both error code and HTTP status (if present in details)
    const codeRetryable = isRetryableErrorCode(error.code)
    const statusRetryable = error.details?.status ? isRetryableStatus(error.details.status) : false
    return codeRetryable || statusRetryable
  })

  let lastError: V1Error | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const error = err as V1Error

      // Don't retry if not retryable
      if (!shouldRetry(error)) {
        throw error
      }

      lastError = error

      // Don't sleep on last attempt
      if (attempt < maxAttempts - 1) {
        // AUDIT FIX 3: Use server-specified delay for rate-limited requests
        const delayMs = error.code === 'RATE_LIMITED'
          ? calculateRateLimitDelayMs(error.retry_after)
          : calculateBackoffMs(attempt)

        if (import.meta.env.DEV) {
          const retryInfo = error.code === 'RATE_LIMITED' && error.retry_after
            ? `retry_after=${error.retry_after}s`
            : `exponential backoff`
          console.log(`[plot/v1] Retry ${attempt + 1}/${maxAttempts} after ${delayMs}ms (${error.code}, ${retryInfo})`)
        }
        // TODO(telemetry): Add metrics for retry counts, error codes, and latency to monitor
        // backend flakiness and optimize retry strategy. Consider Sentry breadcrumbs or custom metrics.
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError
}

/**
 * Map HTTP errors to V1Error
 */
const mapHttpError = async (response: Response): Promise<V1Error> => {
  let body: any
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  // M1.3: Handle rate limiting with Retry-After and X-RateLimit-Reason
  if (response.status === 429) {
    // Check both header and body for retry_after
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfterBody =
      typeof body.retry_after_s === 'number'
        ? body.retry_after_s
        : typeof body.retry_after_seconds === 'number'
          ? body.retry_after_seconds
          : typeof body.retry_after === 'number'
            ? body.retry_after
            : undefined
    const retryAfter =
      typeof retryAfterBody === 'number'
        ? retryAfterBody
        : retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10)
          : undefined
    const reason = response.headers.get('X-RateLimit-Reason') || body.reason || 'Rate limit exceeded'

    return {
      code: 'RATE_LIMITED',
      message: body.error || 'Too many requests',
      retry_after: retryAfter,
      details: { ...body, status: response.status, reason, retry_after: retryAfter },
    }
  }

  // Handle bad input
  if (response.status === 400) {
    // Check for graph_too_large reason (backend runtime limits)
    if (body.reason === 'graph_too_large' && body.limits) {
      const limits = body.limits
      return {
        code: 'LIMIT_EXCEEDED',
        message: `Graph exceeds backend runtime limits: ${limits.nodes || '?'} nodes max, ${limits.edges || '?'} edges max`,
        field: 'nodes',
        max: limits.nodes,
        details: { ...body, status: response.status },
      }
    }

    return {
      code: 'BAD_INPUT',
      message: body.error || body.reason || 'Invalid input',
      field: body.fields?.field,
      max: body.fields?.max,
      details: { ...body, status: response.status },
    }
  }

  // Handle limit exceeded
  if (response.status === 413 || body.code === 'LIMIT_EXCEEDED') {
    return {
      code: 'LIMIT_EXCEEDED',
      message: body.error || 'Request exceeds limits',
      field: body.fields?.field,
      max: body.fields?.max,
      details: { ...body, status: response.status },
    }
  }

  // Handle gateway timeout (504) - proxy timeout, analysis took too long
  // This is different from client-side TIMEOUT (AbortController) and engine down
  if (response.status === 504) {
    return {
      code: 'GATEWAY_TIMEOUT',
      message: 'Analysis timed out via gateway (proxy timeout). Try a smaller graph or "quick" mode.',
      details: { ...body, status: response.status },
    }
  }

  // Server errors
  const serverRetryAfter =
    typeof body.retry_after_s === 'number'
      ? body.retry_after_s
      : typeof body.retry_after_seconds === 'number'
        ? body.retry_after_seconds
        : typeof body.retry_after === 'number'
          ? body.retry_after
          : undefined
  return {
    code: 'SERVER_ERROR',
    message: body.error || `HTTP ${response.status}`,
    retry_after: serverRetryAfter,
    details: { ...body, status: response.status, retry_after: serverRetryAfter },
  }
}

/**
 * GET /v1/health
 */
export async function health(): Promise<V1HealthResponse> {
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await plotFetch(`${base}/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      // Degraded if reachable but not ok
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
      }
    }

    const data = await response.json()
    return {
      status: data.status || 'ok',
      timestamp: data.timestamp || new Date().toISOString(),
      version: data.version,
      uptime_ms: data.uptime_ms,
    }
  } catch (err) {
    // Down if unreachable or timeout
    return {
      status: 'down',
      timestamp: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * POST /v1/run (sync) - internal implementation without retry
 * M1.4: Adds X-Request-Id header
 * M1.5: Adds x-scm-lite header if enabled
 */
async function runSyncOnce(
  request: V1RunRequest,
  options?: { timeoutMs?: number; signal?: AbortSignal; requestId?: string; scmLite?: boolean }
): Promise<V1SyncRunResponse> {
  const base = getProxyBase()
  const timeouts = getTimeouts()
  const timeoutMs = options?.timeoutMs || timeouts.sync

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Chain signals if provided
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  // Declare these early so catch block can access them
  const requestId = options?.requestId || crypto.randomUUID()
  const endpoint = `${base}/v1/run`
  let startTime = Date.now() // Will be updated by withObservabilityHeaders
  // PR #156 follow-up (reviewer P0): track whether the response side
  // of the trace-store entry has already been recorded so the catch
  // block doesn't OVER-record with status:0 when a non-OK HTTP
  // response was already captured with its real status.
  let responseRecorded = false

  try {
    const idempotencyKey = request.idempotencyKey || request.clientHash

    // Build wire payload without idempotencyKey field (header-only in v1 API)
    // Sprint N P1: Use capability negotiation to conditionally include detail_level
    // 'quick' → K=16 samples, ~5-10s | 'standard' → K=32, ~15-25s | 'deep' → K=64, ~30-45s
    const requestForBody: V1RunRequest = {
      ...request,
      idempotencyKey: undefined,
    }

    // Sprint N P1: Only include detail_level if backend supports it (prevents 400 "Unknown field")
    // M1 CEE: Default to 'standard' so CEE runs (CEE skips on 'quick')
    const caps = await getCapabilities()
    const desiredDetailLevel = request.detail_level ?? 'standard'
    if (caps.capabilities?.detail_level?.includes(desiredDetailLevel)) {
      requestForBody.detail_level = desiredDetailLevel
      if (import.meta.env.DEV) {
        console.log(`[plot/v1] Using detail_level: ${desiredDetailLevel}`)
      }
    } else if (import.meta.env.DEV) {
      console.warn(`[plot/v1] Backend does not support detail_level=${desiredDetailLevel}, omitting parameter`)
    }

    // M1.6: Validate payload size (96KB guard)
    const payloadCheck = validatePayloadSize(requestForBody)
    if (!payloadCheck.valid) {
      throw {
        code: 'LIMIT_EXCEEDED',
        message: payloadCheck.error || 'Payload too large',
        details: { sizeKB: payloadCheck.sizeKB, maxKB: 96 },
      } as V1Error
    }

    // Build base headers (requestId and endpoint already declared above try block)
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId, // M1.4
      'x-olumi-sdk': 'plot-client/1.0.0', // M1.6
    }

    if (idempotencyKey) {
      baseHeaders['Idempotency-Key'] = idempotencyKey
    }

    // M1.5: Add SCM-lite header (takes precedence over query params)
    if (options?.scmLite !== undefined) {
      baseHeaders['x-scm-lite'] = options.scmLite ? '1' : '0'
    }

    // Add observability headers (payload hash, client build)
    // Update startTime from the outer scope with accurate timing
    const { headers, startTime: obsStartTime } = await withObservabilityHeaders(
      endpoint,
      'POST',
      requestForBody,
      baseHeaders,
      requestId
    )
    startTime = obsStartTime // Update outer scope for catch block

    // PR follow-up to #153: record the request side into the payload-trace
    // store BEFORE the fetch fires. Without this, the existing
    // `recordBffResponsePayload` (below) created a store entry without
    // `service` / `endpoint`, and the debug bundle's selector rejected
    // the entry. With this call, `detectService(endpoint)` inside
    // `recordRequestPayload` classifies the entry as `service: 'PLoT'`
    // and the bundle's `findBestPayload(..., 'PLoT')` can find it.
    // The gate (`payload_inspection_status.enabled`) is checked inside
    // `recordRequestPayload`; a closed gate makes this a no-op.
    recordRequestPayload({
      id: requestId,
      endpoint,
      method: 'POST',
      headers,
      body: requestForBody,
    })

    const response = await plotFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestForBody),
      signal: controller.signal,
    })

    // Record response for observability
    recordBffResponse(requestId, endpoint, response, startTime)

    if (!response.ok) {
      // PR #156 follow-up (reviewer P0): a non-OK HTTP response is a
      // SERVER-side failure (4xx/5xx), NOT a network failure. Record
      // the trace-store entry with the REAL status, headers, and
      // (best-effort) error body BEFORE the throw lands in the catch
      // block. Without this, the catch block recorded `status: 0,
      // source: 'preflight_or_network'` for every non-OK response —
      // which made server failures look like network failures.
      //
      // Body parse is defensive: a 4xx/5xx may still carry JSON
      // (PLoT error envelope) OR plain text OR nothing. We try JSON
      // first, fall back to text, finally null. Redaction runs at
      // EXPORT time via `redactPayload(DEBUG_BUNDLE_REDACTION_OPTIONS)`
      // so error bodies containing auth-like fields are masked the
      // same way successful payloads are.
      let errorBody: unknown = null
      const errorBodyHeaders: Record<string, string> = {}
      try {
        if (response.headers && typeof response.headers.forEach === 'function') {
          response.headers.forEach((v, k) => {
            errorBodyHeaders[k] = v
          })
        }
      } catch {
        // jsdom Response mocks sometimes lack a real Headers shape.
      }
      // PR #156 round-4 (reviewer P1 #2): clone TWO copies of the
      // response — one for the JSON attempt, one for the text
      // fall-back. Pre-fix the second `response.clone()` was called
      // AFTER the first clone's `.json()` consumed the original;
      // the spec leaves clone-after-consume undefined and runtimes
      // behave inconsistently. Two distinct clones eliminate the
      // dependency on consume-order.
      let jsonClone: Response | null = null
      let textClone: Response | null = null
      try {
        jsonClone = response.clone()
      } catch {
        // clone unsupported in this runtime
      }
      try {
        textClone = response.clone()
      } catch {
        // clone unsupported
      }
      try {
        if (jsonClone !== null) {
          errorBody = await jsonClone.json()
        } else {
          throw new Error('clone unavailable')
        }
      } catch {
        if (textClone !== null) {
          try {
            const text = await textClone.text()
            errorBody = text.length > 0 ? text : null
          } catch {
            errorBody = null
          }
        } else {
          errorBody = null
        }
      }
      recordResponsePayload({
        id: requestId,
        status: response.status,
        headers: errorBodyHeaders,
        body: errorBody,
        duration: Date.now() - startTime,
        // Indicate the PLoT origin (the gate uses this to distinguish
        // network/proxy failures from service failures).
        source: 'plot',
      })
      responseRecorded = true

      throw await mapHttpError(response)
    }

    // Phase 1 Section 4.1: Parse CEE debug headers (dev-only)
    //
    // PR #156 round-3 (reviewer IMP #1): a successful HTTP response
    // (2xx) with invalid JSON used to fall through to the catch
    // block, which recorded `status: 0, source: 'preflight_or_network'`
    // — making a parse failure look like a network failure. Now we
    // catch JSON parse errors here, record the real HTTP status +
    // raw text body + ParseError diagnostic BEFORE throwing, and
    // mark `responseRecorded` so the catch doesn't over-record.
    let result: V1SyncRunResponse
    // PR #156 round-4 (reviewer P1 #2): clone the response BEFORE
    // attempting json() so the clone's body stream is still intact
    // if json() fails. Pre-fix `.clone()` was called AFTER
    // `.json()` consumed the body — the clone would either throw on
    // `.text()` or return an empty string, defeating the round-3
    // "preserve raw text" claim.
    let parseClone: Response | null = null
    try {
      parseClone = response.clone()
    } catch {
      // jsdom or test mocks may not implement clone — fall through
      // and accept that raw text capture may not be possible.
      parseClone = null
    }
    try {
      result = await response.json()
    } catch (jsonErr) {
      const errAny = jsonErr as { name?: string; message?: string }
      let rawText: string | null = null
      if (parseClone !== null) {
        try {
          rawText = await parseClone.text()
        } catch {
          // Clone exists but .text() failed (unusual). Keep null.
        }
      }
      const parseErrorHeaders: Record<string, string> = {}
      try {
        if (response.headers && typeof response.headers.forEach === 'function') {
          response.headers.forEach((v, k) => {
            parseErrorHeaders[k] = v
          })
        }
      } catch {
        // jsdom safety.
      }
      recordResponsePayload({
        id: requestId,
        // CRITICAL: real HTTP status, NOT 0 — the response WAS
        // received successfully; only the body was unparseable.
        status: response.status,
        headers: parseErrorHeaders,
        body: rawText,
        duration: Date.now() - startTime,
        error:
          typeof errAny.message === 'string' ? errAny.message : undefined,
        errorName: 'ParseError',
        source: 'plot',
      })
      responseRecorded = true
      // Re-throw as a V1 error so callers see a NETWORK_ERROR-like
      // shape (existing contract) — but the trace store now carries
      // the honest "200 + parse error" record.
      throw {
        code: 'PARSE_ERROR',
        message:
          typeof errAny.message === 'string'
            ? errAny.message
            : 'Failed to parse JSON response',
        requestId,
      } as V1Error
    }

    // Warn if response shape is unexpected (logs warning, continues execution)
    warnOnInvalidApiResponse(V1SyncRunResponseSchema, result, 'PLoT v1/run')

    // Record response payload for debug panel inspection
    recordBffResponsePayload(requestId, response, result, startTime)
    responseRecorded = true

    // Parse debug headers if available (may not exist in test mocks)
    if (response.headers) {
      const debugHeaders = parseCeeDebugHeaders(response.headers)
      if (Object.keys(debugHeaders).length > 0) {
        (result as any).__ceeDebugHeaders = debugHeaders
      }
    }

    // Update run gate on successful response
    useGateStore.getState().setGate('run', 'pass', { message: 'Simulation completed' })

    return result
  } catch (err) {
    // P2.3: Use requestId/endpoint/startTime from outer scope for correlation
    // Record error for observability
    recordBffError(requestId, endpoint, startTime, err)

    // PR follow-up to #153: complete the trace-store entry on the
    // error path so the bundle shows an honest "request fired, response
    // failed" record rather than a half-populated entry.
    //
    // PR #156 follow-up (reviewer P0): if the non-OK HTTP branch
    // ALREADY recorded the response side (real status + body), don't
    // over-record here. Without this guard the catch block would
    // re-write the entry as `status: 0`, hiding the real server
    // failure.
    //
    // Status 0 + `preflight_or_network` is reserved for genuine
    // fetch-level network failures (TypeError, DNS, CORS preflight)
    // and `browser_timeout` for AbortError. Server failures keep
    // their real HTTP status from the non-OK branch above.
    if (!responseRecorded) {
      const errAny = err as { name?: string; message?: string; code?: string }
      const isAbort = err instanceof Error && err.name === 'AbortError'
      recordResponsePayload({
        id: requestId,
        status: 0,
        headers: {},
        body: null,
        duration: Date.now() - startTime,
        error:
          typeof errAny.message === 'string' ? errAny.message : undefined,
        errorName:
          typeof errAny.name === 'string' ? errAny.name : undefined,
        source: isAbort ? 'browser_timeout' : 'preflight_or_network',
      })
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs}ms`,
        requestId,
      } as V1Error
    }
    if ((err as any).code) {
      // Already a V1Error - add requestId if not present
      const v1Err = err as V1Error
      if (!v1Err.requestId) {
        v1Err.requestId = requestId
      }
      throw v1Err
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
      requestId,
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * POST /v1/run (sync) with automatic retry
 * M1.4: Accepts requestId
 * M1.5: Accepts scmLite toggle
 */
export async function runSync(
  request: V1RunRequest,
  options?: { timeoutMs?: number; signal?: AbortSignal; requestId?: string; scmLite?: boolean }
): Promise<V1SyncRunResponse> {
  return withRetry(() => runSyncOnce(request, options))
}

/**
 * POST /v1/run/{run_id}/cancel
 */
export async function cancel(runId: string): Promise<void> {
  const base = getProxyBase()

  try {
    const response = await plotFetch(`${base}/v1/run/${runId}/cancel`, {
      method: 'POST',
    })

    // Idempotent - 200 or 404 both ok
    if (!response.ok && response.status !== 404) {
      throw await mapHttpError(response)
    }
  } catch (err) {
    // Swallow errors on cancel (best effort)
    console.warn('[plot/v1] Cancel failed:', err)
  }
}

/**
 * GET /v1/templates
 */
export async function templates(): Promise<V1TemplateListResponse> {
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await plotFetch(`${base}/v1/templates`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Request timed out after 10000ms',
      } as V1Error
    }
    if ((err as any).code) {
      throw err // Already a V1Error
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * GET /v1/templates/{id}/graph
 */
export async function templateGraph(id: string): Promise<V1TemplateGraphResponse> {
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await plotFetch(`${base}/v1/templates/${encodeURIComponent(id)}/graph`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    const data = await response.json()

    if (import.meta.env.DEV) {
      console.log('[v1/http] templateGraph() raw response:', JSON.stringify(data, null, 2))
    }

    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Request timed out after 10000ms',
      } as V1Error
    }
    if ((err as any).code) {
      throw err // Already a V1Error
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * POST /v1/validate
 * Validate graph before running analysis
 */
export async function validate(request: V1ValidateRequest): Promise<V1ValidateResponse> {
  const base = getProxyBase()
  const endpoint = `${base}/v1/validate`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  // Add observability headers
  const requestId = crypto.randomUUID()
  let startTime = Date.now()

  try {
    const { headers, startTime: obsStartTime } = await withObservabilityHeaders(
      endpoint,
      'POST',
      request,
      { 'Content-Type': 'application/json' },
      requestId
    )
    startTime = obsStartTime

    const response = await plotFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    recordBffResponse(requestId, endpoint, response, startTime)

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    const result = await response.json()
    recordBffResponsePayload(requestId, response, result, startTime)
    return result
  } catch (err) {
    recordBffError(requestId, endpoint, startTime, err)

    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Validation request timed out after 5000ms',
      } as V1Error
    }
    if ((err as any).code) {
      throw err // Already a V1Error
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * GET /v1/limits
 * Get engine limits and p95 budget (v1.2)
 */
export async function limits(): Promise<V1LimitsResponse> {
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await plotFetch(`${base}/v1/limits`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    return await response.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: 'Limits request timed out after 5000ms',
      } as V1Error
    }
    if ((err as any).code) {
      throw err // Already a V1Error
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * POST /v1/run_bundle
 * Compare multiple options and get ranking (v1.3)
 */
export async function runBundle(request: V1RunBundleRequest): Promise<V1RunBundleResponse> {
  const base = getProxyBase()
  const endpoint = `${base}/v1/run_bundle`
  const timeouts = getTimeouts()
  const controller = new AbortController()
  // Longer timeout for bundle (multiple options)
  const timeoutMs = timeouts.sync * 2
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Add observability headers
  const requestId = crypto.randomUUID()
  let startTime = Date.now()

  try {
    const { headers, startTime: obsStartTime } = await withObservabilityHeaders(
      endpoint,
      'POST',
      request,
      {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'x-olumi-sdk': 'plot-client/1.0.0',
      },
      requestId
    )
    startTime = obsStartTime

    const response = await plotFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    recordBffResponse(requestId, endpoint, response, startTime)

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    return await response.json()
  } catch (err) {
    recordBffError(requestId, endpoint, startTime, err)

    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: `Run bundle request timed out after ${timeoutMs}ms`,
      } as V1Error
    }
    if ((err as any).code) {
      throw err // Already a V1Error
    }
    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : String(err),
    } as V1Error
  } finally {
    clearTimeout(timeoutId)
  }
}
