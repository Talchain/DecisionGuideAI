/**
 * Markdown sanitization tests — rewritten for safeRichText contract (2026-04-18).
 *
 * BACKGROUND
 * ----------
 * Prior to Brief A+B (commit 2d88c8cf, 2026-03-19) this module used
 * DOMPurify + marked for full GFM rendering. Brief A+B replaced it with
 * `safeRichText` — a dependency-free, restricted renderer with an allowlist
 * of only: <strong>, <br>, <ul>, <li>, <span>.
 *
 * `sanitizeMarkdown` is now a deprecated shim that delegates to `safeRichText`.
 * These tests verify the CURRENT contract, not the legacy DOMPurify contract.
 *
 * KEY BEHAVIOURAL DIFFERENCES FROM LEGACY
 * ----------------------------------------
 * - Italic (`*italic*`) → NOT converted; output is `*italic*` literal
 * - Inline code (`` `code` ``) → NOT converted; backticks remain
 * - Code blocks (``` ```…``` ```) → NOT converted; raw text with <br> breaks
 * - Blockquotes (`> quote`) → NOT converted; `>` is escaped to `&gt;`
 * - Headings (`# H`) → rendered as `<strong>H</strong>` (graceful degradation)
 * - Links (`[x](y)`) → NOT converted; remain as literal text
 *
 * XSS SAFETY: `safeRichText` ESCAPES HTML rather than stripping tags.
 * `<script>alert("xss")</script>` becomes `&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;`
 * — the word "alert" survives as escaped text content. The XSS attack
 * vector is still blocked (the script tag can never execute) but the
 * legacy "output must not contain 'alert'" assertion is incorrect for
 * the escape-based model.
 */

import { describe, it, expect } from 'vitest'
import { sanitizeMarkdown } from '../markdown'

