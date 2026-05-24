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
 * Trichotomy describing the relationship between the conversational
 * CEE trace (drives `bundle.payloads.cee_*`) and the analysis-
 * evidence trace (drives `evidence_resolution` and the body fed to
 * `resolveScientificEvidence`).
 *
 *   - `'selected_cee_turn'`           — both selectors picked the
 *                                       same trace. The recovered
 *                                       body lives in
 *                                       `payloads.cee_response` (no
 *                                       duplication on the bundle).
 *   - `'recovered_earlier_cee_turn'`  — selectors disagreed; an
 *                                       earlier CEE turn is used as
 *                                       the evidence trace. Its
 *                                       response body is surfaced
 *                                       under
 *                                       `analysis_evidence_trace.response_body`.
 *   - `'unavailable'`                 — no evidence-bearing CEE
 *                                       trace was found.
 *
 * Exported here so the hook (DebugData), bundle (DebugBundle), and
 * scientific-validation orchestrator (ValidatorInputs) all share a
 * single source of truth.
 */
export type AnalysisEvidenceTraceSource =
  | 'selected_cee_turn'
  | 'recovered_earlier_cee_turn'
  | 'unavailable'

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
 *   - `'scenario_conflict_overridden_by_hash'`
 *                                       — candidate's scenario_id
 *                                          explicitly differs from
 *                                          `currentScenarioId`, but the
 *                                          candidate was selected
 *                                          anyway because its captured
 *                                          `response_hash` matched
 *                                          `resultsHash` exactly. Per
 *                                          the workstream brief's
 *                                          preference order, hash
 *                                          match (a) trumps scenario
 *                                          rejection (b) — the trace
 *                                          IS the source of the
 *                                          rendered results, so
 *                                          ignoring it would discard
 *                                          the actual evidence. The
 *                                          scenario mismatch is
 *                                          surfaced as a diagnostic
 *                                          rather than a rejection.
 *   - `'scenario_missing_overridden_by_hash'`
 *                                       — candidate has NO scenario_id
 *                                          but its captured
 *                                          `response_hash` matched
 *                                          `resultsHash` exactly. The
 *                                          scenario-missing fallback
 *                                          would have deprioritised
 *                                          this candidate when a
 *                                          scenario-matched candidate
 *                                          (without hash match) existed
 *                                          — the hash override
 *                                          elevates it back so the
 *                                          actual source of the
 *                                          rendered results wins per
 *                                          brief preference (a).
 *                                          Distinct from
 *                                          `scenario_missing_on_candidate`
 *                                          (which means we fell back
 *                                          to missing-scenario because
 *                                          nothing else was eligible)
 *                                          and from
 *                                          `scenario_conflict_overridden_by_hash`
 *                                          (which means an explicit
 *                                          scenario mismatch was
 *                                          overridden).
 *   - `'no_candidate'`                 — no candidate was selected.
 */
export type EvidenceScenarioStatus =
  | 'scenario_matched'
  | 'scenario_missing_on_candidate'
  | 'scenario_unknown'
  | 'scenario_conflict_overridden_by_hash'
  | 'scenario_missing_overridden_by_hash'
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
 * Empty diagnostics shape — exported so the bundle assembler can use
 * it as a safe default when threading `data.analysis_evidence_selection_diagnostics`
 * is undefined (legacy callers). Lives next to the type so the two
 * cannot drift if fields are added.
 *
 * Frozen so callers can't accidentally mutate the shared default.
 */
export const EMPTY_EVIDENCE_SELECTION_DIAGNOSTICS: EvidenceSelectionDiagnostics =
  Object.freeze({
    cee_candidate_count: 0,
    v5_endpoint_candidate_count: 0,
    analysis_producing_candidate_count: 0,
    evidence_bearing_candidate_count: 0,
    rejected_scenario_mismatch_count: 0,
    used_missing_scenario_fallback: false,
    selected_via_primary_path: false,
    selected_reason: 'no_cee_candidate',
    hash_match_status: 'no_candidate',
    scenario_status: 'no_candidate',
  })

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
/** True iff the object carries any indicative scientific key. */
function hasIndicativeKey(o: Record<string, unknown>): boolean {
  for (const k of RAW_PAYLOAD_INDICATIVE_KEYS) {
    if (o[k] !== undefined && o[k] !== null) return true
  }
  return false
}

