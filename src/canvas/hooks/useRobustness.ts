/**
 * useRobustness - Fetches robustness analysis from PLoT enrichment or ISL
 *
 * Brief 10: Data fetch hook for robustness display
 * Brief 12: Updated to call ISL directly via /bff/isl proxy
 * Brief 30: Updated to use correct ISL endpoint and schema
 * Phase 1B: Added PLoT enrichment support via VITE_USE_PLOT_ENRICHMENT flag
 *
 * When VITE_USE_PLOT_ENRICHMENT is enabled:
 * - Extracts robustness from PLoT enrichment
 * - Does NOT fall back to ISL (eliminates dual-pipeline)
 * - If enrichment unavailable, returns fallback data
 *
 * When VITE_USE_PLOT_ENRICHMENT is disabled (legacy):
 * - Calls POST /bff/isl/api/v1/analysis/robustness endpoint to get:
 *   - Robustness classification (robust/moderate/fragile)
 *   - Sensitive parameters with flip thresholds
 *   - Value of Information suggestions
 *   - Pareto analysis for multi-goal decisions
 */

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import type { RobustnessResult } from '../components/RecommendationCard/types'
import {
  adaptISLRobustnessResponse,
  generateFallbackRobustness,
} from '../adapters/islRobustnessAdapter'
import { buildISLRobustnessRequest, type UINode, type UIEdge } from '../adapters/islRequestAdapter'
import { useCanvasStore } from '../store'
import { isSchemaV2Enabled, isPlotEnrichmentEnabled } from '../../flags'
import {
  extractRobustnessFromEnrichment,
  type PLoTResponseWithEnrichment,
} from '../../adapters/plot/enrichment'

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
  /** Phase 1B: Source of robustness data (for debugging) */
  source: 'enrichment' | 'isl' | 'cache' | 'fallback' | null
}

// Simple in-memory cache for robustness results (keyed by runId+responseHash)
const robustnessCache = new Map<string, { result: RobustnessResult; source: 'enrichment' | 'isl' }>()

export function useRobustness({
  runId,
  responseHash,
  autoFetch = true,
}: UseRobustnessOptions): UseRobustnessResult {
  const [robustness, setRobustness] = useState<RobustnessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'enrichment' | 'isl' | 'cache' | 'fallback' | null>(null)

  // Get nodes/edges from store for ISL request
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  // Phase 1B: Get enrichment from store
  const enrichment = useCanvasStore(s => s.results.enrichment)
  const report = useCanvasStore(s => s.results.report)

  // Track last fetched run to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null)

  // Track if we just completed a fetch (for source='cache' detection)
  // This flag is set when fetch completes and cleared after the render
  const justCompletedFetchRef = useRef(false)

  // Clear the flag after each render completes
  // This allows subsequent renders to correctly report 'cache' source
  useLayoutEffect(() => {
    justCompletedFetchRef.current = false
  })

  const fetchRobustness = useCallback(async () => {
    if (!runId) {
      setRobustness(null)
      setError(null)
      setSource(null)
      return
    }

    // Need nodes to build ISL request (if fallback needed)
    if (nodes.length === 0) {
      setRobustness(null)
      setSource(null)
      return
    }

    const cacheKey = `${runId}-${responseHash || ''}`

    // Check cache first
    const cached = robustnessCache.get(cacheKey)
    if (cached) {
      setRobustness(cached.result)
      setSource('cache')
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
      // =========================================================================
      // Phase 1B: PLoT enrichment routing (when flag enabled)
      // =========================================================================
      if (isPlotEnrichmentEnabled()) {
        if (enrichment) {
          // Build a PLoT-like response object for the adapter
          const plotResponse: PLoTResponseWithEnrichment = {
            result: {
              answer: report?.results?.likely?.toString() ?? '',
              confidence: report?.confidence?.level === 'high' ? 0.9 : report?.confidence?.level === 'medium' ? 0.7 : 0.5,
              explanation: report?.confidence?.why ?? '',
            },
            execution_ms: report?.meta?.elapsed_ms ?? 0,
            enrichment,
          }

          const fromEnrichment = extractRobustnessFromEnrichment(plotResponse)
          if (fromEnrichment !== null) {
            if (import.meta.env.DEV) {
              console.log('[useRobustness] Using robustness from PLoT enrichment')
            }
            justCompletedFetchRef.current = true
            robustnessCache.set(cacheKey, { result: fromEnrichment, source: 'enrichment' })
            setRobustness(fromEnrichment)
            setSource('enrichment')
            setLoading(false)
            return
          }
        }

        // Task 5: When flag enabled, do NOT fall back to ISL
        // This eliminates dual-pipeline; PLoT is responsible for ISL calls
        if (import.meta.env.DEV) {
          console.warn('[useRobustness] Enrichment flag enabled but no usable enrichment - using fallback (NOT calling ISL)')
        }
        justCompletedFetchRef.current = true
        const fallback = generateFallbackRobustness()
        robustnessCache.set(cacheKey, { result: fallback, source: 'enrichment' })
        setRobustness(fallback)
        setSource('fallback')
        setLoading(false)
        return
      }

      // =========================================================================
      // Legacy path: Direct ISL call (only when flag disabled)
      // =========================================================================

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

      // Brief v2.2: Pass useV2Schema flag to use signed strength.mean
      const payload = buildISLRobustnessRequest(uiNodes, uiEdges, {
        useV2Schema: isSchemaV2Enabled(),
      })

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
      // Integration fix Issue 3: Use v2 endpoint when schema v2 is enabled
      const useV2 = isSchemaV2Enabled()
      const endpoint = useV2
        ? '/bff/isl/api/v1/robustness/analyze/v2'
        : '/bff/isl/api/v1/analysis/robustness'

      if (import.meta.env.DEV) {
        console.log('[useRobustness] Using endpoint:', endpoint, '(v2:', useV2, ')')
      }

      const response = await fetch(endpoint, {
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
          justCompletedFetchRef.current = true
          const fallback = generateFallbackRobustness()
          robustnessCache.set(cacheKey, { result: fallback, source: 'isl' })
          setRobustness(fallback)
          setSource('fallback')
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
      justCompletedFetchRef.current = true
      robustnessCache.set(cacheKey, { result, source: 'isl' })
      setRobustness(result)
      setSource('isl')
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch robustness analysis'
      setError(errorMessage)

      // Generate fallback on error
      justCompletedFetchRef.current = true
      const fallback = generateFallbackRobustness()
      setRobustness(fallback)
      setSource('fallback')

      if (import.meta.env.DEV) {
        console.warn('[useRobustness] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, loading, nodes, edges, enrichment, report])

  // Auto-fetch when runId changes
  useEffect(() => {
    const cacheKey = `${runId}-${responseHash || ''}`
    if (autoFetch && runId && cacheKey !== lastFetchedRef.current) {
      fetchRobustness()
    }
  }, [autoFetch, runId, responseHash, fetchRobustness])

  // Compute final source: if we have cached data and this is not the render
  // immediately after a fetch, report 'cache' as the source
  const cacheKey = runId ? `${runId}-${responseHash || ''}` : ''
  const isUsingCache =
    !loading &&
    runId &&
    lastFetchedRef.current === cacheKey &&
    robustnessCache.has(cacheKey) &&
    !justCompletedFetchRef.current

  return {
    robustness,
    loading,
    error,
    refetch: fetchRobustness,
    source: isUsingCache ? 'cache' : source,
  }
}

/**
 * Clear the robustness cache (useful for testing)
 */
export function clearRobustnessCache(): void {
  robustnessCache.clear()
}

export default useRobustness
