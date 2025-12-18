import { describe, it, expect } from 'vitest'
import { renderMarkdownSafe } from '../markdown'

/**
 * Security-focused tests for renderMarkdownSafe
 *
 * These tests verify that the markdown renderer properly sanitizes
 * potentially malicious input to prevent XSS attacks.
 *
 * @see OWASP XSS Prevention Cheat Sheet
 */
describe('renderMarkdownSafe security', () => {
  describe('script tag injection', () => {
    it('does not allow <script> tags', () => {
      const html = renderMarkdownSafe('<script>alert("xss")</script>')
      expect(html).not.toContain('<script')
      expect(html).not.toContain('</script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('does not allow script tags with attributes', () => {
      const html = renderMarkdownSafe('<script src="evil.js"></script>')
      expect(html).not.toContain('<script')
      expect(html).toContain('&lt;script src=')
    })

    it('does not allow script tags with mixed case', () => {
      const html = renderMarkdownSafe('<ScRiPt>alert("xss")</ScRiPt>')
      expect(html).not.toContain('<ScRiPt')
      expect(html).toContain('&lt;ScRiPt&gt;')
    })

    it('does not allow script tags with extra whitespace', () => {
      const html = renderMarkdownSafe('<script  >alert("xss")</script >')
      expect(html).not.toContain('<script')
    })

    it('does not allow script tags in code blocks', () => {
      const src = '```\n<script>alert("xss")</script>\n```'
      const html = renderMarkdownSafe(src)
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })
  })

  describe('javascript: URL injection', () => {
    it('does not allow javascript: links', () => {
      const html = renderMarkdownSafe('[click](javascript:alert("xss"))')
      expect(html).not.toContain('javascript:')
      expect(html).toContain('href="#"')
    })

    it('does not allow javascript: with mixed case', () => {
      const html = renderMarkdownSafe('[click](JaVaScRiPt:alert("xss"))')
      expect(html).not.toContain('JaVaScRiPt:')
      expect(html).toContain('href="#"')
    })

    it('does not allow javascript: with URL encoding', () => {
      // URL-encoded javascript: scheme
      const html = renderMarkdownSafe('[click](javascript%3Aalert("xss"))')
      expect(html).not.toContain('javascript')
      expect(html).toContain('href="#"')
    })

    it('does not allow javascript: with newlines', () => {
      const html = renderMarkdownSafe('[click](java\nscript:alert("xss"))')
      expect(html).not.toContain('javascript:')
    })

    it('does not allow javascript: with leading whitespace', () => {
      const html = renderMarkdownSafe('[click](  javascript:alert("xss"))')
      expect(html).not.toContain('javascript:')
    })
  })

  describe('event handler injection', () => {
    // Security property: HTML tags are escaped so event handlers cannot execute.
    // The text "onerror=" may still appear in output as escaped text, but
    // since <img becomes &lt;img, it's rendered as text, not parsed as HTML.

    it('escapes img tags with onerror handlers', () => {
      const html = renderMarkdownSafe('<img src=x onerror="alert(1)">')
      // Critical: angle brackets are escaped, preventing HTML parsing
      expect(html).not.toContain('<img')
      expect(html).toContain('&lt;img')
      expect(html).toContain('&gt;')
    })

    it('escapes div tags with onclick handlers', () => {
      const html = renderMarkdownSafe('<div onclick="alert(1)">click</div>')
      expect(html).not.toContain('<div')
      expect(html).toContain('&lt;div')
    })

    it('escapes body tags with onload handlers', () => {
      const html = renderMarkdownSafe('<body onload="alert(1)">')
      expect(html).not.toContain('<body')
      expect(html).toContain('&lt;body')
    })

    it('escapes anchor tags with onmouseover handlers', () => {
      const html = renderMarkdownSafe('<a onmouseover="alert(1)">hover</a>')
      // Note: <a> as raw HTML is escaped; markdown [text](url) creates safe links
      expect(html).not.toContain('<a onmouseover')
      expect(html).toContain('&lt;a')
    })

    it('escapes input tags with onfocus handlers', () => {
      const html = renderMarkdownSafe('<input onfocus="alert(1)" autofocus>')
      expect(html).not.toContain('<input')
      expect(html).toContain('&lt;input')
    })
  })

  describe('data: URL injection', () => {
    it('does not allow data: URLs in links', () => {
      const html = renderMarkdownSafe('[click](data:text/html,<script>alert(1)</script>)')
      expect(html).not.toContain('data:')
      expect(html).toContain('href="#"')
    })

    it('escapes img tags with data: URLs (prevents HTML parsing)', () => {
      const html = renderMarkdownSafe('<img src="data:image/svg+xml,<svg onload=alert(1)>">')
      // Security: the <img tag is escaped, so data: URL never loads
      expect(html).not.toContain('<img')
      expect(html).toContain('&lt;img')
    })

    it('does not allow base64 data: URLs', () => {
      const html = renderMarkdownSafe('[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)')
      expect(html).not.toContain('data:')
      expect(html).toContain('href="#"')
    })
  })

  describe('HTML entity escaping', () => {
    it('escapes HTML entities in code blocks', () => {
      const src = '```\n<div>&</div>\n```'
      const html = renderMarkdownSafe(src)
      expect(html).toContain('&lt;div&gt;&amp;&lt;/div&gt;')
      expect(html).not.toContain('<div>')
    })

    it('escapes ampersands in regular text', () => {
      const html = renderMarkdownSafe('Tom & Jerry')
      expect(html).toContain('Tom &amp; Jerry')
    })

    it('escapes less-than signs in regular text', () => {
      const html = renderMarkdownSafe('5 < 10')
      expect(html).toContain('5 &lt; 10')
    })

    it('escapes greater-than signs in regular text', () => {
      const html = renderMarkdownSafe('10 > 5')
      expect(html).toContain('10 &gt; 5')
    })

    it('escapes quotes in link URLs', () => {
      const html = renderMarkdownSafe('[link](https://example.com/path?a="b")')
      // Quotes in URL should be escaped to prevent attribute breakout
      expect(html).toContain('&quot;')
      // The href attribute should remain properly quoted
      expect(html).toMatch(/href="https:\/\/example\.com\/path\?a=&quot;b&quot;"/)
    })
  })

  describe('safe markdown formatting', () => {
    it('allows bold text', () => {
      const html = renderMarkdownSafe('**bold**')
      expect(html).toContain('<strong>bold</strong>')
    })

    it('allows italic text', () => {
      const html = renderMarkdownSafe('*italic*')
      expect(html).toContain('<em>italic</em>')
    })

    it('allows inline code', () => {
      const html = renderMarkdownSafe('`code`')
      expect(html).toContain('<code>code</code>')
    })

    it('allows https links', () => {
      const html = renderMarkdownSafe('[link](https://example.com)')
      expect(html).toContain('<a href="https://example.com"')
    })

    it('allows http links', () => {
      const html = renderMarkdownSafe('[link](http://example.com)')
      expect(html).toContain('<a href="http://example.com"')
    })

    it('allows mailto links', () => {
      const html = renderMarkdownSafe('[email](mailto:test@example.com)')
      expect(html).toContain('<a href="mailto:test@example.com"')
    })

    it('allows headings', () => {
      const html = renderMarkdownSafe('# Heading')
      expect(html).toContain('<h1>Heading</h1>')
    })

    it('allows lists', () => {
      const html = renderMarkdownSafe('- item 1\n- item 2')
      expect(html).toContain('<ul>')
      expect(html).toContain('<li>item 1</li>')
    })

    it('allows code blocks', () => {
      const html = renderMarkdownSafe('```js\nconst x = 1\n```')
      expect(html).toContain('<pre class="md-code')
      expect(html).toContain('<code class="language-js">')
    })

    it('adds rel="noopener noreferrer" to links', () => {
      const html = renderMarkdownSafe('[link](https://example.com)')
      expect(html).toContain('rel="noopener noreferrer"')
    })
  })

  describe('edge cases and bypass attempts', () => {
    it('handles null-byte injection', () => {
      const html = renderMarkdownSafe('<scr\0ipt>alert(1)</script>')
      expect(html).not.toContain('<script')
    })

    it('handles Unicode confusables', () => {
      // Using full-width less-than sign
      const html = renderMarkdownSafe('＜script＞alert(1)＜/script＞')
      // Should not be converted to actual script tag
      expect(html).not.toContain('<script')
    })

    it('handles SVG-based XSS (escaped)', () => {
      const html = renderMarkdownSafe('<svg onload="alert(1)">')
      expect(html).not.toContain('<svg')
      expect(html).toContain('&lt;svg')
    })

    it('handles iframe injection (escaped)', () => {
      const html = renderMarkdownSafe('<iframe src="javascript:alert(1)">')
      expect(html).not.toContain('<iframe')
      expect(html).toContain('&lt;iframe')
    })

    it('handles style-based CSS injection (escaped)', () => {
      const html = renderMarkdownSafe('<style>body { background: url("javascript:alert(1)") }</style>')
      expect(html).not.toContain('<style')
      expect(html).toContain('&lt;style')
    })

    it('handles meta refresh injection (escaped)', () => {
      const html = renderMarkdownSafe('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">')
      expect(html).not.toContain('<meta')
      expect(html).toContain('&lt;meta')
    })

    it('handles object/embed injection (escaped)', () => {
      const html = renderMarkdownSafe('<object data="javascript:alert(1)"><embed src="javascript:alert(1)"></object>')
      expect(html).not.toContain('<object')
      expect(html).not.toContain('<embed')
    })

    it('handles vbscript: URLs', () => {
      const html = renderMarkdownSafe('[click](vbscript:msgbox("xss"))')
      expect(html).not.toContain('vbscript:')
      expect(html).toContain('href="#"')
    })

    it('handles expression() in inline styles (escaped)', () => {
      const html = renderMarkdownSafe('<div style="width:expression(alert(1))">')
      expect(html).not.toContain('<div')
      expect(html).toContain('&lt;div')
    })

    it('prevents attribute breakout via quotes', () => {
      const html = renderMarkdownSafe('[">click](https://example.com)')
      // The quote should be escaped, not allow breakout
      expect(html).not.toMatch(/<a href="[^"]*"><[^>]*click/)
    })
  })
})
