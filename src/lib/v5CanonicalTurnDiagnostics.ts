/**
 * V5 canonical turn diagnostics — richer assembler for the debug bundle.
 *
 * Composes (not replaces) the existing
 * `classifyV5CanonicalAnalysisDiagnostic`. Adds:
 *   - canonical flag source (env / localStorage / default / unknown)
 *   - latest V5 turn capture summary
 *   - parse outcome details
 *   - analysis-fact details (incl. read-through graph_hash_at_generation)
 *   - results metrics (option count, factor sensitivity count)
 *   - scenario-ID reconciliation (re-exported into the snapshot)
 *   - capture-pipeline status + coherence issues
 *
 * The new field is `bundle.v5_canonical_turn_diagnostics`. The legacy
 * block `bundle.v5_canonical_analysis` stays untouched and continues to
 * be emitted alongside.
 *
 * Pure module. No React, no zustand subscriptions.
 */

import type { AnalysisStateSource } from '../canvas/hooks/useAnalysisStateSource'
import type { ParseFailureKind } from '../v5/responseParser'
import type { ScenarioIdReconciliation } from './scenarioIdReconciliation'
import type {
  V5CanonicalAnalysisDiagnostic,
  V5CeeCapture,
} from './v5CanonicalAnalysisDiagnostics'
import type {
  CapturePipelineStatus,
  CoherenceIssue,
  CoherenceState,
} from './v5CapturePipelineStatus'

export type CanonicalFlagSource = 'env' | 'localStorage' | 'default' | 'unknown'

/**
 * Literal env var name the canonical-analysis flag is bound to. Kept as
 * a constant so the bundle carries the grep-able `VITE_V5_CANONICAL_ANALYSIS`
 * string verbatim (brief D — feature flag visibility).
 */
export const CANONICAL_FLAG_ENV_KEY = 'VITE_V5_CANONICAL_ANALYSIS' as const

/**
 * Compact feature-flag diagnostic — grep-ability surface for support
 * tooling. Currently scoped to the canonical-analysis flag; structure
 * leaves room for future flags without breaking consumers.
 */
export interface FeatureFlagDiagnostic {
  VITE_V5_CANONICAL_ANALYSIS: {
    value: boolean
    source: CanonicalFlagSource
  }
}

export interface V5CanonicalTurnDiagnostics {
  /** Verbatim env-key string for grep-ability across exported bundles. */
  canonical_flag_env_key: typeof CANONICAL_FLAG_ENV_KEY
  canonical_flag_on: boolean
  canonical_flag_source: CanonicalFlagSource
  /** Compact keyed feature-flag object for support tooling. */
  feature_flag_diagnostic: FeatureFlagDiagnostic
  /**
   * Top-level mirror of the bundle's `effective_cee_response_source`
   * (direct/downstream/none) so a single section answers "which CEE
   * extraction path produced the captured response".
   */
  effective_cee_response_source: 'direct' | 'downstream' | 'none' | null
  latest_v5_turn: {
    request_present: boolean
    response_present: boolean
    /** HTTP request_id from the captured CEE call. */
    request_id: string | null
    /** Scenario the call was issued against. */
    scenario_id: string | null
    /** Per-turn client identifier (typically the analysis hash). */
    turn_id: string | null
    /** CEE endpoint hit. Null when the trace didn't record it. */
    endpoint: string | null
    /** HTTP status code. */
    status: number | null
    /** Wall-clock duration of the call in ms. */
    duration_ms: number | null
    /** Source discriminator for capture provenance. */
    source: 'proxy_v5_turn' | null
  }
  parse: {
    parse_ok: boolean | null
    parse_error: string | null
    parse_failure_kind: ParseFailureKind | null
    raw_response_present: boolean
    response_top_level_keys: string[] | null
    /** Offending block `type` values when parse_failure_kind is
     *  `unknown_block_types`; null otherwise. */
    unknown_block_types: string[] | null
  }
  analysis_fact: {
    present: boolean
    has_run_analysis_fact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
    scenario_id: string | null
    /** Read-through from canvas v5AnalysisFact slice. Null when the slice
     *  does not carry the field on this code path. */
    graph_hash_at_generation: string | null
    phase3_raw_block_count: number
    phase3_raw_block_types: string[]
    /**
     * Where the fact-presence signal came from:
     *   - 'v5_canonical_analysis' — legacy classifier output
     *   - 'source_classifier'     — synthesised fallback derived from
     *                               `sourceResult.factPresentForScenario`
     *   - 'none'                  — no fact present
     */
    source: 'v5_canonical_analysis' | 'source_classifier' | 'none'
  }
  results: {
    present: boolean
    source: AnalysisStateSource
    option_count: number
    factor_sensitivity_count: number
    /**
     * Brief lists `rendered_option_count` / `rendered_factor_count` /
     * `influence_unmatched_count`. These require display-state
     * inspection that this snapshot does not perform; the bundle's
     * existing `display_state` block carries those signals when
     * captured. Documented here for traceability; values are not
     * synthesised to avoid overclaiming.
     */
    rendered_counts_documented_in: 'bundle.display_state'
  }
  capture_pipeline_status: CapturePipelineStatus
  coherence: {
    state: CoherenceState
    issues: CoherenceIssue[]
  }
  scenario_id_reconciliation: ScenarioIdReconciliation
}