describe('sanitizeMarkdown (safeRichText contract)', () => {
  describe('Allowed transforms', () => {
    it('converts bold text to <strong>', () => {
      const result = sanitizeMarkdown('**bold text**')
      expect(result).toContain('<strong>bold text</strong>')
    })

    it('converts unordered lists to <ul><li>', () => {
      const result = sanitizeMarkdown('- Item A\n- Item B')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Item A</li>')
      expect(result).toContain('<li>Item B</li>')
      expect(result).toContain('</ul>')
    })

    it('converts single newlines between text lines to <br>', () => {
      const result = sanitizeMarkdown('Line 1\nLine 2')
      expect(result).toContain('Line <span class="md-number">1</span>')
      expect(result).toContain('<br')
      expect(result).toContain('Line <span class="md-number">2</span>')
    })

    it('renders headings as <strong> (graceful degradation)', () => {
      // Note: mid-identifier digits (e.g. "H1") are NOT wrapped in md-number
      // — the lookbehind in convertInline excludes identifier-adjacent digits
      // so "opt_raise_59" and similar codes stay intact.
      expect(sanitizeMarkdown('# Heading')).toContain('<strong>Heading</strong>')
      expect(sanitizeMarkdown('## Subheading')).toContain('<strong>Subheading</strong>')
      expect(sanitizeMarkdown('### Deep section')).toContain('<strong>Deep section</strong>')
    })

    it('wraps standalone integers in <span class="md-number"> for tabular styling', () => {
      const result = sanitizeMarkdown('- Item 1\n- Item 2')
      expect(result).toContain('<li>Item <span class="md-number">1</span></li>')
      expect(result).toContain('<li>Item <span class="md-number">2</span></li>')
    })
  })

  describe('Unsupported markdown (passed through as escaped/literal text)', () => {
    it('does NOT convert italic — single asterisks remain as literal text', () => {
      const result = sanitizeMarkdown('*italic text*')
      expect(result).not.toContain('<em>')
      expect(result).toContain('*italic text*')
    })

    it('does NOT convert inline code — backticks remain as literal text', () => {
      const result = sanitizeMarkdown('`code`')
      expect(result).not.toContain('<code>')
      expect(result).toContain('`code`')
    })

    it('does NOT convert code blocks — fence markers remain and text renders with <br>', () => {
      const result = sanitizeMarkdown('```\ncode block\n```')
      expect(result).not.toContain('<pre>')
      expect(result).not.toContain('<code>')
      expect(result).toContain('code block')
    })

    it('does NOT convert blockquotes — `>` is escaped to `&gt;`', () => {
      const result = sanitizeMarkdown('> quote')
      expect(result).not.toContain('<blockquote>')
      expect(result).toContain('&gt; quote')
    })

    it('does NOT convert ordered lists — output shows escaped literal numbers', () => {
      const result = sanitizeMarkdown('1. First\n2. Second')
      expect(result).not.toContain('<ol>')
      expect(result).toContain('First')
      expect(result).toContain('Second')
    })

    it('does NOT convert markdown links — brackets/parentheses remain literal', () => {
      const result = sanitizeMarkdown('[text](https://example.com)')
      expect(result).not.toContain('<a ')
      expect(result).toContain('[text](https://example.com)')
    })
  })

  describe('XSS protection via escape-not-strip', () => {
    it('escapes <script> tags so they cannot execute', () => {
      const result = sanitizeMarkdown('<script>alert("xss")</script>')
      // The script TAG must never appear as a real HTML element
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
      // Escaped form is the expected safe representation
      expect(result).toContain('&lt;script&gt;')
      expect(result).toContain('&lt;/script&gt;')
    })

    it('escapes onclick attributes so handlers cannot attach', () => {
      const result = sanitizeMarkdown('<div onclick="alert(\'xss\')">text</div>')
      // The <div> element must not appear — only <strong>/<br>/<ul>/<li>/<span> allowed
      expect(result).not.toMatch(/<div\b/)
      // onclick must not appear as a real attribute (i.e. in an unescaped <div…> tag)
      expect(result).not.toMatch(/<[^>]*\bonclick=/)
      // Escaped form is expected
      expect(result).toContain('&lt;div')
    })

    it('escapes <iframe> tags so they cannot load external content', () => {
      const result = sanitizeMarkdown('<iframe src="https://evil.com"></iframe>')
      expect(result).not.toMatch(/<iframe\b/)
      expect(result).toContain('&lt;iframe')
    })

    it('escapes <img onerror=…> so the handler cannot fire', () => {
      const result = sanitizeMarkdown('<img src=x onerror="alert(\'xss\')">')
      expect(result).not.toMatch(/<img\b/)
      expect(result).not.toMatch(/<[^>]*\bonerror=/)
    })

    it('escapes <style> tags so CSS injection is blocked', () => {
      const result = sanitizeMarkdown('<style>body { display: none; }</style>')
      expect(result).not.toMatch(/<style\b/)
      expect(result).toContain('&lt;style&gt;')
    })

    it('escapes mixed malicious HTML embedded in bold markdown', () => {
      const result = sanitizeMarkdown('**Bold <script>alert("xss")</script> text**')
      // Bold formatting survives
      expect(result).toContain('<strong>')
      expect(result).toContain('Bold')
      expect(result).toContain('text')
      // Script tag does not appear as a real element
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
    })

    it('leaves no disallowed real HTML tags in output', () => {
      const result = sanitizeMarkdown('<a href="x">link</a> <img src="y"> <iframe></iframe>')
      // Only allowlisted tag openers may appear in real form
      const realTags = result.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g) || []
      const allowed = new Set(['<strong', '</strong', '<br', '</br', '<ul', '</ul', '<li', '</li', '<span', '</span'])
      for (const tag of realTags) {
        expect(allowed.has(tag)).toBe(true)
      }
    })
  })

  describe('Allowlist compliance', () => {
    it('produces <strong> for bold', () => {
      expect(sanitizeMarkdown('**x**')).toContain('<strong>x</strong>')
    })

    it('produces <br> between adjacent text lines', () => {
      expect(sanitizeMarkdown('a\nb')).toContain('<br')
    })

    it('produces <ul><li> for bullets', () => {
      const result = sanitizeMarkdown('- a')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>a</li>')
    })

    it('does NOT produce <em>, <code>, <pre>, <blockquote>, or <h*> tags', () => {
      const result = sanitizeMarkdown(
        '*italic* `code` \n```\nblock\n```\n> quote\n# heading',
      )
      expect(result).not.toContain('<em>')
      expect(result).not.toContain('<code>')
      expect(result).not.toContain('<pre>')
      expect(result).not.toContain('<blockquote>')
      expect(result).not.toMatch(/<h[1-6]\b/)
    })
  })

  describe('Edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeMarkdown('')).toBe('')
    })

    it('returns empty string for null input', () => {
      expect(sanitizeMarkdown(null as unknown as string)).toBe('')
    })

    it('returns empty string for undefined input', () => {
      expect(sanitizeMarkdown(undefined as unknown as string)).toBe('')
    })

    it('returns empty string for non-string input', () => {
      expect(sanitizeMarkdown(123 as unknown as string)).toBe('')
    })

    it('handles very long input without throwing', () => {
      const longText = 'a'.repeat(10000)
      const result = sanitizeMarkdown(longText)
      expect(result).toContain('a')
    })

    it('escapes raw special characters safely', () => {
      const result = sanitizeMarkdown('< > & " \'')
      // Each character is escaped to its HTML entity
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
      expect(result).toContain('&amp;')
    })

    it('preserves unicode characters including CJK and emoji-adjacent symbols', () => {
      const result = sanitizeMarkdown('Unicode: 你好 café')
      expect(result).toContain('Unicode')
      expect(result).toContain('你好')
      expect(result).toContain('café')
    })

    it('strips emoji per conservative allowlist (policy from safeRichText)', () => {
      // Note: safeRichText strips emoji intentionally (see EMOJI_RE). This is
      // the contract change vs. the legacy renderer — documented here.
      const result = sanitizeMarkdown('hello 🎉 world')
      expect(result).toContain('hello')
      expect(result).toContain('world')
      expect(result).not.toContain('🎉')
    })

    it('handles malformed markdown without throwing', () => {
      const result = sanitizeMarkdown('**unclosed bold')
      // Unclosed bold does not match the non-greedy pattern, stays literal
      expect(result).toContain('**unclosed bold')
    })
  })

  describe('Real-world orchestrator-style content', () => {
    it('renders a typical node description with bold + bullets + escaped blockquote', () => {
      const description = [
        '**Decision Point**: Should we proceed with option A or B?',
        '',
        'Key considerations:',
        '- Cost implications',
        '- Timeline impact',
        '- Resource availability',
        '',
        '> Important: This decision affects Q2 delivery',
      ].join('\n')

      const result = sanitizeMarkdown(description)

      expect(result).toContain('<strong>Decision Point</strong>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>Cost implications</li>')
      expect(result).toContain('<li>Timeline impact</li>')
      expect(result).toContain('<li>Resource availability</li>')
      // Blockquote is escaped, not converted
      expect(result).not.toContain('<blockquote>')
      expect(result).toContain('&gt; Important')
    })

    it('safely handles mixed bold + malicious HTML in the same string', () => {
      const description = [
        '**Important Note**',
        '',
        'This is safe content <script>alert(\'xss\')</script> with malicious code.',
        '- Safe bullet point',
        '- <img src=x onerror="alert(\'xss\')">',
        '- Another safe point',
      ].join('\n')

      const result = sanitizeMarkdown(description)

      // Safe content preserved
      expect(result).toContain('<strong>Important Note</strong>')
      expect(result).toContain('This is safe content')
      expect(result).toContain('<li>Safe bullet point</li>')
      expect(result).toContain('<li>Another safe point</li>')

      // Malicious tags do not appear as real HTML
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
      expect(result).not.toMatch(/<img\b/)
      expect(result).not.toMatch(/<[^>]*\bonerror=/)

      // Escaped forms appear instead
      expect(result).toContain('&lt;script&gt;')
    })
  })
})
