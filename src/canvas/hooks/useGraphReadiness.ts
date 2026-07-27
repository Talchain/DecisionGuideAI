/**
 * useGraphReadiness Hook — thin wrapper over readinessStore.
 *
 * All fetch logic, debouncing, and state management now live in
 * src/canvas/stores/readinessStore.ts. This file re-exports types
 * for backward compatibility and provides the hook interface that
 * existing consumers expect.
 *
 * The readiness store is initialised lazily on first hook mount —
 * startListening() is ref-counted so the subscription stays alive
 * until the last consumer unmounts.
 */

import { useEffect } from 'react'
import { useReadinessStore } from '../stores/readinessStore'

// ── Module-level request deduplication ──────────────────────────────
// Retained here because readinessStore.ts imports __test__.deduplicatedFetch.
// The cache is shared across the module boundary via the singleton Map.

const DEDUP_WINDOW_MS = 750

/**
 * Pre-parsed response shared between dedup consumers.
 * The Response body is consumed exactly once; all consumers read from this.
 */
export interface DeduplicatedResponse {
  ok: boolean
  status: number
  statusText: string
  /** Parsed JSON body on success, null on error */
  data: any
  /** Text body for error responses */
  errorBody: string
  /** Retry-After header value (for 429 handling) */
  retryAfterHeader: string | null
}

interface InflightEntry {
  promise: Promise<DeduplicatedResponse>
  timestamp: number
  controller: AbortController
  /** Number of hook instances sharing this entry */
  refCount: number
  /** True once the fetch promise has settled (resolved or rejected) */
  settled: boolean
}
const inflightCache = new Map<string, InflightEntry>()

/**
 * Deduplicated fetch: reuses an in-flight (or recently resolved) request
 * for the same endpoint + payload body. Returns a pre-parsed response so
 * multiple consumers can safely read the result without "body stream already
 * read" errors. Uses refCount to prevent one consumer's unmount from
 * aborting a request shared by other consumers.
 */
function deduplicatedFetch(
  url: string,
  payloadJson: string,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): { promise: Promise<DeduplicatedResponse>; entry: InflightEntry; isReused: boolean } {
  const cacheKey = `${url}:${payloadJson}`
  const existing = inflightCache.get(cacheKey)
  if (existing && (!existing.settled || Date.now() - existing.timestamp < DEDUP_WINDOW_MS)) {
    existing.refCount++
    return { promise: existing.promise, entry: existing, isReused: true }
  }

  const controller = new AbortController()

  // Parse the response body exactly once, then share the parsed result.
  // The async IIFE ensures fetch() rejection is captured within the promise
  // chain rather than triggering Node.js "unhandled rejection" in test
  // environments where relative URLs are invalid (jsdom).
  const promise = (async (): Promise<DeduplicatedResponse> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': correlationId,
        ...extraHeaders,
      },
      body: payloadJson,
      signal: controller.signal,
    })
    if (response.ok) {
      const data = await response.json()
      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        data,
        errorBody: '',
        retryAfterHeader: null,
      }
    }
    const errorBody = await response.text().catch(() => 'Unable to read response body')
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      data: null,
      errorBody,
      retryAfterHeader: response.headers.get('Retry-After'),
    }
  })()

  const entry: InflightEntry = { promise, timestamp: Date.now(), controller, refCount: 1, settled: false }
  inflightCache.set(cacheKey, entry)
  // Suppress unhandled rejection — callers still get the rejection via `promise`.
  // `.finally()` returns a NEW, distinct promise that adopts the original's
  // rejection (it does not swallow errors). That derived promise must also
  // have a rejection handler, or it surfaces as its own unhandled rejection
  // independently of the `.catch(() => {})` above (#248).
  promise.catch(() => {})
  promise
    .finally(() => {
      entry.settled = true
      setTimeout(() => {
        if (inflightCache.get(cacheKey) === entry) {
          inflightCache.delete(cacheKey)
        }
      }, DEDUP_WINDOW_MS)
    })
    .catch(() => {})

  return { promise, entry, isReused: false }
}

/**
 * Release a ref to a shared inflight entry. Only aborts the underlying
 * request when the last consumer releases (refCount drops to 0).
 */
function releaseInflightEntry(entry: InflightEntry | null): void {
  if (!entry) return
  entry.refCount--
  if (entry.refCount <= 0) {
    entry.controller.abort()
  }
}

/** Clear inflight cache — exposed for testing */
export function clearInflightCache(): void {
  inflightCache.clear()
}

/** @internal — exposed for unit testing dedup logic and readinessStore. */
export const __test__ = { deduplicatedFetch, releaseInflightEntry }

// ── Types (re-exported for all consumers) ──────────────────────────

// ── PRE-ANALYSIS readiness vocabulary ──────────────────────────────
//
// ⚠ THIS IS NOT THE POST-ANALYSIS CONFIDENCE TIER. `EnrichmentConfidenceTier`
// (`strong | fair | needs_work`, @talchain/schemas dist/boundary/enrichment.d.ts)
// answers "how much should you trust the answer we just produced?". The field
// below answers "is this model complete enough to analyse?" — a different claim
// at a different point in the lifecycle, produced by a different service.
//
// Until 2026-07-27 the allowlist in readinessStore's normaliser was the
// POST-analysis tier's member list applied to this PRE-analysis field. The two
// sets overlap on `fair` and `needs_work` and differ on exactly one member, so
// the mistranslation was invisible on two thirds of all inputs and silently
// coerced CEE's top band (`ready`) to `fair` on EVERY graph scoring >= 70.
// Keep the two vocabularies named apart so that cannot recur.

