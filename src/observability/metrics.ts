/**
 * Observability & Metrics
 *
 * Thin wrapper around PostHog + Sentry for client-side analytics and error tracking.
 *
 * **Privacy**: No PII. Event names are closed-set. Properties limited to safe metadata
 * (run_id hash prefix, template_id, feature flags, error codes).
 *
 * **Environment**:
 * - DEV: Console logging only
 * - STAGING/PROD: PostHog + Sentry (if API keys configured)
 */

// Event types (closed set)
export type MetricEvent =
  // Run lifecycle
  | 'run_started'
  | 'run_completed'
  | 'run_cancelled'
  | 'run_failed'

  // Streaming
  | 'stream_started'
  | 'stream_progress'
  | 'stream_interim'
  | 'stream_completed'
  | 'stream_timeout'
  | 'stream_reconnecting'
  | 'stream_reconnected'

  // Errors
  | 'rate_limited'
  | 'network_error'
  | 'validation_error'
  | 'server_error'

  // UI interactions
  | 'palette_opened'
  | 'palette_action'
  | 'compare_opened'
  | 'inspector_opened'
  | 'template_loaded'
  | 'snapshot_saved'
  | 'export_triggered'
  | 'import_triggered'
  | 'share_link_created'

  // Onboarding
  | 'tour_started'
  | 'tour_completed'
  | 'tour_skipped'

/**
 * Safe metadata for events (no PII)
 */
export interface MetricProperties {
  // Run context
  run_id_prefix?: string // First 8 chars of response_hash only
  template_id?: string
  seed?: number
  elapsed_ms?: number

  // Feature flags
  feature_streaming?: boolean
  feature_palette?: boolean

  // Error context
  error_code?: string
  retry_attempt?: number
  retry_after_seconds?: number

  // UI context
  action_id?: string
  panel_name?: string

  // Performance
  duration_ms?: number

  // Custom (avoid if possible)
  [key: string]: string | number | boolean | undefined
}

/**
 * Check if observability is enabled
 */
function isEnabled(): boolean {
  // Always disabled in test environments
  if (import.meta.env.MODE === 'test') return false

  // Dev: console only
  if (import.meta.env.DEV) return true

  // Staging/Prod: require API keys
  const hasPostHog = Boolean(import.meta.env.VITE_POSTHOG_API_KEY)
  const hasSentry = Boolean(import.meta.env.VITE_SENTRY_DSN)

  return hasPostHog || hasSentry
}

/**
 * Track an event
 */
export function track(event: MetricEvent, properties?: MetricProperties): void {
  if (!isEnabled()) return

  try {
    // DEV: Console logging
    if (import.meta.env.DEV) {
      console.debug('[METRICS]', event, properties)
      return
    }

    // PostHog (if configured)
    if (typeof window !== 'undefined' && 'posthog' in window) {
      const posthog = (window as any).posthog
      posthog?.capture(event, properties)
    }

    // Sentry breadcrumb (if configured)
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      const Sentry = (window as any).Sentry
      Sentry?.addBreadcrumb({
        category: 'metrics',
        message: event,
        data: properties,
        level: 'info'
      })
    }
  } catch (error) {
    // Never throw - metrics are best-effort
    console.warn('[METRICS] Failed to track event:', error)
  }
}

/**
 * Track an error (sends to Sentry if configured)
 */
export function trackError(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, any>
    level?: 'fatal' | 'error' | 'warning' | 'info'
  }
): void {
  if (!isEnabled()) return

  try {
    // DEV: Console logging
    if (import.meta.env.DEV) {
      console.error('[METRICS ERROR]', error, context)
      return
    }

    // Sentry (if configured)
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      const Sentry = (window as any).Sentry
      if (error instanceof Error) {
        Sentry?.captureException(error, {
          tags: context?.tags,
          extra: context?.extra,
          level: context?.level || 'error'
        })
      } else {
        Sentry?.captureMessage(String(error), {
          tags: context?.tags,
          extra: context?.extra,
          level: context?.level || 'error'
        })
      }
    }
  } catch (err) {
    console.warn('[METRICS] Failed to track error:', err)
  }
}

