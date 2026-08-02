/**
 * CEE (Assistants) Service Proxy Edge Function — ROADMAP 2.317
 *
 * Serves the `/bff/cee/*` seam by proxying to CEE staging and injecting the
 * caller-auth header. Sibling of `orchestrator-proxy.ts` (which owns
 * `/bff/orchestrate/*`) and `isl-proxy.ts` (which owns `/bff/isl/*`).
 *
 * WHY AN EDGE FUNCTION AND NOT A REDIRECT — the defect this fixes.
 * `/bff/cee/*` used to be declared ONLY in `netlify.toml` `[[redirects]]`.
 * Netlify processes `public/_redirects` BEFORE `netlify.toml` redirects, and
 * `_redirects` ends in the SPA catch-all `/*  /index.html  200`. The catch-all
 * therefore won every time: `GET /bff/cee/health` returned HTTP 200
 * `text/html` — the SPA index — and never reached CEE at all. The netlify.toml
 * rules were unreachable on every deploy context, and both of them pointed at
 * `olumi-assistants-service.onrender.com` (a different, older build than CEE
 * staging), so even had they been reachable they would have hit the wrong host.
 *
 * Moving the rule into `_redirects` above the catch-all is NOT an option: the
 * rule exists to inject `X-Olumi-Assist-Key`, and `_redirects` cannot inject
 * request headers — the key would have to be a literal in a file the browser
 * can fetch. An edge function keeps the key server-side in the Netlify edge
 * runtime, and an edge function bound to a path runs BEFORE the `_redirects`
 * catch-all. That precedence is not assumed: `/bff/isl/*` and
 * `/bff/orchestrate/*` are declared ONLY as edge functions, and both answer
 * with their own JSON on the live staging host while `/bff/cee/*` answered
 * with SPA HTML — the same-host three-way control that established the
 * mechanism.
 *
 * TARGET HOST. `https://cee-staging.onrender.com`, matching
 * `orchestrator-proxy.ts`. Verified live: its `/healthz` reports build
 * `7f57602`, which is the exact tip of olumi-assistants-service `staging`,
 * and `prompt_environment: "staging"`. Hardcoded rather than env-selected, to
 * match the established sibling proxies and to add no new environment gate.
 *
 * PATH REWRITE. `/bff/cee/<x>` → `/assist/v1/<x>`. CEE mounts its assist
 * surface under `/assist/v1`. Three independent in-repo sources agree on the
 * prefix: the netlify.toml rule this function replaces, the `vite.config.ts`
 * dev proxy ("CEE service expects /assist/v1 prefix"), and the cross-repo note
 * in `src/canvas/hooks/useGraphReadiness.ts` citing CEE's own source at a
 * pinned SHA. It could NOT be confirmed by unauthenticated probing: CEE's auth
 * middleware runs before routing, so a bogus path returns 401 exactly like a
 * real one — 401 here proves auth-ordering, not registration.
 *
 * Environment Variables:
 * - ASSIST_API_KEY: caller-auth key for CEE (X-Olumi-Assist-Key header).
 *   Already provisioned in the Netlify dashboard and already read by
 *   `orchestrator-proxy.ts`. This function introduces NO new secret and makes
 *   no new decision about where a secret lives.
 *
 * SECURITY:
 * - Uses explicit origin allow-list (no wildcard CORS)
 * - The API key is never returned to the client and never enters the bundle
 * See SECURITY.md for compliance requirements.
 *
 * ── COMPLETE DIVERGENCE SET FROM THE SIBLING PROXIES ────────────────────────
 * This function is a clone of `orchestrator-proxy.ts` and differs from it in
 * exactly two ways. Both are deliberate; neither is an accident of copying.
 *
 * 1. MISSING `Origin` IS ALLOWED (the siblings reject it). See the comment at
 *    the origin check below. `Origin` was never an auth control here: these
 *    functions carry no ambient credential (no cookies are forwarded, and
 *    `Access-Control-Allow-Credentials` is never set), and browsers omit the
 *    header on same-origin GET/HEAD — which is precisely the shape
 *    `service-health.ts` sends. The siblings' rejection is the defect, and it
 *    is why `GET /bff/isl/health` 403s the app's own health check.
 *
 * 2. METHOD SET IS `GET/HEAD/POST/OPTIONS` (orchestrator-proxy is POST-only;
 *    isl-proxy restricts nothing at all). This seam needs GET for
 *    `/health` and POST for `graph-readiness` / `prompts/warm` / `ask`, so
 *    neither sibling's rule fits. What must NOT happen is isl-proxy's posture:
 *    forwarding every verb while carrying an injected credential. The enforced
 *    set below and the advertised `Access-Control-Allow-Methods` are kept
 *    identical on purpose — an allow-list that advertises less than it enforces
 *    is a false guarantee, which is the defect class this whole change is about.
 */

