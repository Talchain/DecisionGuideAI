/**
 * useRobustness - Fetches robustness analysis from ISL
 *
 * Brief 10: Data fetch hook for robustness display
 * Brief 12: Updated to call ISL directly via /bff/isl proxy
 * Brief 30: Updated to use correct ISL endpoint and schema
 *
 * Calls POST /bff/isl/api/v1/robustness/analyze endpoint to get:
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
import { buildISLRobustnessRequest, type UINode, type UIEdge } from '../adapters/islRequestAdapter'
import { useCanvasStore } from '../store'

interface UseRobustnessOptions {
  /** Run ID to fetch robustness for (used for caching) */
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

  // Get nodes/edges from store for ISL request
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  // Track last fetched run to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null)

  const fetchRobustness = useCallback(async () => {
    if (!runId) {
      setRobustness(null)
      setError(null)
      return
    }

    // Need nodes to build ISL request
    if (nodes.length === 0) {
      setRobustness(null)
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
      // Brief 30: Build ISL request with correct schema
      // Transform UI nodes/edges to ISL format
      const uiNodes: UINode[] = nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: n.data as any,
      }))
      const uiEdges: UIEdge[] = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data as any,
      }))

      const payload = buildISLRobustnessRequest(uiNodes, uiEdges)

      // DEBUG: Log ISL request payload
      console.log('[useRobustness] ISL request payload:', JSON.stringify(payload, null, 2))

      // Brief 30: Correct endpoint path
      const response = await fetch('/bff/isl/api/v1/robustness/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        // DEBUG: Log error response
        const errorBody = await response.text().catch(() => 'Unable to read response body')
        console.error('[useRobustness] ISL error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        })

        // 404 = endpoint not available, use fallback
        if (response.status === 404) {
          const fallback = generateFallbackRobustness()
          robustnessCache.set(cacheKey, fallback)
          setRobustness(fallback)
          return
        }
        throw new Error(`Failed to fetch robustness: ${response.status} - ${errorBody}`)
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
  }, [runId, responseHash, loading, nodes, edges])

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
