/**
 * PLoT v1 HTTP client (via proxy)
 * All calls go through /api/plot proxy; server adds auth headers
 */

import type {
  V1HealthResponse,
  V1Error,
  V1TemplateListResponse,
  V1TemplateGraphResponse,
  V1LimitsResponse,
} from './types'
import { plotFetch } from '../../../lib/plotFetch'

const getProxyBase = (): string => {
  return import.meta.env?.VITE_PLOT_PROXY_BASE || '/bff/engine'
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

