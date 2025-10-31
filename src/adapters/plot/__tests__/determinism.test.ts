/**
 * Determinism Tests for PLoT V1 Streaming & Debug
 *
 * Verifies that:
 * 1. Sync and streaming modes produce identical response_hash
 * 2. Debug slices don't affect response_hash
 * 3. Core report fields are deterministic across modes
 *
 * NOTE: Requires VITE_FEATURE_PLOT_STREAM=1 to run streaming tests
 * To run: VITE_FEATURE_PLOT_STREAM=1 npm test -- determinism.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import type { RunRequest, ReportV1 } from '../types'

// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

// Check if streaming is available
const hasStreaming = !!(httpV1Adapter as any).stream

// Fixture: Mock report data (deterministic across runs)
const MOCK_REPORT_BASE = {
  schema: 'report.v1' as const,
  results: {
    summary: {
      conservative: 100,
      likely: 150,
      optimistic: 200,
      units: 'units'
    }
  },
  model_card: {
    response_hash: 'deterministic-hash-42',
    seed: 42,
    confidence: 0.85,
    template_version: '1.0.0'
  },
  explanation: 'Test explanation',
  metadata: {
    execution_ms: 100,
    timestamp: '2025-10-28T17:00:00Z'
  }
}

// Mock debug slices (should NOT affect response_hash)
const MOCK_DEBUG_SLICES = {
  compare: {
    conservative: {
      p10: 90,
      p50: 100,
      p90: 110,
      top3_edges: [
        { edge_id: 'e1', from: 'n1', to: 'n2', label: 'Edge 1', weight: 0.8 }
      ]
    },
    likely: {
      p10: 135,
      p50: 150,
      p90: 165,
      top3_edges: []
    },
    optimistic: {
      p10: 180,
      p50: 200,
      p90: 220,
      top3_edges: []
    }
  },
  inspector: {
    edges: [
      {
        edge_id: 'e1',
        from: 'n1',
        to: 'n2',
        label: 'Edge 1',
        weight: 0.8,
        belief: 0.95,
        provenance: 'template'
      }
    ]
  }
}

const MOCK_REQUEST: RunRequest = {
  graph: {
    nodes: [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' }
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.8 } }
    ]
  },
  seed: 42
}

describe('PLoT V1 Determinism', () => {
  beforeEach(() => {
    // Mock validation endpoint (always succeeds for tests)
    server.use(
      http.post(`${PROXY_BASE}/v1/validate`, () => {
        return HttpResponse.json({
          valid: true,
          violations: []
        })
      })
    )
  })

  describe('Sync Mode', () => {
    it('produces deterministic response_hash for same input', async () => {
      // Setup sync endpoint
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: MOCK_REPORT_BASE,
            execution_ms: 100
          })
        })
      )

      // Run twice with same input
      const report1 = await httpV1Adapter.run(MOCK_REQUEST)
      const report2 = await httpV1Adapter.run(MOCK_REQUEST)

      // Verify identical response_hash
      expect(report1.model_card.response_hash).toBe(report2.model_card.response_hash)
      expect(report1.model_card.response_hash).toBe('deterministic-hash-42')
    })

    it('includes debug slices without affecting response_hash when include_debug=true', async () => {
      let requestCount = 0

      // Setup sync endpoint with debug slices
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, async ({ request }) => {
          requestCount++
          const body = await request.json() as any
          const includeDebug = body.include_debug === true

          const response = {
            result: {
              ...MOCK_REPORT_BASE,
              ...(includeDebug && { debug: MOCK_DEBUG_SLICES })
            },
            execution_ms: 100
          }

          return HttpResponse.json(response)
        })
      )

      // Run without debug (no feature flags set)
      const reportNoDebug = await httpV1Adapter.run(MOCK_REQUEST)
      expect(reportNoDebug.debug).toBeUndefined()
      const hashWithoutDebug = reportNoDebug.model_card.response_hash

      // Run with debug by enabling feature flag
      vi.stubEnv('VITE_FEATURE_COMPARE_DEBUG', '1')
      try {
        const reportWithDebug = await httpV1Adapter.run(MOCK_REQUEST)

        // Verify debug data is present
        expect(reportWithDebug.debug).toBeDefined()
        expect(reportWithDebug.debug?.compare).toBeDefined()
        expect(reportWithDebug.debug?.compare?.conservative).toBeDefined()
        expect(reportWithDebug.debug?.compare?.conservative.p50).toBe(100)
        expect(reportWithDebug.debug?.compare?.conservative.top3_edges).toHaveLength(1)

        // Both should have same hash (debug doesn't affect hash calculation)
        expect(reportWithDebug.model_card.response_hash).toBe('deterministic-hash-42')
        expect(reportWithDebug.model_card.response_hash).toBe(hashWithoutDebug)
      } finally {
        // Clean up environment stub
        vi.unstubAllEnvs()
      }

      expect(requestCount).toBe(2)
    }, 10000)
  })

  describe('Streaming Mode', () => {
    if (!hasStreaming) {
      it.skip('requires VITE_FEATURE_PLOT_STREAM=1 to be set', () => {
        // Placeholder - tests will be skipped if feature flag not set
      })
      return
    }

    it('produces same response_hash as sync mode for identical input', async () => {
      // Setup sync endpoint
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: MOCK_REPORT_BASE,
            execution_ms: 100
          })
        })
      )

      // Get sync result first
      const syncReport = await httpV1Adapter.run(MOCK_REQUEST)

      // Setup streaming endpoint
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-determinism"}\n\n'))

              setTimeout(() => {
                const completeData = {
                  result: MOCK_REPORT_BASE,
                  execution_ms: 100
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 50)
            }
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' }
          })
        })
      )

      // Get streaming result
      return new Promise<void>((resolve, reject) => {
        (httpV1Adapter as any).stream?.run(MOCK_REQUEST, {
          onHello: () => {},
          onTick: () => {},
          onInterim: () => {},
          onDone: (data: { response_id: string; report: ReportV1 }) => {
            try {
              // Verify streaming result matches sync result
              expect(data.report.model_card.response_hash).toBe(syncReport.model_card.response_hash)
              expect(data.report.model_card.response_hash).toBe('deterministic-hash-42')

              // Verify core fields match
              expect(data.report.results.likely).toBe(syncReport.results.likely)
              expect(data.report.model_card.seed).toBe(syncReport.model_card.seed)
              expect(data.report.model_card.confidence).toBe(syncReport.model_card.confidence)

              resolve()
            } catch (err) {
              reject(err)
            }
          },
          onError: (error) => {
            reject(new Error(`Streaming error: ${error.error}`))
          }
        })

        setTimeout(() => reject(new Error('Test timeout')), 5000)
      })
    })

    it('maintains consistent response_hash across multiple streaming runs', async () => {
      // Setup streaming endpoint
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-determinism-stream"}\n\n'))

              setTimeout(() => {
                const completeData = {
                  result: MOCK_REPORT_BASE,
                  execution_ms: 100
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 50)
            }
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' }
          })
        })
      )

      // Run streaming twice
      const getStreamReport = () => new Promise<ReportV1>((resolve, reject) => {
        (httpV1Adapter as any).stream?.run(MOCK_REQUEST, {
          onHello: () => {},
          onTick: () => {},
          onInterim: () => {},
          onDone: (data: { report: ReportV1 }) => resolve(data.report),
          onError: (error: any) => reject(error)
        })

        setTimeout(() => reject(new Error('Test timeout')), 5000)
      })

      const report1 = await getStreamReport()
      const report2 = await getStreamReport()

      // Verify identical response_hash across runs
      expect(report1.model_card.response_hash).toBe(report2.model_card.response_hash)
      expect(report1.model_card.response_hash).toBe('deterministic-hash-42')
    })
  })

  describe('Cross-Mode Consistency', () => {
    if (!hasStreaming) {
      it.skip('requires VITE_FEATURE_PLOT_STREAM=1 to be set', () => {
        // Placeholder
      })
      return
    }

    it('produces identical core report fields across sync and streaming modes', async () => {
      // Setup sync endpoint
      server.use(
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: MOCK_REPORT_BASE,
            execution_ms: 100
          })
        })
      )

      // Setup streaming endpoint
      const encoder = new TextEncoder()
      server.use(
        http.post(`${PROXY_BASE}/v1/stream`, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: started\ndata: {"run_id":"test-cross-mode"}\n\n'))

              setTimeout(() => {
                const completeData = {
                  result: MOCK_REPORT_BASE,
                  execution_ms: 100
                }
                controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(completeData)}\n\n`))
                controller.close()
              }, 50)
            }
          })

          return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' }
          })
        })
      )

      // Get sync report
      const syncReport = await httpV1Adapter.run(MOCK_REQUEST)

      // Get streaming report
      const streamingReport = await new Promise<ReportV1>((resolve, reject) => {
        (httpV1Adapter as any).stream?.run(MOCK_REQUEST, {
          onHello: () => {},
          onTick: () => {},
          onInterim: () => {},
          onDone: (data: { report: ReportV1 }) => resolve(data.report),
          onError: (error: any) => reject(error)
        })

        setTimeout(() => reject(new Error('Test timeout')), 5000)
      })

      // Verify all core fields match exactly
      expect(streamingReport.schema).toBe(syncReport.schema)
      expect(streamingReport.model_card.response_hash).toBe(syncReport.model_card.response_hash)
      expect(streamingReport.model_card.seed).toBe(syncReport.model_card.seed)
      expect(streamingReport.model_card.confidence).toBe(syncReport.model_card.confidence)
      expect(streamingReport.results.conservative).toBe(syncReport.results.conservative)
      expect(streamingReport.results.likely).toBe(syncReport.results.likely)
      expect(streamingReport.results.optimistic).toBe(syncReport.results.optimistic)
      expect(streamingReport.explanation).toBe(syncReport.explanation)
    })
  })
})
