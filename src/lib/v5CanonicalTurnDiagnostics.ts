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
 * Provenance enum for the latest V5 turn snapshot — describes WHERE the
 * capture data came from rather than the legacy `'proxy_v5_turn'`
 * literal on V5CeeCapture.source.
 *
 * **Intentional brief extension**: the brief lists four values
 * (`payload_trace | bundle_payloads | store | none`). DGAI's bundle
 * also carries `data.services.cee` records which are evidence-strength
 * distinct from both `bundle.payloads` and trace-store data. We add
 * `service_metadata` as a fifth value so reviewers see honest
 * provenance attribution; tests and JSDoc document this addition. If
 * the brief enum is to be kept stable for cross-team consumers,
 * service-metadata exclusivity is also recorded in
 * `diagnostic_source_strength.latest_v5_turn`.
 */
export type LatestV5TurnSource =
  | 'payload_trace'
  | 'bundle_payloads'
  | 'service_metadata'
  | 'store'
  | 'none'

/**
 * Single canonical capture-tier resolver. Used by both the legacy
 * `V5CeeCapture` assembly site and the new snapshot assembler so the
 * two views never disagree about where the capture data came from.
 *
 * Tier order (highest evidence first):
 *   1. payload_trace — V5 turn entry exists in the trace store
 *   2. bundle_payloads — bundle.payloads.cee_request/response set
 *   3. service_metadata — V5 endpoint reports FAILURE in
 *                         `data.services.cee` with no payload/trace
 *                         evidence. Narrowed to failure evidence
 *                         only (round-5 P1.4): a successful service
 *                         record without payloads is suspicious and
 *                         should drop to `store` or `none` so the
 *                         missingness is visible.
 *   4. store — no capture but a v5AnalysisFact exists for the scenario
 *   5. none — no evidence at all
 */
export function determineCaptureTier(inputs: {
  traceEntryPresent: boolean
  bundlePayloadsCeeRequestPresent: boolean
  bundlePayloadsCeeResponsePresent: boolean
  /**
   * True when `data.services.cee.endpoint` matches the V5 turn
   * endpoint AND the record indicates a failure (success === false,
   * status >= 500, status === 0, or `error` set). Successful
   * service-metadata records do NOT activate this tier — they fall
   * through so reviewers see the missing-payload anomaly.
   */
  serviceMetadataV5FailurePresent: boolean
  factPresentForScenario: boolean
}): LatestV5TurnSource {
  if (inputs.traceEntryPresent) return 'payload_trace'
  if (
    inputs.bundlePayloadsCeeRequestPresent ||
    inputs.bundlePayloadsCeeResponsePresent
  ) {
    return 'bundle_payloads'
  }
  if (inputs.serviceMetadataV5FailurePresent) return 'service_metadata'
  if (inputs.factPresentForScenario) return 'store'
  return 'none'
}

/**
 * Diagnostic-source strength per major bundle block. Reviewers use this
 * to know which fields were sourced from live trace data vs. synthesised
 * fallback vs. store-only assembly.
 */
