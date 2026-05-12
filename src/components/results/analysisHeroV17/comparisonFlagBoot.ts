/**
 * URL-param boot for the Analysis hero v17 comparison flag.
 *
 * Detects `?analysisHeroCompare=1` (or `=0` to clear) once at app start,
 * persists to localStorage via the standard flag-factory storage key, then
 * components read via `isAnalysisHeroCompareEnabled()` like any other flag.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 9. No per-render
 * URL parsing — the parse runs once at boot.
 */

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
}
