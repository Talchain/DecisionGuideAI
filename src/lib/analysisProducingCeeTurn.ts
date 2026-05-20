/**
 * Analysis-producing CEE turn selector.
 *
 * The debug bundle exports `bundle.payloads.cee_request` /
 * `bundle.payloads.cee_response` to surface the V5 turn that actually
 * produced the currently-rendered results. The previous selector
 * (`findBestPayload` in `useDebugData.ts`) only picked
 * "most-recent-completed non-system-event", which after multi-turn
 * sessions can pick a prompt warm, a graph_edit, or any non-analysis
 * CEE call — not the analysis turn the reviewer wanted to validate.
 *
 * This module is a pure utility — no React, no Zustand. Callers pass
 * a `TracedPayload`-shaped array plus the canvas store's current
 * scenario id and `results.hash`, and receive the selected entry,
 * a `hash_mismatch_observed` boolean, and a `selection_diagnostics`
 * block that records why this candidate was chosen.
 *
 * Selection contract:
 *   - Only V5 turn-endpoint candidates (matching `/orchestrate/v2/turn`)
 *     are considered analysis-producing — non-V5 CEE endpoints
 *     (legacy `/bff/cee/turn`, `/bff/cee/draft-graph`, prompt-warm)
 *     cannot outrank a real V5 analysis turn even if they carry an
 *     analysis-shaped action_type.
 *   - Only analysis-producing CEE turns are candidates (the caller
 *     falls back to `findBestPayload` when this returns `undefined`,
 *     so non-analysis V5 / V1 turns still surface honestly).
 *   - Soft hash matching: a match against `results.hash` is a strong
 *     preference but a missing hash on either side NEVER disqualifies
 *     a candidate.
 *   - Mismatch reporting: when both hashes are present and disagree,
 *     `hash_mismatch_observed: true` is returned AND the offending
 *     hashes (selected + results) and the trace id are emitted so
 *     reviewers can see WHICH hash disagreed — instead of "boolean
 *     mismatch with no evidence."
 *   - When no V5-endpoint candidate exists, the result records that
 *     fact in `selection_diagnostics.fallback_reason` so reviewers
 *     can spot a legacy-only trace.
 */

/**
 * Structural shape of a payload-trace entry used by the selector.
 * Kept loose so the selector can be tested without importing the
 * full Zustand store and so the contract is explicit at the call
 * site.
 */
export interface SelectorTracedPayload {
  /** Trace store id. */
  id?: string
  /** Service classification. Matched case-insensitively for safety. */
  service?: string
  /** HTTP endpoint path. */
  endpoint?: string
  /** HTTP status (set after response). */
  status?: number
  /** Whether the request completed. */
  completed?: boolean
  /** Turn type at the orchestrator boundary. */
  turnType?: string
  request?: {
    headers?: Record<string, string>
    body?: unknown
  }
  response?: {
    headers?: Record<string, string>
    body?: unknown
  }
}

/**
 * Turn types that produce analysis state. Drawn from
 * `ACTION_TO_TURN_TYPE` in `useConversation.ts` and the
 * `chip.action_type` discriminator on V5 requests.
 */
export const ANALYSIS_PRODUCING_ACTION_TYPES: ReadonlySet<string> = new Set([
  'run_analysis',
  'what_would_flip',
  'explain',
])

/**
 * V5 turn endpoint pattern. Matches both the Netlify proxy
 * (`/bff/orchestrate/v2/turn`) and the direct endpoint
 * (`${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn`). Aligned with the
 * existing scoping in `v5CapturePipelineStatus.ts:isV5CeeRecord`.
 *
 * Endpoint scoping is essential to prevent a legacy CEE trace
 * (e.g. `/bff/cee/draft-graph`) with analysis-shaped action metadata
 * from outranking a real V5 analysis turn.
 */
export const V5_TURN_ENDPOINT_PATTERN = '/orchestrate/v2/turn'

