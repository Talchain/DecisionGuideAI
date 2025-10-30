/**
 * Limits Manager - Singleton for dynamic API limits
 *
 * Hydrates limits from /v1/limits at boot, falls back to static V1_LIMITS.
 * Provides consistent interface for validators and UI components.
 *
 * Usage:
 * ```ts
 * import { limitsManager } from './limitsManager'
 *
 * // Get current limits (synchronous)
 * const limits = limitsManager.getLimits()
 * console.log(limits.nodes.max) // 200 (or dynamic value from API)
 *
 * // Refresh from API (async)
 * await limitsManager.refresh()
 * ```
 */

import * as v1http from './http'
import { V1_LIMITS } from './types'

/**
 * Limits structure matching /v1/limits API response
 */
export interface Limits {
  nodes: { max: number }
  edges: { max: number }
  label: { max: number }
  body: { max: number }
  rateLimit: { rpm: number }
}

/**
 * Singleton limits manager
 */
class LimitsManager {
  private limits: Limits
  private hydrated: boolean = false
  private hydrationPromise: Promise<void> | null = null

  constructor() {
    // Initialize with static fallback values
    this.limits = {
      nodes: { max: V1_LIMITS.MAX_NODES },
      edges: { max: V1_LIMITS.MAX_EDGES },
      label: { max: V1_LIMITS.MAX_LABEL_LENGTH },
      body: { max: V1_LIMITS.MAX_BODY_LENGTH },
      rateLimit: { rpm: V1_LIMITS.RATE_LIMIT_RPM },
    }
  }

  /**
   * Get current limits (synchronous)
   * Returns static fallback until hydrated from API
   */
  getLimits(): Limits {
    return { ...this.limits }
  }

  /**
   * Check if limits have been hydrated from API
   */
  isHydrated(): boolean {
    return this.hydrated
  }

  /**
   * Hydrate limits from /v1/limits API
   * Safe to call multiple times (reuses in-flight promise)
   */
  async hydrate(): Promise<void> {
    // Reuse in-flight hydration
    if (this.hydrationPromise) {
      return this.hydrationPromise
    }

    // Already hydrated - refresh
    if (this.hydrated) {
      return this.refresh()
    }

    this.hydrationPromise = this._fetchLimits()

    try {
      await this.hydrationPromise
      this.hydrated = true
    } finally {
      this.hydrationPromise = null
    }
  }

  /**
   * Refresh limits from API (force fetch)
   */
  async refresh(): Promise<void> {
    return this._fetchLimits()
  }

  /**
   * Internal fetch logic
   */
  private async _fetchLimits(): Promise<void> {
    try {
      const apiLimits = await v1http.limits()

      // Update singleton state
      this.limits = {
        nodes: { max: apiLimits.nodes.max },
        edges: { max: apiLimits.edges.max },
        // API doesn't return label/body/rateLimit yet - use static fallback
        label: { max: V1_LIMITS.MAX_LABEL_LENGTH },
        body: { max: V1_LIMITS.MAX_BODY_LENGTH },
        rateLimit: { rpm: V1_LIMITS.RATE_LIMIT_RPM },
      }

      if (import.meta.env.DEV) {
        console.log('[limitsManager] Hydrated from API:', this.limits)
      }
    } catch (err: any) {
      // Graceful degradation - keep static fallback
      if (import.meta.env.DEV) {
        console.warn('[limitsManager] Failed to fetch limits from API, using static fallback:', err)
      }
      // Don't throw - limits are already initialized with static values
    }
  }

  /**
   * Reset to static fallback (for testing)
   */
  reset(): void {
    this.limits = {
      nodes: { max: V1_LIMITS.MAX_NODES },
      edges: { max: V1_LIMITS.MAX_EDGES },
      label: { max: V1_LIMITS.MAX_LABEL_LENGTH },
      body: { max: V1_LIMITS.MAX_BODY_LENGTH },
      rateLimit: { rpm: V1_LIMITS.RATE_LIMIT_RPM },
    }
    this.hydrated = false
    this.hydrationPromise = null
  }
}

// Export singleton instance
export const limitsManager = new LimitsManager()

/**
 * Hydrate limits at boot (call from app entry point)
 * Non-blocking - uses static fallback until API responds
 */
export async function hydrateLimitsAtBoot(): Promise<void> {
  // Fire and forget - don't block app boot
  limitsManager.hydrate().catch(err => {
    if (import.meta.env.DEV) {
      console.warn('[hydrateLimitsAtBoot] Failed:', err)
    }
  })
}
