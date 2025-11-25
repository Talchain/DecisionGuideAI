/**
 * Engine Limits Hook (Sprint 1 & 2 Finalisation)
 *
 * Provides a centralized way to fetch and access engine capacity limits.
 * Replaces duplicated plot.limits() calls across CanvasToolbar, ReactFlowGraph,
 * and useBlueprintInsert.
 *
 * Features:
 * - Returns error state so consumers can surface limits unavailability
 * - Exposes source ('live' | 'fallback' | null) to prevent silent masking
 * - Implements exponential backoff retry (3 attempts: 0s, 2s, 5s)
 * - Refreshes on tab visibility change
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { plot } from '../../adapters/plot'
import type { LimitsV1, LimitsFetch } from '../../adapters/plot/types'

export interface UseEngineLimitsReturn {
  limits: LimitsV1 | null
  source: 'live' | 'fallback' | null
  loading: boolean
  error: Error | null
  fetchedAt: number | null
  /** Retry fetching limits (useful for manual refresh) */
  retry: () => void
}

const RETRY_DELAYS = [0, 2000, 5000] // Exponential backoff: immediate, 2s, 5s
const VISIBILITY_COOLDOWN_MS = 10000 // Minimum 10s between visibility-triggered fetches
const MAX_FETCH_COUNT = 10 // Maximum fetches per session to prevent runaway loops

export function useEngineLimits(): UseEngineLimitsReturn {
  const [limits, setLimits] = useState<LimitsV1 | null>(null)
  const [source, setSource] = useState<'live' | 'fallback' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  // Use ref to track loading state in event handler to avoid stale closure
  // and prevent useEffect from re-running when loading changes
  const loadingRef = useRef(loading)
  loadingRef.current = loading

  // Track last visibility fetch and total fetch count to prevent runaway loops
  const lastVisibilityFetchRef = useRef<number>(0)
  const fetchCountRef = useRef<number>(0)

  const fetchLimitsWithRetry = useCallback(async () => {
    // Safety guard: prevent runaway fetch loops (React #185)
    fetchCountRef.current += 1
    if (fetchCountRef.current > MAX_FETCH_COUNT) {
      if (import.meta.env.DEV) {
        console.warn('[useEngineLimits] Max fetch count reached, stopping retries')
      }
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const adapter = plot as any
    if (!adapter.limits || typeof adapter.limits !== 'function') {
      const err = new Error('Limits endpoint not available in adapter')
      setError(err)
      setLoading(false)
      return
    }

    // Retry with exponential backoff
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
      }

      try {
        const result: LimitsFetch = await adapter.limits()

        if (result.ok) {
          setLimits(result.data)
          setSource(result.source)
          setFetchedAt(result.fetchedAt)
          setError(null)

          if (import.meta.env.DEV && result.source === 'fallback') {
            console.warn('[useEngineLimits] Using fallback limits:', (result as any).reason)
          }

          setLoading(false)
          return // Success
        } else {
          // Error result
          if (attempt === RETRY_DELAYS.length - 1) {
            // Final attempt failed
            setError(result.error)
            setLimits(null)
            setSource(null)
            setFetchedAt(result.fetchedAt)
          }
          // Continue to next retry
        }
      } catch (err) {
        if (attempt === RETRY_DELAYS.length - 1) {
          // Final attempt failed
          const error = err instanceof Error ? err : new Error(String(err))
          console.warn('[useEngineLimits] Failed after', RETRY_DELAYS.length, 'attempts:', error)
          setError(error)
          setLimits(null)
          setSource(null)
        }
        // Continue to next retry
      }
    }

    setLoading(false)
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchLimitsWithRetry()
  }, [fetchLimitsWithRetry])

  // Refresh on tab visibility change
  // Note: Use loadingRef instead of loading state to avoid effect re-running
  // on every loading change, which can cause infinite render loops (React #185)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loadingRef.current) {
        // Safety guard: enforce cooldown between visibility-triggered fetches
        const now = Date.now()
        if (now - lastVisibilityFetchRef.current < VISIBILITY_COOLDOWN_MS) {
          if (import.meta.env.DEV) {
            console.log('[useEngineLimits] Visibility change ignored (cooldown active)')
          }
          return
        }
        lastVisibilityFetchRef.current = now

        if (import.meta.env.DEV) {
          console.log('[useEngineLimits] Tab became visible, refreshing limits...')
        }
        fetchLimitsWithRetry()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchLimitsWithRetry])

  return { limits, source, loading, error, fetchedAt, retry: fetchLimitsWithRetry }
}
