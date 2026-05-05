/**
 * Hook wrapper around `deriveAnalysisFreshnessState` that reads the
 * required inputs from the canvas store and the V5 chat state in one
 * place (P0 V5 golden-path repair, Wave 3).
 *
 * The hook uses a single Zustand selector that returns a stable shape
 * so consumers can subscribe without triggering re-renders on unrelated
 * state changes. The pure derivation runs synchronously inside the
 * selector so the returned object is referentially stable across
 * unchanged renders (Zustand's default shallow comparator on the
 * primitive fields below is sufficient — `inputsMissing` is built
 * fresh on each call but is empty on the common path).
 *
 * Consumers (Wave 3 + Wave 4):
 *   - pre-analysis panel
 *   - results panel header / hero
 *   - chat composer (rerun chip gating)
 *   - debug overlay
 */

import { useMemo } from 'react'

import { useCanvasStore } from '../canvas/store'
import {
  deriveAnalysisFreshnessState,
  type AnalysisFreshnessState,
} from './analysisFreshnessState'

export function useAnalysisFreshnessState(): AnalysisFreshnessState {
  // Single selector — reading the four primitive inputs avoids per-field
  // subscriptions and keeps the dependency surface narrow.
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const graphEditedSinceLastRun = useCanvasStore((s) => s.graphEditedSinceLastRun)
  const resultsStatus = useCanvasStore((s) => s.results.status)
  const resultsReport = useCanvasStore((s) => s.results.report)
  // P0 V5 golden-path repair (fourth-round review, P1 #3): React Flow
  // nodes carry `n.type` as the structural kind; the canvas store
  // serialises it as `n.kind`. Mixing surfaces meant freshness fallback
  // could classify "ready" graphs as no_options_yet purely because of
  // which read site shipped. Normalise to read all three forms in
  // priority order so wire-compatible freshness still wins AND fallback
  // coherence holds:
  //   1. n.kind         — canvas store native
  //   2. n.type         — React Flow native
  //   3. n.data.kind    — some draft adaptors stash kind on data
  const readNodeKind = (n: unknown): string | null => {
    const node = n as
      | { kind?: unknown; type?: unknown; data?: { kind?: unknown } }
      | null
      | undefined
    if (!node) return null
    if (typeof node.kind === 'string') return node.kind
    if (typeof node.type === 'string') return node.type
    if (typeof node.data?.kind === 'string') return node.data.kind
    return null
  }
  const optionCount = useCanvasStore(
    (s) => s.nodes.filter((n) => readNodeKind(n) === 'option').length,
  )
  const goalCount = useCanvasStore(
    (s) => s.nodes.filter((n) => readNodeKind(n) === 'goal').length,
  )

  return useMemo(
    () =>
      deriveAnalysisFreshnessState({
        ceeAnalysisReady,
        graphEditedSinceLastRun,
        resultsStatus,
        // "Has options" is shorthand for "the model is structurally ready
        // to analyse". Two options + a goal is the minimum threshold the
        // pre-analysis panel uses; mirroring it here keeps the
        // recommendedAction coherent across surfaces.
        hasOptions: optionCount >= 2 && goalCount >= 1,
        // A non-failed report is the local proxy for "we have an
        // analysis result we could surface". `results.error` clears the
        // report on failure, so non-null `report` is sufficient.
        hasSuccessfulAnalysisResult: resultsReport != null,
      }),
    [
      ceeAnalysisReady,
      graphEditedSinceLastRun,
      resultsStatus,
      resultsReport,
      optionCount,
      goalCount,
    ],
  )
}
