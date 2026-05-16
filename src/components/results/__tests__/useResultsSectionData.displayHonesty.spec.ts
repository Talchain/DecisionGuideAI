/**
 * useResultsSectionData — display-honesty hook-level integration.
 *
 * Drives the data hook through a mapped report (not raw V2 response) to
 * pin the final report→VM fallbacks for `nValidSamples` and
 * `flipThresholdsStatus`. The earlier mapper test proves PLoT → report
 * preserves the fields; this test proves report → VM exposes them on
 * `OptionResult` and `DecisionResultData`, which is the path saved or
 * hydrated results actually take in production.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

function makeV2Response(overrides: Partial<V2RunResponse> = {}): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      {
        option_id: 'opt_a',
        option_label: 'Option A',
        confidence_interval: [30, 70],
        win_probability: 0.65,
        outcome: {
          mean: 50, std: 12, p10: 30, p50: 50, p90: 70,
          n_samples: 1000, n_valid_samples: 1000, validity_ratio: 1,
        },
      },
      {
        option_id: 'opt_b',
        option_label: 'Option B',
        confidence_interval: [20, 60],
        win_probability: 0,
        outcome: {
          mean: 35, std: 14, p10: 20, p50: 35, p90: 60,
          n_samples: 1000, n_valid_samples: 998, validity_ratio: 0.998,
        },
      },
    ],
    critiques: [],
    drivers: [{ node_id: 'd', label: 'D', contribution: 0.5, direction: 'positive' }],
    edge_sensitivity: [],
    factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.4, importance_rank: 1 }],
    robustness: { fragile_edges: [], robust_edges: ['e1'] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
    ...overrides,
  }
}

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

function setStoreWithMappedReport(v2Response: V2RunResponse): void {
  const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })
  useCanvasStore.setState({
    // Mapped report — simulating a saved or hydrated run.
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    // No raw V2 response — forces the report-fallback path.
    rawV2Response: null,
  } as any)
}

describe('useResultsSectionData — display-honesty (report → VM fallback)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  describe('nValidSamples propagates from mapped report', () => {
    it('exposes per-option nValidSamples on OptionResult when raw response is absent (hydrated/saved path)', () => {
      setStoreWithMappedReport(makeV2Response())

      const { result } = renderHook(() => useResultsSectionData())

      const allOptions = result.current.recommendation?.allOptions ?? []
      const optA = allOptions.find(o => o.id === 'opt_a')
      const optB = allOptions.find(o => o.id === 'opt_b')

      expect(optA?.nValidSamples).toBe(1000)
      expect(optB?.nValidSamples).toBe(998)
    })

    it('falls back to outcome.n_samples when n_valid_samples is absent', () => {
      const v2 = makeV2Response({
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            confidence_interval: [30, 70],
            win_probability: 0.65,
            outcome: { mean: 50, std: 12, p10: 30, p50: 50, p90: 70, n_samples: 5000 },
          },
        ],
      })
      setStoreWithMappedReport(v2)

      const { result } = renderHook(() => useResultsSectionData())
      const optA = result.current.recommendation?.allOptions?.find(o => o.id === 'opt_a')

      expect(optA?.nValidSamples).toBe(5000)
    })

    it('leaves nValidSamples undefined when neither per-option nor meta sample counts are available', () => {
      const v2 = makeV2Response({
        option_comparison: [
          {
            option_id: 'opt_a',
            option_label: 'Option A',
            confidence_interval: [30, 70],
            win_probability: 0.65,
            // outcome present but no sample-count fields
            outcome: { mean: 50, std: 12, p10: 30, p50: 50, p90: 70 },
          },
        ],
        meta: { seed_used: '42', n_samples: 0 as unknown as number, detail_level: 'standard', latency_ms: 100 },
      })
      setStoreWithMappedReport(v2)

      const { result } = renderHook(() => useResultsSectionData())
      const optA = result.current.recommendation?.allOptions?.find(o => o.id === 'opt_a')

      expect(optA?.nValidSamples).toBeUndefined()
    })
  })

  describe('fresh-run flip_thresholds source precedence (top-level wins over nested)', () => {
    it('prefers rawV2Response.flip_thresholds over rawV2Response.robustness.flip_thresholds when both are present', () => {
      // Fresh-run + hydrated runs must use the same precedence so the
      // UI behaviour does not diverge when the same PLoT response is
      // served from a cache vs computed live. The mapper prefers
      // top-level (see responseMapper display-honesty block); this test
      // pins the same contract on the raw-response path.
      const topLevel = [
        { factor_id: 'top_f1', factor_label: 'Top-level F1', flip_value: 0.4, flip_reason: 'found', current_value: 0.5, direction: 'decrease' as const, alternative_winner_label: 'B' },
      ]
      const nested = [
        { factor_id: 'nested_f1', factor_label: 'Nested F1', flip_value: 0.2, flip_reason: 'found', current_value: 0.5, direction: 'decrease' as const, alternative_winner_label: 'C' },
      ]
      useCanvasStore.setState({
        // Empty results.report so the selector's report-side defensive
        // adaptor cannot supply flip_thresholds — forces it to fall
        // back to rawV2Response.
        results: { status: 'complete', progress: 100, report: {} } as any,
        runMeta: {} as any,
        nodes: OPTION_NODES as any,
        edges: [],
        hasCompletedFirstRun: true,
        rawV2Response: {
          ...makeV2Response(),
          flip_thresholds: topLevel,
          robustness: {
            fragile_edges: [], robust_edges: ['e1'],
            flip_thresholds: nested as unknown as never,
          },
        } as any,
      } as any)

      const { result } = renderHook(() => useResultsSectionData())
      const flips = result.current.recommendation?.flipThresholds ?? []

      expect(flips).toHaveLength(1)
      expect(flips[0]?.node_id).toBe('top_f1')
      // Negative assertion to catch a future precedence regression:
      expect(flips[0]?.node_id).not.toBe('nested_f1')
    })

    it('falls back to rawV2Response.robustness.flip_thresholds when top-level is absent (legacy shape)', () => {
      const nested = [
        { factor_id: 'nested_f1', factor_label: 'Nested F1', flip_value: 0.2, flip_reason: 'found', current_value: 0.5, direction: 'decrease' as const, alternative_winner_label: 'C' },
      ]
      useCanvasStore.setState({
        results: { status: 'complete', progress: 100, report: {} } as any,
        runMeta: {} as any,
        nodes: OPTION_NODES as any,
        edges: [],
        hasCompletedFirstRun: true,
        rawV2Response: {
          ...makeV2Response(),
          // flip_thresholds intentionally absent at top level.
          robustness: {
            fragile_edges: [], robust_edges: ['e1'],
            flip_thresholds: nested as unknown as never,
          },
        } as any,
      } as any)

      const { result } = renderHook(() => useResultsSectionData())
      const flips = result.current.recommendation?.flipThresholds ?? []

      expect(flips).toHaveLength(1)
      expect(flips[0]?.node_id).toBe('nested_f1')
    })
  })

  describe('flipThresholdsStatus propagates from mapped report', () => {
    it('exposes flipThresholdsStatus on DecisionResultData when raw response is absent (hydrated/saved path)', () => {
      setStoreWithMappedReport(makeV2Response({ flip_thresholds_status: 'all_no_effect' }))

      const { result } = renderHook(() => useResultsSectionData())

      expect(result.current.recommendation?.flipThresholdsStatus).toBe('all_no_effect')
      expect(result.current.recommendation?.flipThresholdsHasUnresolved).toBe(false)
    })

    it('flips flipThresholdsHasUnresolved to true when the mapped report carries a status_reason', () => {
      setStoreWithMappedReport(
        makeV2Response({
          flip_thresholds_status: 'partial_no_effect',
          flip_thresholds_status_reason: 'timeout',
        }),
      )

      const { result } = renderHook(() => useResultsSectionData())

      expect(result.current.recommendation?.flipThresholdsStatus).toBe('partial_no_effect')
      expect(result.current.recommendation?.flipThresholdsHasUnresolved).toBe(true)
    })

    it('leaves flipThresholdsStatus undefined for older responses that predate the status field', () => {
      setStoreWithMappedReport(makeV2Response())

      const { result } = renderHook(() => useResultsSectionData())

      expect(result.current.recommendation?.flipThresholdsStatus).toBeUndefined()
      expect(result.current.recommendation?.flipThresholdsHasUnresolved).toBe(false)
    })
  })
})
