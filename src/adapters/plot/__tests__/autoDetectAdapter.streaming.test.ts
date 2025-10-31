/**
 * Integration Tests for autoDetectAdapter Streaming
 * Verifies probe-based adapter selection for streaming runs
 *
 * NOTE: These tests require VITE_FEATURE_PLOT_STREAM=1 to be set.
 * To run: VITE_FEATURE_PLOT_STREAM=1 npm test -- autoDetectAdapter.streaming.test.ts
 *
 * Coverage:
 * - Probe success → httpV1 streaming
 * - Probe failure → mock streaming
 * - Cold-start behavior (async probe resolution)
 * - Cancel before/during probe
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { autoDetectAdapter, reprobeCapability } from '../autoDetectAdapter'
import type { RunRequest, ReportV1, ErrorV1 } from '../types'

// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

// Check if streaming is available (requires VITE_FEATURE_PLOT_STREAM=1)
const hasStreaming = !!(autoDetectAdapter as any).stream

describe('autoDetectAdapter Streaming Integration', () => {
  if (!hasStreaming) {
    it.skip('requires VITE_FEATURE_PLOT_STREAM=1 to be set', () => {
      // Placeholder - tests will be skipped if feature flag not set
    })
    return
  }

  describe('Probe Success → httpV1 Streaming', () => {
    it('should use httpV1 adapter when probe succeeds', async () => {
      // Setup handlers BEFORE triggering probe
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.json({
            status: 'ok',
            timestamp: '2025-10-28T17:00:00Z',
          })
        })
      )

      // Now trigger probe with handlers in place
      await reprobeCapability()

      // Mock streaming endpoint (SSE)
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const stream = new ReadableStream({
            start(controller) {
              // Emit started event
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-123"}\n\n'))

              // Emit progress
              setTimeout(() => {
                controller.enqueue(encoder.encode('event: progress\ndata: {"percent":50}\n\n'))
              }, 50)

              // Emit complete
              setTimeout(() => {
                const completeData = {
                  result: {
                    results: {
                      summary: {
                        conservative: 100,
                        likely: 150,
                        optimistic: 200,
                        units: 'units',
                      },
                    },
                    response_hash: 'test-hash-123',
                    seed: 42,
                    confidence: 0.85,
                    explanation: 'Test explanation',
                  },
                  execution_ms: 100,
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 100)
            },
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      // Mock cancel endpoint
      server.use(
        http.post(`${PROXY_BASE}/v1/run/:runId/cancel`, () => {
          return HttpResponse.json({ status: 'cancelled' })
        })
      )

      const request: RunRequest = {
        graph: {
          nodes: [{ id: 'n1', label: 'Test' }],
          edges: [],
        },
        seed: 42,
      }

      return new Promise<void>((resolve, reject) => {
        let startedCalled = false
        let progressCalled = false
        let completeCalled = false

        const cancel = (autoDetectAdapter as any).stream?.run(request, {
          onHello: (data: { response_id: string }) => {
            startedCalled = true
            expect(data.response_id).toBe('test-123')
          },
          onTick: (data: { index: number }) => {
            progressCalled = true
            expect(typeof data.index).toBe('number')
          },
          onDone: (data: { response_id: string; report: ReportV1 }) => {
            completeCalled = true
            expect(data.report.schema).toBe('report.v1')
            expect(data.report.model_card.response_hash).toBe('test-hash-123')
            expect(data.report.results.likely).toBe(150)

            // Verify all callbacks were invoked
            expect(startedCalled).toBe(true)
            expect(progressCalled).toBe(true)

            resolve()
          },
          onError: (error: ErrorV1) => {
            reject(new Error(`Unexpected error: ${error.error}`))
          },
        })

        expect(typeof cancel).toBe('function')

        // Timeout safety
        setTimeout(() => {
          reject(new Error('Test timeout - streaming did not complete'))
        }, 5000)
      })
    })

    it('should forward interim findings when provided', async () => {
      // Setup handlers BEFORE triggering probe
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.json({ status: 'ok' })
        })
      )

      // Trigger probe
      await reprobeCapability()

      // Mock streaming with interim events
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-123"}\n\n'))

              // Emit interim findings
              setTimeout(() => {
                controller.enqueue(encoder.encode('event: interim\ndata: {"findings":["Risk factor A identified","Confidence building"]}\n\n'))
              }, 50)

              // Emit complete
              setTimeout(() => {
                const completeData = {
                  result: {
                    results: { summary: { likely: 150, units: 'units' } },
                    response_hash: 'test-hash',
                    seed: 42,
                  },
                  execution_ms: 100,
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 100)
            },
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      const request: RunRequest = {
        graph: {
          nodes: [{ id: 'n1', label: 'Test' }],
          edges: [],
        },
        seed: 42,
      }

      return new Promise<void>((resolve, reject) => {
        let interimCalled = false

        (autoDetectAdapter as any).stream?.run(request, {
          onHello: () => {},
          onTick: () => {},
          onInterim: (data: { findings: string[] }) => {
            interimCalled = true
            expect(data.findings).toEqual(['Risk factor A identified', 'Confidence building'])
          },
          onDone: () => {
            expect(interimCalled).toBe(true)
            resolve()
          },
          onError: (error: ErrorV1) => {
            reject(new Error(`Unexpected error: ${error.error}`))
          },
        })

        setTimeout(() => reject(new Error('Test timeout')), 5000)
      })
    })
  })

  describe('Probe Failure → Mock Streaming', () => {
    it('should fall back to mock adapter when probe fails', async () => {
      // Setup failed probe handler
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.error()
        })
      )

      // Trigger probe
      await reprobeCapability()

      const request: RunRequest = {
        template_id: 'test-template',
        seed: 42,
      }

      return new Promise<void>((resolve, reject) => {
        let usedMockAdapter = false

        const cancel = (autoDetectAdapter as any).stream?.run(request, {
          onHello: (data: { response_id: string }) => {
            // Mock adapter will still call onHello
            expect(data.response_id).toBeDefined()
          },
          onTick: () => {},
          onDone: (data: { response_id: string; report: ReportV1 }) => {
            // If we reach here, mock adapter was used successfully
            usedMockAdapter = true
            expect(data.report.schema).toBe('report.v1')
            resolve()
          },
          onError: (error: ErrorV1) => {
            reject(new Error(`Unexpected error: ${error.error}`))
          },
        })

        expect(typeof cancel).toBe('function')

        setTimeout(() => {
          if (!usedMockAdapter) {
            reject(new Error('Mock adapter was not used'))
          }
        }, 2000)
      })
    })
  })

  describe('Cold-Start Behavior', () => {
    it('should await probe before selecting adapter', async () => {
      // Setup delayed probe response to simulate cold start
      let probeResolved = false

      server.use(
        http.get(`${PROXY_BASE}/v1/health`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          probeResolved = true
          return HttpResponse.json({ status: 'ok' })
        })
      )

      // Clear probe cache to ensure fresh probe on next stream.run()
      await reprobeCapability()

      // Mock streaming endpoint
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          // Verify probe was awaited before streaming started
          expect(probeResolved).toBe(true)

          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-123"}\n\n'))
              setTimeout(() => {
                const completeData = {
                  result: {
                    results: { summary: { likely: 150, units: 'units' } },
                    response_hash: 'test-hash',
                    seed: 42,
                  },
                  execution_ms: 50,
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 50)
            },
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      const request: RunRequest = {
        graph: {
          nodes: [{ id: 'n1', label: 'Test' }],
          edges: [],
        },
        seed: 42,
      }

      return new Promise<void>((resolve, reject) => {
        const cancelStartTime = Date.now()

        const cancel = (autoDetectAdapter as any).stream?.run(request, {
          onHello: () => {},
          onTick: () => {},
          onDone: () => {
            const elapsed = Date.now() - cancelStartTime
            // Verify that stream started only after probe completed (>100ms)
            expect(elapsed).toBeGreaterThan(90)
            resolve()
          },
          onError: (error: ErrorV1) => {
            reject(new Error(`Unexpected error: ${error.error}`))
          },
        })

        // Cancel function should be returned immediately (sync)
        expect(typeof cancel).toBe('function')
        expect(Date.now() - cancelStartTime).toBeLessThan(50)

        setTimeout(() => reject(new Error('Test timeout')), 5000)
      })
    })
  })

  describe('Cancel Behavior', () => {
    it('should support cancel before probe completes', async () => {
      // Delay probe to allow early cancellation
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
          return HttpResponse.json({ status: 'ok' })
        })
      )

      const request: RunRequest = {
        template_id: 'test-template',
        seed: 42,
      }

      return new Promise<void>((resolve) => {
        const cancel = (autoDetectAdapter as any).stream?.run(request, {
          onHello: () => {
            throw new Error('Should not receive events after cancel')
          },
          onTick: () => {
            throw new Error('Should not receive events after cancel')
          },
          onDone: () => {
            throw new Error('Should not complete after cancel')
          },
          onError: () => {
            throw new Error('Should not error after cancel')
          },
        })

        // Cancel immediately
        cancel()

        // Wait to ensure no events are received
        setTimeout(() => {
          resolve() // Success - no events were triggered
        }, 500)
      })
    })

    it('should forward cancel to actual adapter after probe', async () => {
      // Setup successful probe handler
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.json({ status: 'ok' })
        })
      )

      // Trigger probe
      await reprobeCapability()

      // Mock streaming that never completes (to test cancel)
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-cancel"}\n\n'))
              // Never complete - simulate long-running stream
            },
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' },
          })
        })
      )

      // Mock cancel endpoint
      let cancelCalled = false
      server.use(
        http.post(`${PROXY_BASE}/v1/run/:runId/cancel`, ({ params }) => {
          cancelCalled = true
          expect(params.runId).toBe('test-cancel')
          return HttpResponse.json({ status: 'cancelled' })
        })
      )

      const request: RunRequest = {
        graph: {
          nodes: [{ id: 'n1', label: 'Test' }],
          edges: [],
        },
        seed: 42,
      }

      return new Promise<void>((resolve) => {
        const cancel = (autoDetectAdapter as any).stream?.run(request, {
          onHello: (data: { response_id: string }) => {
            expect(data.response_id).toBe('test-cancel')

            // Cancel after started event
            setTimeout(() => {
              cancel()

              // Verify cancel endpoint was called
              setTimeout(() => {
                expect(cancelCalled).toBe(true)
                resolve()
              }, 100)
            }, 50)
          },
          onTick: () => {},
          onDone: () => {
            throw new Error('Should not complete after cancel')
          },
          onError: () => {},
        })
      })
    })
  })
})
