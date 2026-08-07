/**
 * P0.8 — Instrumentation for Results Panel: the run-lifecycle spine.
 *
 * Events emitted here:
 * - run_started: User clicks Run
 * - run_completed: Results received
 * - run_failed: Error returned
 * - plot.empty_computed_results: backend claimed "computed", results were empty
 *
 * ⚠ FOUR SENDERS WERE DELETED HERE, and the reason is the same defect this
 * module exists to fix. `trackRetryClicked`, `trackRemediationClicked` and
 * `trackCTAClicked` had **ZERO product call sites** — dead exports that read as
 * instrumentation. `trackCompareOpened` had call sites, but not these: the real
 * compare-open actions (`OutputsDock.tsx:1698`, `CompactOptionSpread.tsx:86`)
 * call a **same-named twin** in `canvas/utils/sandboxTelemetry.ts`. Two
 * same-named senders with different sinks is the hazard, not the fix, so
 * `compare_opened` now lives in that twin — one name, one function, both sinks.
 * See `canvas/utils/sandboxTelemetry.ts`.
 *
 * ⚠ TRANSPORT — ROADMAP 2.150. Every sender below used to read
 * `(window as any).posthog` and fire only `if (posthog?.capture)`.
 * `window.posthog` NEVER EXISTS on this app: posthog-js@1.369.1 has no
 * `exports` map, so Vite resolves `dist/module.js`, which contains zero
 * assignments to any `.posthog` property (positive control: the *snippet*
 * build `dist/array.full.js` does assign it, so the search can see a
 * presence). Nothing in `src/` assigns it either, and index.html loads no
 * PostHog snippet. So this module — imported by `OutputsDock.tsx` and
 * `useV2Run.ts`, i.e. LIVE product code — could never fire.
 *
 * It now routes through the IMPORTED `trackEvent` from `src/lib/posthog.ts`,
 * the only module that calls `posthog.init`, and through the IMPORTED
 * `captureMessage` from `@sentry/react`, the channel `src/lib/monitoring.ts`
 * already uses correctly. Event names and payload shapes are UNCHANGED — this
 * was a transport fix, not a taxonomy change.
 *
 * Pinned by `src/lib/__tests__/resultsInstrumentationRoute.spec.ts`, whose
 * negative control installs a fake `window.posthog` and asserts it is never
 * called. Do not reintroduce a global sniff.
 */

import { captureMessage } from '@sentry/react'
import { trackEvent } from './posthog'

// =============================================================================
// Types
// =============================================================================

// ⚠ These are `type` aliases, not `interface`s, and that is load-bearing.
// TypeScript gives an object TYPE ALIAS an implicit index signature but gives an
// INTERFACE none, so an interface is not assignable to `trackEvent`'s
// `Record<string, unknown>` parameter. The alternative was an
// `as unknown as Record<string, unknown>` double cast at all five call sites —
// a cast that would also silence a genuine shape error. The aliases stay CLOSED
// (no index signature declared), so the never-capture discipline is unchanged.

export type RunStartedPayload = {
  option_count: number
  node_count?: number
  edge_count?: number
}

export type RunCompletedPayload = {
  confidence_level: 'high' | 'medium' | 'low'
  drivers_informative: boolean
  trace_id?: string
  duration_ms?: number
}

export type RunFailedPayload = {
  /** A CODE, not a sentence. Transported. */
  error_code: string
  /**
   * ⚠ ACCEPTED BUT **NEVER TRANSPORTED**. Kept on the parameter type because
   * callers legitimately have it (the store's `error.message`, the run
   * validator's assembled sentence) and rewriting five call sites to drop it
   * would only move the hazard to whoever adds the sixth.
   *
   * `useV2Run.ts` builds this by interpolating OPTION LABELS and NODE LABELS
   * (`targetName` → `labelByNodeId` → `n.data.label`); `OutputsDock.tsx` passes
   * the store's `error.message`, which is the same text. That is user-authored
   * content, banned outright. `trackRunFailed` drops it and sends the derived
   * `error_category` instead — see RUN_FAILED_TRANSPORT_KEYS below.
   */
  error_message?: string
}

/**
 * The closed categorical that REPLACES `error_message` on the wire.
 *
 * Derived from `error_code`, never from the message text. `other` is the
 * deliberate fail-open default: an unmapped code shows up as a visible spike in
 * `other` rather than as a silent miscategorisation, so the mapping's drift is
 * legible in the data itself.
 */
export type RunFailedCategory =
  | 'input_incomplete'
  | 'graph_rejected'
  | 'upstream_failed'
  | 'network'
  | 'client_error'
  | 'other'

const ERROR_CATEGORY_BY_CODE: Record<string, RunFailedCategory> = {
  MISSING_INTERVENTIONS: 'input_incomplete',
  MISSING_GOAL: 'input_incomplete',
  GRAPH_TOO_COMPLEX: 'graph_rejected',
  VALIDATION_BLOCKED: 'graph_rejected',
  ANALYSIS_FAILED: 'upstream_failed',
  NETWORK_ERROR: 'network',
  TIMEOUT: 'network',
  PROCESSING_ERROR: 'client_error',
}

export function deriveErrorCategory(code: string): RunFailedCategory {
  return ERROR_CATEGORY_BY_CODE[code] ?? 'other'
}