function enrichmentIsEvidenceBearing(
  enrichment: Record<string, unknown>,
): boolean {
  if (hasIndicativeKey(enrichment)) return true
  const meta = enrichment._meta
  if (isPlainObject(meta)) {
    const payloads = (meta as Record<string, unknown>).payloads
    if (isPlainObject(payloads)) {
      const p = payloads as Record<string, unknown>
      // plot_response sidecar: MUST carry indicative keys — mirrors
      // the resolver's `probeMetaPayloadsKind` gate
      // (v5EmbeddedEvidence.ts:317). Without this gate, a sidecar
      // shaped like `{ x: 1 }` would let the selector accept a trace
      // the resolver cannot lift anything from, producing the
      // misleading bundle `analysis_evidence_trace.source =
      // recovered_earlier_cee_turn` + `evidence_resolution.*.source
      // = unavailable`.
      if (isNonEmptyObject(p.plot_response) && hasIndicativeKey(p.plot_response)) {
        return true
      }
      // plot_request / isl_request / isl_response sidecars: the
      // resolver requires only a non-empty plain object (no
      // indicative-key gate), so the selector matches.
      if (isNonEmptyObject(p.plot_request)) return true
      if (isNonEmptyObject(p.isl_request)) return true
      if (isNonEmptyObject(p.isl_response)) return true
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
 * Find the FIRST `analysis_result` block in a `blocks[]` array,
 * regardless of whether its enrichment is usable. Mirrors the
 * resolver's `findInBlocks` semantics exactly. Returns null when
 * the array is missing/non-array or no analysis_result block exists.
 *
 * Honesty contract: the resolver's `findAnalysisResultBlock` returns
 * the FIRST analysis_result block from `body.blocks` and only falls
 * back to `body.raw.blocks` when `body.blocks` had NO analysis_result
 * at all. The selector must use the same probe order so that
 * "selector says evidence-bearing" implies "resolver will resolve
 * evidence." Iterating ALL blocks (and accepting later evidence-
 * bearing blocks when earlier ones lack enrichment) would let the
 * selector accept a trace the resolver then reports as unavailable —
 * misleading: the bundle would record
 * `analysis_evidence_trace.source = 'recovered_earlier_cee_turn'`
 * while `scientific_validation.source = 'unavailable'`. We don't want
 * that.
 */
function findFirstAnalysisResultBlock(
  blocks: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(blocks)) return null
  for (const b of blocks) {
    if (!isPlainObject(b)) continue
    if (b.type === 'analysis_result') return b
  }
  return null
}

/**
 * Helper: read a found `analysis_result` block's `enrichment` field
 * and return true iff it's a plain object with evidence-bearing
 * signals. Factored out so `hasEvidenceBearingEnrichment`'s top-level
 * and wrapper branches stay DRY.
 */
function blockEnrichmentIsEvidenceBearing(
  block: Record<string, unknown>,
): boolean {
  const enrichment = block.enrichment
  return (
    isPlainObject(enrichment) &&
    enrichmentIsEvidenceBearing(enrichment as Record<string, unknown>)
  )
}

/**
 * True iff the trace's response body carries an `analysis_result`
 * block whose enrichment is evidence-bearing, USING THE SAME PROBE
 * ORDER as the resolver's `findAnalysisResultBlock`:
 *
 *   1. The FIRST analysis_result block in `body.blocks` (if any).
 *      If its enrichment is missing or non-evidence-bearing → false.
 *      We do NOT iterate to later analysis_result blocks; the
 *      resolver only inspects the first.
 *   2. Only when `body.blocks` had NO analysis_result block at all,
 *      fall back to the FIRST analysis_result block in
 *      `body.raw.blocks` (parse-error wrapper).
 *
 * This mirrors the resolver exactly so selector and resolver agree
 * on what counts as evidence-bearing. See `findFirstAnalysisResultBlock`
 * JSDoc above for the rationale.
 *
 * Per-kind gating in `enrichmentIsEvidenceBearing` matches the
 * resolver's `probeMetaPayloadsKind`: `plot_response` (both bare
 * enrichment and `_meta.payloads.plot_response` sidecar) requires
 * indicative scientific keys; `plot_request`, `isl_request`,
 * `isl_response` sidecars and `downstream_calls.isl.response` just
 * need a non-empty plain object. This guarantees "selector accepts
 * ⇒ resolver lifts at least one kind", so the bundle never reports
 * `analysis_evidence_trace.source = recovered_earlier_cee_turn`
 * paired with `evidence_resolution.*.source = unavailable`.
 */
export function hasEvidenceBearingEnrichment(p: SelectorTracedPayload): boolean {
  const body = p.response?.body
  if (!isPlainObject(body)) return false
  // 1. Top-level (unwrapped) shape — first analysis_result wins,
  //    regardless of enrichment quality. If found here, we DO NOT
  //    fall through to `raw.blocks` even if this block's enrichment
  //    is non-evidence-bearing — the resolver wouldn't either.
  const top = findFirstAnalysisResultBlock(body.blocks)
  if (top !== null) return blockEnrichmentIsEvidenceBearing(top)
  // 2. Parse-error wrapper — `body.raw.blocks[*]`. Only reached when
  //    `body.blocks` had NO analysis_result block at all.
  const raw = body.raw
  if (isPlainObject(raw)) {
    const wrapped = findFirstAnalysisResultBlock(raw.blocks)
    if (wrapped !== null) return blockEnrichmentIsEvidenceBearing(wrapped)
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
 *   - Hash match is checked FIRST per the brief's preference order.
 *     A candidate whose captured `response_hash` matches `resultsHash`
 *     bypasses scenario rejection AND scenario-missing fallback
 *     deprioritisation regardless of whether its scenario_id is
 *     matched, mismatched, or missing — the trace IS the source of
 *     the rendered results, so any other resolution would discard
 *     the actual evidence.
 *   - `scenario_status` on the selected candidate distinguishes:
 *       * `'scenario_matched'`                       — sid === currentScenarioId
 *       * `'scenario_missing_overridden_by_hash'`    — sid absent + hash match overrode fallback
 *       * `'scenario_conflict_overridden_by_hash'`   — sid !== currentScenarioId + hash match overrode rejection
 *       * `'scenario_missing_on_candidate'`          — sid absent + fallback (no hash match)
 *   - Reject candidates whose explicit `scenario_id` differs from
 *     `currentScenarioId` outright (counted in
 *     `rejected_scenario_mismatch_count`) when they DON'T hash-match.
 *   - Prefer candidates from hashMatched ∪ scenarioMatched buckets
 *     (the scoring +1000 hash bonus makes hash-matched candidates
 *     outrank scenario-matched non-hash-matched ones per brief
 *     preference). Only if neither bucket is non-empty, fall back
 *     to scenarioMissing and set `used_missing_scenario_fallback = true`.
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
 * filter above (with hash-match override). Hash match is a SOFT
 * preference in scoring: a missing hash on either side NEVER
 * discards a candidate.
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

  // (5) Pre-compute hash readings for ALL evidence-bearing candidates.
  //     Hash evidence is the strongest selection signal per the brief's
  //     preference order: (a) hash match, (b) scenario match, (c)
  //     evidence-bearing recency. So we read hashes BEFORE the scenario
  //     gate so we can exempt hash-matched candidates from explicit
  //     scenario rejection (their hash equals `resultsHash` — the trace
  //     IS the source of the currently-rendered results; rejecting it
  //     because of a stale `scenario_id` would discard the actual
  //     evidence).
  const candidateHashes = new Map<SelectorTracedPayload, ResponseHashReading | null>()
  for (const c of evidenceBearing) {
    candidateHashes.set(c.p, readResponseHashWithSource(c.p))
  }
  const isExactHashMatch = (p: SelectorTracedPayload): boolean => {
    if (resultsHash === null) return false
    const reading = candidateHashes.get(p) ?? null
    return reading !== null && reading.hash === resultsHash
  }

  // (6) Scenario gate. Hash match is checked FIRST per the brief's
  //     preference order — a hash-matched candidate is the actual
  //     source of the rendered results, so it bypasses scenario
  //     rejection AND scenario-missing fallback deprioritisation
  //     regardless of whether its scenario_id is matched, mismatched,
  //     or missing. The override is surfaced via
  //     `scenario_status` on the selected candidate:
  //       - matched      → 'scenario_matched' (no override needed)
  //       - mismatched   → 'scenario_conflict_overridden_by_hash'
  //       - missing      → 'scenario_missing_overridden_by_hash'
  //     A non-hash-matched candidate with explicit scenario mismatch
  //     is still rejected outright; missing-scenario candidates remain
  //     a fallback when no scenario-matched candidate exists.
  let rejectedScenarioMismatchCount = 0
  let scenarioMatchedCandidates: Array<{ p: SelectorTracedPayload; idx: number }> = []
  let scenarioMissingCandidates: Array<{ p: SelectorTracedPayload; idx: number }> = []
  let hashMatchOverrideCandidates: Array<{ p: SelectorTracedPayload; idx: number }> = []
  let usedMissingScenarioFallback = false
  let scenarioGateAppliedCandidates: Array<{ p: SelectorTracedPayload; idx: number }>

  if (currentScenarioId !== null) {
    for (const c of evidenceBearing) {
      // Hash match FIRST — regardless of scenario. The bucket
      // captures every hash-matched candidate so the scoring pool
      // is guaranteed to consider them, and the `scenario_status`
      // for the winner correctly reflects whether the override
      // resolved a mismatch or a missing scenario.
      if (isExactHashMatch(c.p)) {
        hashMatchOverrideCandidates.push(c)
        continue
      }
      const sid = readScenarioId(c.p)
      if (sid === currentScenarioId) {
        scenarioMatchedCandidates.push(c)
      } else if (sid === null) {
        scenarioMissingCandidates.push(c)
      } else {
        // Explicit scenario mismatch, no hash match — reject.
        rejectedScenarioMismatchCount += 1
      }
    }
    // Scoring pool precedence:
    //   - hashMatched ∪ scenarioMatched (combined; the scoring +1000
    //     hash bonus ensures hash-matched candidates outrank
    //     scenario-matched non-hash-matched candidates, mirroring
    //     the brief's preference order a > b);
    //   - else scenarioMissing (fallback — only when no eligible
    //     candidate above);
    //   - else no candidate.
    if (
      hashMatchOverrideCandidates.length > 0 ||
      scenarioMatchedCandidates.length > 0
    ) {
      scenarioGateAppliedCandidates = [
        ...hashMatchOverrideCandidates,
        ...scenarioMatchedCandidates,
      ]
    } else if (scenarioMissingCandidates.length > 0) {
      usedMissingScenarioFallback = true
      scenarioGateAppliedCandidates = scenarioMissingCandidates
    } else {
      // Every evidence-bearing candidate was rejected by explicit
      // scenario mismatch AND none had a hash match. Honest: no
      // eligible evidence for this scenario.
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

  // Scenario status for the selected candidate. The gate places the
  // candidate into one of three buckets — hashMatched, scenarioMatched,
  // or scenarioMissing (fallback) — so the status decision combines
  // the candidate's scenario relationship with WHICH bucket selected it:
  //
  //   currentScenarioId === null
  //                                  → 'scenario_unknown'
  //   selected from hashMatched bucket:
  //     sid === currentScenarioId    → 'scenario_matched'
  //     sid === null                 → 'scenario_missing_overridden_by_hash'
  //     sid !== currentScenarioId    → 'scenario_conflict_overridden_by_hash'
  //   selected from scenarioMatched bucket:
  //                                  → 'scenario_matched'
  //   selected from scenarioMissing bucket (fallback):
  //                                  → 'scenario_missing_on_candidate'
  //
  // The override codes fire only when hash match was the entry path —
  // a candidate that's both scenario-matched AND hash-matched lands
  // in the hashMatched bucket and reports 'scenario_matched' (no
  // override needed because the scenario was actually matched).
  let scenarioStatus: EvidenceScenarioStatus
  if (currentScenarioId === null) {
    scenarioStatus = 'scenario_unknown'
  } else {
    const selectedIsHashMatch = isExactHashMatch(selected)
    if (selectedScenarioId === currentScenarioId) {
      scenarioStatus = 'scenario_matched'
    } else if (selectedScenarioId === null) {
      // Missing scenario. Distinguish hash-override path from
      // genuine fallback path so reviewers see when hash recovered
      // the actual evidence trace from a missing-scenario candidate.
      scenarioStatus = selectedIsHashMatch
        ? 'scenario_missing_overridden_by_hash'
        : 'scenario_missing_on_candidate'
    } else {
      // Explicit scenario mismatch survived because of hash match.
      // Guaranteed by the gate: explicit mismatches without hash
      // match were rejected.
      scenarioStatus = 'scenario_conflict_overridden_by_hash'
    }
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
