/**
 * Version Cache Utility
 *
 * Fetches and caches the client build version from /version.json.
 * Used to populate the `x-olumi-client-build` header on BFF requests.
 *
 * The version is fetched once at app initialization and cached in memory.
 * If fetch fails, falls back to 'unknown'.
 *
 * @example
 * ```typescript
 * import { getClientBuild, initVersionCache } from '@/lib/version-cache'
 *
 * // At app init
 * await initVersionCache()
 *
 * // In request headers
 * const build = getClientBuild() // "ad0df38" or "unknown"
 * ```
 */

/**
 * Shape of /version.json produced by build
 */
export interface VersionInfo {
  /** Full git commit SHA (40 chars) */
  commit: string
  /** Short git commit SHA (7 chars) */
  short: string
  /** Git branch name */
  branch: string
  /** Build timestamp (ISO 8601) */
  timestamp: string
}

/** Cached version info */
let cachedVersion: VersionInfo | null = null

/** Whether init has been successfully completed */
let initComplete = false

/** Whether init is currently in progress (prevents concurrent fetches) */
let initInProgress = false

/** Max retry attempts for transient failures */
const MAX_RETRIES = 2

/**
 * Initialize the version cache by fetching /version.json.
 * Safe to call multiple times — only fetches once successfully.
 * Will retry on transient failures up to MAX_RETRIES times.
 *
 * @returns Promise that resolves when cache is ready (or fails after retries)
 */
export async function initVersionCache(): Promise<void> {
  // Already successfully initialized
  if (initComplete) {
    return
  }

  // Prevent concurrent initialization attempts
  if (initInProgress) {
    return
  }
  initInProgress = true

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/version.json', {
        cache: 'force-cache', // Use browser cache if available
      })

      if (!response.ok) {
        console.warn('[version-cache] Failed to fetch /version.json:', response.status)
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          break
        }
        continue
      }

      const data = await response.json()

      // Validate shape
      if (typeof data.short === 'string' && data.short.length > 0) {
        cachedVersion = data as VersionInfo
        initComplete = true // Only mark complete on success
        if (import.meta.env.DEV) {
          console.log('[version-cache] Loaded:', cachedVersion.short)
        }
        break
      } else {
        console.warn('[version-cache] Invalid version.json shape:', data)
        break // Invalid shape won't improve with retries
      }
    } catch (error) {
      // Network error — may be transient, allow retry
      if (attempt < MAX_RETRIES) {
        console.warn(`[version-cache] Retry ${attempt + 1}/${MAX_RETRIES}:`, error)
        // Small delay before retry
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      } else {
        console.warn('[version-cache] Failed to load version after retries:', error)
      }
    }
  }

  initInProgress = false
}

/**
 * Get the short git SHA for use in request headers.
 *
 * @returns 7-character git SHA or 'unknown' if not loaded
 */
export function getClientBuild(): string {
  return cachedVersion?.short ?? 'unknown'
}

/**
 * Get the full version info if available.
 *
 * @returns Full version info or null if not loaded
 */
export function getVersionInfo(): VersionInfo | null {
  return cachedVersion
}

/**
 * Check if version cache has been successfully initialized.
 *
 * @returns true if version was successfully loaded
 */
export function isVersionCacheInitialized(): boolean {
  return initComplete
}

/**
 * Reset the cache (for testing purposes only).
 * @internal
 */
export function _resetVersionCache(): void {
  cachedVersion = null
  initComplete = false
  initInProgress = false
}
