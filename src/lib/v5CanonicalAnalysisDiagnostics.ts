/**
 * V5 canonical-analysis diagnostic classifier for the debug bundle.
 *
 * v5-canonical-analysis brief (PR 1, item 6):
 *   - Adds three classification fields plus a CEE-capture section.
 *   - Reuses the existing derivePipelineStatus output for the underlying
 *     decision tree; does NOT change that classifier (verified-correct in
 *     Phase 0).
 *   - Distinguishes "no request made" (debug_capture_status:
 *     cee_capture_missing) from "request made and failed"
 *     (debug_capture_status: request_failed) — the bare
 *     `proxy_or_network_failure` label conflates these in legacy bundles.
 *
 * Pure inputs/outputs; no React, no zustand subscriptions.
 */

import type { AnalysisStateSource } from '../canvas/hooks/useAnalysisStateSource'
import type { ParseFailureKind } from '../v5/responseParser'

export type AnalysisFactStatus = 'present' | 'missing' | 'unknown_not_checked'

export type DebugCaptureStatus =
  | 'complete'
  | 'cee_capture_missing'
  | 'plot_only_capture'
  | 'parse_failed'
  | 'request_failed'

export interface V5CeeCapture {
  request_id: string | null
  scenario_id: string | null
  turn_id: string | null
  endpoint: string | null
  status: number | null
  duration_ms: number | null
  request_present: boolean
  response_present: boolean
  parse_ok: boolean
  parse_error: string | null
  response_top_level_keys: string[] | null
  /**
   * Whether the bundle carries the VERBATIM pre-validation JSON body.
   *   - Parse-error path: true when the parser envelope preserved `raw`
   *     (the JSON.parse output before strict validation).
   *   - Success path: false. The trace stores a parsed clone (validated,
   *     `blocks[]` pruned of tolerated Phase 3 entries, `__additive__`
   *     sidecar promoted to an enumerable key) — not the literal wire
   *     JSON. Reviewers reconstructing the wire shape combine
   *     `response_top_level_keys` (sourced from sidecar metadata) with
   *     the phase3 sidecar.
   */
  raw_response_present: boolean
  /** Why parsing failed; null on success. */
  parse_failure_kind: ParseFailureKind | null
  /**
   * Offending block `type` values when parse_failure_kind is
   * `unknown_block_types`. Null otherwise.
   */
  unknown_block_types: string[] | null
  /**
   * Whether top-level additive extensions (NOT phase 3 blocks-array
   * entries) were detected. Phase 3 blocks have dedicated fields below.
   */
  has_additive_extensions: boolean
  /**
   * Count of v1.3 Phase 3 blocks tolerated out of `blocks[]` by the parser
   * (review_card / coaching / evidence / exercise). Distinct from
   * `has_additive_extensions` because Phase 3 blocks live inside `blocks[]`
   * per the contract, not as top-level additive fields.
   */
  phase3_blocks_tolerated_count: number
  /** Distinct, sorted Phase 3 block types observed (subset of the whitelist). */
  phase3_block_types: string[]
  source: 'proxy_v5_turn'
}

export interface V5CanonicalAnalysisDiagnostic {
  v5_cee_capture: V5CeeCapture | null
  analysis_state_source: AnalysisStateSource
  analysis_fact_status: AnalysisFactStatus
  debug_capture_status: DebugCaptureStatus
  /** Whether the canonical-analysis flag was on at export time. */
  canonical_flag_on: boolean
}

export interface ClassifyInputs {
  canonicalFlagOn: boolean
  analysisStateSource: AnalysisStateSource
  /** From canvas store v5AnalysisFact slice. */
  factPresentForScenario: boolean
  /** True when an analysis_result block was observed in the captured CEE response. */
  ceeResponseHasAnalysisResult: boolean
  /** From payload-trace-store — most recent V5 CEE request/response pair. */
  v5Capture: V5CeeCapture | null
  /** True when results.report exists in canvas store. */
  hasResultsReport: boolean
  /** True when a PLoT direct request was captured. */
  plotRequestCaptured: boolean
}

/**
 * Classify the three diagnostic fields without changing any underlying
 * classifier. Inputs come from the debug bundle assembler.
 */
export function classifyV5CanonicalAnalysisDiagnostic(
  inputs: ClassifyInputs,
): V5CanonicalAnalysisDiagnostic {
  // analysis_fact_status: explicit V5 fact attached → present;
  // canonical flag on but no fact → missing;
  // canonical flag off → unknown_not_checked (the orphan classification
  // does not apply, so we don't claim absence).
  let analysis_fact_status: AnalysisFactStatus
  if (inputs.factPresentForScenario) {
    analysis_fact_status = 'present'
  } else if (inputs.canonicalFlagOn) {
    analysis_fact_status = 'missing'
  } else {
    analysis_fact_status = 'unknown_not_checked'
  }

  // debug_capture_status — surfaces the bundle health for V5 capture.
  //   complete: CEE call captured, parsed, response present
  //   cee_capture_missing: no V5 CEE request recorded but PLoT/results exist
  //   plot_only_capture: explicit PLoT-only path (no V5 call at all, but
  //                      results landed via direct V2)
  //   parse_failed: V5 CEE request and response present, but parse failed
  //   request_failed: V5 CEE request fired but did not produce a usable response
  let debug_capture_status: DebugCaptureStatus
  if (inputs.v5Capture === null) {
    if (inputs.plotRequestCaptured && inputs.hasResultsReport) {
      debug_capture_status = 'plot_only_capture'
    } else if (inputs.hasResultsReport) {
      debug_capture_status = 'cee_capture_missing'
    } else {
      // No V5 capture, no results. Either nothing has run yet or capture
      // is genuinely missing for an unrelated reason. Treat as
      // cee_capture_missing only when there's a result the user can see;
      // otherwise this state is non-diagnostic and we still surface
      // cee_capture_missing for honesty.
      debug_capture_status = 'cee_capture_missing'
    }
  } else if (!inputs.v5Capture.request_present) {
    debug_capture_status = 'cee_capture_missing'
  } else if (!inputs.v5Capture.response_present) {
    debug_capture_status = 'request_failed'
  } else if (!inputs.v5Capture.parse_ok) {
    debug_capture_status = 'parse_failed'
  } else {
    debug_capture_status = 'complete'
  }

  return {
    v5_cee_capture: inputs.v5Capture,
    analysis_state_source: inputs.analysisStateSource,
    analysis_fact_status,
    debug_capture_status,
    canonical_flag_on: inputs.canonicalFlagOn,
  }
}
