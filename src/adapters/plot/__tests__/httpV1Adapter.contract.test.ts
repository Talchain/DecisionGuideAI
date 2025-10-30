/**
 * MSW Contract Tests for httpV1Adapter (v1 sync + templates)
 * Uses golden fixtures to verify correct integration with PLoT v1 API
 *
 * Coverage:
 * - Health (GET /v1/health)
 * - Templates (GET /v1/templates, GET /v1/templates/{id}/graph)
 * - Sync run (POST /v1/run)
 * - Validate (POST /v1/validate)
 * - Limits (GET /v1/limits)
 * - Error handling (BAD_INPUT, LIMIT_EXCEEDED, RATE_LIMITED, SERVER_ERROR)
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import type { RunRequest } from '../types'

// Setup MSW server
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

describe('httpV1Adapter MSW Contract Tests', () => {
  describe('Health (GET /v1/health)', () => {
    it('should return ok status', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.json({
            status: 'ok',
            timestamp: '2025-10-28T17:00:00Z',
            version: '1.0.0',
            uptime_ms: 123456,
          })
        })
      )

      const result = await httpV1Adapter.health()

      expect(result.status).toBe('ok')
      expect(result.timestamp).toBe('2025-10-28T17:00:00Z')
      expect(result.version).toBe('1.0.0')
      expect(result.uptime_ms).toBe(123456)
    })

    it('should handle degraded status', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.json(
            { status: 'degraded', timestamp: '2025-10-28T17:00:00Z' },
            { status: 503 }
          )
        })
      )

      const result = await httpV1Adapter.health()

      expect(result.status).toBe('degraded')
    })

    it('should handle unreachable server', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/health`, () => {
          return HttpResponse.error()
        })
      )

      const result = await httpV1Adapter.health()

      expect(result.status).toBe('down')
    })
  })

  describe('Templates (GET /v1/templates)', () => {
    it('should fetch template list', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/templates`, () => {
          // v1 API returns bare array with label/summary fields
          return HttpResponse.json([
            {
              id: 'revenue-forecast',
              label: 'Revenue Forecast',
              summary: 'Forecast revenue outcomes',
              updated_at: '2025-01-01T00:00:00.000Z',
            },
            {
              id: 'risk-assessment',
              label: 'Risk Assessment',
              summary: 'Assess project risks',
              updated_at: '2025-01-01T00:00:00.000Z',
            },
          ])
        })
      )

      const result = await httpV1Adapter.templates()

      expect(result.schema).toBe('template-list.v1')
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('revenue-forecast')
      expect(result.items[0].name).toBe('Revenue Forecast') // mapped from label
      expect(result.items[0].description).toBe('Forecast revenue outcomes') // mapped from summary
      expect(result.items[1].id).toBe('risk-assessment')
    })
  })

  describe('Template Graph (GET /v1/templates/{id}/graph)', () => {
    it('should fetch template graph and metadata', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/templates`, () => {
          // v1 API returns bare array
          return HttpResponse.json([
            {
              id: 'test-template',
              label: 'Test Template',
              summary: 'Test template description',
              updated_at: '2025-01-01T00:00:00.000Z',
            },
          ])
        }),
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: {
              nodes: [
                { id: 'node-1', label: 'Start' },
                { id: 'node-2', label: 'End' },
              ],
              edges: [{ from: 'node-1', to: 'node-2', confidence: 1.0 }],
            },
          })
        })
      )

      const result = await httpV1Adapter.template('test-template')

      expect(result.id).toBe('test-template')
      expect(result.name).toBe('Test Template') // mapped from label
      expect(result.version).toBe('1.0') // default value
      expect(result.description).toBe('Test template description') // mapped from summary
      expect(result.default_seed).toBe(1337)
      expect(result.graph.nodes).toHaveLength(2)
      expect(result.graph.edges).toHaveLength(1)
    })
  })

  describe('Sync Run (POST /v1/run)', () => {
    const runRequest: RunRequest = {
      template_id: 'test-template',
      seed: 42,
    }

    it('should handle successful sync run', async () => {
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
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({ valid: true })
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: {
              answer: '42.5 units expected',
              confidence: 0.85,
              explanation: 'Based on historical data, the expected outcome is 42.5 units',
              results: {
                summary: {
                  conservative: 38.0,
                  likely: 42.5,
                  optimistic: 48.0,
                  units: 'units',
                },
              },
              explain_delta: {
                top_drivers: [
                  { kind: 'node', node_id: 'revenue', label: 'Revenue Growth', impact: 0.8 },
                  { kind: 'edge', edge_id: 'revenue->costs', label: 'Cost Impact', impact: -0.3 },
                ],
              },
              response_hash: 'sha256:abc123def456',
              seed: 42,
            },
            execution_ms: 450,
          })
        })
      )

      const result = await httpV1Adapter.run(runRequest)

      expect(result.schema).toBe('report.v1')
      expect(result.results.conservative).toBe(38.0)
      expect(result.results.likely).toBe(42.5)
      expect(result.results.optimistic).toBe(48.0)
      expect(result.results.units).toBe('units')
      expect(result.confidence.level).toBe('high') // 0.85 → 'high'
      expect(result.confidence.why).toContain('Based on historical data')
      expect(result.drivers).toHaveLength(2)
      expect(result.drivers[0].node_id).toBe('revenue')
      expect(result.drivers[1].edge_id).toBe('revenue->costs')
      expect(result.meta.seed).toBe(42)
      expect(result.meta.elapsed_ms).toBe(450)
    })
  })

  describe('Error Handling', () => {
    const runRequest: RunRequest = {
      template_id: 'test-template',
      seed: 42,
    }

    it('should handle BAD_INPUT (400)', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: { nodes: [{ id: 'node-1' }], edges: [] },
          })
        }),
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({ valid: true })
        }),
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

      await expect(httpV1Adapter.run(runRequest)).rejects.toMatchObject({
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
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: { nodes: [{ id: 'node-1' }], edges: [] },
          })
        }),
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({ valid: true })
        }),
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

      await expect(httpV1Adapter.run(runRequest)).rejects.toMatchObject({
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
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: { nodes: [{ id: 'node-1' }], edges: [] },
          })
        }),
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({ valid: true })
        }),
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

      await expect(httpV1Adapter.run(runRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'RATE_LIMITED',
        error: 'Too many requests',
        retry_after: 10,
      })
    })

    it('should retry and eventually fail on SERVER_ERROR (500)', async () => {
      let attempts = 0
      server.use(
        http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
          return HttpResponse.json({
            template_id: 'test-template',
            default_seed: 1337,
            graph: { nodes: [{ id: 'node-1' }], edges: [] },
          })
        }),
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({ valid: true })
        }),
        http.post(`${PROXY_BASE}/v1/run`, () => {
          attempts++
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      await expect(httpV1Adapter.run(runRequest)).rejects.toMatchObject({
        schema: 'error.v1',
        code: 'SERVER_ERROR',
      })

      // Should have retried 3 times (original + 2 retries)
      expect(attempts).toBe(3)
    }, 10000) // 10s timeout for retry test
  })

  describe('Validate (POST /v1/validate)', () => {
    it('should return valid for compliant graph', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/validate`, async ({ request }) => {
          const body = await request.json() as any

          // Verify request structure
          expect(body).toHaveProperty('graph')
          expect(body.graph).toHaveProperty('nodes')
          expect(body.graph).toHaveProperty('edges')

          return HttpResponse.json({
            valid: true,
          })
        })
      )

      const result = await httpV1Adapter.validate({
        graph: {
          nodes: [
            { id: 'node-1', label: 'Test Node' },
            { id: 'node-2', label: 'Another Node' },
          ],
          edges: [
            { from: 'node-1', to: 'node-2', confidence: 0.8 },
          ],
        },
        seed: 42,
      })

      expect(result.valid).toBe(true)
    })

    it('should return violations for non-compliant graph', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json({
            valid: false,
            violations: [
              { field: 'nodes', message: 'Too many nodes: 250 > 200 (max)' },
              { field: 'edges', message: 'Too many edges: 550 > 500 (max)' },
            ],
          })
        })
      )

      const result = await httpV1Adapter.validate({
        graph: {
          nodes: Array.from({ length: 250 }, (_, i) => ({ id: `node-${i}`, label: `Node ${i}` })),
          edges: [],
        },
        seed: 42,
      })

      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.violations).toHaveLength(2)
        expect(result.violations[0].field).toBe('nodes')
        expect(result.violations[0].message).toContain('Too many nodes')
        expect(result.violations[1].field).toBe('edges')
      }
    })

    // Note: Timeout test skipped - difficult to reliably test with MSW + retry wrapper
    // The validate() function has a 5s timeout, but withRetry catches AbortErrors
    // and converts them to NETWORK_ERROR, triggering retries instead of immediate timeout

    it('should handle validation server error', async () => {
      server.use(
        http.post(`${PROXY_BASE}/v1/validate`, () => {
          return HttpResponse.json(
            { error: 'Internal validation error' },
            { status: 500 }
          )
        })
      )

      await expect(httpV1Adapter.validate({
        graph: { nodes: [{ id: 'node-1', label: 'Test' }], edges: [] },
        seed: 42,
      })).rejects.toMatchObject({
        code: 'SERVER_ERROR',
      })
    })
  })

  describe('Limits (GET /v1/limits)', () => {
    it('should return limits from singleton', async () => {
      // Note: httpV1Adapter.limits() uses limitsManager singleton
      // which is hydrated at boot time from /v1/limits or falls back to defaults.
      // This test verifies the adapter returns the singleton's cached value.

      const result = await httpV1Adapter.limits()

      // Verify structure (values depend on boot-time fetch or defaults)
      expect(result).toHaveProperty('nodes')
      expect(result).toHaveProperty('edges')
      expect(result.nodes).toHaveProperty('max')
      expect(result.edges).toHaveProperty('max')
      expect(typeof result.nodes.max).toBe('number')
      expect(typeof result.edges.max).toBe('number')
    })

    it('should return consistent values (singleton pattern)', async () => {
      // Singleton returns same cached value across calls
      const result1 = await httpV1Adapter.limits()
      const result2 = await httpV1Adapter.limits()

      expect(result1.nodes.max).toBe(result2.nodes.max)
      expect(result1.edges.max).toBe(result2.edges.max)
    })
  })
})
