/**
 * Honest capture-pipeline status for the debug bundle.
 *
 * Sits ALONGSIDE the existing `derivePipelineStatus` (which feeds the
 * legacy `pipeline.v5_pipeline_status` field). The legacy classifier
 * over-emits `proxy_or_network_failure` when there's no captured failed
 * HTTP record — this module replaces that with a coherent reading that
 * distinguishes "missing capture" from "actual proxy/network failure".
 *
 * Pure module. Callers extract candidates from the bundle + payload-trace
 * snapshot and pass them in. The legacy field is NOT modified.
 */

import type { AnalysisStateSource } from '../canvas/hooks/useAnalysisStateSource'

export type CapturePipelineStatus =
  | 'complete'
  | 'parse_failed'
  | 'request_failed'
  | 'proxy_or_network_failure'
  | 'results_rendered_from_store_without_capture'
  | 'hydrated_only'
  | 'capture_missing'

export type CoherenceIssue =
  | 'analysis_state_cee_v5_but_effective_cee_response_none'
  | 'analysis_fact_present_but_cee_capture_missing'
  | 'results_rendered_from_store_without_capture'
  | 'scenario_id_conflict'
  | 'parse_failed_with_raw_preserved'
  | 'legacy_pipeline_status_misleading_proxy_or_network_failure'

export type CoherenceState = 'complete' | 'partial' | 'contradictory' | 'missing'

export interface FailedHttpRecord {
  present: boolean
  /** When present, the trace-store source classification of the failure. */
  source: string | null
}

export interface V5CapturePipelineStatusInputs {
  /**
   * Slim view of the v5_cee_capture block already assembled by
   * exportBundle. Null when no V5 CEE call was captured at all.
   */
  v5Capture: {
    request_present: boolean
    response_present: boolean
    parse_ok: boolean
    raw_response_present: boolean
  } | null
  /** True when canvas store has a populated results.report. */
  hasResultsReport: boolean
  /** True when the canvas store carries `rawV2Response` (fresh-run signal). */
  rawV2ResponsePresent: boolean
  /** Failed-HTTP-record signal from the payload-trace store. */
  failedHttpRecord: FailedHttpRecord
  /** From the existing AnalysisStateSource classifier. */
  analysisStateSource: AnalysisStateSource
  /** Existing bundle field. */
  effectiveCeeResponseSource: 'direct' | 'downstream' | 'none' | null
  /** Whether the canvas store has a populated v5AnalysisFact for the scenario. */
  analysisFactPresent: boolean
  /** Number of disagreeing scenario-ID sources from reconciliation. */
  scenarioIdConflictCount: number
  /** Legacy `pipeline.v5_pipeline_status` value, for disagreement detection. */
  legacyPipelineStatus: string | null
}

export interface V5CapturePipelineStatusResult {
  capture_pipeline_status: CapturePipelineStatus
  coherence: {
    state: CoherenceState
    issues: CoherenceIssue[]
  }
}

const PROXY_NETWORK_SOURCES: ReadonlySet<string> = new Set([
  'proxy',
  'netlify',
  'preflight_or_network',
  'browser_timeout',
])

/**
 * Classify capture pipeline status + coherence issues. Pure function.
 *
 * State precedence (first match wins):
 *   1. No V5 request captured:
 *        a. Failed HTTP record (proxy/network) → proxy_or_network_failure
 *        b. Failed HTTP record (other)         → request_failed
 *        c. Results present + rawV2Response    → results_rendered_from_store_without_capture
 *        d. Results present, no rawV2Response  → hydrated_only
 *        e. Nothing                            → capture_missing
 *   2. Request present, no response:
 *        a. Failed HTTP record (proxy/network) → proxy_or_network_failure
 *        b. Otherwise                          → request_failed
 *   3. parse_ok === false                       → parse_failed
 *   4. parse_ok === true                        → complete
 *
 * `complete` covers both analysis-bearing turns (with results) and
 * non-analysis turns (capture honest, no results expected). The
 * distinction is reported elsewhere — this module only classifies the
 * capture surface, not the turn type.
 */
