/**
 * CEE (Assistants) Service Proxy Edge Function
 *
 * Injects X-Olumi-Assist-Key header for authenticated CEE requests.
 * Required because Netlify redirects don't support request header injection.
 *
 * Environment Variables:
 * - ASSIST_API_KEY: API key for CEE service authentication
 *
 * SECURITY:
 * - Uses explicit origin allow-list (no wildcard CORS)
 * - Rate limiting: 30 requests/minute per IP (persisted via Netlify Blobs)
 * See SECURITY.md for compliance requirements.
 */

import type { Config, Context } from '@netlify/edge-functions'
import { getStore } from '@netlify/blobs'

const CEE_TARGET = 'https://olumi-assistants-service.onrender.com'

// =============================================================================
// Rate Limiting Configuration (Persistent via Netlify Blobs)
// =============================================================================

const RATE_LIMIT = {
  windowMs: 60 * 1000,  // 1 minute window
  maxRequests: 30,      // 30 requests per minute per IP
}

interface RateLimitRecord {
  count: number
  resetAt: number
}

/**
 * Get client IP from request headers
 * Netlify provides x-nf-client-connection-ip header
 */
function getClientIp(request: Request): string {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * Check rate limit for a client IP using Netlify Blobs for persistence.
 * Fails open on store errors to avoid blocking legitimate requests.
 */
async function checkRateLimit(clientIp: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  const now = Date.now()
  const defaultResetAt = now + RATE_LIMIT.windowMs

  try {
    const store = getStore('rate-limits')
    const key = `cee:${clientIp}`

    const record = await store.get(key, { type: 'json' }) as RateLimitRecord | null

    // New window or expired entry
    if (!record || record.resetAt < now) {
      const resetAt = defaultResetAt
      await store.setJSON(key, { count: 1, resetAt })
      return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetAt }
    }

    // Over limit
    if (record.count >= RATE_LIMIT.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt }
    }

    // Increment count
    const newCount = record.count + 1
    await store.setJSON(key, { count: newCount, resetAt: record.resetAt })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - newCount, resetAt: record.resetAt }

  } catch (error) {
    // SECURITY: Fail open on store errors — don't block legitimate requests
    console.error('[CEE Proxy] Rate limit store error:', error)
    return { allowed: true, remaining: RATE_LIMIT.maxRequests, resetAt: defaultResetAt }
  }
}

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  'https://decisionguide.ai',
  'https://app.olumi.app',
  'https://decision-guide-ai.netlify.app',  // Netlify preview
  'https://staging--olumi.netlify.app',     // Staging environment
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
    // P2: Broader header allowlist for future-proofing (auth, API keys, etc.)
    'Access-Control-Allow-Headers': 'Content-Type, x-correlation-id, Authorization, X-Api-Key, X-Request-Id',
    'Vary': 'Origin, Access-Control-Request-Headers',
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

  // Handle preflight OPTIONS requests (exempt from rate limiting)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // SECURITY: Rate limiting check (async - uses Netlify Blobs)
  const clientIp = getClientIp(request)
  const rateLimit = await checkRateLimit(clientIp)

  // Build rate limit headers for all responses
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
  }

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    console.warn(`[CEE Proxy] Rate limit exceeded for IP: ${clientIp}`)
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          'Retry-After': String(retryAfter),
          'Content-Type': 'application/json',
        },
      }
    )
  }

  const apiKey = Deno.env.get('ASSIST_API_KEY')

  // Extract the path after /bff/cee/ and prefix with /assist/v1
  // e.g., /bff/cee/key-insight → /assist/v1/key-insight
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/bff\/cee/, '/assist/v1')
  const targetUrl = `${CEE_TARGET}${targetPath}${url.search}`

  // SECURITY: Build headers from scratch with explicit allowlist
  // Never forward all client headers - only copy what we need
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

  // Add API key for CEE authentication
  if (apiKey) {
    headers.set('X-Olumi-Assist-Key', apiKey)
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - duplex is required for streaming bodies
      duplex: 'half',
    })

    // Return response with validated CORS headers and rate limit headers
    const responseHeaders = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value)
    })
    // Add rate limit headers to successful responses
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
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
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config: Config = {
  path: '/bff/cee/*',
}
