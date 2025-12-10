/**
 * usePareto Hook
 *
 * Fetches Pareto frontier analysis from PLoT /v1/analysis/pareto endpoint.
 * Used for multi-criteria decision visualization.
 *
 * Features:
 * - Identifies Pareto-optimal (non-dominated) options
 * - Tracks dominance relationships between options
 * - Loading and error states
 * - Manual refresh capability
 */

import { useState, useCallback, useRef, useEffect } from 'react'

const PARETO_ENDPOINT = '/bff/engine/v1/analysis/pareto'
const REQUEST_TIMEOUT_MS = 10000

export interface ParetoOption {
  option_id: string
  option_label: string
  scores: Record<string, number>
}

export interface ParetoRequest {
  options: ParetoOption[]
  criteria: string[]
}

export interface ParetoResponse {
  /** IDs of options on the Pareto frontier (non-dominated) */
  frontier: string[]
  /** IDs of dominated options */
  dominated: string[]
  /** Dominance relationships */
  dominance_pairs: Array<{ dominator: string; dominated: string }>
  /** Number of options on frontier */
  frontier_size: number
  /** Total number of options analyzed */
  total_options: number
}

export interface UseParetoParams {
  options: Array<{ id: string; label: string; scores: Record<string, number> }>
  criteria: string[]
  enabled?: boolean
}

export interface UseParetoResult {
  /** IDs of options on the Pareto frontier */
  frontier: string[]
  /** IDs of dominated options */
  dominated: string[]
  /** Dominance relationships for "Why dominated?" explanations */
  dominancePairs: Array<{ dominator: string; dominated: string }>
  /** Loading state */
  isLoading: boolean
  /** Error object if request failed */
  error: Error | null
  /** Manually trigger refetch */
  refetch: () => Promise<void>
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export function usePareto({
  options,
  criteria,
  enabled = true,
}: UseParetoParams): UseParetoResult {
  const [frontier, setFrontier] = useState<string[]>([])
  const [dominated, setDominated] = useState<string[]>([])
  const [dominancePairs, setDominancePairs] = useState<
    Array<{ dominator: string; dominated: string }>
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastRequestHashRef = useRef<string>('')

  // Create hash of request params to detect changes
  const requestHash = JSON.stringify({ options, criteria })

  const fetchPareto = useCallback(async () => {
    // Validation: Need ≥3 options and ≥2 criteria for meaningful Pareto analysis
    if (options.length < 3) {
      setFrontier([])
      setDominated([])
      setDominancePairs([])
      setError(null)
      return
    }

    if (criteria.length < 2) {
      setFrontier([])
      setDominated([])
      setDominancePairs([])
      setError(null)
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    const correlationId = generateCorrelationId()

    try {
      // Build request payload
      const requestBody: ParetoRequest = {
        options: options.map((opt) => ({
          option_id: opt.id,
          option_label: opt.label,
          scores: opt.scores,
        })),
        criteria,
      }

      if (import.meta.env.DEV) {
        console.log('[usePareto] Request:', JSON.stringify(requestBody, null, 2))
      }

      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const response = await fetch(PARETO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': correlationId,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Log error details in dev
        if (import.meta.env.DEV) {
          try {
            const errorBody = await response.clone().json()
            console.error(`[usePareto] HTTP ${response.status}:`, errorBody)
          } catch {
            const errorText = await response.clone().text()
            console.error(`[usePareto] HTTP ${response.status}:`, errorText)
          }
        }
        throw new Error(`Pareto analysis failed: HTTP ${response.status}`)
      }

      const data: ParetoResponse = await response.json()

      if (import.meta.env.DEV) {
        console.log('[usePareto] Response:', {
          frontier: data.frontier.length,
          dominated: data.dominated.length,
        })
      }

      setFrontier(data.frontier)
      setDominated(data.dominated)
      setDominancePairs(data.dominance_pairs || [])
      lastRequestHashRef.current = requestHash
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }

      const errorMessage =
        err instanceof Error ? err.message : 'Pareto analysis failed'
      console.warn('[usePareto] Failed:', errorMessage)
      setError(err instanceof Error ? err : new Error(errorMessage))

      // Clear results on error
      setFrontier([])
      setDominated([])
      setDominancePairs([])
    } finally {
      setIsLoading(false)
    }
  }, [options, criteria, requestHash])

  // Auto-fetch when enabled and params change
  useEffect(() => {
    if (enabled && requestHash !== lastRequestHashRef.current) {
      fetchPareto()
    }
  }, [enabled, requestHash, fetchPareto])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    frontier,
    dominated,
    dominancePairs,
    isLoading,
    error,
    refetch: fetchPareto,
  }
}
