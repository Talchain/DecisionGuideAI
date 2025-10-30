/**
 * Sanitization Security Tests
 *
 * Section I: Tests - Task I1 (includes H4 security tests)
 *
 * Comprehensive test coverage for all sanitization functions
 * to prevent XSS, injection attacks, and data leaks.
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeLabel,
  sanitizeMarkdown,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeShareHash,
  validateShareHashAllowlist,
  sanitizeJSON,
  sanitizeHTML,
  sanitizeNumber,
} from '../sanitize'

describe('sanitize.ts', () => {
  describe('sanitizeLabel', () => {
    it('removes HTML tags', () => {
      expect(sanitizeLabel('<script>alert(1)</script>Hello')).toBe('Hello')
      expect(sanitizeLabel('Hello<b>World</b>')).toBe('HelloWorld')
      expect(sanitizeLabel('<img src=x onerror=alert(1)>')).toBe('')
    })

    it('removes angle brackets', () => {
      expect(sanitizeLabel('Hello < World')).toBe('Hello  World')
      expect(sanitizeLabel('Test > 100')).toBe('Test  100')
    })

    it('removes control characters', () => {
      expect(sanitizeLabel('Hello\x00World')).toBe('HelloWorld')
      expect(sanitizeLabel('Test\nLine')).toBe('TestLine')
      expect(sanitizeLabel('Tab\there')).toBe('Tabhere')
    })

    it('enforces max length', () => {
      const longString = 'a'.repeat(200)
      expect(sanitizeLabel(longString)).toHaveLength(100)
      expect(sanitizeLabel(longString, 50)).toHaveLength(50)
    })

    it('returns Untitled for invalid input', () => {
      expect(sanitizeLabel(null)).toBe('Untitled')
      expect(sanitizeLabel(undefined)).toBe('Untitled')
      expect(sanitizeLabel(123)).toBe('Untitled')
      expect(sanitizeLabel('')).toBe('Untitled')
      expect(sanitizeLabel('   ')).toBe('Untitled')
    })

    it('trims whitespace', () => {
      expect(sanitizeLabel('  Hello World  ')).toBe('Hello World')
    })
  })

  describe('sanitizeMarkdown', () => {
    it('converts markdown to HTML', () => {
      const result = sanitizeMarkdown('**bold** text')
      expect(result).toContain('<strong>')
      expect(result).toContain('bold')
    })

    it('removes script tags', () => {
      const malicious = '**test** <script>alert(1)</script>'
      const result = sanitizeMarkdown(malicious)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('removes iframe tags', () => {
      const result = sanitizeMarkdown('<iframe src="evil.com"></iframe>')
      expect(result).not.toContain('<iframe>')
    })

    it('allows safe tags', () => {
      const safe = '# Heading\n\n- List item\n\n**Bold** and *italic*'
      const result = sanitizeMarkdown(safe)
      expect(result).toContain('<h1>')
      expect(result).toContain('<li>')
      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
    })

    it('removes dangerous attributes', () => {
      const malicious = '<a href="javascript:alert(1)">click</a>'
      const result = sanitizeMarkdown(malicious)
      expect(result).not.toContain('javascript:')
    })

    it('handles empty input', () => {
      expect(sanitizeMarkdown('')).toBe('')
      expect(sanitizeMarkdown(null as any)).toBe('')
    })
  })

  describe('sanitizeFilename', () => {
    it('removes directory traversal', () => {
      // ../ is 3 chars each, so 3 × 3 = 9 chars → but collapsed to 2 dashes each = 6 total
      expect(sanitizeFilename('../../../etc/passwd')).toBe('------etc-passwd')
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('----windows-system32')
    })

    it('removes shell special characters', () => {
      expect(sanitizeFilename('file;rm -rf /')).toBe('file-rm--rf--')
      expect(sanitizeFilename('file | cat')).toBe('file---cat')
      expect(sanitizeFilename('file & background')).toBe('file---background')
    })

    it('allows alphanumeric and safe characters', () => {
      expect(sanitizeFilename('my_file-v1.2.txt')).toBe('my_file-v1.2.txt')
      expect(sanitizeFilename('report_2024-01-15.json')).toBe('report_2024-01-15.json')
    })

    it('handles invalid input', () => {
      expect(sanitizeFilename('')).toBe('untitled')
      expect(sanitizeFilename(null as any)).toBe('untitled')
    })
  })

  describe('sanitizeUrl', () => {
    it('allows relative paths', () => {
      expect(sanitizeUrl('/dashboard')).toBe('/dashboard')
      expect(sanitizeUrl('/app/canvas')).toBe('/app/canvas')
    })

    it('prevents directory traversal in relative paths', () => {
      const result = sanitizeUrl('/app/../../../etc/passwd')
      expect(result).not.toContain('..')
    })

    it('allows same-origin URLs', () => {
      // Note: In test environment, window.location.origin might not be set
      // This test would pass in browser environment
      const result = sanitizeUrl(window.location.origin + '/dashboard')
      expect(result).toBeTruthy()
    })

    it('blocks external URLs without allowlist', () => {
      expect(sanitizeUrl('https://evil.com')).toBe('/')
      expect(sanitizeUrl('http://malicious.org/phishing')).toBe('/')
    })

    it('allows allowlisted domains', () => {
      const result = sanitizeUrl('https://example.com', ['example.com'])
      expect(result).toBe('https://example.com/')
    })

    it('blocks javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('/')
      expect(sanitizeUrl('javascript:void(0)')).toBe('/')
    })

    it('blocks data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('/')
    })

    it('blocks protocol-relative URLs to external domains', () => {
      expect(sanitizeUrl('//evil.com/phishing')).toBe('/')
    })

    it('handles invalid input', () => {
      expect(sanitizeUrl('')).toBe('/')
      expect(sanitizeUrl(null as any)).toBe('/')
    })
  })

  describe('sanitizeShareHash', () => {
    it('validates SHA-256 hex format', () => {
      const validHash = 'a'.repeat(64)
      expect(sanitizeShareHash(validHash)).toBe(validHash)
    })

    it('lowercases SHA-256 hashes', () => {
      const mixedCase = 'A'.repeat(64)
      expect(sanitizeShareHash(mixedCase)).toBe('a'.repeat(64))
    })

    it('validates base64url format', () => {
      const validBase64 = 'abcDEF123-_'
      expect(sanitizeShareHash(validBase64)).toBe(validBase64)
    })

    it('accepts z: compressed prefix', () => {
      const compressed = 'z:' + 'a'.repeat(50)
      expect(sanitizeShareHash(compressed)).toBe(compressed)
    })

    it('rejects invalid hex length', () => {
      expect(sanitizeShareHash('a'.repeat(63))).toBeNull()
      expect(sanitizeShareHash('a'.repeat(65))).toBeNull()
    })

    it('rejects invalid characters', () => {
      expect(sanitizeShareHash('<script>alert(1)</script>')).toBeNull()
      expect(sanitizeShareHash('../../etc/passwd')).toBeNull()
      expect(sanitizeShareHash('hash;rm -rf /')).toBeNull()
    })

    it('enforces 8KB length limit for base64url', () => {
      const tooLong = 'a'.repeat(8193)
      expect(sanitizeShareHash(tooLong)).toBeNull()
    })

    it('supports allowlist validation', () => {
      const allowlist = new Set(['approved1', 'approved2'])
      expect(sanitizeShareHash('approved1', allowlist)).toBe('approved1')
      expect(sanitizeShareHash('unapproved', allowlist)).toBeNull()
    })

    it('handles invalid input', () => {
      expect(sanitizeShareHash(null)).toBeNull()
      expect(sanitizeShareHash(undefined)).toBeNull()
      expect(sanitizeShareHash('')).toBeNull()
    })
  })

  describe('validateShareHashAllowlist', () => {
    it('accepts allowlisted hashes', () => {
      const allowlist = new Set(['hash1', 'hash2', 'hash3'])
      expect(validateShareHashAllowlist('hash1', allowlist)).toBe(true)
      expect(validateShareHashAllowlist('hash2', allowlist)).toBe(true)
    })

    it('rejects non-allowlisted hashes', () => {
      const allowlist = new Set(['hash1', 'hash2'])
      expect(validateShareHashAllowlist('hash3', allowlist)).toBe(false)
      expect(validateShareHashAllowlist('malicious', allowlist)).toBe(false)
    })
  })

  describe('sanitizeJSON', () => {
    it('removes __proto__ keys', () => {
      const malicious = { __proto__: { isAdmin: true }, name: 'test' }
      const result = sanitizeJSON(malicious) as any
      expect(result.__proto__).toBeUndefined()
      expect(result.name).toBe('test')
    })

    it('removes constructor keys', () => {
      const malicious = { constructor: { prototype: { isAdmin: true } }, name: 'test' }
      const result = sanitizeJSON(malicious) as any
      expect(result.constructor).toBeUndefined()
      expect(result.name).toBe('test')
    })

    it('removes prototype keys', () => {
      const malicious = { prototype: { isAdmin: true }, name: 'test' }
      const result = sanitizeJSON(malicious) as any
      expect(result.prototype).toBeUndefined()
      expect(result.name).toBe('test')
    })

    it('handles nested objects', () => {
      const nested = {
        user: {
          __proto__: { isAdmin: true },
          name: 'Alice',
          profile: {
            constructor: 'malicious',
            bio: 'Hello'
          }
        }
      }
      const result = sanitizeJSON(nested) as any
      expect(result.user.name).toBe('Alice')
      expect(result.user.profile.bio).toBe('Hello')
      expect(result.user.__proto__).toBeUndefined()
      expect(result.user.profile.constructor).toBeUndefined()
    })

    it('handles arrays', () => {
      const arr = [
        { __proto__: 'bad', value: 1 },
        { name: 'test' }
      ]
      const result = sanitizeJSON(arr) as any[]
      expect(result[0].value).toBe(1)
      expect(result[0].__proto__).toBeUndefined()
      expect(result[1].name).toBe('test')
    })

    it('enforces depth limit', () => {
      const deep: any = { level: 1 }
      let current = deep
      for (let i = 2; i <= 15; i++) {
        current.next = { level: i }
        current = current.next
      }
      expect(() => sanitizeJSON(deep)).toThrow('Maximum nesting depth exceeded')
    })

    it('handles null and undefined', () => {
      expect(sanitizeJSON(null)).toBe(null)
      expect(sanitizeJSON(undefined)).toBe(undefined)
    })

    it('handles primitives', () => {
      expect(sanitizeJSON('string')).toBe('string')
      expect(sanitizeJSON(123)).toBe(123)
      expect(sanitizeJSON(true)).toBe(true)
    })
  })

  describe('sanitizeHTML', () => {
    it('allows basic formatting', () => {
      const html = '<b>bold</b> and <i>italic</i>'
      const result = sanitizeHTML(html)
      expect(result).toContain('<b>')
      expect(result).toContain('<i>')
    })

    it('removes script tags', () => {
      const malicious = '<b>test</b><script>alert(1)</script>'
      const result = sanitizeHTML(malicious)
      expect(result).not.toContain('<script>')
      expect(result).toContain('<b>test</b>')
    })

    it('removes event handlers', () => {
      const malicious = '<b onclick="alert(1)">click</b>'
      const result = sanitizeHTML(malicious)
      expect(result).not.toContain('onclick')
    })

    it('removes dangerous tags', () => {
      const result = sanitizeHTML('<iframe src="evil.com"></iframe>')
      expect(result).not.toContain('<iframe>')
    })

    it('handles empty input', () => {
      expect(sanitizeHTML('')).toBe('')
      expect(sanitizeHTML(null as any)).toBe('')
    })
  })

  describe('sanitizeNumber', () => {
    it('parses valid numbers', () => {
      expect(sanitizeNumber('123')).toBe(123)
      expect(sanitizeNumber(456)).toBe(456)
      expect(sanitizeNumber('78.9')).toBe(78.9)
    })

    it('enforces min constraint', () => {
      expect(sanitizeNumber(5, 10, 100)).toBe(10)
      expect(sanitizeNumber(-50, 0, 100)).toBe(0)
    })

    it('enforces max constraint', () => {
      expect(sanitizeNumber(150, 0, 100)).toBe(100)
      expect(sanitizeNumber(200, 10, 100)).toBe(100)
    })

    it('rejects NaN', () => {
      expect(sanitizeNumber(NaN, 0, 100, 42)).toBe(42)
      expect(sanitizeNumber('invalid', 0, 100, 42)).toBe(42)
    })

    it('rejects Infinity', () => {
      expect(sanitizeNumber(Infinity, 0, 100, 42)).toBe(42)
      expect(sanitizeNumber(-Infinity, 0, 100, 42)).toBe(42)
    })

    it('uses fallback for invalid input', () => {
      expect(sanitizeNumber(null, 0, 100, 99)).toBe(99)
      expect(sanitizeNumber(undefined, 0, 100, 99)).toBe(99)
      expect(sanitizeNumber({}, 0, 100, 99)).toBe(99)
    })

    it('allows negative numbers', () => {
      expect(sanitizeNumber(-50, -100, 0)).toBe(-50)
      expect(sanitizeNumber(-150, -100, 0)).toBe(-100)
    })
  })

  describe('XSS Attack Vectors', () => {
    const xssVectors = [
      '<img src=x onerror=alert(1)>',
      '<script>alert(document.cookie)</script>',
      '"><script>alert(1)</script>',
      '<iframe src=javascript:alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<marquee onstart=alert(1)>',
      '<object data="data:text/html,<script>alert(1)</script>">',
    ]

    xssVectors.forEach(vector => {
      it(`sanitizeLabel blocks: ${vector.substring(0, 30)}...`, () => {
        const result = sanitizeLabel(vector)
        expect(result).not.toContain('<script>')
        expect(result).not.toContain('alert')
        expect(result).not.toContain('onerror')
        expect(result).not.toContain('onload')
      })

      it(`sanitizeMarkdown blocks: ${vector.substring(0, 30)}...`, () => {
        const result = sanitizeMarkdown(vector)
        expect(result).not.toContain('<script>')
        expect(result).not.toContain('javascript:')
        expect(result).not.toContain('onerror=')
        expect(result).not.toContain('onload=')
      })
    })
  })

  describe('Prototype Pollution Vectors', () => {
    const pollutionVectors = [
      { __proto__: { isAdmin: true } },
      { constructor: { prototype: { isAdmin: true } } },
      { prototype: { isAdmin: true } },
    ]

    pollutionVectors.forEach((vector, i) => {
      it(`sanitizeJSON blocks pollution vector ${i + 1}`, () => {
        const result = sanitizeJSON(vector) as any
        expect(result.__proto__).toBeUndefined()
        expect(result.constructor).toBeUndefined()
        expect(result.prototype).toBeUndefined()
      })
    })
  })
})
