/**
 * Evidence-bearing CEE turn selector — sibling to
 * `analysisProducingCeeTurn.ts`.
 *
 * Why a second selector?
 *
 * The existing `findLatestAnalysisProducingCeeTurn` admits any V5
 * turn whose action/turn type is in `ANALYSIS_PRODUCING_ACTION_TYPES`
 * (`run_analysis`, `what_would_flip`, `explain`). It then ranks
 * candidates on REQUEST-side signals (hash, scenario, completion,
 * recency) without inspecting the RESPONSE body. This works fine
 * for the conversational pinning use case (`bundle.payloads.cee_*`).
 *
 * But after a user (1) runs analysis (`run_analysis` — response has
 * `blocks: [{type: 'analysis_result', enrichment: {...}}]`) and then
 * (2) clicks a follow-up chip like "What could change the outcome?"
 * (`what_would_flip` mapped to turnType `explain` — response has
 * `blocks: []`), the existing selector picks the prose-only
 * follow-up on recency. The downstream evidence resolver
 * (`v5EmbeddedEvidence.ts`) finds no `analysis_result` block, returns
 * `unavailable`, and `scientific_validation.source = unavailable` —
 * even though the earlier `run_analysis` trace is still in the
 * trace-store ring buffer with full embedded enrichment.
 *
 * This module adds a stricter selector that additionally requires
 * the response body to be EVIDENCE-BEARING. The debug bundle runs
 * both selectors:
 *   - the existing selector drives `bundle.payloads.cee_*` and the
 *     conversational trace fields (preserves raw-capture honesty);
 *   - this selector drives `evidence_resolution`, `scientific_validation`,
 *     and a new `bundle.analysis_evidence_trace` block that records
 *     WHICH trace the evidence came from and surfaces the recovered
 *     response body for reviewer auditability.
 *
 * Scoring stays IDENTICAL to the existing selector's hash/recency
 * formula so that when both selectors yield a candidate which is
 * also evidence-bearing, they pick the same trace.
 *
 * Scenario rejection is new and stricter:
 *   - When `currentScenarioId` is known, candidates with an explicit
 *     different scenario id are REJECTED outright (not just
 *     deprioritised). This prevents cross-scenario evidence
 *     contamination — a real risk because the trace-store ring
 *     buffer holds 20 entries, which can span multiple scenarios
 *     during a session of switching decisions.
 *   - Candidates with no scenario id at all are kept as a fallback
 *     and flagged via `used_missing_scenario_fallback`.
 *
 * Pure module — no React, no Zustand, no side effects.
 */

import {
  ANALYSIS_PRODUCING_ACTION_TYPES,
  readResponseHashWithSource,
  readScenarioId,
  readTurnOrActionType,
  type HashMatchStatus,
  type ResponseHashReading,
  type ResponseHashSource,
  type SelectorTracedPayload,
} from './analysisProducingCeeTurn'
import { isCeeService, isV5TurnEndpoint } from './v5TraceMatching'
import { RAW_PAYLOAD_INDICATIVE_KEYS } from './v5EvidenceKeys'

// Re-export for convenience so callers consuming this module don't
// also need to import from `analysisProducingCeeTurn.ts` for the
// shared trace-payload shape.
export type { SelectorTracedPayload, ResponseHashSource, HashMatchStatus }

/**
 * Why a candidate was selected (or why no candidate was selected).
 *
 *   - `'hash_matched'`                  — selected because its captured
 *                                          response_hash matched `resultsHash`.
 *   - `'scenario_matched_recency'`      — at least one candidate matched
 *                                          `currentScenarioId`; selected by
 *                                          recency among those.
 *   - `'evidence_bearing_recency'`      — no hash match, scenario gate
 *                                          inactive or fell back to
 *                                          missing-scenario; selected by
 *                                          recency among evidence-bearing
 *                                          candidates.
 *   - `'no_evidence_bearing_candidate'` — analysis-producing candidates
 *                                          existed but none carried
 *                                          evidence-bearing enrichment.
 *   - `'no_analysis_producing_candidate'`
 *                                       — V5 endpoint candidates existed
 *                                          but none had an analysis-
 *                                          producing action/turn type.
 *   - `'no_v5_endpoint_candidate'`      — CEE traces existed but none
 *                                          matched the V5 turn endpoint.
 *   - `'no_cee_candidate'`              — trace store had no CEE entries.
 */
