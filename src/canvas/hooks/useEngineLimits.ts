/**
 * Engine Limits Hook — Singleton Pattern
 *
 * Provides a centralized way to fetch and access engine capacity limits.
 * Module-level singleton ensures only ONE fetch cycle runs regardless of
 * how many components call useEngineLimits(). State is stored in the
 * canvas Zustand store so all consumers share the same values.
 *
 * Features:
 * - Returns error state so consumers can surface limits unavailability
 * - Exposes source ('live' | 'fallback' | null) to prevent silent masking
 * - Implements exponential backoff retry (3 attempts: 0s, 2s, 5s)
 * - Refreshes on tab visibility change (single listener)
 */

import { useCallback } from 'react'
import { plot } from '../../adapters/plot'
import type { LimitsFetch } from '../../adapters/plot/types'
import { useCanvasStore } from '../store'

export interface UseEngineLimitsReturn {
  limits: ReturnType<typeof useCanvasStore.getState>['engineLimits']
  source: ReturnType<typeof useCanvasStore.getState>['engineLimitsSource']
  loading: boolean
  error: Error | null
  fetchedAt: number | null
  /** Retry fetching limits (useful for manual refresh) */
  retry: () => void
}

// ── Singleton state (module-scoped) ──────────────────────────────

const RETRY_DELAYS = [0, 2000, 5000] // Exponential backoff: immediate, 2s, 5s
const VISIBILITY_COOLDOWN_MS = 1000 // Minimum 1s between visibility-triggered fetches
const MAX_FETCH_COUNT = 3 // Maximum fetches per session to prevent runaway loops
const FALLBACK_LIMITS = { nodes: { max: 50 }, edges: { max: 100 } }

let initialized = false
let inFlight = false
let fallbackActive = false
let fetchCount = 0
let lastVisibilityFetch = 0
let abortController: AbortController | null = null

async function fetchLimitsWithRetry() {
  const store = useCanvasStore.getState()

  if (fallbackActive) {
    fetchCount = 0
    return
  }

  // Safety guard: prevent runaway fetch loops (React #185)
  fetchCount += 1
  if (fetchCount > MAX_FETCH_COUNT) {
    if (import.meta.env.DEV) {
      console.warn('[useEngineLimits] Max fetch count reached, stopping retries')
    }
    fetchCount = 0
    store.setEngineLimitsLoading(false)
    return
  }

  store.setEngineLimitsLoading(true)

  if (inFlight && abortController) {
    abortController.abort()
  }

  const controller = new AbortController()
  abortController = controller
  inFlight = true

  const adapter = plot as any
  if (!adapter.limits || typeof adapter.limits !== 'function') {
    const err = new Error('Limits endpoint not available in adapter')
    store.setEngineLimits(null, null, null, err)
    fetchCount = 0
    return
  }

  // Retry with exponential backoff
  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
    }

    try {
      if (controller.signal.aborted) {
        inFlight = false
        store.setEngineLimitsLoading(false)
        fetchCount = 0
        return
      }

      const result: LimitsFetch = await (adapter.limits.length > 0
        ? adapter.limits({ signal: controller.signal })
        : adapter.limits())

      if (result.ok) {
        store.setEngineLimits(result.data, result.source, result.fetchedAt)
        fetchCount = 0

        if (import.meta.env.DEV && result.source === 'fallback') {
          console.warn('[useEngineLimits] Using fallback limits:', (result as any).reason)
        }

        if (result.source === 'fallback') {
          fallbackActive = true
        }

        inFlight = false
        return // Success
      } else {
        // Error result — continue to next retry or fall back
        if (attempt === RETRY_DELAYS.length - 1) {
          store.setEngineLimits(FALLBACK_LIMITS, 'fallback', result.fetchedAt)
          fallbackActive = true
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        inFlight = false
        store.setEngineLimitsLoading(false)
        fetchCount = 0
        return
      }
      if (attempt === RETRY_DELAYS.length - 1) {
        if (import.meta.env.DEV) {
          const error = err instanceof Error ? err : new Error(String(err))
          console.warn('[useEngineLimits] Failed after', RETRY_DELAYS.length, 'attempts:', error)
        }
        store.setEngineLimits(FALLBACK_LIMITS, 'fallback', null)
        fallbackActive = true
      }
      // Continue to next retry
    }
  }

  store.setEngineLimitsLoading(false)
  inFlight = false
}

function handleVisibilityChange() {
  const store = useCanvasStore.getState()
  if (document.visibilityState === 'visible' && !store.engineLimitsLoading && !fallbackActive) {
    const now = Date.now()
    if (now - lastVisibilityFetch < VISIBILITY_COOLDOWN_MS) {
      if (import.meta.env.DEV) {
        console.log('[useEngineLimits] Visibility change ignored (cooldown active)')
      }
      return
    }
    lastVisibilityFetch = now

    if (import.meta.env.DEV) {
      console.log('[useEngineLimits] Tab became visible, refreshing limits...')
    }
    fetchLimitsWithRetry()
  }
}

/**
 * Idempotent initialisation — first call triggers fetch + visibility listener.
 * Subsequent calls are no-ops.
 */
function initEngineLimitsFetch() {
  if (initialized) return
  initialized = true
  fetchLimitsWithRetry()
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

/** Reset singleton state for testing */
export function __resetForTesting() {
  initialized = false
  inFlight = false
  fallbackActive = false
  fetchCount = 0
  lastVisibilityFetch = 0
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

// ── Hook (thin accessor) ─────────────────────────────────────────

export function useEngineLimits(): UseEngineLimitsReturn {
  // Trigger singleton init on first hook call
  initEngineLimitsFetch()

  const limits = useCanvasStore((s) => s.engineLimits)
  const source = useCanvasStore((s) => s.engineLimitsSource)
  const loading = useCanvasStore((s) => s.engineLimitsLoading)
  const error = useCanvasStore((s) => s.engineLimitsError)
  const fetchedAt = useCanvasStore((s) => s.engineLimitsFetchedAt)

  const retry = useCallback(() => {
    fetchCount = 0
    fallbackActive = false
    fetchLimitsWithRetry()
  }, [])

  return { limits, source, loading, error, fetchedAt, retry }
}
