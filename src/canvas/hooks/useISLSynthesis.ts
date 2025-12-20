/**
 * useISLSynthesis - Fetches prose narratives from CEE
 *
 * Brief E Task 2: Wire ISL Synthesis Narratives
 * Brief F Task 3: Updated to call CEE (not ISL) and wait for robustness data
 *
 * DEPRECATED: The /bff/cee/isl-synthesis endpoint is being removed.
 * Synthesis narratives will come from ceeReview.blocks in the PLoT response.
 * This hook now returns null/empty state to prevent 404 errors.
 *
 * Original endpoint: POST /bff/cee/isl-synthesis
 * - decision_narrative: Overall decision context
 * - uncertainty_narrative: Key uncertainties explained
 * - recommendation_narrative: Actionable recommendations
 */

// NOTE: Imports kept for type compatibility but hook is now a no-op
// import { useState, useEffect, useCallback, useRef } from 'react'
// import { useCanvasStore } from '../store'
// import { transformISLToCEESynthesis, type CEESynthesisRequest } from '../adapters/ceeSynthesisAdapter'
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
  // DEPRECATED: /bff/cee/isl-synthesis endpoint removed.
  // Synthesis narratives will come from ceeReview.blocks in PLoT response.
  // Return null/empty state to prevent 404 errors.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = { runId, responseHash, autoFetch, robustnessResult, goalLabel }

  return {
    synthesis: null,
    loading: false,
    error: null,
    refetch: async () => {
      // No-op: endpoint deprecated
      if (import.meta.env.DEV) {
        console.log('[useISLSynthesis] DEPRECATED: /bff/cee/isl-synthesis removed. Synthesis comes from ceeReview.blocks.')
      }
    },
  }
}

/**
 * Clear the synthesis cache (useful for testing)
 */
export function clearSynthesisCache(): void {
  synthesisCache.clear()
}

export default useISLSynthesis
