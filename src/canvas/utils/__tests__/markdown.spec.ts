/**
 * Markdown sanitization utility tests
 *
 * Tests for:
 * - Markdown to HTML conversion
 * - XSS protection via DOMPurify
 * - Safe tag allowlist
 * - Edge cases
 */

import { describe, it, expect } from 'vitest'
import { sanitizeMarkdown } from '../markdown'

describe('sanitizeMarkdown', () => {
  describe('Markdown Conversion', () => {
    it('converts bold text', () => {
      const result = sanitizeMarkdown('**bold text**')
      expect(result).toContain('<strong>bold text</strong>')
    })

    it('converts italic text', () => {
      const result = sanitizeMarkdown('*italic text*')
      expect(result).toContain('<em>italic text</em>')
    })

    it('converts inline code', () => {
      const result = sanitizeMarkdown('`code`')
      expect(result).toContain('<code>code</code>')
    })

    it('converts unordered lists', () => {
      const result = sanitizeMarkdown('- Item 1\n- Item 2')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item 1')
      expect(result).toContain('<li>Item 2')
    })

    it('converts ordered lists', () => {
      const result = sanitizeMarkdown('1. First\n2. Second')
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>First')
      expect(result).toContain('<li>Second')
    })

    it('converts code blocks', () => {
      const result = sanitizeMarkdown('```\ncode block\n```')
      expect(result).toContain('<pre>')
      expect(result).toContain('<code>')
    })

    it('converts blockquotes', () => {
      const result = sanitizeMarkdown('> quote')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('quote')
    })

    it('converts headings', () => {
      const result1 = sanitizeMarkdown('# H1')
      const result2 = sanitizeMarkdown('## H2')
      const result3 = sanitizeMarkdown('### H3')

      expect(result1).toContain('<h1>')
      expect(result2).toContain('<h2>')
      expect(result3).toContain('<h3>')
    })

    it('converts line breaks with GFM', () => {
      const result = sanitizeMarkdown('Line 1\nLine 2')
      expect(result).toContain('<br')
    })
  })

  describe('XSS Protection', () => {
    it('removes script tags', () => {
      const result = sanitizeMarkdown('<script>alert("xss")</script>')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('removes onclick handlers', () => {
      const result = sanitizeMarkdown('<div onclick="alert(\'xss\')">text</div>')
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('alert')
    })

    it('removes onload handlers', () => {
      const result = sanitizeMarkdown('<img onload="alert(\'xss\')" src="x">')
      expect(result).not.toContain('onload')
      expect(result).not.toContain('alert')
    })

    it('removes iframe tags', () => {
      const result = sanitizeMarkdown('<iframe src="https://evil.com"></iframe>')
      expect(result).not.toContain('<iframe>')
      expect(result).not.toContain('evil.com')
    })

    it('removes object tags', () => {
      const result = sanitizeMarkdown('<object data="evil.swf"></object>')
      expect(result).not.toContain('<object>')
    })

    it('removes embed tags', () => {
      const result = sanitizeMarkdown('<embed src="evil.swf">')
      expect(result).not.toContain('<embed>')
    })

    it('removes style tags', () => {
      const result = sanitizeMarkdown('<style>body { display: none; }</style>')
      expect(result).not.toContain('<style>')
    })

    it('removes javascript: protocol from links', () => {
      const result = sanitizeMarkdown('[Link](javascript:alert("xss"))')
      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('alert')
    })

    it('removes data: protocol from links', () => {
      const result = sanitizeMarkdown('[Link](data:text/html,<script>alert("xss")</script>)')
      expect(result).not.toContain('data:')
    })

    it('removes vbscript: protocol', () => {
      const result = sanitizeMarkdown('[Link](vbscript:alert("xss"))')
      expect(result).not.toContain('vbscript:')
    })

    it('sanitizes nested malicious content', () => {
      const result = sanitizeMarkdown('**Bold <script>alert("xss")</script> text**')
      expect(result).toContain('<strong>')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('Bold')
      expect(result).toContain('text')
    })

    it('sanitizes mixed markdown and HTML', () => {
      const result = sanitizeMarkdown('**Safe** <img src=x onerror="alert(\'xss\')">')
      expect(result).toContain('<strong>Safe</strong>')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
    })
  })

  describe('Safe Tags', () => {
    it('allows paragraph tags', () => {
      const result = sanitizeMarkdown('Paragraph text')
      expect(result).toContain('<p>')
    })

    it('allows break tags', () => {
      const result = sanitizeMarkdown('Line 1\nLine 2')
      expect(result).toContain('<br')
    })

    it('allows strong tags', () => {
      const result = sanitizeMarkdown('**bold**')
      expect(result).toContain('<strong>')
    })

    it('allows em tags', () => {
      const result = sanitizeMarkdown('*italic*')
      expect(result).toContain('<em>')
    })

    it('allows code tags', () => {
      const result = sanitizeMarkdown('`code`')
      expect(result).toContain('<code>')
    })

    it('allows pre tags', () => {
      const result = sanitizeMarkdown('```\ncode\n```')
      expect(result).toContain('<pre>')
    })

    it('allows list tags', () => {
      const result = sanitizeMarkdown('- Item')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>')
    })

    it('allows blockquote tags', () => {
      const result = sanitizeMarkdown('> Quote')
      expect(result).toContain('<blockquote>')
    })

    it('allows heading tags', () => {
      const result = sanitizeMarkdown('# Heading')
      expect(result).toContain('<h1>')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = sanitizeMarkdown('')
      expect(result).toBe('')
    })

    it('handles null input', () => {
      const result = sanitizeMarkdown(null as any)
      expect(result).toBe('')
    })

    it('handles undefined input', () => {
      const result = sanitizeMarkdown(undefined as any)
      expect(result).toBe('')
    })

    it('handles non-string input', () => {
      const result = sanitizeMarkdown(123 as any)
      expect(result).toBe('')
    })

    it('handles very long input', () => {
      const longText = 'a'.repeat(10000)
      const result = sanitizeMarkdown(longText)
      expect(result).toContain('a')
    })

    it('handles special characters', () => {
      const result = sanitizeMarkdown('< > & " \'')
      expect(result).toBeTruthy()
    })

    it('handles unicode characters', () => {
      const result = sanitizeMarkdown('Unicode: 你好 🎉 café')
      expect(result).toContain('Unicode')
      expect(result).toContain('你好')
      expect(result).toContain('🎉')
      expect(result).toContain('café')
    })

    it('handles malformed markdown', () => {
      const result = sanitizeMarkdown('**unclosed bold')
      expect(result).toBeTruthy()
    })

    it('preserves whitespace in code blocks', () => {
      const result = sanitizeMarkdown('```\n  indented\n    code\n```')
      expect(result).toContain('indented')
      expect(result).toContain('code')
    })

    it('handles mixed content types', () => {
      const result = sanitizeMarkdown('**Bold** *italic* `code`\n\n> quote\n\n- list')
      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
      expect(result).toContain('<code>')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('<ul>')
    })
  })

  describe('Real-World Scenarios', () => {
    it('handles typical node description', () => {
      const description = `
**Decision Point**: Should we proceed with option A or B?

Key considerations:
- Cost implications
- Timeline impact
- Resource availability

> Important: This decision affects Q2 delivery
      `.trim()

      const result = sanitizeMarkdown(description)

      expect(result).toContain('<strong>Decision Point</strong>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Cost implications')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('Important')
    })

    it('handles technical documentation', () => {
      const description = `
## API Endpoint

\`GET /api/v1/data\`

**Parameters**:
- \`id\`: Resource identifier
- \`format\`: Response format (json|xml)

\`\`\`json
{
  "status": "success",
  "data": {}
}
\`\`\`
      `.trim()

      const result = sanitizeMarkdown(description)

      expect(result).toContain('<h2>API Endpoint</h2>')
      expect(result).toContain('<code>GET /api/v1/data</code>')
      expect(result).toContain('<strong>Parameters</strong>')
      expect(result).toContain('<pre>')
    })

    it('handles mixed safe and malicious content', () => {
      const description = `
**Important Note**

This is safe content <script>alert('xss')</script> with malicious code.

- Safe bullet point
- <img src=x onerror="alert('xss')">
- Another safe point

\`Safe code\` <iframe src="evil.com"></iframe>
      `.trim()

      const result = sanitizeMarkdown(description)

      // Safe content preserved
      expect(result).toContain('<strong>Important Note</strong>')
      expect(result).toContain('This is safe content')
      expect(result).toContain('<li>Safe bullet point')
      expect(result).toContain('<code>Safe code</code>')

      // Malicious content removed
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('<iframe>')
      expect(result).not.toContain('alert')
    })
  })
})
