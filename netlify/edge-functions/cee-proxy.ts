/**
 * CEE (Assistants) Service Proxy Edge Function
 *
 * Injects X-Olumi-Assist-Key header for authenticated CEE requests.
 * Required because Netlify redirects don't support request header injection.
 *
 * Environment Variables:
 * - ASSIST_API_KEY: API key for CEE service authentication
 *
 * SECURITY: Uses explicit origin allow-list (no wildcard CORS).
 * See SECURITY.md for compliance requirements.
 */

import type { Config, Context } from '@netlify/edge-functions'

const CEE_TARGET = 'https://olumi-assistants-service.onrender.com'

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://app.olumi.app',
  'https://decision-guide-ai.netlify.app',  // Netlify preview
  'http://localhost:5173',  // Dev only
  'http://localhost:4173',  // Preview builds
]

/**
 * Get CORS headers for allowed origins only.
 * Returns null if origin is not in allow-list.
 */
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  // SECURITY: Reject unknown origins explicitly (don't fallback)
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return null
  }

  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-correlation-id',
    'Vary': 'Origin',
  }
}

export default async function handler(request: Request, context: Context) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn('[CEE Proxy] Rejected request from unknown origin:', origin)
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

  const apiKey = Deno.env.get('ASSIST_API_KEY')

  // Extract the path after /bff/cee/ and prefix with /assist/v1
  // e.g., /bff/cee/key-insight → /assist/v1/key-insight
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/cee/, '/assist/v1')
  const targetUrl = `${CEE_TARGET}${targetPath}${url.search}`

  // Clone headers and add auth
  const headers = new Headers(request.headers)
  if (apiKey) {
    headers.set('X-Olumi-Assist-Key', apiKey)
  }

  // Remove host header to avoid conflicts
  headers.delete('host')

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
    console.error('[CEE Proxy] Error:', error)
    return new Response(
      JSON.stringify({ error: 'CEE service unavailable', message: (error as Error).message }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/cee/*',
}
