/**
 * deriveAnalysisDisplayState — canonical mapper from raw analysis state
 * (CEE readiness + V2RunResponse + canvas-store staleness flag) to the
 * display state the user sees in the pre-analysis hero, the debug bundle,
 * and any other surface that needs a shared interpretation.
 *
 * The bug this fixes: the UI previously conflated `analysis_ready.status
 * === 'ready'` (CEE: "structurally ready to analyse") with "analysis is
 * complete". This helper enforces that "complete" requires a populated
 * V2RunResponse (`hasReport`) AND that the graph hasn't changed since
 * the run (`!graphEditedSinceLastRun`). Anything else is `ready_to_analyse`,
 * `results_stale`, or `not_ready`.
 *
 * Pure function — no hooks, no side effects. Use the
 * `useAnalysisDisplayState` hook to consume from a component.
 */

import type { ResultsStatus } from '../store'

export type AnalysisDisplayState =
  | 'not_ready'
  | 'ready_to_analyse'
  | 'complete'
  | 'results_stale'

export interface DeriveAnalysisDisplayStateInput {
  /** ceeAnalysisReady.status wire value, or undefined when the slice is null. */
  ceeAnalysisReadyStatus: string | undefined
  /** results.status from the canvas store. */
  resultsStatus: ResultsStatus
  /** True when results.report is non-null (V2RunResponse populated). */
  hasReport: boolean
  /** Canvas-store flag: true when the graph was edited after the last run. */
  graphEditedSinceLastRun: boolean
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
 * Precedence (first match wins):
 *   1. hasReport && !graphEditedSinceLastRun  → 'complete'
 *   2. hasReport && graphEditedSinceLastRun   → 'results_stale'
 *   3. ceeAnalysisReadyStatus === 'ready'     → 'ready_to_analyse'
 *   4. else                                   → 'not_ready'
 *
 * Note rule (1) is keyed on `hasReport`, NOT on `resultsStatus === 'complete'`.
 * A stale `resultsStatus === 'complete'` enum value (e.g. left over after a
 * new draft cleared `report` to null) must NEVER produce 'complete' on its
 * own. Without a populated report there is nothing to display.
 */
export function deriveAnalysisDisplayState(
  input: DeriveAnalysisDisplayStateInput,
): AnalysisDisplayStateView {
  const { ceeAnalysisReadyStatus, hasReport, graphEditedSinceLastRun } = input

  if (hasReport && !graphEditedSinceLastRun) {
    return {
      state: 'complete',
      headline: 'Analysis complete',
      iconName: 'Check',
      textColorClass: 'text-success',
      cta: null,
    }
  }

  if (hasReport && graphEditedSinceLastRun) {
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
