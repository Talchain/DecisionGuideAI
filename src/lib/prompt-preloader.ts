/**
 * Prompt Cache Preloader
 *
 * Preloads LLM prompts from Supabase by calling POST /v1/prompts/warm.
 * This eliminates cold-start latency and ensures the correct prompts
 * are used for the first draft_graph request.
 *
 * The preload is fire-and-forget - silent failure is acceptable as
 * the server falls back to defaults.
 *
 * @example
 * ```typescript
 * import { preloadPrompts } from '@/lib/prompt-preloader'
 *
 * // At app init (fire and forget)
 * preloadPrompts()
 * ```
 */

// ⚠ THE BASE IS A LITERAL, AND THAT IS LOAD-BEARING (ROADMAP 2.710). This
// module is CREDENTIAL-LESS BY DESIGN: the `/bff/cee` Netlify edge seam
// injects `X-Olumi-Assist-Key` server-side. The house-style env-resolved
// form (`import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'`) shipped this
// exact call pointed at PLoT's bearer-authenticated origin (the dashboard
// sets the var; Vite inlines it at BUILD time), so every page load's warm-up
// 401'd — the fresh-journey audit's S5, wire-witnessed 2026-08-06. Guarded
// source-level by ceeSeamBinding.spec.ts; a runtime pin cannot see this
// defect class (both forms evaluate to the fallback under vitest).
const CEE_BASE_URL = '/bff/cee'

/** Whether preload has been successfully completed */
let preloadComplete = false

/** Promise for deduplicating concurrent calls */
let preloadPromise: Promise<void> | null = null

/** Preload timeout in milliseconds */
const PRELOAD_TIMEOUT_MS = 5000

/**
 * Preload prompts from the server cache.
 * Safe to call multiple times - deduplicates concurrent calls and
 * skips if already successfully completed.
 *
 * @returns Promise that resolves when preload completes (success or failure)
 */
export function preloadPrompts(): Promise<void> {
  // Already successfully preloaded
  if (preloadComplete) {
    return Promise.resolve()
  }

  // Return existing promise if preload is in progress (deduplication)
  if (preloadPromise) {
    return preloadPromise
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PRELOAD_TIMEOUT_MS)

  preloadPromise = fetch(`${CEE_BASE_URL}/prompts/warm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeoutId)

      if (response.ok) {
        preloadComplete = true
        if (import.meta.env.DEV) {
          console.log('[prompt-preloader] Prompts preloaded successfully')
        }
      } else if (import.meta.env.DEV) {
        // 503 = store unhealthy (server uses defaults) - acceptable
        // Log other errors for debugging
        console.warn('[prompt-preloader] Preload returned:', response.status)
      }
    })
    .catch((error) => {
      clearTimeout(timeoutId)
      // Silent failure - server handles gracefully with defaults
      if (import.meta.env.DEV) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.warn(`[prompt-preloader] Preload timed out after ${PRELOAD_TIMEOUT_MS}ms`)
        } else {
          console.warn('[prompt-preloader] Preload failed:', error)
        }
      }
    })
    .finally(() => {
      preloadPromise = null
    })

  return preloadPromise
}

/**
 * Check if prompts have been successfully preloaded.
 *
 * @returns true if preload completed successfully
 */
export function isPromptCachePreloaded(): boolean {
  return preloadComplete
}

/**
 * Reset the preload state (for testing purposes only).
 * @internal
 */
export function _resetPromptPreloader(): void {
  preloadComplete = false
  preloadPromise = null
}
