/**
 * PLoT (plot-lite-service) Proxy Edge Function — the credential boundary.
 *
 * WHAT THIS REPLACES, AND WHY A REDIRECT COULD NOT DO IT
 * ------------------------------------------------------
 * `/bff/engine/*` was a plain 200-rewrite (`public/_redirects`, mirrored by a dead
 * twin in `netlify.toml`). A rewrite cannot inject a request header, so PLoT's auth
 * flip was survived by shipping the Bearer to the BROWSER instead —
 * `VITE_PLOT_BEARER`, read by `src/lib/plotAuthHeaders.ts`, inlined by Vite as a
 * bare literal into a public asset:
 *
 *     function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
 *
 * That is a live server-to-server credential readable by anyone who loads the site.
 * This function is the boundary that lets it be deleted: the browser now calls the
 * same-origin `/bff/engine/*` path with NO credential of its own, and the token is
 * attached here, server-side, where a bundle reader cannot reach it.
 *
 * ENVIRONMENT
 * -----------
 * - `PLOT_AUTH_TOKEN` — PLoT's bearer. Set in the Netlify dashboard (Site
 *   configuration → Environment variables), NOT in any file in this repo, and
 *   deliberately NOT `VITE_`-prefixed: a `VITE_` prefix is a publication
 *   instruction to Vite, which is exactly how the original exposure happened.
 *
 * INERT UNTIL PROVISIONED, AND LOUD ABOUT IT. With no `PLOT_AUTH_TOKEN` set this
 * function forwards the request unauthenticated; PLoT answers 401 with an explicit
 * `X-Plot-Proxy-Credential: absent` response header and a warning in the function
 * log. It never invents, defaults, or embeds a credential value.
 *
 * SECURITY
 * --------
 * - Headers are built from scratch against an explicit forward allow-list. An
 *   inbound `Authorization` is NEVER forwarded: the browser has no business
 *   supplying one here, and forwarding it would let a caller override the injected
 *   service credential.
 * - Explicit CORS origin allow-list, mirroring `isl-proxy.ts`. Same-origin browser
 *   calls send no `Origin`, so a missing origin is allowed; a PRESENT but unknown
 *   origin is rejected.
 */

import type { Config, Context } from '@netlify/edge-functions'

const PLOT_TARGET = 'https://plot-lite-service-staging.onrender.com'

/** Path prefixes this function serves, longest first so `/bff/engine` wins over `/engine`. */
const MOUNTS = ['/bff/engine', '/engine']

// SECURITY: CORS allow-list (never a wildcard). Mirrors isl-proxy.ts.
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://decision-guide-ai.netlify.app',
  'https://staging--olumi.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--olumi\.netlify\.app$/

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return NETLIFY_PREVIEW_PATTERN.test(origin)
}

/**
 * CORS headers, or null to REJECT.
 *
 * A same-origin fetch sends no `Origin` header at all, and every seam this function
 * serves is same-origin by construction — so `null` origin is the NORMAL case and
 * must be allowed (returning `{}`, i.e. no CORS headers, which same-origin does not
 * need). Only a PRESENT-but-unrecognised origin is a rejection. isl-proxy rejects a
 * missing origin because its callers are cross-origin; copying that here would have
 * 403'd every ordinary request.
 */
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  if (requestOrigin === null) return {}
  if (!isOriginAllowed(requestOrigin)) return null
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, x-correlation-id, x-request-id, x-idempotency-key, Accept',
    Vary: 'Origin, Access-Control-Request-Headers',
  }
}

/**
 * Request headers forwarded upstream. An explicit allow-list, built from scratch.
 *
 * `authorization` is DELIBERATELY ABSENT and must stay absent — see the header note.
 */
const ALLOWED_FORWARD_HEADERS = [
  'content-type',
  'accept',
  'accept-encoding',
  'cache-control',
  'x-correlation-id',
  'x-request-id',
  'x-idempotency-key',
  'last-event-id', // SSE resume for /v1/stream
]

/** Strip whichever mount prefix this request arrived on. */
export function targetPathFor(pathname: string): string {
  for (const mount of MOUNTS) {
    if (pathname === mount) return ''
    if (pathname.startsWith(`${mount}/`)) return pathname.slice(mount.length)
  }
  return pathname
}

export default async function handler(request: Request, _context: Context) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (corsHeaders === null) {
    console.warn('[PLoT Proxy] Rejected request from unknown origin:', origin)
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const targetUrl = `${PLOT_TARGET}${targetPathFor(url.pathname)}${url.search}`

  const headers = new Headers()
  for (const name of ALLOWED_FORWARD_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  // ── THE INJECTION ──────────────────────────────────────────────────────────
  const token = Deno.env.get('PLOT_AUTH_TOKEN')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    console.warn(
      '[PLoT Proxy] PLOT_AUTH_TOKEN is not set — forwarding UNAUTHENTICATED. ' +
        'Auth-gated PLoT routes will answer 401 until it is provisioned in the Netlify dashboard.',
    )
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // @ts-ignore - duplex is required for streaming request bodies
      duplex: 'half',
    })

    const responseHeaders = new Headers(response.headers)
    for (const [key, value] of Object.entries(corsHeaders)) responseHeaders.set(key, value)
    // Make the provisioning state observable without exposing anything.
    responseHeaders.set('X-Plot-Proxy-Credential', token ? 'injected' : 'absent')

    // `response.body` is passed straight through, so an SSE stream (/v1/stream)
    // keeps streaming rather than being buffered here.
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[PLoT Proxy] Error:', error)
    return new Response(
      JSON.stringify({ error: 'PLoT service unavailable', message: (error as Error).message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
}

export const config: Config = {
  path: ['/bff/engine/*', '/engine/*'],
}
