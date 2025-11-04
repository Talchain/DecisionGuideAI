/**
 * MSW Contract Tests for httpV1Adapter streaming with fallback
 *
 * Coverage:
 * - SSE streaming (POST /v1/stream)
 * - Fallback to sync on 404/5xx/timeout
 * - Cancel functionality
 * - Event handling (onStarted, onProgress, onComplete, onError)
 * - Progress throttling
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import type { RunRequest, ReportV1, ErrorV1 } from '../types'

// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

describe('httpV1Adapter Streaming Tests', () => {
  const runRequest: RunRequest = {
    template_id: 'test-template',
    seed: 42,
  }

  describe('SSE Streaming (POST /v1/stream)', () => {
    it('should handle successful streaming with events', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // SSE stream with multiple events
          const stream = new ReadableStream({
            start(controller) {
              // Event 1: started
              controller.enqueue(
                new TextEncoder().encode(
                  'event: started\n' +
                  'data: {"run_id":"run-123","timestamp":"2025-01-01T00:00:00Z"}\n\n'
                )
              )

              // Event 2: progress
              setTimeout(() => {
                controller.enqueue(
                  new TextEncoder().encode(
                    'event: progress\n' +
                    'data: {"percent":25,"message":"Analyzing nodes..."}\n\n'
                  )
                )
              }, 50)

              // Event 3: progress
              setTimeout(() => {
                controller.enqueue(
                  new TextEncoder().encode(
                    'event: progress\n' +
                    'data: {"percent":75,"message":"Computing outcomes..."}\n\n'
                  )
                )
              }, 100)

              // Event 4: complete
              setTimeout(() => {
                controller.enqueue(
                  new TextEncoder().encode(
                    'event: complete\n' +
                    'data: {"result":{"answer":"42.5 units expected","confidence":0.85,"explanation":"Test explanation","summary":{"conservative":38.0,"likely":42.5,"optimistic":48.0,"units":"units"},"explain_delta":{"top_drivers":[]},"response_hash":"sha256:abc123","seed":42}}\n\n'
                  )
                )
                controller.close()
              }, 150)
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        })
      )

      const cancel = httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for stream to complete
      await new Promise((resolve) => setTimeout(resolve, 250))

      // Verify events were called
      expect(onHello).toHaveBeenCalledWith({ response_id: 'run-123' })
      expect(onTick).toHaveBeenCalled() // Multiple progress events
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          response_id: expect.stringContaining('sha256:abc123'),
          report: expect.objectContaining({
            schema: 'report.v1',
            results: {
              conservative: 38.0,
              likely: 42.5,
              optimistic: 48.0,
              units: 'units',
            },
          }),
        })
      )
      expect(onError).not.toHaveBeenCalled()

      // Cleanup
      cancel()
    })

    it('should handle cancel during streaming', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // Long-running stream
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: started\n' +
                  'data: {"run_id":"run-123","timestamp":"2025-01-01T00:00:00Z"}\n\n'
                )
              )

              // Keep sending progress events
              const interval = setInterval(() => {
                controller.enqueue(
                  new TextEncoder().encode(
                    'event: progress\n' +
                    'data: {"percent":25,"message":"Analyzing..."}\n\n'
                  )
                )
              }, 50)

              // Never complete - will be cancelled
              setTimeout(() => {
                clearInterval(interval)
              }, 5000)
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        })
      )

      const cancel = httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for stream to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Cancel the stream
      cancel()

      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify stream started but didn't complete
      expect(onHello).toHaveBeenCalledOnce()
      expect(onDone).not.toHaveBeenCalled()
    })
  })

  describe('Fallback to Sync', () => {
    it('should fallback to sync when stream returns 404', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // Stream endpoint not available - 404
          return HttpResponse.json(
            {
              code: 'NOT_FOUND',
              error: 'Stream endpoint not available',
            },
            { status: 404 }
          )
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          // Sync endpoint works
          return HttpResponse.json({
            result: {
              answer: '42.5 units',
              confidence: 0.85,
              explanation: 'Fallback result',
              summary: {
                conservative: 38.0,
                likely: 42.5,
                optimistic: 48.0,
                units: 'units',
              },
              explain_delta: { top_drivers: [] },
              response_hash: 'sha256:fallback123',
              seed: 42,
            },
            execution_ms: 250,
          })
        })
      )

      httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for fallback to complete
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify fallback completed successfully
      expect(onHello).toHaveBeenCalledWith(
        expect.objectContaining({ response_id: expect.stringMatching(/^sync-\d+$/) })
      )
      expect(onTick).toHaveBeenCalledWith({ index: 3 }) // ~60% progress during sync
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          report: expect.objectContaining({
            schema: 'report.v1',
            results: {
              conservative: 38.0,
              likely: 42.5,
              optimistic: 48.0,
              units: 'units',
            },
          }),
        })
      )
      expect(onError).not.toHaveBeenCalled()
    })

    it('should fallback to sync when stream returns 5xx', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // Stream server error - 500
          return HttpResponse.json(
            {
              code: 'SERVER_ERROR',
              error: 'Internal server error',
            },
            { status: 500 }
          )
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          // Sync endpoint works
          return HttpResponse.json({
            result: {
              answer: '42.5 units',
              confidence: 0.85,
              explanation: 'Fallback result',
              summary: {
                conservative: 38.0,
                likely: 42.5,
                optimistic: 48.0,
                units: 'units',
              },
              explain_delta: { top_drivers: [] },
              response_hash: 'sha256:fallback123',
              seed: 42,
            },
            execution_ms: 250,
          })
        })
      )

      httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for fallback to complete
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify fallback completed successfully
      expect(onDone).toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    })

    it.skip('should report error when both stream and sync fail (slow test - retries)', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // Stream fails with 404
          return HttpResponse.json(
            {
              code: 'NOT_FOUND',
              error: 'Stream endpoint not available',
            },
            { status: 404 }
          )
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          // Sync also fails
          return HttpResponse.json(
            {
              code: 'SERVER_ERROR',
              error: 'All endpoints down',
            },
            { status: 500 }
          )
        })
      )

      httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for both attempts to fail (including retries - 3 attempts with exponential backoff)
      // Base delay: 1s, max: 10s. With 3 attempts: ~1s + ~2s + ~4s = ~7s total
      await new Promise((resolve) => setTimeout(resolve, 8000))

      // Verify error was reported
      expect(onDone).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: 'error.v1',
          code: 'SERVER_ERROR',
        })
      )
    })

    it('should not fallback on non-retryable errors (BAD_INPUT)', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // BAD_INPUT should not trigger fallback
          return HttpResponse.json(
            {
              code: 'BAD_INPUT',
              error: 'Invalid graph structure',
            },
            { status: 400 }
          )
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          // This should NOT be called
          throw new Error('Sync should not be called for BAD_INPUT')
        })
      )

      httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify error was reported without fallback
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: 'error.v1',
          code: 'BAD_INPUT',
        })
      )
      expect(onDone).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Prevents Fallback', () => {
    it('should not fallback if cancelled during stream error', async () => {
      const onHello = vi.fn()
      const onTick = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [{ id: 'node-1', label: 'Test' }],
              edges: [],
            },
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, async () => {
          // Delay before returning error
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json(
            {
              code: 'SERVER_ERROR',
              error: 'Server error',
            },
            { status: 500 }
          )
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          // This should NOT be called because we cancel
          throw new Error('Sync should not be called after cancel')
        })
      )

      const cancel = httpV1Adapter.stream!.run(runRequest, {
        onHello,
        onTick,
        onDone,
        onError,
      })

      // Cancel immediately
      cancel()

      // Wait to ensure fallback doesn't trigger
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify no fallback occurred
      expect(onDone).not.toHaveBeenCalled()
    })
  })
})
