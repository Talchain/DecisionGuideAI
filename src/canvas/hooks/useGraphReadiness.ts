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
  // Suppress unhandled rejection — callers still get the rejection via `promise`
  promise.catch(() => {})
  promise.finally(() => {
    entry.settled = true
    setTimeout(() => {
      if (inflightCache.get(cacheKey) === entry) {
        inflightCache.delete(cacheKey)
      }
    }, DEDUP_WINDOW_MS)
  })

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

export type ReadinessLevel = 'needs_work' | 'fair' | 'strong'
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

export interface GraphReadiness {
  readiness_score: number // 0-100
  readiness_level: ReadinessLevel
  can_run_analysis: boolean
  confidence_explanation: string
  improvements: GraphImprovement[]
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
