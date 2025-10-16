import { describe, it, expect } from 'vitest'
import { sanitizeLabel } from '../persist'

describe('Security: Malicious Payload Sanitization', () => {
  describe('XSS Prevention', () => {
    it('strips script tags', () => {
      expect(sanitizeLabel('<script>alert("xss")</script>')).toBe('alert("xss")')
      expect(sanitizeLabel('<script src="evil.js"></script>')).toBe('Untitled')
      expect(sanitizeLabel('Hello<script>alert(1)</script>World')).toBe('HelloWorld')
    })

    it('strips event handlers', () => {
      expect(sanitizeLabel('<img src="x" onerror="alert(1)">')).toBe('Untitled')
      expect(sanitizeLabel('<div onclick="alert(1)">Click</div>')).toBe('Click')
      expect(sanitizeLabel('<a href="javascript:alert(1)">Link</a>')).toBe('Link')
    })

    it('strips iframe tags', () => {
      expect(sanitizeLabel('<iframe src="evil.com"></iframe>')).toBe('Untitled')
      expect(sanitizeLabel('Text<iframe>bad</iframe>More')).toBe('TextMore')
    })

    it('strips object and embed tags', () => {
      expect(sanitizeLabel('<object data="evil.swf"></object>')).toBe('Untitled')
      expect(sanitizeLabel('<embed src="evil.swf">')).toBe('Untitled')
    })
  })

  describe('Encoded Payloads', () => {
    it('handles HTML entities', () => {
      expect(sanitizeLabel('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(sanitizeLabel('Test &amp; More')).toBe('Test &amp; More')
    })

    it('handles URL encoded payloads', () => {
      expect(sanitizeLabel('%3Cscript%3Ealert(1)%3C/script%3E')).toBe('%3Cscript%3Ealert(1)%3C/script%3E')
    })
  })

  describe('Control Characters', () => {
    it('removes null bytes', () => {
      expect(sanitizeLabel('Test\x00Null')).toBe('TestNull')
      expect(sanitizeLabel('\x00\x00\x00')).toBe('Untitled')
    })

    it('removes control characters', () => {
      expect(sanitizeLabel('Test\x01\x02\x03')).toBe('Test')
      expect(sanitizeLabel('\x1F\x7F')).toBe('Untitled')
    })

    it('preserves newlines and tabs', () => {
      expect(sanitizeLabel('Line1\nLine2')).toBe('Line1\nLine2')
      expect(sanitizeLabel('Tab\tSeparated')).toBe('Tab\tSeparated')
    })
  })

  describe('Length Limits', () => {
    it('truncates long labels to 100 chars', () => {
      const long = 'A'.repeat(150)
      const result = sanitizeLabel(long)
      expect(result.length).toBe(100)
    })

    it('returns Untitled for empty after sanitization', () => {
      expect(sanitizeLabel('')).toBe('Untitled')
      expect(sanitizeLabel('   ')).toBe('Untitled')
      expect(sanitizeLabel('<><><>')).toBe('Untitled')
    })
  })

  describe('Combined Attacks', () => {
    it('handles multiple attack vectors', () => {
      const payload = '<script>alert("xss")</script>\x00\x1F<img src=x onerror=alert(1)>'
      expect(sanitizeLabel(payload)).toBe('alert("xss")')
    })

    it('handles nested tags', () => {
      const payload = '<div><script><img src=x onerror=alert(1)></script></div>'
      expect(sanitizeLabel(payload)).toBe('Untitled')
    })

    it('handles mixed case tags', () => {
      expect(sanitizeLabel('<ScRiPt>alert(1)</sCrIpT>')).toBe('alert(1)')
      expect(sanitizeLabel('<IMG SRC="x" ONERROR="alert(1)">')).toBe('Untitled')
    })
  })

  describe('Edge Cases', () => {
    it('preserves safe special characters', () => {
      expect(sanitizeLabel('Test & More')).toBe('Test & More')
      expect(sanitizeLabel('Price: $100')).toBe('Price: $100')
      expect(sanitizeLabel('Math: 2 + 2 = 4')).toBe('Math: 2 + 2 = 4')
    })

    it('handles unicode characters', () => {
      expect(sanitizeLabel('Hello 世界')).toBe('Hello 世界')
      expect(sanitizeLabel('Emoji 🎉')).toBe('Emoji 🎉')
    })

    it('handles quotes and apostrophes', () => {
      expect(sanitizeLabel('It\'s a "test"')).toBe('It\'s a "test"')
      expect(sanitizeLabel('"Quoted"')).toBe('"Quoted"')
    })
  })

  describe('Real-World Attack Patterns', () => {
    it('blocks common XSS vectors from OWASP', () => {
      const vectors = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<select onfocus=alert(1) autofocus>',
        '<textarea onfocus=alert(1) autofocus>',
        '<iframe src="javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<a href="javascript:alert(1)">Click</a>'
      ]

      vectors.forEach(vector => {
        const result = sanitizeLabel(vector)
        expect(result).not.toContain('alert')
        expect(result).not.toContain('javascript:')
      })
    })

    it('blocks data URI attacks', () => {
      const payload = '<img src="data:text/html,<script>alert(1)</script>">'
      const result = sanitizeLabel(payload)
      expect(result).not.toContain('script')
      expect(result).not.toContain('data:')
    })

    it('blocks style-based attacks', () => {
      const payload = '<div style="background:url(javascript:alert(1))">Test</div>'
      const result = sanitizeLabel(payload)
      expect(result).not.toContain('javascript:')
    })
  })
})
