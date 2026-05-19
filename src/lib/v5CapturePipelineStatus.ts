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
  /**
   * V5-endpoint failure detected via `data.services.cee` 5xx/error
   * when the payload-trace has NO corresponding record. Distinguishes
   * "service-metadata says it failed" from "trace recorded a failed
   * proxy call" so reviewers know the evidence is metadata-level.
   */
  | 'request_failed_from_service_metadata'
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
  /**
   * Service-metadata-only V5 endpoint failure signal: true when
   * `data.services.cee.endpoint` matches the V5 turn endpoint AND its
   * status indicates failure (>= 500 or success === false), but the
   * payload-trace has no corresponding entry. Distinct from
   * `failedHttpRecord` which requires trace-store evidence.
   */
  serviceMetadataV5Failure: boolean
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
    } else if (inputs.serviceMetadataV5Failure) {
      // Service-metadata 5xx without a trace entry — the failure
      // happened but the trace store doesn't carry corroborating
      // evidence. Distinct from `request_failed` (trace-confirmed)
      // and `proxy_or_network_failure` (network/proxy source).
      status = 'request_failed_from_service_metadata'
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

  // ADDITIVE — fires whenever results exist without a live V5 capture
  // AND no failed HTTP record explains the absence. The chosen `status`
  // may be `hydrated_only` or `results_rendered_from_store_without_capture`
  // depending on rawV2Response evidence, but the contradiction itself is
  // present in both cases. Decoupling means reviewers see ALL applicable
  // issues regardless of which status enum was selected.
  const resultsWithoutLiveCapture =
    inputs.hasResultsReport &&
    (inputs.v5Capture === null ||
      !inputs.v5Capture.request_present ||
      !inputs.v5Capture.response_present) &&
    !inputs.failedHttpRecord.present
  if (resultsWithoutLiveCapture) {
    issues.push('results_rendered_from_store_without_capture')
  }

  if (inputs.scenarioIdConflictCount > 0) {
    issues.push('scenario_id_conflict')
  }

  // Independent of chosen status: fires whenever a parse-error envelope
  // preserved the raw response. parse_ok=false + raw_response_present=true
  // is the canonical PR #147 invariant signature; emit it as a visible
  // issue so reviewers don't have to cross-reference status enums.
  if (
    inputs.v5Capture !== null &&
    !inputs.v5Capture.parse_ok &&
    inputs.v5Capture.raw_response_present
  ) {
    issues.push('parse_failed_with_raw_preserved')
  }

  // Legacy says `proxy_or_network_failure` (a specific network/proxy
  // cause), but the new scoped classifier disagrees about the cause.
  // Fire the mislabel issue whenever the new status is anything OTHER
  // than `proxy_or_network_failure` — including `request_failed`, which
  // is still a different evidence-strength claim (the failure happened
  // but it's not proxy/network-confirmed).
  if (
    inputs.legacyPipelineStatus === 'proxy_or_network_failure' &&
    status !== 'proxy_or_network_failure'
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
 * Locate the most-relevant V5 CEE turn entry in the payload-trace
 * snapshot. Used by the bundle assembler to populate
 * `latest_v5_turn.{request_id, endpoint, duration_ms,
 * request_present, response_present}` from the actual capture
 * rather than from coarse session-level data.
 *
 * Preference order (the trace store keeps entries most-recent-first):
 *   1. completed response (status set OR completed === true)
 *   2. request-only (request body present but no response yet)
 *   3. any matching V5 entry (metadata-only stub fallback)
 *
 * Returns null when no V5 turn entry is recorded.
 */
export function findLatestV5TurnEntry<
  T extends {
    service?: string
    endpoint?: string
    completed?: boolean
    status?: number
    request?: { body?: unknown }
    response?: { body?: unknown }
  },
>(payloads: ReadonlyArray<T>): T | null {
  const v5 = payloads.filter((p) => {
    const endpoint = typeof p.endpoint === 'string' ? p.endpoint : ''
    return p.service === 'CEE' && endpoint.includes('/orchestrate/v2/turn')
  })
  if (v5.length === 0) return null

  // Tier 1: completed response (most authoritative).
  const completed = v5.find(
    (p) => p.response !== undefined || p.completed === true || typeof p.status === 'number',
  )
  if (completed) return completed

  // Tier 2: request-only (request fired, response pending).
  const requestOnly = v5.find((p) => p.request !== undefined)
  if (requestOnly) return requestOnly

  // Tier 3: metadata-only stub fallback.
  return v5[0]
}

/**
 * Scan a payload-trace snapshot for the first failed HTTP record that
 * belongs to the V5 CEE turn (the `/orchestrate/v2/turn` endpoint).
 * Unrelated failed records (PLoT, legacy CEE endpoints, ISL probes,
 * etc.) MUST NOT influence the V5 capture classification.
 *
 * A record qualifies when ALL of:
 *   - service is CEE
 *   - endpoint contains `/orchestrate/v2/turn`
 *   - one of: `completed === false`, `status >= 500`, `error` /
 *     `errorName` set, or `source ∈ {proxy,netlify,preflight_or_network,
 *     browser_timeout}`.
 *
 * Returns the source classification of the first qualifying failure, or
 * { present: false, source: null } when no V5-turn failure is recorded.
 */
export function detectFailedHttpRecord(
  payloads: ReadonlyArray<{
    service?: string
    endpoint?: string
    completed?: boolean
    status?: number
    error?: string
    errorName?: string
    source?: string
  }>,
): FailedHttpRecord {
  for (const p of payloads) {
    // Scope filter: only V5 CEE turn records influence V5 capture status.
    const endpoint = typeof p.endpoint === 'string' ? p.endpoint : ''
    const isV5CeeTurn =
      p.service === 'CEE' && endpoint.includes('/orchestrate/v2/turn')
    if (!isV5CeeTurn) continue

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