/**
 * Where `readResponseHash` found the hash. Used by the bundle to
 * emit a `hash_source` diagnostic alongside the mismatch, so
 * reviewers can identify which canonical CEE shape was observed.
 *
 * Round-3 review (P0): `body_lineage_context_hash` was REMOVED from
 * this enum. `lineage.context_hash` is the canonical INPUT context
 * fingerprint, not the response hash — it changes whenever the input
 * graph changes regardless of response identity. Comparing it
 * against `results.hash` (which is the response-side identity from
 * `mapV5AnalysisToReport`) produces false positives AND false
 * negatives. Only true response-hash fields are surfaced. When no
 * real response_hash is present, hash evidence is reported as
 * unavailable rather than spuriously matched/mismatched on
 * context_hash.
 */
export type ResponseHashSource =
  | 'body_root_response_hash'
  | 'body_meta_response_hash'
  | 'body_analysis_state_meta_response_hash'
  | 'body_lineage_response_hash'
  | 'body_blocks_analysis_result_response_hash'
  | 'header_x_olumi_response_hash'

export interface ResponseHashReading {
  readonly hash: string
  readonly source: ResponseHashSource
}

/**
 * Diagnostic surface emitted alongside the selected candidate.
 * Records ranking inputs and fallback path WITHOUT exposing raw
 * payload content. Reviewers can answer "why this turn?" from the
 * bundle without re-running the selector.
 */
export interface SelectionDiagnostics {
  /** Total CEE-service entries seen (any endpoint). */
  readonly cee_candidate_count: number
  /** CEE entries with V5 turn-endpoint scoping applied. */
  readonly v5_endpoint_candidate_count: number
  /** Of the V5-endpoint candidates, how many were analysis-producing. */
  readonly analysis_producing_candidate_count: number
  /** Whether the selector's primary path returned a candidate. */
  readonly selected_via_primary_path: boolean
  /**
   * Human-readable code recording the dominant ranking signal for the
   * selected candidate, or the reason no candidate was selected.
   */
  readonly selected_reason:
    | 'hash_matched'
    | 'scenario_matched_recency'
    | 'analysis_producing_recency'
    | 'no_v5_endpoint_candidate'
    | 'no_analysis_producing_candidate'
    | 'no_cee_candidate'
  /** Hash-evidence summary for the selected candidate (or null path). */
  readonly hash_match_status:
    | 'matched'
    | 'mismatched'
    | 'only_results_hash_present'
    | 'only_capture_hash_present'
    | 'both_absent'
    | 'no_candidate'
}

export interface AnalysisProducingSelectionResult {
  /** Selected trace entry, or undefined when nothing matched. */
  selected: SelectorTracedPayload | undefined
  /**
   * True ONLY when both `canvas store.results.hash` and the captured
   * response_hash are present AND disagree. Missing hash on either
   * side → false (not a mismatch — just no evidence to compare). Fires
   * the `capture_response_hash_mismatch_with_results` coherence
   * issue downstream.
   */
  hash_mismatch_observed: boolean
  /**
   * The captured response_hash for the selected entry (when readable).
   * Surfaced so the bundle records WHICH hash disagreed with
   * results.hash — boolean-only reporting hides the actual evidence.
   */
  selected_response_hash: string | null
  /** Where in the response body the hash was read from (when readable). */
  selected_response_hash_source: ResponseHashSource | null
  /** Selected trace entry's `id` (trace-store identifier), when present. */
  selected_trace_id: string | null
  /** Ranking + fallback diagnostics — see `SelectionDiagnostics`. */
  selection_diagnostics: SelectionDiagnostics
}

/**
 * Case-insensitive CEE service filter. Trace recorders should set
 * `service: 'CEE'` but historical entries / future renaming may use
 * `'cee'` or mixed case — match defensively.
 *
 * EXPORTED as the single source of truth (round-3 review P1):
 * `findLatestV5TurnEntry` and `detectFailedHttpRecord` in
 * `v5CapturePipelineStatus.ts` used a strict `=== 'CEE'` check which
 * disagreed with the selector. Re-use this helper from every V5 trace
 * detection point so the matching cannot drift again.
 */
export function isCeeService(p: {
  service?: string
}): boolean {
  return (
    typeof p.service === 'string' && p.service.toUpperCase() === 'CEE'
  )
}

/**
 * V5 turn endpoint scope. CEE service + endpoint contains
 * `/orchestrate/v2/turn` (matches both the `/bff/orchestrate/v2/turn`
 * proxy and the direct `https://.../orchestrate/v2/turn` endpoints).
 * Treats missing endpoint as NON-V5 — defensive, prefers honesty to
 * optimism.
 *
 * EXPORTED as the single source of truth (round-3 review P1).
 */
