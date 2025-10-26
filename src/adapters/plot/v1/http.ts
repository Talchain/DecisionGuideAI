/**
 * PLoT v1 HTTP client (via proxy)
 * All calls go through /api/plot proxy; server adds auth headers
 */

import type {
  V1HealthResponse,
  V1RunRequest,
  V1SyncRunResponse,
  V1Error,
} from './types'

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || '/api/plot'
}

const getTimeouts = () => ({
  sync: parseInt(import.meta.env.VITE_PLOT_SYNC_TIMEOUT_MS || '10000', 10),
  stream: parseInt(import.meta.env.VITE_PLOT_STREAM_TIMEOUT_MS || '120000', 10),
})

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

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    return {
      code: 'RATE_LIMITED',
      message: body.error || 'Too many requests',
      retry_after: retryAfter ? parseInt(retryAfter, 10) : undefined,
      details: body,
    }
  }

  // Handle bad input
  if (response.status === 400) {
    return {
      code: 'BAD_INPUT',
      message: body.error || 'Invalid input',
      field: body.fields?.field,
      max: body.fields?.max,
      details: body,
    }
  }

  // Handle limit exceeded
  if (response.status === 413 || body.code === 'LIMIT_EXCEEDED') {
    return {
      code: 'LIMIT_EXCEEDED',
      message: body.error || 'Request exceeds limits',
      field: body.fields?.field,
      max: body.fields?.max,
      details: body,
    }
  }

  // Server errors
  return {
    code: 'SERVER_ERROR',
    message: body.error || `HTTP ${response.status}`,
    details: body,
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
 * POST /v1/run (sync)
 */
export async function runSync(
  request: V1RunRequest,
  options?: { timeoutMs?: number; signal?: AbortSignal }
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
    const response = await fetch(`${base}/v1/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey && {
          'Idempotency-Key': idempotencyKey,
        }),
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
