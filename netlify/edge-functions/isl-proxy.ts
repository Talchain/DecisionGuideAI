/**
 * ISL (Interactive Scenario Learning) Service Proxy Edge Function
 *
 * Injects Authorization Bearer header for authenticated ISL requests.
 * Required because Netlify redirects don't support request header injection.
 *
 * Environment Variables:
 * - ISL_API_KEY: API key for ISL service authentication
 *
 * SECURITY:
 * - Origin is a CORS control, NOT identity.
 * - The bound on this seam is the EXPLICIT UPSTREAM PATH ALLOWLIST added for
 *   disposition item 13: the ISL bearer is injected ONLY for a target on
 *   `ALLOWED_TARGETS` — SEVEN anchored literals, one per browser call site — and
 *   every off-list path is answered 404 and never reaches ISL.
 * - An explicit METHOD gate (`ALLOWED_METHODS`) enforces the same set it advertises;
 *   before it, an authenticated PUT/DELETE forwarded with the bearer.
 * - The bearer is read only AFTER both gates pass, so a rejected request never
 *   touches the credential.
 * See SECURITY.md for compliance requirements.
 */

import type { Config, Context } from '@netlify/edge-functions'

const ISL_TARGET = 'https://isl-staging.onrender.com'

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://decision-guide-ai.netlify.app',  // Netlify main
  'https://staging--olumi.netlify.app',     // Staging environment
  'http://localhost:5173',  // Dev only
  'http://localhost:4173',  // Preview builds
]

// Pattern for Netlify preview/branch deploys: deploy-preview-123--olumi.netlify.app, feature-xyz--olumi.netlify.app
const NETLIFY_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+--olumi\.netlify\.app$/

/**
 * Check if origin is allowed (exact match or Netlify preview pattern)
 */
function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true
  }
  // Allow Netlify preview/branch deploys
  return NETLIFY_PREVIEW_PATTERN.test(origin)
}

/**
 * Get CORS headers for allowed origins only.
 * Returns null if origin is not in allow-list.
 */
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  // SECURITY: Reject unknown origins explicitly (don't fallback)
  if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
    return null
  }

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    // Advertised == ENFORCED (see ALLOWED_METHODS). This previously advertised
    // PUT and DELETE, which nothing enforced and no call site uses.
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-correlation-id, x-api-key, X-Request-Id',
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

/**
 * SECURITY (item 13) — EXPLICIT UPSTREAM PATH ALLOWLIST.
 *
 * Matched against the target (prefix `/bff/isl` already stripped, query excluded)
 * BEFORE the ISL bearer is injected. Off-list ⇒ 404, no bearer forwarded.
 *
 * DERIVED from the UI's `/bff/isl/*` call sites at f2b48fc9 — `src/adapters/isl/client.ts`
 * (`/validate`, `/api/v1/robustness/analyze`, `/api/v1/causal/counterfactual/conformal`,
 * `/conformal`, `/compare`, `/explain/contrastive`) and `src/lib/service-health.ts`
 * (`/health`). Those SEVEN calls are the complete browser-reachable set.
 *
 * ⚠ THESE ARE ANCHORED LITERALS, NOT SUBTREE WILDCARDS, AND THAT IS THE WHOLE POINT.
 * The first version of this list used `/^\/api\/v1\/.+$/` and `/^\/explain\/.+$/`
 * "because the ISL route table was not authoritatively read". That reasoning was
 * wrong and the guard was hollow: `/bff/isl/api/v1/admin/secrets` and
 * `/bff/isl/explain/anything/at/all` both forwarded WITH the bearer — the wildcards
 * re-admitted the whole surface the allowlist exists to narrow, and the off-list
 * test picked the one shape (`/admin/secrets`) that happened to avoid them, so the
 * suite agreed with itself. The allowlist does not need ISL's route table: it bounds
 * what the UI CALLS, and that set is enumerated above.
 */
const ALLOWED_TARGETS: readonly RegExp[] = [
  /^\/health$/,
  /^\/validate$/,
  /^\/conformal$/,
  /^\/compare$/,
  /^\/explain\/contrastive$/,
  /^\/api\/v1\/robustness\/analyze$/,
  /^\/api\/v1\/causal\/counterfactual\/conformal$/,
]

/**
 * SECURITY (item 13, D2) — the verbs this seam forwards. GET/HEAD for `/health`,
 * POST for the six compute calls, OPTIONS for preflight.
 *
 * This function injects a bearer on every request it forwards, so an unrestricted
 * verb set handed an authenticated PUT/DELETE to ISL from anywhere the origin check
 * let through — the exact posture `cee-proxy.ts` documents as "the gap not to copy",
 * and it was real here (PUT and DELETE both forwarded with the bearer). ENFORCED
 * below and ADVERTISED verbatim in Access-Control-Allow-Methods: an allow-list that
 * advertises more than it enforces is a false guarantee.
 */
const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const

function isAllowedTarget(pathname: string): boolean {
  return ALLOWED_TARGETS.some((re) => re.test(pathname))
}

/**
 * Reject encoded traversal (`%2e` / `%2f` / `%5c`, case-insensitive) and any
 * literal `..` path segment, before the allowlist runs.
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

export default async function handler(request: Request, context: Context) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn('[ISL Proxy] Rejected request from unknown origin:', origin)
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

  // SECURITY (item 13, D2): refuse any verb outside the advertised set BEFORE the
  // bearer is injected. Without this, an authenticated PUT/DELETE reached ISL.
  if (!(ALLOWED_METHODS as readonly string[]).includes(request.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          Allow: ALLOWED_METHODS.join(', '),
        },
      }
    )
  }

  // Extract the path after /bff/isl/
  // e.g., /bff/isl/api/v1/analysis/robustness → /api/v1/analysis/robustness
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/isl/, '')
  const targetUrl = `${ISL_TARGET}${targetPath}${url.search}`

  // SECURITY (item 13): reject off-list / traversal paths BEFORE the bearer is
  // injected. Off-list ⇒ 404, NO credential forwarded.
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
  // allowlist (distinct from the upstream PATH allowlist checked just above)
  const ALLOWED_FORWARD_HEADERS = [
    'content-type',
    'accept',
    'x-correlation-id',
    'x-request-id',
  ]

  const headers = new Headers()

  // Only copy allowed headers from request
  for (const headerName of ALLOWED_FORWARD_HEADERS) {
    const value = request.headers.get(headerName)
    if (value) {
      headers.set(headerName, value)
    }
  }

  // Add API key for ISL authentication (both formats for compatibility).
  // Read only after the path guard has passed — a rejected request never touches
  // the credential.
  const apiKey = Deno.env.get('ISL_API_KEY')
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`)
    headers.set('x-api-key', apiKey)
  } else {
    console.warn('[ISL Proxy] ISL_API_KEY not set - requests may fail with 401')
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
    console.error('[ISL Proxy] Error:', error)
    return new Response(
      JSON.stringify({ error: 'ISL service unavailable', message: (error as Error).message }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/isl/*',
}