export function isV5TurnEndpoint(p: {
  service?: string
  endpoint?: string
}): boolean {
  if (!isCeeService(p)) return false
  return typeof p.endpoint === 'string' &&
    p.endpoint.includes(V5_TURN_ENDPOINT_PATTERN)
}

/**
 * Defensive turn / action type read. Looks at every documented
 * location where the discriminator might live:
 *   - `p.turnType` (recorder-set field)
 *   - `request.body.turnType`
 *   - `request.body.turn_type` (snake_case)
 *   - `request.body._turn_type` — request-builder internal
 *     discriminator (`OrchestratorTurnRequest._turn_type`). Stripped
 *     before network send but trace recorders that capture pre-strip
 *     will only have this signal. Round-3 review (P1) — silently
 *     missed analysis-producing turns when the body had been
 *     captured before stripping.
 *   - `request.body.action_type`
 *   - `request.body.chip.action_type` (V5 chip-initiated turns)
 * Returns the first non-empty string found, or null.
 */
export function readTurnOrActionType(
  p: SelectorTracedPayload,
): string | null {
  if (typeof p.turnType === 'string' && p.turnType.length > 0) {
    return p.turnType
  }
  const body = p.request?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const rec = body as Record<string, unknown>
  const candidates: Array<unknown> = [
    rec.turnType,
    rec.turn_type,
    // _turn_type — request-builder internal discriminator stripped
    // before send; trace stores that capture pre-strip will surface
    // it here. Round-3 review (P1).
    rec._turn_type,
    rec.action_type,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  const chip = rec.chip
  if (chip && typeof chip === 'object' && !Array.isArray(chip)) {
    const chipActionType = (chip as Record<string, unknown>).action_type
    if (typeof chipActionType === 'string' && chipActionType.length > 0) {
      return chipActionType
    }
  }
  return null
}

/**
 * Defensive response-hash read. Returns the FIRST non-empty hash
 * found AND the source code identifying WHERE it was read from.
 *
 * Round-3 review (P0): `lineage.context_hash` is DELIBERATELY NOT
 * read here. `context_hash` is the input-context fingerprint
 * (changes when the input graph changes); `results.hash` is the
 * response-side identity from `mapV5AnalysisToReport.response_hash`.
 * The two operate on different inputs and CAN agree by accident or
 * disagree without indicating a real mismatch. Reading context_hash
 * as a "response hash" produces false positives + false negatives;
 * the bundle now reports hash evidence as unavailable when no real
 * response_hash is present.
 *
 * Priority (most-specific first):
 *   1. `response.body.lineage.response_hash` — canonical response
 *      hash on the lineage block (forward-compat key).
 *   2. `response.body.analysis_state.meta.response_hash` —
 *      analysis-state-scoped hash on V5 analysis turns.
 *   3. `response.body.meta.response_hash` — root meta.
 *   4. `response.body.response_hash` — root.
 *   5. `response.body.blocks[].response_hash` on an `analysis_result`
 *      block (PR #147 sidecar shape).
 *   6. `response.headers['x-olumi-response-hash']` — header echo,
 *      case-insensitive.
 *
 * Returns null when no real response_hash anywhere.
 */
export function readResponseHashWithSource(
  p: SelectorTracedPayload,
): ResponseHashReading | null {
  const body = p.response?.body
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const root = body as Record<string, unknown>

    // (1): lineage.response_hash. `lineage.context_hash` is DELIBERATELY
    // NOT read here — it's the input fingerprint, not the response
    // identity. See JSDoc above (round-3 P0).
    const lineage = root.lineage
    if (lineage && typeof lineage === 'object' && !Array.isArray(lineage)) {
      const lin = lineage as Record<string, unknown>
      const respHash = lin.response_hash
      if (typeof respHash === 'string' && respHash.length > 0) {
        return { hash: respHash, source: 'body_lineage_response_hash' }
      }
    }

    // (2): analysis_state.meta.response_hash.
    const analysisState = root.analysis_state
    if (
      analysisState &&
      typeof analysisState === 'object' &&
      !Array.isArray(analysisState)
    ) {
      const meta = (analysisState as Record<string, unknown>).meta
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        const asMetaHash = (meta as Record<string, unknown>).response_hash
        if (typeof asMetaHash === 'string' && asMetaHash.length > 0) {
          return {
            hash: asMetaHash,
            source: 'body_analysis_state_meta_response_hash',
          }
        }
      }
    }

    // (3): meta.response_hash.
    const meta = root.meta
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const metaHash = (meta as Record<string, unknown>).response_hash
      if (typeof metaHash === 'string' && metaHash.length > 0) {
        return { hash: metaHash, source: 'body_meta_response_hash' }
      }
    }

    // (4): root.response_hash.
    if (
      typeof root.response_hash === 'string' &&
      root.response_hash.length > 0
    ) {
      return { hash: root.response_hash, source: 'body_root_response_hash' }
    }

    // (5): blocks[].response_hash on analysis_result.
    const blocks = root.blocks
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        if (!b || typeof b !== 'object' || Array.isArray(b)) continue
        const bb = b as Record<string, unknown>
        if (bb.type === 'analysis_result') {
          const blockHash = bb.response_hash
          if (typeof blockHash === 'string' && blockHash.length > 0) {
            return {
              hash: blockHash,
              source: 'body_blocks_analysis_result_response_hash',
            }
          }
        }
      }
    }
  }

  // (6): header fallback (case-insensitive).
  const headers = p.response?.headers
  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase() === 'x-olumi-response-hash' &&
        typeof value === 'string' &&
        value.length > 0
      ) {
        return { hash: value, source: 'header_x_olumi_response_hash' }
      }
    }
  }
  return null
}

