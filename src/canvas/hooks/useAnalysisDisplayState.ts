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
import { classifyFreshnessForDisplay } from '../store/analysisFreshness'
import {
  deriveAnalysisDisplayState,
  type AnalysisDisplayStateView,
} from '../utils/deriveAnalysisDisplayState'

export function useAnalysisDisplayState(): AnalysisDisplayStateView {
  // Defensive optional chaining: legacy test fixtures mock a partial store
  // shape that omits `results`. The runtime store always provides it.
  const ceeAnalysisReadyStatus = useCanvasStore((s) => s.ceeAnalysisReady?.status)
  const hasReport = useCanvasStore((s) => s.results?.report != null)
  // "Results may be outdated" must reflect the CEE freshness verdict + local
  // dirty overlay (the shared display semantic being 'changed'), NOT the local
  // `graphEditedSinceLastRun` flag — so a CEE-sourced 'unknown' (cannot-confirm)
  // never fabricates a stale claim here.
  const analysisFreshness = useCanvasStore((s) => s.analysisFreshness)
  const analysisFreshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const analysisChanged =
    classifyFreshnessForDisplay(analysisFreshness, analysisFreshnessDirty) === 'changed'

  return deriveAnalysisDisplayState({
    ceeAnalysisReadyStatus,
    hasReport,
    analysisChanged,
  })
}