export interface DiagnosticSourceStrength {
  latest_v5_turn:
    | 'live_trace'
    | 'service_metadata'
    | 'bundle_payloads'
    | 'fallback'
    | 'unavailable'
  parse: 'live_response' | 'fallback' | 'unavailable'
  results: 'plot_response' | 'store_report' | 'unavailable'
}

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
    /**
     * True when HTTP-level completion is observed (status set,
     * `completed === true`, or a `response` object is present). This
     * does NOT imply a parseable body is available — see
     * `response_body_present` for that distinction.
     */
    response_present: boolean
    /**
     * True only when a parseable response body was actually captured.
     * Distinguishes HTTP completion from body availability — a 500
     * with no body sets `response_present: true` but
     * `response_body_present: false`, preventing reviewers from
     * mistaking metadata for parse evidence.
     */
    response_body_present: boolean
    /** HTTP request_id from the captured CEE call. */
    request_id: string | null
    /**
     * Where `request_id` came from:
     *   - `payload_trace` — the actual id of the V5 trace entry
     *   - `session`       — fallback to `data.overall.request_id`
     *   - `none`          — no capture and no session id
     */
    request_id_source: 'payload_trace' | 'session' | 'none'
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
    /**
     * Where the capture data came from. Distinct from the legacy
     * `V5CeeCapture.source: 'proxy_v5_turn'` literal; this is the
     * brief's richer provenance enum:
     *   - payload_trace   — assembled from a payload-trace-store entry
     *   - bundle_payloads — assembled from `bundle.payloads.cee_*`
     *   - service_metadata — only `data.services.cee` was present (DGAI
     *                        intentional extension to the brief enum;
     *                        see LatestV5TurnSource JSDoc)
     *   - store           — derived from canvas store fact, no capture
     *   - none            — no capture at all
     */
    source: LatestV5TurnSource
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
     * Count of options actually rendered by the UI, sourced from
     * `bundle.display_state.rendered_options.length`. Null when
     * display_state is absent (no fabrication).
     */
    rendered_option_count: number | null
    /**
     * Count of factors actually rendered by the UI, sourced from
     * `bundle.display_state.rendered_factors.length`. Null when
     * display_state is absent.
     */
    rendered_factor_count: number | null
    /** Stable pointer to where rendered counts live in the wider bundle. */
    rendered_counts_documented_in: 'bundle.display_state'
  }
  capture_pipeline_status: CapturePipelineStatus
  coherence: {
    state: CoherenceState
    issues: CoherenceIssue[]
  }
  scenario_id_reconciliation: ScenarioIdReconciliation
  /**
   * Per-major-block source strength — tells reviewers which fields came
   * from live trace, service metadata, plot response, store state, or
   * fallback. Aggregates explicit `analysis_fact.source` /
   * `scenario_id_reconciliation.selected_source` for the rest of the
   * snapshot.
   */
  diagnostic_source_strength: DiagnosticSourceStrength
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
  /**
   * Canonical capture tier resolved once at the call site (via
   * `determineCaptureTier`). Drives `latest_v5_turn.source` directly
   * and feeds `diagnostic_source_strength.latest_v5_turn`. Replaces
   * the previous ad-hoc boolean inputs to ensure the assembler can't
   * disagree with the upstream V5CeeCapture assembly about provenance.
   */
  captureTier: LatestV5TurnSource
  /**
   * True when a parseable response body was captured (round-5 P0.2):
   * trace.response.body OR bundle.payloads.cee_response is an object.
   * Critical: a status-only trace entry sets response_present=true
   * but body_present=false, so parse_ok must be null.
   */
  responseBodyPresent: boolean
  /**
   * Rendered counts pulled from `bundle.display_state` when present;
   * `null` when display_state is absent.
   */
  renderedOptionCount: number | null
  renderedFactorCount: number | null
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

  // Capture tier comes from the upstream resolver — single canonical
  // source of truth shared with the V5CeeCapture assembly.
  //
  // Stabilisation coherence guard: when `capture === null` (legacy
  // synthesised fallback path, e.g. classifier threw), the assembler
  // cannot honestly report fields from V5CeeCapture. Claiming
  // `source: 'payload_trace'` while every capture field is null would
  // be a provenance contradiction. Downgrade to `'store'` (if a fact
  // is present) or `'none'` so latest_v5_turn.source and the rest of
  // the section stay coherent. The `diagnostic_source_strength`
  // mapping below already maps these downgraded values to 'fallback'
  // / 'unavailable' respectively — reviewers still see that capture
  // was absent on this export.
  const latestV5TurnSource: LatestV5TurnSource =
    capture === null
      ? inputs.captureTier === 'store'
        ? 'store'
        : 'none'
      : inputs.captureTier

  // request_id source attribution. Trace-tier entries carry the real
  // payload-trace id; lower tiers fall back to the session-level
  // request_id. Round-5 P1.1: when no actual id value exists (capture
  // absent OR capture.request_id null), source MUST be `'none'` —
  // emitting `'session'` with a null id would mislead reviewers into
  // thinking the session-level fallback was attempted but came up empty.
  const requestIdSource: 'payload_trace' | 'session' | 'none' =
    capture === null || capture.request_id === null
      ? 'none'
      : latestV5TurnSource === 'payload_trace'
        ? 'payload_trace'
        : 'session'

  const latest_v5_turn = {
    request_present: capture?.request_present ?? false,
    response_present: capture?.response_present ?? false,
    response_body_present: capture !== null && inputs.responseBodyPresent,
    request_id: capture?.request_id ?? null,
    request_id_source: requestIdSource,
    scenario_id: capture?.scenario_id ?? null,
    turn_id: capture?.turn_id ?? null,
    endpoint: capture?.endpoint ?? null,
    status: capture?.status ?? null,
    duration_ms: capture?.duration_ms ?? null,
    source: latestV5TurnSource,
  }

  // parse_ok is only meaningful when a response BODY was actually
  // captured and parsed. Round-5 P0.2/P0.3 lesson: status-only or
  // failure-without-body trace entries previously inherited
  // `parse_ok: true` from the synthesised legacy value. Gate on the
  // explicit `responseBodyPresent` signal now — without a body, there
  // is nothing to parse.
  const parseOkResolved: boolean | null =
    capture === null || !inputs.responseBodyPresent ? null : capture.parse_ok
  const parse = {
    parse_ok: parseOkResolved,
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
    /** Count from bundle.display_state.rendered_options when present. */
    rendered_option_count: inputs.renderedOptionCount,
    /** Count from bundle.display_state.rendered_factors when present. */
    rendered_factor_count: inputs.renderedFactorCount,
    rendered_counts_documented_in: 'bundle.display_state' as const,
  }

  const diagnostic_source_strength: DiagnosticSourceStrength = {
    latest_v5_turn:
      latestV5TurnSource === 'payload_trace'
        ? 'live_trace'
        : latestV5TurnSource === 'bundle_payloads'
          ? 'bundle_payloads'
          : latestV5TurnSource === 'service_metadata'
            ? 'service_metadata'
            : latestV5TurnSource === 'store'
              ? 'fallback'
              : 'unavailable',
    // Parse strength is honest about evidence: 'live_response' ONLY
    // when a parseable response body was actually captured. Round-5
    // P0.2: status-only or failure-without-body responses must NOT
    // surface as 'live_response' just because response_present=true.
    parse:
      capture === null || !inputs.responseBodyPresent
        ? 'unavailable'
        : 'live_response',
    results:
      inputs.optionCount > 0 || inputs.factorSensitivityCount > 0
        ? 'plot_response'
        : inputs.hasResultsReport
          ? 'store_report'
          : 'unavailable',
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
    diagnostic_source_strength,
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
