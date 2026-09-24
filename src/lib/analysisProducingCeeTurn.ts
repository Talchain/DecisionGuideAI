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
 *   - IDENTITY OUTRANKS EVERYTHING (24 Sep): the turn whose response
 *     delivered the DISPLAYED analysis — its first `analysis_result`
 *     block hashes to `results.hash` under the store's own derivation —
 *     is selected regardless of request type. See
 *     `locateDisplayedAnalysisTurn`.
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
import type { TraceCapture } from './payload-trace-store'
import { v5AnalysisBlockContentHash } from '../v5/mapV5AnalysisToReport'

export interface SelectorTracedPayload {
  capture?: TraceCapture
  timestamp?: number
  completedAt?: number
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
 *
 * V5 traces carry no turnType — the selector falls back to
 * `chip.action_type` — so this set must name the CHIP vocabulary too, not
 * just the mapped turn type: V-P0-2 unhid the explain chips, whose wire
 * form is `explain_results` (plural; singular is the schema's legacy
 * alias). Without these entries the debug bundle pins an OLDER
 * run_analysis/what_would_flip turn as "latest" after an explain click —
 * the same vocabulary-drift class V-P0-2 fixed, on the diagnostic surface.
 */
export const ANALYSIS_PRODUCING_ACTION_TYPES: ReadonlySet<string> = new Set([
  'run_analysis',
  'what_would_flip',
  'explain',
  'explain_results',
  'explain_result',
])

// Round-4 review (IMP): `V5_TURN_ENDPOINT_PATTERN` moved to the
// dedicated `v5TraceMatching` module. Re-exported here for back-compat
// with round-2/round-3 callers.
export { V5_TURN_ENDPOINT_PATTERN } from './v5TraceMatching'

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
  /**
   * The first `analysis_result` block in the V5 turn's response, hashed
   * with the SAME derivation the store uses for `results.hash`
   * (`v5AnalysisBlockContentHash`). Reported only when that content
   * hash equals the displayed `results.hash` — i.e. when the trace is
   * bound to the analysis the panels render by identity.
   */
  | 'body_blocks_analysis_result_content_hash'
  | 'body_root_response_hash'
  | 'body_meta_response_hash'
  | 'body_analysis_state_meta_response_hash'
  | 'body_lineage_response_hash'
  | 'body_blocks_analysis_result_response_hash'
  | 'header_x_olumi_response_hash'
  | 'scenario_read_mapped_report_hash'

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
  /** Dominant ranking signal — see `SelectionReason`. */
  readonly selected_reason: SelectionReason
  /** Hash-evidence summary for the selected candidate (or null path). */
  readonly hash_match_status: HashMatchStatus
}

/**
 * Round-6 review (maintainability): exported as named type aliases
 * so `DebugData` and `DebugBundle` can reference these instead of
 * duplicating the unions. Previously the same enum lived in three
 * places — easy to drift.
 */
export type SelectionReason =
  | 'hash_matched'
  | 'scenario_matched_recency'
  | 'analysis_producing_recency'
  | 'no_v5_endpoint_candidate'
  | 'no_analysis_producing_candidate'
  | 'no_cee_candidate'

export type HashMatchStatus =
  | 'matched'
  | 'mismatched'
  | 'only_results_hash_present'
  | 'only_capture_hash_present'
  | 'both_absent'
  | 'no_candidate'

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
  /**
   * Where the DISPLAYED analysis (`results.hash`) sits in the captured
   * V5 turns, independent of which turn was selected. See
   * `locateDisplayedAnalysisTurn`.
   */
  displayed_analysis: DisplayedAnalysisLocation
}

