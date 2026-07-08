/**
 * useResultsSectionData — robustness.display_verdict consumption
 * (lane 35 fix 3, ROADMAP 1.6 consumer side; producer = PLoT #202).
 *
 * PLoT emits the display-safe `robustness.display_verdict`
 * ('robust' | 'moderate' | 'fragile' | 'not_assessed') plus the
 * producer-owned `display_verdict_reason` phrase. The hook must consume
 * them fail-closed on BOTH paths (raw fresh-run response and the mapped
 * report a saved/hydrated run takes), render them verbatim, and keep the
 * honest undefined → "Robustness unknown" state ONLY when the field is
 * absent (older PLoT builds).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV2ResponseToReportV1 } from '../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

const FRAGILE_REASON = 'small changes could flip this result'

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
    ],
    critiques: [],
    drivers: [],
    edge_sensitivity: [],
    factor_sensitivity: [],
    robustness: { fragile_edges: [], robust_edges: ['e1'] },
    response_hash: 'h',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'standard', latency_ms: 100 },
    ...overrides,
  }
}

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
]

function setStoreWithRawResponse(v2Response: V2RunResponse): void {
  useCanvasStore.setState({
    // Empty mapped report — forces the raw-response (fresh-run) path.
    results: { status: 'complete', progress: 100, report: {} } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: v2Response as any,
  } as any)
}

function setStoreWithMappedReport(v2Response: V2RunResponse): void {
  const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    // No raw V2 response — forces the mapped-report (hydrated/saved) path.
    rawV2Response: null,
  } as any)
}

describe('useResultsSectionData — robustness.display_verdict consumption (ROADMAP 1.6)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  it('exposes the producer verdict + reason VERBATIM from the raw response (fresh run)', () => {
    setStoreWithRawResponse(
      makeV2Response({
        robustness: {
          fragile_edges: [], robust_edges: ['e1'],
          display_verdict: 'fragile',
          display_verdict_reason: FRAGILE_REASON,
        } as any,
      }),
    )
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBe('fragile')
    expect(result.current.recommendation?.robustnessVerdictReason).toBe(FRAGILE_REASON)
  })

  it('exposes the producer verdict + reason from the mapped report (saved/hydrated run)', () => {
    setStoreWithMappedReport(
      makeV2Response({
        robustness: {
          fragile_edges: [], robust_edges: ['e1'],
          display_verdict: 'robust',
          display_verdict_reason: 'this result held up under the changes we tested',
        } as any,
      }),
    )
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBe('robust')
    expect(result.current.recommendation?.robustnessVerdictReason).toBe(
      'this result held up under the changes we tested',
    )
  })

  it("carries the producer's not_assessed verdict (a stated absence, not a UI guess)", () => {
    setStoreWithRawResponse(
      makeV2Response({
        robustness: {
          fragile_edges: [], robust_edges: [],
          display_verdict: 'not_assessed',
          display_verdict_reason: 'robustness was not assessed for this run',
        } as any,
      }),
    )
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBe('not_assessed')
    expect(result.current.recommendation?.robustnessVerdictReason).toBe(
      'robustness was not assessed for this run',
    )
  })

  it('keeps the verdict undefined when the field is absent (older PLoT builds)', () => {
    setStoreWithRawResponse(makeV2Response())
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBeUndefined()
    expect(result.current.recommendation?.robustnessVerdictReason).toBeUndefined()
  })

  it('fails closed on an unrecognised verdict token — never renders producer tokens it cannot vouch for', () => {
    setStoreWithRawResponse(
      makeV2Response({
        robustness: {
          fragile_edges: [], robust_edges: [],
          display_verdict: 'excellent',
          display_verdict_reason: 'sounds great',
        } as any,
      }),
    )
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBeUndefined()
    // The reason is never exposed without its verdict.
    expect(result.current.recommendation?.robustnessVerdictReason).toBeUndefined()
  })

  it('never invents a reason: a valid verdict without a reason exposes no reason', () => {
    setStoreWithRawResponse(
      makeV2Response({
        robustness: {
          fragile_edges: [], robust_edges: [],
          display_verdict: 'moderate',
        } as any,
      }),
    )
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBe('moderate')
    expect(result.current.recommendation?.robustnessVerdictReason).toBeUndefined()
  })
})
