/**
 * useCoachingReview Hook (P1 Tasks 5-6)
 *
 * Manages M2 coaching content fetching with:
 * - Automatic fetching after M1 renders
 * - Response hash-based caching
 * - Request cancellation on re-run
 * - Timeout and error handling
 *
 * Usage:
 * const { m2Data, isLoading } = useCoachingReview(analysisData)
 * // m2Data is null until M2 loads (stay on M1)
 * // Pass m2Data to the results panel for seamless M2 swap
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchCoachingReview,
  getCachedReview,
  setCachedReview,
  validateReviewResponse,
  type ReviewRequest,
  type ReviewResponse,
  type ReviewRequestAnalysisSummary,
} from '../services/coachingReview'

// =============================================================================
// Types
// =============================================================================

export interface UseCoachingReviewInput {
  /** Response hash from current analysis */
  responseHash: string | null | undefined

  /** Analysis summary for M2 request */
  analysisSummary: ReviewRequestAnalysisSummary | null

  /** Graph context */
  graphContext: {
    nodeCount: number
    edgeCount: number
  } | null

  /** Allowed references (nodes/options the model can reference) */
  allowedReferences: Array<{
    id: string
    label: string
    kind: string
  }> | null

  /** Whether to enable M2 fetching */
  enabled?: boolean

  /** PLoT API base URL */
  plotBaseUrl?: string
}

export interface UseCoachingReviewResult {
  /** M2 data if available, null otherwise (stay on M1) */
  m2Data: ReviewResponse | null

  /** Whether M2 request is in flight */
  isLoading: boolean

  /** Error message if M2 failed (for debugging, not shown to user) */
  error: string | null
}

// =============================================================================
// Hook
// =============================================================================

export function useCoachingReview({
  responseHash,
  analysisSummary,
  graphContext,
  allowedReferences,
  enabled = true,
  plotBaseUrl = '/api/plot', // Default to relative path
}: UseCoachingReviewInput): UseCoachingReviewResult {
  const [m2Data, setM2Data] = useState<ReviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  // Track the current response hash to detect stale responses
  const currentHashRef = useRef<string | null>(null)

  // Fetch M2 content
  const fetchM2 = useCallback(async () => {
    // Guard: Need all required data
    if (!responseHash || !analysisSummary || !graphContext || !allowedReferences) {
      return
    }

    // Guard: Already have cached data for this hash
    const cached = getCachedReview(responseHash)
    if (cached) {
      setM2Data(cached)
      return
    }

    // Update current hash ref
    currentHashRef.current = responseHash

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const request: ReviewRequest = {
        response_hash: responseHash,
        analysis_summary: analysisSummary,
        graph_context: {
          node_count: graphContext.nodeCount,
          edge_count: graphContext.edgeCount,
        },
        allowed_references: allowedReferences,
      }

      const result = await fetchCoachingReview(
        request,
        { baseUrl: plotBaseUrl, timeout: 10000 },
        abortControllerRef.current.signal
      )

      // Guard against stale responses (Task 6)
      if (currentHashRef.current !== responseHash) {
        console.log('[useCoachingReview] Discarding stale response for hash:', responseHash)
        return
      }

      if (result.success && result.data) {
        // Cache and set
        setCachedReview(responseHash, result.data)
        setM2Data(result.data)
      } else {
        // M2 failed - stay on M1, log error for debugging
        setError(result.error ?? 'Unknown error')
      }
    } catch (err) {
      // Should not reach here (fetchCoachingReview handles all errors)
      console.error('[useCoachingReview] Unexpected error:', err)
      setError('Unexpected error')
    } finally {
      setIsLoading(false)
    }
  }, [responseHash, analysisSummary, graphContext, allowedReferences, plotBaseUrl])

  // Effect: Fetch M2 when inputs change
  useEffect(() => {
    if (!enabled) {
      return
    }

    // Reset state when response hash changes
    if (responseHash !== currentHashRef.current) {
      setM2Data(null)
      setError(null)

      // Check cache first
      if (responseHash) {
        const cached = getCachedReview(responseHash)
        if (cached) {
          setM2Data(cached)
          return
        }
      }
    }

    fetchM2()

    // Cleanup: Cancel on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, responseHash, fetchM2])

  return {
    m2Data,
    isLoading,
    error,
  }
}

export default useCoachingReview