export function classifyV5CapturePipelineStatus(
  inputs: V5CapturePipelineStatusInputs,
): V5CapturePipelineStatusResult {
  let status: CapturePipelineStatus

  if (inputs.v5Capture === null || !inputs.v5Capture.request_present) {
    if (inputs.failedHttpRecord.present) {
      const src = inputs.failedHttpRecord.source
      status =
        src !== null && PROXY_NETWORK_SOURCES.has(src)
          ? 'proxy_or_network_failure'
          : 'request_failed'
    } else if (inputs.hasResultsReport) {
      status = inputs.rawV2ResponsePresent
        ? 'results_rendered_from_store_without_capture'
        : 'hydrated_only'
    } else {
      status = 'capture_missing'
    }
  } else if (!inputs.v5Capture.response_present) {
    const src = inputs.failedHttpRecord.source
    status =
      inputs.failedHttpRecord.present &&
      src !== null &&
      PROXY_NETWORK_SOURCES.has(src)
        ? 'proxy_or_network_failure'
        : 'request_failed'
  } else if (!inputs.v5Capture.parse_ok) {
    status = 'parse_failed'
  } else {
    status = 'complete'
  }

  const issues: CoherenceIssue[] = []

  if (
    inputs.analysisStateSource === 'cee_v5_run_analysis' &&
    inputs.effectiveCeeResponseSource === 'none'
  ) {
    issues.push('analysis_state_cee_v5_but_effective_cee_response_none')
  }

  if (
    inputs.analysisFactPresent &&
    (inputs.v5Capture === null || !inputs.v5Capture.request_present)
  ) {
    issues.push('analysis_fact_present_but_cee_capture_missing')
  }

  if (status === 'results_rendered_from_store_without_capture') {
    issues.push('results_rendered_from_store_without_capture')
  }

  if (inputs.scenarioIdConflictCount > 0) {
    issues.push('scenario_id_conflict')
  }

  if (status === 'parse_failed' && inputs.v5Capture?.raw_response_present) {
    issues.push('parse_failed_with_raw_preserved')
  }

  if (
    inputs.legacyPipelineStatus === 'proxy_or_network_failure' &&
    status !== 'proxy_or_network_failure' &&
    status !== 'request_failed'
  ) {
    issues.push('legacy_pipeline_status_misleading_proxy_or_network_failure')
  }

  let state: CoherenceState
  if (status === 'capture_missing') {
    state = 'missing'
  } else if (issues.length > 0) {
    state = 'contradictory'
  } else if (status === 'complete') {
    state = 'complete'
  } else {
    state = 'partial'
  }

  return {
    capture_pipeline_status: status,
    coherence: { state, issues },
  }
}

/**
 * Scan a payload-trace snapshot for the first failed HTTP record. A
 * record qualifies when:
 *   - `completed === false`, OR
 *   - `status >= 500`, OR
 *   - `error` / `errorName` strings are set, OR
 *   - `source` is one of the explicit network/proxy classifications.
 *
 * Returns the source classification of the first failure found, or
 * { present: false, source: null } when no failure is recorded.
 */
export function detectFailedHttpRecord(
  payloads: ReadonlyArray<{
    completed?: boolean
    status?: number
    error?: string
    errorName?: string
    source?: string
  }>,
): FailedHttpRecord {
  for (const p of payloads) {
    const sourceFlag =
      typeof p.source === 'string' && PROXY_NETWORK_SOURCES.has(p.source)
    const isFailed =
      p.completed === false ||
      (typeof p.status === 'number' && p.status >= 500) ||
      typeof p.error === 'string' ||
      typeof p.errorName === 'string' ||
      sourceFlag
    if (isFailed) {
      return { present: true, source: (p.source as string) ?? null }
    }
  }
  return { present: false, source: null }
}
