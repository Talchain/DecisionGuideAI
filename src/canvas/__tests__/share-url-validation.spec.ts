/**
 * Share URL Validation Tests
 *
 * Tests for secure share URL generation to prevent injection attacks
 */

import { describe, it, expect } from 'vitest'

/**
 * Validates that a hash only contains safe characters
 * Hash should only contain alphanumeric characters and hyphens
 */
function validateHash(hash: string): boolean {
  const sanitizedHash = hash.replace(/[^a-zA-Z0-9-]/g, '')
  return sanitizedHash === hash
}

describe('Share URL Security', () => {
  describe('Hash Validation', () => {
    it('accepts valid alphanumeric hashes', () => {
      expect(validateHash('abc123')).toBe(true)
      expect(validateHash('ABC123')).toBe(true)
      expect(validateHash('0123456789')).toBe(true)
    })

    it('accepts hashes with hyphens', () => {
      expect(validateHash('abc-123')).toBe(true)
      expect(validateHash('test-hash-123')).toBe(true)
      expect(validateHash('a-b-c-1-2-3')).toBe(true)
    })

    it('rejects hashes with special characters', () => {
      expect(validateHash('abc<script>')).toBe(false)
      expect(validateHash('test;alert(1)')).toBe(false)
      expect(validateHash('hash&param=val')).toBe(false)
    })

    it('rejects hashes with URL special characters', () => {
      expect(validateHash('hash?param=value')).toBe(false)
      expect(validateHash('hash#anchor')).toBe(false)
      expect(validateHash('hash/path')).toBe(false)
      expect(validateHash('hash=value')).toBe(false)
    })

    it('rejects hashes with injection attempts', () => {
      expect(validateHash('"><script>alert(1)</script>')).toBe(false)
      expect(validateHash("' OR '1'='1")).toBe(false)
      expect(validateHash('javascript:alert(1)')).toBe(false)
      expect(validateHash('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('rejects hashes with encoded characters', () => {
      expect(validateHash('abc%20123')).toBe(false)
      expect(validateHash('test%3Cscript%3E')).toBe(false)
    })

    it('rejects hashes with control characters', () => {
      expect(validateHash('test\x00null')).toBe(false)
      expect(validateHash('hash\nnewline')).toBe(false)
      expect(validateHash('tab\there')).toBe(false)
    })

    it('rejects hashes with unicode characters', () => {
      expect(validateHash('test™hash')).toBe(false)
      expect(validateHash('hash你好')).toBe(false)
      expect(validateHash('test🎉hash')).toBe(false)
    })
  })

  describe('URL Construction', () => {
    it('properly encodes valid hashes', () => {
      const hash = 'abc-123'
      const url = `${window.location.origin}${window.location.pathname}#run=${encodeURIComponent(hash)}`
      expect(url).toContain('#run=abc-123')
    })

    it('encodes hashes with special characters if validation was missed', () => {
      const hash = 'test&param=value'
      const encoded = encodeURIComponent(hash)
      expect(encoded).toBe('test%26param%3Dvalue')
      expect(encoded).not.toContain('&')
      expect(encoded).not.toContain('=')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty hash', () => {
      expect(validateHash('')).toBe(true) // Empty string technically passes
    })

    it('handles very long hashes', () => {
      const longHash = 'a'.repeat(1000)
      expect(validateHash(longHash)).toBe(true)
    })

    it('handles hashes with only hyphens', () => {
      expect(validateHash('---')).toBe(true)
    })

    it('handles mixed case', () => {
      expect(validateHash('AbC-123-XyZ')).toBe(true)
    })
  })

  describe('Real-world Attack Vectors', () => {
    const attackVectors = [
      '<img src=x onerror=alert(1)>',
      '"><script>alert(document.cookie)</script>',
      "' onload='alert(1)'",
      'javascript:void(0)',
      'data:text/html,<script>alert(1)</script>',
      '../../../etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
      '${alert(1)}',
      '{{7*7}}',
      '#{7*7}',
      '<svg onload=alert(1)>',
      '<iframe src=javascript:alert(1)>',
      'vbscript:msgbox(1)',
    ]

    attackVectors.forEach(vector => {
      it(`blocks attack vector: ${vector.substring(0, 30)}...`, () => {
        expect(validateHash(vector)).toBe(false)
      })
    })
  })
})
