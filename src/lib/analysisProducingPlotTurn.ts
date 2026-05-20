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
 * Pick the analysis-producing PLoT trace from a snapshot.
 *
 * Selection order (most-recent-first within each tier):
 *   Tier 1 — V1 sync engine, 2xx completed, with body
 *   Tier 2 — V1 SSE stream,  2xx completed, with body
 *   Tier 3 — V2 PLoT run,    2xx completed, with body
 *   Tier 4 (fallback) — most-recent V1 engine OR stream OR V2 run
 *     entry regardless of body / completion (so reviewers still
 *     see the attempt; the bundle labels it as non-live).
 *   None — no PLoT entry in any tier.
 *
 * The `payloads` array is assumed most-recent-first (matches the
 * trace store's `payloads: [newest, ...]` convention).
 */
export function findAnalysisProducingPlotTurn<T extends PlotSelectorTracedPayload>(
  payloads: ReadonlyArray<T>,
): PlotSelectionResult<T> {
  // Bucket by tier.
  const v1Engine: T[] = []
  const v1Stream: T[] = []
  const v2Run: T[] = []
  for (const p of payloads) {
    switch (tierOf(p)) {
      case 'v1_engine':
        v1Engine.push(p)
        break
      case 'v1_stream':
        v1Stream.push(p)
        break
      case 'v2_run':
        v2Run.push(p)
        break
      default:
        // Skip non-analysis PLoT entries.
        break
    }
  }

  // Tier 1 — V1 engine with body.
  for (const p of v1Engine) {
    if (is2xxCompleted(p) && hasUsableResponseBody(p)) {
      return { selected: p, tier: 'v1_engine', selected_is_usable_live_evidence: true }
    }
  }
  // Tier 2 — V1 stream with body.
  for (const p of v1Stream) {
    if (is2xxCompleted(p) && hasUsableResponseBody(p)) {
      return { selected: p, tier: 'v1_stream', selected_is_usable_live_evidence: true }
    }
  }
  // Tier 3 — V2 with body.
  for (const p of v2Run) {
    if (is2xxCompleted(p) && hasUsableResponseBody(p)) {
      return { selected: p, tier: 'v2_run', selected_is_usable_live_evidence: true }
    }
  }

  // Tier 4 (fallback) — any analysis-class entry, regardless of body.
  // Same priority: V1 engine > V1 stream > V2 > nothing. Reviewers
  // see the attempt; the bundle labels it as non-live (request-only,
  // failed, or empty-stream).
  for (const p of v1Engine) {
    return { selected: p, tier: 'v1_engine', selected_is_usable_live_evidence: false }
  }
  for (const p of v1Stream) {
    return { selected: p, tier: 'v1_stream', selected_is_usable_live_evidence: false }
  }
  for (const p of v2Run) {
    return { selected: p, tier: 'v2_run', selected_is_usable_live_evidence: false }
  }

  return { selected: null, tier: null, selected_is_usable_live_evidence: false }
}
