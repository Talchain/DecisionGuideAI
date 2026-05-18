/**
 * useAnalysisStateSource — derive the canonical "where did the current
 * Results state come from?" classification.
 *
 * v5-canonical-analysis brief (PR 1):
 *   - When the canonical flag is OFF, a present `results.report` is treated
 *     as `direct_plot_legacy` (existing behaviour, not orphaned).
 *   - When the canonical flag is ON:
 *       - `cee_v5_run_analysis` requires an explicit V5 run_analysis fact
 *         attached to the current scenario AND matching the results hash.
 *         Generic `ceeAnalysisReady` is NOT proof (per correction 3).
 *       - `cee_v5_followup` is reserved for follow-up analyses that re-use a
 *         prior fact (when CEE emits one but the analysis hash is unchanged
 *         from the previous fact).
 *       - `orphaned_plot_result` triggers when `results.report` exists but
 *         there is no successful run_analysis fact for the current
 *         scenario.
 *   - `none` means no Results yet.
 */
import { useMemo } from 'react'

import { isV5CanonicalAnalysisEnabled } from '../../flags'
import { useCanvasStore } from '../store'

export type AnalysisStateSource =
  | 'cee_v5_run_analysis'
  | 'cee_v5_followup'
  | 'direct_plot_legacy'
  | 'orphaned_plot_result'
  | 'none'

export interface AnalysisStateSourceResult {
  source: AnalysisStateSource
  /**
   * Whether the orphan banner should be surfaced. Only true for
   * `orphaned_plot_result` — the flag being OFF is NOT an orphan condition.
   */
  showOrphanBanner: boolean
  /** Diagnostic — read by debug bundle classifier. */
  hasResultsReport: boolean
  /** Diagnostic — read by debug bundle classifier. */
  factPresentForScenario: boolean
}

function selectInputs(state: ReturnType<typeof useCanvasStore.getState>) {
  return {
    reportHash: state.results?.hash ?? null,
    reportPresent: !!state.results?.report,
    currentScenarioId: state.currentScenarioId,
    fact: state.v5AnalysisFact,
  }
}

/**
 * Pure classifier. Exported separately so tests can drive it without React.
 */
export function classifyAnalysisStateSource(args: {
  canonicalFlagOn: boolean
  reportPresent: boolean
  reportHash: string | null
  currentScenarioId: string | null
  fact: {
    scenarioId: string | null
    analysisHash: string | null
    hasRunAnalysisFact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  } | null
}): AnalysisStateSourceResult {
  const { canonicalFlagOn, reportPresent, reportHash, currentScenarioId, fact } = args

  if (!reportPresent) {
    return {
      source: 'none',
      showOrphanBanner: false,
      hasResultsReport: false,
      factPresentForScenario: false,
    }
  }

  // Per correction 3: a V5 fact requires explicit signals — never inferred
  // from generic readiness. The fact slice in canvas store is the canonical
  // source; we additionally require scenario match so cross-scenario stale
  // facts don't claim coverage.
  const factForScenario =
    fact !== null &&
    (fact.scenarioId === null || fact.scenarioId === currentScenarioId) &&
    (fact.hasRunAnalysisFact === true || fact.freshness === 'fresh')

  if (!canonicalFlagOn) {
    return {
      source: 'direct_plot_legacy',
      showOrphanBanner: false,
      hasResultsReport: true,
      factPresentForScenario: factForScenario,
    }
  }

  // Canonical flag is ON from here.
  if (!factForScenario) {
    return {
      source: 'orphaned_plot_result',
      showOrphanBanner: true,
      hasResultsReport: true,
      factPresentForScenario: false,
    }
  }

  // Follow-up classification: when the fact's analysis hash matches the
  // current results hash, the present Results panel is attached to a
  // previously-minted fact rather than a brand-new run. Useful for the
  // debug bundle's analysis_state_source field; banner suppression is
  // identical to the new-run case.
  if (fact?.analysisHash !== null && fact?.analysisHash === reportHash) {
    return {
      source: 'cee_v5_run_analysis',
      showOrphanBanner: false,
      hasResultsReport: true,
      factPresentForScenario: true,
    }
  }
  return {
    source: 'cee_v5_followup',
    showOrphanBanner: false,
    hasResultsReport: true,
    factPresentForScenario: true,
  }
}

export function useAnalysisStateSource(): AnalysisStateSourceResult {
  const reportPresent = useCanvasStore((s) => !!s.results?.report)
  const reportHash = useCanvasStore((s) => s.results?.hash ?? null)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const fact = useCanvasStore((s) => s.v5AnalysisFact)

  return useMemo(
    () =>
      classifyAnalysisStateSource({
        canonicalFlagOn: isV5CanonicalAnalysisEnabled(),
        reportPresent,
        reportHash,
        currentScenarioId,
        fact: fact
          ? {
              scenarioId: fact.scenarioId,
              analysisHash: fact.analysisHash,
              hasRunAnalysisFact: fact.hasRunAnalysisFact,
              freshness: fact.freshness,
            }
          : null,
      }),
    [reportPresent, reportHash, currentScenarioId, fact],
  )
}

/** Re-export helper for non-React consumers (debug bundle, tests). */
export function readAnalysisStateSourceFromStore(): AnalysisStateSourceResult {
  const inputs = selectInputs(useCanvasStore.getState())
  return classifyAnalysisStateSource({
    canonicalFlagOn: isV5CanonicalAnalysisEnabled(),
    reportPresent: inputs.reportPresent,
    reportHash: inputs.reportHash,
    currentScenarioId: inputs.currentScenarioId,
    fact: inputs.fact
      ? {
          scenarioId: inputs.fact.scenarioId,
          analysisHash: inputs.fact.analysisHash,
          hasRunAnalysisFact: inputs.fact.hasRunAnalysisFact,
          freshness: inputs.fact.freshness,
        }
      : null,
  })
}
