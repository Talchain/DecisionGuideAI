/**
 * Service Health Fetching Utility
 *
 * Fetches health/version information from backend services for observability.
 * Used by the Debug Panel to display service status and versions.
 *
 * Services checked:
 * - BFF (/bff/health)          ← unrouted; see the SERVICE_ENDPOINTS note
 * - CEE (/bff/cee/health)
 * - ISL (/bff/isl/health)
 * - PLoT (/bff/engine/health)
 *
 * Also exposes `collectServiceBuilds()` — the debug bundle's build
 * capture, which records an explicit reason whenever a build is missing.
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
 * ⚠ THE BASE IS A LITERAL (ROADMAP 2.710). The env-resolved form pointed
 * this health probe at PLoT's origin, where /v1/cee/health is not
 * registered (404, measured 2026-08-03) — so the "cee" tile measured a
 * dead path. CEE serves /assist/v1/health behind the same-origin
 * `/bff/cee` edge seam. Guarded by ceeSeamBinding.spec.ts.
 */
const CEE_BASE_URL = '/bff/cee'

/**
 * Service endpoint configuration
 */
/**
 * ⚠ `plot` CORRECTED 2026-09-05 (`/bff/plot/health` → `/bff/engine/health`).
 *
 * There has never been a `/bff/plot/*` route. PLoT is proxied at
 * `/bff/engine/*` (netlify.toml `[[edge_functions]]` → plot-proxy.ts) and
 * `/bff/plot/health` fell through to the SPA catch-all in
 * `public/_redirects` — which answers **HTTP 200, content-type text/html**.
 * A dead proxy path in this repo does not 404; it returns the app's own
 * index page with a success status, so `response.ok` was true, `.json()`
 * threw on `<!doctype html>`, and the catch block filed it as
 * `status: 'unknown'`. The tile has been reporting "unknown" for a service
 * that was healthy the whole time, and no status-code monitor could see it.
 *
 * Derived at the deployed staging UI on 2026-09-05, with fabricated-route
 * contrast controls on both proxies (each returned a real 404, so the
 * proxies genuinely discriminate and these are not blanket-200s):
 *   /bff/cee/health     → 200 application/json  {"commit":"d818ef5", …}
 *   /bff/engine/health  → 200 application/json  {"build":"d37c8cf", …}
 *   /bff/isl/health     → 403 {"error":"Origin not allowed"}  (see below)
 *   /bff/plot/health    → 200 text/html          ← SPA catch-all
 *   /bff/health         → 200 text/html          ← SPA catch-all
 *
 * `bff` is left pointing at its dead path deliberately: unlike PLoT there
 * is no BFF service behind it to point AT, so the honest fix is to retire
 * the tile, which is a bigger change than this one and belongs in its own
 * PR. `probeServiceBuild` below now names the `non_json` failure mode so
 * the condition is at least legible instead of silent.
 */
const SERVICE_ENDPOINTS: Record<ServiceName, string> = {
  bff: '/bff/health',
  cee: `${CEE_BASE_URL}/health`,
  isl: '/bff/isl/health',
  plot: '/bff/engine/health',
}

/**
 * Check if we're in development mode (no actual BFF endpoints)
 * Returns false during tests so health checks can be tested
 */
