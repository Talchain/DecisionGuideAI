/**
 * Tests for header parsing and case-insensitivity
 *
 * Verifies:
 * - extractResponseHeaders handles lowercase headers (new standard)
 * - extractResponseHeaders handles mixed-case headers (backward compat)
 * - getHeaderCaseInsensitive helper works correctly
 * - OBSERVABILITY_HEADERS constants are correct
 */

import { describe, it, expect } from 'vitest'
import {
  extractResponseHeaders,
  getHeaderCaseInsensitive,
  OBSERVABILITY_HEADERS,
} from '../debug-state'

describe('header-parsing', () => {
  describe('OBSERVABILITY_HEADERS', () => {
    it('defines all required header names in lowercase', () => {
      expect(OBSERVABILITY_HEADERS.RESPONSE_HASH).toBe('x-olumi-response-hash')
      expect(OBSERVABILITY_HEADERS.SERVICE).toBe('x-olumi-service')
      expect(OBSERVABILITY_HEADERS.SERVICE_BUILD).toBe('x-olumi-service-build')
      expect(OBSERVABILITY_HEADERS.PAYLOAD_HASH).toBe('x-olumi-payload-hash')
      expect(OBSERVABILITY_HEADERS.UPSTREAM_HOST).toBe('x-olumi-upstream-host')
      expect(OBSERVABILITY_HEADERS.REQUEST_ID).toBe('x-request-id')
    })

    it('all header names are lowercase', () => {
      for (const value of Object.values(OBSERVABILITY_HEADERS)) {
        expect(value).toBe(value.toLowerCase())
      }
    })
  })

  describe('getHeaderCaseInsensitive', () => {
    it('extracts header with exact case match', () => {
      const headers = new Headers({
        'x-olumi-response-hash': 'abc123def456',
      })
      const value = getHeaderCaseInsensitive(headers, 'x-olumi-response-hash')
      expect(value).toBe('abc123def456')
    })

    it('extracts header with different case (uppercase query)', () => {
      const headers = new Headers({
        'x-olumi-response-hash': 'abc123def456',
      })
      const value = getHeaderCaseInsensitive(headers, 'X-OLUMI-RESPONSE-HASH')
      expect(value).toBe('abc123def456')
    })

    it('extracts header with different case (mixed case query)', () => {
      const headers = new Headers({
        'x-olumi-response-hash': 'abc123def456',
      })
      const value = getHeaderCaseInsensitive(headers, 'X-Olumi-Response-Hash')
      expect(value).toBe('abc123def456')
    })

    it('returns undefined for missing header', () => {
      const headers = new Headers({})
      const value = getHeaderCaseInsensitive(headers, 'x-olumi-response-hash')
      expect(value).toBeUndefined()
    })

    it('handles headers set with mixed case', () => {
      const headers = new Headers()
      headers.set('X-Olumi-Response-Hash', 'abc123def456')
      const value = getHeaderCaseInsensitive(headers, 'x-olumi-response-hash')
      expect(value).toBe('abc123def456')
    })
  })

  describe('extractResponseHeaders', () => {
    describe('lowercase headers (new standard)', () => {
      it('extracts all observability headers', () => {
        const headers = new Headers({
          'x-olumi-response-hash': 'abc123def456',
          'x-olumi-service': 'cee',
          'x-olumi-service-build': 'be73e52',
          'x-olumi-upstream-host': 'cee-prod-01',
          'x-request-id': 'req-123-456',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('abc123def456')
        expect(extracted.service).toBe('cee')
        expect(extracted.serviceBuild).toBe('be73e52')
        expect(extracted.upstreamHost).toBe('cee-prod-01')
        expect(extracted.requestIdEcho).toBe('req-123-456')
      })

      it('handles partial headers', () => {
        const headers = new Headers({
          'x-olumi-response-hash': 'abc123def456',
          'x-olumi-service': 'cee',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('abc123def456')
        expect(extracted.service).toBe('cee')
        expect(extracted.serviceBuild).toBeUndefined()
        expect(extracted.upstreamHost).toBeUndefined()
        expect(extracted.requestIdEcho).toBeUndefined()
      })

      it('handles empty headers', () => {
        const headers = new Headers({})

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBeUndefined()
        expect(extracted.service).toBeUndefined()
        expect(extracted.serviceBuild).toBeUndefined()
        expect(extracted.upstreamHost).toBeUndefined()
        expect(extracted.requestIdEcho).toBeUndefined()
      })
    })

    describe('mixed-case headers (backward compatibility)', () => {
      it('extracts headers sent with mixed case', () => {
        const headers = new Headers({
          'X-Olumi-Response-Hash': 'abc123def456',
          'X-Olumi-Service': 'cee',
          'X-Olumi-Service-Build': 'be73e52',
          'X-Olumi-Upstream-Host': 'cee-prod-01',
          'X-Request-Id': 'req-123-456',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('abc123def456')
        expect(extracted.service).toBe('cee')
        expect(extracted.serviceBuild).toBe('be73e52')
        expect(extracted.upstreamHost).toBe('cee-prod-01')
        expect(extracted.requestIdEcho).toBe('req-123-456')
      })

      it('extracts headers sent with uppercase', () => {
        const headers = new Headers({
          'X-OLUMI-RESPONSE-HASH': 'abc123def456',
          'X-OLUMI-SERVICE': 'plot',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('abc123def456')
        expect(extracted.service).toBe('plot')
      })

      it('extracts headers sent with various casing patterns', () => {
        // Test real-world scenarios where different services might use different casing
        const headers = new Headers()
        headers.set('x-olumi-response-hash', 'hash1') // lowercase
        headers.set('X-Olumi-Service', 'isl') // Pascal case
        headers.set('X-OLUMI-SERVICE-BUILD', 'v2.0.0') // uppercase

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('hash1')
        expect(extracted.service).toBe('isl')
        expect(extracted.serviceBuild).toBe('v2.0.0')
      })
    })

    describe('service-specific responses', () => {
      it('handles CEE response headers', () => {
        const headers = new Headers({
          'x-olumi-response-hash': 'cee-hash-123',
          'x-olumi-service': 'cee',
          'x-olumi-service-build': 'cee-v1.2.3',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('cee-hash-123')
        expect(extracted.service).toBe('cee')
        expect(extracted.serviceBuild).toBe('cee-v1.2.3')
      })

      it('handles PLoT response headers', () => {
        const headers = new Headers({
          'x-olumi-response-hash': 'plot-hash-456',
          'x-olumi-service': 'plot',
          'x-olumi-service-build': 'plot-v2.0.0',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('plot-hash-456')
        expect(extracted.service).toBe('plot')
        expect(extracted.serviceBuild).toBe('plot-v2.0.0')
      })

      it('handles ISL response headers', () => {
        const headers = new Headers({
          'x-olumi-response-hash': 'isl-hash-789',
          'x-olumi-service': 'isl',
          'x-olumi-service-build': 'isl-v3.0.0',
        })

        const extracted = extractResponseHeaders(headers)

        expect(extracted.responseHash).toBe('isl-hash-789')
        expect(extracted.service).toBe('isl')
        expect(extracted.serviceBuild).toBe('isl-v3.0.0')
      })
    })

    describe('real-world response simulation', () => {
      it('handles mock Response with lowercase headers (new backend)', () => {
        const response = new Response('{}', {
          headers: {
            'x-olumi-response-hash': 'abc123def456',
            'x-olumi-service': 'cee',
            'x-olumi-service-build': 'be73e52',
          },
        })

        const extracted = extractResponseHeaders(response.headers)

        expect(extracted.responseHash).toBe('abc123def456')
        expect(extracted.service).toBe('cee')
        expect(extracted.serviceBuild).toBe('be73e52')
      })

      it('handles mock Response with mixed-case headers (legacy backend)', () => {
        const response = new Response('{}', {
          headers: {
            'X-Olumi-Response-Hash': 'xyz789abc012',
            'X-Olumi-Service': 'plot',
            'X-Olumi-Service-Build': 'abc1234',
          },
        })

        const extracted = extractResponseHeaders(response.headers)

        expect(extracted.responseHash).toBe('xyz789abc012')
        expect(extracted.service).toBe('plot')
        expect(extracted.serviceBuild).toBe('abc1234')
      })
    })
  })
})