/**
 * Set user properties (for PostHog - never send PII)
 */
export function identify(properties: {
  user_id_hash?: string // Hashed user ID only
  feature_flags?: Record<string, boolean>
  environment?: string
}): void {
  if (!isEnabled()) return

  try {
    if (import.meta.env.DEV) {
      console.debug('[METRICS IDENTIFY]', properties)
      return
    }

    // PostHog
    if (typeof window !== 'undefined' && 'posthog' in window) {
      const posthog = (window as any).posthog
      posthog?.identify(properties.user_id_hash, properties)
    }

    // Sentry user context
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      const Sentry = (window as any).Sentry
      Sentry?.setUser({
        id: properties.user_id_hash,
        ...properties
      })
    }
  } catch (error) {
    console.warn('[METRICS] Failed to identify user:', error)
  }
}

/**
 * Performance timing helper
 */
export function startTiming(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}

/**
 * Helper: Create safe run_id prefix (first 8 chars only)
 */
export function safeRunIdPrefix(hash: string | undefined): string | undefined {
  return hash?.slice(0, 8)
}

/**
 * Helper: Track run lifecycle
 */
export const runMetrics = {
  started: (templateId?: string, seed?: number) => {
    track('run_started', {
      template_id: templateId,
      seed,
      feature_streaming: import.meta.env.VITE_FEATURE_PLOT_STREAM === '1'
    })
  },

  completed: (runId: string | undefined, elapsedMs: number) => {
    track('run_completed', {
      run_id_prefix: safeRunIdPrefix(runId),
      elapsed_ms: elapsedMs
    })
  },

  cancelled: (reason?: string) => {
    track('run_cancelled', {
      error_code: reason
    })
  },

  failed: (errorCode: string, retryAfter?: number) => {
    track('run_failed', {
      error_code: errorCode,
      retry_after_seconds: retryAfter
    })
  }
}

/**
 * Helper: Track streaming lifecycle
 */
export const streamMetrics = {
  started: (runId: string | undefined) => {
    track('stream_started', {
      run_id_prefix: safeRunIdPrefix(runId)
    })
  },

  progress: (percent: number) => {
    // Only track milestones (25%, 50%, 75%) to avoid spam
    if (percent === 25 || percent === 50 || percent === 75) {
      track('stream_progress', { duration_ms: percent })
    }
  },

  interim: (findingsCount: number) => {
    track('stream_interim', { duration_ms: findingsCount })
  },

  completed: (runId: string | undefined, elapsedMs: number) => {
    track('stream_completed', {
      run_id_prefix: safeRunIdPrefix(runId),
      elapsed_ms: elapsedMs
    })
  },

  timeout: () => {
    track('stream_timeout')
  },

  reconnecting: (attempt: number) => {
    track('stream_reconnecting', { retry_attempt: attempt })
  },

  reconnected: (attempt: number) => {
    track('stream_reconnected', { retry_attempt: attempt })
  }
}

/**
 * Helper: Track UI interactions
 */
export const uiMetrics = {
  paletteOpened: () => track('palette_opened'),

  paletteAction: (actionId: string) => {
    track('palette_action', { action_id: actionId })
  },

  compareOpened: () => track('compare_opened'),

  inspectorOpened: () => track('inspector_opened'),

  templateLoaded: (templateId: string) => {
    track('template_loaded', { template_id: templateId })
  },

  snapshotSaved: () => track('snapshot_saved'),

  exportTriggered: () => track('export_triggered'),

  importTriggered: () => track('import_triggered'),

  shareLinkCreated: () => track('share_link_created')
}

/**
 * Helper: Track errors by category
 */
export const errorMetrics = {
  rateLimited: (retryAfter?: number) => {
    track('rate_limited', { retry_after_seconds: retryAfter })
  },

  networkError: (attempt?: number) => {
    track('network_error', { retry_attempt: attempt })
  },

  validationError: (field?: string) => {
    track('validation_error', { error_code: field })
  },

  serverError: (code?: string) => {
    track('server_error', { error_code: code })
  }
}
