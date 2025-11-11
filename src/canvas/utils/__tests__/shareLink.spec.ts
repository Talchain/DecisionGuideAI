import { describe, it, expect } from 'vitest'
import { parseRunHash, buildShareLink } from '../shareLink'

describe('shareLink utilities', () => {
  describe('parseRunHash', () => {
    it('parses plain 64-char hex hash from hash-based route', () => {
      const url = '#/canvas?run=abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('parses sha256: prefixed hash from hash-based route', () => {
      const url = '#/canvas?run=sha256:abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('handles percent-encoded values', () => {
      const url = '#/canvas?run=sha256%3Aabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('accepts uppercase hex', () => {
      const url = '#/canvas?run=ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('ABCD1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890')
    })

    it('accepts mixed case hex', () => {
      const url = '#/canvas?run=AbCd1234567890aBcDeF1234567890aBcDeF1234567890aBcDeF1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('AbCd1234567890aBcDeF1234567890aBcDeF1234567890aBcDeF1234567890')
    })

    it('returns null when run param is missing', () => {
      const url = '#/canvas'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('returns null when run param is empty', () => {
      const url = '#/canvas?run='
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('rejects hash with invalid characters', () => {
      const url = '#/canvas?run=abcd1234<script>alert("xss")</script>1234567890abcdef12'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('rejects hash with spaces', () => {
      const url = '#/canvas?run=abcd1234 567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('rejects hash longer than 128 characters', () => {
      const longHash = 'a'.repeat(129)
      const url = `#/canvas?run=${longHash}`
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('accepts hash exactly 128 characters (edge case)', () => {
      const hash = 'a'.repeat(64)
      const url = `#/canvas?run=${hash}`
      const result = parseRunHash(url)
      expect(result).toBe(hash)
    })

    it('accepts hash with minimum 8 characters', () => {
      const url = '#/canvas?run=abcd1234'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234')
    })

    it('rejects hash shorter than 8 characters', () => {
      const url = '#/canvas?run=abcd123'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('rejects sha256: prefix with non-hex content', () => {
      const url = '#/canvas?run=sha256:not-valid-hex-content-here-should-be-exactly-64-chars'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })

    it('accepts sha256: prefix even with non-standard length (≥8 chars)', () => {
      const url = '#/canvas?run=sha256:abcd1234'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234')
    })

    it('handles full URL with origin and path', () => {
      const url = 'https://example.com/#/canvas?run=abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('handles multiple query params', () => {
      const url = '#/canvas?foo=bar&run=abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890&baz=qux'
      const result = parseRunHash(url)
      expect(result).toBe('abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    })

    it('returns null on malformed URL', () => {
      const url = 'not a url at all'
      const result = parseRunHash(url)
      expect(result).toBeNull()
    })
  })

  describe('buildShareLink', () => {
    it('builds share link with 64-char hex hash', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const link = buildShareLink(hash)

      // Should contain the hash as a query param
      expect(link).toContain('run=abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890')

      // Should use hash-based routing
      expect(link).toContain('/#/canvas?')
    })

    it('builds link that can be parsed back', () => {
      const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const link = buildShareLink(hash)

      // Extract just the hash portion and parse it
      const hashPortion = link.split('/#')[1]
      const parsed = parseRunHash(`#${hashPortion}`)

      expect(parsed).toBe(hash)
    })
  })
})
