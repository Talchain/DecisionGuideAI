/**
 * useAnalysisTrust — THE single answer to "can these results be trusted as
 * current?", now COLLAPSED BEHIND `canvas/state/analysisStateSelector.ts`.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * A thin binding, kept at its original path so that none of its eleven
 * consumers has to change. The pure core it used to own
 * (`computeAnalysisTrust`, `resolveTrustEffectiveState`, `ORPHANED_RESULT`,
 * `AnalysisTrust`) has MOVED into the selector and is re-exported verbatim from
 * here — same names, same shapes, same semantics. The move was to make the
 * dependency run one way; leaving the core here would have made the selector
 * and this module import each other.
 *
 * WHAT CHANGED FOR CONSUMERS
 * --------------------------
 * `useAnalysisTrust()` now reads the composed verdict. When CEE states an
 * `analysis_state` on the turn, `semantic` is CEE's verdict; when it does not,
 * `semantic` is exactly what this hook has always returned, because the
 * selector's derived branch calls `computeAnalysisTrust` below rather than
 * restating it. Every existing fixture predates the field, so every existing
 * test renders unchanged — that is the no-visual-change pin, and it is asserted
 * directly in `canvas/state/__tests__/analysisStateSelector.spec.ts`.
 *
 * WHY THE CORE STAYS EXPORTED
 * ---------------------------
 * Three specs and one component (`AnalysisFreshnessNotice`) drive the pure
 * functions directly, without React. They keep working, and they keep testing
 * the real derived-branch implementation rather than a copy of it.
 *
 * ORIGINAL RATIONALE, still true and still the reason this concept exists:
 * before it, three independent mechanisms answered "can these results be
 * trusted as current?" and disagreed on screen — the CEE-verdict slice, the V5
 * fact/orphan classifier, and a dead `useStaleGuard` whose hash keys had zero
 * write sites. One CEE 'stale' verdict rendered two banners; a completed run
 * could sit under a retained pre-run "Model changed" claim. The selector is the
 * same argument carried one level up: SIX derivations, one composed verdict.
 */
import { useAnalysisState } from '../state/analysisStateSelector'

export {
  ORPHANED_RESULT,
  resolveTrustEffectiveState,
  computeAnalysisTrust,
  type AnalysisTrust,
} from '../state/analysisStateSelector'

import type { AnalysisTrust } from '../state/analysisStateSelector'

export function useAnalysisTrust(): AnalysisTrust {
  return useAnalysisState().trust
}
