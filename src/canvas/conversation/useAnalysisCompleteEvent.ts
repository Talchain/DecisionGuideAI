/**
 * useAnalysisCompleteEvent — Evicts stale guidance after a completed analysis run.
 *
 * Watches for results.status transitions from an active run state to `complete`
 * and clears guidance items whose validity no longer matches the fresh results
 * hash.
 *
 * Only active when `VITE_ENABLE_ORCHESTRATOR_V2` is ON.
 */

import { useEffect } from 'react'
import { useCanvasStore, type ResultsStatus } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import { useGuidanceStore } from '../stores/guidanceStore'

/** States that represent an active user-initiated analysis run */
const ACTIVE_RUN_STATES: ReadonlySet<ResultsStatus> = new Set([
  'preparing',
  'connecting',
  'streaming',
])

/**
 * Hook that detects analysis completion and evicts stale guidance.
 */
export function useAnalysisCompleteEvent(): void {
  useEffect(() => {
    if (!isOrchestratorV2Enabled()) return

    const unsubscribe = useCanvasStore.subscribe((curr, prev) => {
      const prevStatus = prev.results.status
      const currStatus = curr.results.status

      // Only fire on completion of a user-initiated run (preparing → connecting →
      // streaming → complete). Transitions from 'idle' (e.g. hydration/restore) or
      // 'error'/'cancelled' are excluded to avoid false triggers.
      if (currStatus === 'complete' && ACTIVE_RUN_STATES.has(prevStatus)) {
        const analysisHash = curr.results.hash ?? null
        useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: analysisHash })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])
}