import type { Config, Context } from '@netlify/edge-functions'

const CEE_TARGET = 'https://cee-staging.onrender.com'

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://app.olumi.app',
  'https://decision-guide-ai.netlify.app',  // Netlify main
  'https://staging--olumi.netlify.app',     // Staging environment
  'http://localhost:5173',  // Dev only
  'http://localhost:4173',  // Preview builds
]

// Pattern for Netlify preview/branch deploys
const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--olumi\.netlify\.app$/

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true
  }
  return NETLIFY_PREVIEW_PATTERN.test(origin)
}

/**
 * The verbs this seam forwards. GET/HEAD for `/health`, POST for
 * `graph-readiness` / `prompts/warm` / `ask`, OPTIONS for preflight.
 * ENFORCED below and ADVERTISED verbatim in Access-Control-Allow-Methods —
 * the two must not drift apart.
 */
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const

function getCorsHeaders(requestOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-correlation-id, x-request-id, x-user-id',
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

export default async function handler(request: Request, _context: Context) {
  const origin = request.headers.get('origin')

  // SECURITY: an origin that is PRESENT and not on the allow-list is a
  // cross-origin caller we do not serve — reject it.
  //
  // A MISSING origin is a different case and must NOT be rejected. Per the
  // Fetch spec the browser omits `Origin` on same-origin GET/HEAD, and this
  // seam is same-origin by construction (`/bff/cee/*` on the app's own host).
  // `src/lib/service-health.ts` issues exactly such a request — GET
  // `${CEE_BASE_URL}/health` — so rejecting a missing origin would 403 the
  // app's own health check. Rejecting it buys no security either: CORS governs
  // cross-origin READS, and any non-browser client can set any Origin it likes.
  //
  // NOTE — `isl-proxy.ts` and `orchestrator-proxy.ts` DO reject a missing
  // origin, which is why `GET /bff/isl/health` answers 403 to the app's own
  // same-origin health check. That is a pre-existing defect in those two
  // functions, out of scope here and flagged for separate repair; this
  // function deliberately does not copy it.
  if (origin !== null && !isOriginAllowed(origin)) {
    console.warn('[CEE Proxy] Rejected request from unknown origin:', origin)
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // CORS headers are only meaningful when an origin was supplied.
  const corsHeaders = origin === null ? null : getCorsHeaders(origin)

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders ?? {} })
  }

  // SECURITY: refuse any verb outside the advertised set. This function injects
  // a caller-auth credential on every request it forwards, so an unrestricted
  // verb set would hand an authenticated PUT/DELETE/PATCH to CEE from anywhere
  // the origin check lets through. `orchestrator-proxy.ts` guards this (POST
  // only); `isl-proxy.ts` does not, and that gap is the one not to copy.
  if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...(corsHeaders ?? {}),
          'Content-Type': 'application/json',
          Allow: ALLOWED_METHODS.join(', '),
        },
      }
    )
  }

  // Extract the path after /bff/cee/
  // e.g. /bff/cee/graph-readiness → /assist/v1/graph-readiness
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/cee/, '/assist/v1')
  const targetUrl = `${CEE_TARGET}${targetPath}${url.search}`

  // SECURITY: Build headers from scratch with explicit allowlist.
  // 'authorization' carries the user's Supabase access token (same rationale
  // as orchestrator-proxy.ts: CEE's flag-gated JWT half verifies identity from
  // it). It is the USER token; the caller-auth X-Olumi-Assist-Key is injected
  // separately below and never collides.
  const ALLOWED_FORWARD_HEADERS = [
    'content-type',
    'accept',
    'authorization',
    'x-correlation-id',
    'x-request-id',
    'x-user-id',
  ]

  const headers = new Headers()

  for (const headerName of ALLOWED_FORWARD_HEADERS) {
    const value = request.headers.get(headerName)
    if (value) {
      headers.set(headerName, value)
    }
  }

  // Inject caller-auth header — the same key orchestrator-proxy.ts uses.
  const assistKey = Deno.env.get('ASSIST_API_KEY')
  if (assistKey) {
    headers.set('X-Olumi-Assist-Key', assistKey)
  } else {
    console.warn('[CEE Proxy] ASSIST_API_KEY not set - requests may fail with 401')
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // @ts-ignore - duplex is required for streaming bodies
      duplex: 'half',
    })

    // Return response with validated CORS headers
    const responseHeaders = new Headers(response.headers)
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value)
      })
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[CEE Proxy] Error:', error)
    // SECURITY: Do not leak internal error details to client
    const isTimeout = (error as Error).name === 'AbortError' ||
      (error as Error).message?.includes('timed out')
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'CEE request timed out. Please try again.'
          : 'CEE service unavailable. Please try again.',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { ...(corsHeaders ?? {}), 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/cee/*',
}
