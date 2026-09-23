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

export function useModelChangedSinceRun(): boolean {
  return useAnalysisTrust().semantic === 'changed'
}
