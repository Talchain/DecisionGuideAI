/**
 * Debug-panel visibility gate — extracted from DebugPanel.tsx.
 *
 * P1 fold (external review 2026-07-14): `<LazyDebugPanel/>` was mounted
 * UNCONDITIONALLY in ReactFlowGraph, so React.lazy fetched the ~250 KB
 * DebugPanel / DebugPanelV2 chunk for EVERY canvas visitor — even without
 * `?diag`. The `?diag` decision lived inside the downloaded module, so it could
 * not gate the download. This tiny EAGER module (no heavy imports — only React,
 * which is always loaded) holds the decision so ReactFlowGraph can gate the
 * MOUNT and the chunk is fetched only when diagnostics are actually requested.
 */
import { useEffect, useState } from 'react'

/**
 * Whether the debug panel should be shown: staging/dev env AND (a `?diag` URL
 * param — regular or HashRouter — OR the `window.__OLUMI_DEBUG` console flag).
 */
export function shouldShowDebugPanel(): boolean {
  // Only in staging or development environment
  const env = import.meta.env?.VITE_APP_ENV || 'development'
  const allowedEnvs = ['staging', 'development']
  if (!allowedEnvs.includes(env)) return false

  // URL parameter — handle both regular and HashRouter URLs.
  // Accepts ?diag (bare param) or ?diag=1.
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.has('diag')) return true

  // HashRouter query params (e.g. #/canvas?diag or #/canvas?diag=1)
  const hashParts = window.location.hash.split('?')
  if (hashParts.length > 1) {
    const hashParams = new URLSearchParams(hashParts[1])
    if (hashParams.has('diag')) return true
  }

  // Global flag (console: window.__OLUMI_DEBUG = true)
  if (window.__OLUMI_DEBUG === true) return true

  return false
}

/**
 * Reactive gate for the LazyDebugPanel MOUNT. Mirrors the panel's own
 * mount + popstate re-check (so navigating to `?diag` reveals it), but lives in
 * this eager module so the heavy chunk is only imported when this returns true.
 */
export function useShouldShowDebugPanel(): boolean {
  const [show, setShow] = useState(shouldShowDebugPanel)
  useEffect(() => {
    const check = () => setShow(shouldShowDebugPanel())
    window.addEventListener('popstate', check)
    return () => window.removeEventListener('popstate', check)
  }, [])
  return show
}