export type EvidenceSelectionReason =
  | 'hash_matched'
  | 'scenario_matched_recency'
  | 'evidence_bearing_recency'
  | 'no_evidence_bearing_candidate'
  | 'no_analysis_producing_candidate'
  | 'no_v5_endpoint_candidate'
  | 'no_cee_candidate'

/**
 * Scenario gate outcome for the SELECTED candidate.
 *
 *   - `'scenario_matched'`             — candidate's scenario_id ===
 *                                         currentScenarioId.
 *   - `'scenario_missing_on_candidate'` — selected candidate had no
 *                                          scenario_id at all; chosen
 *                                          as a fallback (see
 *                                          `used_missing_scenario_fallback`).
 *   - `'scenario_unknown'`             — `currentScenarioId === null`,
 *                                         scenario gate not applied.
 *   - `'no_candidate'`                 — no candidate was selected.
 */
export type EvidenceScenarioStatus =
  | 'scenario_matched'
  | 'scenario_missing_on_candidate'
  | 'scenario_unknown'
  | 'no_candidate'

/**
 * Diagnostic surface emitted alongside the selected candidate.
 * Records counts at each filter stage, scenario-gate behaviour,
 * and the dominant selection signal — without exposing raw payload
 * content. Reviewers can answer "why this trace?" from the bundle.
 */
export interface EvidenceSelectionDiagnostics {
  /** Total CEE-service entries seen (any endpoint). */
  readonly cee_candidate_count: number
  /** CEE entries with V5 turn-endpoint scoping applied. */
  readonly v5_endpoint_candidate_count: number
  /** Of the V5-endpoint candidates, how many were analysis-producing. */
  readonly analysis_producing_candidate_count: number
  /**
   * Of the analysis-producing candidates, how many carried
   * evidence-bearing enrichment in their response body.
   */
  readonly evidence_bearing_candidate_count: number
  /**
   * Of the evidence-bearing candidates, how many were rejected
   * because their scenario_id explicitly differs from
   * `currentScenarioId`. Useful for spotting cross-scenario trace-
   * store contamination.
   */
  readonly rejected_scenario_mismatch_count: number
  /**
   * True when the selected candidate had no scenario_id and no
   * scenario_matched candidate existed — i.e. the scenario gate
   * fell back to "accept missing scenario."
   */
  readonly used_missing_scenario_fallback: boolean
  /** Whether a candidate was selected via the primary filter chain. */
  readonly selected_via_primary_path: boolean
  /** Dominant ranking signal — see `EvidenceSelectionReason`. */
  readonly selected_reason: EvidenceSelectionReason
  /** Hash-evidence summary for the selected candidate (or null path). */
  readonly hash_match_status: HashMatchStatus
  /** Scenario-gate summary for the selected candidate. */
  readonly scenario_status: EvidenceScenarioStatus
}

export interface EvidenceBearingSelectionResult {
  /** Selected trace entry, or undefined when nothing qualified. */
  selected: SelectorTracedPayload | undefined
  /** Selected trace entry's `id` (trace-store identifier), when present. */
  selected_trace_id: string | null
  /** The captured response_hash for the selected entry (when readable). */
  selected_response_hash: string | null
  /** Where in the response body the hash was read from (when readable). */
  selected_response_hash_source: ResponseHashSource | null
  /**
   * True ONLY when both `canvas store.results.hash` and the captured
   * response_hash are present AND disagree. Missing hash on either
   * side → false (not a mismatch — just no evidence to compare).
   * Surfaces on the bundle as
   * `analysis_evidence_trace.hash_mismatch_observed` so reviewers
   * can spot recovered evidence whose hash disagrees with the
   * currently-rendered results.
   */
  hash_mismatch_observed: boolean
  /** Ranking + scenario-gate diagnostics. */
  selection_diagnostics: EvidenceSelectionDiagnostics
}

/**
 * Defensive: is the value a plain non-array object?
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Plain object AND non-empty (at least one own key). */
function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return isPlainObject(v) && Object.keys(v).length > 0
}

