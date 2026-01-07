/**
 * useRobustness - Extracts robustness analysis from PLoT enrichment
 *
 * Factor Sensitivity Phase 1: UI reads sensitivity data from PLoT enrichment.
 * PLoT calls ISL internally (detail_level='deep') to get factor sensitivity.
 * No direct UI → ISL calls for robustness.
 *
 * Data flow:
 * 1. PLoT /v1/run (detail_level='deep') calls ISL /robustness/analyze/v2 internally
 * 2. Sensitivity data returned in enrichment.sensitivity_analysis.factors[]
 * 3. This hook extracts and caches the robustness data
 *
 * If enrichment unavailable, returns fallback data (no ISL fallback).
 */

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import type { RobustnessResult } from '../components/RecommendationCard/types'
import { generateFallbackRobustness } from '../adapters/islRobustnessAdapter'
import { useCanvasStore } from '../store'
import {
  extractRobustnessFromEnrichment,
  type PLoTResponseWithEnrichment,
} from '../../adapters/plot/enrichment'
import { updateRobustnessGate } from '../../lib/gate-state'

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

  // Get enrichment from store (from PLoT response)
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
      // Factor Sensitivity Phase 1: Always use PLoT enrichment
      // Direct ISL calls removed - PLoT is responsible for calling ISL internally
      // =========================================================================
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

        // P0 Fix: Debug logging for robustness gating diagnostics
        if (import.meta.env.DEV) {
          const sa = enrichment.sensitivity_analysis
          console.log('[useRobustness] Enrichment diagnostic:', {
            robustness_status: 'computed', // V2 always returns computed status when enrichment exists
            drivers_status: sa?.edges?.length ? 'computed' : 'unavailable',
            fragile_count: sa?.fragile_edges?.length ?? 0,
            robust_count: sa?.robust_edges?.length ?? 0,
            edge_sensitivity_count: sa?.edges?.length ?? 0,
            factor_sensitivity_count: sa?.factors?.length ?? 0,
            has_isl_enabled: enrichment.metadata?.isl_enabled,
            has_detail_level: enrichment.metadata?.detail_level,
          })
        }

        const fromEnrichment = extractRobustnessFromEnrichment(plotResponse)
        if (fromEnrichment !== null) {
          if (import.meta.env.DEV) {
            console.log('[useRobustness] Using robustness from PLoT enrichment:', {
              hasEdges: (enrichment.sensitivity_analysis?.edges?.length ?? 0) > 0,
              hasFactors: (enrichment.sensitivity_analysis?.factors?.length ?? 0) > 0,
              factorCount: enrichment.sensitivity_analysis?.factors?.length ?? 0,
              robustnessLabel: fromEnrichment.robustness_label,
              fragileEdgeCount: fromEnrichment.fragile_edge_count,
              robustEdgeCount: fromEnrichment.robust_edge_count,
            })
          }

          // Update robustness gate based on available data
          updateRobustnessGate(
            enrichment.sensitivity_analysis,
            enrichment.metadata?.factor_sensitivity_status
          )

          justCompletedFetchRef.current = true
          robustnessCache.set(cacheKey, { result: fromEnrichment, source: 'enrichment' })
          setRobustness(fromEnrichment)
          setSource('enrichment')
          setLoading(false)
          return
        } else if (import.meta.env.DEV) {
          console.warn('[useRobustness] extractRobustnessFromEnrichment returned null despite enrichment present')
        }
      }

      // No enrichment available - use fallback
      // (Direct ISL calls removed in Factor Sensitivity Phase 1 - PLoT handles ISL internally)
      if (import.meta.env.DEV) {
        console.log('[useRobustness] No enrichment available - using fallback')
      }

      // Update gate to reflect no data available
      updateRobustnessGate(null, null)

      justCompletedFetchRef.current = true
      const fallback = generateFallbackRobustness()
      // Note: Don't cache fallback results - they should be regenerated if enrichment becomes available
      setRobustness(fallback)
      setSource('fallback')
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process robustness data'
      setError(errorMessage)

      // Generate fallback on error
      justCompletedFetchRef.current = true
      const fallback = generateFallbackRobustness()
      setRobustness(fallback)
      setSource('fallback')

      if (import.meta.env.DEV) {
        console.warn('[useRobustness] Error:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, loading, enrichment, report])

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
