/**
 * useRobustness - Fetches robustness analysis from ISL
 *
 * Brief 10: Data fetch hook for robustness display
 * Brief 12: Updated to call ISL directly via /bff/isl proxy
 * Brief 30: Updated to use correct ISL endpoint and schema
 *
 * Calls POST /bff/isl/api/v1/analysis/robustness endpoint to get:
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

      // Brief I Task 7: Enhanced debug logging for ISL diagnostics
      if (import.meta.env.DEV) {
        const factorNodes = uiNodes.filter(n => n.type === 'factor')
        const optionNodes = uiNodes.filter(n => n.type === 'option' || n.type === 'decision')
        const goalNode = uiNodes.find(n => n.type === 'goal' || n.type === 'outcome')

        console.group('[useRobustness] ISL Request Diagnostics')
        console.log('Total nodes:', uiNodes.length)
        console.log('Factor nodes:', factorNodes.length)
        factorNodes.forEach(f => {
          console.log(`  - Factor "${f.id}":`, { hasData: !!f.data, data: f.data })
        })
        console.log('Option nodes:', optionNodes.length)
        optionNodes.forEach(o => {
          console.log(`  - Option "${o.id}":`, { hasData: !!o.data, data: o.data })
        })
        console.log('Goal node:', goalNode ? `"${goalNode.id}"` : 'MISSING', goalNode?.data)
        console.groupEnd()
      }

      const payload = buildISLRobustnessRequest(uiNodes, uiEdges)

      // Brief I Task 5: Validate request before sending (with smarter option checking)
      if (import.meta.env.DEV) {
        const issues: string[] = []

        // Count option/decision nodes in the canvas (not the extracted options)
        const optionDecisionNodes = uiNodes.filter(n =>
          n.type === 'option' || n.type === 'decision'
        )

        // Brief I Task 5: Only warn about options if user has option/decision nodes but extraction failed
        // Having just 1 baseline option is valid when there are no option/decision nodes on canvas
        if (optionDecisionNodes.length >= 2 && (!payload.options || payload.options.length < 2)) {
          issues.push(`Found ${optionDecisionNodes.length} option/decision nodes but only extracted ${payload.options?.length || 0} options`)
        }

        if (!payload.utility?.goal_node_id) {
          issues.push('Missing goal_node_id in utility')
        }
        if (!payload.parameter_uncertainties || Object.keys(payload.parameter_uncertainties).length === 0) {
          issues.push('Missing parameter_uncertainties (from factor nodes)')
        }

        console.group('[useRobustness] ISL Request Validation')
        console.log('Endpoint:', '/bff/isl/api/v1/analysis/robustness')
        console.log('Canvas option/decision nodes:', optionDecisionNodes.length)
        console.log('Extracted options count:', payload.options?.length)
        console.log('Parameter uncertainties:', Object.keys(payload.parameter_uncertainties || {}))
        console.log('Goal node ID:', payload.utility?.goal_node_id)
        if (issues.length > 0) {
          console.warn('Request issues:', issues)
        } else {
          console.log('Request validation: PASSED')
        }
        console.log('Full payload:', payload)
        console.groupEnd()
      }

      // Brief F Task 1: Correct endpoint path
      const response = await fetch('/bff/isl/api/v1/analysis/robustness', {
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

      // Brief I Task 7: Log response data
      if (import.meta.env.DEV) {
        console.group('[useRobustness] ISL Response')
        console.log('Status:', response.status)
        console.log('Raw data:', data)
        console.log('Has sensitivity:', Array.isArray(data.sensitivity) && data.sensitivity.length > 0)
        console.log('Sensitivity count:', data.sensitivity?.length ?? 0)
        console.log('Has robustness_bounds:', Array.isArray(data.robustness_bounds))
        console.log('Has value_of_information:', Array.isArray(data.value_of_information))
        console.log('Robustness label:', data.robustness_label)
        console.groupEnd()
      }

      // Use adapter to transform ISL response to UI format
      const result = adaptISLRobustnessResponse(data)

      if (import.meta.env.DEV) {
        console.log('[useRobustness] Adapted result:', result)
      }

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
