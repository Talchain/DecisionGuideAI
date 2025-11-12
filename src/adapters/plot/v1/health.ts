/**
 * PLoT Engine Health Probe (M1.1)
 *
 * Probes engine health using HEAD /v1/run
 * Returns 204 = healthy, anything else = unhealthy
 */

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || 'https://plot-lite-service.onrender.com'
}

export type HealthStatus = 'healthy' | 'unhealthy'

/**
 * Probe PLoT engine health via HEAD /v1/run
 * @returns 'healthy' if 204, 'unhealthy' otherwise
 */
export async function probeHealth(): Promise<HealthStatus> {
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${base}/v1/run`, {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 204 No Content = healthy
    if (response.status === 204) {
      return 'healthy'
    }

    // Any other status = unhealthy (including 405 Method Not Allowed, 404, etc.)
    return 'unhealthy'
  } catch (err) {
    clearTimeout(timeoutId)

    // Network errors, timeouts = unhealthy
    if (import.meta.env.DEV) {
      console.warn('[health] Probe failed:', err)
    }
    return 'unhealthy'
  }
}
