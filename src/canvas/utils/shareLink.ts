/**
 * Share link utilities for parsing and validating run hash URLs
 *
 * Share links are local-device only (no backend sync in current scope)
 */

/**
 * Parse run hash from URL hash or search params
 * Supports both formats:
 * - Plain hex: #/canvas?run=abc123...
 * - Prefixed: #/canvas?run=sha256:abc123...
 *
 * @param url - Full URL string or just the hash/search portion
 * @returns Validated run hash or null if invalid/missing
 */
export function parseRunHash(url: string): string | null {
  try {
    // Extract search params from hash portion (for hash-based routing)
    // e.g., "#/canvas?run=abc123" -> "?run=abc123"
    const hashMatch = url.match(/#[^?]*(\?.*)$/)
    const searchString = hashMatch?.[1] || ''

    if (!searchString) {
      return null
    }

    const params = new URLSearchParams(searchString)
    const rawValue = params.get('run')

    if (!rawValue) {
      return null
    }

    // Decode once (handle percent-encoding)
    const decoded = decodeURIComponent(rawValue)

    // Validate: whitelist [A-Za-z0-9:_-] and length ≤ 128
    if (!/^[A-Za-z0-9:_-]+$/.test(decoded)) {
      console.warn('[ShareLink] Invalid characters in run hash:', decoded.slice(0, 20))
      return null
    }

    if (decoded.length > 128) {
      console.warn('[ShareLink] Run hash too long:', decoded.length)
      return null
    }

    // Accept both formats:
    // - sha256:abcd1234... (strip prefix, use hash portion)
    // - abcd1234... (plain hex, typically 64 chars)
    let hash = decoded
    if (decoded.startsWith('sha256:')) {
      hash = decoded.slice(7) // Remove "sha256:" prefix
    }

    // Validate hash is hex and reasonable length (8-128 chars)
    // Most hashes are 64 chars (SHA-256) but be flexible
    if (hash.length < 8) {
      console.warn('[ShareLink] Run hash too short:', hash.length)
      return null
    }

    if (!/^[a-f0-9]+$/i.test(hash)) {
      console.warn('[ShareLink] Run hash contains non-hex characters')
      return null
    }

    return hash
  } catch (err) {
    console.error('[ShareLink] Failed to parse run hash:', err)
    return null
  }
}

/**
 * Build share link URL for a given run hash
 * @param hash - Run hash (64-char hex string)
 * @returns Full URL with hash routing and query param
 */
export function buildShareLink(hash: string): string {
  const baseUrl = window.location.origin
  const path = '/#/canvas'
  const params = new URLSearchParams({ run: hash })
  return `${baseUrl}${path}?${params.toString()}`
}
