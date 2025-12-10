/**
 * useKeyInsight - Fetch key insight from CEE after analysis completes
 *
 * Automatically fetches key insight when:
 * - Analysis has completed (response_hash available)
 * - Component is mounted
 *
 * Features:
 * - Loading state while fetching
 * - Error handling with retry
 * - Caches result per response_hash
 * - Manual refresh capability
 * - Passes full graph and results context to PLoT (required by /v1/assist/key-insight)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { httpV1Adapter } from '../../adapters/plot/httpV1Adapter'
import { useCanvasStore } from '../store'
import type { KeyInsightResponse } from '../../adapters/plot/types'

interface UseKeyInsightOptions {
  /** Response hash from completed analysis */
  responseHash: string | null | undefined
  /** Optional scenario name for context */
  scenarioName?: string
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Include driver details (default: true) */
  includeDrivers?: boolean
}

interface UseKeyInsightResult {
  /** Key insight data */
  insight: KeyInsightResponse | null
  /** Loading state */
  loading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh insight */
  refresh: () => Promise<void>
}

// Simple in-memory cache to avoid redundant fetches
const insightCache = new Map<string, KeyInsightResponse>()

export function useKeyInsight({
  responseHash,
  scenarioName,
  autoFetch = true,
  includeDrivers = true,
}: UseKeyInsightOptions): UseKeyInsightResult {
  const [insight, setInsight] = useState<KeyInsightResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get graph and results from store (required by PLoT /v1/assist/key-insight)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const results = useCanvasStore((s) => s.results)

  // Track last fetched hash to prevent duplicate fetches
  const lastFetchedHashRef = useRef<string | null>(null)

  const fetchInsight = useCallback(async () => {
    if (!responseHash) {
      setInsight(null)
      setError(null)
      return
    }

    // Check cache first
    const cached = insightCache.get(responseHash)
    if (cached) {
      setInsight(cached)
      setError(null)
      return
    }

    // Skip if already fetching this hash
    if (lastFetchedHashRef.current === responseHash && loading) {
      return
    }

    lastFetchedHashRef.current = responseHash
    setLoading(true)
    setError(null)

    try {
      // Build graph payload for PLoT (required by /v1/assist/key-insight)
      const graphPayload = {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: (n.data as any)?.label || n.id,
          kind: n.type,
          value: (n.data as any)?.value,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          weight: (e.data as any)?.weight,
        })),
      }

      // Build results payload from analysis results
      const report = results?.report
      const resultsPayload = report?.results ? {
        outcome_node_id: report.model_card?.outcome_node_id,
        expected_value: report.results.likely,
        percentiles: {
          p10: report.results.conservative,
          p50: report.results.likely,
          p90: report.results.optimistic,
        },
        confidence: report.confidence ? {
          level: report.confidence.level,
          why: report.confidence.why,
        } : undefined,
      } : undefined

      const response = await httpV1Adapter.keyInsight({
        run_id: responseHash,
        scenario_name: scenarioName,
        include_drivers: includeDrivers,
        graph: graphPayload,
        results: resultsPayload,
      })

      // Cache the result
      insightCache.set(responseHash, response)
      setInsight(response)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to fetch key insight'
      setError(errorMessage)

      // Don't clear existing insight on error (graceful degradation)
      if (import.meta.env.DEV) {
        console.warn('[useKeyInsight] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [responseHash, scenarioName, includeDrivers, loading, nodes, edges, results])

  // Auto-fetch when responseHash changes
  useEffect(() => {
    if (autoFetch && responseHash && responseHash !== lastFetchedHashRef.current) {
      fetchInsight()
    }
  }, [autoFetch, responseHash, fetchInsight])

  // Clear insight when responseHash becomes null
  useEffect(() => {
    if (!responseHash) {
      setInsight(null)
      setError(null)
      lastFetchedHashRef.current = null
    }
  }, [responseHash])

  return {
    insight,
    loading,
    error,
    refresh: fetchInsight,
  }
}

/**
 * Clear the insight cache (useful for testing)
 */
export function clearInsightCache(): void {
  insightCache.clear()
}
