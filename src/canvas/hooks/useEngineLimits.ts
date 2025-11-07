/**
 * Engine Limits Hook (Sprint 2)
 *
 * Provides a centralized way to fetch and access engine capacity limits.
 * Replaces duplicated plot.limits() calls across CanvasToolbar, ReactFlowGraph,
 * and useBlueprintInsert.
 */

import { useState, useEffect } from 'react'
import { plot } from '../../adapters/plot'
import type { LimitsV1 } from '../../adapters/plot/types'

export function useEngineLimits() {
  const [limits, setLimits] = useState<LimitsV1 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        setLoading(true)
        const adapter = plot as any
        if (adapter.limits && typeof adapter.limits === 'function') {
          const result = await adapter.limits()
          setLimits(result)
          setError(null)
        }
      } catch (err) {
        console.warn('[useEngineLimits] Failed to fetch limits:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }
    fetchLimits()
  }, [])

  return { limits, loading, error }
}
