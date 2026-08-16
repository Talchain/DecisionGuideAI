/**
 * plotSameOrigin — force every browser→PLoT base through the same-origin proxy.
 *
 * WHY THIS EXISTS
 * ---------------
 * The browser must hold NO PLoT credential. That is only achievable if every
 * browser→PLoT request is SAME-ORIGIN, because the `plot-proxy` edge function is
 * what injects the bearer, and an edge function can only inject on a path it serves.
 *
 * A cross-origin call to `https://plot-lite-service-staging.onrender.com/…` skips
 * the proxy entirely, so the only way to authenticate it is to put the credential in
 * the bundle. There is no third option: an authenticated cross-origin browser call
 * IS a published credential.
 *
 * ⚠ WHAT THIS HELPER IS *NOT* FOR — read this before pointing it at an env var.
 *
 * It was introduced to neutralise two dashboard-settable escape hatches
 * (`VITE_CEE_DRAFT_BASE`, `VITE_PLOT_ENGINE_URL`) by normalising whatever they held.
 * That was the wrong instrument for that job and both reads have since been DELETED
 * (see the call sites in `adapters/cee/client.ts` and `adapters/plot/v2/adapter.ts`).
 *
 * The reason is the scope note below, read as a security property rather than a
 * design nicety: this helper passes a NON-PLoT absolute base through UNTOUCHED, by
 * design. So wrapping an override in it bounds only the values that override was
 * measured to hold — point the variable at any other host and the call goes
 * off-origin, past the proxy, exactly as before. **Bounding an override is not the
 * same as not having one.** If you find yourself reaching for this function to make
 * an env-resolved base "safe", delete the read instead.
 *
 * What it IS for: normalising a base a CALLER supplies, so a PLoT-host base still
 * lands on the proxy path.
 *
 * SCOPE, STATED SO IT IS NOT OVER-READ: this rewrites ONLY bases whose host matches
 * the canonical PLoT host family. A non-PLoT absolute base is returned untouched —
 * this is not a general "make everything relative" helper, and it must not become
 * one, or it would silently redirect a genuinely external service through our proxy.
 */

/** The canonical PLoT deployment host family (plot-lite-service[-env].onrender.com). */
const PLOT_HOST = /^plot-lite-service(?:-[a-z0-9]+)*\.onrender\.com$/i

/** The same-origin path the `plot-proxy` edge function serves. */
export const PLOT_PROXY_PREFIX = '/bff/engine'

/**
 * Map an absolute PLoT base to its same-origin proxy path; pass everything else
 * through unchanged.
 *
 *   https://plot-lite-service-staging.onrender.com/v1/cee → /bff/engine/v1/cee
 *   https://plot-lite-service-staging.onrender.com        → /bff/engine
 *   /bff/engine/v1/cee                                    → /bff/engine/v1/cee
 *   https://example.test/api                              → https://example.test/api
 */
export function toSameOriginPlotBase(base: string): string {
  if (!/^https?:\/\//i.test(base)) return base
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return base
  }
  if (!PLOT_HOST.test(url.hostname)) return base
  // Drop the trailing slash so callers can append `/v1/…` without doubling it.
  const path = url.pathname.replace(/\/+$/, '')
  return `${PLOT_PROXY_PREFIX}${path}${url.search}`
}
