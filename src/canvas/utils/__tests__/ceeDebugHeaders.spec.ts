/**
 * Unit tests for CEE Debug Headers Parser (Phase 1 Section 4.1)
 */

import { describe, it, expect } from 'vitest'
import { parseCeeDebugHeaders, hasCeeDebugHeaders } from '../ceeDebugHeaders'

describe('parseCeeDebugHeaders', () => {
  describe('with Headers object', () => {
    it('parses all standard CEE debug headers', () => {
      const headers = new Headers()
      headers.set('X-Cee-Request-Id', 'req-abc-123')
      headers.set('X-Cee-Execution-Ms', '250')
      headers.set('X-Cee-Model-Version', 'cee-v1.2.3')
      headers.set('X-Cee-Degraded', 'true')

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({
        requestId: 'req-abc-123',
        executionMs: 250,
        modelVersion: 'cee-v1.2.3',
        degraded: true,
      })
    })

    it('parses degraded=false correctly', () => {
      const headers = new Headers()
      headers.set('X-Cee-Degraded', 'false')

      const result = parseCeeDebugHeaders(headers)

      expect(result.degraded).toBe(false)
    })

    it('handles missing headers gracefully', () => {
      const headers = new Headers()

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({})
    })

    it('ignores invalid executionMs values', () => {
      const headers = new Headers()
      headers.set('X-Cee-Execution-Ms', 'invalid')

      const result = parseCeeDebugHeaders(headers)

      expect(result).not.toHaveProperty('executionMs')
    })

    it('ignores negative executionMs values', () => {
      const headers = new Headers()
      headers.set('X-Cee-Execution-Ms', '-100')

      const result = parseCeeDebugHeaders(headers)

      expect(result).not.toHaveProperty('executionMs')
    })

    it('parses additional X-Cee-Debug-* headers', () => {
      const headers = new Headers()
      headers.set('X-Cee-Request-Id', 'req-123')
      headers.set('X-Cee-Debug-Cache-Hit', 'true')
      headers.set('X-Cee-Debug-Retry-Count', '2')

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({
        requestId: 'req-123',
        'cache-hit': 'true',
        'retry-count': '2',
      })
    })

    it('handles case-insensitive header lookups', () => {
      const headers = new Headers()
      headers.set('x-cee-request-id', 'req-lowercase')
      headers.set('X-CEE-EXECUTION-MS', '500')

      const result = parseCeeDebugHeaders(headers)

      expect(result.requestId).toBe('req-lowercase')
      expect(result.executionMs).toBe(500)
    })
  })

  describe('with Record<string, string>', () => {
    it('parses all standard CEE debug headers', () => {
      const headers = {
        'X-Cee-Request-Id': 'req-def-456',
        'X-Cee-Execution-Ms': '125',
        'X-Cee-Model-Version': 'cee-v2.0.0',
        'X-Cee-Degraded': 'false',
      }

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({
        requestId: 'req-def-456',
        executionMs: 125,
        modelVersion: 'cee-v2.0.0',
        degraded: false,
      })
    })

    it('handles case-insensitive header keys', () => {
      const headers = {
        'x-cee-request-id': 'req-mixed',
        'X-CEE-EXECUTION-MS': '300',
      }

      const result = parseCeeDebugHeaders(headers)

      expect(result.requestId).toBe('req-mixed')
      expect(result.executionMs).toBe(300)
    })

    it('parses additional X-Cee-Debug-* headers', () => {
      const headers = {
        'X-Cee-Request-Id': 'req-789',
        'X-Cee-Debug-Backend-Host': 'cee-prod-1',
        'X-Cee-Debug-Queue-Time-Ms': '50',
      }

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({
        requestId: 'req-789',
        'backend-host': 'cee-prod-1',
        'queue-time-ms': '50',
      })
    })

    it('handles empty headers object', () => {
      const headers = {}

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({})
    })
  })

  describe('edge cases', () => {
    it('handles degraded header with non-boolean values', () => {
      const headers = new Headers()
      headers.set('X-Cee-Degraded', 'yes')

      const result = parseCeeDebugHeaders(headers)

      expect(result.degraded).toBe(false) // Only "true" is truthy
    })

    it('handles zero executionMs', () => {
      const headers = new Headers()
      headers.set('X-Cee-Execution-Ms', '0')

      const result = parseCeeDebugHeaders(headers)

      expect(result.executionMs).toBe(0)
    })

    it('ignores non-CEE headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Request-Id': 'other-req-id',
        'X-Cee-Request-Id': 'cee-req-id',
      }

      const result = parseCeeDebugHeaders(headers)

      expect(result).toEqual({
        requestId: 'cee-req-id',
      })
      expect(result).not.toHaveProperty('Content-Type')
      expect(result).not.toHaveProperty('X-Request-Id')
    })
  })
})

describe('hasCeeDebugHeaders', () => {
  it('returns true when CEE debug headers are present', () => {
    const headers = new Headers()
    headers.set('X-Cee-Request-Id', 'req-123')

    expect(hasCeeDebugHeaders(headers)).toBe(true)
  })

  it('returns false when no CEE debug headers are present', () => {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    expect(hasCeeDebugHeaders(headers)).toBe(false)
  })

  it('returns false for empty headers', () => {
    const headers = new Headers()

    expect(hasCeeDebugHeaders(headers)).toBe(false)
  })

  it('works with Record<string, string>', () => {
    const headers = {
      'X-Cee-Model-Version': 'cee-v1.0.0',
    }

    expect(hasCeeDebugHeaders(headers)).toBe(true)
  })
})
