/**
 * Service Health Fetching Utility
 *
 * Fetches health/version information from backend services for observability.
 * Used by the Debug Panel to display service status and versions.
 *
 * Services checked:
 * - BFF (/bff/health)
 * - CEE (/bff/cee/health)
 * - ISL (/bff/isl/health)
 * - PLoT (/bff/plot/health)
 *
 * @example
 * ```typescript
 * import { fetchServiceHealth, getAllServiceHealth } from '@/lib/service-health'
 *
 * // Fetch single service
 * const bffHealth = await fetchServiceHealth('bff')
 *
 * // Fetch all services
 * const allHealth = await getAllServiceHealth()
 * ```
 */

/**
 * Service names
 */
export type ServiceName = 'bff' | 'cee' | 'isl' | 'plot'

/**
 * Service health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

/**
 * Service health response
 */
export interface ServiceHealthInfo {
  /** Service name */
  name: ServiceName
  /** Health status */
  status: HealthStatus
  /** Service version/build */
  version?: string
  /** Git commit SHA */
  commit?: string
  /** Uptime in seconds */
  uptime?: number
  /** Last check timestamp (ISO 8601) */
  checkedAt: string
  /** Response time in milliseconds */
  responseTimeMs?: number
  /** Error message if failed */
  error?: string
  /** Additional metadata from health response */
  metadata?: Record<string, unknown>
}

/**
 * Service endpoint configuration
 */
const SERVICE_ENDPOINTS: Record<ServiceName, string> = {
  bff: '/bff/health',
  cee: '/bff/cee/health',
  isl: '/bff/isl/health',
  plot: '/bff/plot/health',
}

/**
 * Timeout for health checks (ms)
 */
const HEALTH_CHECK_TIMEOUT = 5000

/**
 * Cache for health responses
 */
const healthCache = new Map<ServiceName, { data: ServiceHealthInfo; expiresAt: number }>()

/**
 * Cache TTL in milliseconds
 */
const CACHE_TTL = 30000 // 30 seconds

/**
 * Fetch health info for a single service
 *
 * @param service - Service to check
 * @param options - Fetch options
 * @returns Service health info
 */
export async function fetchServiceHealth(
  service: ServiceName,
  options?: { skipCache?: boolean; signal?: AbortSignal }
): Promise<ServiceHealthInfo> {
  const now = Date.now()

  // Check cache first
  if (!options?.skipCache) {
    const cached = healthCache.get(service)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }
  }

  const endpoint = SERVICE_ENDPOINTS[service]
  const startTime = now

  try {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: options?.signal || controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    clearTimeout(timeoutId)

    const responseTimeMs = Date.now() - startTime

    if (!response.ok) {
      const healthInfo: ServiceHealthInfo = {
        name: service,
        status: response.status >= 500 ? 'down' : 'degraded',
        checkedAt: new Date().toISOString(),
        responseTimeMs,
        error: `HTTP ${response.status}`,
      }
      healthCache.set(service, { data: healthInfo, expiresAt: now + CACHE_TTL })
      return healthInfo
    }

    const data = await response.json()

    // Parse common health response formats
    const healthInfo: ServiceHealthInfo = {
      name: service,
      status: parseHealthStatus(data),
      version: data.version || data.build || data.release,
      commit: data.commit || data.git_sha || data.sha,
      uptime: data.uptime || data.uptime_seconds,
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      metadata: data,
    }

    healthCache.set(service, { data: healthInfo, expiresAt: now + CACHE_TTL })
    return healthInfo
  } catch (error) {
    const responseTimeMs = Date.now() - startTime
    const healthInfo: ServiceHealthInfo = {
      name: service,
      status: error instanceof Error && error.name === 'AbortError' ? 'down' : 'unknown',
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    }

    // Cache failures with shorter TTL
    healthCache.set(service, { data: healthInfo, expiresAt: now + CACHE_TTL / 2 })
    return healthInfo
  }
}

/**
 * Parse health status from response data
 */
function parseHealthStatus(data: unknown): HealthStatus {
  if (!data || typeof data !== 'object') return 'unknown'

  const obj = data as Record<string, unknown>

  // Common health response patterns
  if (obj.status === 'ok' || obj.status === 'healthy' || obj.healthy === true) {
    return 'healthy'
  }
  if (obj.status === 'degraded' || obj.degraded === true) {
    return 'degraded'
  }
  if (obj.status === 'down' || obj.status === 'unhealthy' || obj.healthy === false) {
    return 'down'
  }

  // If we got a response, assume healthy
  return 'healthy'
}

/**
 * Fetch health info for all services in parallel
 *
 * @param options - Fetch options
 * @returns Map of service health info
 */
export async function getAllServiceHealth(options?: {
  skipCache?: boolean
  signal?: AbortSignal
}): Promise<Map<ServiceName, ServiceHealthInfo>> {
  const services: ServiceName[] = ['bff', 'cee', 'isl', 'plot']
  const results = await Promise.all(services.map((s) => fetchServiceHealth(s, options)))

  const healthMap = new Map<ServiceName, ServiceHealthInfo>()
  for (const result of results) {
    healthMap.set(result.name, result)
  }

  return healthMap
}

/**
 * Get all service health as array (for easier iteration)
 */
export async function getAllServiceHealthArray(options?: {
  skipCache?: boolean
  signal?: AbortSignal
}): Promise<ServiceHealthInfo[]> {
  const map = await getAllServiceHealth(options)
  return Array.from(map.values())
}

/**
 * Get cached health info without fetching
 */
export function getCachedHealth(service: ServiceName): ServiceHealthInfo | null {
  const cached = healthCache.get(service)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }
  return null
}

/**
 * Clear health cache (for testing)
 * @internal
 */
export function _clearHealthCache(): void {
  healthCache.clear()
}

/**
 * Check if any service is down
 */
export function isAnyServiceDown(healthMap: Map<ServiceName, ServiceHealthInfo>): boolean {
  for (const info of healthMap.values()) {
    if (info.status === 'down') return true
  }
  return false
}

/**
 * Check if any service is degraded
 */
export function isAnyServiceDegraded(healthMap: Map<ServiceName, ServiceHealthInfo>): boolean {
  for (const info of healthMap.values()) {
    if (info.status === 'degraded' || info.status === 'down') return true
  }
  return false
}

/**
 * Get overall system health status
 */
export function getOverallHealth(healthMap: Map<ServiceName, ServiceHealthInfo>): HealthStatus {
  let hasUnknown = false
  let hasDegraded = false

  for (const info of healthMap.values()) {
    if (info.status === 'down') return 'down'
    if (info.status === 'degraded') hasDegraded = true
    if (info.status === 'unknown') hasUnknown = true
  }

  if (hasDegraded) return 'degraded'
  if (hasUnknown) return 'unknown'
  return 'healthy'
}
