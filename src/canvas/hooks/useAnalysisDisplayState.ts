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
import { useAnalysisTrust } from './useAnalysisTrust'

export function useAnalysisDisplayState(): AnalysisDisplayStateView {
  // Defensive optional chaining: legacy test fixtures mock a partial store
  // shape that omits `results`. The runtime store always provides it.
  const ceeAnalysisReadyStatus = useCanvasStore((s) => s.ceeAnalysisReady?.status)
  const hasReport = useCanvasStore((s) => s.results?.report != null)
  // "Results may be outdated" must reflect the composed trust answer
  // (`useAnalysisTrust`), NOT the local `graphEditedSinceLastRun` flag — so a
  // CEE-sourced 'unknown' (cannot-confirm) never fabricates a stale claim
  // here.
  //
  // RCA-D1: an orphaned result (a report hydrated on reload with no live-capture
  // fact for the scenario) must NOT read as green "Analysis complete" — the same
  // state already surfaces the strip's "can't confirm this is current" variant,
  // and a green completion hero alongside it is a self-contradiction.
  // deriveAnalysisDisplayState deliberately treats a CEE 'unknown' verdict as
  // the neutral completion fact, so the semantic alone can't route this; OR in
  // the trust composition's orphan flag (it never fires for a genuine run,
  // which mints a fact via deriveV5AnalysisFactUpdate) and reuse the existing
  // 'results_stale' branch ("Results may be outdated · Rerun").
  const trust = useAnalysisTrust()
  const notConfirmedCurrent = trust.semantic === 'changed' || trust.orphaned

  return deriveAnalysisDisplayState({
    ceeAnalysisReadyStatus,
    hasReport,
    analysisChanged: notConfirmedCurrent,
  })
}
