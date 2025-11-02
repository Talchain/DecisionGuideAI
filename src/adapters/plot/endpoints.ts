/**
 * PLoT API Endpoints
 *
 * Centralized endpoint definitions for all PLoT V1 API routes.
 *
 * **IMPORTANT**:
 * - All endpoints go through the Vite proxy: `/api/plot/v1/*`
 * - Proxy rewrites to backend (strips `/api/plot` prefix)
 * - Never use direct URLs (CORS issues)
 * - Never hardcode `/v1/...` paths outside this file
 *
 * Usage:
 * ```ts
 * import { PLOT_ENDPOINTS } from './endpoints'
 *
 * fetch(PLOT_ENDPOINTS.health())
 * fetch(PLOT_ENDPOINTS.run(), { method: 'POST', body: ... })
 * ```
 */

/**
 * Proxy base path (configured in vite.config.ts)
 */
export const PLOT_PROXY_BASE = '/api/plot'

/**
 * Get proxy base (allows override via env)
 */
function getProxyBase(): string {
  return import.meta.env.VITE_PLOT_PROXY_BASE || PLOT_PROXY_BASE
}

/**
 * PLoT V1 Endpoints
 */
export const PLOT_ENDPOINTS = {
  /**
   * GET /v1/health
   * Health check and backend status
   */
  health: (): string => {
    return `${getProxyBase()}/v1/health`
  },

  /**
   * GET /v1/limits
   * Dynamic graph size limits
   */
  limits: (): string => {
    return `${getProxyBase()}/v1/limits`
  },

  /**
   * POST /v1/validate
   * Pre-flight validation (optional)
   */
  validate: (): string => {
    return `${getProxyBase()}/v1/validate`
  },

  /**
   * POST /v1/run
   * Synchronous run (returns full report)
   */
  run: (): string => {
    return `${getProxyBase()}/v1/run`
  },

  /**
   * POST /v1/stream
   * Server-Sent Events streaming run
   */
  stream: (): string => {
    return `${getProxyBase()}/v1/stream`
  },

  /**
   * GET /v1/templates
   * List available templates
   */
  templates: (): string => {
    return `${getProxyBase()}/v1/templates`
  },

  /**
   * GET /v1/templates/:id
   * Get specific template metadata
   */
  template: (id: string): string => {
    return `${getProxyBase()}/v1/templates/${encodeURIComponent(id)}`
  },

  /**
   * GET /v1/templates/:id/graph
   * Get template graph structure
   */
  templateGraph: (id: string): string => {
    return `${getProxyBase()}/v1/templates/${encodeURIComponent(id)}/graph`
  },

  /**
   * POST /v1/share
   * Create shareable link (if backend supports)
   */
  share: (): string => {
    return `${getProxyBase()}/v1/share`
  },

  /**
   * GET /v1/share/:id
   * Resolve shared run
   */
  resolveShare: (id: string): string => {
    return `${getProxyBase()}/v1/share/${encodeURIComponent(id)}`
  }
} as const

/**
 * Helper: Build endpoint with query params
 */
export function withQuery(endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.append(key, String(value))
    }
  })

  const queryString = search.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}

/**
 * Legacy compatibility (deprecated - use PLOT_ENDPOINTS instead)
 * @deprecated Use PLOT_ENDPOINTS.health() instead
 */
export function getHealthEndpoint(): string {
  return PLOT_ENDPOINTS.health()
}

/**
 * Legacy compatibility (deprecated - use PLOT_ENDPOINTS instead)
 * @deprecated Use PLOT_ENDPOINTS.run() instead
 */
export function getRunEndpoint(): string {
  return PLOT_ENDPOINTS.run()
}

/**
 * Legacy compatibility (deprecated - use PLOT_ENDPOINTS instead)
 * @deprecated Use PLOT_ENDPOINTS.stream() instead
 */
export function getStreamEndpoint(): string {
  return PLOT_ENDPOINTS.stream()
}
