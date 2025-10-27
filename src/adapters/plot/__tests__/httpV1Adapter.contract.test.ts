/**
 * MSW Contract Tests for httpV1Adapter
 * Uses golden fixtures to verify correct integration with PLoT v1 API
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import type { RunRequest } from '../types'

// Mock template graphs
vi.mock('../mockAdapter', () => ({
  plot: {
    template: vi.fn((id: string) => {
      if (id === 'test-small') {
        return Promise.resolve({
          id: 'test-small',
          name: 'Small Test Graph',
          graph: {
            nodes: Array.from({ length: 25 }, (_, i) => ({
              id: `node-${i}`,
              data: { label: `Node ${i}` },
            })),
            edges: [],
          },
        })
      }
      if (id === 'test-large') {
        return Promise.resolve({
          id: 'test-large',
          name: 'Large Test Graph',
          graph: {
            nodes: Array.from({ length: 50 }, (_, i) => ({
              id: `node-${i}`,
              data: { label: `Node ${i}` },
            })),
            edges: [],
          },
        })
      }
      throw new Error(`Unknown template: ${id}`)
    }),
    templates: vi.fn(() => Promise.resolve({ templates: [] })),
  },
}))


// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

describe('httpV1Adapter MSW Contract Tests', () => {
  const smallGraphRequest: RunRequest = {
    template_id: 'test-small',
    seed: 42,
  }

  const largeGraphRequest: RunRequest = {
    template_id: 'test-large',
    seed: 42,
  }

  describe('Successful runs', () => {
    it('should handle successful sync run (≤30 nodes)', async () => {
      // Golden fixture for successful sync response
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: {
              answer: '42.5',
              confidence: 0.85,
              explanation: 'Based on historical data, the expected outcome is 42.5 units',
              drivers: [
                { kind: 'node', id: 'revenue', label: 'Revenue Growth', impact: 0.8 },
                { kind: 'edge', id: 'revenue->costs', label: 'Cost Impact', impact: -0.3 },
              ],
              response_hash: 'sha256:abc123def456',
              seed: 42,
            },
            execution_ms: 450,
          })
        })
      )

      const result = await httpV1Adapter.run(smallGraphRequest)

      expect(result.schema).toBe('report.v1')
      expect(result.results.likely).toBe(42.5)
      expect(result.confidence.level).toBe('high') // 0.85 → 'high'
      expect(result.confidence.why).toContain('Based on historical data')
      expect(result.drivers).toHaveLength(2)
      expect(result.meta.seed).toBe(42)
      expect(result.meta.elapsed_ms).toBe(450)
    })

    it('should handle successful stream run (>30 nodes)', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, async ({ request }) => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              // Event: started
              controller.enqueue(
                encoder.encode('event: started\ndata: {"run_id":"run-123"}\n\n')
              )

              await delay(50)

              // Event: progress
              controller.enqueue(encoder.encode('event: progress\ndata: {"percent":25}\n\n'))

              await delay(50)

              // Event: progress
              controller.enqueue(encoder.encode('event: progress\ndata: {"percent":50}\n\n'))

              await delay(50)

              // Event: complete
              controller.enqueue(
                encoder.encode(
                  'event: complete\n' +
                    'data: {"result":{"answer":"42.5","confidence":0.85,"explanation":"Streaming result","drivers":[],"response_hash":"sha256:stream123","seed":42},"execution_ms":1200}\n\n'
                )
              )

              controller.close()
            },
          })

          return new HttpResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      const result = await httpV1Adapter.run(largeGraphRequest)

      expect(result.schema).toBe('report.v1')
      expect(result.results.likely).toBe(42.5)
      expect(result.meta.elapsed_ms).toBe(1200)
    })
  })

  describe('Error handling', () => {
    it('should handle BAD_INPUT (400)', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json(
            {
              code: 'BAD_INPUT',
              error: 'Node label exceeds 120 characters',
              fields: { field: 'label', max: 120 },
            },
            { status: 400 }
          )
        })
      )

      await expect(httpV1Adapter.run(smallGraphRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'BAD_INPUT',
        error: 'Node label exceeds 120 characters',
        fields: {
          field: 'label',
          max: 120,
        },
      })
    })

    it('should handle LIMIT_EXCEEDED (413)', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json(
            {
              code: 'LIMIT_EXCEEDED',
              error: 'Graph has 250 nodes (max 200)',
              fields: { field: 'nodes', max: 200 },
            },
            { status: 413 }
          )
        })
      )

      await expect(httpV1Adapter.run(smallGraphRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'LIMIT_EXCEEDED',
        error: 'Graph has 250 nodes (max 200)',
        fields: {
          field: 'nodes',
          max: 200,
        },
      })
    })

    it('should handle RATE_LIMITED (429) with retry_after', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json(
            {
              code: 'RATE_LIMITED',
              error: 'Too many requests',
              retry_after: 10,
            },
            { status: 429 }
          )
        })
      )

      await expect(httpV1Adapter.run(smallGraphRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'RATE_LIMITED',
        error: 'Too many requests',
        retry_after: 10,
      })
    })

    it('should retry and eventually fail on SERVER_ERROR (500)', async () => {
      let attempts = 0
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          attempts++
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      await expect(httpV1Adapter.run(smallGraphRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'SERVER_ERROR',
      })

      // Should have retried 3 times (original + 2 retries)
      expect(attempts).toBe(3)
    })

    it('should handle stream errors via SSE error event', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, async () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode('event: started\ndata: {"run_id":"run-456"}\n\n')
              )
              controller.enqueue(
                encoder.encode(
                  'event: error\n' +
                    'data: {"code":"SERVER_ERROR","message":"Model execution failed"}\n\n'
                )
              )
              controller.close()
            },
          })

          return new HttpResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      await expect(httpV1Adapter.run(largeGraphRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'SERVER_ERROR',
        error: 'Model execution failed',
      })
    })
  })

  describe('Adaptive routing', () => {
    it('should use sync endpoint for small graphs', async () => {
      let syncCalled = false
      let streamCalled = false

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          syncCalled = true
          return HttpResponse.json({
            result: {
              answer: '42',
              confidence: 0.9,
              explanation: 'Test',
              drivers: [],
            },
            execution_ms: 100,
          })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          streamCalled = true
          return new HttpResponse(null, { status: 500 })
        })
      )

      await httpV1Adapter.run(smallGraphRequest)

      expect(syncCalled).toBe(true)
      expect(streamCalled).toBe(false)
    })

    it('should use stream endpoint for large graphs', async () => {
      let syncCalled = false
      let streamCalled = false

      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          syncCalled = true
          return new HttpResponse(null, { status: 500 })
        }),
        http.post(`${PROXY_BASE}/v1/stream`, async () => {
          streamCalled = true
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode('event: started\ndata: {"run_id":"run-789"}\n\n')
              )
              controller.enqueue(
                encoder.encode(
                  'event: complete\n' +
                    'data: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":100}\n\n'
                )
              )
              controller.close()
            },
          })
          return new HttpResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      await httpV1Adapter.run(largeGraphRequest)

      expect(syncCalled).toBe(false)
      expect(streamCalled).toBe(true)
    })
  })

  describe('Progress capping', () => {
    it('should cap progress at 90% until complete event', async () => {
      const progressUpdates: number[] = []

      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, async () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            async start(controller) {
              controller.enqueue(
                encoder.encode('event: started\ndata: {"run_id":"run-cap"}\n\n')
              )
              controller.enqueue(encoder.encode('event: progress\ndata: {"percent":95}\n\n'))
              controller.enqueue(encoder.encode('event: progress\ndata: {"percent":99}\n\n'))
              controller.enqueue(
                encoder.encode(
                  'event: complete\n' +
                    'data: {"result":{"answer":"42","confidence":0.9,"explanation":"Test","drivers":[]},"execution_ms":100}\n\n'
                )
              )
              controller.close()
            },
          })
          return new HttpResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      // Use explicit stream.run to capture progress
      return new Promise<void>((resolve, reject) => {
        httpV1Adapter.stream.run(largeGraphRequest, {
          onTick: (data) => {
            progressUpdates.push(data.index)
          },
          onDone: () => {
            // Should have capped at 90, not 95/99
            expect(Math.max(...progressUpdates)).toBeLessThanOrEqual(4) // 90% / 20 = index 4
            resolve()
          },
          onError: reject,
        })
      })
    })
  })
})
