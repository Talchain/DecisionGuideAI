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
 * - Uses explicit origin allow-list (no wildcard CORS)
 * See SECURITY.md for compliance requirements.
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

  // SECURITY: Build headers from scratch with explicit allowlist.
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
