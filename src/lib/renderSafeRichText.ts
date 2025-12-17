/**
 * Unified Markdown/Rich Text Rendering Entry Point
 *
 * P1: Enterprise markdown consolidation
 *
 * This module provides a unified interface for safe rich text rendering.
 * It exposes two implementations for different use cases:
 *
 * 1. renderMarkdownSafe (from ./markdown.ts)
 *    - Dependency-free, lightweight implementation
 *    - Best for: Streaming updates, CI environments without npm install
 *    - Features: headings, lists, code blocks (with language class), links, bold, italic
 *    - Security: Manual HTML escaping, URL scheme validation (http/https/mailto only)
 *
 * 2. sanitizeMarkdown (from ../canvas/utils/markdown.ts)
 *    - Uses DOMPurify + marked (battle-tested libraries)
 *    - Best for: Static content display, untrusted user input
 *    - Features: Full GFM support, strictest sanitization
 *    - Security: DOMPurify with allowlist (no links/images by default)
 *
 * Usage Guidelines:
 * - For streaming AI output: use renderMarkdownSafe (preserves links, code styling)
 * - For user-generated descriptions: use sanitizeMarkdown (strictest sanitization)
 * - For static content with links: use renderMarkdownSafe
 *
 * SECURITY NOTE: Both implementations prevent XSS. The sanitizeMarkdown function
 * is more restrictive (no links/images) while renderMarkdownSafe allows safe links.
 * Choose based on your trust model for the content source.
 *
 * Future consolidation: When all use cases are analyzed, consider migrating to
 * a single implementation with configurable output options.
 */

// Re-export from canonical locations
export { renderMarkdownSafe } from './markdown'
export { sanitizeMarkdown } from '../canvas/utils/markdown'

// Type definitions for callsites that need them
export type RenderOptions = {
  /** Allow links in output (requires renderMarkdownSafe) */
  allowLinks?: boolean
  /** Allow code block language classes (requires renderMarkdownSafe) */
  allowCodeBlocks?: boolean
}

/**
 * Render rich text safely with automatic implementation selection.
 *
 * @param content - Markdown content to render
 * @param options - Rendering options
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 *
 * @example
 * // For AI-generated content with links
 * const html = renderSafeRichText(aiOutput, { allowLinks: true })
 *
 * @example
 * // For user descriptions (strictest)
 * const html = renderSafeRichText(userDescription)
 */
export function renderSafeRichText(
  content: string,
  options: RenderOptions = {}
): string {
  // Default to strictest sanitization
  const { allowLinks = false, allowCodeBlocks = false } = options

  if (allowLinks || allowCodeBlocks) {
    // Use the feature-rich renderer for streaming/AI content
    // Lazy import to avoid pulling in when not needed
    const { renderMarkdownSafe } = require('./markdown')
    return renderMarkdownSafe(content)
  }

  // Use DOMPurify-based sanitizer for strictest security
  const { sanitizeMarkdown } = require('../canvas/utils/markdown')
  return sanitizeMarkdown(content)
}

export default renderSafeRichText
