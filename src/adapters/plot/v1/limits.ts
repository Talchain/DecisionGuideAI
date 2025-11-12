/**
 * PLoT Engine Limits Client (M1.2)
 * Fetches and caches engine limits from GET /v1/limits
 */

import type { V1LimitsResponse } from './types'

const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || 'https://plot-lite-service.onrender.com'
}

const CACHE_KEY = 'plot_limits_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CachedLimits {
  data: V1LimitsResponse
  timestamp: number
}

/**
 * Fetch limits from engine with 1-hour cache
 */
export async function fetchLimits(): Promise<V1LimitsResponse> {
  // Check cache first
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed: CachedLimits = JSON.parse(cached)
      const age = Date.now() - parsed.timestamp
      if (age < CACHE_TTL_MS) {
        if (import.meta.env.DEV) {
          console.log('[limits] Using cached limits:', parsed.data)
        }
        return parsed.data
      }
    }
  } catch {
    // Ignore cache errors
  }

  // Fetch fresh limits
  const base = getProxyBase()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${base}/v1/limits`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: V1LimitsResponse = await response.json()

    // Cache for 1 hour
    try {
      const cache: CachedLimits = {
        data,
        timestamp: Date.now(),
      }
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
      // Ignore cache errors
    }

    if (import.meta.env.DEV) {
      console.log('[limits] Fetched fresh limits:', data)
    }

    return data
  } catch (err) {
    clearTimeout(timeoutId)

    // Return defaults if fetch fails
    const fallback: V1LimitsResponse = {
      schema: 'limits.v1',
      max_nodes: 50,
      max_edges: 200,
      max_body_kb: 96,
      rate_limit_rpm: 60,
      flags: { scm_lite: 1 },
    }

    if (import.meta.env.DEV) {
      console.warn('[limits] Fetch failed, using defaults:', err)
    }

    return fallback
  }
}

/**
 * Clear limits cache (for manual refresh)
 */
export function clearLimitsCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore
  }
}