export interface AssembleV5CanonicalTurnDiagnosticsInputs {
  /** Output of the legacy classifier (already on the bundle). */
  legacyDiagnostic: V5CanonicalAnalysisDiagnostic
  /** Whether `legacyDiagnostic` came from a real classifier run vs.
   *  the synthesised fallback. Drives `analysis_fact.source`. */
  legacyDiagnosticFromClassifier: boolean
  /** Result of diagnoseFlagState for the canonical flag. Pass null when
   *  the source cannot be resolved (e.g. tests without localStorage). */
  flagDiagnostic: {
    resolved: boolean
    source: 'env' | 'localStorage' | 'default'
  } | null
  /** From the existing AnalysisStateSource classifier. */
  analysisStateSource: AnalysisStateSource
  hasResultsReport: boolean
  /** Mirror of bundle.effective_cee_response_source. */
  effectiveCeeResponseSource: 'direct' | 'downstream' | 'none' | null
  /** Read-through. Slice may not carry this on every code path; emit null. */
  graphHashAtGeneration: string | null
  /** Results metrics from bundle payloads / canvas store. */
  optionCount: number
  factorSensitivityCount: number
  /** Output of classifyV5CapturePipelineStatus. */
  capturePipeline: {
    capture_pipeline_status: CapturePipelineStatus
    coherence: { state: CoherenceState; issues: CoherenceIssue[] }
  }
  /** Output of reconcileScenarioId. */
  scenarioIdReconciliation: ScenarioIdReconciliation
}

