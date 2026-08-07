/**
 * deriveAnalysisDisplayState — canonical mapper from raw analysis state
 * (CEE readiness + populated report + canvas-store staleness flag) to the
 * display state the user sees in the pre-analysis hero, the debug bundle,
 * and any other surface that needs a shared interpretation.
 *
 * The bug this fixes: the UI previously conflated `analysis_ready.status
 * === 'ready'` (CEE: "structurally ready to analyse") with "analysis is
 * complete". This helper enforces that "complete" requires a populated
 * report AND that the graph hasn't changed since the run. Anything else
 * is `ready_to_analyse`, `results_stale`, or `not_ready`.
 *
 * Pure function — no hooks, no side effects. Use the
 * `useAnalysisDisplayState` hook to consume from a component.
 */

export type AnalysisDisplayState =
  | 'not_ready'
  | 'ready_to_analyse'
  | 'complete'
  | 'results_stale'

export interface DeriveAnalysisDisplayStateInput {
  /** ceeAnalysisReady.status wire value, or undefined when the slice is null. */
  ceeAnalysisReadyStatus: string | undefined
  /** True when results.report is non-null (populated run response). */
  hasReport: boolean
  /**
   * True when the analysis is DEFINITELY out of date — the shared CEE freshness
   * display semantic (`classifyFreshnessForDisplay`) is 'changed' (CEE 'stale'
   * OR a retained-fresh-now-dirtied by a local edit). Sourced via the hook from
   * the CEE freshness slice + dirty overlay, NOT the local `graphEditedSinceLastRun`
   * flag — so 'cannot_confirm' (CEE-unknown) never fabricates a 'Results may be
   * outdated' claim here (it falls through to the neutral 'complete' completion fact).
   */
  analysisChanged: boolean
}

export interface AnalysisDisplayCTA {
  kind: 'primary' | 'secondary'
  label: 'Run analysis' | 'Rerun analysis'
}

export interface AnalysisDisplayStateView {
  state: AnalysisDisplayState
  /** Sentence-case British English headline shown in the hero/banner. */
  headline: string
  /** Lucide icon name. The component imports the icon component itself. */
  iconName: 'Play' | 'Check' | 'RefreshCw' | 'AlertCircle'
  /** Tailwind class applied to headline + icon. */
  textColorClass: 'text-info' | 'text-success' | 'text-warning' | 'text-text-light'
  /** CTA shown alongside the headline; null when no CTA applies. */
  cta: AnalysisDisplayCTA | null
}

/**
 * CEE statuses that explicitly mean "structure is not analysable". These
 * MUST override a prior populated report — when the model is no longer
 * analysable (e.g. user deleted the goal node), the old report is
 * meaningless and showing "Analysis complete" would mislead the user.
 *
 * `undefined` and `'missing'` are NOT in this set: those represent absent
 * readiness (CEE response in flight, slice transiently null during scenario
 * load). A genuinely complete prior result should remain visible during
 * those windows.
 *
 * 'blocked' (Lane UI-W5, CEE #358 defensive leg): CEE's documented
 * semantics are "validation failure prevents analysis — invalid graph
 * structure". The empty-options synthesis on legacy/unparseable reloads is
 * rejected by the V5 normaliser before it reaches this helper (store slice
 * cleared → status undefined), but the Ep2 readiness path can emit
 * 'blocked' WITH populated options, which the lenient normaliser passes
 * through — without this entry that state would render green "Analysis
 * complete" whenever a prior report is held. Rendering-level mapping only.
 */
const EXPLICIT_NOT_READY_STATUSES: ReadonlySet<string> = new Set([
  'needs_encoding',
  'needs_user_mapping',
  'needs_user_input',
  'blocked',
])

function isExplicitNotReady(status: string | undefined): boolean {
  return status !== undefined && EXPLICIT_NOT_READY_STATUSES.has(status)
}

/**
 * Precedence (first match wins):
 *   1. Explicit non-ready CEE status (needs_encoding / needs_user_mapping /
 *      needs_user_input) → 'not_ready' even when a prior report exists.
 *   2. hasReport && !analysisChanged → 'complete'
 *      Works even when readiness is briefly absent (undefined / 'missing'),
 *      because a populated report stands on its own — readiness gating only
 *      matters before a successful run lands. 'Analysis complete' is a completion
 *      fact, not a currentness claim, so this is also the correct neutral
 *      fallback for the CEE-unknown 'cannot_confirm' case (which is NOT 'changed').
 *   3. hasReport && analysisChanged → 'results_stale'
 *   4. ceeAnalysisReadyStatus === 'ready' (no report) → 'ready_to_analyse'
 *   5. else (no report, no readiness signal) → 'not_ready'
 *
 * Note rule (2) is keyed on `hasReport`, not on the run-status enum. A
 * stale enum value with a cleared report (e.g. results.status='complete'
 * left over after a new draft cleared `report` to null) must NEVER
 * produce 'complete'. Without a populated report there is nothing to
 * display.
 */
export function deriveAnalysisDisplayState(
  input: DeriveAnalysisDisplayStateInput,
): AnalysisDisplayStateView {
  const { ceeAnalysisReadyStatus, hasReport, analysisChanged } = input

  if (isExplicitNotReady(ceeAnalysisReadyStatus)) {
    return {
      state: 'not_ready',
      headline: 'Set up your model',
      iconName: 'AlertCircle',
      textColorClass: 'text-text-light',
      cta: null,
    }
  }

  if (hasReport && !analysisChanged) {
    return {
      state: 'complete',
      headline: 'Analysis complete',
      iconName: 'Check',
      textColorClass: 'text-success',
      cta: null,
    }
  }

  if (hasReport && analysisChanged) {
    return {
      state: 'results_stale',
      headline: 'Results may be outdated',
      iconName: 'RefreshCw',
      textColorClass: 'text-warning',
      cta: { kind: 'secondary', label: 'Rerun analysis' },
    }
  }

  if (ceeAnalysisReadyStatus === 'ready') {
    return {
      state: 'ready_to_analyse',
      headline: 'Ready to analyse',
      iconName: 'Play',
      textColorClass: 'text-info',
      cta: { kind: 'primary', label: 'Run analysis' },
    }
  }

  return {
    state: 'not_ready',
    headline: 'Set up your model',
    iconName: 'AlertCircle',
    textColorClass: 'text-text-light',
    cta: null,
  }
}
