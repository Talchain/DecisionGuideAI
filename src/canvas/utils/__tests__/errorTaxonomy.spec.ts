/**
 * Unit tests for errorTaxonomy utility (Sprint 1 & 2)
 * Verifies error code → user-friendly message mapping
 */

import { describe, it, expect } from 'vitest'
import { mapErrorToUserMessage, isOffline } from '../errorTaxonomy'

describe('errorTaxonomy', () => {
  describe('mapErrorToUserMessage', () => {
    it('maps offline state to friendly message', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const result = mapErrorToUserMessage({
        code: 'NETWORK_ERROR',
        status: 0,
        message: 'Network request failed'
      })

      expect(result.title).toBe('No internet connection')
      expect(result.severity).toBe('warning')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('offline')
      expect(result.suggestion).toContain('editing')

      // Restore
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
    })

    it('maps CORS errors correctly', () => {
      const result = mapErrorToUserMessage({
        status: 0,
        message: 'Failed to fetch'
      })

      expect(result.title).toBe('Connection blocked')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(false)
      expect(result.message).toContain('CORS')
      expect(result.suggestion).toContain('support')
    })

    it('maps 405 Method Not Allowed', () => {
      const result = mapErrorToUserMessage({
        status: 405,
        message: 'Method not allowed'
      })

      expect(result.title).toBe('Endpoint not available')
      expect(result.severity).toBe('warning')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('operation')
    })

    it('maps 429 Rate Limited with retry-after', () => {
      const result = mapErrorToUserMessage({
        status: 429,
        message: 'Too many requests',
        retryAfter: 60000 // milliseconds
      })

      expect(result.title).toBe('Rate limit exceeded')
      expect(result.severity).toBe('warning')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('60 seconds')
      expect(result.suggestion).toContain('break')
    })

    it('maps timeout errors', () => {
      const result = mapErrorToUserMessage({
        code: 'TIMEOUT',
        message: 'Request timeout'
      })

      expect(result.title).toBe('Request timed out')
      expect(result.severity).toBe('warning')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('longer')
    })

    it('maps 503 Service Unavailable', () => {
      const result = mapErrorToUserMessage({
        status: 503,
        message: 'Service unavailable'
      })

      expect(result.title).toBe('Engine temporarily unavailable')
      expect(result.severity).toBe('warning')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('maintenance')
    })

    it('maps 500 Internal Server Error', () => {
      const result = mapErrorToUserMessage({
        status: 500,
        message: 'Internal server error'
      })

      expect(result.title).toBe('Engine error')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('went wrong')
    })

    it('maps 401/403 Authentication errors', () => {
      const result401 = mapErrorToUserMessage({
        status: 401,
        message: 'Unauthorized'
      })

      expect(result401.title).toBe('Access denied')
      expect(result401.severity).toBe('error')
      expect(result401.retryable).toBe(false)

      const result403 = mapErrorToUserMessage({
        status: 403,
        message: 'Forbidden'
      })

      expect(result403.title).toBe('Access denied')
    })

    it('maps 404 Not Found', () => {
      const result = mapErrorToUserMessage({
        status: 404,
        message: 'Not found'
      })

      expect(result.title).toBe('Endpoint not found')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(false)
      expect(result.message).toContain('found')
    })

    it('maps 400 Bad Request', () => {
      const result = mapErrorToUserMessage({
        status: 400,
        message: 'Invalid request'
      })

      expect(result.title).toBe('Invalid request')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(true)
      expect(result.message).toContain('Invalid request')
    })

    it('maps LIMIT_EXCEEDED code', () => {
      const result = mapErrorToUserMessage({
        code: 'LIMIT_EXCEEDED',
        message: 'Too many nodes'
      })

      expect(result.title).toBe('Graph too large')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(false)
      expect(result.message).toContain('Too many nodes')
      expect(result.suggestion).toContain('Reduce')
    })

    it('falls back to generic error for unknown codes', () => {
      const result = mapErrorToUserMessage({
        code: 'UNKNOWN_ERROR',
        status: 999,
        message: 'Something went wrong'
      })

      expect(result.title).toBe('Analysis failed')
      expect(result.severity).toBe('error')
      expect(result.retryable).toBe(true)
      expect(result.message).toBe('Something went wrong')
    })

    it('handles missing message field', () => {
      const result = mapErrorToUserMessage({
        status: 500
      })

      expect(result.title).toBe('Engine error')
      expect(result.message).toBeTruthy()
    })
  })

  describe('isOffline', () => {
    it('returns true when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      expect(isOffline()).toBe(true)

      // Restore
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })
    })

    it('returns false when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      expect(isOffline()).toBe(false)
    })
  })
})
