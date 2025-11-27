/**
 * Centralized Runtime Configuration (P1.5)
 *
 * This module centralizes all runtime environment configuration.
 * Benefits:
 * - Single source of truth for env vars
 * - Dev-only flags can be tree-shaken in prod
 * - Runtime toggles are documented
 * - Easier testing via mock overrides
 *
 * USAGE:
 * ```ts
 * import { config } from '@/lib/config'
 * if (config.isDev) { ... }
 * if (config.features.streaming) { ... }
 * ```
 */

// ============================================================================
// Environment Detection (tree-shakeable in prod)
// ============================================================================

/** True in development mode */
export const isDev = import.meta.env.DEV === true

/** True in production mode */
export const isProd = import.meta.env.PROD === true

/** Current mode ('development', 'production', 'test') */
export const mode = import.meta.env.MODE as 'development' | 'production' | 'test'

/** True during test runs */
export const isTest = mode === 'test'

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flags from environment variables
 * All flags default to false if not explicitly enabled
 */
export const features = {
  /** Enable streaming SSE mode for run requests */
  streaming: import.meta.env.VITE_FEATURE_PLOT_STREAM === '1',

  /** Enable verdict card UI feature */
  verdictCard: import.meta.env.VITE_SHOW_VERDICT_CARD === 'true',

  /** Enable edge function invites */
  edgeInvites: import.meta.env.VITE_USE_EDGE_INVITES === 'true',
} as const

// ============================================================================
// API Configuration
// ============================================================================

/**
 * Gateway base URL helper
 * Reads from localStorage override first, then env var
 * Returns empty string for relative URLs
 */
export function getGatewayBaseUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const fromLs = localStorage.getItem('cfg.gateway') || ''
      if (typeof fromLs === 'string' && fromLs.trim().length > 0) return fromLs.trim()
    }
  } catch {}
  // In test runs, Vitest/Vite may inject a default dev URL. Treat that as no override.
  try {
    const injected = import.meta.env.VITE_EDGE_GATEWAY_URL
    if (isTest && injected === 'http://127.0.0.1:4311') return ''
  } catch {}
  try {
    const env = import.meta.env.VITE_EDGE_GATEWAY_URL
    if (typeof env === 'string' && env.trim().length > 0) return env.trim()
  } catch {}
  // Empty means relative
  return ''
}

/** Plot engine proxy base URL */
export const plotProxyBase = import.meta.env.VITE_PLOT_PROXY_BASE || '/bff/engine'

// ============================================================================
// Observability Configuration
// ============================================================================

/**
 * Observability service configuration
 */
export const observability = {
  /** PostHog API key for analytics (empty = disabled) */
  postHogKey: import.meta.env.VITE_POSTHOG_API_KEY || '',

  /** Sentry DSN for error tracking (empty = disabled) */
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || '',

  /** Whether PostHog is configured */
  hasPostHog: Boolean(import.meta.env.VITE_POSTHOG_API_KEY),

  /** Whether Sentry is configured */
  hasSentry: Boolean(import.meta.env.VITE_SENTRY_DSN),
} as const

// ============================================================================
// Timeout Configuration
// ============================================================================

/**
 * Timeout values in milliseconds
 */
export const timeouts = {
  /** Sync request timeout */
  syncRequest: parseInt(import.meta.env.VITE_PLOT_SYNC_TIMEOUT_MS || '30000', 10),

  /** Stream request timeout (4x sync by default) */
  streamRequest: parseInt(import.meta.env.VITE_PLOT_STREAM_TIMEOUT_MS || '120000', 10),
} as const

// ============================================================================
// Debug Configuration (dev-only, tree-shaken in prod)
// ============================================================================

/**
 * Debug flags - these are dev-only and tree-shaken in production builds
 */
export const debug = {
  /** Enable verbose HTTP adapter logging */
  httpV1Adapter: isDev && import.meta.env.VITE_DEBUG_HTTPV1 === '1',

  /** Enable localStorage debug logging */
  logging: isDev && (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('debug.logging') === '1'
  ),
} as const

// ============================================================================
// Consolidated Config Object
// ============================================================================

/**
 * Consolidated runtime configuration
 * Import this for convenient access to all config values
 */
export const config = {
  isDev,
  isProd,
  isTest,
  mode,
  features,
  observability,
  timeouts,
  debug,
  getGatewayBaseUrl,
  plotProxyBase,
} as const

export default config
