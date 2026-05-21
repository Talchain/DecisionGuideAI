/**
 * Analysis-producing PLoT turn selector.
 *
 * PR #156 round-3 (reviewer BLOCKING #2): debug-bundle PLoT selection
 * was using generic `findBestPayload(tracedPayloads, 'PLoT')` which
 * picks the most-recent completed PLoT entry of any kind. A later
 * non-analysis entry (validate / probe / limits / capabilities) can
 * displace the actual `/v1/run` analysis response — validators then
 * inspect the wrong body or miss it entirely.
 *
 * This module mirrors `analysisProducingCeeTurn.ts`: a pure-utility
 * selector that prefers analysis-producing PLoT turns. Ranking:
 *
 *   1. V1 sync engine    (`/bff/engine/v1/run`)        — primary
 *   2. V1 SSE streaming  (`/bff/engine/v1/stream`)     — Run-analysis SSE
 *   3. V2 PLoT run       (`/v2/run`)                   — V4 path
 *
 * Within each tier, prefers entries that are:
 *   - completed (HTTP round-trip closed)
 *   - 2xx status
 *   - have a response body (`response.body !== null` / non-empty object)
 *
 * Falls back to the highest-tier ANY completed entry when no
 * "with-body" candidate exists, so a request-only or partial-stream
 * entry can still surface honestly (the caller can then label it as
 * non-live).
 */

import {
  isV1PlotEngineEndpoint,
  isV1PlotStreamEndpoint,
  isV2PlotEndpoint,
} from './v5TraceMatching'

/**
 * Loose shape the selector accepts. Subset of `TracedPayload` so the
 * selector can be tested without importing the full Zustand store.
 */
export interface PlotSelectorTracedPayload {
  id?: string
  service?: string
  endpoint?: string
  status?: number
  completed?: boolean
  timestamp?: number
  request?: { headers?: Record<string, string>; body?: unknown }
  response?: { headers?: Record<string, string>; body?: unknown }
}

export type PlotTraceTier = 'v1_engine' | 'v1_stream' | 'v2_run' | 'other'

export interface PlotSelectionResult<T> {
  /** Selected entry, or null when no PLoT entry exists at all. */
  selected: T | null
  /**
   * Which tier the selection came from. `other` means a fallback
   * candidate (no matching tier had a usable entry).
   */
  tier: PlotTraceTier | null
  /**
   * True when the selected entry is `completed === true` AND has a
   * 2xx status AND has a parseable response body. This is the
   * "usable live evidence" signal the bundle uses to gate
   * `analysis_evidence_source = live_*`.
   */
  selected_is_usable_live_evidence: boolean
}

/** Returns true if the entry's response.body is a non-null object. */
function hasUsableResponseBody(p: PlotSelectorTracedPayload): boolean {
  const body = p.response?.body
  if (body === null || body === undefined) return false
  if (typeof body === 'object' && !Array.isArray(body)) {
    return Object.keys(body as Record<string, unknown>).length > 0
  }
  return false
}

function is2xxCompleted(p: PlotSelectorTracedPayload): boolean {
  return (
    p.completed === true &&
    typeof p.status === 'number' &&
    p.status >= 200 &&
    p.status < 300
  )
}

function tierOf(p: PlotSelectorTracedPayload): PlotTraceTier {
  if (isV1PlotEngineEndpoint(p)) return 'v1_engine'
  if (isV1PlotStreamEndpoint(p)) return 'v1_stream'
  if (isV2PlotEndpoint(p)) return 'v2_run'
  return 'other'
}

/**
 * PR #156 round-4 (reviewer P1 #1): read the response_hash from a
 * PLoT response body. PLoT v1 typically carries it at the root;
 * defensive reads cover meta + lineage as fall-backs (same pattern
 * as the CEE response-hash reader).
 */
function readPlotResponseHash(p: PlotSelectorTracedPayload): string | null {
  const body = p.response?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const root = body as Record<string, unknown>
  // Root-level (most common for V1 engine).
  if (typeof root.response_hash === 'string' && root.response_hash.length > 0) {
    return root.response_hash
  }
  // Meta-level.
  const meta = root.meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const mh = (meta as Record<string, unknown>).response_hash
    if (typeof mh === 'string' && mh.length > 0) return mh
  }
  // Lineage-level (forward compat with V5 shape).
  const lineage = root.lineage
  if (lineage && typeof lineage === 'object' && !Array.isArray(lineage)) {
    const lh = (lineage as Record<string, unknown>).response_hash
    if (typeof lh === 'string' && lh.length > 0) return lh
  }
  return null
}

