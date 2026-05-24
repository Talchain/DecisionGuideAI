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

  // Regression: ISL fallback from PLoT response body should use key-presence, not truthy
  describe('ISL fallback extraction from PLoT response body', () => {
    it('extracts ISL fields from PLoT body when option_comparison is empty array', () => {
      const plotPayload = {
        id: 'req-empty-oc',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            option_comparison: [],  // present but empty — truthy check would miss this
            factor_sensitivity: [],
            robustness: { fragile_edges: [], robust_edges: [] },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // The fallback should still populate isl_response even with empty arrays
      expect(result.current.payloads.isl_response).not.toBeNull()
      expect((result.current.payloads.isl_response as Record<string, unknown>)?._source)
        .toBe('plot_response_extraction')
    })

    it('sets islDataSource to plot_response_extraction when fields extracted from PLoT body', () => {
      const plotPayload = {
        id: 'req-plot-extract',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1200,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            option_comparison: [{ option_id: 'opt1', win_probability: 0.7 }],
            factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.5 }],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.diagnostics.isl_data_source).toBe('plot_response_extraction')
    })
  })

  // Regression: downstream_calls.isl can be object (not just array)
  describe('downstream_calls.isl object form', () => {
    it('extracts ISL from object-shaped downstream_calls.isl', () => {
      const plotPayload = {
        id: 'req-obj-isl',
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
                response: { option_comparison: [{ option_id: 'opt1', win_probability: 0.8 }] },
                status_code: 200,
                success: true,
                latency_ms: 400,
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
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/analyze')
      expect(result.current.diagnostics.isl_data_source).toBe('downstream_calls')
    })

    it('extracts ISL from array-shaped downstream_calls.isl', () => {
      const plotPayload = {
        id: 'req-arr-isl',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            downstream_calls: {
              isl: [{
                endpoint: '/api/isl/analyze',
                request: { graph: {} },
                response: { option_comparison: [{ option_id: 'opt1', win_probability: 0.6 }] },
                status_code: 200,
                success: true,
                latency_ms: 350,
              }],
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.services.isl).not.toBeNull()
      expect(result.current.services.isl?.endpoint).toBe('/api/isl/analyze')
      expect(result.current.diagnostics.isl_data_source).toBe('downstream_calls')
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

  describe('winningOption extraction (extractWinningOption)', () => {
    it('extracts winner from top-level option_comparison (PLoT V2)', () => {
      const plotPayload = {
        id: 'req-winner-oc',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'opt_a', option_label: 'Option A', win_probability: 0.85 },
              { option_id: 'opt_b', option_label: 'Option B', win_probability: 0.15 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('opt_a')
      expect(result.current.winningOption?.label).toBe('Option A')
      expect(result.current.winningOption?.win_probability).toBeCloseTo(85)
      expect(result.current.winningOption?.is_close_race).toBe(false)
    })

    it('extracts winner from legacy options array (backwards compat)', () => {
      const plotPayload = {
        id: 'req-winner-legacy',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            options: [
              { id: 'opt_x', label: 'Option X', win_probability: 0.72 },
              { id: 'opt_y', label: 'Option Y', win_probability: 0.28 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('opt_x')
      expect(result.current.winningOption?.label).toBe('Option X')
      expect(result.current.winningOption?.win_probability).toBeCloseTo(72)
    })

    it('prefers option_comparison over options when both present', () => {
      const plotPayload = {
        id: 'req-winner-precedence',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'oc_winner', option_label: 'From OC', win_probability: 0.9 },
            ],
            options: [
              { id: 'legacy_winner', label: 'From Legacy', win_probability: 0.8 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('oc_winner')
      expect(result.current.winningOption?.label).toBe('From OC')
    })

    it('finds options in downstream_calls.isl.response.option_comparison', () => {
      const plotPayload = {
        id: 'req-winner-dc',
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
                status_code: 200,
                success: true,
                latency_ms: 300,
                response: {
                  option_comparison: [
                    { option_id: 'dc_opt', option_label: 'DC Option', win_probability: 0.95 },
                  ],
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

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('dc_opt')
    })

    it('returns null when all paths are empty', () => {
      const plotPayload = {
        id: 'req-winner-empty',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1000,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).toBeNull()
    })

    it('falls through empty option_comparison to populated ISL direct (regression)', () => {
      // Path 1 has empty option_comparison — must not shadow Path 6 with real data.
      const plotPayload = {
        id: 'req-empty-fallthrough',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1200,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            option_comparison: [], // empty — must fall through
          },
        },
      }
      const islPayload = {
        id: 'req-empty-fallthrough-isl',
        service: 'ISL',
        endpoint: '/isl/simulate',
        status: 200,
        completed: true,
        duration: 300,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'fall_opt', option_label: 'Fallthrough Winner', win_probability: 0.91 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload, islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('fall_opt')
      expect(result.current.winningOption?.label).toBe('Fallthrough Winner')
    })

    it('extracts winner from ISL-only payload when PLoT is absent', () => {
      // No PLoT payload at all — ISL-only scenario.
      const islPayload = {
        id: 'req-isl-only',
        service: 'ISL',
        endpoint: '/isl/simulate',
        status: 200,
        completed: true,
        duration: 300,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'isl_only_opt', option_label: 'ISL Only Winner', win_probability: 0.78 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('isl_only_opt')
      expect(result.current.winningOption?.label).toBe('ISL Only Winner')
    })

    it('finds winner from separate ISL payload option_comparison (Path 6)', () => {
      // PLoT response has NO option_comparison — forces fallthrough to Path 6.
      const plotPayload = {
        id: 'req-isl-direct',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1200,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            // No option_comparison or options here
          },
        },
      }
      const islPayload = {
        id: 'req-isl-direct-isl',
        service: 'ISL',
        endpoint: '/isl/simulate',
        status: 200,
        completed: true,
        duration: 300,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'isl_opt_a', option_label: 'ISL Direct A', win_probability: 0.88 },
              { option_id: 'isl_opt_b', option_label: 'ISL Direct B', win_probability: 0.12 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload, islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('isl_opt_a')
      expect(result.current.winningOption?.label).toBe('ISL Direct A')
      expect(result.current.winningOption?.win_probability).toBeCloseTo(88)
    })

    it('finds winner from separate ISL payload options array (legacy Path 6)', () => {
      // PLoT response has NO option_comparison — forces fallthrough to Path 6.
      const plotPayload = {
        id: 'req-isl-legacy',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1200,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
          },
        },
      }
      const islPayload = {
        id: 'req-isl-legacy-isl',
        service: 'ISL',
        endpoint: '/isl/simulate',
        status: 200,
        completed: true,
        duration: 300,
        request: { body: {} },
        response: {
          body: {
            options: [
              { id: 'isl_leg_x', label: 'Legacy ISL X', win_probability: 0.65 },
              { id: 'isl_leg_y', label: 'Legacy ISL Y', win_probability: 0.35 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload, islPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.id).toBe('isl_leg_x')
      expect(result.current.winningOption?.label).toBe('Legacy ISL X')
      expect(result.current.winningOption?.win_probability).toBeCloseTo(65)
    })

    it('detects close race and populates runner_up', () => {
      const plotPayload = {
        id: 'req-winner-close',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 1500,
        request: { body: {} },
        response: {
          body: {
            option_comparison: [
              { option_id: 'opt_1', option_label: 'First', win_probability: 0.55 },
              { option_id: 'opt_2', option_label: 'Second', win_probability: 0.45 },
            ],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.winningOption).not.toBeNull()
      expect(result.current.winningOption?.is_close_race).toBe(true)
      expect(result.current.winningOption?.runner_up).not.toBeUndefined()
      expect(result.current.winningOption?.runner_up?.id).toBe('opt_2')
      expect(result.current.winningOption?.runner_up?.label).toBe('Second')
      expect(result.current.winningOption?.runner_up?.win_probability).toBeCloseTo(45)
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

  // ===========================================================================
  // B5.25: M2 review extraction with review_status variants
  // ===========================================================================

  describe('M2 review extraction', () => {
    it('extracts M2 review when PLoT response has review_status "complete" + downstream data', () => {
      const plotPayload = {
        id: 'req-m2-complete',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            downstream_calls: {
              cee: [{
                endpoint: '/assist/v1/decision-review',
                status_code: 200,
                success: true,
                latency_ms: 2000,
                response: {
                  headline: 'Strong recommendation for Option A',
                  bullets: ['Point 1', 'Point 2', 'Point 3'],
                  coaching_paragraph: ['Para 1'],
                  bias_insights: [{ type: 'anchoring' }],
                },
              }],
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.m2_review).not.toBeNull()
      expect(result.current.m2_review?.status).toBe('success')
      expect(result.current.m2_review?.headline).toBe('Strong recommendation for Option A')
      expect(result.current.m2_review?.bullets_count).toBe(3)
      expect(result.current.m2_review?.bias_insights_count).toBe(1)
    })

    it('shows M2 review "not available" when PLoT response has no review data', () => {
      const plotPayload = {
        id: 'req-no-review',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 3000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            // No review_status, no downstream calls
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.m2_review).toBeNull()
    })
  })

  // ===========================================================================
  // B5.19: Artefact chain node_extraction fallback
  // ===========================================================================

  describe('artefact chain node_extraction', () => {
    it('derives validated counts from canvas nodes when pipeline trace lacks node_extraction', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [
            { id: '1', data: { kind: 'decision' } },
            { id: '2', data: { kind: 'option' } },
            { id: '3', data: { kind: 'option' } },
            { id: '4', data: { kind: 'goal' } },
            { id: '5', data: { kind: 'factor' } },
          ],
          edges: [],
          runMeta: null,
        })
      )

      const { result } = renderHook(() => useDebugData())

      // node_extraction should have a validated stage derived from connectivity
      expect(result.current.pipeline.node_extraction).toBeDefined()
      expect(result.current.pipeline.node_extraction?.validated).toEqual({
        decision: 1,
        option: 2,
        goal: 1,
        factor: 1,
      })
    })

    it('returns undefined node_extraction when no canvas nodes and no pipeline trace', () => {
      // Default mock: ceePipelineTrace=null, nodes=[], edges=[]
      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.node_extraction).toBeUndefined()
    })

    it('derives Raw from stage_1_parse snapshot in CEE response', () => {
      const ceePayload = {
        id: 'req-cee-stages',
        service: 'CEE',
        endpoint: '/assist/v1/draft-graph',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            trace: {
              pipeline: {
                stage_snapshots: {
                  stage_1_parse: {
                    nodes: [
                      { kind: 'decision', id: 'd1' },
                      { kind: 'option', id: 'o1' },
                      { kind: 'option', id: 'o2' },
                      { kind: 'goal', id: 'g1' },
                    ],
                  },
                  stage_4_repair: {
                    nodes: [
                      { kind: 'decision', id: 'd1' },
                      { kind: 'option', id: 'o1' },
                      { kind: 'option', id: 'o2' },
                      { kind: 'goal', id: 'g1' },
                      { kind: 'factor', id: 'f1' },
                    ],
                  },
                },
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.node_extraction?.raw).toEqual({
        decision: 1,
        option: 2,
        goal: 1,
      })
      expect(result.current.pipeline.node_extraction?.validated).toEqual({
        decision: 1,
        option: 2,
        goal: 1,
        factor: 1,
      })
    })

    it('shows Normalised as undefined when stage_2_normalise absent and no enrich snapshot', () => {
      const ceePayload = {
        id: 'req-cee-no-norm',
        service: 'CEE',
        endpoint: '/assist/v1/draft-graph',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            trace: {
              pipeline: {
                stage_snapshots: {
                  stage_1_parse: { nodes: [{ kind: 'decision', id: 'd1' }] },
                  // stage_2_normalise absent, stage_3_enrich absent
                  stage_4_repair: { nodes: [{ kind: 'decision', id: 'd1' }] },
                },
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.pipeline.node_extraction?.raw).toBeDefined()
      expect(result.current.pipeline.node_extraction?.normalised).toBeUndefined()
      expect(result.current.pipeline.node_extraction?.validated).toBeDefined()
    })

    it('falls back to stage_4_repair when stage_5_package is empty', () => {
      const ceePayload = {
        id: 'req-cee-empty-pkg',
        service: 'CEE',
        endpoint: '/assist/v1/draft-graph',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            trace: {
              pipeline: {
                stage_snapshots: {
                  stage_1_parse: { nodes: [{ kind: 'decision', id: 'd1' }] },
                  stage_5_package: {}, // present but empty — should not be used
                  stage_4_repair: { nodes: [{ kind: 'decision', id: 'd1' }, { kind: 'option', id: 'o1' }] },
                },
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // stage_5_package is empty so validated should come from stage_4_repair
      expect(result.current.pipeline.node_extraction?.validated).toEqual({
        decision: 1,
        option: 1,
      })
    })
  })

  // ===========================================================================
  // M2 review: reading from m1_review + review_meta on PLoT response
  // ===========================================================================

  describe('M2 review from m1_review + review_meta', () => {
    it('extracts duration from review_meta.latency_ms', () => {
      const plotPayload = {
        id: 'req-m2-meta',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 20000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1-2025-04-14', latency_ms: 17380 },
            m1_review: {
              narrative_summary: 'A detailed review of the decision.',
              bias_findings: [{ type: 'anchoring' }],
              key_assumptions: ['A1', 'A2', 'A3', 'A4', 'A5'],
            },
            review_warnings: ['READINESS_CONTRADICTION', 'UNGROUNDED_NUMBER'],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.m2_review).not.toBeNull()
      expect(result.current.m2_review?.duration_ms).toBe(17380)
    })

    it('extracts bias findings count from m1_review.bias_findings.length', () => {
      const plotPayload = {
        id: 'req-m2-bias',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 20000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1-2025-04-14', latency_ms: 17380 },
            m1_review: {
              narrative_summary: 'Summary text',
              bias_findings: [{ type: 'anchoring' }],
              key_assumptions: ['A1', 'A2', 'A3'],
            },
            review_warnings: [],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.m2_review?.bias_insights_count).toBe(1)
    })

    it('extracts review warnings from review_warnings array', () => {
      const plotPayload = {
        id: 'req-m2-warnings',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 20000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1', latency_ms: 1000 },
            m1_review: {
              narrative_summary: 'Review text',
              bias_findings: [],
              key_assumptions: [],
            },
            review_warnings: ['READINESS_CONTRADICTION', 'UNGROUNDED_NUMBER'],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.m2_review?.review_warnings).toEqual([
        'READINESS_CONTRADICTION',
        'UNGROUNDED_NUMBER',
      ])
    })

    it('extracts M2 model from review_meta.model', () => {
      const plotPayload = {
        id: 'req-m2-model',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 20000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1-2025-04-14', latency_ms: 17380 },
            m1_review: {
              narrative_summary: 'Review text',
              bias_findings: [],
              key_assumptions: ['A1'],
            },
            review_warnings: [],
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // M2 model
      expect(result.current.m2_review?.model).toBe('gpt-4.1-2025-04-14')
      // Key assumptions count
      expect(result.current.m2_review?.key_assumptions_count).toBe(1)
      // Narrative summary
      expect(result.current.m2_review?.narrative_summary).toBe('Review text')
    })

    it('populates LLM Calls tab M2 row with review_meta duration', () => {
      const plotPayload = {
        id: 'req-m2-llm',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 20000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1-2025-04-14', latency_ms: 17380 },
            m1_review: {
              narrative_summary: 'Text',
              bias_findings: [],
              key_assumptions: [],
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // Duration from review_meta.latency_ms is wired through to m2_review.duration_ms
      expect(result.current.m2_review?.duration_ms).toBe(17380)
      // Model from review_meta.model is wired through
      expect(result.current.m2_review?.model).toBe('gpt-4.1-2025-04-14')
    })

    it('extracts CEE draft tokens from trace.pipeline.llm_metadata', () => {
      const ceePayload = {
        id: 'req-cee-llm',
        service: 'CEE',
        endpoint: '/assist/v1/draft-graph',
        status: 200,
        completed: true,
        duration: 43307,
        request: { body: {} },
        response: {
          body: {
            trace: {
              pipeline: {
                llm_metadata: {
                  model: 'gpt-4o',
                  duration_ms: 43307,
                  token_usage: {
                    prompt_tokens: 5000,
                    completion_tokens: 2000,
                    total_tokens: 7000,
                  },
                },
              },
            },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // llm_metadata is available on pipeline
      expect(result.current.pipeline.llm_metadata).toBeDefined()
      expect(result.current.pipeline.llm_metadata?.model).toBe('gpt-4o')
      expect(result.current.pipeline.llm_metadata?.token_usage?.total_tokens).toBe(7000)
      expect(result.current.pipeline.llm_metadata?.duration_ms).toBe(43307)
    })

    it('preserves duration_ms of 0 (not coerced to null)', () => {
      const plotPayload = {
        id: 'req-m2-zero-dur',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            review_meta: { model: 'gpt-4.1-2025-04-14', latency_ms: 0 },
            m1_review: { narrative_summary: 'Test' },
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // duration_ms: 0 should be preserved, not coerced to null
      expect(result.current.m2_review?.duration_ms).toBe(0)
    })

    it('gracefully handles missing review_meta (no crashes)', () => {
      const plotPayload = {
        id: 'req-m2-no-meta',
        service: 'PLoT',
        endpoint: '/v2/run',
        status: 200,
        completed: true,
        duration: 5000,
        request: { body: {} },
        response: {
          body: {
            analysis_status: 'computed',
            review_status: 'complete',
            // No review_meta, no m1_review
          },
        },
      }

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [plotPayload] })
      )

      const { result } = renderHook(() => useDebugData())

      // Should still return success with null/0 values (no crash)
      expect(result.current.m2_review).not.toBeNull()
      expect(result.current.m2_review?.status).toBe('success')
      expect(result.current.m2_review?.duration_ms).toBeNull()
      expect(result.current.m2_review?.model).toBeNull()
      expect(result.current.m2_review?.bias_insights_count).toBe(0)
      expect(result.current.m2_review?.key_assumptions_count).toBe(0)
      expect(result.current.m2_review?.review_warnings).toEqual([])
    })
  })

  // ===========================================================================
  // Diagnostic checks — orchestrator envelope parity
  // ===========================================================================
  // When CEE response is an OrchestratorResponseEnvelopeV2 (no top-level
  // nodes/edges/trace), diagnostics should still be correct by falling back
  // to canvas store nodes/edges and envelope._diagnostic_trace.
  // ===========================================================================
  describe('diagnostic_checks — orchestrator envelope parity', () => {
    /**
     * Helper: set up stores with an envelope-style CEE response (no top-level
     * nodes/edges/trace) plus canvas store nodes/edges and optional runMeta.
     */
    function setupEnvelopeScenario(options: {
      canvasNodes?: any[]
      canvasEdges?: any[]
      envelopeDiagnosticTrace?: Record<string, unknown> | null
      runMetaDiagnosticTrace?: Record<string, unknown> | null
      envelopeRouteMetadata?: Record<string, unknown> | null
    }) {
      const {
        canvasNodes = [],
        canvasEdges = [],
        envelopeDiagnosticTrace = null,
        runMetaDiagnosticTrace = null,
        envelopeRouteMetadata = null,
      } = options

      const ceePayload = {
        id: 'req-env-1',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v1/turn',
        method: 'POST',
        status: 200,
        completed: true,
        duration: 2000,
        timestamp: Date.now(),
        request: { body: {} },
        response: {
          body: {
            // Envelope shape — NO top-level nodes/edges/trace
            response_version: 2,
            assistant_text: 'Here is your model',
            blocks: [],
            ...(envelopeDiagnosticTrace ? { _diagnostic_trace: envelopeDiagnosticTrace } : {}),
            ...(envelopeRouteMetadata ? { _route_metadata: envelopeRouteMetadata } : {}),
          },
        },
      }

      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: canvasNodes,
          edges: canvasEdges,
          runMeta: runMetaDiagnosticTrace
            ? { ceeDiagnosticTrace: runMetaDiagnosticTrace }
            : null,
        })
      )

      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )
    }

    it('cee_trace_present is true when envelope has _diagnostic_trace', () => {
      setupEnvelopeScenario({
        envelopeDiagnosticTrace: {
          llm_calls: [{ model: 'claude-3-opus', latency_ms: 500 }],
          provider_resolution: [{ resolved_model: 'claude-3-opus' }],
        },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.cee_trace_present).toBe(true)
    })

    it('cee_trace_present is true when envelope has _route_metadata', () => {
      setupEnvelopeScenario({
        envelopeRouteMetadata: { resolved_model: 'claude-3-opus' },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.cee_trace_present).toBe(true)
    })

    it('cee_trace_present is true when runMeta has ceeDiagnosticTrace', () => {
      setupEnvelopeScenario({
        runMetaDiagnosticTrace: {
          llm_calls: [{ model: 'claude-3-opus' }],
        },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.cee_trace_present).toBe(true)
    })

    it('llm_raw_available is true when _diagnostic_trace.llm_calls is populated', () => {
      setupEnvelopeScenario({
        envelopeDiagnosticTrace: {
          llm_calls: [{ model: 'claude-3-opus', raw_prompt: '...' }],
        },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.llm_raw_available).toBe(true)
      expect(result.current.diagnostics.llm_raw_path_found).toBe('_diagnostic_trace.llm_calls')
    })

    it('llm_raw_available is false when _diagnostic_trace has empty llm_calls', () => {
      setupEnvelopeScenario({
        envelopeDiagnosticTrace: {
          llm_calls: [],
        },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.llm_raw_available).toBe(false)
    })

    it('confidence_differentiated is true when canvas edges have varied exists_probability', () => {
      const canvasNodes = [
        { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'A' } },
        { id: 'f2', type: 'factor', data: { kind: 'factor', label: 'B' } },
        { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Goal' } },
      ]
      const canvasEdges = [
        { id: 'e1', source: 'f1', target: 'g1', data: { beliefExists: 0.7 } },
        { id: 'e2', source: 'f2', target: 'g1', data: { beliefExists: 0.9 } },
      ]

      setupEnvelopeScenario({ canvasNodes, canvasEdges })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.confidence_differentiated).toBe(true)
      expect(result.current.diagnostics.confidence_unique_values).toEqual([0.7, 0.9])
    })

    it('confidence_differentiated excludes structural edges from canvas', () => {
      const canvasNodes = [
        { id: 'd1', type: 'decision', data: { kind: 'decision', label: 'Decision' } },
        { id: 'o1', type: 'option', data: { kind: 'option', label: 'Opt A' } },
        { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'Factor' } },
        { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Goal' } },
      ]
      const canvasEdges = [
        // Structural edges (decision→option, option→factor): should be excluded
        { id: 'e1', source: 'd1', target: 'o1', data: { beliefExists: 0.5 } },
        { id: 'e2', source: 'o1', target: 'f1', data: { beliefExists: 0.6 } },
        // Causal edge: should be included
        { id: 'e3', source: 'f1', target: 'g1', data: { beliefExists: 0.8 } },
      ]

      setupEnvelopeScenario({ canvasNodes, canvasEdges })

      const { result } = renderHook(() => useDebugData())
      // Only 1 unique value (0.8) from the causal edge
      expect(result.current.diagnostics.confidence_differentiated).toBe(false)
      expect(result.current.diagnostics.confidence_unique_values).toEqual([0.8])
    })

    it('intercept_populated is true when canvas nodes have intercept', () => {
      const canvasNodes = [
        { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'Price', intercept: 0.3 } },
        { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' } },
      ]

      setupEnvelopeScenario({ canvasNodes })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.intercept_populated).toBe(true)
    })

    it('intercept_populated is true for intercept = 0', () => {
      const canvasNodes = [
        { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'Price', intercept: 0 } },
        { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Revenue' } },
      ]

      setupEnvelopeScenario({ canvasNodes })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.intercept_populated).toBe(true)
    })

    it('llm_raw_available is true when _diagnostic_trace has llm_raw without llm_calls', () => {
      setupEnvelopeScenario({
        envelopeDiagnosticTrace: {
          // llm_raw present, llm_calls absent
          llm_raw: { prompt: 'Build a decision model...', tokens: 1500 },
        },
      })

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.llm_raw_available).toBe(true)
      expect(result.current.diagnostics.llm_raw_path_found).toBe('_diagnostic_trace.llm_raw')
    })

    it('confidence falls back to canvas edges when CEE has nodes but no edges', () => {
      // Simulate a partial CEE response: nodes at top level but edges missing.
      // Canvas store has the full graph. Edge confidence should come from canvas.
      const ceePayload = {
        id: 'req-partial-1',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v1/turn',
        method: 'POST',
        status: 200,
        completed: true,
        duration: 2000,
        timestamp: Date.now(),
        request: { body: {} },
        response: {
          body: {
            // Has nodes but NO edges at top level
            nodes: [
              { id: 'f1', kind: 'factor' },
              { id: 'g1', kind: 'goal' },
            ],
          },
        },
      }

      const canvasNodes = [
        { id: 'f1', type: 'factor', data: { kind: 'factor', label: 'A' } },
        { id: 'g1', type: 'goal', data: { kind: 'goal', label: 'Goal' } },
      ]
      const canvasEdges = [
        { id: 'e1', source: 'f1', target: 'g1', data: { beliefExists: 0.65 } },
      ]

      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: canvasNodes,
          edges: canvasEdges,
          runMeta: null,
        })
      )
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [ceePayload] })
      )

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.confidence_unique_values).toEqual([0.65])
    })

    it('all checks degrade gracefully when no trace and no canvas data', () => {
      setupEnvelopeScenario({})

      const { result } = renderHook(() => useDebugData())
      expect(result.current.diagnostics.cee_trace_present).toBe(false)
      expect(result.current.diagnostics.llm_raw_available).toBe(false)
      expect(result.current.diagnostics.confidence_differentiated).toBe(false)
      expect(result.current.diagnostics.confidence_unique_values).toEqual([])
      expect(result.current.diagnostics.intercept_populated).toBe(false)
    })
  })

  // ===================================================================
  // Round-6 review — end-to-end hook test for the fallback V5 path
  // ===================================================================
  describe('round-6: end-to-end fallback V5 trace id threading', () => {
    it('when fallback returns a V5 turn, cee_capture_selected_trace_id matches that payload id', () => {
      // The selector returns undefined (no analysis-producing chip),
      // but the trace store has a V5 turn. The fallback path picks
      // that turn AND useDebugData threads its id through to
      // cee_capture_selected_trace_id so the bundle assembler pins
      // canonical metadata to the SAME body.
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            {
              id: 'tp-fallback-v5',
              service: 'CEE',
              endpoint: '/bff/orchestrate/v2/turn',
              status: 200,
              completed: true,
              // No analysis-producing chip/action metadata — selector
              // returns undefined for analysis-producing candidate.
              request: { body: { scenario_id: 'scn-1' } },
              response: { body: { ok: true } },
            },
          ],
        }),
      )
      const { result } = renderHook(() => useDebugData())
      // Provenance is V5-confirmed fallback.
      expect(result.current.cee_capture_provenance).toBe(
        'fallback_v5_turn',
      )
      // Trace id is threaded through.
      expect(result.current.cee_capture_selected_trace_id).toBe(
        'tp-fallback-v5',
      )
    })

    it('legacy CEE fallback does NOT thread a trace id (must not pin into V5 metadata)', () => {
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({
          payloads: [
            {
              id: 'tp-legacy',
              service: 'CEE',
              endpoint: '/bff/cee/turn', // LEGACY
              status: 200,
              completed: true,
              request: { body: { scenario_id: 'scn-1' } },
              response: { body: { legacy: true } },
            },
          ],
        }),
      )
      const { result } = renderHook(() => useDebugData())
      expect(result.current.cee_capture_provenance).toBe(
        'fallback_legacy_cee',
      )
      // Legacy entries are deliberately NOT pinned into V5 metadata.
      expect(result.current.cee_capture_selected_trace_id).toBeNull()
    })
  })

  // ============================================================
  // Workstream: DGAI debug output — preserve latest analysis
  // evidence after follow-up turns (2026-05-23).
  //
  // End-to-end hook coverage for the analysis_evidence_trace split.
  // The selector unit tests cover behaviour in isolation; the bundle
  // integration tests inject DebugData fields directly. Neither
  // covers the wiring from `usePayloadTraceStore` → the new
  // selector → DebugData fields. These tests close that gap.
  // ============================================================
  describe('analysis_evidence_trace split — hook wiring (workstream 2026-05-23)', () => {
    // Canonical evidence-bearing CEE response.
    const evidenceBearingCeeResponse = {
      blocks: [
        { type: 'text', text: 'Ran analysis.' },
        {
          type: 'analysis_result',
          enrichment: {
            option_comparison: [{ id: 'opt_a', win_probability: 0.72 }],
            factor_sensitivity: [{ factor_id: 'f1' }],
            robustness: { level: 'high' },
          },
        },
      ],
    }
    const proseFollowUpCeeResponse = {
      blocks: [{ type: 'text', text: 'Here is what would flip…' }],
    }

    it('BUG REPRO (hook level): older run_analysis + newer follow-up → analysis_evidence_trace_source = recovered_earlier_cee_turn; conversational trace differs', () => {
      // Trace store as the user would see after running analysis then
      // clicking "What could change the outcome?": newest (idx 0) is
      // the prose-only follow-up, older (idx 1) is the run_analysis.
      const followUpTrace = {
        id: 'tp-follow-up',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        status: 200,
        completed: true,
        turnType: 'explain',
        request: {
          body: {
            scenario_id: 'scn-1',
            chip: { action_type: 'what_would_flip' },
          },
        },
        response: { body: proseFollowUpCeeResponse },
      }
      const runAnalysisTrace = {
        id: 'tp-run-analysis',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        status: 200,
        completed: true,
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-1' } },
        response: { body: evidenceBearingCeeResponse },
      }
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [followUpTrace, runAnalysisTrace] }),
      )
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [],
          edges: [],
          runMeta: null,
          currentScenarioId: 'scn-1',
          results: null,
        }),
      )

      const { result } = renderHook(() => useDebugData())

      // Conversational trace = the prose follow-up (existing
      // selector chose it on recency).
      expect(result.current.conversational_trace_id).toBe('tp-follow-up')
      expect(result.current.cee_capture_selected_trace_id).toBe(
        'tp-follow-up',
      )
      // Evidence trace = the earlier run_analysis (new selector
      // recovered it because the follow-up has no enrichment).
      expect(result.current.analysis_evidence_trace_id).toBe(
        'tp-run-analysis',
      )
      expect(result.current.analysis_evidence_trace_source).toBe(
        'recovered_earlier_cee_turn',
      )
      // Recovered body is threaded through DebugData so the bundle
      // can surface it for reviewer audit.
      expect(
        result.current.analysis_evidence_cee_response_body,
      ).toEqual(evidenceBearingCeeResponse)
      // Diagnostics surface the evidence-bearing selector's view.
      expect(
        result.current.analysis_evidence_selection_diagnostics
          ?.evidence_bearing_candidate_count,
      ).toBe(1)
      expect(
        result.current.analysis_evidence_selection_diagnostics
          ?.analysis_producing_candidate_count,
      ).toBe(2)
    })

    it('IMMEDIATE POST-ANALYSIS (hook level): single run_analysis → analysis_evidence_trace_source = selected_cee_turn; trace ids match', () => {
      const runAnalysisTrace = {
        id: 'tp-run-only',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        status: 200,
        completed: true,
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-1' } },
        response: { body: evidenceBearingCeeResponse },
      }
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [runAnalysisTrace] }),
      )
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [],
          edges: [],
          runMeta: null,
          currentScenarioId: 'scn-1',
          results: null,
        }),
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.analysis_evidence_trace_source).toBe(
        'selected_cee_turn',
      )
      expect(result.current.analysis_evidence_trace_id).toBe(
        result.current.conversational_trace_id,
      )
    })

    it('NO EVIDENCE (hook level): only prose turns → analysis_evidence_trace_source = unavailable', () => {
      const proseOnlyTrace = {
        id: 'tp-prose',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        status: 200,
        completed: true,
        turnType: 'explain',
        request: { body: { scenario_id: 'scn-1' } },
        response: { body: proseFollowUpCeeResponse },
      }
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [proseOnlyTrace] }),
      )
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [],
          edges: [],
          runMeta: null,
          currentScenarioId: 'scn-1',
          results: null,
        }),
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.analysis_evidence_trace_source).toBe(
        'unavailable',
      )
      expect(result.current.analysis_evidence_trace_id).toBeNull()
      expect(
        result.current.analysis_evidence_cee_response_body,
      ).toBeNull()
      expect(result.current.analysis_evidence_selected_reason).toBe(
        'no_evidence_bearing_candidate',
      )
    })

    it('HASH MATCH OVERRIDES SCENARIO REJECTION (hook level): cross-scenario hash-matched trace is selected; scenario_status = scenario_conflict_overridden_by_hash', () => {
      // Edge case from FB-P1-1: canvas results.hash points at an
      // analysis from a different scenario (canvas state
      // inconsistency). Hash match still wins so we recover the
      // ACTUAL evidence trace, surfaced via scenario_status.
      const crossScenarioRun = {
        id: 'tp-cross-scenario',
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        status: 200,
        completed: true,
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-other' } },
        response: {
          body: {
            ...evidenceBearingCeeResponse,
            response_hash: 'hash-abc',
          },
        },
      }
      vi.mocked(usePayloadTraceStore).mockImplementation((selector) =>
        selector({ payloads: [crossScenarioRun] }),
      )
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({
          ceePipelineTrace: null,
          nodes: [],
          edges: [],
          runMeta: null,
          currentScenarioId: 'scn-current',
          results: { hash: 'hash-abc' },
        }),
      )

      const { result } = renderHook(() => useDebugData())

      expect(result.current.analysis_evidence_trace_id).toBe(
        'tp-cross-scenario',
      )
      expect(result.current.analysis_evidence_selected_reason).toBe(
        'hash_matched',
      )
      expect(
        result.current.analysis_evidence_selection_diagnostics
          ?.scenario_status,
      ).toBe('scenario_conflict_overridden_by_hash')
    })
  })
})