/**
 * True iff the enrichment object carries any indicative scientific
 * key, or any of the known sidecar payloads (`_meta.payloads.*`,
 * `downstream_calls.isl.response`). Single source of truth for
 * "is this enrichment really evidence-bearing?"
 *
 * The indicative-keys list is shared with the resolver via
 * `v5EvidenceKeys.ts` so selector and resolver cannot drift.
 */
function enrichmentIsEvidenceBearing(
  enrichment: Record<string, unknown>,
): boolean {
  for (const k of RAW_PAYLOAD_INDICATIVE_KEYS) {
    if (enrichment[k] !== undefined && enrichment[k] !== null) return true
  }
  const meta = enrichment._meta
  if (isPlainObject(meta)) {
    const payloads = (meta as Record<string, unknown>).payloads
    if (isPlainObject(payloads)) {
      if (isNonEmptyObject((payloads as Record<string, unknown>).plot_response)) return true
      if (isNonEmptyObject((payloads as Record<string, unknown>).plot_request)) return true
      if (isNonEmptyObject((payloads as Record<string, unknown>).isl_request)) return true
      if (isNonEmptyObject((payloads as Record<string, unknown>).isl_response)) return true
    }
  }
  const downstream = enrichment.downstream_calls
  if (isPlainObject(downstream)) {
    const isl = (downstream as Record<string, unknown>).isl
    if (isPlainObject(isl)) {
      const response = (isl as Record<string, unknown>).response
      if (isNonEmptyObject(response)) return true
    }
  }
  return false
}

/**
 * Walk a `blocks[]` array looking for an `analysis_result` block
 * whose enrichment is evidence-bearing. Returns true on first hit.
 * Returns false for missing/non-array blocks or no-match.
 */
function blocksHaveEvidenceBearingAnalysisResult(blocks: unknown): boolean {
  if (!Array.isArray(blocks)) return false
  for (const b of blocks) {
    if (!isPlainObject(b)) continue
    if (b.type !== 'analysis_result') continue
    const enrichment = (b as Record<string, unknown>).enrichment
    if (!isPlainObject(enrichment)) continue
    if (enrichmentIsEvidenceBearing(enrichment as Record<string, unknown>)) {
      return true
    }
  }
  return false
}

/**
 * True iff the trace's response body carries an `analysis_result`
 * block (either at top-level or under the parse-error `raw.blocks`
 * wrapper) whose enrichment is evidence-bearing. Mirrors the
 * resolver's `findAnalysisResultBlock` probe order
 * (`v5EmbeddedEvidence.ts`).
 */
export function hasEvidenceBearingEnrichment(p: SelectorTracedPayload): boolean {
  const body = p.response?.body
  if (!isPlainObject(body)) return false
  // 1. Top-level (unwrapped) shape.
  if (blocksHaveEvidenceBearingAnalysisResult(body.blocks)) return true
  // 2. Parse-error wrapper: `body.raw.blocks[*]`.
  const raw = body.raw
  if (isPlainObject(raw)) {
    if (blocksHaveEvidenceBearingAnalysisResult(raw.blocks)) return true
  }
  return false
}

function isCompletedTwoXx(p: SelectorTracedPayload): boolean {
  return (
    p.completed === true &&
    typeof p.status === 'number' &&
    p.status >= 200 &&
    p.status < 300
  )
}

function emptyResult(
  reason: EvidenceSelectionReason,
  diagnostics: Partial<EvidenceSelectionDiagnostics> = {},
): EvidenceBearingSelectionResult {
  return {
    selected: undefined,
    selected_trace_id: null,
    selected_response_hash: null,
    selected_response_hash_source: null,
    hash_mismatch_observed: false,
    selection_diagnostics: {
      cee_candidate_count: diagnostics.cee_candidate_count ?? 0,
      v5_endpoint_candidate_count: diagnostics.v5_endpoint_candidate_count ?? 0,
      analysis_producing_candidate_count:
        diagnostics.analysis_producing_candidate_count ?? 0,
      evidence_bearing_candidate_count:
        diagnostics.evidence_bearing_candidate_count ?? 0,
      rejected_scenario_mismatch_count:
        diagnostics.rejected_scenario_mismatch_count ?? 0,
      used_missing_scenario_fallback:
        diagnostics.used_missing_scenario_fallback ?? false,
      selected_via_primary_path: false,
      selected_reason: reason,
      hash_match_status: 'no_candidate',
      scenario_status: 'no_candidate',
    },
  }
}