const TIER_RANK: Record<PlotTraceTier, number> = {
  v1_engine: 3,
  v1_stream: 2,
  v2_run: 1,
  other: 0,
}

/**
 * Pick the analysis-producing PLoT trace from a snapshot.
 *
 * PR #156 round-5 (reviewer BLOCKING): ordering is now strictly
 * lexicographic — each criterion is fully resolved before the
 * next is consulted. Earlier rounds used additive scoring
 * (hash bonus + tier weight + recency bonus), which let tier
 * displace recency when no hash matched (e.g. a stale V1 engine
 * trace beating a fresher V2 trace by only one recency step).
 *
 * New precedence (strictly lexicographic):
 *
 *   1. Hash match — if `resultsHash` is supplied AND a candidate's
 *      `response_hash` equals it, that candidate wins outright.
 *      Anchors the selection to the currently-rendered results.
 *   2. Recency — among remaining candidates (or when no hash is
 *      supplied / no candidate matches), the most-recent
 *      analysis-producing trace wins. Most-recent = lowest index
 *      in the most-recent-first array. The most recent attempt is
 *      the trace most likely to correspond to what the user sees
 *      on screen, even if it failed.
 *   3. Tier — only used as a tiebreaker when two candidates share
 *      both hash status and recency (rare in practice; possible
 *      with synthetic fixtures). V1 engine > V1 stream > V2 run.
 *
 * Usability (`completed-2xx + body present`) is NOT part of the
 * ordering. It is surfaced separately via the
 * `selected_is_usable_live_evidence` flag so the bundle can label
 * honestly: the most-recent attempt is shown even when it failed,
 * and the flag tells downstream classifiers whether to claim live
 * raw evidence. This avoids silently swapping a failed-but-recent
 * trace for a succeeded-but-stale one.
 *
 * The `payloads` array is assumed most-recent-first (matches the
 * trace store's `payloads: [newest, ...]` convention).
 *
 * The `resultsHash` argument is optional — when null/undefined,
 * step 1 is skipped and the selector falls straight through to
 * recency + tier.
 */
export function findAnalysisProducingPlotTurn<T extends PlotSelectorTracedPayload>(
  payloads: ReadonlyArray<T>,
  resultsHash: string | null = null,
): PlotSelectionResult<T> {
  // Filter to analysis-class candidates only (excludes /v1/validate,
  // /v1/limits, etc.). Tag with their index so recency comparisons
  // are deterministic.
  type Candidate = { p: T; idx: number; tier: PlotTraceTier }
  const candidates: Candidate[] = []
  payloads.forEach((p, idx) => {
    const tier = tierOf(p)
    if (tier !== 'other') candidates.push({ p, idx, tier })
  })
  if (candidates.length === 0) {
    return { selected: null, tier: null, selected_is_usable_live_evidence: false }
  }

  // Pre-compute hash-match flag once per candidate.
  const anchorHash =
    typeof resultsHash === 'string' && resultsHash.length > 0
      ? resultsHash
      : null
  const hashMatched = (c: Candidate): boolean => {
    if (anchorHash === null) return false
    const ch = readPlotResponseHash(c.p)
    return ch !== null && ch === anchorHash
  }

  // Strict lexicographic comparator.
  //   1. hashMatched desc (true wins)
  //   2. recency asc       (lower idx wins — more recent)
  //   3. tier desc         (higher rank wins — engine > stream > v2)
  // Returns negative when `a` should come before `b`.
  const compare = (a: Candidate, b: Candidate): number => {
    const ah = hashMatched(a)
    const bh = hashMatched(b)
    if (ah !== bh) return ah ? -1 : 1
    if (a.idx !== b.idx) return a.idx - b.idx
    return TIER_RANK[b.tier] - TIER_RANK[a.tier]
  }

  const ranked = candidates.slice().sort(compare)
  const winner = ranked[0]
  const winnerUsable =
    is2xxCompleted(winner.p) && hasUsableResponseBody(winner.p)
  return {
    selected: winner.p,
    tier: winner.tier,
    selected_is_usable_live_evidence: winnerUsable,
  }
}
