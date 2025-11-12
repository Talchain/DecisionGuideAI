/**
 * PLoT Engine Limits Client (M1.2)
 * Fetches and caches engine limits from GET /v1/limits
 *
 * AUDIT FIX 1: Proxy alignment - now defaults to /api/plot instead of direct Render URL
 * AUDIT FIX 2: SSR safety - guards sessionStorage access for non-browser environments
 */

import type { V1LimitsResponse } from './types'

/**
 * Get proxy base URL, aligned with http.ts pattern
 * Defaults to /api/plot to go through hardened proxy (CORS, auth, rate limits)
 */
const getProxyBase = (): string => {
  return import.meta.env.VITE_PLOT_PROXY_BASE || '/api/plot'
}

const CACHE_KEY = 'plot_limits_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface CachedLimits {
  data: V1LimitsResponse
  timestamp: number
}

/**
 * SSR-safe sessionStorage wrapper
 * Returns null in non-browser environments instead of throwing
 */
const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return null
    }
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return
    }
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // Ignore (quota exceeded, private mode, etc.)
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return
    }
    try {
      sessionStorage.removeItem(key)
    } catch {
      // Ignore
    }
  },
}

/**
 * Fetch limits from engine with 1-hour cache
 * Falls back to defaults if fetch fails
 */
export async function fetchLimits(): Promise<V1LimitsResponse> {
  // Check cache first (SSR-safe)
  try {
    const cached = safeSessionStorage.getItem(CACHE_KEY)
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
    // Ignore cache errors (JSON parse, etc.)
  }

  // Fetch fresh limits through proxy
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

    // Cache for 1 hour (SSR-safe)
    try {
      const cache: CachedLimits = {
        data,
        timestamp: Date.now(),
      }
      safeSessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
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
 * SSR-safe
 */
export function clearLimitsCache(): void {
  safeSessionStorage.removeItem(CACHE_KEY)
}
