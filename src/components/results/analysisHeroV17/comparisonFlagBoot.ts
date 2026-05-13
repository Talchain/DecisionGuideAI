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
 * The dev-console `window.__analysisHeroV17` diagnostics helper has been
 * split into a separate module (`comparisonFlagDevHelper.ts`) loaded lazily
 * from `main.tsx` after `createRoot`. This keeps the entry chunk free of
 * the `@/flags` dependency chain — the URL-parse path runs synchronously
 * before the first render (so `StreamFlagsProvider`'s `useState` initialiser
 * sees the post-URL localStorage state), while the dev helper, which is
 * only needed in browser devtools and not on the first paint, defers until
 * after the user's content has rendered.
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
