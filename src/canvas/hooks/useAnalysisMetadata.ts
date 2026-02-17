/**
 * Hook to provide analysis metadata for Top Bar display
 * Decision Graph Display v2: Task 13
 *
 * Returns run status, scenario count, stability, and timestamp
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'

export type RunStatus = 'draft' | 'running' | 'complete' | 'error'
export type StabilityStatus = 'stable' | 'fragile' | null

interface AnalysisMetadata {
  /** Run status for display */
  runStatus: RunStatus
  /** Number of scenarios analysed */
  scenarioCount: number | null
  /** Stability assessment */
  stability: StabilityStatus
  /** When analysis completed (ISO timestamp) */
  computedAt: string | null
  /** User-friendly relative time string */
  relativeTime: string | null
}

/**
 * Get analysis metadata for Top Bar display
 */
export function useAnalysisMetadata(): AnalysisMetadata {
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)

  return useMemo(() => {
    // Derive run status from results.status
    const runStatus: RunStatus = (() => {
      if (resultsStatus === 'complete') return 'complete'
      if (resultsStatus === 'error') return 'error'
      if (resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming') {
        return 'running'
      }
      return 'draft' // idle, cancelled, or undefined
    })()

    // Extract scenario count from meta.n_samples
    const scenarioCount = (() => {
      if (!report?.meta) return null
      const nSamples = report.meta.n_samples ?? report.meta.nSamples
      return typeof nSamples === 'number' ? nSamples : null
    })()

    // Derive stability from robustness.is_robust
    const stability: StabilityStatus = (() => {
      if (!report?.robustness) return null
      const isRobust = report.robustness.is_robust ?? report.robustness.isRobust
      if (typeof isRobust === 'boolean') {
        return isRobust ? 'stable' : 'fragile'
      }
      return null
    })()

    // Extract computed_at timestamp
    const computedAt = (() => {
      if (!report?.meta) return null
      const timestamp = report.meta.computed_at ?? report.meta.computedAt
      return typeof timestamp === 'string' ? timestamp : null
    })()

    // Generate relative time string
    const relativeTime = (() => {
      if (!computedAt) return null
      try {
        const date = new Date(computedAt)
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

        if (seconds < 60) return 'just now'
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
        return date.toLocaleDateString()
      } catch {
        return null
      }
    })()

    return {
      runStatus,
      scenarioCount,
      stability,
      computedAt,
      relativeTime,
    }
  }, [resultsStatus, report])
}
