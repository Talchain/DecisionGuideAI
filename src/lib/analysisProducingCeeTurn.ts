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
 * scenario id and `results.hash`, and receive both the selected entry
 * and a `hash_mismatch_observed` boolean that drives a coherence
 * issue in the bundle assembler.
 *
 * Selection contract:
 *   - Only analysis-producing CEE turns are candidates (the caller
 *     falls back to `findBestPayload` when this returns `undefined`,
 *     so non-analysis V5 / V1 turns still surface honestly).
 *   - Soft hash matching: a match against `results.hash` is a strong
 *     preference but a missing hash on either side NEVER disqualifies
 *     a candidate.
 *   - Mismatch reporting: when both hashes are present and disagree,
 *     `hash_mismatch_observed: true` is returned so the bundle can
 *     fire the `capture_response_hash_mismatch_with_results`
 *     coherence issue.
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
}

/**
 * Case-insensitive CEE service filter. Trace recorders should set
 * `service: 'CEE'` but historical entries / future renaming may use
 * `'cee'` or mixed case — match defensively.
 */
function isCeeService(p: SelectorTracedPayload): boolean {
  return (
    typeof p.service === 'string' && p.service.toUpperCase() === 'CEE'
  )
}

/**
 * Defensive turn / action type read. Looks at every documented
 * location where the discriminator might live:
 *   - `p.turnType` (recorder-set field)
 *   - `request.body.turnType`
 *   - `request.body.turn_type` (snake_case)
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
 * Defensive response_hash read. The hash may be carried at:
 *   - `response.body.response_hash` (root)
 *   - `response.body.meta.response_hash`
 *   - `response.body.blocks[].response_hash` on an `analysis_result` block
 *   - `response.headers['x-olumi-response-hash']` (header echo)
 *   - `response.headers['X-Olumi-Response-Hash']` (case-insensitive)
 * Returns the first non-empty string found, or null.
 */
export function readResponseHash(p: SelectorTracedPayload): string | null {
  const body = p.response?.body
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const root = body as Record<string, unknown>
    if (typeof root.response_hash === 'string' && root.response_hash.length > 0) {
      return root.response_hash
    }
    const meta = root.meta
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const metaHash = (meta as Record<string, unknown>).response_hash
      if (typeof metaHash === 'string' && metaHash.length > 0) {
        return metaHash
      }
    }
    const blocks = root.blocks
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        if (!b || typeof b !== 'object' || Array.isArray(b)) continue
        const bb = b as Record<string, unknown>
        if (bb.type === 'analysis_result') {
          const blockHash = bb.response_hash
          if (typeof blockHash === 'string' && blockHash.length > 0) {
            return blockHash
          }
        }
      }
    }
  }
  // Header fallback — iterate so we can match case-insensitively.
  const headers = p.response?.headers
  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'x-olumi-response-hash') {
        if (typeof value === 'string' && value.length > 0) return value
      }
    }
  }
  return null
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
 * Returns `{ selected: undefined, hash_mismatch_observed: false }`
 * when no candidate is analysis-producing — the caller (useDebugData)
 * should then fall back to `findBestPayload` so non-analysis V5 / V1
 * turns still surface honestly.
 */
export function findLatestAnalysisProducingCeeTurn(
  payloads: ReadonlyArray<SelectorTracedPayload>,
  currentScenarioId: string | null,
  resultsHash: string | null,
): AnalysisProducingSelectionResult {
  // Only CEE turns are eligible.
  const ceeTurns = payloads.filter(isCeeService)
  if (ceeTurns.length === 0) {
    return { selected: undefined, hash_mismatch_observed: false }
  }

  // Filter to analysis-producing only. If none qualify, fall through
  // to the caller's fallback.
  const candidates = ceeTurns
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => isAnalysisProducing(p))
  if (candidates.length === 0) {
    return { selected: undefined, hash_mismatch_observed: false }
  }

  const score = (p: SelectorTracedPayload, idx: number): number => {
    let s = 0
    if (resultsHash !== null && readResponseHash(p) === resultsHash) {
      s += 1000
    }
    if (
      currentScenarioId !== null &&
      readScenarioId(p) === currentScenarioId
    ) {
      s += 100
    }
    // Analysis-producing already verified by the filter above; +50 is
    // a constant offset that makes this signal visible to scoring
    // overrides should we ever extend the filter to non-strict matches.
    s += 50
    if (isCompletedTwoXx(p)) s += 10
    // Recency tiebreaker (index in the most-recent-first array). 0 →
    // +9, …, 9+ → 0. Avoids strict equality being decided by
    // arbitrary array order.
    s += Math.max(0, 9 - idx)
    return s
  }

  candidates.sort(
    (a, b) => score(b.p, b.idx) - score(a.p, a.idx),
  )
  const selected = candidates[0].p

  const selectedHash = readResponseHash(selected)
  const hash_mismatch_observed =
    resultsHash !== null &&
    selectedHash !== null &&
    resultsHash !== selectedHash

  return { selected, hash_mismatch_observed }
}
