/**
 * useAnalysisCompleteEvent — Sends `direct_analysis_run` system event
 * when the user runs analysis via the Play button.
 *
 * Watches for results.status transitions to 'complete' and sends the
 * system event after the store has fresh results. The turn request
 * built by sendSystemEvent reads analysis_state from the store AFTER
 * the update, so the orchestrator gets current data.
 *
 * Only active when `VITE_ENABLE_ORCHESTRATOR_V2` is ON.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore, type ResultsStatus } from '../store'
import { isOrchestratorV2Enabled } from '../../flags'
import { useGuidanceStore } from '../stores/guidanceStore'
import type { SystemEvent } from './types'

/** States that represent an active user-initiated analysis run */
const ACTIVE_RUN_STATES: ReadonlySet<ResultsStatus> = new Set([
  'preparing',
  'connecting',
  'streaming',
])

/**
 * Hook that detects analysis completion and sends a system event.
 *
 * @param sendSystemEvent - The sendSystemEvent function from useConversation
 */
export function useAnalysisCompleteEvent(
  sendSystemEvent: (event: SystemEvent) => Promise<void>,
): void {
  const prevStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!isOrchestratorV2Enabled()) return

    // Capture initial status
    prevStatusRef.current = useCanvasStore.getState().results.status

    const unsubscribe = useCanvasStore.subscribe((curr, prev) => {
      const prevStatus = prev.results.status
      const currStatus = curr.results.status

      // Only fire on completion of a user-initiated run (preparing → connecting →
      // streaming → complete). Transitions from 'idle' (e.g. hydration/restore) or
      // 'error'/'cancelled' are excluded to avoid false triggers.
      if (currStatus === 'complete' && ACTIVE_RUN_STATES.has(prevStatus)) {
        // Evict guidance items whose analysis_hash no longer matches the new result.
        // Done immediately (no delay) so stale items disappear as soon as the run
        // completes. The new results.hash is already set in the store by this point.
        const analysisHash = curr.results.hash ?? null
        useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: analysisHash })

        // Small delay to ensure all resultsComplete side effects have settled
        // (e.g. addRun, graphHealth derivation)
        setTimeout(() => {
          sendSystemEvent({
            type: 'direct_analysis_run',
            payload: { trigger: 'play_button' },
          })
        }, 100)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [sendSystemEvent])
}
