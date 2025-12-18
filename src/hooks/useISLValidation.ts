/**
 * useISLValidation - Hook for ISL graph validation
 *
 * Phase 1B: Added PLoT enrichment support via VITE_USE_PLOT_ENRICHMENT flag
 *
 * When VITE_USE_PLOT_ENRICHMENT is enabled:
 * - Extracts causal_validation from PLoT enrichment
 * - Does NOT fall back to ISL (eliminates dual-pipeline)
 * - If enrichment unavailable, returns fallback "valid" state
 *
 * When VITE_USE_PLOT_ENRICHMENT is disabled (legacy):
 * - Calls ISL directly via client.validate()
 */

import { useState, useCallback, useMemo } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type { ISLValidationResponse, ISLRunRequest } from '../adapters/isl/types'
import { isPlotEnrichmentEnabled } from '../flags'
import { useCanvasStore } from '../canvas/store'
import {
  extractValidationFromEnrichment,
  type PLoTResponseWithEnrichment,
} from '../adapters/plot/enrichment'

interface UseISLValidationState {
  data: ISLValidationResponse | null
  loading: boolean
  error: ISLError | null
  /** Phase 1B: Source of validation data (for debugging) */
  source: 'enrichment' | 'isl' | null
}

export function useISLValidation() {
  const [state, setState] = useState<UseISLValidationState>({
    data: null,
    loading: false,
    error: null,
    source: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  // Phase 1B: Get enrichment from store
  const enrichment = useCanvasStore(s => s.results.enrichment)
  const report = useCanvasStore(s => s.results.report)

  const validate = useCallback(
    async (request: ISLRunRequest) => {
      setState({ data: null, loading: true, error: null, source: null })

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

            const fromEnrichment = extractValidationFromEnrichment(plotResponse)
            if (fromEnrichment !== null) {
              if (import.meta.env.DEV) {
                console.log('[useISLValidation] Using validation from PLoT enrichment')
              }
              setState({ data: fromEnrichment, loading: false, error: null, source: 'enrichment' })
              return fromEnrichment
            }
          }

          // Task 5: When flag enabled, do NOT fall back to ISL
          // This eliminates dual-pipeline; PLoT is responsible for ISL calls
          // Return a default "valid" state when enrichment is unavailable
          if (import.meta.env.DEV) {
            console.warn('[useISLValidation] Enrichment flag enabled but no usable validation - using fallback (NOT calling ISL)')
          }
          const fallbackValidation: ISLValidationResponse = {
            valid: true,
            suggestions: [],
            graph_health: {
              completeness: 1,
              connectivity: 1,
              logical_consistency: 1,
            },
          }
          setState({ data: fallbackValidation, loading: false, error: null, source: 'enrichment' })
          return fallbackValidation
        }

        // =========================================================================
        // Legacy path: Direct ISL call (only when flag disabled)
        // =========================================================================
        const data = await client.validate(request)
        setState({ data, loading: false, error: null, source: 'isl' })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Validation failed',
          500
        )
        setState({ data: null, loading: false, error: islError, source: null })
        throw islError
      }
    },
    [client, enrichment, report]
  )

  return {
    ...state,
    validate,
  }
}
