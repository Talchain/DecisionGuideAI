// src/lib/flagFactory.ts
// Typed factory for creating feature flag functions with minimal duplication

export interface FlagConfig {
  envKey: string          // e.g., 'VITE_FEATURE_SSE'
  storageKey: string      // e.g., 'feature.sseStreaming'
  defaultValue?: boolean  // Default value when no env/storage override; defaults to false
}

/**
 * Creates a feature flag function that checks, in order:
 * 1. localStorage override (storageKey) – allows tests/dev to override env
 * 2. Environment variable (import.meta.env[envKey])
 * 3. Returns defaultValue (or false)
 *
 * All checks are wrapped in try-catch for safety.
 *
 * @example
 * ```ts
 * const isSseEnabled = makeFlag({
 *   envKey: 'VITE_FEATURE_SSE',
 *   storageKey: 'feature.sseStreaming'
 * })
 * ```
 */
export function makeFlag(config: FlagConfig): () => boolean {
  const { envKey, storageKey, defaultValue = false } = config

  return function checkFlag(): boolean {
    // 1. localStorage override (tests/dev)
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(storageKey)
        if (raw != null) {
          if (raw === '0' || raw === 'false') {
            return false
          }
          // Any other non-null value is treated as explicit ON
          return true
        }
      }
    } catch (_e) {
      // Silently fail if localStorage access throws
    }

    // 2. Environment variable
    try {
      if (envKey) {
        const env = (import.meta as any)?.env?.[envKey]
        if (env === '1' || env === 1 || env === true || env === 'true') {
          return true
        }
        if (env === '0' || env === 0 || env === false || env === 'false') {
          return false
        }
      }
    } catch (_e) {
      // Silently fail if env access throws
    }

    // 3. Return default
    return defaultValue
  }
}

/**
 * Batch create multiple flags from a config map.
 *
 * @example
 * ```ts
 * const flags = makeFlags({
 *   sse: { envKey: 'VITE_FEATURE_SSE', storageKey: 'feature.sseStreaming' },
 *   summaryV2: { envKey: 'VITE_FEATURE_SUMMARY_V2', storageKey: 'feature.summaryV2' }
 * })
 *
 * flags.sse() // => boolean
 * ```
 */
export function makeFlags<T extends Record<string, FlagConfig>>(
  configs: T
): { [K in keyof T]: () => boolean } {
  const flags = {} as { [K in keyof T]: () => boolean }

  for (const key in configs) {
    flags[key] = makeFlag(configs[key])
  }

  return flags
}
