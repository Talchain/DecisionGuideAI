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

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  hitRate: number
}

const STORAGE_KEY = 'plot-etag-cache'
const STORAGE_VERSION = 1

class ETagCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes
  private persistenceFailed = false // Back off if quota exceeded

  // Telemetry counters
  private hits = 0
  private misses = 0
  private evictions = 0

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
    if (this.persistenceFailed) return // Back off if quota exceeded

    try {
      const entries: Record<string, CacheEntry<any>> = {}
      this.cache.forEach((value, key) => {
        entries[key] = value
      })

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        entries,
      }))

      // Success - reset failure flag if it was previously set
      this.persistenceFailed = false
    } catch (err: any) {
      // Quota exceeded or other storage error
      // Check if this is a quota error specifically
      if (err.name === 'QuotaExceededError' || err.code === 22) {
        console.warn('[etagCache] localStorage quota exceeded - falling back to in-memory only cache')
        this.persistenceFailed = true // Don't spam console on subsequent saves
      } else {
        console.warn('[etagCache] Failed to persist to localStorage:', err)
      }
    }
  }

  /**
   * Get cached data and ETag for a resource
   */
  get<T>(key: string): { data: T; etag: string } | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return null
    }

    // Check if expired
    const age = Date.now() - entry.timestamp
    if (age > this.MAX_AGE_MS) {
      this.cache.delete(key)
      this.evictions++
      this.misses++
      return null
    }

    this.hits++
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
      this.hits++ // 304 responses are cache hits
    }
  }

  /**
   * Get cache statistics for telemetry
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0

    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimals
    }
  }

  /**
   * Reset telemetry counters
   */
  resetStats(): void {
    this.hits = 0
    this.misses = 0
    this.evictions = 0
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

/**
 * Get cache telemetry stats
 * Useful for monitoring cache effectiveness and debugging
 */
export function getCacheStats(): CacheStats {
  return etagCache.getStats()
}

/**
 * Reset cache telemetry counters
 * Useful for testing or starting fresh metrics
 */
export function resetCacheStats(): void {
  etagCache.resetStats()
}
