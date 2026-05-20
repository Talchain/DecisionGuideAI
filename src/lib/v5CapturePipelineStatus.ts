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
// Round-3 + Round-4 review (P1 + IMP): shared V5 CEE detection
// helpers now live in `v5TraceMatching` so selector / fallback /
// failed-record detection / latest-turn lookup / provenance
// classification cannot drift on case or endpoint semantics.
import { isV5TurnEndpoint } from './v5TraceMatching'

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
  /**
   * Live-capture: fires when the analysis-producing CEE selector
   * picked a capture whose `response_hash` disagreed with the canvas
   * store's `results.hash`. BOTH hashes were present and they did
   * not match. Surfaces the contradiction rather than silently
   * picking a stale turn. Missing hash on either side never fires
   * this issue (hash matching is a soft preference).
   */
  | 'capture_response_hash_mismatch_with_results'
  /**
   * Round-5 review (P1): a `selected_cee_trace_id` was supplied to
   * the bundle assembler, but the matched trace entry failed V5
   * validation (wrong service, wrong endpoint, or look-alike path).
   * The bundle fell back to `findLatestV5TurnEntry` so capture
   * metadata stays honest; this issue records the pin attempt was
   * invalid so reviewers can debug the discrepancy.
   */
  | 'invalid_selected_trace_id'
  /**
   * Round-8 (follow-up to PR #153): the Run-analysis button fires
   * PLoT v1 directly (no CEE turn). When a PLoT v1 capture lands in
   * the bundle but no CEE turn was captured, this issue EXPLAINS
   * the CEE absence so reviewers don't read it as failure. NOT
   * contradictory — Run-analysis bypassing CEE is the legitimate
   * design contract.
   */
  | 'cee_turn_absent_for_plot_v1_capture'

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
  /**
   * True when the analysis-producing CEE selector reported that the
   * captured response hash and the canvas store's `results.hash`
   * BOTH existed AND disagreed. Fires
   * `capture_response_hash_mismatch_with_results`. Soft preference:
   * a missing hash on either side leaves this `false` (no evidence
   * is not a mismatch).
   */
  ceeCaptureResponseHashMismatch: boolean
  /**
   * Round-5 review (P1): true when the bundle assembler tried to pin
   * a canonical V5 trace by `selected_cee_trace_id` BUT either the
   * id didn't match any entry OR the matched entry failed V5
   * validation (wrong service/endpoint). Fires
   * `invalid_selected_trace_id`. The bundle falls back to
   * `findLatestV5TurnEntry` so metadata stays honest; this flag is
   * the diagnostic surface so reviewers see the pin attempt failed.
   */
  invalidSelectedTraceId: boolean
  /**
   * Round-8 (follow-up to PR #153): the bundle observes at least one
   * PLoT v1 engine entry in the trace store but NO CEE turn capture.
   * This is the expected shape for the Run-analysis button flow on
   * staging (PLoT direct, CEE not invoked). When true, the bundle
   * emits the `cee_turn_absent_for_plot_v1_capture` coherence issue
   * to EXPLAIN the absence — not as a contradiction. Defaults to
   * `false` for non-migrated callers (test fixtures).
   */
  plotV1CapturePresentWithoutCee?: boolean
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

  // ADDITIVE — fires whenever the analysis-producing CEE selector saw
  // both a captured response_hash and a canvas results.hash AND they
  // disagreed. Soft preference: the caller passes `false` when either
  // hash was missing (no evidence is not a mismatch). Independent of
  // chosen status so a reviewer sees the contradiction even when the
  // status enum is `complete`.
  if (inputs.ceeCaptureResponseHashMismatch) {
    issues.push('capture_response_hash_mismatch_with_results')
  }

  // Round-5 review (P1): pin-attempt failed → diagnostic. Additive,
  // doesn't change capture_pipeline_status (the bundle already fell
  // back to findLatestV5TurnEntry; status reflects the fallback's
  // tier classification).
  if (inputs.invalidSelectedTraceId) {
    issues.push('invalid_selected_trace_id')
  }

  // Round-8 (follow-up to PR #153): explanatory diagnostic — emitted
  // when the Run-analysis flow recorded a PLoT v1 capture but no CEE
  // turn fired. Tracked in `EXPLANATORY_COHERENCE_ISSUES` below so it
  // does NOT force `coherence.state = 'contradictory'`.
  if (inputs.plotV1CapturePresentWithoutCee === true) {
    issues.push('cee_turn_absent_for_plot_v1_capture')
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

  // Round-2 review (P1): any non-empty issues list flips `state` to
  // `'contradictory'` BEFORE the missing/complete/partial fallbacks.
  // Pre-fix, `state` stayed `'missing'` whenever
  // `capture_pipeline_status === 'capture_missing'` even if a real
  // contradiction (e.g. `capture_response_hash_mismatch_with_results`)
  // was in the issues array — hiding the disagreement behind a more
  // neutral "missing" label. The correct precedence is:
  //   any contradiction issue → 'contradictory'
  //   else status capture_missing → 'missing'
  //   else status complete → 'complete'
  //   else → 'partial'
  //
  // Round-8 (follow-up to PR #153): explanatory issues (currently
  // just `cee_turn_absent_for_plot_v1_capture`) do NOT force
  // `contradictory`. They are emitted to EXPLAIN expected absences
  // (Run-analysis legitimately skips CEE). Reviewers see the issue
  // string for context but the state stays whatever the underlying
  // status implies.
  const contradictionIssues = issues.filter(
    (i) => !EXPLANATORY_COHERENCE_ISSUES.has(i),
  )
  let state: CoherenceState
  if (contradictionIssues.length > 0) {
    state = 'contradictory'
  } else if (status === 'capture_missing') {
    state = 'missing'
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
 * Round-8 (follow-up to PR #153): coherence-issue codes that EXPLAIN
 * an expected absence rather than report a contradiction. Emitted in
 * `coherence.issues` so reviewers see them, but excluded from the
 * "any issue → contradictory" rule above.
 */
const EXPLANATORY_COHERENCE_ISSUES: ReadonlySet<CoherenceIssue> = new Set([
  'cee_turn_absent_for_plot_v1_capture',
])

/** Whether a trace-store entry carries a parseable response body. */
function traceEntryHasResponseBody(p: {
  response?: { body?: unknown }
}): boolean {
  return (
    p.response !== undefined &&
    p.response !== null &&
    p.response.body !== undefined &&
    p.response.body !== null
  )
}

/** Whether a trace-store entry carries a request body. */
function traceEntryHasRequestBody(p: {
  request?: { body?: unknown }
}): boolean {
  return (
    p.request !== undefined &&
    p.request !== null &&
    p.request.body !== undefined &&
    p.request.body !== null
  )
}

/**
 * Locate the most-relevant V5 CEE turn entry in the payload-trace
 * snapshot. Used by the bundle assembler to populate
 * `latest_v5_turn.{request_id, endpoint, duration_ms,
 * request_present, response_present, response_body_present}` from the
 * actual capture rather than from coarse session-level data.
 *
 * Preference order (the trace store keeps entries most-recent-first):
 *   1. response BODY present (a parseable response was captured)
 *   2. response metadata only (completed === true OR status set, no body)
 *   3. request-only (request body present but no response yet)
 *   4. any matching V5 entry (metadata-only stub fallback)
 *
 * The body-first preference prevents a status-only metadata stub from
 * masking a richer body-bearing entry — directly addresses the
 * round-5 P1.2 concern.
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
  // Round-3 review (P1): use the SHARED helper (case-insensitive CEE +
  // V5 endpoint scoping) so the selector, failed-record detection,
  // latest-turn lookup, and bundle-tier resolution cannot drift.
  const v5 = payloads.filter(isV5TurnEndpoint)
  if (v5.length === 0) return null

  // Tier 1: a parseable response body is present (most authoritative).
  const withBody = v5.find(traceEntryHasResponseBody)
  if (withBody) return withBody

  // Tier 2: HTTP completed but no body (status set or completed flag).
  const completedNoBody = v5.find(
    (p) => p.completed === true || typeof p.status === 'number',
  )
  if (completedNoBody) return completedNoBody

  // Tier 3: request fired, response pending.
  const requestOnly = v5.find(traceEntryHasRequestBody)
  if (requestOnly) return requestOnly

  // Tier 4: metadata-only stub fallback.
  return v5[0]
}

/**
 * Body-presence helper exposed for callers that need to disambiguate
 * "HTTP completed" from "parseable body available". This is the
 * structural signal behind `latest_v5_turn.response_body_present`.
 */
export function hasResponseBody(p: { response?: { body?: unknown } }): boolean {
  return traceEntryHasResponseBody(p)
}

/**
 * Round-5 review (P1): outcome codes for `findCanonicalV5TraceForBundle`
 * so the bundle assembler can emit explicit diagnostics — instead of
 * silently falling back when a pin is invalid.
 */
export type CanonicalV5TraceSource =
  | 'pinned' // selectedTraceId resolved to a valid V5 CEE entry
  | 'fallback_latest' // no selectedTraceId, fell back to findLatestV5TurnEntry
  | 'invalid_pin_fell_back' // selectedTraceId matched an entry, but it failed
                            // V5 validation; fell back to findLatestV5TurnEntry
  | 'pin_not_found_fell_back' // selectedTraceId did not match any entry
  | 'none' // no V5 entry anywhere

export interface CanonicalV5TraceResult<T> {
  trace: T | null
  source: CanonicalV5TraceSource
}

/**
 * Round-4 review (P0) + Round-5 review (P1): canonical V5 trace pin.
 *
 * Pre-fix the bundle assembler used `findLatestV5TurnEntry` to source
 * `v5_cee_capture` metadata (request_id, endpoint, status, parse_ok)
 * while `bundle.payloads.cee_response` was sourced from the
 * analysis-producing selector. When a newer non-analysis V5 turn
 * existed (e.g. `graph_edit` after `run_analysis`), the two views
 * described different turns — metadata vs body could disagree on
 * request_id, endpoint, and status.
 *
 * This helper pins both views to the SAME trace: when the selector
 * supplies a `selectedTraceId`, the matching entry is returned —
 * BUT only after re-validating with `isV5TurnEndpoint`. Round-5
 * review (P1): pre-fix the function accepted any id match, so a
 * non-V5 trace id could surface as the canonical V5 trace. Now an
 * id-matched-but-non-V5 entry triggers `invalid_pin_fell_back`,
 * and the bundle emits the `invalid_selected_trace_id` coherence
 * issue downstream.
 *
 * When no `selectedTraceId` (or the pin is invalid / not found),
 * falls back to `findLatestV5TurnEntry` (no regression for cases
 * where the selector didn't run).
 */
export function findCanonicalV5TraceForBundle<
  T extends {
    id?: string
    service?: string
    endpoint?: string
    completed?: boolean
    status?: number
    request?: { body?: unknown }
    response?: { body?: unknown }
  },
>(
  payloads: ReadonlyArray<T>,
  selectedTraceId: string | null,
): CanonicalV5TraceResult<T> {
  // No id pin → straight to findLatestV5TurnEntry.
  if (selectedTraceId === null || selectedTraceId.length === 0) {
    const fallback = findLatestV5TurnEntry(payloads)
    return {
      trace: fallback,
      source: fallback === null ? 'none' : 'fallback_latest',
    }
  }

  // Id pin supplied — try to match.
  const pinnedById = payloads.find((p) => p.id === selectedTraceId)
  if (pinnedById === undefined) {
    // Round-7 review: the pin id didn't match any entry. Could
    // happen if the trace store was evicted between selector and
    // bundle assembly. Record the pin-attempt outcome
    // (`pin_not_found_fell_back`) REGARDLESS of whether the
    // fallback finds anything — the round-6 blocking rule rejects
    // any non-pin trace, so reviewers need the pin-failure recorded
    // even when no V5 fallback is available.
    return {
      trace: findLatestV5TurnEntry(payloads),
      source: 'pin_not_found_fell_back',
    }
  }

  // Round-5 P1: validate the pinned entry is actually a V5 CEE turn.
  // Without this, a caller passing a legacy / non-CEE trace id could
  // promote a non-V5 entry into v5_cee_capture metadata.
  if (!isV5TurnEndpoint(pinnedById)) {
    // Round-7 review: same logic as the pin-not-found path — record
    // the pin-attempt outcome (`invalid_pin_fell_back`) regardless
    // of whether the fallback finds a different V5 trace.
    return {
      trace: findLatestV5TurnEntry(payloads),
      source: 'invalid_pin_fell_back',
    }
  }

  return { trace: pinnedById, source: 'pinned' }
}

/**
 * Round-6 BLOCKING-fix rule, expressed as a pure helper.
 *
 * When `findCanonicalV5TraceForBundle` falls back because the pin
 * failed validation (`invalid_pin_fell_back`) or the id didn't
 * match any entry (`pin_not_found_fell_back`), the bundle MUST NOT
 * silently use the fallback trace as live metadata for the selected
 * body. Pre-fix the legacy classifier path and the snapshot
 * assembler each implemented this inline; extracting it here keeps
 * the two views in sync and gives tests a single function to pin.
 *
 * Returns:
 *   - `trace`: `null` when the pin failed, otherwise the canonical
 *     trace (or the latest-V5 fallback when no pin was supplied).
 *   - `invalidSelectedTraceId`: `true` exactly when the bundle
 *     should emit the `invalid_selected_trace_id` coherence issue.
 */
export function enforceCanonicalPinRule<T>(
  canonical: CanonicalV5TraceResult<T>,
): { trace: T | null; invalidSelectedTraceId: boolean } {
  const invalidSelectedTraceId =
    canonical.source === 'invalid_pin_fell_back' ||
    canonical.source === 'pin_not_found_fell_back'
  return {
    trace: invalidSelectedTraceId ? null : canonical.trace,
    invalidSelectedTraceId,
  }
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
    // Scope filter: only V5 CEE turn records influence V5 capture
    // status. Round-3 review (P1): use the SHARED case-insensitive
    // helper so a `cee`-cased entry is treated identically by the
    // selector and the failure detector.
    if (!isV5TurnEndpoint(p)) continue

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