/**
 * Back-compat wrapper for callers that only need the hash string.
 * Prefer `readResponseHashWithSource` when the source is useful.
 */
export function readResponseHash(p: SelectorTracedPayload): string | null {
  return readResponseHashWithSource(p)?.hash ?? null
}

/**
 * Read scenario_id from a trace entry's request body. V5 turns carry
 * scenario_id at the root of the orchestrator payload. Snake_case
 * only — that's the wire shape (`buildPayload.ts`).
 */
export function readScenarioId(p: SelectorTracedPayload): string | null {
  const body = p.request?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const sid = (body as Record<string, unknown>).scenario_id
  return typeof sid === 'string' && sid.length > 0 ? sid : null
}

function isAnalysisProducing(p: SelectorTracedPayload): boolean {
  const t = readTurnOrActionType(p)
  return t !== null && ANALYSIS_PRODUCING_ACTION_TYPES.has(t)
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
  reason: SelectionDiagnostics['selected_reason'],
  diagnostics: Partial<SelectionDiagnostics> = {},
): AnalysisProducingSelectionResult {
  return {
    selected: undefined,
    hash_mismatch_observed: false,
    selected_response_hash: null,
    selected_response_hash_source: null,
    selected_trace_id: null,
    selection_diagnostics: {
      cee_candidate_count: diagnostics.cee_candidate_count ?? 0,
      v5_endpoint_candidate_count: diagnostics.v5_endpoint_candidate_count ?? 0,
      analysis_producing_candidate_count:
        diagnostics.analysis_producing_candidate_count ?? 0,
      selected_via_primary_path: false,
      selected_reason: reason,
      hash_match_status: 'no_candidate',
    },
  }
}

/**
 * Select the latest analysis-producing CEE turn from a trace-store
 * snapshot, ranked by:
 *
 *   a) Captured response hash matches `resultsHash` (+1000)
 *   b) `scenario_id` matches `currentScenarioId` (+100)
 *   c) Analysis-producing turn type (+50)
 *      — always true for any candidate that survives the filter
 *      below, so this contributes a constant offset that distinguishes
 *      analysis-producing candidates from any future relaxations.
 *   d) Completed with 2xx status (+10)
 *   e) Recency (lower index = more recent = higher; index 0 → +9 down
 *      to +0 at index 9)
 *
 * Hash matching is a SOFT preference: a missing hash on either side
 * NEVER discards a candidate. Only the (b)→(e) signals decide
 * selection when hash evidence isn't available on both sides.
 *
 * Endpoint scoping: only CEE traces whose endpoint matches
 * `V5_TURN_ENDPOINT_PATTERN` are eligible. Legacy `/bff/cee/turn` /
 * `/bff/cee/draft-graph` / prompt-warm entries are excluded even if
 * their request body carries `chip.action_type: 'run_analysis'` —
 * those are by-definition non-V5 turns and must not impersonate one.
 *
 * Returns `{ selected: undefined, ... }` with a documented
 * `selected_reason` in `selection_diagnostics` when no V5-endpoint
 * analysis-producing candidate exists — the caller (useDebugData)
 * then falls back to `findBestPayload` so non-analysis V5 / V1 turns
 * still surface honestly.
 */
