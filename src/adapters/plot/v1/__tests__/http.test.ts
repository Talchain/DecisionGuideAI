import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { health, runSync, cancel } from '../http'
import type { V1RunRequest, V1HealthResponse, V1SyncRunResponse } from '../types'

describe('v1/http', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('health', () => {
    it('should return ok status for 200 response', async () => {
      const healthResponse: V1HealthResponse = {
        status: 'ok',
        timestamp: '2025-01-15T12:00:00Z',
        version: '1.0.0',
        uptime_ms: 123456,
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => healthResponse,
      })

      const result = await health()

      expect(result).toEqual(healthResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/health',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should return degraded status for non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const result = await health()

      expect(result.status).toBe('degraded')
      expect(result.timestamp).toBeDefined()
    })

    it('should return down status on fetch error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await health()

      expect(result.status).toBe('down')
      expect(result.timestamp).toBeDefined()
    })

    it.skip('should timeout after 5 seconds', async () => {
      // Skipped: difficult to test with mocked timers in vitest
      // The actual timeout behavior is verified in integration tests
      fetchMock.mockImplementationOnce(() => new Promise(() => {}))

      const result = await health()

      expect(result.status).toBe('down')
    })
  })

  describe('runSync', () => {
    const validRequest: V1RunRequest = {
      graph: {
        nodes: [
          { id: 'a', label: 'Node A' },
          { id: 'b', label: 'Node B' },
        ],
        edges: [{ from: 'a', to: 'b', confidence: 0.8 }],
      },
      seed: 42,
    }

    it('should successfully run with valid request', async () => {
      const syncResponse: V1SyncRunResponse = {
        result: {
          answer: 'Expected: 100',
          confidence: 0.85,
          explanation: 'Test explanation',
          response_hash: 'abc123',
          seed: 42,
        },
        execution_ms: 250,
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => syncResponse,
      })

      const result = await runSync(validRequest)

      expect(result).toEqual(syncResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/run',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          // detail_level defaults to 'quick' to stay under Netlify proxy timeout
          body: JSON.stringify({ ...validRequest, detail_level: 'quick' }),
        })
      )
    })

    it('should throw BAD_INPUT on 400 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid graph structure',
        }),
      })

      await expect(runSync(validRequest)).rejects.toMatchObject({
        code: 'BAD_INPUT',
        message: 'Invalid graph structure',
      })
    })

    it('should throw LIMIT_EXCEEDED on 413 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({
          error: 'Too many nodes',
          fields: {
            field: 'nodes',
            max: 200,
          },
        }),
      })

      await expect(runSync(validRequest)).rejects.toMatchObject({
        code: 'LIMIT_EXCEEDED',
        message: 'Too many nodes',
        field: 'nodes',
        max: 200,
      })
    })

    it('should throw RATE_LIMITED on 429 response with retry_after', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '60' : null),
        },
        json: async () => ({
          error: 'Rate limit exceeded',
        }),
      })

      await expect(runSync(validRequest)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        retry_after: 60,
      })
    })

    it('should throw SERVER_ERROR on 500 response', async () => {
      // Mock 3 attempts (original + 2 retries)
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      }
      fetchMock.mockResolvedValueOnce(mockResponse as any)
      fetchMock.mockResolvedValueOnce(mockResponse as any)
      fetchMock.mockResolvedValueOnce(mockResponse as any)

      await expect(runSync(validRequest)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: 'Internal server error',
      })
    })

    it('should throw TIMEOUT on abort signal', async () => {
      fetchMock.mockImplementationOnce(() => {
        const error: any = new Error('The operation was aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      })

      await expect(runSync(validRequest, { timeoutMs: 100 })).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })

    it('should throw NETWORK_ERROR on fetch failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'))

      await expect(runSync(validRequest)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      })
    })

    it('should include Idempotency-Key header when clientHash provided', async () => {
      const requestWithHash: V1RunRequest = {
        ...validRequest,
        clientHash: 'abc123def',
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            answer: 'Test',
            confidence: 0.8,
            explanation: 'Test',
            drivers: [],
          },
          execution_ms: 100,
        }),
      })

      await runSync(requestWithHash)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/run',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'abc123def',
          }),
        })
      )
    })

    it('should include Idempotency-Key header when idempotencyKey provided', async () => {
      const requestWithIdempotencyKey: V1RunRequest = {
        ...validRequest,
        idempotencyKey: 'idk-123',
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            answer: 'Test',
            confidence: 0.8,
            explanation: 'Test',
            drivers: [],
            response_hash: 'hash-idk-123',
            seed: 42,
          },
          execution_ms: 100,
        }),
      })

      await runSync(requestWithIdempotencyKey)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/run',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'idk-123',
          }),
        })
      )
    })

    // Phase 1 Section 2.1: Verify idempotencyKey is header-only, NEVER in body
    it('should exclude idempotencyKey from POST body while including it as header', async () => {
      const requestWithIdempotencyKey: V1RunRequest = {
        ...validRequest,
        idempotencyKey: 'idk-456',
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            answer: 'Test',
            confidence: 0.8,
            explanation: 'Test',
            drivers: [],
            response_hash: 'hash-idk-456',
            seed: 42,
          },
          execution_ms: 100,
        }),
      })

      await runSync(requestWithIdempotencyKey)

      // Verify the fetch call
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, options] = fetchMock.mock.calls[0]

      // 1. Header should include Idempotency-Key
      expect(options.headers['Idempotency-Key']).toBe('idk-456')

      // 2. Body should NOT include idempotencyKey field
      const bodyObj = JSON.parse(options.body)
      expect(bodyObj).not.toHaveProperty('idempotencyKey')

      // 3. Body should still include other fields
      expect(bodyObj).toHaveProperty('graph')
      expect(bodyObj).toHaveProperty('seed')
      expect(bodyObj.seed).toBe(42)
    })

    it.skip('should respect custom timeout', async () => {
      // Skipped: difficult to test with mocked timers in vitest
      // The actual timeout behavior is verified in integration tests
      fetchMock.mockImplementationOnce(() => new Promise(() => {}))

      await expect(runSync(validRequest, { timeoutMs: 100 })).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })
  })

  describe('cancel', () => {
    it('should send cancel request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
      })

      await cancel('run-123')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/plot/v1/run/run-123/cancel',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should be idempotent - swallow errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Not found'))

      // Should not throw
      await expect(cancel('run-123')).resolves.toBeUndefined()
    })

    it('should swallow 404 errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      // Should not throw
      await expect(cancel('run-123')).resolves.toBeUndefined()
    })
  })
})
