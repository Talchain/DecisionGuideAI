/**
 * P0.8 — Instrumentation for Results Panel: the run-lifecycle spine.
 *
 * Events emitted here:
 * - run_started: User clicks Run
 * - run_completed: Results received
 * - run_failed: Error returned
 * - compare_opened: Compare tab/view opened
 * - retry_clicked: Retry button clicked
 * - remediation_clicked: Remediation action clicked
 * - cta_clicked: A results CTA was pressed
 * - plot.empty_computed_results: backend claimed "computed", results were empty
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
  error_code: string
  error_message?: string
}

export type RemediationClickedPayload = {
  code: string
  source: 'drivers' | 'actions' | 'next_steps'
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
    trackEvent('run_started', payload)

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
    trackEvent('run_completed', payload)

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
    trackEvent('run_failed', payload)

    // Sentry: the IMPORTED channel. `window.Sentry` is never assigned by any
    // code in src/ and index.html loads no Sentry CDN snippet.
    captureMessage(`Run failed: ${payload.error_code}`, {
      level: 'warning',
      extra: payload,
    })

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] run_failed', payload)
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track compare_opened event
 */
export function trackCompareOpened(): void {
  if (typeof window === 'undefined') return

  try {
    trackEvent('compare_opened')

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] compare_opened')
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track retry_clicked event
 */
export function trackRetryClicked(): void {
  if (typeof window === 'undefined') return

  try {
    trackEvent('retry_clicked')

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] retry_clicked')
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track remediation_clicked event
 */
export function trackRemediationClicked(payload: RemediationClickedPayload): void {
  if (typeof window === 'undefined') return

  try {
    trackEvent('remediation_clicked', payload)

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] remediation_clicked', payload)
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Track CTA button clicked
 */
export function trackCTAClicked(ctaType: string): void {
  if (typeof window === 'undefined') return

  try {
    trackEvent('cta_clicked', { cta_type: ctaType })

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] cta_clicked', { cta_type: ctaType })
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
    trackEvent('plot.empty_computed_results', payload)

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