// Round-4 review (IMP): service + endpoint matching now lives in the
// dedicated `v5TraceMatching` module so the selector, fallback
// payload lookup, latest-turn lookup, failed-record detection, and
// provenance classification all consume the same predicate. Old
// re-exports retained for back-compat (round-3 callers used these
// from this module).
export {
  isCeeService,
  isV5TurnEndpoint,
} from './v5TraceMatching'
import { isCeeService, isV5TurnEndpoint, extractPathname } from './v5TraceMatching'

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
  if (p.capture?.kind === 'scenario_graph_read' && p.capture.analysisResultHash) {
    return { hash: p.capture.analysisResultHash, source: 'scenario_read_mapped_report_hash' }
  }
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
  if (p.capture?.kind === 'scenario_graph_read') return p.capture.scenarioId ?? null
  const body = p.request?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const sid = (body as Record<string, unknown>).scenario_id
  return typeof sid === 'string' && sid.length > 0 ? sid : null
}

// ─── Displayed-analysis identity ────────────────────────────────────────
//
// ⭐ WHY THIS EXISTS (Paul's exports 2f1b374e / a390efd9, 24 Sep, UI a4434670).
// Both bundles pinned `payloads.cee_*` to an EARLIER typed Run that CEE
// REFUSED (`blocks: []`, run state `never_run`) while the panels showed a
// LATER successful analysis delivered by a free-text approval turn. Two
// defects combined:
//   1. Candidacy was decided by the REQUEST (`chip.action_type`), so the
//      free-text turn that actually carried the `analysis_result` block was
//      never a candidate.
//   2. The only identity signal compared the producer's response hash
//      (`x-olumi-response-hash`, e.g. `27a55f9443c5`) with `results.hash` —
//      but on the V5 path `results.hash` is the store's LOCAL content hash of
//      the block (`v5:…`, `mapV5AnalysisToReport` → `deriveBlockHash`). The two
//      are different identities and can never be equal, so every V5 analysis
//      export read `hash_match_status: "mismatched"` whether or not the right
//      turn was selected, and recency decided.
// The empty refused payload was then read as "no card / coaching rendered".
//
// The fix binds by IDENTITY: a captured turn carries the displayed analysis
// iff its first `analysis_result` block hashes, under the store's own
// derivation, to `results.hash`.

/** How a trace was bound to the DISPLAYED analysis (`results.hash`). */
export type DisplayedAnalysisMatch =
  /** First `blocks[]` analysis_result, hashed exactly as the store hashes it. */
  | 'analysis_result_content_hash'
  /** A response-hash reading (`readResponseHashWithSource`) equals `results.hash`. */
  | 'response_hash'

/**
 * The first `analysis_result` block of a V5 turn response — the block
 * `applyV5State` hydrates (`response.blocks.find(type === 'analysis_result')`).
 * Scenario-graph reads are NOT turns and are not read here.
 */
function readFirstAnalysisResultBlock(
  p: SelectorTracedPayload,
): Record<string, unknown> | null {
  if (p.capture?.kind === 'scenario_graph_read') return null
  const body = p.response?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const blocks = (body as Record<string, unknown>).blocks
  if (!Array.isArray(blocks)) return null
  for (const b of blocks) {
    if (b && typeof b === 'object' && !Array.isArray(b) && (b as Record<string, unknown>).type === 'analysis_result') {
      return b as Record<string, unknown>
    }
  }
  return null
}

/**
 * Content hash of the turn's first `analysis_result` block, using the SAME
 * derivation as the store's `results.hash` on the V5 path
 * (`v5AnalysisBlockContentHash` ≡ `mapV5AnalysisToReport(block).model_card.response_hash`).
 * Null when the response carried no analysis_result block.
 *
 * ⚠ Computed over the TRACE-STORE copy, which has been through
 * `redactPayload` (depth 8 / 100 items / 1,000 chars). A block the redactor
 * altered hashes differently, so a miss means "not identified in the
 * capture", never "a different analysis was displayed".
 */
export function readAnalysisResultContentHash(p: SelectorTracedPayload): string | null {
  const block = readFirstAnalysisResultBlock(p)
  if (block === null) return null
  return v5AnalysisBlockContentHash(block as unknown as Parameters<typeof v5AnalysisBlockContentHash>[0])
}

/** True when the turn's response carried an `analysis_result` block at all. */
export function carriesAnalysisResult(p: SelectorTracedPayload): boolean {
  return readFirstAnalysisResultBlock(p) !== null
}

