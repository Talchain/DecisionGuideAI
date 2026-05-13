/**
 * Dev-console diagnostics helper for the Analysis hero v17 feature flags.
 *
 * Split out of `comparisonFlagBoot.ts` (2026-05-13 P0 deploy-unblocker) so
 * the eager entry chunk no longer carries the `@/flags` dependency chain.
 * `main.tsx` dynamically imports this module inside a `requestIdleCallback`
 * (with a `setTimeout` fallback) after the initial render, so the helper is
 * available in browser devtools but does not contribute to first-paint
 * bundle size.
 *
 * Installs `window.__analysisHeroV17` as a non-enumerable property. Always
 * available (not just in DEV) so staging reviewers can self-diagnose by
 * typing `__analysisHeroV17` in browser devtools without rebuilds.
 */

import {
  isAnalysisHeroV17Enabled,
  isAnalysisHeroCompareEnabled,
} from '@/flags'

const V17_STORAGE_KEY = 'feature.analysisHeroV17'
const COMPARE_STORAGE_KEY = 'feature.analysisHeroCompare'

export function installAnalysisHeroV17DevHelper(): void {
  try {
    if (typeof window === 'undefined') return
    const helper = {
      get status() {
        return {
          analysisHeroV17: {
            enabled: isAnalysisHeroV17Enabled(),
            localStorage: readStorage(V17_STORAGE_KEY),
          },
          analysisHeroCompare: {
            enabled: isAnalysisHeroCompareEnabled(),
            localStorage: readStorage(COMPARE_STORAGE_KEY),
          },
        }
      },
      enable() {
        try { localStorage.setItem(V17_STORAGE_KEY, '1') } catch {}
        return helper.status
      },
      disable() {
        try { localStorage.setItem(V17_STORAGE_KEY, '0') } catch {}
        return helper.status
      },
      reset() {
        try {
          localStorage.removeItem(V17_STORAGE_KEY)
          localStorage.removeItem(COMPARE_STORAGE_KEY)
        } catch {}
        return helper.status
      },
      enableCompare() {
        try { localStorage.setItem(COMPARE_STORAGE_KEY, '1') } catch {}
        return helper.status
      },
      disableCompare() {
        try { localStorage.setItem(COMPARE_STORAGE_KEY, '0') } catch {}
        return helper.status
      },
    }
    // Attach to window for devtools access. Non-enumerable so it
    // doesn't clutter standard window inspection.
    Object.defineProperty(window, '__analysisHeroV17', {
      value: helper,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    // Silent — the helper is a convenience, not a load-bearing path.
  }
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
