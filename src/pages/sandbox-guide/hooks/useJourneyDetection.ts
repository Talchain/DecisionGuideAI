/**
 * useJourneyDetection Hook
 *
 * Encapsulates journey stage detection logic and store subscriptions.
 * Automatically updates journey stage when relevant state changes.
 *
 * Benefits:
 * - Cleaner component code
 * - Centralized logic
 * - Easier to test
 * - Reduced boilerplate
 */

import { useEffect } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useGuideStore } from './useGuideStore'
import { determineJourneyStage } from '../utils/journeyDetection'

/**
 * Custom hook that manages journey stage detection
 *
 * Automatically subscribes to relevant stores and updates journey stage
 * whenever the context changes (nodes, edges, results, selection, compare mode).
 *
 * @returns Current journey stage
 */
export function useJourneyDetection() {
  // Subscribe to canvas state
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  // Subscribe to results state
  const resultsStatus = useResultsStore((state) => state.status)
  const resultsReport = useResultsStore((state) => state.report)

  // Subscribe to guide state
  const selectedElement = useGuideStore((state) => state.selectedElement)
  const compareMode = useGuideStore((state) => state.compareMode)
  const setJourneyStage = useGuideStore((state) => state.setJourneyStage)

  // Update journey stage whenever context changes
  useEffect(() => {
    const stage = determineJourneyStage({
      graph: { nodes, edges },
      results: {
        status: resultsStatus === 'complete' ? 'complete' : 'idle',
        report: resultsReport,
      },
      selectedElement,
      compareMode,
    })
    setJourneyStage(stage)
  }, [nodes, edges, resultsStatus, resultsReport, selectedElement, compareMode, setJourneyStage])

  // Return current stage for component use
  return useGuideStore((state) => state.journeyStage)
}