/**
 * The levels CEE emits for `readiness_level` on POST /assist/v1/graph-readiness.
 *
 * ⚠ CROSS-REPO MIRROR — it cannot be derived from this repo, because the
 * pre-analysis readiness surface does not travel through `@talchain/schemas`.
 * Read at the bytes from olumi-assistants-service `staging`
 * `b35d09debc0c6843dbcbf7f28a4676810d77c278`:
 *   - `src/cee/graph-readiness/types.ts:8`
 *       `export type ReadinessLevel = "ready" | "fair" | "needs_work";`
 *   - `src/routes/assist.v1.graph-readiness.ts:29` (V1) and `:169` (V3), both
 *       `readiness_level: "ready" | "fair" | "needs_work";`
 *   - `src/cee/graph-readiness/index.ts:198-201` assigns `"ready"` at
 *       `score >= READINESS_THRESHOLDS.ready` (70, `constants.ts:30-31`).
 * A producer-side change to this set is NOT visible from here; the durable fix
 * is a boundary-contract test deriving both sides at their real SHAs.
 */
export const CEE_READINESS_LEVELS = ['needs_work', 'fair', 'ready'] as const
export type CeeReadinessLevel = (typeof CEE_READINESS_LEVELS)[number]

/**
 * `strong` is NOT a CEE value — no CEE code path assigns it to `readiness_level`.
 * It is emitted only by the UI's own local heuristic,
 * `readinessStore.calculateFallbackReadiness`, when CEE is unreachable, and that
 * value is written straight to the store WITHOUT passing through the normaliser.
 * Accepted here so the field's type covers both writers.
 *
 * @deprecated Local-fallback spelling of the top band. The fallback emitting a
 * BETTER verdict than the producer (CEE down + score 85 => `strong`; CEE up +
 * score 85 => the top band) is tracked separately and deliberately untouched
 * here — see the divergence-2 row on the family-3 readiness design.
 */
export const LOCAL_FALLBACK_READINESS_LEVELS = ['strong'] as const
export type LocalFallbackReadinessLevel = (typeof LOCAL_FALLBACK_READINESS_LEVELS)[number]

/**
 * Every value `GraphReadiness.readiness_level` may hold — the producer's set
 * plus the local-fallback band. This is what the normaliser accepts; anything
 * else is unrecognised input and degrades to `fair` (loudly, in DEV).
 */
export const ACCEPTED_READINESS_LEVELS = [
  ...CEE_READINESS_LEVELS,
  ...LOCAL_FALLBACK_READINESS_LEVELS,
] as const

export type GraphReadinessLevel = CeeReadinessLevel | LocalFallbackReadinessLevel

export type ImprovementPriority = 'high' | 'medium' | 'low'

export type SuggestedNodeType = 'risk' | 'outcome' | 'option' | 'factor' | 'evidence' | 'goal' | 'decision'

export interface GraphImprovement {
  category: string
  action: string
  current_gap: string
  quality_impact: number
  /** Target quality score after implementing this improvement */
  target_quality: number
  priority: ImprovementPriority
  effort_minutes: number
  /** Node IDs that need attention for this improvement */
  affected_nodes?: string[]
  /** Edge IDs that need attention for this improvement */
  affected_edges?: string[]
  /** Suggested node type to add (e.g., 'risk', 'factor', 'evidence') */
  suggested_node_type?: SuggestedNodeType
  /** Current score for this quality factor (0-100) */
  current_score?: number
}

/**
 * CEE graph-readiness scaffold intent (CEE #612). When the engine will draft
 * the remaining options for the user, it rides this alongside the readiness
 * verdict so the UI can offer the run rather than false-block it.
 * Not a @talchain/schemas type — it is a CEE endpoint-response shape, typed
 * UI-side (verify the wire field name against A1's contract before widening).
 */
export interface ScaffoldPlan {
  /** True when CEE will draft the remaining options on run. */
  will_scaffold_options: boolean
  /** How many options CEE will draft. Present only when will_scaffold_options. */
  option_count?: number
}

export interface GraphReadiness {
  readiness_score: number // 0-100
  readiness_level: GraphReadinessLevel
  can_run_analysis: boolean
  confidence_explanation: string
  improvements: GraphImprovement[]
  /**
   * UI-SEM-091 input. Optional — absent on older CEE builds and on the local
   * 404/429 fallback, so its absence is fail-safe: the gate collapses to
   * `allowed = can_run_analysis`, byte-identical to pre-scaffold behaviour.
   */
  scaffold_plan?: ScaffoldPlan
}

// ── Hook (thin wrapper) ────────────────────────────────────────────

/**
 * Backward-compatible hook. All state & logic lives in readinessStore.
 * Calls startListening() on mount — ref-counted so the subscription
 * stays alive until the last consumer unmounts.
 */
export function useGraphReadiness() {
  const readiness = useReadinessStore((s) => s.readiness)
  const loading = useReadinessStore((s) => s.loading)
  const error = useReadinessStore((s) => s.error)
  const refresh = useReadinessStore((s) => s.refresh)

  // Ref-counted: startListening increments, returned cleanup decrements.
  // Subscription only tears down when refCount hits 0.
  useEffect(() => {
    const unsub = useReadinessStore.getState().startListening()
    return unsub
  }, [])

  return { readiness, loading, error, refresh }
}
