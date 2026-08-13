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
 *   `ALLOWED_TARGETS`; every off-list path is answered 404 and never reaches ISL.
 *   ⚠ ISL's authoritative route table was NOT read for this change, so the compute
 *   subtrees (`/api/v1/*`, `/explain/*`) are matched PERMISSIVELY on purpose — a
 *   false 404 on a real compute call would break the product, and correctness of
 *   the live product outranks tightness here. This still rejects root-level
 *   admin/debug/metrics routes, which is the meaningful bound. Tighten once the
 *   ISL route table is enumerated (flagged in the PR).
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-correlation-id, x-api-key, X-Request-Id',
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

/**
 * SECURITY (item 13) — EXPLICIT UPSTREAM PATH ALLOWLIST.
 *
 * Matched against the target (prefix `/bff/isl` already stripped, query stripped)
 * BEFORE the ISL bearer is injected. Off-list ⇒ 404, no bearer forwarded. DERIVED
 * from the UI's `/bff/isl/*` call sites at f2b48fc9: `src/adapters/isl/client.ts`
 * (`/validate`, `/api/v1/robustness/analyze`, `/api/v1/causal/counterfactual/conformal`,
 * `/conformal`, `/compare`, `/explain/contrastive`) and `src/lib/service-health.ts`
 * (`/health`). The `/api/v1/*` and `/explain/*` subtrees are PERMISSIVE because the
 * ISL route table was not authoritatively read; `isTraversal` closes any encoded
 * escape through them.
 */
const ALLOWED_TARGETS: readonly RegExp[] = [
  /^\/health$/,
  /^\/validate$/,
  /^\/conformal$/,
  /^\/compare$/,
  /^\/explain\/.+$/,
  /^\/api\/v1\/.+$/,
]

function isAllowedTarget(pathname: string): boolean {
  return ALLOWED_TARGETS.some((re) => re.test(pathname))
}

/**
 * Reject encoded traversal (`%2e` / `%2f` / `%5c`, case-insensitive) and any
 * literal `..` path segment before the allowlist. This is load-bearing here: the
 * `/api/v1/*` and `/explain/*` patterns are permissive, so an encoded escape would
 * otherwise ride them to the upstream.
 */
function isTraversal(rawUrl: string, targetPath: string): boolean {
  if (/%2e|%2f|%5c/i.test(rawUrl)) return true
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

  // Extract the path after /bff/isl/
  // e.g., /bff/isl/api/v1/analysis/robustness → /api/v1/analysis/robustness
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/isl/, '')
  const targetUrl = `${ISL_TARGET}${targetPath}${url.search}`

  // SECURITY (item 13): reject off-list / traversal paths BEFORE the bearer is
  // injected. Off-list ⇒ 404, NO credential forwarded.
  if (isTraversal(request.url, targetPath) || !isAllowedTarget(targetPath)) {
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
