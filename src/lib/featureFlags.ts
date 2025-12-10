/**
 * Feature Flags Module
 *
 * Centralised feature flag management for the application.
 * Encapsulates all flag sources (env, window, URL params) in one place.
 *
 * Usage:
 * ```ts
 * import { featureFlags } from '@/lib/featureFlags'
 *
 * if (featureFlags.isE2EEnabled()) {
 *   // E2E testing mode
 * }
 * ```
 */

type FlagValue = boolean | string | number | undefined

interface FeatureFlags {
  /** E2E testing mode - skips certain checks, enables test helpers */
  isE2EEnabled: () => boolean
  /** Development mode */
  isDevelopment: () => boolean
  /** Production mode */
  isProduction: () => boolean
  /** Debug logging enabled */
  isDebugEnabled: () => boolean
  /** CEE BFF base URL */
  getCeeBffBase: () => string
  /** PLoT Engine base URL */
  getPlotEngineBase: () => string
  /** PostHog analytics enabled */
  isAnalyticsEnabled: () => boolean
  /** Sentry error tracking enabled */
  isSentryEnabled: () => boolean
  /** Get any flag by key (from URL, window, or env) */
  get: (key: string) => FlagValue
  /** Check if a flag is truthy */
  isEnabled: (key: string) => boolean
}

/**
 * Parse URL search params for feature flags
 * Supports: ?flag=true, ?flag=1, ?flag (presence = true)
 */
function getUrlFlag(key: string): FlagValue {
  if (typeof window === 'undefined') return undefined

  const params = new URLSearchParams(window.location.search)
  const value = params.get(key)

  if (value === null) {
    // Check if key is present without value (e.g., ?debug)
    return params.has(key) ? true : undefined
  }

  // Parse common truthy/falsy values
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false

  return value
}

/**
 * Get flag from window object (set by scripts or extensions)
 */
function getWindowFlag(key: string): FlagValue {
  if (typeof window === 'undefined') return undefined

  // Check window.__FEATURE_FLAGS__ object
  const flags = (window as any).__FEATURE_FLAGS__
  if (flags && key in flags) {
    return flags[key]
  }

  // Check direct window property
  const windowKey = `__${key.toUpperCase()}__`
  if (windowKey in window) {
    return (window as any)[windowKey]
  }

  return undefined
}

/**
 * Get flag from environment variables
 */
function getEnvFlag(key: string): FlagValue {
  // Vite env vars
  const viteKey = `VITE_${key.toUpperCase()}`
  const importMeta = import.meta as any

  if (importMeta?.env?.[viteKey] !== undefined) {
    const value = importMeta.env[viteKey]
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    return value
  }

  // Check NODE_ENV special case
  if (key === 'NODE_ENV' || key === 'mode') {
    return importMeta?.env?.MODE
  }

  return undefined
}

/**
 * Get flag value from all sources (URL > window > env)
 * URL params have highest priority for easy testing overrides
 */
function getFlag(key: string): FlagValue {
  // Priority: URL > window > env
  const urlValue = getUrlFlag(key)
  if (urlValue !== undefined) return urlValue

  const windowValue = getWindowFlag(key)
  if (windowValue !== undefined) return windowValue

  return getEnvFlag(key)
}

/**
 * Check if a flag is truthy
 */
function isEnabled(key: string): boolean {
  const value = getFlag(key)
  return value === true || value === 'true' || value === '1'
}

/**
 * Feature flags singleton
 */
export const featureFlags: FeatureFlags = {
  isE2EEnabled: () => {
    // Check multiple sources for E2E mode
    return (
      isEnabled('E2E') ||
      isEnabled('e2e') ||
      isEnabled('PLAYWRIGHT') ||
      getFlag('NODE_ENV') === 'test'
    )
  },

  isDevelopment: () => {
    const mode = getFlag('NODE_ENV') || getFlag('mode')
    return mode === 'development'
  },

  isProduction: () => {
    const mode = getFlag('NODE_ENV') || getFlag('mode')
    return mode === 'production'
  },

  isDebugEnabled: () => {
    // Debug enabled in dev or explicitly via flag
    return isEnabled('DEBUG') || featureFlags.isDevelopment()
  },

  getCeeBffBase: () => {
    return (getFlag('CEE_BFF_BASE') as string) || '/bff/cee'
  },

  getPlotEngineBase: () => {
    return (
      (getFlag('PLOT_ENGINE_BASE') as string) ||
      (getFlag('PLOT_PROXY_URL') as string) ||
      '/api/plot'
    )
  },

  isAnalyticsEnabled: () => {
    // Disable in E2E and dev, enable in prod unless explicitly disabled
    if (featureFlags.isE2EEnabled()) return false
    if (isEnabled('DISABLE_ANALYTICS')) return false
    return featureFlags.isProduction() || isEnabled('ANALYTICS')
  },

  isSentryEnabled: () => {
    // Similar to analytics
    if (featureFlags.isE2EEnabled()) return false
    if (isEnabled('DISABLE_SENTRY')) return false
    return featureFlags.isProduction() || isEnabled('SENTRY')
  },

  get: getFlag,
  isEnabled,
}

// Export individual functions for convenience
export const {
  isE2EEnabled,
  isDevelopment,
  isProduction,
  isDebugEnabled,
  getCeeBffBase,
  getPlotEngineBase,
  isAnalyticsEnabled,
  isSentryEnabled,
} = featureFlags

// Type augmentation for window
declare global {
  interface Window {
    __FEATURE_FLAGS__?: Record<string, FlagValue>
  }
}
