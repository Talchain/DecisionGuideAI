/**
 * URL-param boot for the Analysis hero v17 comparison flag.
 *
 * Detects `?analysisHeroCompare=1` (or `=0` to clear) once at app start,
 * persists to localStorage via the standard flag-factory storage key, then
 * components read via `isAnalysisHeroCompareEnabled()` like any other flag.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 9. No per-render
 * URL parsing — the parse runs once at boot.
 *
 * This module also installs `window.__analysisHeroV17` as a dev-console
 * diagnostics helper. Type it in browser devtools to see flag state and
 * toggle helpers ("Why is my hero not showing?" diagnostics).
 */

import {
  isAnalysisHeroV17Enabled,
  isAnalysisHeroCompareEnabled,
} from '@/flags'

const V17_STORAGE_KEY = 'feature.analysisHeroV17'
const COMPARE_STORAGE_KEY = 'feature.analysisHeroCompare'

export function bootAnalysisHeroCompareFromUrl(): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('analysisHeroCompare')
    if (raw === '1') {
      localStorage.setItem(COMPARE_STORAGE_KEY, '1')
    } else if (raw === '0') {
      localStorage.setItem(COMPARE_STORAGE_KEY, '0')
    }
    // Other values (missing, malformed) are ignored — leaves any prior
    // localStorage / env-var state untouched.
  } catch {
    // SSR, tests, restricted localStorage — silently skip.
  }

  // Install a dev-console diagnostics helper. Always available (not just
  // in DEV) so staging reviewers can self-diagnose by typing
  // `__analysisHeroV17` in browser devtools without rebuilds.
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
