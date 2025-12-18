/**
 * CSP Nonce Injection Edge Function
 *
 * Generates a cryptographic nonce for each HTML response and:
 * 1. Injects the nonce into all inline <script> tags
 * 2. Updates the CSP header to use nonce instead of 'unsafe-inline'
 *
 * This enables strong Content Security Policy while preserving the
 * critical boot scripts in index.html that must run before React loads.
 *
 * SECURITY: Nonces are generated using 128 bits of cryptographic randomness
 * (16 bytes) encoded as base64 for maximum browser compatibility.
 * Each page load gets a unique nonce to prevent replay attacks.
 */

import type { Config, Context } from '@netlify/edge-functions'

/**
 * Generate a cryptographically secure nonce as base64.
 * Uses 16 bytes (128 bits) of randomness - same entropy as UUID but
 * in base64 format for better CSP compatibility across browsers.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export default async function handler(request: Request, context: Context) {
  // Only process GET requests for HTML documents
  if (request.method !== 'GET') {
    return context.next()
  }

  // Get the original response
  const response = await context.next()

  // Only process HTML responses
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('text/html')) {
    return response
  }

  // Generate a unique nonce for this request
  const nonce = generateNonce()

  // Read the HTML body
  const html = await response.text()

  // Inject nonce into all inline script tags
  // Matches: <script> (but not <script src="...">)
  const nonceHtml = html.replace(
    /<script>(?!\s*$)/g,
    `<script nonce="${nonce}">`
  )

  // Get existing CSP header
  const existingCsp = response.headers.get('Content-Security-Policy') || ''

  // Replace 'unsafe-inline' with nonce in script-src directive
  // Also handle case where script-src doesn't exist
  let updatedCsp = existingCsp

  if (existingCsp.includes('script-src')) {
    // Replace 'unsafe-inline' with nonce in existing script-src
    updatedCsp = existingCsp.replace(
      /script-src\s+([^;]*)'unsafe-inline'([^;]*)/,
      `script-src $1'nonce-${nonce}'$2`
    )
  } else if (existingCsp) {
    // Add script-src with nonce to existing CSP
    updatedCsp = `script-src 'self' 'nonce-${nonce}'; ${existingCsp}`
  } else {
    // No existing CSP - this shouldn't happen with our netlify.toml
    updatedCsp = `script-src 'self' 'nonce-${nonce}'`
  }

  // Create new response with updated headers
  const newHeaders = new Headers(response.headers)
  newHeaders.set('Content-Security-Policy', updatedCsp)

  return new Response(nonceHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

export const config: Config = {
  // Only run on HTML document requests (not assets)
  path: ['/', '/index.html', '/*'],
  // Exclude static assets and API routes
  excludedPath: [
    '/assets/*',
    '/bff/*',
    '/*.js',
    '/*.css',
    '/*.svg',
    '/*.png',
    '/*.ico',
    '/*.json',
    '/*.map',
  ],
}
