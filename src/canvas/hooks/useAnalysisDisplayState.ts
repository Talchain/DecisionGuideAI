/**
 * useAnalysisDisplayState — the hero/banner copy state, now READ FROM THE ONE
 * SELECTOR rather than recomputed here.
 *
 * ⚠ WHAT THIS FILE USED TO DO, AND WHY IT WAS WRONG. It subscribed to
 * `ceeAnalysisReady.status` and `results.report` directly, took only
 * `trust.semantic` from the composed verdict, and then ran
 * `deriveAnalysisDisplayState` ITSELF with a locally-recomputed
 * `analysisChanged`. That local recomputation is precisely the divergence the
 * analysis-state migration exists to close, and it had a measured
 * user-visible cost: on a `refused`, `unknown_degraded` or `blocked` turn the
 * selector said "outdated" while this hook rendered a green **"Analysis
 * complete"**, because `analysisChanged` was `semantic === 'changed'` and those
 * three states map to cannot-confirm, which the legacy mapper deliberately
 * treats as the neutral completion fact.
 *
 * The selector already resolves that (`wireForcesStale`), and it resolves it in
 * ONE place. Recomputing here meant the flagship fix was dark on the surface
 * that actually renders.
 *
 * So: this hook is now a projection, and the mapping rules live exactly once,
 * in `canvas/state/analysisStateSelector.ts`.
 *
 * DO NOT re-introduce a local derivation here. If a surface needs something
 * this view does not carry, add it to the composed verdict — the whole point is
 * that two surfaces cannot disagree about a fact neither of them derives.
 */
import { useAnalysisState } from '../state/analysisStateSelector'
import type { AnalysisDisplayStateView } from '../utils/deriveAnalysisDisplayState'

export function useAnalysisDisplayState(): AnalysisDisplayStateView {
  return useAnalysisState().displayState
}
