/**
 * Central Sanitization Utility
 *
 * Provides security-focused sanitization functions for user inputs,
 * file content, and data persistence.
 *
 * Section H: Security - Task H1
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * Sanitize text labels (node labels, edge labels, etc.)
 *
 * Removes:
 * - HTML tags
 * - Angle brackets
 * - Control characters
 * - Excessive length
 *
 * @param label - Raw label input
 * @param maxLength - Maximum allowed length (default: 100)
 * @returns Sanitized label string or 'Untitled' if invalid
 */
export function sanitizeLabel(label: unknown, maxLength = 100): string {
  if (typeof label !== 'string') return 'Untitled'

  return label
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength)
    .trim() || 'Untitled'
}

/**
 * Sanitize markdown to safe HTML
 *
 * - Converts markdown to HTML using marked
 * - Sanitizes HTML using DOMPurify to prevent XSS
 * - Allows only safe tags (no scripts, iframes, etc.)
 *
 * @param markdown - Raw markdown input
 * @returns Sanitized HTML string
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return ''
  }

  // Convert markdown to HTML
  const html = marked.parse(markdown, {
    breaks: true,  // Convert line breaks to <br>
    gfm: true,     // GitHub Flavored Markdown
  }) as string

  // Sanitize HTML to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'ul', 'ol', 'li',
      'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'span'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  })
}

/**
 * Sanitize filename for downloads
 *
 * Replaces anything that's not alphanumeric, dash, underscore, or dot
 * with a hyphen to prevent directory traversal and shell injection.
 *
 * @param filename - Raw filename input
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'untitled'
  }

  // Replace anything not alnum, dash, underscore, dot with hyphen
  return filename.replace(/[^A-Za-z0-9_.-]+/g, '-')
}

/**
 * Sanitize URL for safe redirection
 *
 * Prevents open redirect vulnerabilities by ensuring URL is:
 * - Relative path, OR
 * - Same origin, OR
 * - Allowlisted domain
 *
 * @param url - Raw URL input
 * @param allowlist - Array of allowed hostnames (default: [])
 * @returns Sanitized URL or '/' if invalid
 */
export function sanitizeUrl(url: string, allowlist: string[] = []): string {
  if (!url || typeof url !== 'string') {
    return '/'
  }

  try {
    // Allow relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
      // Prevent path traversal
      const normalized = url.replace(/\.\.+/g, '')
      return normalized
    }

    // Parse absolute URLs
    const parsed = new URL(url, window.location.origin)

    // Allow same-origin URLs
    if (parsed.origin === window.location.origin) {
      return parsed.pathname + parsed.search + parsed.hash
    }

    // Check allowlist
    if (allowlist.includes(parsed.hostname)) {
      return parsed.href
    }

    // Block external URLs
    return '/'
  } catch {
    // Invalid URL
    return '/'
  }
}

/**
 * Sanitize share hash from URL parameters
 *
 * Ensures hash is:
 * - Alphanumeric only
 * - Fixed length (64 chars for SHA-256)
 * - Lowercase hex
 *
 * @param hash - Raw hash from URL parameter
 * @returns Sanitized hash or null if invalid
 */
export function sanitizeShareHash(hash: unknown): string | null {
  if (typeof hash !== 'string') {
    return null
  }

  // SHA-256 hashes are 64 hex characters
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    return null
  }

  return hash.toLowerCase()
}

/**
 * Sanitize JSON for persistence
 *
 * Prevents prototype pollution by:
 * - Stripping __proto__, constructor, prototype keys
 * - Validating object structure
 * - Limiting nesting depth
 *
 * @param obj - Raw object to sanitize
 * @param maxDepth - Maximum nesting depth (default: 10)
 * @returns Sanitized object
 */
export function sanitizeJSON(obj: unknown, maxDepth = 10): unknown {
  if (maxDepth <= 0) {
    throw new Error('Maximum nesting depth exceeded')
  }

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJSON(item, maxDepth - 1))
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    // Block dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }

    sanitized[key] = sanitizeJSON(value, maxDepth - 1)
  }

  return sanitized
}

/**
 * Sanitize HTML string for safe rendering
 *
 * More restrictive than sanitizeMarkdown - only allows basic formatting.
 * Use this for user-generated content that should be plain text with
 * minimal formatting.
 *
 * @param html - Raw HTML input
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize number input
 *
 * Ensures value is:
 * - A finite number
 * - Within specified range
 * - Not NaN
 *
 * @param value - Raw number input
 * @param min - Minimum allowed value (default: -Infinity)
 * @param max - Maximum allowed value (default: Infinity)
 * @param fallback - Fallback value if invalid (default: 0)
 * @returns Sanitized number
 */
export function sanitizeNumber(
  value: unknown,
  min = -Infinity,
  max = Infinity,
  fallback = 0
): number {
  const num = Number(value)

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return fallback
  }

  if (num < min) return min
  if (num > max) return max

  return num
}