// =============================================================================
// The transport seam — a DECLARED ALLOWLIST, not a type
// =============================================================================
//
// WHY THIS EXISTS. A TypeScript payload type is not a runtime filter. Four call
// sites in `useV2Run.ts` passed `duration_ms`, `request_id`, `option_count` and
// `has_drivers` — none of which are on the declared payload types — and every
// one of them reached PostHog, because excess-property checking does not
// survive to runtime. The same hole is what let `error_message` through.
//
// So the seam builds the transport object from an explicit key list per event.
// Anything not listed is DROPPED, and the dropped key NAMES (never their
// values — a leak report must not re-leak) are reported as a contract-health
// event. A future caller is then safe BY CONSTRUCTION rather than by review.
//
// This mirrors `src/telemetry/measurementEvents.ts`'s `trackMeasurement`
// deliberately: one discipline, two modules, so a reader who learns it once
// knows it everywhere.

const RUN_SPINE_TRANSPORT_KEYS = {
  run_started: ['option_count', 'node_count', 'edge_count'],
  run_completed: ['confidence_level', 'drivers_informative', 'trace_id', 'duration_ms'],
  run_failed: ['error_code', 'error_category'],
  'plot.empty_computed_results': ['request_id', 'anomalies'],
} as const satisfies Record<string, readonly string[]>

export const RUN_SPINE_SCHEMA_VIOLATION_EVENT = 'ui.run_spine_schema_violation'

function emitScrubbed(
  event: keyof typeof RUN_SPINE_TRANSPORT_KEYS,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const declared = new Set<string>(RUN_SPINE_TRANSPORT_KEYS[event])
  const safe: Record<string, unknown> = {}
  const undeclared: string[] = []
  for (const [key, value] of Object.entries(payload)) {
    if (declared.has(key)) safe[key] = value
    else undeclared.push(key)
  }
  if (undeclared.length > 0) {
    trackEvent(RUN_SPINE_SCHEMA_VIOLATION_EVENT, { event, undeclared_keys: undeclared.sort() })
  }
  trackEvent(event, safe)
  return safe
}

// =============================================================================
// Track Functions
// =============================================================================

/**
 * Track run_started event
 */
export function trackRunStarted(payload: RunStartedPayload): void {
  // SSR/test guard - analytics requires browser context
  if (typeof window === 'undefined') return

  try {
    emitScrubbed('run_started', payload)

    // Dev logging
    if (import.meta.env.DEV) {
      console.log('[Instrumentation] run_started', payload)
    }
  } catch (e) {
    // Silent fail - analytics should never break app
  }
}

/**
 * Track run_completed event
 */
export function trackRunCompleted(payload: RunCompletedPayload): void {
  if (typeof window === 'undefined') return

  try {
    emitScrubbed('run_completed', payload)

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] run_completed', payload)
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track run_failed event
 */
export function trackRunFailed(payload: RunFailedPayload): void {
  if (typeof window === 'undefined') return

  try {
    // `error_message` is deliberately absent from the object handed to the
    // seam: the categorical replaces it, and the seam's allowlist would drop it
    // anyway. Both belts, because this is the property that actually leaked.
    const safe = emitScrubbed('run_failed', {
      error_code: payload.error_code,
      error_category: deriveErrorCategory(payload.error_code),
    })

    // Sentry: the IMPORTED channel (`window.Sentry` is never assigned by any
    // code in src/ and index.html loads no Sentry CDN snippet) — and it gets
    // the SCRUBBED object, not `payload`. Sentry is an ingest endpoint at a
    // third party exactly as PostHog is; the never-capture list does not stop
    // at one vendor.
    captureMessage(`Run failed: ${payload.error_code}`, {
      level: 'warning',
      extra: safe,
    })

    if (import.meta.env.DEV) {
      // DEV console only — never the wire. The full payload, message included,
      // is genuinely useful locally, and a developer's own console is not a
      // third-party ingest endpoint. The distinction is the whole point of the
      // seam above: what leaves the browser is `safe`, not `payload`.
      console.log('[Instrumentation] run_failed', payload)
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track plot.empty_computed_results anomaly.
 * When backend claims "computed" but results are actually empty.
 */
export function trackEmptyComputedResults(payload: {
  request_id?: string
  anomalies: Array<{
    field: string
    status: string
    message: string
  }>
}): void {
  if (typeof window === 'undefined') return

  try {
    // The anomaly MESSAGE is producer-authored prose that can embed a node or
    // option label. Only the field and the status band cross the wire.
    emitScrubbed('plot.empty_computed_results', {
      ...(payload.request_id ? { request_id: payload.request_id } : {}),
      anomalies: payload.anomalies.map((a) => ({ field: a.field, status: a.status })),
    })

    // Sentry: the IMPORTED channel — this is a backend bug we want to track.
    captureMessage('Backend returned computed status with empty results', {
      level: 'warning',
      extra: payload,
    })

    if (import.meta.env.DEV) {
      console.warn('[Instrumentation] plot.empty_computed_results', payload)
    }
  } catch (e) {
    // Silent fail
  }
}

// =============================================================================
// State Classification
// =============================================================================

export interface StateClassification {
  has_results: boolean
  confidence_level: 'high' | 'medium' | 'low' | null
  drivers_informative: boolean | null
  option_count: number
  can_compare: boolean
  is_degraded: boolean
  has_error: boolean
}

/**
 * Classify current state for debugging
 */
export function classifyState(input: {
  resultsStatus: string
  confidenceLevel?: string
  driversInformative?: boolean
  optionCount?: number
  canCompare?: boolean
  isDegraded?: boolean
  hasError?: boolean
}): StateClassification {
  return {
    has_results: input.resultsStatus === 'complete',
    confidence_level: (input.confidenceLevel as StateClassification['confidence_level']) ?? null,
    drivers_informative: input.driversInformative ?? null,
    option_count: input.optionCount ?? 0,
    can_compare: input.canCompare ?? false,
    is_degraded: input.isDegraded ?? false,
    has_error: input.hasError ?? false,
  }
}
