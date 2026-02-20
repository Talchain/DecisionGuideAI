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
})
