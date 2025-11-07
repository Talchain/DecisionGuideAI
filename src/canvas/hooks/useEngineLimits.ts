/**
 * Engine Limits Hook (Sprint 2)
 *
 * Provides a centralized way to fetch and access engine capacity limits.
 * Replaces duplicated plot.limits() calls across CanvasToolbar, ReactFlowGraph,
 * and useBlueprintInsert.
 *
 * Returns error state so consumers can surface limits unavailability to operators.
 */

import { useState, useEffect } from 'react'
import { plot } from '../../adapters/plot'
import type { LimitsV1 } from '../../adapters/plot/types'

export interface UseEngineLimitsReturn {
  limits: LimitsV1 | null
  loading: boolean
  error: Error | null
  /** Retry fetching limits (useful for manual refresh) */
  retry: () => void
}

export function useEngineLimits(): UseEngineLimitsReturn {
  const [limits, setLimits] = useState<LimitsV1 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLimits = async () => {
    try {
      setLoading(true)
      setError(null)
      const adapter = plot as any
      if (adapter.limits && typeof adapter.limits === 'function') {
        const result = await adapter.limits()
        setLimits(result)
      } else {
        throw new Error('Limits endpoint not available')
      }
    } catch (err) {
      console.warn('[useEngineLimits] Failed to fetch limits:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
      setLimits(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLimits()
  }, [])

  return { limits, loading, error, retry: fetchLimits }
}
