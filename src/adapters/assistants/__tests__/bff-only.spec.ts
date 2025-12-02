/**
 * S5-BFF: BFF-Only Verification Tests
 *
 * Verifies that all /assist/* calls go through the BFF proxy
 * and never directly to external services (security requirement)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { draftGraph, draftGraphStream } from '../http'
import type { DraftRequest } from '../types'

describe('S5-BFF: Assist calls are BFF-only', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockRequest: DraftRequest = {
    prompt: 'Test prompt',
    context: {}
  }

  describe('Draft Graph (Sync)', () => {
    it('should call /bff/assist/draft-graph endpoint', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/bff/assist/v1/draft-flows'),
        expect.objectContaining({
          body: expect.stringContaining('"path":"/draft-graph"')
        })
      )
    })

    it('should NOT call external Anthropic API directly', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      // Verify it does NOT call Anthropic directly
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('anthropic.com'),
        expect.any(Object)
      )

      // Verify it does NOT call Claude API directly
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('claude.ai'),
        expect.any(Object)
      )
    })

    it('should include correlation ID header', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest, { correlationId: 'test-correlation-id' })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-correlation-id': 'test-correlation-id'
          })
        })
      )
    })

    it('should use VITE_BFF_BASE when configured', async () => {
      const originalEnv = import.meta.env.VITE_BFF_BASE
      import.meta.env.VITE_BFF_BASE = 'https://custom-bff.example.com/api'

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://custom-bff.example.com/api/v1/draft-flows',
        expect.objectContaining({
          body: expect.stringContaining('"path":"/draft-graph"')
        })
      )

      // Restore
      import.meta.env.VITE_BFF_BASE = originalEnv
    })

    it('should default to /bff/assist when VITE_BFF_BASE not set', async () => {
      const originalEnv = import.meta.env.VITE_BFF_BASE
      delete import.meta.env.VITE_BFF_BASE

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      expect(fetchSpy).toHaveBeenCalledWith(
        '/bff/assist/v1/draft-flows',
        expect.objectContaining({
          body: expect.stringContaining('"path":"/draft-graph"')
        })
      )

      // Restore
      import.meta.env.VITE_BFF_BASE = originalEnv
    })
  })

  describe('Draft Graph (Stream)', () => {
    it('should call /bff/assist/draft-graph/stream endpoint', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
            releaseLock: () => {} // Add releaseLock method
          })
        }
      } as any)

      const stream = draftGraphStream(mockRequest)
      await stream.next() // Start the stream

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/draft-flows'),
        expect.objectContaining({
          body: expect.stringContaining('"path":"/draft-graph/stream"')
        })
      )
    })

    it('should NOT call external API directly for streaming', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
            releaseLock: () => {} // Add releaseLock method
          })
        }
      } as any)

      const stream = draftGraphStream(mockRequest)
      await stream.next()

      // Verify it does NOT call external services
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/anthropic|claude/i),
        expect.any(Object)
      )
    })
  })

  describe('Security Assertions', () => {
    it('should never expose API keys in frontend calls', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      const callArgs = fetchSpy.mock.calls[0]
      const headers = (callArgs[1] as RequestInit)?.headers as Record<string, string>

      // Verify NO API keys in headers
      expect(headers).not.toHaveProperty('x-api-key')
      expect(headers).not.toHaveProperty('Authorization')
      expect(headers).not.toHaveProperty('anthropic-api-key')

      // Only allowed headers
      expect(Object.keys(headers)).toEqual(['Content-Type', 'x-correlation-id'])
    })

    it('should use POST method for all assist calls', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should include Content-Type: application/json', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [], edges: [] })
      } as Response)

      await draftGraph(mockRequest)

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle BFF server errors gracefully', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      } as Response)

      await expect(draftGraph(mockRequest)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        message: "We couldn't reach the service. Please try again in a moment."
      })
    })

    it('should handle network errors gracefully', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network failure'))

      await expect(draftGraph(mockRequest)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Connection lost. Check your internet and try again.'
      })
    })

    it('should handle abort/timeout', async () => {
      const controller = new AbortController()
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      fetchSpy.mockRejectedValueOnce(abortError)

      controller.abort()

      await expect(
        draftGraph(mockRequest, { signal: controller.signal })
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
        message: 'Request timed out. Please try again.'
      })
    })
  })
})
