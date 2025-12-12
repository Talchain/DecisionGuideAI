/**
 * useRobustness - Fetches robustness analysis from ISL
 *
 * Brief 10: Data fetch hook for robustness display
 * Brief 12: Updated to call ISL directly via /bff/isl proxy
 *
 * Calls /bff/isl/api/v1/analysis/robustness endpoint to get:
 * - Robustness classification (robust/moderate/fragile)
 * - Sensitive parameters with flip thresholds
 * - Value of Information suggestions
 * - Pareto analysis for multi-goal decisions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RobustnessResult } from '../components/RecommendationCard/types'
import {
  adaptISLRobustnessResponse,
  generateFallbackRobustness,
} from '../adapters/islRobustnessAdapter'

interface UseRobustnessOptions {
  /** Run ID to fetch robustness for */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
}

interface UseRobustnessResult {
  /** The robustness data if available */
  robustness: RobustnessResult | null
  /** Loading state */
  loading: boolean
  /** Error message if request failed */
  error: string | null
  /** Manual refresh function */
  refetch: () => Promise<void>
}

// Simple in-memory cache for robustness results (keyed by runId+responseHash)
const robustnessCache = new Map<string, RobustnessResult>()

export function useRobustness({
  runId,
  responseHash,
  autoFetch = true,
}: UseRobustnessOptions): UseRobustnessResult {
  const [robustness, setRobustness] = useState<RobustnessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track last fetched run to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null)

  const fetchRobustness = useCallback(async () => {
    if (!runId) {
      setRobustness(null)
      setError(null)
      return
    }

    const cacheKey = `${runId}-${responseHash || ''}`

    // Check cache first
    const cached = robustnessCache.get(cacheKey)
    if (cached) {
      setRobustness(cached)
      return
    }

    // Prevent duplicate fetches
    if (loading || cacheKey === lastFetchedRef.current) {
      return
    }

    lastFetchedRef.current = cacheKey
    setLoading(true)
    setError(null)

    try {
      const payload = {
        run_id: runId,
        response_hash: responseHash,
        include_sensitivity: true,
        include_voi: true,
        include_pareto: true,
      }

      const response = await fetch('/bff/isl/api/v1/analysis/robustness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        // 404 = endpoint not available, use fallback
        if (response.status === 404) {
          const fallback = generateFallbackRobustness()
          robustnessCache.set(cacheKey, fallback)
          setRobustness(fallback)
          return
        }
        throw new Error(`Failed to fetch robustness: ${response.status}`)
      }

      const data = await response.json()

      // Use adapter to transform ISL response to UI format
      const result = adaptISLRobustnessResponse(data)

      // Cache the result
      robustnessCache.set(cacheKey, result)
      setRobustness(result)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch robustness analysis'
      setError(errorMessage)

      // Generate fallback on error
      const fallback = generateFallbackRobustness()
      setRobustness(fallback)

      if (import.meta.env.DEV) {
        console.warn('[useRobustness] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, loading])

  // Auto-fetch when runId changes
  useEffect(() => {
    const cacheKey = `${runId}-${responseHash || ''}`
    if (autoFetch && runId && cacheKey !== lastFetchedRef.current) {
      fetchRobustness()
    }
  }, [autoFetch, runId, responseHash, fetchRobustness])

  return {
    robustness,
    loading,
    error,
    refetch: fetchRobustness,
  }
}

/**
 * Clear the robustness cache (useful for testing)
 */
export function clearRobustnessCache(): void {
  robustnessCache.clear()
}

export default useRobustness