export function findLatestAnalysisProducingCeeTurn(
  payloads: ReadonlyArray<SelectorTracedPayload>,
  currentScenarioId: string | null,
  resultsHash: string | null,
): AnalysisProducingSelectionResult {
  // (1) CEE-service entries (any endpoint).
  const ceeTurns = payloads.filter(isCeeService)
  if (ceeTurns.length === 0) {
    return emptyResult('no_cee_candidate')
  }

  // (2) Endpoint-scoped V5 turn entries. Anything else is by
  //     definition NOT a V5 analysis turn and must not be selected.
  const v5Turns = ceeTurns.filter(isV5TurnEndpoint)
  if (v5Turns.length === 0) {
    return emptyResult('no_v5_endpoint_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: 0,
      analysis_producing_candidate_count: 0,
    })
  }

  // (3) Analysis-producing filter. If none qualify, fall through to
  //     the caller's fallback.
  const candidates = v5Turns
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => isAnalysisProducing(p))
  if (candidates.length === 0) {
    return emptyResult('no_analysis_producing_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: 0,
    })
  }

  // Pre-compute hash readings — used both by scoring and the result
  // diagnostic. Single read per candidate keeps the scoring
  // deterministic.
  const candidateHashes = new Map<SelectorTracedPayload, ResponseHashReading | null>()
  for (const c of candidates) {
    candidateHashes.set(c.p, readResponseHashWithSource(c.p))
  }

  // Score and dominant-signal labelling.
  let dominantSignal: 'hash_matched' | 'scenario_matched_recency' | 'analysis_producing_recency'
  const score = (p: SelectorTracedPayload, idx: number): number => {
    let s = 0
    const reading = candidateHashes.get(p) ?? null
    if (resultsHash !== null && reading && reading.hash === resultsHash) {
      s += 1000
    }
    if (
      currentScenarioId !== null &&
      readScenarioId(p) === currentScenarioId
    ) {
      s += 100
    }
    s += 50 // analysis-producing offset, constant for the filtered set
    if (isCompletedTwoXx(p)) s += 10
    s += Math.max(0, 9 - idx)
    return s
  }

  candidates.sort((a, b) => score(b.p, b.idx) - score(a.p, a.idx))
  const selected = candidates[0].p
  const selectedReading = candidateHashes.get(selected) ?? null

  // Establish dominant signal for the selected candidate.
  if (
    resultsHash !== null &&
    selectedReading &&
    selectedReading.hash === resultsHash
  ) {
    dominantSignal = 'hash_matched'
  } else if (
    currentScenarioId !== null &&
    readScenarioId(selected) === currentScenarioId
  ) {
    dominantSignal = 'scenario_matched_recency'
  } else {
    dominantSignal = 'analysis_producing_recency'
  }

  // Hash-match status — exposed as a separate field so the bundle
  // doesn't have to re-derive it from the boolean.
  let hash_match_status: SelectionDiagnostics['hash_match_status']
  if (resultsHash !== null && selectedReading !== null) {
    hash_match_status =
      selectedReading.hash === resultsHash ? 'matched' : 'mismatched'
  } else if (resultsHash !== null) {
    hash_match_status = 'only_results_hash_present'
  } else if (selectedReading !== null) {
    hash_match_status = 'only_capture_hash_present'
  } else {
    hash_match_status = 'both_absent'
  }

  const hash_mismatch_observed = hash_match_status === 'mismatched'

  return {
    selected,
    hash_mismatch_observed,
    selected_response_hash: selectedReading?.hash ?? null,
    selected_response_hash_source: selectedReading?.source ?? null,
    selected_trace_id: typeof selected.id === 'string' ? selected.id : null,
    selection_diagnostics: {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: candidates.length,
      selected_via_primary_path: true,
      selected_reason: dominantSignal,
      hash_match_status,
    },
  }
}
