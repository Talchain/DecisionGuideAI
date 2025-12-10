/**
 * CEE (Assistants) Service Proxy Edge Function
 *
 * Injects X-Olumi-Assist-Key header for authenticated CEE requests.
 * Required because Netlify redirects don't support request header injection.
 *
 * Environment Variables:
 * - ASSIST_API_KEY: API key for CEE service authentication
 */

import type { Config, Context } from '@netlify/edge-functions'

const CEE_TARGET = 'https://olumi-assistants-service.onrender.com'

export default async function handler(request: Request, context: Context) {
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

    // Return response with CORS headers
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, x-correlation-id')

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
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/cee/*',
}
