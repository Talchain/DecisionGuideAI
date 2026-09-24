/**
 * `useModelChangedSinceRun` — HAS THE MODEL CHANGED SINCE THE RUN WHOSE
 * FIGURES THIS SURFACE IS SHOWING?
 *
 * ⭐ ONE QUESTION, ONE OWNER. Every factor surface that shows a run-derived
 * influence figure or rank (the card's two influence rows, its reduced line,
 * the `Key driver N` badge, the inspector's `ImportanceBar`) asks this and
 * nothing else before prefixing `LAST_RUN_PREFIX`. Spelling the predicate at
 * each site would be the hand-maintained mirror this estate keeps paying for
 * (CLAUDE.md trap 12).
 *
 * ⛔ IT IS NOT `!useAnalysisResultsAreCurrent()`. That hook's `false` pools
 * changed with cannot-confirm, none and never-run, and its own docblock forbids
 * rendering "the graph has changed" on it. A "Last run" label on a model that
 * was never run, or whose currency simply cannot be confirmed, would be a claim
 * the state does not support — the very thing goal criterion 1 rules out.
 *
 * ⭐ IT IS THE PREDICATE THE SIBLING CARDS ALREADY USE: `GoalNode`'s
 * `analysisChanged` and the `'changed'` arm of `OptionNode`'s currency note —
 * the composed verdict (`useAnalysisTrust`), which includes CEE's own stated
 * `analysis_state` when the turn carries one.
 *
 * ⚠ SCOPE, STATED: `cannot_confirm` does NOT label here. `OptionNode`'s pill
 * prefixes on `changed` OR `cannot_confirm`; this lane was briefed to key on
 * `changed` only, and the divergence is rowed in the PR rather than resolved
 * silently in either direction.
 */
import { useAnalysisTrust } from './useAnalysisTrust'
import { useCanvasStore } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { composeAnalysisState } from '../state/analysisStateSelector'
import { selectHasRenderableAnalysisResult } from '../ui/inspector-v2/useAnalysisResults'

export function useModelChangedSinceRun(): boolean {
  return useAnalysisTrust().semantic === 'changed'
}

/**
 * ⭐ A SECOND ROUTE TO THE SAME ANSWER, NOT A SECOND RULE.
 *
 * `useModelChangedSinceRun` above pulls in `useAnalysisTrust` →
 * `useAnalysisState` → `useAnalysisStateSource`, which calls
 * `isV5CanonicalAnalysisEnabled()` to classify `source`. A surface with
 * dozens of independently-mounted instances on one canvas (every edge) is a
 * costly place to add that whole chain as a new hard dependency PER EDGE —
 * and, traced through `composeAnalysisState`, `source` turns out not to
 * matter for the one question this hook answers: it feeds ONLY the
 * orphan-with-no-verdict synthesis (`resolveTrustEffectiveState`), which can
 * only move the result BETWEEN `'none'` and `'cannot_confirm'`. Neither is
 * `'changed'`, and every path that DOES reach `'changed'`
 * (`classifyFreshnessForDisplay`'s `'stale'` and dirty-overlay arms, and the
 * wire branch's `wireCurrencySuperseded`) reads `dirty` / `analysisStateV1`
 * directly and never consults `source` at all. So this hook still calls
 * `composeAnalysisState` — the ONE owner, never a restated rule (CLAUDE.md
 * trap 12) — with every OTHER input read from the store exactly as
 * `useAnalysisState` reads it, and only `source` fixed at `undefined`: a
 * proven no-op for `=== 'changed'`, not an assumed one.
 *
 * Reserved for a surface where per-instance cost genuinely matters
 * (`StyledEdge`, one subscription per edge on the canvas); `GoalNode` /
 * `OptionNode` and every other single-instance-per-surface consumer keep
 * reading `useModelChangedSinceRun` above.
 */
export function useModelChangedSinceRunLight(): boolean {
  const {
    analysisState, freshness, dirty, resultsStatus, resultsStartedAt,
    importHold, hasReport, hasCompletedFirstRun, ceeAnalysisReadyStatus,
  } = useCanvasStore(
    useShallow((s) => ({
      analysisState: s.analysisStateV1,
      freshness: s.analysisFreshness,
      dirty: s.analysisFreshnessDirty,
      resultsStatus: s.results?.status,
      resultsStartedAt: s.results?.startedAt,
      importHold: s.importPendingServerRegistration,
      hasReport: s.results?.report != null,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
      ceeAnalysisReadyStatus: s.ceeAnalysisReady?.status,
    })),
  )
  const hasRenderableResult = useCanvasStore(selectHasRenderableAnalysisResult)

  return composeAnalysisState({
    analysisState,
    freshness,
    dirty,
    source: undefined,
    resultsStatus,
    resultsStartedAt,
    importHold,
    hasReport,
    hasCompletedFirstRun,
    hasRenderableResult,
    ceeAnalysisReadyStatus,
    aiPanelV2On: true,
  }).semantic === 'changed'
}
