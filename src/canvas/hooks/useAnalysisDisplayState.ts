/**
 * useAnalysisDisplayState — hook wrapper over `deriveAnalysisDisplayState`.
 *
 * Subscribes to the four primitives the helper needs from the canvas store
 * (each via a narrow selector to avoid re-rendering on unrelated state) and
 * returns the canonical `AnalysisDisplayStateView`.
 *
 * Use this from any UI surface that displays "ready to analyse / analysis
 * complete / results may be outdated / set up your model" — banner copy,
 * CTA visibility, icon + colour all come from the helper output.
 */

import { useCanvasStore } from '../store'
import {
  deriveAnalysisDisplayState,
  type AnalysisDisplayStateView,
} from '../utils/deriveAnalysisDisplayState'

export function useAnalysisDisplayState(): AnalysisDisplayStateView {
  // Defensive optional chaining: legacy test fixtures mock a partial store
  // shape that omits `results` and/or `graphEditedSinceLastRun`. The runtime
  // store always provides them (initial state at store.ts:1113, 1128).
  const ceeAnalysisReadyStatus = useCanvasStore((s) => s.ceeAnalysisReady?.status)
  const hasReport = useCanvasStore((s) => s.results?.report != null)
  const graphEditedSinceLastRun = useCanvasStore((s) => s.graphEditedSinceLastRun ?? false)

  return deriveAnalysisDisplayState({
    ceeAnalysisReadyStatus,
    hasReport,
    graphEditedSinceLastRun,
  })
}
