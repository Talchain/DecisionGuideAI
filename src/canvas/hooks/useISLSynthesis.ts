/**
 * useISLSynthesis - Fetches prose narratives from CEE
 *
 * Brief E Task 2: Wire ISL Synthesis Narratives
 * Brief F Task 3: Updated to call CEE (not ISL) and wait for robustness data
 *
 * Calls POST /bff/cee/isl-synthesis endpoint to get:
 * - decision_narrative: Overall decision context
 * - uncertainty_narrative: Key uncertainties explained
 * - recommendation_narrative: Actionable recommendations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { transformISLToCEESynthesis, type CEESynthesisRequest } from '../adapters/ceeSynthesisAdapter'
import type { RobustnessResult } from '../components/RecommendationCard/types'

// CEE Synthesis response types (matches CEE contract)
export interface CEESynthesisResponse {
  synthesis: {
    decision_narrative: string
    uncertainty_narrative: string
    recommendation_narrative: string
  }
}

export interface SynthesisNarratives {
  decision: string
  uncertainty: string
  recommendation: string
}

interface UseISLSynthesisOptions {
  /** Run ID to fetch synthesis for (used for caching) */
  runId?: string
  /** Response hash for cache key */
  responseHash?: string
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Robustness result - synthesis waits for this (Brief F Task 3B) */
  robustnessResult?: RobustnessResult | null
  /** Goal node label for synthesis context */
  goalLabel?: string
}

interface UseISLSynthesisResult {
  /** The synthesis narratives if available */
  synthesis: SynthesisNarratives | null
  /** Loading state */
  loading: boolean
  /** Error message if request failed */
  error: string | null
  /** Manual refresh function */
  refetch: () => Promise<void>
}

// Simple in-memory cache for synthesis results (keyed by runId+responseHash)
const synthesisCache = new Map<string, SynthesisNarratives>()

export function useISLSynthesis({
  runId,
  responseHash,
  autoFetch = true,
  robustnessResult,
  goalLabel,
}: UseISLSynthesisOptions): UseISLSynthesisResult {
  const [synthesis, setSynthesis] = useState<SynthesisNarratives | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track last fetched run to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null)

  const fetchSynthesis = useCallback(async () => {
    if (!runId) {
      setSynthesis(null)
      setError(null)
      return
    }

    // Brief F Task 3B: Synthesis must wait for robustness data
    // Without robustness data, CEE cannot generate meaningful synthesis
    if (!robustnessResult) {
      // Don't set error - just waiting for robustness
      return
    }

    const cacheKey = `${runId}-${responseHash || ''}`

    // Check cache first
    const cached = synthesisCache.get(cacheKey)
    if (cached) {
      setSynthesis(cached)
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
      // Brief F Task 3C: Transform robustness result to CEE synthesis request format
      const payload: CEESynthesisRequest = transformISLToCEESynthesis(robustnessResult, goalLabel)

      if (import.meta.env.DEV) {
        console.log('[useISLSynthesis] CEE Synthesis request payload:', JSON.stringify(payload, null, 2))
      }

      // Brief F Task 3A: Call CEE endpoint (not ISL)
      const response = await fetch('/bff/cee/isl-synthesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read response body')

        if (import.meta.env.DEV) {
          console.error('[useISLSynthesis] Error response:', {
            status: response.status,
            body: errorBody,
          })
        }

        // 404 = endpoint not available, silently fail
        if (response.status === 404) {
          setSynthesis(null)
          return
        }
        throw new Error(`Failed to fetch synthesis: ${response.status}`)
      }

      const data: CEESynthesisResponse = await response.json()

      // Transform to UI format
      const result: SynthesisNarratives = {
        decision: data.synthesis?.decision_narrative || '',
        uncertainty: data.synthesis?.uncertainty_narrative || '',
        recommendation: data.synthesis?.recommendation_narrative || '',
      }

      // Cache the result
      synthesisCache.set(cacheKey, result)
      setSynthesis(result)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch synthesis narratives'
      setError(errorMessage)
      setSynthesis(null)

      if (import.meta.env.DEV) {
        console.warn('[useISLSynthesis] Failed to fetch:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [runId, responseHash, loading, robustnessResult, goalLabel])

  // Auto-fetch when runId changes AND robustness data is available
  useEffect(() => {
    const cacheKey = `${runId}-${responseHash || ''}`
    // Brief F Task 3B: Only fetch when robustness data is available
    if (autoFetch && runId && robustnessResult && cacheKey !== lastFetchedRef.current) {
      fetchSynthesis()
    }
  }, [autoFetch, runId, responseHash, robustnessResult, fetchSynthesis])

  return {
    synthesis,
    loading,
    error,
    refetch: fetchSynthesis,
  }
}

/**
 * Clear the synthesis cache (useful for testing)
 */
export function clearSynthesisCache(): void {
  synthesisCache.clear()
}

export default useISLSynthesis
