// src/lib/flagFactory.ts
// Typed factory for creating feature flag functions with minimal duplication

import { FLAG_ENV } from './flagEnv'

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
// Eagerly snapshot the declared flag env vars at module load time. Vite's dev
// mode may not resolve dynamic property access (`env[key]`) inside closures
// reliably — the `(import.meta as any)` cast can strip Vite's HMR proxy. Each
// entry in FLAG_ENV is a LITERAL `import.meta.env?.VITE_X` read, so Vite performs
// its compile-time replacement correctly. Subsequent lookups via
// `envSnapshot[key]` are plain JS property access on a real object, exactly as
// before.
//
// ⚠ THIS WAS `{ ...import.meta.env }` AND MUST NOT GO BACK.
// Vite cannot statically narrow a spread, so it inlined the ENTIRE env object —
// every `VITE_*` the deploy defines, WITH ITS VALUE — into the flags chunk. That
// is how a bundle reader got 100+ variables, including credentials the flags
// system has no relationship to, out of one asset. FLAG_ENV is GENERATED from
// `src/flags.ts` + `netlify.toml` (`pnpm run generate:flag-env`) so the key set is
// derived rather than hand-listed, and `pnpm run ci:guard:flag-env` reds if it
// drifts — a missing key would make that flag silently resolve to its
// defaultValue.
//
// Behaviour is unchanged: an unset key reads `undefined` here where it was
// previously ABSENT, and every consumer below treats those identically.
let envSnapshot: Record<string, unknown> = {}
try {
  envSnapshot = FLAG_ENV
} catch {
  // SSR or test environment where import.meta.env is unavailable
}

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

    // 2. Environment variable (from eagerly-captured snapshot)
    try {
      if (envKey) {
        const env = envSnapshot[envKey]
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
 * Returns diagnostic info about how a flag resolved — useful for debugging
 * staging issues where localStorage overrides may mask the env var.
 */
export function diagnoseFlagState(config: FlagConfig): {
  resolved: boolean
  source: 'localStorage' | 'env' | 'default'
  localStorageRaw: string | null
  envRaw: unknown
} {
  const { envKey, storageKey, defaultValue = false } = config

  let localStorageRaw: string | null = null
  try {
    if (typeof localStorage !== 'undefined') {
      localStorageRaw = localStorage.getItem(storageKey)
    }
  } catch { /* noop */ }

  const envRaw = envSnapshot[envKey] ?? null

  // Mirror the resolution logic from makeFlag
  if (localStorageRaw != null) {
    const resolved = localStorageRaw !== '0' && localStorageRaw !== 'false'
    return { resolved, source: 'localStorage', localStorageRaw, envRaw }
  }

  if (envKey && envRaw != null) {
    if (envRaw === '1' || envRaw === 1 || envRaw === true || envRaw === 'true') {
      return { resolved: true, source: 'env', localStorageRaw, envRaw }
    }
    if (envRaw === '0' || envRaw === 0 || envRaw === false || envRaw === 'false') {
      return { resolved: false, source: 'env', localStorageRaw, envRaw }
    }
  }

  return { resolved: defaultValue, source: 'default', localStorageRaw, envRaw }
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
