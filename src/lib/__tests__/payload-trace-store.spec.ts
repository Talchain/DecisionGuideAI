/**
 * Payload Trace Store Tests
 *
 * Tests for the Zustand store that captures request/response payloads
 * for the debug panel Contract Inspector.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  usePayloadTraceStore,
  getFilteredPayloads,
  getSelectedPayload,
  getPayloadStats,
  type TracedPayload,
} from '../payload-trace-store'

// Mock import.meta.env
vi.mock('vitest', async () => {
  const actual = await vi.importActual('vitest')
  return actual
})

// Override import.meta.env for tests
const originalEnv = import.meta.env
beforeEach(() => {
  // @ts-expect-error - mocking import.meta.env
  import.meta.env = { ...originalEnv, VITE_APP_ENV: 'development' }
})

afterEach(() => {
  import.meta.env = originalEnv
})

describe('Payload Trace Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePayloadTraceStore.setState({
      payloads: [],
      selectedId: null,
      filterService: null,
      filterStatus: null,
      searchQuery: '',
    })
  })

  describe('recordRequestPayload', () => {
    it('records a new request payload', () => {
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-1',
        endpoint: '/bff/plot/v1/run',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { graph: { nodes: [], edges: [] } },
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads).toHaveLength(1)
      expect(payloads[0].id).toBe('req-1')
      expect(payloads[0].endpoint).toBe('/bff/plot/v1/run')
      expect(payloads[0].method).toBe('POST')
      expect(payloads[0].service).toBe('PLoT')
      expect(payloads[0].completed).toBe(false)
    })

    it('detects service from endpoint', () => {
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-cee',
        endpoint: '/bff/cee/draft-graph',
        method: 'POST',
        headers: {},
        body: {},
      })

      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-isl',
        endpoint: '/bff/isl/validate',
        method: 'POST',
        headers: {},
        body: {},
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads.find((p) => p.id === 'req-cee')?.service).toBe('CEE')
      expect(payloads.find((p) => p.id === 'req-isl')?.service).toBe('ISL')
    })

    it('limits payloads to MAX_PAYLOADS (20)', () => {
      // Record 25 requests
      for (let i = 0; i < 25; i++) {
        usePayloadTraceStore.getState().recordRequestPayload({
          id: `req-${i}`,
          endpoint: '/bff/plot/v1/run',
          method: 'POST',
          headers: {},
          body: {},
        })
      }

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads).toHaveLength(20)
      // Should have kept the most recent 20
      expect(payloads[0].id).toBe('req-24') // Most recent first
      expect(payloads[19].id).toBe('req-5') // Oldest of the kept ones
    })
  })

  describe('recordResponsePayload', () => {
    it('updates existing request with response data', () => {
      // First record the request
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-1',
        endpoint: '/bff/plot/v1/run',
        method: 'POST',
        headers: {},
        body: { test: 'request' },
      })

      // Then record the response
      usePayloadTraceStore.getState().recordResponsePayload({
        id: 'req-1',
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { analysis_status: 'computed', seed_used: 'abc123', results: [{ outcome: { mean: 0.5 } }] },
        duration: 150,
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads[0].status).toBe(200)
      expect(payloads[0].completed).toBe(true)
      expect(payloads[0].duration).toBe(150)
      expect(payloads[0].response?.body).toEqual({
        analysis_status: 'computed',
        seed_used: 'abc123',
        results: [{ outcome: { mean: 0.5 } }],
      })
    })

    it('performs contract validation on response', () => {
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-1',
        endpoint: '/bff/plot/v1/run',
        method: 'POST',
        headers: {},
        body: {},
      })

      // Response with valid PLoT shape
      usePayloadTraceStore.getState().recordResponsePayload({
        id: 'req-1',
        status: 200,
        headers: {},
        body: { analysis_status: 'computed', seed_used: 'unique123', results: [{ outcome: { mean: 0.5 } }] },
        duration: 100,
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads[0].contractValidation).toBeDefined()
      expect(payloads[0].contractValidation?.valid).toBe(true)
    })

    it('captures contract validation failures', () => {
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-1',
        endpoint: '/bff/plot/v1/run',
        method: 'POST',
        headers: {},
        body: {},
      })

      // Response with invalid PLoT shape (missing analysis_status)
      usePayloadTraceStore.getState().recordResponsePayload({
        id: 'req-1',
        status: 200,
        headers: {},
        body: { results: [] },
        duration: 100,
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads[0].contractValidation?.valid).toBe(false)
      expect(payloads[0].contractValidation?.errorCount).toBeGreaterThan(0)
    })

    it('records error message', () => {
      usePayloadTraceStore.getState().recordRequestPayload({
        id: 'req-1',
        endpoint: '/bff/plot/v1/run',
        method: 'POST',
        headers: {},
        body: {},
      })

      usePayloadTraceStore.getState().recordResponsePayload({
        id: 'req-1',
        status: 500,
        headers: {},
        body: { error: 'Internal server error' },
        duration: 100,
        error: 'Server error',
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads[0].error).toBe('Server error')
      expect(payloads[0].status).toBe(500)
    })

    it('handles response for non-existent request (no-op)', () => {
      usePayloadTraceStore.getState().recordResponsePayload({
        id: 'non-existent',
        status: 200,
        headers: {},
        body: {},
        duration: 100,
      })

      const { payloads } = usePayloadTraceStore.getState()
      expect(payloads).toHaveLength(0)
    })
  })

  describe('getFilteredPayloads', () => {
    beforeEach(() => {
      // Set up some test data
      usePayloadTraceStore.setState({
        payloads: [
          createPayload('req-1', 'PLoT', 200, true),
          createPayload('req-2', 'CEE', 200, true),
          createPayload('req-3', 'PLoT', 500, false),
          createPayload('req-4', 'ISL', 200, true),
          createPayload('req-5', 'CEE', 422, false),
        ],
        selectedId: null,
        filterService: null,
        filterStatus: null,
        searchQuery: '',
      })
    })

    it('returns all payloads when no filter set', () => {
      const state = usePayloadTraceStore.getState()
      const filtered = getFilteredPayloads(state)
      expect(filtered).toHaveLength(5)
    })

    it('filters by service', () => {
      usePayloadTraceStore.setState({ filterService: 'CEE' })
      const state = usePayloadTraceStore.getState()
      const filtered = getFilteredPayloads(state)
      expect(filtered).toHaveLength(2)
      expect(filtered.every((p) => p.service === 'CEE')).toBe(true)
    })

    it('filters by error status', () => {
      usePayloadTraceStore.setState({ filterStatus: 'error' })
      const state = usePayloadTraceStore.getState()
      const filtered = getFilteredPayloads(state)
      expect(filtered).toHaveLength(2)
      expect(filtered.every((p) => p.status && p.status >= 400)).toBe(true)
    })

    it('filters by schema issues', () => {
      usePayloadTraceStore.setState({ filterStatus: 'schema' })
      const state = usePayloadTraceStore.getState()
      const filtered = getFilteredPayloads(state)
      expect(filtered).toHaveLength(2)
      expect(filtered.every((p) => p.contractValidation?.valid === false)).toBe(true)
    })

    it('combines service and status filters', () => {
      usePayloadTraceStore.setState({ filterService: 'CEE', filterStatus: 'error' })
      const state = usePayloadTraceStore.getState()
      const filtered = getFilteredPayloads(state)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('req-5')
    })
  })

  describe('getSelectedPayload', () => {
    it('returns null when no selection', () => {
      const state = usePayloadTraceStore.getState()
      expect(getSelectedPayload(state)).toBeNull()
    })

    it('returns selected payload', () => {
      usePayloadTraceStore.setState({
        payloads: [createPayload('req-1', 'PLoT', 200, true)],
        selectedId: 'req-1',
      })

      const state = usePayloadTraceStore.getState()
      expect(getSelectedPayload(state)?.id).toBe('req-1')
    })
  })

  describe('getPayloadStats', () => {
    it('computes correct stats', () => {
      usePayloadTraceStore.setState({
        payloads: [
          createPayload('req-1', 'PLoT', 200, true),
          createPayload('req-2', 'CEE', 200, true),
          createPayload('req-3', 'PLoT', 500, false),
          createPayload('req-4', 'ISL', 200, true),
          createPayload('req-5', 'CEE', 422, false),
        ],
        selectedId: null,
        filterService: null,
        filterStatus: null,
        searchQuery: '',
      })

      const state = usePayloadTraceStore.getState()
      const stats = getPayloadStats(state)

      expect(stats.total).toBe(5)
      expect(stats.errors).toBe(2)  // 500 and 422
      expect(stats.schemaIssues).toBe(2)  // Two with schema issues
    })

    it('returns zeros for empty store', () => {
      const state = usePayloadTraceStore.getState()
      const stats = getPayloadStats(state)

      expect(stats.total).toBe(0)
      expect(stats.errors).toBe(0)
      expect(stats.schemaIssues).toBe(0)
    })
  })

  describe('store actions', () => {
    it('selectPayload updates selectedId', () => {
      usePayloadTraceStore.getState().selectPayload('req-1')
      expect(usePayloadTraceStore.getState().selectedId).toBe('req-1')

      usePayloadTraceStore.getState().selectPayload(null)
      expect(usePayloadTraceStore.getState().selectedId).toBeNull()
    })

    it('setFilterService updates filterService', () => {
      usePayloadTraceStore.getState().setFilterService('CEE')
      expect(usePayloadTraceStore.getState().filterService).toBe('CEE')

      usePayloadTraceStore.getState().setFilterService(null)
      expect(usePayloadTraceStore.getState().filterService).toBeNull()
    })

    it('setFilterStatus updates filterStatus', () => {
      usePayloadTraceStore.getState().setFilterStatus('error')
      expect(usePayloadTraceStore.getState().filterStatus).toBe('error')

      usePayloadTraceStore.getState().setFilterStatus(null)
      expect(usePayloadTraceStore.getState().filterStatus).toBeNull()
    })

    it('clearPayloads removes all payloads', () => {
      usePayloadTraceStore.setState({
        payloads: [
          createPayload('req-1', 'PLoT', 200, true),
          createPayload('req-2', 'CEE', 200, true),
        ],
        selectedId: 'req-1',
      })

      usePayloadTraceStore.getState().clearPayloads()

      const state = usePayloadTraceStore.getState()
      expect(state.payloads).toHaveLength(0)
      expect(state.selectedId).toBeNull()
    })

    it('exportPayloads returns JSON string', () => {
      usePayloadTraceStore.setState({
        payloads: [createPayload('req-1', 'PLoT', 200, true)],
      })

      const json = usePayloadTraceStore.getState().exportPayloads()
      const parsed = JSON.parse(json)

      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.payloads).toHaveLength(1)
      expect(parsed.payloads[0].id).toBe('req-1')
    })
  })
})

// Helper to create test payloads
function createPayload(
  id: string,
  service: 'CEE' | 'PLoT' | 'ISL',
  status: number,
  schemaValid: boolean
): TracedPayload {
  return {
    id,
    service,
    endpoint: `/bff/${service.toLowerCase()}/test`,
    method: 'POST',
    timestamp: Date.now(),
    duration: 100,
    status,
    request: { headers: {}, body: {} },
    response: { headers: {}, body: {} },
    contractValidation: {
      valid: schemaValid,
      checks: [],
      errorCount: schemaValid ? 0 : 1,
      warningCount: 0,
    },
    completed: true,
  }
}
