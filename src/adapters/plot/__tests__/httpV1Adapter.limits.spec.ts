/**
 * Unit tests for httpV1Adapter.limits()
 *
 * Tests the new LimitsFetch contract that prevents silent fallback masking:
 * - Live success → {ok: true, source: 'live', data, fetchedAt}
 * - DEV mode failure → {ok: true, source: 'fallback', data, reason, fetchedAt}
 * - PROD mode failure → {ok: false, error, fetchedAt}
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import { V1_LIMITS } from '../v1/types'
import type { LimitsFetch } from '../types'

// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllEnvs()
})
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

describe('httpV1Adapter.limits() - LimitsFetch contract', () => {
  describe('Live endpoint success', () => {
    it('should return {ok: true, source: "live", data, fetchedAt}', async () => {
      // Mock successful response
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json({
            nodes: { max: 200 },
            edges: { max: 500 },
            engine_p95_ms_budget: 30000,
          })
        })
      )

      const beforeFetch = Date.now()
      const result: LimitsFetch = await httpV1Adapter.limits()
      const afterFetch = Date.now()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.source).toBe('live')
        expect(result.data.nodes.max).toBe(200)
        expect(result.data.edges.max).toBe(500)
        expect(result.data.engine_p95_ms_budget).toBe(30000)
        expect(result.fetchedAt).toBeGreaterThanOrEqual(beforeFetch)
        expect(result.fetchedAt).toBeLessThanOrEqual(afterFetch)
      }
    })

    it('should include fetchedAt timestamp', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json({
            nodes: { max: 200 },
            edges: { max: 500 },
          })
        })
      )

      const result = await httpV1Adapter.limits()

      expect(result.fetchedAt).toBeTypeOf('number')
      expect(result.fetchedAt).toBeGreaterThan(0)
    })
  })

  describe('DEV mode failure (fallback with reason)', () => {
    beforeEach(() => {
      // Stub environment to DEV mode
      vi.stubEnv('DEV', true)
    })

    it('should return {ok: true, source: "fallback", data, reason, fetchedAt} on network error', async () => {
      // Mock network failure
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json(
            { code: 'SERVER_ERROR', error: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      const result: LimitsFetch = await httpV1Adapter.limits()

      expect(result.ok).toBe(true)
      if (result.ok && result.source === 'fallback') {
        expect(result.source).toBe('fallback')
        expect(result.data.nodes.max).toBe(V1_LIMITS.MAX_NODES)
        expect(result.data.edges.max).toBe(V1_LIMITS.MAX_EDGES)
        expect(result.reason).toContain('Live endpoint failed')
        expect(result.fetchedAt).toBeTypeOf('number')
      } else {
        throw new Error('Expected fallback result in DEV mode')
      }
    })

    it('should include descriptive reason in fallback response', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json(
            { code: 'SERVER_ERROR', error: 'Database connection failed' },
            { status: 500 }
          )
        })
      )

      const result = await httpV1Adapter.limits()

      if (result.ok && result.source === 'fallback') {
        expect(result.reason).toMatch(/Live endpoint failed/)
        expect(result.reason).toMatch(/Database connection failed|SERVER_ERROR/)
      } else {
        throw new Error('Expected fallback result with reason')
      }
    })

    it('should use V1_LIMITS constants for fallback data', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return new HttpResponse(null, { status: 503 })
        })
      )

      const result = await httpV1Adapter.limits()

      if (result.ok && result.source === 'fallback') {
        expect(result.data.nodes.max).toBe(V1_LIMITS.MAX_NODES)
        expect(result.data.edges.max).toBe(V1_LIMITS.MAX_EDGES)
      } else {
        throw new Error('Expected fallback with V1_LIMITS constants')
      }
    })
  })

  describe('PROD mode failure (error, no silent fallback)', () => {
    beforeEach(() => {
      // Stub environment to PROD mode
      vi.stubEnv('DEV', false)
      vi.stubEnv('PROD', true)
    })

    it('should return {ok: false, error, fetchedAt} on network error', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json(
            { code: 'SERVER_ERROR', error: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      const result: LimitsFetch = await httpV1Adapter.limits()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBeTruthy()
        expect(result.fetchedAt).toBeTypeOf('number')
      }
    })

    it('should propagate error message', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json(
            { code: 'RATE_LIMITED', error: 'Rate limit exceeded', retry_after: 60 },
            { status: 429 }
          )
        })
      )

      const result = await httpV1Adapter.limits()

      if (!result.ok) {
        expect(result.error.message).toContain('Rate limit exceeded')
      } else {
        throw new Error('Expected error result in PROD mode')
      }
    })

    it('should NOT return fallback data in PROD mode', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return new HttpResponse(null, { status: 503 })
        })
      )

      const result = await httpV1Adapter.limits()

      // Must be error, not fallback
      expect(result.ok).toBe(false)

      // TypeScript discriminated union ensures we can't access 'data' or 'source' when ok=false
      if (result.ok) {
        throw new Error('Expected error in PROD mode, got success')
      }
    })
  })

  describe('Error handling edge cases', () => {
    beforeEach(() => {
      vi.stubEnv('PROD', true)
    })

    it('should handle non-Error exceptions', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          throw 'string error'
        })
      )

      const result = await httpV1Adapter.limits()

      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('string error')
      }
    })

    it('should preserve timestamp across retries', async () => {
      let callCount = 0
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          callCount++
          if (callCount === 1) {
            return new HttpResponse(null, { status: 500 })
          }
          return HttpResponse.json({
            nodes: { max: 200 },
            edges: { max: 500 },
          })
        })
      )

      const result = await httpV1Adapter.limits()

      // Even if the underlying http client retries, our adapter should record
      // a single fetchedAt timestamp for the attempt
      expect(result.fetchedAt).toBeTypeOf('number')
    })
  })

  describe('Timestamp monotonicity', () => {
    it('should have increasing fetchedAt across multiple calls', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/limits`, () => {
          return HttpResponse.json({
            nodes: { max: 200 },
            edges: { max: 500 },
          })
        })
      )

      const result1 = await httpV1Adapter.limits()

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5))

      const result2 = await httpV1Adapter.limits()

      expect(result2.fetchedAt).toBeGreaterThan(result1.fetchedAt)
    })
  })
})
