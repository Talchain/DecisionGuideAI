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
 * PR #156 round-4 (reviewer P1 #1): ranking is now
 *
 *   1. Hash match — when the caller supplies `resultsHash`, a
 *      candidate whose `response_hash` equals it wins. This stops
 *      a stale V1 entry in the 20-entry ring buffer from
 *      displacing the V2 trace that actually produced the
 *      currently-rendered results.
 *   2. Usable + recency + tier — among candidates with body
 *      evidence (2xx completed + non-empty object body), prefer
 *      the most-recent (index 0 in the most-recent-first array);
 *      ties broken by tier (V1 engine > V1 stream > V2).
 *   3. Tier fallback — when NO candidate has body evidence, pick
 *      the most-recent in-tier entry (V1 engine > V1 stream > V2)
 *      so reviewers see the attempt; flagged non-usable so the
 *      bundle labels honestly.
 *   4. None — no analysis-class entry in any tier.
 *
 * The `payloads` array is assumed most-recent-first (matches the
 * trace store's `payloads: [newest, ...]` convention).
 *
 * The `resultsHash` argument is optional — when null/undefined,
 * the selector skips step 1 (preserves pre-round-4 behaviour for
 * tests/callers that don't have a results hash to anchor on).
 */
export function findAnalysisProducingPlotTurn<T extends PlotSelectorTracedPayload>(
  payloads: ReadonlyArray<T>,
  resultsHash: string | null = null,
): PlotSelectionResult<T> {
  // Filter to analysis-class candidates only. Tag with their index
  // so the recency tiebreaker is deterministic.
  type Candidate = { p: T; idx: number; tier: PlotTraceTier }
  const candidates: Candidate[] = []
  payloads.forEach((p, idx) => {
    const tier = tierOf(p)
    if (tier !== 'other') candidates.push({ p, idx, tier })
  })
  if (candidates.length === 0) {
    return { selected: null, tier: null, selected_is_usable_live_evidence: false }
  }

  // Score every candidate. Highest score wins.
  //   +1000 when both hashes present and EQUAL (top signal)
  //   +50   when 2xx completed AND body usable
  //   +tier (3/2/1 for engine/stream/v2)
  //   +max(0, 9 - idx)  recency tiebreaker
  const usableNorm = (c: Candidate): boolean =>
    is2xxCompleted(c.p) && hasUsableResponseBody(c.p)
  const score = (c: Candidate): number => {
    let s = 0
    if (resultsHash !== null && resultsHash.length > 0) {
      const ch = readPlotResponseHash(c.p)
      if (ch !== null && ch === resultsHash) s += 1000
    }
    if (usableNorm(c)) s += 50
    s += TIER_RANK[c.tier]
    s += Math.max(0, 9 - c.idx)
    return s
  }

  const ranked = candidates
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s)
  const winner = ranked[0].c
  return {
    selected: winner.p,
    tier: winner.tier,
    selected_is_usable_live_evidence: usableNorm(winner),
  }
}
