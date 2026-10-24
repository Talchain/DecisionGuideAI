/**
 * ⭐ ONE ANALYSIS STATUS, FROM CEE'S HELD CANONICAL VIEW (canvas audit P0, Paul 24 Oct 2026: "one status + one run
 * button"; DL ruling: the held `canonical_analysis_view` is the one authority, a local unsaved edit always wins, and
 * `stale: null` never reads as current).
 *
 * Measured on staging 147aaccb before this: Paul's funding board carried a current Run (view `stale: false`), but the
 * UI's own boot proof declined it (`canvas_not_proven_equal`), and a program board's `analysis_state` said `never_run`
 * beside a view holding its Run. Every status surface then said "not analysed" / "Run a first pass" next to a
 * "Re-run analysis" button. This reads what CEE says about its own Run; it composes nothing.
 *
 * A view binds only when it is held for the current scenario and names its Run by id AND graph hash (the chat card's
 * identity rule, `runViewOf`); otherwise there is no Run on record from the view.
 */
import type { CanonicalAnalysisView } from '../runView/canonicalAnalysisView'
import type { AnalysisFreshnessState } from '../store/analysisFreshness'
import { useCanvasStore } from '../store'
import { useCanonicalAnalysisViewStore } from '../stores/canonicalAnalysisViewStore'

/** CEE's word on its own Run: current, stale, currency unknown, or no bound Run at all (null). */
export type CanonicalRunStatus = 'current' | 'stale' | 'unknown' | null

/** `freshnessReason` for a verdict taken from the view, so its origin is visible in debug output (never user copy). */
export const CANONICAL_VIEW_FRESHNESS_REASON = 'canonical_view_staleness'

export function canonicalRunStatus(view: CanonicalAnalysisView | null): CanonicalRunStatus {
  const run = view?.run
  if (!run || !run.run_id || !run.graph_hash_at_run) return null
  const stale = view.staleness.stale
  return stale === false ? 'current' : stale === true ? 'stale' : 'unknown'
}

/**
 * The freshness the view states, used only where the UI holds no verdict of its own (null, or its own `unknown`).
 * `unknown` stays `unknown`: a Run on record, never a claim that it is current.
 */
export function canonicalViewFreshness(
  status: CanonicalRunStatus,
  held: AnalysisFreshnessState | null,
): AnalysisFreshnessState | null {
  if (status === null || (held !== null && held.freshness !== 'unknown')) return held
  const freshness = status === 'current' ? 'fresh' : status === 'stale' ? 'stale' : 'unknown'
  return { freshness, freshnessReason: CANONICAL_VIEW_FRESHNESS_REASON }
}

/** The view's status for the current scenario (primitive selectors only, so it never re-renders on identity). */
export function useCanonicalRunStatus(): CanonicalRunStatus {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  return useCanonicalAnalysisViewStore((s) =>
    s.scenarioId !== null && s.scenarioId === currentScenarioId ? canonicalRunStatus(s.view) : null)
}
