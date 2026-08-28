/**
 * Orchestrator Service Proxy Edge Function
 *
 * Proxies /bff/orchestrate/* requests to the CEE staging backend,
 * handling CORS on the Netlify side. This resolves the CORS preflight
 * failure on the /orchestrate/v1/turn endpoint — the CEE backend does
 * not have CORS middleware on the orchestrator routes.
 *
 * Environment Variables:
 * - ASSIST_API_KEY: API key for CEE service authentication (X-Olumi-Assist-Key header)
 *
 * SSE STREAMING:
 * This proxy supports SSE streaming responses (e.g. /orchestrate/v1/turn/stream).
 * The `duplex: 'half'` option on fetch and direct `response.body` passthrough
 * ensure chunked transfer encoding is preserved without buffering.
 * Verified 2026-03-13 — no additional configuration needed.
 *
 * SECURITY:
 * - Origin is a CORS control, NOT identity — a non-browser client can set any
 *   Origin it likes, so origin-gating is not the security boundary here.
 * - The boundary is the EXPLICIT UPSTREAM PATH ALLOWLIST added for disposition
 *   item 13: the caller-auth key is injected ONLY for a rewritten `/orchestrate/*`
 *   target on `ALLOWED_TARGETS` (the three turn routes: turn, turn/stream,
 *   turn/stop). Every off-list path is answered 404 and never reaches CEE.
 * - Enforces POST-only and an explicit forwarded-HEADER allowlist.
 * See SECURITY.md for compliance requirements.
 */

import type { Config, Context } from '@netlify/edge-functions'

const CEE_TARGET = 'https://cee-staging.onrender.com'

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
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

function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
    return null
  }

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-correlation-id, x-request-id, x-user-id',
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

/**
 * SECURITY (item 13) — EXPLICIT UPSTREAM PATH ALLOWLIST.
 *
 * Matched against the REWRITTEN `/orchestrate/*` target (query stripped) BEFORE the
 * caller-auth key is injected. Off-list ⇒ 404, no key forwarded.
 *
 * ── RETIRED / EMPTIED 2026-08-28 — ANONYMOUS SCENARIO-OWNERSHIP TAKEOVER ────────
 * This proxy injects `ASSIST_API_KEY` for any allowed-Origin visitor, so a
 * JWT-less browser request reached CEE `/orchestrate/v2/turn{,/stop}` as a
 * key-authed `service_legacy` caller. On that path CEE takes scenario ownership
 * from the caller-supplied BODY `user_id`
 * (`route-v2-preflight.ts::authorizeScenarioOwnership`:
 * `effectiveUserId = claimedUserId` whenever `identity.mode !== 'verified'`), so
 * an anonymous caller who supplied a victim's `user_id` could act on the victim's
 * OWNED scenario. WITNESSED at the wire 2026-08-28 against
 * `https://staging--olumi.netlify.app/bff/orchestrate/v2/turn`: the anonymous
 * exploit turn returned HTTP 200 on a scenario owned by another user, while the
 * discriminating control (same request, a different `user_id`) was refused 422
 * `scenario_owned_by_other_user`. (By contrast the `/proxy/v5/turn*` and all
 * `/assist/v1/scenarios/*` rungs already refuse caller-asserted identity.)
 *
 * The allowlist is emptied rather than the mount removed because the fix must
 * hold regardless of how this function is mounted — it is bound BOTH by
 * `netlify.toml` AND by the inline `export const config` below. With the list
 * empty, `isAllowedTarget` is false for every path, so this function forwards
 * NOTHING and injects the key NOWHERE: it degrades to a CORS/404 responder.
 *
 * The live product does not use this seam. The V5 turn path posts to the
 * baked-absolute `https://cee-staging.onrender.com/proxy/v5/turn`; the only
 * `/bff/orchestrate/*` caller is the dead V4 block in `useConversation.ts`,
 * reachable ONLY when `VITE_ENABLE_V5_ORCHESTRATOR !== 'true'` — and staging
 * bakes it `'true'`.
 *
 * ⚠ DO NOT RE-POPULATE without first making identity un-spoofable on this seam
 * (verified-JWT only, no body-`user_id` ownership). `bffProxyPathAllowlist.spec.ts`
 * asserts these routes now 404 with NO key, so a re-add fails that guard loudly.
 */
const ALLOWED_TARGETS: readonly RegExp[] = []

function isAllowedTarget(pathname: string): boolean {
  return ALLOWED_TARGETS.some((re) => re.test(pathname))
}

/**
 * Reject encoded traversal (`%2e` / `%2f` / `%5c`, case-insensitive) and any
 * literal `..` path segment before the allowlist runs — closing the
 * `/bff/orchestrate/%2e%2e/assist/v1/*` escape hypothesis by construction,
 * independent of how the edge runtime normalises `request.url`.
 *
 * ⚠ SCOPED TO THE PATHNAME, NEVER THE WHOLE URL. Scanning `request.url` also scanned
 * the QUERY STRING, so an on-list route 404'd whenever a parameter happened to carry
 * an encoded slash — `encodeURIComponent` emits `%2F` for any value containing one
 * (a URL, base64). The query cannot change the upstream route, so excluding it is
 * strictly safer as well as correct.
 */
function isTraversal(rawPathname: string, targetPath: string): boolean {
  if (/%2e|%2f|%5c/i.test(rawPathname)) return true
  return targetPath.split('/').some((segment) => segment === '..')
}

export default async function handler(request: Request, _context: Context) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn('[Orchestrator Proxy] Rejected request from unknown origin:', origin)
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Only accept POST for orchestrator turns
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Extract the path after /bff/orchestrate/
  // e.g., /bff/orchestrate/v1/turn → /orchestrate/v1/turn
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/orchestrate/, '/orchestrate')
  const targetUrl = `${CEE_TARGET}${targetPath}${url.search}`

  // SECURITY (item 13): reject anything outside the turn family BEFORE the key is
  // injected. Off-list or traversal ⇒ 404, NO credential forwarded.
  if (isTraversal(url.pathname, targetPath) || !isAllowedTarget(targetPath)) {
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  // SECURITY: Build the forwarded-header set from scratch with an explicit HEADER
  // allowlist (distinct from the upstream PATH allowlist checked just above).
  // 'authorization' carries the user's Supabase access token (login 3.4 —
  // LOGIN-CEE-HALF-SPEC item 4: the DGAI edge function passes the user
  // token through so CEE's flag-gated JWT half can verify identity). It is
  // the USER token; the caller-auth X-Olumi-Assist-Key is injected
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

  // Inject auth header — same key as legacy /bff/cee/* redirects use
  const assistKey = Deno.env.get('ASSIST_API_KEY')
  if (assistKey) {
    headers.set('X-Olumi-Assist-Key', assistKey)
  } else {
    console.warn('[Orchestrator Proxy] ASSIST_API_KEY not set - requests may fail with 401')
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - duplex is required for streaming bodies
      duplex: 'half',
    })

    // Return response with validated CORS headers
    const responseHeaders = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[Orchestrator Proxy] Error:', error)
    // SECURITY: Do not leak internal error details to client
    const isTimeout = (error as Error).name === 'AbortError' ||
      (error as Error).message?.includes('timed out')
    return new Response(
      JSON.stringify({
        error: isTimeout
          ? 'Orchestrator request timed out. Please try again.'
          : 'Orchestrator service unavailable. Please try again.',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/orchestrate/*',
}