function isDevEnvironment(): boolean {
  // Don't skip in test mode - let tests control via mocks
  if ((import.meta as any).env?.MODE === 'test' || typeof (globalThis as any).vi !== 'undefined') {
    return false
  }
  const appEnv = (import.meta as any).env?.VITE_APP_ENV || 'development'
  return appEnv === 'development'
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

  // In development, return mock response (no actual BFF endpoints)
  if (isDevEnvironment()) {
    const mockInfo: ServiceHealthInfo = {
      name: service,
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      error: 'Health check skipped in development (no BFF)',
    }
    return mockInfo
  }

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

// ===========================================================================
// Build capture for the debug bundle
// ===========================================================================

/**
 * The three backend services whose build the debug bundle needs.
 *
 * `bff` is excluded on purpose — there is no BFF service behind
 * `/bff/health` (see the note on `SERVICE_ENDPOINTS`), so probing it
 * could only ever manufacture a fourth "unknown".
 */
export type BuildServiceName = Extract<ServiceName, 'cee' | 'plot' | 'isl'>

/** One service's build, and — when there isn't one — why not. */
export interface ServiceBuildCapture {
  /** Short build/commit identifier, or null when the probe failed. */
  build: string | null
  /** Full-length commit SHA when the service publishes one. */
  build_full?: string | null
  /** Semantic version when the service publishes one. */
  version?: string | null
  /**
   * How `build` was obtained. Null when it was not obtained.
   *
   * `health_probe`         — asked the service's own health seam.
   * `client_bundle_stamp`  — read from the UI's own build stamp
   *                          (`dist/version.json`); only the `ui` entry.
   */
  source: 'health_probe' | 'client_bundle_stamp' | null
  /** The seam probed — so a reader can re-run the probe by hand. */
  endpoint: string
  /**
   * Machine-readable reason `build` is null. Absent on success.
   *
   * THE POINT OF THIS FIELD: `builds: {cee: null, plot: null, isl: null}`
   * cannot be told apart from "we never asked". The founder's 2026-09-05
   * bundle had exactly that, which collapsed
   * `schema_versions.consistency_status` to `"unknown"` with reason
   * `"missing_schema_versions"` — so the bundle could not see
   * schema-version skew, this estate's documented dominant risk, and the
   * reader could not tell whether that was a real finding or a gap.
   */
  unavailable_reason?: string
}

export type ServiceBuildCaptureMap = Record<BuildServiceName, ServiceBuildCapture>

const BUILD_PROBE_TIMEOUT_MS = 4000

/**
 * Read a build identifier out of a health body. Each service publishes a
 * different shape, so this is a union of the three ACTUAL shapes, derived
 * live on 2026-09-05 rather than assumed to match:
 *   CEE   /bff/cee/health     {"commit":"d818ef5","version":"1.12.0", …}
 *   PLoT  /bff/engine/health  {"status":"ok","build":"d37c8cf", …}
 *   ISL   /bff/isl/health     {"build":"7781ca4","build_full":"7781ca4f…"}
 */
function readBuildFields(data: Record<string, unknown>): {
  build: string | null
  build_full: string | null
  version: string | null
} {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = data[k]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return null
  }
  return {
    build: pick('build', 'commit', 'git_sha', 'sha', 'release'),
    build_full: pick('build_full', 'commit_full'),
    version: pick('version'),
  }
}

/** Probe one service's health seam for its build. Never throws. */
async function probeServiceBuild(
  service: BuildServiceName,
  fetchImpl: typeof fetch,
): Promise<ServiceBuildCapture> {
  const endpoint = SERVICE_ENDPOINTS[service]
  const base: ServiceBuildCapture = { build: null, source: null, endpoint }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), BUILD_PROBE_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      return { ...base, unavailable_reason: `http_${response.status}` }
    }

    // A dead proxy path is answered by the SPA catch-all with HTTP 200 and
    // text/html. Checking `response.ok` alone therefore proves nothing —
    // this is precisely how `/bff/plot/health` read as a live seam for so
    // long. Name the condition rather than letting `.json()` throw into a
    // generic catch.
    const contentType = response.headers?.get?.('content-type') ?? ''
    if (!contentType.includes('json')) {
      return {
        ...base,
        unavailable_reason: `non_json_response (content-type: ${contentType || 'absent'}) — the path is probably unrouted and answered by the SPA catch-all`,
      }
    }

    const data = (await response.json()) as Record<string, unknown>
    const fields = readBuildFields(data)
    if (fields.build === null) {
      return {
        ...base,
        version: fields.version,
        unavailable_reason: 'no_build_field_in_health_response',
      }
    }
    return {
      build: fields.build,
      build_full: fields.build_full,
      version: fields.version,
      source: 'health_probe',
      endpoint,
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Unknown'
    return {
      ...base,
      unavailable_reason:
        name === 'AbortError'
          ? `timeout_after_${BUILD_PROBE_TIMEOUT_MS}ms`
          : `fetch_failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}

/**
 * Capture cee/plot/isl builds in parallel for the debug bundle.
 *
 * Deliberately bypasses `fetchServiceHealth`'s cache and its
 * `isDevEnvironment()` short-circuit: a bundle records what was true at
 * export time, so a 30-second-old cached answer is the wrong answer, and
 * a mocked "skipped in development" placeholder is worse than a probe
 * that honestly fails.
 *
 * Never rejects — a failed probe becomes an `unavailable_reason`, because
 * the export path must not be able to fail on a diagnostic nicety.
 */
export async function collectServiceBuilds(options?: {
  fetchImpl?: typeof fetch
}): Promise<ServiceBuildCaptureMap> {
  const fetchImpl =
    options?.fetchImpl ??
    (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined)

  const services: BuildServiceName[] = ['cee', 'plot', 'isl']

  if (!fetchImpl) {
    return Object.fromEntries(
      services.map((s) => [
        s,
        {
          build: null,
          source: null,
          endpoint: SERVICE_ENDPOINTS[s],
          unavailable_reason: 'fetch_unavailable_in_this_environment',
        },
      ]),
    ) as ServiceBuildCaptureMap
  }

  const results = await Promise.all(
    services.map((s) => probeServiceBuild(s, fetchImpl)),
  )
  return Object.fromEntries(
    services.map((s, i) => [s, results[i]]),
  ) as ServiceBuildCaptureMap
}
