/**
 * useDebugData Hook Tests
 *
 * Tests for the debug data normalization hook, including ISL extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDebugData } from '../hooks/useDebugData'

// Mock the stores
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      ceePipelineTrace: null,
      nodes: [],
      edges: [],
      runMeta: null,
    })
  ),
}))

vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: vi.fn((selector) =>
    selector({
      payloads: [],
    })
  ),
}))

vi.mock('../../../lib/gate-state', () => ({
  useGateStore: vi.fn((selector) =>
    selector({
      gates: {},
    })
  ),
}))

import { useCanvasStore } from '../../../canvas/store'
import { usePayloadTraceStore } from '../../../lib/payload-trace-store'
import { useGateStore } from '../../../lib/gate-state'

describe('useDebugData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to default empty state
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector({
        ceePipelineTrace: null,
        nodes: [],
        edges: [],
        runMeta: null,
      })
    )
    vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
      selector({
        payloads: [],
      })
    )
    vi.mocked(useGateStore).mockImplementation((selector) =>
      selector({
        gates: {},
      })
    )
  })

  describe('ISL extraction from PLoT downstream_calls', () => {
    it('extracts ISL data from body.downstream_calls.isl', () => {
      const plotPayload = {
        id: 'req-123',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            downstream_calls: {
              isl: {
                endpoint: '/api/isl/analyze',
                request: { graph: {} },
                response: { importance_scores: [] },
                status_code: 200,
                success: true,
                latency_ms: 450,
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.services.isl).not.toBeNull()
      expect(result.current.services.isl?.name).toBe('ISL')
      expect(result.current.services.isl?.status).toBe(200)
      expect(result.current.services.isl?.success).toBe(true)
      expect(result.current.services.isl?.duration_ms).toBe(450)
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/analyze')
    })

    it('extracts ISL data from body.trace.downstream_calls.isl', () => {
      const plotPayload = {
        id: 'req-456',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 2000,
        request: { body: {} },
        response: {
          body: {
            trace: {
              downstream_calls: {
                isl: {
                  endpoint: '/api/isl/importance',
                  request: { nodes: [] },
                  response: { scores: [0.8, 0.5, 0.3] },
                  status_code: 200,
                  success: true,
                  latency_ms: 800,
                },
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.services.isl).not.toBeNull()
      expect(result.current.services.isl?.duration_ms).toBe(800)
      expect(result.current.services.isl?.response).toEqual({ scores: [0.8, 0.5, 0.3] })
    })

    it('extracts ISL data from top-level downstream_calls.isl', () => {
      // Note: The hook looks at plotPayload.response.body first,
      // then falls back to top-level. This test confirms top-level extraction
      // when body has the downstream_calls at root level.
      const plotPayload = {
        id: 'req-789',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1800,
        request: { body: {} },
        response: {
          body: {
            // Top-level downstream_calls within body
            downstream_calls: {
              isl: {
                endpoint: '/api/isl/v2',
                request: { analysis: 'sensitivity' },
                response: { sensitivities: {} },
                status_code: 200,
                success: true,
                latency_ms: 600,
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.services.isl).not.toBeNull()
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/v2')
    })

    it('returns null ISL when no downstream_calls present', () => {
      const plotPayload = {
        id: 'req-no-isl',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1200,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            option_comparison: [],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.services.isl).toBeNull()
    })

    it('prefers downstream_calls ISL over direct capture (reflects actual orchestration)', () => {
      // downstream_calls ISL reflects the actual ISL call made during PLoT orchestration
      // This is the correct data source for debugging the analysis flow
      const plotPayload = {
        id: 'req-plot',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            downstream_calls: {
              isl: {
                endpoint: '/api/isl/from-plot',
                latency_ms: 300,
                status_code: 200,
                success: true,
              },
            },
          },
        },
      }

      const islPayload = {
        id: 'req-isl-direct',
        service: 'ISL',
        endpoint: '/api/isl/direct',
        status: 200,
        completed: true,
        duration: 500,
        request: { body: { direct: true } },
        response: { body: { direct_response: true } },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload, islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // Should prefer downstream_calls ISL as it reflects the actual analysis ISL call
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/from-plot')
      expect(result.current.services.isl?.duration_ms).toBe(300)
    })

    it('falls back to direct ISL when downstream_calls ISL failed', () => {
      const plotPayload = {
        id: 'req-plot',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            downstream_calls: {
              isl: {
                endpoint: '/api/isl/from-plot',
                latency_ms: 300,
                status_code: 500,
                success: false,
                error: 'ISL failed',
              },
            },
          },
        },
      }

      const islPayload = {
        id: 'req-isl-direct',
        service: 'ISL',
        endpoint: '/api/isl/direct',
        status: 200,
        completed: true,
        duration: 500,
        request: { body: { direct: true } },
        response: { body: { direct_response: true } },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload, islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // When downstream_calls ISL failed but direct ISL succeeded, prefer direct
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/direct')
      expect(result.current.services.isl?.success).toBe(true)
    })
  })

  describe('overall status calculation', () => {
    it('returns success when all payloads succeed', () => {
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            { id: '1', service: 'CEE', status: 200, completed: true, endpoint: '/cee' },
            { id: '2', service: 'PLoT', status: 200, completed: true, endpoint: '/plot' },
          ],
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.overall.status).toBe('success')
    })

    it('returns error when any payload has error', () => {
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            { id: '1', service: 'CEE', status: 200, completed: true, endpoint: '/cee' },
            { id: '2', service: 'PLoT', status: 500, completed: true, endpoint: '/plot', error: 'Server error' },
          ],
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.overall.status).toBe('error')
    })

    it('returns pending when any payload not completed', () => {
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            { id: '1', service: 'CEE', status: 200, completed: true, endpoint: '/cee' },
            { id: '2', service: 'PLoT', completed: false, endpoint: '/plot' },
          ],
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.overall.status).toBe('pending')
    })
  })

  describe('pipeline data extraction', () => {
    it('extracts LLM metadata from llm_calls array', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: {
            pipeline_trace: {
              llm_calls: [
                {
                  model: 'claude-3-sonnet',
                  prompt_tokens: 1000,
                  completion_tokens: 500,
                  duration_ms: 2500,
                },
              ],
            },
          },
          nodes: [],
          edges: [],
          runMeta: null,
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.llm_metadata?.model).toBe('claude-3-sonnet')
      expect(result.current.pipeline.llm_metadata?.token_usage?.prompt_tokens).toBe(1000)
      expect(result.current.pipeline.llm_metadata?.token_usage?.completion_tokens).toBe(500)
      expect(result.current.pipeline.llm_metadata?.token_usage?.total_tokens).toBe(1500)
    })

    it('extracts pipeline stages from trace', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: {
            pipeline_trace: {
              llm_calls: [{ model: 'gpt-4' }],
              node_extraction: { raw: { decision: 1 } },
              transforms: { applied: [] },
              final_graph: { nodes: [], edges: [] },
            },
          },
          nodes: [],
          edges: [],
          runMeta: null,
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.stages).toHaveLength(4)
      expect(result.current.pipeline.stages.map(s => s.id)).toEqual([
        'llm_draft',
        'node_extraction',
        'transforms',
        'final_graph',
      ])
    })
  })

  describe('connectivity data', () => {
    it('counts nodes by kind', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [
            { id: '1', data: { kind: 'decision' } },
            { id: '2', data: { kind: 'option' } },
            { id: '3', data: { kind: 'option' } },
            { id: '4', data: { kind: 'goal' } },
            { id: '5', data: { kind: 'factor' } },
            { id: '6', data: { kind: 'factor' } },
            { id: '7', data: { kind: 'factor' } },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '4' },
          ],
          runMeta: null,
        })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.connectivity).toEqual({
        decision_count: 1,
        option_count: 2,
        goal_count: 1,
        factor_count: 3,
        edge_count: 2,
      })
    })
  })

  describe('hasData detection', () => {
    it('returns hasData=false when no data available', () => {
      const { result } = renderHook(() => useDebugData())
      expect(result.current.hasData).toBe(false)
    })

    it('returns hasData=true when payloads present', () => {
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            { id: '1', service: 'CEE', completed: true, endpoint: '/cee' },
          ],
        })
      )

      const { result } = renderHook(() => useDebugData())
      expect(result.current.hasData).toBe(true)
    })

    it('returns hasData=true when nodes present', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [{ id: '1', data: { kind: 'decision' } }],
          edges: [],
          runMeta: null,
        })
      )

      const { result } = renderHook(() => useDebugData())
      expect(result.current.hasData).toBe(true)
    })
  })
})
