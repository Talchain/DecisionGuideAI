/**
 * MSW Contract Tests for httpV1Adapter (v1 sync + templates)
 * Uses golden fixtures to verify correct integration with PLoT v1 API
 *
 * Coverage:
 * - Health (GET /v1/health)
 * - Templates (GET /v1/templates, GET /v1/templates/{id}/graph)
 * - Sync run (POST /v1/run)
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
          return HttpResponse.json({
            templates: [
              {
                id: 'revenue-forecast',
                name: 'Revenue Forecast',
                version: '1.0.0',
                description: 'Forecast revenue outcomes',
              },
              {
                id: 'risk-assessment',
                name: 'Risk Assessment',
                version: '1.2.0',
                description: 'Assess project risks',
              },
            ],
          })
        })
      )

      const result = await httpV1Adapter.templates()

      expect(result.schema).toBe('template-list.v1')
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('revenue-forecast')
      expect(result.items[1].id).toBe('risk-assessment')
    })
  })

  describe('Template Graph (GET /v1/templates/{id}/graph)', () => {
    it('should fetch template graph and metadata', async () => {
      server.use(
        http.get(`${PROXY_BASE}/v1/templates`, () => {
          return HttpResponse.json({
            templates: [
              {
                id: 'test-template',
                name: 'Test Template',
                version: '1.0.0',
                description: 'Test template description',
              },
            ],
          })
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
      expect(result.name).toBe('Test Template')
      expect(result.version).toBe('1.0.0')
      expect(result.description).toBe('Test template description')
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
        http.post(`${PROXY_BASE}/v1/run`, () => {
          return HttpResponse.json({
            result: {
              answer: '42.5 units expected',
              confidence: 0.85,
              explanation: 'Based on historical data, the expected outcome is 42.5 units',
              summary: {
                conservative: 38.0,
                likely: 42.5,
                optimistic: 48.0,
                units: 'units',
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
    })
  })
})
