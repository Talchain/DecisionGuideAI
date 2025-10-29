/**
 * ETag Cache Manager for Templates API
 *
 * Provides conditional request support for GET /v1/templates
 * using ETag headers to avoid redundant data transfers.
 *
 * RFC 7232: https://tools.ietf.org/html/rfc7232
 */

interface CacheEntry<T> {
  etag: string
  data: T
  timestamp: number
}

class ETagCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

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
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear()
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