/**
 * Does this trace carry the analysis the panels display? Content identity
 * first (the V5 path), then any response-hash reading (legacy/producer and
 * scenario-read paths, which carry the mapped report hash).
 */
export function matchDisplayedAnalysis(
  p: SelectorTracedPayload,
  resultsHash: string | null,
): DisplayedAnalysisMatch | null {
  if (resultsHash === null || resultsHash.length === 0) return null
  if (readAnalysisResultContentHash(p) === resultsHash) return 'analysis_result_content_hash'
  if (readResponseHash(p) === resultsHash) return 'response_hash'
  return null
}

export interface DisplayedAnalysisLocation {
  /** `results.hash` the location was computed against (null = nothing displayed). */
  readonly results_hash: string | null
  /** The captured V5 turn that delivered the displayed analysis, when found. */
  readonly trace: SelectorTracedPayload | undefined
  readonly trace_id: string | null
  readonly match: DisplayedAnalysisMatch | null
  /**
   * Every captured V5 turn in the same unbroken run that carried this same
   * analysis, OLDEST first. CEE re-sends a still-fresh prior block on later
   * turns (`analysisCardDedupe.ts`) and the store dedupes those by this same
   * hash, so only the OLDEST of the run hydrated the panels — that is `trace`
   * (for a content-hash match; a producer response-hash match keeps the
   * legacy most-recent rule).
   */
  readonly carrier_trace_ids: readonly string[]
}

/**
 * Locate the turn whose response delivered the DISPLAYED analysis.
 *
 * Walks V5 turns most-recent first. Turns with no analysis_result block are
 * skipped. Matching carriers are collected; once at least one has been found,
 * a carrier of a DIFFERENT analysis ends the run (anything older belongs to an
 * earlier hydration). Before the first match, a different-analysis carrier is
 * skipped: the store can refuse a newer block (containment), in which case the
 * displayed analysis is older than it.
 */
