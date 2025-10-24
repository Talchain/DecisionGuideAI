/**
 * Markdown sanitization utility
 * Converts markdown to HTML and sanitizes to prevent XSS
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * Sanitize markdown to safe HTML
 * - Converts markdown to HTML using marked
 * - Sanitizes HTML using DOMPurify to prevent XSS
 * - Allows only safe tags (no scripts, iframes, etc.)
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
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}
