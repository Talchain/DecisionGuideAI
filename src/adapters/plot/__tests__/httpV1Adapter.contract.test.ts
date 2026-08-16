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

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import { pinPlotProxyBase, PLOT_PROXY_BASE as PROXY_BASE } from '../../../../tests/setup/msw-env'

// Setup MSW server with default /version handler for capability negotiation
const server = setupServer(
  // Sprint N P1: Default handler for capability negotiation endpoint
  http.get(`${PROXY_BASE}/version`, () => {
    return HttpResponse.json({
      version: '1.5.0',
      build: 'test',
      capabilities: {
        detail_level: ['quick', 'standard', 'deep'],
        streaming: 'legacy',
      },
    })
  })
)

pinPlotProxyBase()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => {
  vi.unstubAllEnvs()
  server.close()
})

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

  // The 'Sync Run (POST /v1/run)', 'Error Handling' and 'Debug Headers
  // Wiring' suites are DELETED with `httpV1Adapter.run`. They drove the
  // retired direct browser->PLoT sync-run leg; there is no run to contract-
  // test any more. Health, Templates and Template Graph above are unchanged
  // - those routes survive the retirement and still carry their contract.
})
