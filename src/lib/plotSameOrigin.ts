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
 * Two env vars could still route around the proxy, both allow-listed and both
 * settable in the Netlify dashboard without touching this repo:
 *   · `VITE_CEE_DRAFT_BASE`   — measured SET to the absolute PLoT origin on staging
 *   · `VITE_PLOT_ENGINE_URL`  — overrides the /v2/run base if set
 *
 * Rather than depend on someone remembering to unset them (a hand-maintained mirror,
 * and the failure would be silent — a 401 on Draft My Model), this normalises an
 * absolute PLoT base to its same-origin equivalent at the point of use. Setting
 * either variable is then harmless: the path still ends at the proxy.
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