export function assembleV5CanonicalTurnDiagnostics(
  inputs: AssembleV5CanonicalTurnDiagnosticsInputs,
): V5CanonicalTurnDiagnostics {
  const capture: V5CeeCapture | null = inputs.legacyDiagnostic.v5_cee_capture

  const canonical_flag_source: CanonicalFlagSource = inputs.flagDiagnostic
    ? inputs.flagDiagnostic.source
    : 'unknown'

  const latest_v5_turn = {
    request_present: capture?.request_present ?? false,
    response_present: capture?.response_present ?? false,
    request_id: capture?.request_id ?? null,
    scenario_id: capture?.scenario_id ?? null,
    turn_id: capture?.turn_id ?? null,
    endpoint: capture?.endpoint ?? null,
    status: capture?.status ?? null,
    duration_ms: capture?.duration_ms ?? null,
    source: capture?.source ?? null,
  }

  const parse = {
    parse_ok: capture ? capture.parse_ok : null,
    parse_error: capture?.parse_error ?? null,
    parse_failure_kind: capture?.parse_failure_kind ?? null,
    raw_response_present: capture?.raw_response_present ?? false,
    response_top_level_keys: capture?.response_top_level_keys ?? null,
    unknown_block_types: capture?.unknown_block_types ?? null,
  }

  // analysis_fact.* — scenario_id comes from the V5 capture (which already
  // reads from canvas store currentScenarioId in exportBundle assembly);
  // present + has_run_analysis_fact + freshness come from the legacy
  // diagnostic; graph_hash_at_generation is a read-through.
  const factPresent = inputs.legacyDiagnostic.analysis_fact_status === 'present'
  const factSource: 'v5_canonical_analysis' | 'source_classifier' | 'none' =
    !factPresent
      ? 'none'
      : inputs.legacyDiagnosticFromClassifier
        ? 'v5_canonical_analysis'
        : 'source_classifier'
  const analysis_fact = {
    present: factPresent,
    has_run_analysis_fact: null as boolean | null,
    freshness: null as 'fresh' | 'stale' | 'unknown' | 'none' | null,
    scenario_id: capture?.scenario_id ?? null,
    graph_hash_at_generation: inputs.graphHashAtGeneration,
    phase3_raw_block_count: capture?.phase3_blocks_tolerated_count ?? 0,
    phase3_raw_block_types: capture?.phase3_block_types ?? [],
    source: factSource,
  }

  const results = {
    present: inputs.hasResultsReport,
    source: inputs.analysisStateSource,
    option_count: inputs.optionCount,
    factor_sensitivity_count: inputs.factorSensitivityCount,
    rendered_counts_documented_in: 'bundle.display_state' as const,
  }

  const feature_flag_diagnostic = {
    [CANONICAL_FLAG_ENV_KEY]: {
      value: inputs.legacyDiagnostic.canonical_flag_on,
      source: canonical_flag_source,
    },
  } as FeatureFlagDiagnostic

  return {
    canonical_flag_env_key: CANONICAL_FLAG_ENV_KEY,
    canonical_flag_on: inputs.legacyDiagnostic.canonical_flag_on,
    canonical_flag_source,
    feature_flag_diagnostic,
    effective_cee_response_source: inputs.effectiveCeeResponseSource,
    latest_v5_turn,
    parse,
    analysis_fact,
    results,
    capture_pipeline_status: inputs.capturePipeline.capture_pipeline_status,
    coherence: inputs.capturePipeline.coherence,
    scenario_id_reconciliation: inputs.scenarioIdReconciliation,
  }
}

/**
 * Pure helper for the assembler to fill `analysis_fact.has_run_analysis_fact`
 * and `analysis_fact.freshness` when the canvas store's v5AnalysisFact
 * slice is available to the caller. Kept separate so the main assembler
 * stays free of store coupling.
 */
export function attachAnalysisFactDetails(
  diagnostics: V5CanonicalTurnDiagnostics,
  fact: {
    hasRunAnalysisFact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  } | null,
): V5CanonicalTurnDiagnostics {
  if (!fact) return diagnostics
  return {
    ...diagnostics,
    analysis_fact: {
      ...diagnostics.analysis_fact,
      has_run_analysis_fact: fact.hasRunAnalysisFact,
      freshness: fact.freshness,
    },
  }
}

/**
 * Extract option count from a PLoT V2 response (already in the bundle
 * payloads). Returns 0 when the response is absent or doesn't carry
 * `option_comparison`. Treats anything except an array as 0.
 */
export function extractOptionCountFromPlotResponse(
  plotResponse: unknown,
): number {
  if (!plotResponse || typeof plotResponse !== 'object' || Array.isArray(plotResponse)) {
    return 0
  }
  const oc = (plotResponse as Record<string, unknown>).option_comparison
  return Array.isArray(oc) ? oc.length : 0
}

/**
 * Extract factor_sensitivity entry count from a PLoT V2 response.
 */
export function extractFactorSensitivityCountFromPlotResponse(
  plotResponse: unknown,
): number {
  if (!plotResponse || typeof plotResponse !== 'object' || Array.isArray(plotResponse)) {
    return 0
  }
  const fs = (plotResponse as Record<string, unknown>).factor_sensitivity
  return Array.isArray(fs) ? fs.length : 0
}
