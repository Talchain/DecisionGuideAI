/**
 * SSE Client Unit Tests
 * Tests event order, cancel, timeout, progress capping
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { runStream } from '../sseClient'
import type { V1RunRequest, V1StreamHandlers } from '../types'

// Save original fetch and create mock
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe('SSE Client', () => {
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
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockFetch.mockReset()
  })

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch
  })

  function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    let index = 0

    return new ReadableStream({
      async pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]))
          index++
        } else {
          controller.close()
        }
      },
    })
  }

  describe('Event order', () => {
    it('should handle correct event sequence: started → progress → complete', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: progress\ndata: {"percent":25}\n\n',
        'event: progress\ndata: {"percent":50}\n\n',
        'event: progress\ndata: {"percent":75}\n\n',
        'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":1200}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, handlers)

      // Wait for all events to process
      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onStarted).toHaveBeenCalledWith({ run_id: 'run-123' })
      expect(handlers.onProgress).toHaveBeenCalledTimes(4) // 25, 50, 75, 100 (final)
      expect(handlers.onComplete).toHaveBeenCalledWith({
        result: expect.objectContaining({ answer: '42' }),
        execution_ms: 1200,
      })
    })

    it('should handle heartbeat events and reset timeout', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: heartbeat\ndata: {}\n\n',
        'event: progress\ndata: {"percent":50}\n\n',
        'event: heartbeat\ndata: {}\n\n',
        'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":500}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should not timeout despite multiple events with delays
      expect(handlers.onError).not.toHaveBeenCalled()
      expect(handlers.onComplete).toHaveBeenCalled()
    })

    it('should handle interim findings', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: interim\ndata: {"findings":["Finding 1","Finding 2"]}\n\n',
        'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":800}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onInterim).toHaveBeenCalledWith({
        findings: ['Finding 1', 'Finding 2'],
      })
    })
  })

  describe('Progress capping', () => {
    it('should cap progress at 90% until COMPLETE event', async () => {
      const progressValues: number[] = []
      const progressHandler = vi.fn((data: { percent: number }) => {
        progressValues.push(data.percent)
      })

      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: progress\ndata: {"percent":95}\n\n',
        'event: progress\ndata: {"percent":98}\n\n',
        'event: progress\ndata: {"percent":99}\n\n',
        'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":1000}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, { ...handlers, onProgress: progressHandler })

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      // All progress values should be capped at 90, plus final 100
      expect(progressValues.every((v) => v === 90 || v === 100)).toBe(true)
      expect(progressValues[progressValues.length - 1]).toBe(100)
    })

    it('should send final 100% on COMPLETE', async () => {
      const progressValues: number[] = []
      const progressHandler = vi.fn((data: { percent: number }) => {
        progressValues.push(data.percent)
      })

      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: progress\ndata: {"percent":50}\n\n',
        'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":1000}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, { ...handlers, onProgress: progressHandler })

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(progressValues).toContain(100)
    })
  })

  describe('Cancel', () => {
    it('should cancel stream mid-progress', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: progress\ndata: {"percent":25}\n\n',
        // Stream will be cancelled here
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      const cancel = runStream(validRequest, handlers)

      await vi.runAllTimersAsync()

      // Cancel mid-stream
      cancel()

      // Should not call error after cancel
      expect(handlers.onError).not.toHaveBeenCalled()
    })

    it('should handle cancel before stream starts', async () => {
      const events = ['event: started\ndata: {"run_id":"run-123"}\n\n']

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      const cancel = runStream(validRequest, handlers)

      // Cancel immediately
      cancel()

      await vi.runAllTimersAsync()

      // Should not process any events
      expect(handlers.onStarted).not.toHaveBeenCalled()
    })
  })

  describe('Timeout/Heartbeat', () => {
    it('should timeout after 20s without events', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        // No more events for 20+ seconds
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()

      // Advance time past timeout
      vi.advanceTimersByTime(21000)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onError).toHaveBeenCalledWith({
        code: 'TIMEOUT',
        message: expect.stringContaining('no heartbeat'),
      })
    })

    it('should not timeout with regular heartbeats', async () => {
      // Create stream that sends heartbeats every 10s
      const encoder = new TextEncoder()
      let closed = false
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"run-123"}\n\n'))

          // Simulate heartbeats every 10s for 30s
          for (let i = 0; i < 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 10000))
            if (closed) break
            controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'))
          }

          controller.enqueue(
            encoder.encode(
              'event: complete\ndata: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":30000}\n\n'
            )
          )
          controller.close()
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      })

      runStream(validRequest, handlers)

      // Advance time by 35s (past individual timeout but with heartbeats)
      vi.advanceTimersByTime(35000)
      await vi.runAllTimersAsync()

      closed = true

      // Should complete successfully, not timeout
      expect(handlers.onError).not.toHaveBeenCalled()
      expect(handlers.onComplete).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      })

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onError).toHaveBeenCalledWith({
        code: 'SERVER_ERROR',
        message: 'Server error',
      })
    })

    it('should handle SSE error events', async () => {
      const events = [
        'event: started\ndata: {"run_id":"run-123"}\n\n',
        'event: error\ndata: {"code":"RATE_LIMITED","message":"Too many requests","retry_after":10}\n\n',
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(events),
      })

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onError).toHaveBeenCalledWith({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retry_after: 10,
      })
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      runStream(validRequest, handlers)

      await vi.runAllTimersAsync()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handlers.onError).toHaveBeenCalledWith({
        code: 'NETWORK_ERROR',
        message: 'Network failure',
      })
    })
  })
})
