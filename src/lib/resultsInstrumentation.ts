/**
 * P0.8 — Instrumentation for Results Panel
 *
 * Events to track during pilot:
 * - run_started: User clicks Run
 * - run_completed: Results received
 * - run_failed: Error returned
 * - compare_opened: Compare tab/view opened
 * - retry_clicked: Retry button clicked
 * - remediation_clicked: Remediation action clicked
 */

// =============================================================================
// Types
// =============================================================================

export interface RunStartedPayload {
  option_count: number
  node_count?: number
  edge_count?: number
}

export interface RunCompletedPayload {
  confidence_level: 'high' | 'medium' | 'low'
  drivers_informative: boolean
  trace_id?: string
  duration_ms?: number
}

export interface RunFailedPayload {
  error_code: string
  error_message?: string
}

export interface RemediationClickedPayload {
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
    // Check for analytics provider (PostHog, etc.)
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('run_started', payload)
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('run_completed', payload)
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('run_failed', payload)
    }

    // Also log to Sentry if available
    const Sentry = (window as any).Sentry
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(`Run failed: ${payload.error_code}`, {
        level: 'warning',
        extra: payload,
      })
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('compare_opened')
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('retry_clicked')
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('remediation_clicked', payload)
    }

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
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('cta_clicked', { cta_type: ctaType })
    }

    if (import.meta.env.DEV) {
      console.log('[Instrumentation] cta_clicked', { cta_type: ctaType })
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