/**
 * Select the latest EVIDENCE-BEARING analysis-producing CEE turn
 * from a trace-store snapshot. See module-level JSDoc for why this
 * exists alongside `findLatestAnalysisProducingCeeTurn`.
 *
 * Filter chain (strict, all must pass):
 *   1. CEE service
 *   2. V5 turn endpoint (`/orchestrate/v2/turn` or `/proxy/v5/turn`)
 *   3. Analysis-producing action/turn type
 *      (`ANALYSIS_PRODUCING_ACTION_TYPES`)
 *   4. Response body carries an `analysis_result` block whose
 *      enrichment is evidence-bearing (indicative key OR sidecar)
 *
 * Scenario gate (when `currentScenarioId !== null`):
 *   - Reject candidates whose explicit `scenario_id` differs from
 *     `currentScenarioId` outright (counted in
 *     `rejected_scenario_mismatch_count`).
 *   - Prefer candidates that match `currentScenarioId`. Only if
 *     none match, fall back to candidates with no `scenario_id`
 *     and set `used_missing_scenario_fallback = true`.
 *
 * Scoring within the surviving set (same formula as
 * `findLatestAnalysisProducingCeeTurn` for trace-pinning parity):
 *   a) Captured response hash matches `resultsHash` (+1000)
 *   b) +50 constant (every survivor is analysis-producing AND
 *      evidence-bearing; preserved for parity with the existing
 *      selector's offset)
 *   c) Completed with 2xx status (+10)
 *   d) Recency (lower index = more recent = higher; index 0 → +9
 *      down to +0 at index 9)
 *
 * Scenario term is intentionally NOT in the score — it's a hard
 * filter above. Hash match is a SOFT preference: a missing hash on
 * either side NEVER discards a candidate.
 *
 * Returns `{ selected: undefined, ... }` with a documented
 * `selected_reason` when no candidate survives.
 */
