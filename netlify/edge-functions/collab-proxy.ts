/**
 * COLLAB proxy edge function — serves `/bff/collab/*` → CEE `/collab/v1/*`.
 *
 * Fourth sibling of `cee-proxy.ts` / `orchestrator-proxy.ts` / `isl-proxy.ts`.
 *
 * ── WHY A FOURTH SEAM RATHER THAN REUSING `/bff/cee/*` ────────────────────
 * `/bff/cee/*` rewrites to `/assist/v1/*`, `/bff/orchestrate/*` rewrites to
 * `/orchestrate/*`, and the direct `VITE_V5_ENDPOINT` seam is pinned to the
 * `/proxy/v5/turn` family. NONE of them maps to `/collab/v1/*`, so the collab
 * routes were registered and unreachable — the "green in every test, dark for
 * every user" shape.
 *
 * The alternative was aliasing every collab route under `/assist/v1/collab/*`
 * to ride the existing seam. This is strictly better: it adds NO second CEE
 * surface to reason about, NO CEE CORS entry, NO CSP change and NO Render
 * dashboard dependency — and it keeps one entrance to what is a privacy
 * boundary.
 *
 * ── THE ONE THING THIS FUNCTION DOES THAT ITS SIBLINGS DO NOT ─────────────
 * It forwards `x-collab-participant-token`. The siblings' forward allowlists do
 * not carry it, so a participant request through any of them arrives at CEE
 * token-less and 401s — every time, invisibly, with both repos' suites green.
 *
 * ── AUTH, AND WHAT ORIGIN IS NOT ──────────────────────────────────────────
 * This function injects `X-Olumi-Assist-Key` (CALLER auth) exactly as its
 * siblings do. It does NOT authenticate the person: CEE's collab routes do that
 * themselves, from the participant token or the owner's verified Supabase JWT.
 * `Origin` is a CORS control and is not treated as identity anywhere in this
 * chain — a forged Origin reaches CEE's own checks and still has to hold a real
 * token.
 *
 * A MISSING `Origin` is allowed, matching `cee-proxy.ts`: browsers omit it on
 * same-origin GET/HEAD, and `/bff/collab/*` is same-origin by construction.
 * Rejecting it would 403 the packet page's own first fetch.
 */

import type { Config, Context } from '@netlify/edge-functions'

const CEE_TARGET = 'https://cee-staging.onrender.com'

// SECURITY: CORS allow-list (never a wildcard). Identical to cee-proxy.ts.
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://decision-guide-ai.netlify.app',
  'https://staging--olumi.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--olumi\.netlify\.app$/

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || NETLIFY_PREVIEW_PATTERN.test(origin)
}

/**
 * GET for the packet and the reveal; POST for mint, close and contributions.
 * ENFORCED below and ADVERTISED verbatim — an allow-list that advertises more
 * than it enforces (or less) is a false guarantee.
 */
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const

/**
 * ⭐ THE PARTICIPANT CAPABILITY HEADER. Without this entry the whole feature is
 * dark: the token is stripped at the edge and CEE refuses every request.
 * `tests/ci-guards/collab-proxy-token-forwarding.spec.ts` binds this list to the
 * advertised CORS header so the two cannot drift apart.
 */
const COLLAB_TOKEN_HEADER = 'x-collab-participant-token'

const ALLOWED_FORWARD_HEADERS = [
  'content-type',
  'accept',
  // The OWNER's Supabase access token (mint / close / preview / reveal).
  'authorization',
  'x-correlation-id',
  'x-request-id',
  'x-user-id',
  COLLAB_TOKEN_HEADER,
]

function getCorsHeaders(requestOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    // Kept in step with ALLOWED_FORWARD_HEADERS by the CI guard. Not strictly
    // load-bearing today (same-origin fetches with a custom header do not
    // preflight), which is exactly why it would rot unnoticed without the guard.
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-correlation-id, x-request-id, x-user-id, x-collab-participant-token',
    Vary: 'Origin, Access-Control-Request-Headers',
  }
}

export default async function handler(request: Request, _context: Context) {
  const origin = request.headers.get('origin')

  if (origin !== null && !isOriginAllowed(origin)) {
    // NOTE: no token, no path and no round id in this log line.
    console.warn('[Collab Proxy] Rejected request from unknown origin:', origin)
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const corsHeaders = origin === null ? null : getCorsHeaders(origin)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders ?? {} })
  }

  if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...(corsHeaders ?? {}),
        'Content-Type': 'application/json',
        Allow: ALLOWED_METHODS.join(', '),
      },
    })
  }

  // /bff/collab/packet/<id> → /collab/v1/packet/<id>
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/collab/, '/collab/v1')
  const targetUrl = `${CEE_TARGET}${targetPath}${url.search}`

  const headers = new Headers()
  for (const headerName of ALLOWED_FORWARD_HEADERS) {
    const value = request.headers.get(headerName)
    if (value) headers.set(headerName, value)
  }

  const assistKey = Deno.env.get('ASSIST_API_KEY')
  if (assistKey) {
    headers.set('X-Olumi-Assist-Key', assistKey)
  } else {
    console.warn('[Collab Proxy] ASSIST_API_KEY not set - requests will fail with 401')
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // @ts-ignore - duplex is required for streaming bodies
      duplex: 'half',
    })

    const responseHeaders = new Headers(response.headers)
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value))
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    // SECURITY: never leak internal detail — and never the token.
    console.error('[Collab Proxy] Upstream error:', (error as Error).name)
    const isTimeout =
      (error as Error).name === 'AbortError' || (error as Error).message?.includes('timed out')
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'That took too long. Please try again.'
          : 'The panel service is unavailable. Please try again.',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { ...(corsHeaders ?? {}), 'Content-Type': 'application/json' },
      },
    )
  }
}

export const config: Config = {
  path: '/bff/collab/*',
}
