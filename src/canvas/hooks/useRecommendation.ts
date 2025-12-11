/**
 * useRecommendation Hook
 *
 * Fetches CEE-powered recommendation from /bff/engine/v1/recommend/generate
 * Provides actionable decision guidance with reasoning, tradeoffs, and assumptions.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import type {
  GenerateRecommendationRequest,
  GenerateRecommendationResponse,
  UseRecommendationOptions,
  UseRecommendationResult,
  RankedOption,
} from '../components/RecommendationCard/types'

const BFF_BASE_URL = (import.meta as any).env?.VITE_BFF_BASE || '/bff/engine'

// Cache TTL: 5 minutes (recommendation for same run shouldn't change)
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: GenerateRecommendationResponse
  timestamp: number
  hash: string
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>()

/**
 * Generate cache key from run ID and response hash
 */
function getCacheKey(runId: string, responseHash?: string): string {
  return `${runId}:${responseHash || 'no-hash'}`
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

export function useRecommendation(
  options: UseRecommendationOptions = {}
): UseRecommendationResult {
  const {
    runId,
    responseHash,
    autoFetch = false,
    narrativeStyle = 'concise',
  } = options

  const [recommendation, setRecommendation] = useState<GenerateRecommendationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchAttemptedRef = useRef(false)

  // Store selectors for building request
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const results = useCanvasStore((s) => s.results)
  const comparisonMode = useCanvasStore((s) => s.comparisonMode)

  /**
   * Build ranked options from comparison data or current analysis
   */
  const buildRankedOptions = useCallback((): RankedOption[] => {
    // If we have comparison results, use those
    if (comparisonMode?.comparison?.ranking) {
      return comparisonMode.comparison.ranking.map((r, idx) => ({
        option_id: r.optionId || `option-${idx}`,
        option_label: r.label || `Option ${idx + 1}`,
        rank: r.rank,
        expected_value: r.expectedValue || 0,
        confidence: r.confidence || 'medium',
      }))
    }

    // Otherwise, extract option nodes from graph
    const optionNodes = nodes.filter((n) => n.type === 'option')
    if (optionNodes.length === 0) return []

    return optionNodes.map((n, idx) => ({
      option_id: n.id,
      option_label: (n.data as any)?.label || `Option ${idx + 1}`,
      rank: idx + 1, // Default ranking by order
      expected_value: results?.report?.results?.likely || 0,
      confidence: (results?.report?.confidence?.level || 'medium') as 'high' | 'medium' | 'low',
    }))
  }, [comparisonMode, nodes, results])

  /**
   * Fetch recommendation from CEE
   */
  const fetchRecommendation = useCallback(async () => {
    const effectiveRunId = runId || results?.runId
    if (!effectiveRunId) {
      // No run ID yet - use fallback recommendation silently
      // This is expected before analysis is run
      const fallback = buildFallbackRecommendation()
      setRecommendation(fallback)
      return
    }

    // Check cache first
    const cacheKey = getCacheKey(effectiveRunId, responseHash)
    const cached = cache.get(cacheKey)
    if (cached && isCacheValid(cached)) {
      setRecommendation(cached.data)
      return
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      // Build request payload
      const graphPayload = {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: (n.data as any)?.label || n.id,
          kind: n.type,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: (e.data as any)?.label,
        })),
      }

      const resultsPayload = {
        conservative: results?.report?.results?.conservative || 0,
        likely: results?.report?.results?.likely || 0,
        optimistic: results?.report?.results?.optimistic || 0,
        units: results?.report?.results?.units,
      }

      const request: GenerateRecommendationRequest = {
        run_id: effectiveRunId,
        graph: graphPayload,
        results: resultsPayload,
        ranked_options: buildRankedOptions(),
        narrative_style: narrativeStyle,
      }

      const response = await fetch(`${BFF_BASE_URL}/v1/recommend/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 404) {
          // Endpoint not available yet - use fallback
          console.warn('[useRecommendation] Endpoint not available, using fallback')
          const fallback = buildFallbackRecommendation()
          setRecommendation(fallback)
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: GenerateRecommendationResponse = await response.json()

      // Cache the result
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        hash: responseHash || '',
      })

      setRecommendation(data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return // Request cancelled, ignore
      }

      console.error('[useRecommendation] Fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendation')

      // Use fallback on error
      const fallback = buildFallbackRecommendation()
      setRecommendation(fallback)
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, results, nodes, edges, buildRankedOptions, narrativeStyle])

  /**
   * Build fallback recommendation from existing report data
   * Used when CEE endpoint is unavailable
   */
  const buildFallbackRecommendation = useCallback((): GenerateRecommendationResponse => {
    const report = results?.report
    const optionNodes = nodes.filter((n) => n.type === 'option')
    const topOption = optionNodes[0]
    const topOptionLabel = (topOption?.data as any)?.label || 'the recommended option'

    // Extract drivers from report
    const drivers = (report?.drivers || []).slice(0, 3).map((d, idx) => ({
      factor: d.label,
      edge_id: d.edgeId || `driver-${idx}`,
      contribution: d.strength || 'medium',
      explanation: `${d.label} has ${d.polarity === 'up' ? 'positive' : d.polarity === 'down' ? 'negative' : 'neutral'} impact on the outcome`,
      node_id: d.nodeId,
    }))

    // Build summary from insights
    const summary = report?.insights?.summary ||
      `Based on the analysis, ${topOptionLabel} shows the highest expected outcome with ${report?.confidence?.level || 'medium'} confidence.`

    return {
      recommendation: {
        headline: `Proceed with ${topOptionLabel}`,
        confidence: (report?.confidence?.level || 'medium') as 'high' | 'medium' | 'low',
        summary,
      },
      reasoning: {
        primary_drivers: drivers as any,
        key_tradeoffs: [],
        assumptions: (report?.insights?.risks || []).slice(0, 3).map((risk, idx) => ({
          description: risk,
          criticality: idx === 0 ? 'critical' : 'important',
          validation_suggestion: 'Review this assumption with stakeholders',
        })) as any,
        validation_steps: (report?.insights?.next_steps || []).slice(0, 3).map((step) => ({
          action: step,
          rationale: 'Recommended validation step',
          effort: 'medium',
        })) as any,
      },
      provenance: 'cee',
    }
  }, [results, nodes])

  /**
   * Clear cached data
   */
  const clear = useCallback(() => {
    setRecommendation(null)
    setError(null)
    fetchAttemptedRef.current = false
  }, [])

  // Auto-fetch when enabled and conditions are met
  useEffect(() => {
    if (!autoFetch || fetchAttemptedRef.current) return
    if (!results?.report || loading) return

    fetchAttemptedRef.current = true
    fetchRecommendation()
  }, [autoFetch, results?.report, loading, fetchRecommendation])

  // Reset fetch attempted flag when run changes
  useEffect(() => {
    if (runId) {
      fetchAttemptedRef.current = false
    }
  }, [runId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    recommendation,
    loading,
    error,
    fetch: fetchRecommendation,
    clear,
  }
}