export function findLatestEvidenceBearingCeeTurn(
  payloads: ReadonlyArray<SelectorTracedPayload>,
  currentScenarioId: string | null,
  resultsHash: string | null,
): EvidenceBearingSelectionResult {
  // (1) CEE-service entries.
  const ceeTurns = payloads.filter(isCeeService)
  if (ceeTurns.length === 0) {
    return emptyResult('no_cee_candidate')
  }

  // (2) V5 turn endpoint scoping.
  const v5Turns = ceeTurns.filter(isV5TurnEndpoint)
  if (v5Turns.length === 0) {
    return emptyResult('no_v5_endpoint_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: 0,
    })
  }

  // (3) Analysis-producing filter.
  const analysisProducing = v5Turns
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => {
      const t = readTurnOrActionType(p)
      return t !== null && ANALYSIS_PRODUCING_ACTION_TYPES.has(t)
    })
  if (analysisProducing.length === 0) {
    return emptyResult('no_analysis_producing_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: 0,
    })
  }

  // (4) Evidence-bearing filter — strictly stronger than
  //     analysis-producing.
  const evidenceBearing = analysisProducing.filter(({ p }) =>
    hasEvidenceBearingEnrichment(p),
  )
  if (evidenceBearing.length === 0) {
    return emptyResult('no_evidence_bearing_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: analysisProducing.length,
      evidence_bearing_candidate_count: 0,
    })
  }

  // (5) Scenario gate.
  let rejectedScenarioMismatchCount = 0
  let scenarioMatchedCandidates: Array<{ p: SelectorTracedPayload; idx: number }> = []
  let scenarioMissingCandidates: Array<{ p: SelectorTracedPayload; idx: number }> = []
  let usedMissingScenarioFallback = false
  let scenarioGateAppliedCandidates: Array<{ p: SelectorTracedPayload; idx: number }>

  if (currentScenarioId !== null) {
    for (const c of evidenceBearing) {
      const sid = readScenarioId(c.p)
      if (sid === currentScenarioId) {
        scenarioMatchedCandidates.push(c)
      } else if (sid === null) {
        scenarioMissingCandidates.push(c)
      } else {
        rejectedScenarioMismatchCount += 1
      }
    }
    if (scenarioMatchedCandidates.length > 0) {
      scenarioGateAppliedCandidates = scenarioMatchedCandidates
    } else if (scenarioMissingCandidates.length > 0) {
      usedMissingScenarioFallback = true
      scenarioGateAppliedCandidates = scenarioMissingCandidates
    } else {
      // Every evidence-bearing candidate was rejected by scenario
      // mismatch. Honest: no eligible evidence for this scenario.
      return emptyResult('no_evidence_bearing_candidate', {
        cee_candidate_count: ceeTurns.length,
        v5_endpoint_candidate_count: v5Turns.length,
        analysis_producing_candidate_count: analysisProducing.length,
        evidence_bearing_candidate_count: evidenceBearing.length,
        rejected_scenario_mismatch_count: rejectedScenarioMismatchCount,
      })
    }
  } else {
    // Scenario gate not applied — every evidence-bearing candidate
    // is in the running.
    scenarioGateAppliedCandidates = evidenceBearing
  }

  // Pre-compute hash readings.
  const candidateHashes = new Map<SelectorTracedPayload, ResponseHashReading | null>()
  for (const c of scenarioGateAppliedCandidates) {
    candidateHashes.set(c.p, readResponseHashWithSource(c.p))
  }

  // Scoring — same shape as `findLatestAnalysisProducingCeeTurn` so
  // that when both selectors yield a candidate which is also
  // evidence-bearing, they pick the same trace.
  const score = (p: SelectorTracedPayload, idx: number): number => {
    let s = 0
    const reading = candidateHashes.get(p) ?? null
    if (resultsHash !== null && reading && reading.hash === resultsHash) {
      s += 1000
    }
    s += 50 // analysis-producing + evidence-bearing offset (constant)
    if (isCompletedTwoXx(p)) s += 10
    s += Math.max(0, 9 - idx)
    return s
  }

  const ranked = [...scenarioGateAppliedCandidates].sort(
    (a, b) => score(b.p, b.idx) - score(a.p, a.idx),
  )
  const selected = ranked[0].p
  const selectedReading = candidateHashes.get(selected) ?? null
  const selectedScenarioId = readScenarioId(selected)

  // Dominant-signal labelling.
  let selectedReason: EvidenceSelectionReason
  if (
    resultsHash !== null &&
    selectedReading &&
    selectedReading.hash === resultsHash
  ) {
    selectedReason = 'hash_matched'
  } else if (
    currentScenarioId !== null &&
    selectedScenarioId === currentScenarioId
  ) {
    selectedReason = 'scenario_matched_recency'
  } else {
    selectedReason = 'evidence_bearing_recency'
  }

  // Hash-match status.
  let hashMatchStatus: HashMatchStatus
  if (resultsHash !== null && selectedReading !== null) {
    hashMatchStatus =
      selectedReading.hash === resultsHash ? 'matched' : 'mismatched'
  } else if (resultsHash !== null) {
    hashMatchStatus = 'only_results_hash_present'
  } else if (selectedReading !== null) {
    hashMatchStatus = 'only_capture_hash_present'
  } else {
    hashMatchStatus = 'both_absent'
  }

  // Scenario status for the selected candidate.
  let scenarioStatus: EvidenceScenarioStatus
  if (currentScenarioId === null) {
    scenarioStatus = 'scenario_unknown'
  } else if (selectedScenarioId === currentScenarioId) {
    scenarioStatus = 'scenario_matched'
  } else {
    // The scenario gate guarantees the selected candidate is either
    // scenario_matched or scenario_missing — explicit mismatches
    // were rejected above.
    scenarioStatus = 'scenario_missing_on_candidate'
  }

  return {
    selected,
    selected_trace_id: typeof selected.id === 'string' ? selected.id : null,
    selected_response_hash: selectedReading?.hash ?? null,
    selected_response_hash_source: selectedReading?.source ?? null,
    hash_mismatch_observed: hashMatchStatus === 'mismatched',
    selection_diagnostics: {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: analysisProducing.length,
      evidence_bearing_candidate_count: evidenceBearing.length,
      rejected_scenario_mismatch_count: rejectedScenarioMismatchCount,
      used_missing_scenario_fallback: usedMissingScenarioFallback,
      selected_via_primary_path: true,
      selected_reason: selectedReason,
      hash_match_status: hashMatchStatus,
      scenario_status: scenarioStatus,
    },
  }
}