export function locateDisplayedAnalysisTurn(
  payloads: ReadonlyArray<SelectorTracedPayload>,
  resultsHash: string | null,
): DisplayedAnalysisLocation {
  const empty: DisplayedAnalysisLocation = {
    results_hash: resultsHash,
    trace: undefined,
    trace_id: null,
    match: null,
    carrier_trace_ids: [],
  }
  if (resultsHash === null || resultsHash.length === 0) return empty
  const run: Array<{ p: SelectorTracedPayload; match: DisplayedAnalysisMatch }> = []
  for (const p of payloads) {
    if (!isCeeService(p) || !isV5TurnEndpoint(p)) continue
    const match = matchDisplayedAnalysis(p, resultsHash)
    if (match !== null) {
      run.push({ p, match })
      continue
    }
    if (run.length > 0 && carriesAnalysisResult(p)) break
  }
  if (run.length === 0) return empty
  // Content identity: the OLDEST carrier delivered it (later ones are
  // re-sends the store deduped). A producer response-hash match keeps the
  // legacy rule — the most recent match — so that path is unchanged.
  const contentRun = run.filter(({ match }) => match === 'analysis_result_content_hash')
  const origin = contentRun.length > 0 ? contentRun[contentRun.length - 1] : run[0]
  return {
    results_hash: resultsHash,
    trace: origin.p,
    trace_id: typeof origin.p.id === 'string' ? origin.p.id : null,
    match: origin.match,
    carrier_trace_ids: run
      .map(({ p }) => (typeof p.id === 'string' ? p.id : null))
      .filter((id): id is string => id !== null)
      .reverse(),
  }
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
  displayed: DisplayedAnalysisLocation = {
    results_hash: null,
    trace: undefined,
    trace_id: null,
    match: null,
    carrier_trace_ids: [],
  },
): AnalysisProducingSelectionResult {
  return {
    displayed_analysis: displayed,
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
 * snapshot.
 *
 * ⭐ IDENTITY FIRST (24 Sep): when `locateDisplayedAnalysisTurn` finds the
 * captured turn that delivered the DISPLAYED analysis (`results.hash`), that
 * turn is selected outright, whatever its request type — see the
 * "Displayed-analysis identity" block above. Only when the displayed analysis
 * is NOT in the capture does the legacy ranking below decide, and the bundle's
 * `analysis_identity` block then says the selected turn is not the displayed
 * analysis. Legacy ranking:
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
  // (0) Identity first: which captured turn delivered the analysis the
  //     panels display? Located independently of request type — the
  //     turn that ran analysis may have been free text (24 Sep, Paul's
  //     approval turn), not a typed Run chip.
  const displayed = locateDisplayedAnalysisTurn(payloads, resultsHash)

  // (1) CEE-service entries (any endpoint).
  const ceeTurns = payloads.filter(isCeeService)
  if (ceeTurns.length === 0) {
    return emptyResult('no_cee_candidate', {}, displayed)
  }

  // (2) Endpoint-scoped V5 turn entries. Anything else is by
  //     definition NOT a V5 analysis turn and must not be selected.
  const v5Turns = ceeTurns.filter(isV5TurnEndpoint)
  if (v5Turns.length === 0) {
    return emptyResult('no_v5_endpoint_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: 0,
      analysis_producing_candidate_count: 0,
    }, displayed)
  }

  // (3) Analysis-producing filter. A turn is a candidate when its REQUEST
  //     asked for analysis OR its RESPONSE delivered the displayed analysis
  //     (identity, not "any analysis_result block"). If none qualify, fall
  //     through to the caller's fallback.
  const candidates = v5Turns
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => isAnalysisProducing(p) || p === displayed.trace)
  if (candidates.length === 0) {
    return emptyResult('no_analysis_producing_candidate', {
      cee_candidate_count: ceeTurns.length,
      v5_endpoint_candidate_count: v5Turns.length,
      analysis_producing_candidate_count: 0,
    }, displayed)
  }

  // (3b) The displayed analysis was found in the capture: it IS the
  //      analysis turn. Recency, scenario and request type cannot outrank
  //      identity — a newer typed Run that CEE refused, or a later turn
  //      that merely re-sent the block, must not displace it.
  //      A producer response-hash match is left to the legacy ranking
  //      below, which already scores it +1000 — that path is unchanged.
  if (displayed.trace !== undefined && displayed.match === 'analysis_result_content_hash') {
    const selectedReading: ResponseHashReading = {
      hash: resultsHash as string,
      source: 'body_blocks_analysis_result_content_hash',
    }
    return {
      displayed_analysis: displayed,
      selected: displayed.trace,
      hash_mismatch_observed: false,
      selected_response_hash: selectedReading.hash,
      selected_response_hash_source: selectedReading.source,
      selected_trace_id: displayed.trace_id,
      selection_diagnostics: {
        cee_candidate_count: ceeTurns.length,
        v5_endpoint_candidate_count: v5Turns.length,
        analysis_producing_candidate_count: candidates.length,
        selected_via_primary_path: true,
        selected_reason: 'hash_matched',
        hash_match_status: 'matched',
      },
    }
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
    displayed_analysis: displayed,
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

/** A read may explain a report only when BOTH scenario and report identity match. */
export function matchingScenarioAnalysisReads(
  payloads: ReadonlyArray<SelectorTracedPayload>,
  scenarioId: string | null,
  resultsHash: string | null,
): SelectorTracedPayload[] {
  if (!scenarioId || !resultsHash) return []
  return payloads.filter((p) => {
    const path = p.endpoint ? extractPathname(p.endpoint) : null
    const pathScenario = path?.match(/\/(?:bff\/cee|assist\/v1)\/scenarios\/([^/]+)\/graph\/?$/)?.[1]
    if (pathScenario !== encodeURIComponent(scenarioId)) return false
    if (p.capture?.kind !== 'scenario_graph_read' || !isCeeService(p) || !isCompletedTwoXx(p)) return false
    if (p.capture.scenarioId !== scenarioId || p.capture.analysisResultHash !== resultsHash) return false
    const body = p.response?.body as Record<string, unknown> | null | undefined
    if (typeof body?.scenario_id === 'string' && body.scenario_id !== scenarioId) return false
    const block = body?.analysis_result as Record<string, unknown> | null | undefined
    return block?.type === 'analysis_result'
  })
}
