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

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || '/bff/engine'
}

const getTimeouts = () => ({
  sync: parseInt(import.meta.env.VITE_PLOT_SYNC_TIMEOUT_MS || String(TIMEOUTS.SYNC_REQUEST_MS), 10),
  stream: parseInt(import.meta.env.VITE_PLOT_STREAM_TIMEOUT_MS || String(TIMEOUTS.SYNC_REQUEST_MS * 4), 10),
})

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
    const retryAfter = body.retry_after ?? (retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined)
    const reason = response.headers.get('X-RateLimit-Reason') || body.reason || 'Rate limit exceeded'

    return {
      code: 'RATE_LIMITED',
      message: body.error || 'Too many requests',
      retry_after: retryAfter,
      details: { ...body, status: response.status, reason },
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

  // Server errors
  return {
    code: 'SERVER_ERROR',
    message: body.error || `HTTP ${response.status}`,
    details: { ...body, status: response.status },
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
    const response = await fetch(`${base}/v1/health`, {
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

  try {
    const idempotencyKey = request.idempotencyKey || request.clientHash

    // Build wire payload without idempotencyKey field (header-only in v1 API)
    const requestForBody: V1RunRequest = {
      ...request,
      idempotencyKey: undefined,
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

    // M1.4: Generate request ID if not provided
    const requestId = options?.requestId || crypto.randomUUID()

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId, // M1.4
      'x-olumi-sdk': 'plot-client/1.0.0', // M1.6
    }

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey
    }

    // M1.5: Add SCM-lite header (takes precedence over query params)
    if (options?.scmLite !== undefined) {
      headers['x-scm-lite'] = options.scmLite ? '1' : '0'
    }

    const response = await fetch(`${base}/v1/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestForBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await mapHttpError(response)
    }

    // Phase 1 Section 4.1: Parse CEE debug headers (dev-only)
    const result: V1SyncRunResponse = await response.json()

    // Parse debug headers if available (may not exist in test mocks)
    if (response.headers) {
      const debugHeaders = parseCeeDebugHeaders(response.headers)
      if (Object.keys(debugHeaders).length > 0) {
        (result as any).__ceeDebugHeaders = debugHeaders
      }
    }

    return result
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw {
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs}ms`,
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
    const response = await fetch(`${base}/v1/run/${runId}/cancel`, {
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
    const response = await fetch(`${base}/v1/templates`, {
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
    const response = await fetch(`${base}/v1/templates/${encodeURIComponent(id)}/graph`, {
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
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${base}/v1/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
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
    const response = await fetch(`${base}/v1/limits`, {
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
