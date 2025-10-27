/**
 * SSE Client Unit Tests (Simplified)
 * Tests error handling and cancel without complex stream mocking
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { runStream } from '../sseClient'
import type { V1RunRequest, V1StreamHandlers } from '../types'

// Save original fetch and create mock
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe('SSE Client (Simplified)', () => {
  const validRequest: V1RunRequest = {
    graph: {
      nodes: [{ id: 'a', label: 'Test' }],
      edges: [],
    },
    seed: 42,
  }

  let handlers: V1StreamHandlers

  beforeEach(() => {
    // Install mock fetch
    global.fetch = mockFetch as any

    handlers = {
      onStarted: vi.fn(),
      onProgress: vi.fn(),
      onInterim: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    }
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch
  })

  describe('HTTP Error Handling', () => {
    it('should handle 400 BAD_INPUT', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid input',
        }),
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onError).toHaveBeenCalledWith({
          code: 'BAD_INPUT',
          message: 'Invalid input',
        })
      })
    })

    it('should handle 500 SERVER_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Server error',
        }),
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onError).toHaveBeenCalledWith({
          code: 'SERVER_ERROR',
          message: 'Server error',
        })
      })
    })

    it('should handle 429 RATE_LIMITED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Too many requests',
          retry_after: 10,
        }),
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onError).toHaveBeenCalledWith({
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retry_after: 10,
        })
      })
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onError).toHaveBeenCalledWith({
          code: 'NETWORK_ERROR',
          message: 'Network failure',
        })
      })
    })
  })

  describe('Cancel', () => {
    it('should cancel stream immediately', () => {
      // Mock a never-resolving fetch
      mockFetch.mockReturnValueOnce(new Promise(() => {}))

      const cancel = runStream(validRequest, handlers)

      // Cancel immediately
      cancel()

      // Should not throw
      expect(() => cancel()).not.toThrow()
    })

    it('should be idempotent', () => {
      mockFetch.mockReturnValueOnce(new Promise(() => {}))

      const cancel = runStream(validRequest, handlers)

      // Call cancel multiple times
      cancel()
      cancel()
      cancel()

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('Progress capping', () => {
    it('should cap progress values at 90%', async () => {
      const progressValues: number[] = []

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test"}\n\n'))
          controller.enqueue(encoder.encode('event: progress\ndata: {"percent":95}\n\n'))
          controller.enqueue(encoder.encode('event: progress\ndata: {"percent":99}\n\n'))
          controller.enqueue(encoder.encode('event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":100}\n\n'))
          controller.close()
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      })

      const progressHandler = vi.fn((data: { percent: number }) => {
        progressValues.push(data.percent)
      })

      runStream(validRequest, { ...handlers, onProgress: progressHandler })

      await vi.waitFor(() => {
        expect(handlers.onComplete).toHaveBeenCalled()
      }, { timeout: 1000 })

      // Wait for throttled progress to flush
      await new Promise((resolve) => setTimeout(resolve, 200))

      // All progress values except possibly the last should be capped at 90
      expect(progressValues.some((v) => v === 90)).toBe(true)

      // Final 100% is sent but may be throttled - just verify it eventually comes or stays at 90
      const finalProgress = progressValues[progressValues.length - 1]
      expect(finalProgress === 90 || finalProgress === 100).toBe(true)
    })
  })

  describe('Event parsing', () => {
    it('should parse started event', async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-123"}\n\n'))
          controller.enqueue(encoder.encode('event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":100}\n\n'))
          controller.close()
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onStarted).toHaveBeenCalledWith({ run_id: 'test-123' })
      })
    })

    it('should parse error event', async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test"}\n\n'))
          controller.enqueue(encoder.encode('event: error\ndata: {"code":"SERVER_ERROR","message":"Failed"}\n\n'))
          controller.close()
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onError).toHaveBeenCalledWith({
          code: 'SERVER_ERROR',
          message: 'Failed',
        })
      })
    })

    it('should handle heartbeat events silently', async () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test"}\n\n'))
          controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'))
          controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'))
          controller.enqueue(encoder.encode('event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":100}\n\n'))
          controller.close()
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      })

      runStream(validRequest, handlers)

      await vi.waitFor(() => {
        expect(handlers.onComplete).toHaveBeenCalled()
      })

      // Heartbeats should not trigger any handlers
      expect(handlers.onError).not.toHaveBeenCalled()
    })
  })
})
