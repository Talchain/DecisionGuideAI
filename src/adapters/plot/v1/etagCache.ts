/**
 * ETag Cache Manager for Templates API
 *
 * Provides conditional request support for GET /v1/templates
 * using ETag headers to avoid redundant data transfers.
 *
 * Features:
 * - In-memory cache with 5-minute TTL
 * - localStorage persistence (survives page reloads)
 * - Automatic hydration on startup
 *
 * RFC 7232: https://tools.ietf.org/html/rfc7232
 */

interface CacheEntry<T> {
  etag: string
  data: T
  timestamp: number
}

const STORAGE_KEY = 'plot-etag-cache'
const STORAGE_VERSION = 1

class ETagCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.hydrateFromStorage()
  }

  /**
   * Load cache from localStorage on startup
   */
  private hydrateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const parsed = JSON.parse(stored)
      if (parsed.version !== STORAGE_VERSION) {
        // Clear old version
        localStorage.removeItem(STORAGE_KEY)
        return
      }

      // Restore entries that haven't expired
      const now = Date.now()
      for (const [key, entry] of Object.entries(parsed.entries || {})) {
        const cacheEntry = entry as CacheEntry<any>
        const age = now - cacheEntry.timestamp
        if (age < this.MAX_AGE_MS) {
          this.cache.set(key, cacheEntry)
        }
      }

      if (import.meta.env.DEV) {
        console.log(`[etagCache] Hydrated ${this.cache.size} entries from localStorage`)
      }
    } catch (err) {
      console.error('[etagCache] Failed to hydrate from localStorage:', err)
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /**
   * Persist cache to localStorage
   */
  private persistToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return

    try {
      const entries: Record<string, CacheEntry<any>> = {}
      this.cache.forEach((value, key) => {
        entries[key] = value
      })

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        entries,
      }))
    } catch (err) {
      // Quota exceeded or other storage error
      console.warn('[etagCache] Failed to persist to localStorage:', err)
    }
  }

  /**
   * Get cached data and ETag for a resource
   */
  get<T>(key: string): { data: T; etag: string } | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    const age = Date.now() - entry.timestamp
    if (age > this.MAX_AGE_MS) {
      this.cache.delete(key)
      return null
    }

    return {
      data: entry.data,
      etag: entry.etag,
    }
  }

  /**
   * Store data with ETag
   */
  set<T>(key: string, data: T, etag: string): void {
    this.cache.set(key, {
      etag,
      data,
      timestamp: Date.now(),
    })
    this.persistToStorage()
  }

  /**
   * Get just the ETag (for If-None-Match header)
   */
  getETag(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    const age = Date.now() - entry.timestamp
    if (age > this.MAX_AGE_MS) {
      this.cache.delete(key)
      this.persistToStorage()
      return null
    }

    return entry.etag
  }

  /**
   * Update timestamp (when 304 Not Modified received)
   */
  touch(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      entry.timestamp = Date.now()
      this.persistToStorage()
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear()
    this.persistToStorage()
  }

  /**
   * Clear specific key
   *
   * IMPORTANT: Call this when templates are mutated to prevent stale data.
   * Example: After creating/updating/deleting a template, call:
   *   etagCache.invalidate('templates-list')
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    this.persistToStorage()
  }
}

// Singleton instance
export const etagCache = new ETagCache()

/**
 * Helper: Invalidate templates cache after mutations
 * Call this after any operation that modifies templates
 */
export function invalidateTemplatesCache(): void {
  etagCache.invalidate('templates-list')
}
