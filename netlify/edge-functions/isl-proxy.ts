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
 * - Uses explicit origin allow-list (no wildcard CORS)
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

  const apiKey = Deno.env.get('ISL_API_KEY')

  // Extract the path after /bff/isl/
  // e.g., /bff/isl/api/v1/analysis/robustness → /api/v1/analysis/robustness
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/isl/, '')
  const targetUrl = `${ISL_TARGET}${targetPath}${url.search}`

  // SECURITY: Build headers from scratch with explicit allowlist
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

  // Add API key for ISL authentication (both formats for compatibility)
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
