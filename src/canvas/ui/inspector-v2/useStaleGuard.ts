/**
 * Stale-state detection for post-analysis impact sections.
 * Compares the current graph hash against the hash stored at last analysis run.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import type { AnalysisState } from './types'

export function useStaleGuard(): { analysisState: AnalysisState; isStale: boolean } {
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const resultsHash = useCanvasStore(s => s.results?.graphHash)
  const graphHash = useCanvasStore(s => s._internal?.graphHash)

  return useMemo(() => {
    if (!resultsStatus || resultsStatus !== 'complete') {
      return { analysisState: 'none' as const, isStale: false }
    }
    // If hashes exist and differ, results are stale
    if (graphHash && resultsHash && graphHash !== resultsHash) {
      return { analysisState: 'stale' as const, isStale: true }
    }
    return { analysisState: 'current' as const, isStale: false }
  }, [resultsStatus, resultsHash, graphHash])
}
